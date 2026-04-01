package report

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

const groupedWorkflowSampleLimit = 3

func FormatText(result *model.AnalysisResult, verbose bool) string {
	out := "API Doctor Analysis Report\n"
	out += "==========================\n\n"
	out += fmt.Sprintf("Spec: %s\n", result.SpecFile)
	out += fmt.Sprintf("Operations analyzed: %d\n\n", len(result.Operations))

	if len(result.Issues) == 0 {
		out += "No issues found.\n"
		return out
	}

	groups := map[string][]*model.Issue{}
	for _, issue := range result.Issues {
		groups[issue.Severity] = append(groups[issue.Severity], issue)
	}

	for _, sev := range []string{"error", "warning", "info"} {
		issues := groups[sev]
		if len(issues) == 0 {
			continue
		}

		sort.Slice(issues, func(i, j int) bool {
			if issues[i].Path != issues[j].Path {
				return issues[i].Path < issues[j].Path
			}
			return issues[i].Operation < issues[j].Operation
		})

		out += fmt.Sprintf("%s (%d issues)\n", title(sev), len(issues))
		out += "---\n"

		if !verbose {
			acceptedIssues := filterIssuesByCode(issues, "weak-accepted-tracking-linkage")
			followUpIssues := filterIssuesByCode(issues, "weak-follow-up-linkage")
			for _, issue := range filterIssuesWithoutCodes(issues, "weak-accepted-tracking-linkage", "weak-follow-up-linkage") {
				// Default mode is scan-friendly first: severity + code + endpoint.
				out += fmt.Sprintf("  [%s] %s\n", strings.ToUpper(issue.Severity), issue.Code)
				out += fmt.Sprintf("      Endpoint: %s %s\n", issue.Operation, issue.Path)
				out += fmt.Sprintf("      Why it matters: %s\n", issue.Description)
				out += "\n"
			}

			if len(followUpIssues) > 0 {
				out += formatFollowUpLinkageSummary(followUpIssues)
				out += "\n"
			}

			if len(acceptedIssues) > 0 {
				out += formatAcceptedTrackingSummary(acceptedIssues)
				out += "\n"
			}

			continue
		}

		for _, issue := range issues {
			// Default mode is scan-friendly first: severity + code + endpoint.
			out += fmt.Sprintf("  [%s] %s\n", strings.ToUpper(issue.Severity), issue.Code)
			out += fmt.Sprintf("      Endpoint: %s %s\n", issue.Operation, issue.Path)
			out += fmt.Sprintf("      Why it matters: %s\n", issue.Description)

			if verbose {
				out += fmt.Sprintf("      Technical detail: %s\n", issue.Message)
				out += fmt.Sprintf("      Rule: %s\n", issue.Code)
			}

			out += "\n"
		}
	}

	out += "Summary\n"
	out += "-------\n"
	out += fmt.Sprintf("Total issues: %d\n", len(result.Issues))
	if c, ok := groups["error"]; ok {
		out += fmt.Sprintf("Errors: %d\n", len(c))
	}
	if c, ok := groups["warning"]; ok {
		out += fmt.Sprintf("Warnings: %d\n", len(c))
	}
	if c, ok := groups["info"]; ok {
		out += fmt.Sprintf("Info: %d\n", len(c))
	}

	if !verbose {
		out += "\nTip: use --verbose for technical detail per finding.\n"
	}

	return out
}

func FormatJSON(result *model.AnalysisResult) (string, error) {
	summary := map[string]int{}
	for _, issue := range result.Issues {
		summary[issue.Severity]++
	}

	payload := map[string]interface{}{
		"spec":         result.SpecFile,
		"operations":   len(result.Operations),
		"total_issues": len(result.Issues),
		"summary":      summary,
		"issues":       result.Issues,
	}

	b, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func title(s string) string {
	if len(s) == 0 {
		return s
	}
	if s[0] >= 'a' && s[0] <= 'z' {
		return string(s[0]-'a'+'A') + s[1:]
	}
	return s
}

func filterIssuesByCode(issues []*model.Issue, code string) []*model.Issue {
	filtered := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == code {
			filtered = append(filtered, issue)
		}
	}
	return filtered
}

func filterIssuesWithoutCode(issues []*model.Issue, code string) []*model.Issue {
	filtered := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code != code {
			filtered = append(filtered, issue)
		}
	}
	return filtered
}

func filterIssuesWithoutCodes(issues []*model.Issue, codes ...string) []*model.Issue {
	excluded := make(map[string]bool, len(codes))
	for _, code := range codes {
		excluded[code] = true
	}

	filtered := make([]*model.Issue, 0)
	for _, issue := range issues {
		if !excluded[issue.Code] {
			filtered = append(filtered, issue)
		}
	}
	return filtered
}

func formatFollowUpLinkageSummary(issues []*model.Issue) string {
	if len(issues) == 0 {
		return ""
	}

	patternGroups := map[string][]*model.Issue{}
	for _, issue := range issues {
		pattern := followUpLinkagePattern(issue.Message)
		patternGroups[pattern] = append(patternGroups[pattern], issue)
	}

	patterns := make([]string, 0, len(patternGroups))
	for pattern := range patternGroups {
		patterns = append(patterns, pattern)
	}
	sort.Strings(patterns)

	familySet := map[string]bool{}
	for _, issue := range issues {
		familySet[endpointFamily(issue.Path)] = true
	}

	out := ""
	out += "  [WARNING] weak-follow-up-linkage\n"
	out += fmt.Sprintf("      Workflow self-descriptiveness signal: %d endpoints across %d endpoint families.\n", len(issues), len(familySet))
	out += "      Why it matters: Two-step flows are harder to automate when a create or collection response does not visibly provide the identifier needed for the next endpoint.\n"
	out += "      Default output is grouped here because this rule can produce many closely related findings.\n"

	for _, pattern := range patterns {
		group := patternGroups[pattern]
		sort.Slice(group, func(i, j int) bool {
			if group[i].Path != group[j].Path {
				return group[i].Path < group[j].Path
			}
			return group[i].Operation < group[j].Operation
		})

		familyCounts := map[string]int{}
		for _, issue := range group {
			familyCounts[endpointFamily(issue.Path)]++
		}

		familySummaries := make([]string, 0, len(familyCounts))
		for _, family := range sortedFamiliesByCount(familyCounts) {
			familySummaries = append(familySummaries, fmt.Sprintf("%s (%d)", family, familyCounts[family]))
		}

		sampleEndpoints := make([]string, 0, groupedWorkflowSampleLimit)
		for i, issue := range group {
			if i >= groupedWorkflowSampleLimit {
				break
			}
			sampleEndpoints = append(sampleEndpoints, fmt.Sprintf("%s %s", issue.Operation, issue.Path))
		}

		out += fmt.Sprintf("      Pattern: %s\n", pattern)
		out += fmt.Sprintf("      Count: %d endpoints across %d families\n", len(group), len(familyCounts))
		out += fmt.Sprintf("      Sample families: %s\n", strings.Join(limitStrings(familySummaries, groupedWorkflowSampleLimit), ", "))
		out += fmt.Sprintf("      Sample endpoints: %s\n", strings.Join(sampleEndpoints, "; "))
		if len(group) > groupedWorkflowSampleLimit {
			out += fmt.Sprintf("      More endpoints: %d more hidden here; use --verbose or --json for the full list.\n", len(group)-groupedWorkflowSampleLimit)
		}
	}

	return out
}

func formatAcceptedTrackingSummary(issues []*model.Issue) string {
	if len(issues) == 0 {
		return ""
	}

	patternGroups := map[string][]*model.Issue{}
	for _, issue := range issues {
		patternGroups[acceptedTrackingPattern(issue.Message)] = append(patternGroups[acceptedTrackingPattern(issue.Message)], issue)
	}

	patterns := make([]string, 0, len(patternGroups))
	for pattern := range patternGroups {
		patterns = append(patterns, pattern)
	}
	sort.Strings(patterns)

	familySet := map[string]bool{}
	for _, issue := range issues {
		familySet[endpointFamily(issue.Path)] = true
	}

	out := ""
	out += "  [WARNING] weak-accepted-tracking-linkage\n"
	out += fmt.Sprintf("      Workflow self-descriptiveness signal: %d endpoints across %d endpoint families.\n", len(issues), len(familySet))
	out += "      Why it matters: Accepted-now-check-later workflows are harder to automate when the initiating response does not clearly show how to track completion.\n"
	out += "      Default output is grouped here because this rule is broad and can produce many closely related findings.\n"

	for _, pattern := range patterns {
		group := patternGroups[pattern]
		sort.Slice(group, func(i, j int) bool {
			if group[i].Path != group[j].Path {
				return group[i].Path < group[j].Path
			}
			return group[i].Operation < group[j].Operation
		})

		familyCounts := map[string]int{}
		for _, issue := range group {
			familyCounts[endpointFamily(issue.Path)]++
		}

		familySummaries := make([]string, 0, len(familyCounts))
		for _, family := range sortedFamiliesByCount(familyCounts) {
			familySummaries = append(familySummaries, fmt.Sprintf("%s (%d)", family, familyCounts[family]))
		}

		sampleEndpoints := make([]string, 0, groupedWorkflowSampleLimit)
		for i, issue := range group {
			if i >= groupedWorkflowSampleLimit {
				break
			}
			sampleEndpoints = append(sampleEndpoints, fmt.Sprintf("%s %s", issue.Operation, issue.Path))
		}

		out += fmt.Sprintf("      Pattern: %s\n", pattern)
		out += fmt.Sprintf("      Count: %d endpoints across %d families\n", len(group), len(familyCounts))
		out += fmt.Sprintf("      Sample families: %s\n", strings.Join(limitStrings(familySummaries, groupedWorkflowSampleLimit), ", "))
		out += fmt.Sprintf("      Sample endpoints: %s\n", strings.Join(sampleEndpoints, "; "))
		if len(group) > groupedWorkflowSampleLimit {
			out += fmt.Sprintf("      More endpoints: %d more hidden here; use --verbose or --json for the full list.\n", len(group)-groupedWorkflowSampleLimit)
		}
	}

	return out
}

func followUpLinkagePattern(message string) string {
	switch {
	case strings.Contains(message, "detail endpoint(s):"):
		return fmt.Sprintf("Follow-up identifier not clearly exposed for %s", strings.TrimSpace(strings.SplitN(message, ":", 2)[1]))
	default:
		return "Other follow-up linkage self-descriptiveness gaps"
	}
}

func acceptedTrackingPattern(message string) string {
	switch {
	case strings.Contains(message, "has no JSON body"):
		return "202 Accepted responses with no JSON tracking payload"
	case strings.Contains(message, "does not clearly expose a tracking identifier"):
		return "202 Accepted JSON responses with no clear tracking identifier"
	default:
		return "Other accepted-tracking self-descriptiveness gaps"
	}
}

func endpointFamily(path string) string {
	segments := strings.Split(strings.Trim(path, "/"), "/")
	static := make([]string, 0, 1)
	for _, segment := range segments {
		if segment == "" || strings.HasPrefix(segment, "{") {
			continue
		}
		static = append(static, segment)
		if len(static) == 1 {
			break
		}
	}
	if len(static) == 0 {
		return "/"
	}
	return "/" + strings.Join(static, "/")
}

func sortedFamiliesByCount(counts map[string]int) []string {
	families := make([]string, 0, len(counts))
	for family := range counts {
		families = append(families, family)
	}
	sort.Slice(families, func(i, j int) bool {
		if counts[families[i]] != counts[families[j]] {
			return counts[families[i]] > counts[families[j]]
		}
		return families[i] < families[j]
	})
	return families
}

func limitStrings(values []string, limit int) []string {
	if len(values) <= limit {
		return values
	}
	return values[:limit]
}
