package report

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

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
