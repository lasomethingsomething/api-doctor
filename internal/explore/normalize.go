package explore

import (
	"fmt"
	"sort"
	"strings"
	"time"

	intdiff "github.com/lasomethingsomething/api-doctor/internal/diff"
	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/model"
	"github.com/lasomethingsomething/api-doctor/internal/workflow"
)

var workflowBurdenCodes = map[string]bool{
	"weak-follow-up-linkage":                  true,
	"weak-action-follow-up-linkage":           true,
	"weak-accepted-tracking-linkage":          true,
	"weak-outcome-next-action-guidance":       true,
	"prerequisite-task-burden":                true,
	"contract-shape-workflow-guidance-burden": true,
}

var consistencyCodes = map[string]bool{
	"path-parameter-name-drift":           true,
	"sibling-path-shape-drift":            true,
	"endpoint-path-style-drift":           true,
	"inconsistent-response-shapes":        true,
	"inconsistent-response-shapes-family": true,
}

var contractShapeCodes = map[string]bool{
	"contract-shape-workflow-guidance-burden": true,
	"snapshot-heavy-response":                 true,
	"deeply-nested-response-structure":        true,
	"duplicated-state-response":               true,
	"incidental-internal-field-exposure":      true,
}

func BuildPayload(
	analysis *model.AnalysisResult,
	endpointScores map[string]*endpoint.EndpointScore,
	graph *workflow.Graph,
	workflowScores map[string]*workflow.WorkflowScore,
	chainScores map[string]*workflow.ChainScore,
	diffResult *intdiff.Result,
	generatedAt time.Time,
	baseSpec string,
	headSpec string,
) *Payload {
	payload := &Payload{
		Run:             RunContext{SpecPath: analysis.SpecFile, GeneratedAt: generatedAt.Format(time.RFC3339)},
		Summary:         Summary{SeverityCounts: map[string]int{"error": 0, "warning": 0, "info": 0}},
		EndpointDetails: make(map[string]EndpointDetail),
		Workflows:       WorkflowSection{FamilyCounts: map[string]int{}, Entries: []WorkflowEntry{}, Chains: []ChainEntry{}},
		GraphSeed:       GraphSeed{Nodes: []GraphNode{}, Edges: []GraphEdge{}},
	}
	if baseSpec != "" {
		payload.Run.BaseSpecPath = baseSpec
	}
	if headSpec != "" {
		payload.Run.HeadSpecPath = headSpec
	}

	issuesByEndpoint := map[string][]*model.Issue{}
	familyCounts := map[string]int{}
	workflowBurdenCount := 0
	contractShapeCount := 0
	consistencyCount := 0
	specRuleCount := 0

	for _, issue := range analysis.Issues {
		payload.Summary.TotalFindings++
		payload.Summary.SeverityCounts[issue.Severity]++
		id := issueEndpointID(issue)
		issuesByEndpoint[id] = append(issuesByEndpoint[id], issue)
		familyCounts[endpointFamily(issue.Path)]++
		if workflowBurdenCodes[issue.Code] {
			workflowBurdenCount++
		}
		if contractShapeCodes[issue.Code] {
			contractShapeCount++
		}
		if consistencyCodes[issue.Code] {
			consistencyCount++
		}
		if issue.EvidenceType == "spec-rule" {
			specRuleCount++
		}
	}

	nodeSeen := map[string]bool{}
	rows := make([]EndpointRow, 0, len(analysis.Operations))
	for _, op := range analysis.Operations {
		id := endpointID(op.Method, op.Path)
		issues := issuesByEndpoint[id]
		sevCounts := map[string]int{"error": 0, "warning": 0, "info": 0}
		catCounts := map[string]int{}
		burdens := map[string]bool{}
		for _, issue := range issues {
			sevCounts[issue.Severity]++
			cat := categoryForIssue(issue.Code, issue.EvidenceType)
			catCounts[cat]++
			bf := burdenFocusForIssue(issue.Code, issue.EvidenceType)
			if bf != "" {
				burdens[bf] = true
			}
		}
		row := EndpointRow{
			ID:             id,
			Method:         strings.ToUpper(op.Method),
			Path:           op.Path,
			Findings:       len(issues),
			SeverityCounts: sevCounts,
			CategoryCounts: catCounts,
			BurdenFocuses:  mapKeysSorted(burdens),
			Priority:       priorityLabel(len(issues), scoreForEndpoint(endpointScores, op.Method, op.Path)),
			RiskSummary:    riskSummary(scoreForEndpoint(endpointScores, op.Method, op.Path)),
			Family:         endpointFamily(op.Path),
		}
		rows = append(rows, row)
		if len(issues) > 0 {
			payload.Summary.EndpointsWithIssue++
		}

		findingDetails := make([]FindingDetail, 0, len(issues))
		for _, issue := range issues {
			fd := FindingDetail{
				Code:        issue.Code,
				Severity:    issue.Severity,
				Category:    categoryForIssue(issue.Code, issue.EvidenceType),
				BurdenFocus: burdenFocusForIssue(issue.Code, issue.EvidenceType),
				Operation:   issue.Operation,
				Message:     issue.Message,
				Impact:      issue.Description,
			}
			if issue.EvidenceType == "spec-rule" {
				fd.EvidenceType = issue.EvidenceType
				fd.SpecRuleID = issue.SpecRuleID
				fd.NormativeLevel = issue.NormativeLevel
				fd.SpecSource = issue.SpecSource
				fd.SpecLocation = issue.SpecLocation
			}
			findingDetails = append(findingDetails, fd)
		}
		sort.Slice(findingDetails, func(i, j int) bool {
			if findingDetails[i].Severity != findingDetails[j].Severity {
				return severityRank(findingDetails[i].Severity) < severityRank(findingDetails[j].Severity)
			}
			return findingDetails[i].Code < findingDetails[j].Code
		})
		payload.EndpointDetails[id] = EndpointDetail{Endpoint: row, Findings: findingDetails}

		if !nodeSeen[id] {
			payload.GraphSeed.Nodes = append(payload.GraphSeed.Nodes, GraphNode{ID: id, Kind: "endpoint", Label: row.Method + " " + row.Path})
			nodeSeen[id] = true
		}
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Findings != rows[j].Findings {
			return rows[i].Findings > rows[j].Findings
		}
		if rows[i].Priority != rows[j].Priority {
			return priorityRank(rows[i].Priority) < priorityRank(rows[j].Priority)
		}
		if rows[i].Path != rows[j].Path {
			return rows[i].Path < rows[j].Path
		}
		return rows[i].Method < rows[j].Method
	})
	payload.Endpoints = rows
	payload.Summary.EndpointsAnalyzed = len(analysis.Operations)

	if graph != nil {
		payload.Summary.WorkflowsInferred = len(graph.Edges)
		payload.Summary.ChainsInferred = len(graph.Chains)
		for i, edge := range graph.Edges {
			entry := WorkflowEntry{
				ID:        fmt.Sprintf("wf-%d", i),
				Kind:      edge.Kind,
				FromID:    endpointID(edge.From.Method, edge.From.Path),
				FromLabel: strings.ToUpper(edge.From.Method) + " " + edge.From.Path,
				ToID:      endpointID(edge.To.Method, edge.To.Path),
				ToLabel:   strings.ToUpper(edge.To.Method) + " " + edge.To.Path,
				Reason:    edge.Reason,
			}
			if s, ok := workflowScores[fmt.Sprintf("%d", i)]; ok {
				entry.Score = fmt.Sprintf("%d/%d/%d", s.UIIndependence, s.SchemaCompleteness, s.ClientGenerationQuality)
			}
			payload.Workflows.Entries = append(payload.Workflows.Entries, entry)
			payload.Workflows.FamilyCounts[edge.Kind]++
			payload.GraphSeed.Edges = append(payload.GraphSeed.Edges, GraphEdge{From: entry.FromID, To: entry.ToID, Kind: edge.Kind})
			if d, ok := payload.EndpointDetails[entry.FromID]; ok {
				d.RelatedWorkflows = append(d.RelatedWorkflows, entry)
				payload.EndpointDetails[entry.FromID] = d
			}
			if d, ok := payload.EndpointDetails[entry.ToID]; ok {
				d.RelatedWorkflows = append(d.RelatedWorkflows, entry)
				payload.EndpointDetails[entry.ToID] = d
			}
		}

		for i, chain := range graph.Chains {
			endpointIDs := make([]string, 0, len(chain.Steps))
			parts := make([]string, 0, len(chain.Steps))
			for _, step := range chain.Steps {
				eid := endpointID(step.Node.Method, step.Node.Path)
				endpointIDs = append(endpointIDs, eid)
				parts = append(parts, step.Role+": "+strings.ToUpper(step.Node.Method)+" "+step.Node.Path)
			}
			entry := ChainEntry{
				ID:          fmt.Sprintf("chain-%d", i),
				Kind:        chain.Kind,
				EndpointIDs: endpointIDs,
				Summary:     strings.Join(parts, " -> "),
				Reason:      chain.Reason,
			}
			if s, ok := chainScores[fmt.Sprintf("%d", i)]; ok {
				entry.Score = fmt.Sprintf("%d/%d/%d", s.UIIndependence, s.SchemaCompleteness, s.ClientGenerationQuality)
			}
			payload.Workflows.Chains = append(payload.Workflows.Chains, entry)
			for _, eid := range endpointIDs {
				if d, ok := payload.EndpointDetails[eid]; ok {
					d.RelatedChains = append(d.RelatedChains, entry)
					payload.EndpointDetails[eid] = d
				}
			}
		}
	}

	if diffResult != nil {
		d := &DiffSection{ByCode: map[string]int{}, BySeverity: map[string]int{}, Entries: []DiffChangeEntry{}}
		for _, change := range diffResult.Changes {
			entry := DiffChangeEntry{
				Code: change.Code, Severity: change.Severity, Path: change.Path,
				Operation: change.Operation, Location: change.Location,
				Message: change.Message, Description: change.Description,
			}
			d.TotalChanges++
			d.ByCode[change.Code]++
			d.BySeverity[change.Severity]++
			d.Entries = append(d.Entries, entry)
			for id, detail := range payload.EndpointDetails {
				if detail.Endpoint.Path == change.Path {
					detail.RelatedDiff = append(detail.RelatedDiff, entry)
					payload.EndpointDetails[id] = detail
				}
			}
		}
		payload.Diff = d
	}

	topFamilyLabel := "none"
	topFamilies := topFamilies(familyCounts, 3)
	if len(topFamilies) > 0 {
		topFamilyLabel = strings.Join(topFamilies, ", ")
	}
	payload.FixFirst = []FixFirstItem{
		{ID: "spec-rule", Label: "Spec rule violations", Value: fmt.Sprintf("%d findings", specRuleCount), Description: "OpenAPI-normative findings (MUST/SHOULD). Grounded in explicit spec language.", Filter: FilterPreset{Category: "spec-rule"}},
		{ID: "workflow-burden", Label: "Workflow burden", Value: fmt.Sprintf("%d findings", workflowBurdenCount), Description: "Focus on weak next-step linkage and task continuity.", Filter: FilterPreset{BurdenFocus: "workflow-burden"}},
		{ID: "contract-shape", Label: "Contract-shape burden", Value: fmt.Sprintf("%d findings", contractShapeCount), Description: "Review snapshot-heavy responses that hide task outcomes.", Filter: FilterPreset{BurdenFocus: "contract-shape"}},
		{ID: "consistency", Label: "Consistency outliers", Value: fmt.Sprintf("%d findings", consistencyCount), Description: "Inspect naming/shape drift across related routes.", Filter: FilterPreset{Category: "consistency"}},
		{ID: "families", Label: "High-priority endpoint families", Value: topFamilyLabel, Description: "Top endpoint families by finding concentration.", Filter: FilterPreset{}},
	}
	return payload
}

func endpointID(method, path string) string {
	return strings.ToUpper(method) + "|" + path
}

func issueEndpointID(issue *model.Issue) string {
	method := issueMethod(issue.Operation)
	return endpointID(method, issue.Path)
}

func issueMethod(operation string) string {
	fields := strings.Fields(operation)
	if len(fields) == 0 {
		return ""
	}
	method := strings.ToUpper(fields[0])
	switch method {
	case "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE", "CONNECT":
		return method
	default:
		return ""
	}
}

func scoreForEndpoint(scores map[string]*endpoint.EndpointScore, method, path string) *endpoint.EndpointScore {
	if scores == nil {
		return nil
	}
	if score, ok := scores[strings.Join([]string{method, path}, "|")]; ok {
		return score
	}
	if score, ok := scores[strings.Join([]string{strings.ToLower(method), path}, "|")]; ok {
		return score
	}
	if score, ok := scores[strings.Join([]string{strings.ToUpper(method), path}, "|")]; ok {
		return score
	}
	return nil
}

func categoryForIssue(code, evidenceType string) string {
	if evidenceType == "spec-rule" {
		return "spec-rule"
	}
	if contractShapeCodes[code] {
		return "contract-shape"
	}
	if consistencyCodes[code] {
		return "consistency"
	}
	if workflowBurdenCodes[code] {
		return "workflow-burden"
	}
	if strings.Contains(code, "deprecated") || strings.Contains(code, "removed-") || strings.Contains(code, "enum-value") || strings.Contains(code, "field-became-required") {
		return "change-risk"
	}
	if strings.Contains(code, "enum") || strings.Contains(code, "schema") || strings.Contains(code, "object") {
		return "contract-quality"
	}
	return "other"
}

func burdenFocusForIssue(code, evidenceType string) string {
	// Spec-rule findings are not a burden track; they are a distinct evidence type.
	if evidenceType == "spec-rule" {
		return ""
	}
	if contractShapeCodes[code] {
		return "contract-shape"
	}
	if workflowBurdenCodes[code] {
		return "workflow-burden"
	}
	if consistencyCodes[code] {
		return "consistency"
	}
	return ""
}

func riskSummary(score *endpoint.EndpointScore) string {
	if score == nil {
		return "No score"
	}
	return fmt.Sprintf("Schema %d/5 | Client %d/5 | Versioning %d/5", score.SchemaCompleteness, score.ClientGenerationQuality, score.VersioningSafety)
}

func priorityLabel(findings int, score *endpoint.EndpointScore) string {
	if score == nil {
		if findings > 0 {
			return "medium"
		}
		return "low"
	}
	minScore := score.SchemaCompleteness
	if score.ClientGenerationQuality < minScore {
		minScore = score.ClientGenerationQuality
	}
	if score.VersioningSafety < minScore {
		minScore = score.VersioningSafety
	}
	if findings >= 10 || minScore <= 2 {
		return "high"
	}
	if findings >= 3 || minScore == 3 {
		return "medium"
	}
	return "low"
}

func priorityRank(label string) int {
	switch label {
	case "high":
		return 0
	case "medium":
		return 1
	default:
		return 2
	}
}

func severityRank(sev string) int {
	switch sev {
	case "error":
		return 0
	case "warning":
		return 1
	default:
		return 2
	}
}

func endpointFamily(path string) string {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return "/"
	}
	parts := strings.Split(trimmed, "/")
	if parts[0] == "_action" && len(parts) > 1 {
		return "/_action/" + parts[1]
	}
	if parts[0] == "search" && len(parts) > 1 {
		return "/search/" + parts[1]
	}
	return "/" + parts[0]
}

func topFamilies(counts map[string]int, limit int) []string {
	type familyCount struct {
		family string
		count  int
	}
	items := make([]familyCount, 0, len(counts))
	for k, v := range counts {
		items = append(items, familyCount{family: k, count: v})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].count != items[j].count {
			return items[i].count > items[j].count
		}
		return items[i].family < items[j].family
	})
	if len(items) > limit {
		items = items[:limit]
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		result = append(result, fmt.Sprintf("%s (%d)", item.family, item.count))
	}
	return result
}

func mapKeysSorted(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
