package report

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/model"
)

const groupedWorkflowSampleLimit = 3

func FormatText(result *model.AnalysisResult, scores map[string]*endpoint.EndpointScore, verbose bool) string {
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
			burdenIssues := filterIssuesByCode(issues, "prerequisite-task-burden")
			for _, issue := range filterIssuesWithoutCodes(issues, "weak-accepted-tracking-linkage", "weak-follow-up-linkage", "prerequisite-task-burden") {
				// Default mode is scan-friendly first: severity + code + endpoint.
				out += fmt.Sprintf("  [%s] %s\n", strings.ToUpper(issue.Severity), issueDisplayCode(issue.Code))
				out += fmt.Sprintf("      Endpoint: %s %s\n", issue.Operation, issue.Path)
				out += fmt.Sprintf("      Why it matters: %s\n", issue.Description)
				if issue.Code == "sibling-path-shape-drift" {
					out += fmt.Sprintf("      Shape detail: %s\n", issue.Message)
				}
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

			if len(burdenIssues) > 0 {
				out += formatTaskBurdenSummary(burdenIssues)
				out += "\n"
			}

			continue
		}

		for _, issue := range issues {
			// Default mode is scan-friendly first: severity + code + endpoint.
			out += fmt.Sprintf("  [%s] %s\n", strings.ToUpper(issue.Severity), issueDisplayCode(issue.Code))
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

	// Endpoint Quality Summary
	out += "\nEndpoint Quality\n"
	out += "----------------\n"
	schemaScore := buildScoreDistribution(scores, "schema")
	out += fmt.Sprintf("Schema Completeness:      %s\n", schemaScore)
	clientScore := buildScoreDistribution(scores, "client")
	out += fmt.Sprintf("Client Generation:       %s\n", clientScore)
	versioningScore := buildScoreDistribution(scores, "versioning")
	out += fmt.Sprintf("Versioning Safety:       %s\n", versioningScore)

	if !verbose {
		out += "\nTip: use --verbose for technical detail per finding.\n"
	}

	return out
}

func FormatJSON(result *model.AnalysisResult, scores map[string]*endpoint.EndpointScore) (string, error) {
	summary := map[string]int{}
	for _, issue := range result.Issues {
		summary[issue.Severity]++
	}

	// Build endpoint scores map keyed by method|path
	endpointList := make([]map[string]interface{}, 0, len(result.Operations))
	for _, op := range result.Operations {
		key := strings.Join([]string{op.Method, op.Path}, "|")
		score := scores[key]
		
		endpoint := map[string]interface{}{
			"path":   op.Path,
			"method": op.Method,
		}
		
		if score != nil {
			endpoint["score"] = map[string]interface{}{
				"schema_completeness":       score.SchemaCompleteness,
				"client_generation_quality": score.ClientGenerationQuality,
				"versioning_safety":         score.VersioningSafety,
				"explanation":               score.Explanation,
			}
		}
		
		endpointList = append(endpointList, endpoint)
	}

	payload := map[string]interface{}{
		"spec":         result.SpecFile,
		"operations":   len(result.Operations),
		"total_issues": len(result.Issues),
		"summary":      summary,
		"endpoints":    endpointList,
		"issues":       result.Issues,
	}

	b, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func buildScoreDistribution(scores map[string]*endpoint.EndpointScore, dimension string) string {
	if len(scores) == 0 {
		return "no endpoints"
	}

	var excellent, good, fair, poor int
	for _, score := range scores {
		var value int
		switch dimension {
		case "schema":
			value = score.SchemaCompleteness
		case "client":
			value = score.ClientGenerationQuality
		case "versioning":
			value = score.VersioningSafety
		default:
			return ""
		}

		switch {
		case value == 5:
			excellent++
		case value == 4:
			good++
		case value == 3:
			fair++
		default:
			poor++
		}
	}

	parts := []string{}
	if excellent > 0 {
		parts = append(parts, fmt.Sprintf("%d/5 (%d%%)", 5, excellent*100/len(scores)))
	}
	if good > 0 {
		parts = append(parts, fmt.Sprintf("%d/5 (%d%%)", 4, good*100/len(scores)))
	}
	if fair > 0 {
		parts = append(parts, fmt.Sprintf("%d/5 (%d%%)", 3, fair*100/len(scores)))
	}
	if poor > 0 {
		parts = append(parts, fmt.Sprintf("≤2/5 (%d%%)", poor*100/len(scores)))
	}

	if len(parts) == 0 {
		return "n/a"
	}
	return strings.Join(parts, " | ")
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

func issueDisplayCode(code string) string {
	if strings.TrimSpace(code) == "prerequisite-task-burden" {
		return "prerequisite-task-burden (task burden signal)"
	}
	return code
}

func formatTaskBurdenSummary(issues []*model.Issue) string {
	if len(issues) == 0 {
		return ""
	}

	familySet := map[string]bool{}
	levelCounts := map[string]int{"high": 0, "medium": 0, "low": 0}
	for _, issue := range issues {
		familySet[endpointFamily(issue.Path)] = true
		level := taskBurdenLevel(issue.Message)
		if _, ok := levelCounts[level]; ok {
			levelCounts[level]++
		}
	}

	sampleEndpoints := make([]string, 0, groupedWorkflowSampleLimit)
	for i, issue := range issues {
		if i >= groupedWorkflowSampleLimit {
			break
		}
		sampleEndpoints = append(sampleEndpoints, fmt.Sprintf("%s %s", issue.Operation, issue.Path))
	}

	out := ""
	out += "  [WARNING] prerequisite-task-burden (task burden signal)\n"
	out += fmt.Sprintf("      Prerequisite burden signal: %d endpoints across %d endpoint families.\n", len(issues), len(familySet))
	out += "      Why it matters: These tasks appear to require extra prerequisite coordination before and after the main call.\n"
	out += fmt.Sprintf("      Burden levels: high=%d, medium=%d, low=%d\n", levelCounts["high"], levelCounts["medium"], levelCounts["low"])
	out += fmt.Sprintf("      Sample endpoints: %s\n", strings.Join(sampleEndpoints, "; "))
	if len(issues) > groupedWorkflowSampleLimit {
		out += fmt.Sprintf("      More endpoints: %d more hidden here; use --verbose or --json for the full list.\n", len(issues)-groupedWorkflowSampleLimit)
	}

	return out
}

func taskBurdenLevel(message string) string {
	lower := strings.ToLower(strings.TrimSpace(message))
	switch {
	case strings.HasPrefix(lower, "high prerequisite burden"):
		return "high"
	case strings.HasPrefix(lower, "medium prerequisite burden"):
		return "medium"
	default:
		return "low"
	}
}

func FormatAnalysisMarkdown(result *model.AnalysisResult, scores map[string]*endpoint.EndpointScore) string {
	out := "# API Analysis Report\n\n"
	out += fmt.Sprintf("**Spec:** %s | **Operations:** %d\n\n", result.SpecFile, len(result.Operations))

	if len(result.Issues) == 0 {
		out += "No issues found.\n"
		return out
	}

	// Summary table
	summary := map[string]int{}
	for _, issue := range result.Issues {
		summary[issue.Severity]++
	}

	out += "## Summary\n\n"
	out += "| Severity | Count |\n"
	out += "|---|---|\n"
	for _, sev := range []string{"error", "warning", "info"} {
		if count, ok := summary[sev]; ok {
			out += fmt.Sprintf("| %s | %d |\n", strings.ToTitle(sev), count)
		}
	}
	out += "\n"

	// Endpoint Quality Summary
	if len(scores) > 0 {
		out += "## Endpoint Quality Summary\n\n"
		out += "| Dimension | Excellent (5) | Good (4) | Fair (3) | Poor (≤2) |\n"
		out += "|---|---|---|---|---|\n"

		dims := []struct {
			name string
			key  string
		}{
			{"Schema Completeness", "schema"},
			{"Client Generation", "client"},
			{"Versioning Safety", "versioning"},
		}

		for _, dim := range dims {
			var excellent, good, fair, poor int
			for _, score := range scores {
				var value int
				switch dim.key {
				case "schema":
					value = score.SchemaCompleteness
				case "client":
					value = score.ClientGenerationQuality
				case "versioning":
					value = score.VersioningSafety
				}

				switch {
				case value == 5:
					excellent++
				case value == 4:
					good++
				case value == 3:
					fair++
				default:
					poor++
				}
			}
			out += fmt.Sprintf("| %s | %d | %d | %d | %d |\n", dim.name, excellent, good, fair, poor)
		}
		out += "\n"
	}

	// Issues grouped by severity
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

		out += fmt.Sprintf("## %s (%d)\n\n", strings.ToTitle(sev), len(issues))

		codeGroups := map[string][]*model.Issue{}
		for _, issue := range issues {
			codeGroups[issue.Code] = append(codeGroups[issue.Code], issue)
		}

		codes := make([]string, 0, len(codeGroups))
		for code := range codeGroups {
			codes = append(codes, code)
		}
		sort.Strings(codes)

		for _, code := range codes {
			codeIssues := codeGroups[code]
			out += fmt.Sprintf("### `%s`\n\n", issueDisplayCode(code))
			for _, issue := range codeIssues {
				out += fmt.Sprintf("- **Endpoint:** `%s %s`\n", issue.Operation, issue.Path)
				out += fmt.Sprintf("  **Impact:** %s\n", issue.Description)
				out += fmt.Sprintf("  **Details:** %s\n", issue.Message)
				out += "\n"
			}
		}
	}

	return out
}
