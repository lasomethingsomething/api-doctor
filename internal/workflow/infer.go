package workflow

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

type Node struct {
	Path        string
	Method      string
	OperationID string
}

type Edge struct {
	Kind   string
	From   Node
	To     Node
	Reason string
}

type ChainStep struct {
	Role string `json:"role"`
	Node Node   `json:"node"`
}

type Chain struct {
	Kind   string      `json:"kind"`
	Steps  []ChainStep `json:"steps"`
	Reason string      `json:"reason"`
}

type Graph struct {
	Nodes []Node
	Edges []Edge
	Chains []Chain
}

// WorkflowScore rates a workflow across three dimensions (1-5)
type WorkflowScore struct {
	UIIndependence         int    // 1-5: can it be automated without user intervention?
	SchemaCompleteness     int    // 1-5: how well-defined are request/response schemas?
	ClientGenerationQuality int    // 1-5: can generators create clean APIs?
	Explanation            string // brief explanation of scores
}

// ChainScore rates a multi-step chain using worst-step composition and continuity penalties.
type ChainScore struct {
	UIIndependence          int    `json:"ui_independence"`
	SchemaCompleteness      int    `json:"schema_completeness"`
	ClientGenerationQuality int    `json:"client_generation_quality"`
	ContinuityPenalty       int    `json:"continuity_penalty"`
	Explanation             string `json:"score_explanation"`
}

const workflowSampleLimit = 3

func Infer(operations []*model.Operation) *Graph {
	graph := &Graph{
		Nodes: make([]Node, 0, len(operations)),
		Edges: make([]Edge, 0),
		Chains: make([]Chain, 0),
	}

	for _, op := range operations {
		graph.Nodes = append(graph.Nodes, nodeFromOperation(op))
	}

	detailByBase := map[string]*model.Operation{}
	for _, op := range operations {
		basePath, ok := detailBasePath(op)
		if !ok {
			continue
		}
		detailByBase[basePath] = op
	}

	seen := map[string]bool{}
	for _, op := range operations {
		if detailOp, edge, ok := inferCreateEdge(op, detailByBase); ok {
			appendEdge(graph, seen, op, detailOp, edge)
		}
		if detailOp, edge, ok := inferActionEdge(op, detailByBase); ok {
			appendEdge(graph, seen, op, detailOp, edge)
		}
		if detailOp, edge, ok := inferListEdge(op, detailByBase); ok {
			appendEdge(graph, seen, op, detailOp, edge)
		}
	}

	inferChains(graph, operations)

	sort.Slice(graph.Edges, func(i, j int) bool {
		if graph.Edges[i].Kind != graph.Edges[j].Kind {
			return graph.Edges[i].Kind < graph.Edges[j].Kind
		}
		if graph.Edges[i].From.Path != graph.Edges[j].From.Path {
			return graph.Edges[i].From.Path < graph.Edges[j].From.Path
		}
		return graph.Edges[i].To.Path < graph.Edges[j].To.Path
	})

	return graph
}

func inferChains(graph *Graph, operations []*model.Operation) {
	opIndex := buildOperationIndex(operations)
	seen := map[string]bool{}
	listByBase := map[string][]Chain{}
	createByBase := map[string][]Chain{}

	for _, edge := range graph.Edges {
		switch edge.Kind {
		case "list-to-detail":
			if chain, ok := inferListDetailUpdateChain(edge, opIndex); ok {
				if base, _, ok := detailPathBaseAndParam(edge.To.Path); ok {
					listByBase[base] = append(listByBase[base], chain)
				}
			}
			if chain, ok := inferOrderDetailActionChain(edge, operations); ok {
				appendChain(graph, seen, chain)
			}
		case "create-to-detail":
			if chain, ok := inferCreateDetailUpdateChain(edge, opIndex); ok {
				if base, _, ok := detailPathBaseAndParam(edge.To.Path); ok {
					createByBase[base] = append(createByBase[base], chain)
				}
			}
			if chain, ok := inferMediaDetailFollowUpChain(edge, operations); ok {
				appendChain(graph, seen, chain)
			}
		}
	}

	bases := make([]string, 0, len(listByBase)+len(createByBase))
	baseSeen := map[string]bool{}
	for base := range listByBase {
		bases = append(bases, base)
		baseSeen[base] = true
	}
	for base := range createByBase {
		if !baseSeen[base] {
			bases = append(bases, base)
		}
	}
	sort.Strings(bases)

	for _, base := range bases {
		if chains := listByBase[base]; len(chains) > 0 {
			appendChain(graph, seen, pickBestListCRUDChain(chains))
			continue
		}
		if chains := createByBase[base]; len(chains) > 0 {
			appendChain(graph, seen, pickFirstChain(chains))
		}
	}

	sort.Slice(graph.Chains, func(i, j int) bool {
		if graph.Chains[i].Kind != graph.Chains[j].Kind {
			return graph.Chains[i].Kind < graph.Chains[j].Kind
		}
		if len(graph.Chains[i].Steps) == 0 || len(graph.Chains[j].Steps) == 0 {
			return len(graph.Chains[i].Steps) < len(graph.Chains[j].Steps)
		}
		left := graph.Chains[i].Steps[0].Node.Path
		right := graph.Chains[j].Steps[0].Node.Path
		if left != right {
			return left < right
		}
		return graph.Chains[i].Reason < graph.Chains[j].Reason
	})
}

func pickFirstChain(chains []Chain) Chain {
	sort.Slice(chains, func(i, j int) bool {
		if len(chains[i].Steps) == 0 || len(chains[j].Steps) == 0 {
			return len(chains[i].Steps) < len(chains[j].Steps)
		}
		left := chains[i].Steps[0].Node.Path
		right := chains[j].Steps[0].Node.Path
		if left != right {
			return left < right
		}
		return chains[i].Reason < chains[j].Reason
	})
	return chains[0]
}

func pickBestListCRUDChain(chains []Chain) Chain {
	preferred := make([]Chain, 0)
	for _, chain := range chains {
		if len(chain.Steps) > 0 && strings.ToUpper(chain.Steps[0].Node.Method) == "POST" && strings.HasSuffix(chain.Steps[0].Node.Path, "/search") {
			preferred = append(preferred, chain)
		}
	}
	if len(preferred) > 0 {
		return pickFirstChain(preferred)
	}
	return pickFirstChain(chains)
}

// ScoreWorkflow rates a single workflow based on analysis findings
func ScoreWorkflow(edge *Edge, fromOp, toOp *model.Operation, issues []*model.Issue) *WorkflowScore {
	issuesByPathCode := buildIssueMapByPathCode(issues)

	// Count issues by code affecting FROM and TO endpoints
	fromIssuesCount := countIssuesByCode(issuesByPathCode, fromOp.Path)
	toIssuesCount := countIssuesByCode(issuesByPathCode, toOp.Path)

	score := &WorkflowScore{
		UIIndependence:          5,
		SchemaCompleteness:      5,
		ClientGenerationQuality: 5,
	}

	// Client Generation Quality: penalize for missing enums and generic objects
	score.ClientGenerationQuality -= fromIssuesCount["likely-missing-enum"]
	score.ClientGenerationQuality -= fromIssuesCount["generic-object-request"]
	score.ClientGenerationQuality -= fromIssuesCount["generic-object-response"]
	score.ClientGenerationQuality -= toIssuesCount["likely-missing-enum"]
	score.ClientGenerationQuality -= toIssuesCount["generic-object-response"]

	// Schema Completeness: penalize for generic objects and weak linkage
	score.SchemaCompleteness -= fromIssuesCount["generic-object-request"]
	score.SchemaCompleteness -= fromIssuesCount["generic-object-response"]
	score.SchemaCompleteness -= toIssuesCount["generic-object-response"]
	score.SchemaCompleteness -= fromIssuesCount["weak-accepted-tracking-linkage"]
	score.SchemaCompleteness -= fromIssuesCount["weak-action-follow-up-linkage"]
	score.SchemaCompleteness -= fromIssuesCount["weak-follow-up-linkage"]

	// UI Independence: penalize weak linkage and non-exposed identifiers in GET workflows
	score.UIIndependence -= fromIssuesCount["weak-accepted-tracking-linkage"]
	score.UIIndependence -= fromIssuesCount["weak-action-follow-up-linkage"]
	score.UIIndependence -= fromIssuesCount["weak-follow-up-linkage"]
	if !exposesIdentifier(fromOp) && strings.ToUpper(fromOp.Method) == "GET" {
		score.UIIndependence -= 1 // User must select which item, identifier not exposed
	}

	// Clamp scores to 1-5 range
	score.UIIndependence = clampScore(score.UIIndependence)
	score.SchemaCompleteness = clampScore(score.SchemaCompleteness)
	score.ClientGenerationQuality = clampScore(score.ClientGenerationQuality)

	// Build explanation
	score.Explanation = buildScoreExplanation(score, fromOp, fromIssuesCount, toIssuesCount)

	return score
}

// ScoreGraph scores all workflows in a graph
func ScoreGraph(graph *Graph, operations []*model.Operation, issues []*model.Issue) map[string]*WorkflowScore {
	opMap := make(map[string]*model.Operation)
	for _, op := range operations {
		key := strings.Join([]string{op.Method, op.Path}, "|") // Use path|method as key
		opMap[key] = op
	}

	scores := make(map[string]*WorkflowScore)
	for i, edge := range graph.Edges {
		fromKey := strings.Join([]string{edge.From.Method, edge.From.Path}, "|")
		toKey := strings.Join([]string{edge.To.Method, edge.To.Path}, "|")

		fromOp, fromOk := opMap[fromKey]
		toOp, toOk := opMap[toKey]

		if !fromOk || !toOk {
			continue // Skip if endpoints not found
		}

		edgeKey := fmt.Sprintf("%d", i) // Use index as key for edge
		scores[edgeKey] = ScoreWorkflow(&edge, fromOp, toOp, issues)
	}

	return scores
}

// ScoreChains scores all inferred chains deterministically using worst-step composition.
func ScoreChains(graph *Graph, operations []*model.Operation, issues []*model.Issue) map[string]*ChainScore {
	opMap := make(map[string]*model.Operation)
	for _, op := range operations {
		key := strings.Join([]string{op.Method, op.Path}, "|")
		opMap[key] = op
	}

	scores := make(map[string]*ChainScore)
	for i, chain := range graph.Chains {
		score, ok := scoreChain(chain, opMap, issues)
		if !ok {
			continue
		}
		scores[fmt.Sprintf("%d", i)] = score
	}

	return scores
}

func scoreChain(chain Chain, opMap map[string]*model.Operation, issues []*model.Issue) (*ChainScore, bool) {
	if len(chain.Steps) < 2 {
		return nil, false
	}

	stepScores := make([]*WorkflowScore, 0, len(chain.Steps)-1)
	stepLabels := make([]string, 0, len(chain.Steps)-1)

	for i := 0; i < len(chain.Steps)-1; i++ {
		from := chain.Steps[i].Node
		to := chain.Steps[i+1].Node
		fromOp, fromOk := opMap[strings.Join([]string{from.Method, from.Path}, "|")]
		toOp, toOk := opMap[strings.Join([]string{to.Method, to.Path}, "|")]
		if !fromOk || !toOk {
			continue
		}
		edge := &Edge{Kind: "chain-step", From: from, To: to}
		stepScores = append(stepScores, ScoreWorkflow(edge, fromOp, toOp, issues))
		stepLabels = append(stepLabels, fmt.Sprintf("%s -> %s", chain.Steps[i].Role, chain.Steps[i+1].Role))
	}

	if len(stepScores) == 0 {
		return nil, false
	}

	worstUI := 5
	worstSchema := 5
	worstClient := 5
	worstStep := ""

	for i, s := range stepScores {
		if s.UIIndependence < worstUI {
			worstUI = s.UIIndependence
			worstStep = stepLabels[i]
		}
		if s.SchemaCompleteness < worstSchema {
			worstSchema = s.SchemaCompleteness
			if worstStep == "" {
				worstStep = stepLabels[i]
			}
		}
		if s.ClientGenerationQuality < worstClient {
			worstClient = s.ClientGenerationQuality
			if worstStep == "" {
				worstStep = stepLabels[i]
			}
		}
	}

	uiPenalty, schemaPenalty, penaltyReasons := chainContinuityPenalty(chain)

	score := &ChainScore{
		UIIndependence:          clampScore(worstUI - uiPenalty),
		SchemaCompleteness:      clampScore(worstSchema - schemaPenalty),
		ClientGenerationQuality: clampScore(worstClient),
		ContinuityPenalty:       uiPenalty + schemaPenalty,
	}

	if len(penaltyReasons) == 0 {
		score.Explanation = fmt.Sprintf("Worst step %s at %s; no continuity penalty", formatTriplet(worstUI, worstSchema, worstClient), worstStep)
	} else {
		score.Explanation = fmt.Sprintf("Worst step %s at %s; continuity penalty: %s", formatTriplet(worstUI, worstSchema, worstClient), worstStep, strings.Join(penaltyReasons, "; "))
	}

	return score, true
}

func chainContinuityPenalty(chain Chain) (int, int, []string) {
	uiPenalty := 0
	schemaPenalty := 0
	reasons := make([]string, 0)

	if len(chain.Steps) > 0 {
		startRole := strings.ToLower(chain.Steps[0].Role)
		if startRole == "list" || startRole == "search" {
			uiPenalty += 1
			reasons = append(reasons, "-1 UI (selection step before follow-up)")
		}
	}

	if len(chain.Steps) > 0 {
		lastRole := strings.ToLower(chain.Steps[len(chain.Steps)-1].Role)
		if lastRole == "action" {
			schemaPenalty += 1
			reasons = append(reasons, "-1 Schema (action follow-up contract ambiguity)")
		}
	}

	return uiPenalty, schemaPenalty, reasons
}

func formatTriplet(ui, schema, client int) string {
	return fmt.Sprintf("%d/%d/%d", ui, schema, client)
}

// Helper functions

func buildIssueMapByPathCode(issues []*model.Issue) map[string]map[string]int {
	// Structure: map[Path]map[Code]Count
	m := make(map[string]map[string]int)
	for _, issue := range issues {
		if m[issue.Path] == nil {
			m[issue.Path] = make(map[string]int)
		}
		m[issue.Path][issue.Code]++
	}
	return m
}

func countIssuesByCode(issuesByPathCode map[string]map[string]int, path string) map[string]int {
	if issues, ok := issuesByPathCode[path]; ok {
		return issues
	}
	return make(map[string]int)
}

func exposesIdentifier(op *model.Operation) bool {
	for statusCode, response := range op.Responses {
		// Check if 2xx success status
		if len(statusCode) >= 1 && statusCode[0] == '2' {
			if response != nil && response.Content != nil {
				// Check application/json response
				if mediaType, ok := response.Content["application/json"]; ok && mediaType.Schema != nil {
					if responseExposesIdentifier(mediaType.Schema, 0) {
						return true
					}
				}
				// Also check if any response exposes identifier
				for _, mediaType := range response.Content {
					if mediaType.Schema != nil && responseExposesIdentifier(mediaType.Schema, 0) {
						return true
					}
				}
			}
		}
	}
	return false
}

func clampScore(score int) int {
	if score < 1 {
		return 1
	}
	if score > 5 {
		return 5
	}
	return score
}

func buildScoreExplanation(score *WorkflowScore, fromOp *model.Operation, fromIssuesCount, toIssuesCount map[string]int) string {
	var parts []string

	// UI Independence explanation
	if score.UIIndependence < 5 {
		reasons := []string{}
		if fromIssuesCount["weak-accepted-tracking-linkage"] > 0 {
			reasons = append(reasons, "impossible to track completion")
		}
		if fromIssuesCount["weak-action-follow-up-linkage"] > 0 {
			reasons = append(reasons, "resulting state not clearly exposed")
		}
		if fromIssuesCount["weak-follow-up-linkage"] > 0 {
			reasons = append(reasons, "next-step identifier not clearly exposed")
		}
		if !exposesIdentifier(fromOp) && strings.ToUpper(fromOp.Method) == "GET" {
			reasons = append(reasons, "identifier not exposed in response")
		}
		if len(reasons) == 0 {
			reasons = append(reasons, "linkage contract gap")
		}
		parts = append(parts, fmt.Sprintf("UI %d/5: %s", score.UIIndependence, strings.Join(reasons, "; ")))
	} else {
		parts = append(parts, fmt.Sprintf("UI %d/5", score.UIIndependence))
	}

	// Schema Completeness explanation
	if score.SchemaCompleteness < 5 {
		reasons := []string{}
		if fromIssuesCount["generic-object-request"] > 0 || fromIssuesCount["generic-object-response"] > 0 || toIssuesCount["generic-object-response"] > 0 {
			reasons = append(reasons, "generic objects in schema")
		}
		if fromIssuesCount["weak-accepted-tracking-linkage"] > 0 {
			reasons = append(reasons, "202 Accepted lacks tracking ID")
		}
		if fromIssuesCount["weak-action-follow-up-linkage"] > 0 {
			reasons = append(reasons, "no state exposed in action response")
		}
		if fromIssuesCount["weak-follow-up-linkage"] > 0 {
			reasons = append(reasons, "next-step identifier not exposed")
		}
		parts = append(parts, fmt.Sprintf("Schema %d/5: %s", score.SchemaCompleteness, strings.Join(reasons, "; ")))
	} else {
		parts = append(parts, fmt.Sprintf("Schema %d/5", score.SchemaCompleteness))
	}

	// Client Generation Quality explanation
	if score.ClientGenerationQuality < 5 {
		reasons := []string{}
		if fromIssuesCount["likely-missing-enum"] > 0 || toIssuesCount["likely-missing-enum"] > 0 {
			reasons = append(reasons, "missing enums")
		}
		if fromIssuesCount["generic-object-request"] > 0 || fromIssuesCount["generic-object-response"] > 0 || toIssuesCount["generic-object-response"] > 0 {
			reasons = append(reasons, "generic objects")
		}
		parts = append(parts, fmt.Sprintf("Client %d/5: %s", score.ClientGenerationQuality, strings.Join(reasons, "; ")))
	} else {
		parts = append(parts, fmt.Sprintf("Client %d/5", score.ClientGenerationQuality))
	}

	return strings.Join(parts, " | ")
}

func FormatText(specFile string, operationCount int, graph *Graph, scores map[string]*WorkflowScore, chainScores map[string]*ChainScore, verbose bool) string {
	out := "API Doctor Workflow Report\n"
	out += "==========================\n\n"
	out += fmt.Sprintf("Spec: %s\n", specFile)
	out += fmt.Sprintf("Operations analyzed: %d\n", operationCount)
	out += fmt.Sprintf("Inferred workflows: %d\n\n", len(graph.Edges))

	if len(graph.Edges) == 0 && len(graph.Chains) == 0 {
		out += "No high-confidence workflows inferred.\n"
		return out
	}

	if len(graph.Edges) == 0 {
		out += "No high-confidence pairwise workflows inferred.\n"
	}

	if len(graph.Edges) > 0 {
		groups := map[string][]Edge{}
		for _, edge := range graph.Edges {
			groups[edge.Kind] = append(groups[edge.Kind], edge)
		}

		for _, kind := range []string{"action-to-detail", "create-to-detail", "list-to-detail"} {
			edges := groups[kind]
			if len(edges) == 0 {
				continue
			}

		out += fmt.Sprintf("%s (%d)\n", title(kind), len(edges))
		out += "---\n"

		if !verbose {
			if kind == "list-to-detail" {
				out += formatListDetailSummary(edges, scores)
				out += "\n"
				continue
			}

			out += fmt.Sprintf("  Representative workflows: showing %d of %d\n", minInt(len(edges), workflowSampleLimit), len(edges))
			for i, edge := range edges[:minInt(len(edges), workflowSampleLimit)] {
				edgeKey := fmt.Sprintf("%d", findEdgeIndex(graph.Edges, &edge))
				var scoreStr string
				if score, ok := scores[edgeKey]; ok {
					scoreStr = fmt.Sprintf(" [Score: %d/%d/%d]", score.UIIndependence, score.SchemaCompleteness, score.ClientGenerationQuality)
				}
				out += fmt.Sprintf("  %s %s -> %s %s%s\n", strings.ToUpper(edge.From.Method), edge.From.Path, strings.ToUpper(edge.To.Method), edge.To.Path, scoreStr)
				out += fmt.Sprintf("      Why: %s\n", edge.Reason)
				_ = i
			}
			if len(edges) > workflowSampleLimit {
				out += fmt.Sprintf("  More workflows: %d more hidden here; use --verbose or --json for the full list.\n", len(edges)-workflowSampleLimit)
			}
			out += "\n"
			continue
		}

		for i, edge := range edges {
			edgeKey := fmt.Sprintf("%d", findEdgeIndex(graph.Edges, &edge))
			var scoreStr string
			if score, ok := scores[edgeKey]; ok {
				scoreStr = fmt.Sprintf(" [%s]", score.Explanation)
			}
			out += fmt.Sprintf("  %s %s -> %s %s%s\n", strings.ToUpper(edge.From.Method), edge.From.Path, strings.ToUpper(edge.To.Method), edge.To.Path, scoreStr)
			out += fmt.Sprintf("      Why: %s\n", edge.Reason)
			_ = i
		}
		out += "\n"
		}

		if !verbose {
			out += "Tip: use --verbose or --json for the full inferred workflow list.\n"
		}
	}

	out += formatChainTextSection(graph.Chains, chainScores, verbose)

	return out
}

func FormatJSON(specFile string, operationCount int, graph *Graph, scores map[string]*WorkflowScore, chainScores map[string]*ChainScore) (string, error) {
	summary := map[string]int{}
	for _, edge := range graph.Edges {
		summary[edge.Kind]++
	}

	// Attach scores to edges
	type ScoredEdge struct {
		Kind                    string `json:"kind"`
		From                    Node   `json:"from"`
		To                      Node   `json:"to"`
		Reason                  string `json:"reason"`
		UIIndependence          int    `json:"ui_independence"`
		SchemaCompleteness      int    `json:"schema_completeness"`
		ClientGenerationQuality int    `json:"client_generation_quality"`
		ScoreExplanation        string `json:"score_explanation"`
	}

	scoredEdges := make([]ScoredEdge, 0, len(graph.Edges))
	for i, edge := range graph.Edges {
		scoredEdge := ScoredEdge{
			Kind:   edge.Kind,
			From:   edge.From,
			To:     edge.To,
			Reason: edge.Reason,
		}
		edgeKey := fmt.Sprintf("%d", i)
		if score, ok := scores[edgeKey]; ok {
			scoredEdge.UIIndependence = score.UIIndependence
			scoredEdge.SchemaCompleteness = score.SchemaCompleteness
			scoredEdge.ClientGenerationQuality = score.ClientGenerationQuality
			scoredEdge.ScoreExplanation = score.Explanation
		}
		scoredEdges = append(scoredEdges, scoredEdge)
	}

	type ScoredChain struct {
		Kind                    string      `json:"kind"`
		Steps                   []ChainStep `json:"steps"`
		Reason                  string      `json:"reason"`
		UIIndependence          int         `json:"ui_independence"`
		SchemaCompleteness      int         `json:"schema_completeness"`
		ClientGenerationQuality int         `json:"client_generation_quality"`
		ContinuityPenalty       int         `json:"continuity_penalty"`
		ScoreExplanation        string      `json:"score_explanation"`
	}

	scoredChains := make([]ScoredChain, 0, len(graph.Chains))
	for i, chain := range graph.Chains {
		sc := ScoredChain{
			Kind:   chain.Kind,
			Steps:  chain.Steps,
			Reason: chain.Reason,
		}
		if score, ok := chainScores[fmt.Sprintf("%d", i)]; ok {
			sc.UIIndependence = score.UIIndependence
			sc.SchemaCompleteness = score.SchemaCompleteness
			sc.ClientGenerationQuality = score.ClientGenerationQuality
			sc.ContinuityPenalty = score.ContinuityPenalty
			sc.ScoreExplanation = score.Explanation
		}
		scoredChains = append(scoredChains, sc)
	}

	payload := map[string]interface{}{
		"spec":               specFile,
		"operations":         operationCount,
		"inferred_workflows": len(graph.Edges),
		"inferred_chains":    len(graph.Chains),
		"summary":            summary,
		"chain_summary":      summarizeChains(graph.Chains),
		"chain_score_summary": summarizeChainScores(graph.Chains, chainScores),
		"edges":              scoredEdges,
		"chains":             scoredChains,
	}

	b, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func formatListDetailSummary(edges []Edge, scores map[string]*WorkflowScore) string {
	getList := make([]Edge, 0)
	postSearch := make([]Edge, 0)
	other := make([]Edge, 0)

	for _, edge := range edges {
		switch strings.ToUpper(edge.From.Method) {
		case "GET":
			getList = append(getList, edge)
		case "POST":
			if strings.HasSuffix(edge.From.Path, "/search") {
				postSearch = append(postSearch, edge)
			} else {
				other = append(other, edge)
			}
		default:
			other = append(other, edge)
		}
	}

	out := ""
	out += fmt.Sprintf("  Representative workflows: showing %d of %d\n", minInt(len(edges), workflowSampleLimit), len(edges))
	if len(getList) > 0 {
		out += formatWorkflowSubtype("GET list -> detail", getList)
	}
	if len(postSearch) > 0 {
		out += formatWorkflowSubtype("POST search -> detail", postSearch)
	}
	if len(other) > 0 {
		out += formatWorkflowSubtype("Other list/detail flows", other)
	}
	if len(edges) > workflowSampleLimit {
		out += fmt.Sprintf("  More workflows: %d more hidden here; use --verbose or --json for the full list.\n", len(edges)-workflowSampleLimit)
	}
	return out
}

func formatWorkflowSubtype(label string, edges []Edge) string {
	out := ""
	out += fmt.Sprintf("  %s (%d)\n", label, len(edges))
	for _, edge := range edges[:minInt(len(edges), workflowSampleLimit)] {
		out += fmt.Sprintf("  %s %s -> %s %s\n", strings.ToUpper(edge.From.Method), edge.From.Path, strings.ToUpper(edge.To.Method), edge.To.Path)
		out += fmt.Sprintf("      Why: %s\n", edge.Reason)
	}
	return out
}

func appendEdge(graph *Graph, seen map[string]bool, from *model.Operation, to *model.Operation, edge Edge) {
	key := strings.Join([]string{edge.Kind, from.Method, from.Path, to.Method, to.Path}, "|")
	if seen[key] {
		return
	}
	seen[key] = true
	graph.Edges = append(graph.Edges, edge)
}

func appendChain(graph *Graph, seen map[string]bool, chain Chain) {
	if len(chain.Steps) < 3 {
		return
	}
	parts := []string{chain.Kind}
	for _, step := range chain.Steps {
		parts = append(parts, step.Role, strings.ToUpper(step.Node.Method), step.Node.Path)
	}
	key := strings.Join(parts, "|")
	if seen[key] {
		return
	}
	seen[key] = true
	graph.Chains = append(graph.Chains, chain)
}

func buildOperationIndex(operations []*model.Operation) map[string][]*model.Operation {
	idx := make(map[string][]*model.Operation)
	for _, op := range operations {
		idx[op.Path] = append(idx[op.Path], op)
	}
	return idx
}

func inferListDetailUpdateChain(edge Edge, opIndex map[string][]*model.Operation) (Chain, bool) {
	if edge.Kind != "list-to-detail" {
		return Chain{}, false
	}
	updateOp, ok := findUpdateOnDetailPath(edge.To.Path, opIndex)
	if !ok {
		return Chain{}, false
	}
	return Chain{
		Kind: "list-to-detail-to-update",
		Steps: []ChainStep{
			{Role: "list", Node: edge.From},
			{Role: "detail", Node: edge.To},
			{Role: "update", Node: nodeFromOperation(updateOp)},
		},
		Reason: "list/search endpoint links to detail and detail path has a matching update operation",
	}, true
}

func inferCreateDetailUpdateChain(edge Edge, opIndex map[string][]*model.Operation) (Chain, bool) {
	if edge.Kind != "create-to-detail" {
		return Chain{}, false
	}
	updateOp, ok := findUpdateOnDetailPath(edge.To.Path, opIndex)
	if !ok {
		return Chain{}, false
	}
	return Chain{
		Kind: "create-to-detail-to-update",
		Steps: []ChainStep{
			{Role: "create", Node: edge.From},
			{Role: "detail", Node: edge.To},
			{Role: "update", Node: nodeFromOperation(updateOp)},
		},
		Reason: "create endpoint links to detail and detail path has a matching update operation",
	}, true
}

func inferOrderDetailActionChain(edge Edge, operations []*model.Operation) (Chain, bool) {
	if edge.Kind != "list-to-detail" {
		return Chain{}, false
	}
	if !isOrderDetailPath(edge.To.Path) {
		return Chain{}, false
	}
	actionOp, ok := findOrderActionOp(operations)
	if !ok {
		return Chain{}, false
	}
	return Chain{
		Kind: "order-detail-to-action",
		Steps: []ChainStep{
			{Role: "search", Node: edge.From},
			{Role: "detail", Node: edge.To},
			{Role: "action", Node: nodeFromOperation(actionOp)},
		},
		Reason: "order detail endpoint and order action endpoint share explicit order identifier continuity",
	}, true
}

func inferMediaDetailFollowUpChain(edge Edge, operations []*model.Operation) (Chain, bool) {
	if edge.Kind != "create-to-detail" {
		return Chain{}, false
	}
	if !isMediaDetailPath(edge.To.Path) {
		return Chain{}, false
	}
	followUpOp, ok := findMediaFollowUpOp(operations)
	if !ok {
		return Chain{}, false
	}
	return Chain{
		Kind: "media-detail-to-follow-up-action",
		Steps: []ChainStep{
			{Role: "create", Node: edge.From},
			{Role: "detail", Node: edge.To},
			{Role: "action", Node: nodeFromOperation(followUpOp)},
		},
		Reason: "media detail endpoint and follow-up action share explicit media identifier continuity",
	}, true
}

func findUpdateOnDetailPath(detailPath string, opIndex map[string][]*model.Operation) (*model.Operation, bool) {
	ops := opIndex[detailPath]
	for _, op := range ops {
		switch strings.ToUpper(op.Method) {
		case "PUT", "PATCH":
			return op, true
		}
	}
	return nil, false
}

func isOrderDetailPath(path string) bool {
	return path == "/order/{id}" || path == "/orders/{id}"
}

func findOrderActionOp(operations []*model.Operation) (*model.Operation, bool) {
	for _, op := range operations {
		if strings.ToUpper(op.Method) != "POST" {
			continue
		}
		if strings.HasPrefix(op.Path, "/_action/order/{orderId}/") {
			return op, true
		}
	}
	return nil, false
}

func isMediaDetailPath(path string) bool {
	return path == "/media/{id}"
}

func findMediaFollowUpOp(operations []*model.Operation) (*model.Operation, bool) {
	for _, op := range operations {
		method := strings.ToUpper(op.Method)
		if method != "POST" && method != "PATCH" {
			continue
		}
		if strings.HasPrefix(op.Path, "/_action/media/{mediaId}/") || strings.HasPrefix(op.Path, "/media/{id}/") {
			return op, true
		}
	}
	return nil, false
}

func inferCreateEdge(op *model.Operation, detailByBase map[string]*model.Operation) (*model.Operation, Edge, bool) {
	basePath, ok := createBasePath(op)
	if !ok {
		return nil, Edge{}, false
	}
	detailOp, ok := detailByBase[basePath]
	if !ok {
		return nil, Edge{}, false
	}
	_, schema, ok := successfulJSONResponseSchema(op)
	if !ok || !responseExposesIdentifier(schema, 0) {
		return nil, Edge{}, false
	}

	return detailOp, Edge{
		Kind:   "create-to-detail",
		From:   nodeFromOperation(op),
		To:     nodeFromOperation(detailOp),
		Reason: "create response visibly exposes an id and a matching detail endpoint exists",
	}, true
}

func inferActionEdge(op *model.Operation, detailByBase map[string]*model.Operation) (*model.Operation, Edge, bool) {
	detailPath, ok := actionTransitionDetailPath(op)
	if !ok {
		return nil, Edge{}, false
	}
	basePath, _, ok := detailPathBaseAndParam(detailPath)
	if !ok {
		return nil, Edge{}, false
	}
	detailOp, ok := detailByBase[basePath]
	if !ok {
		return nil, Edge{}, false
	}

	return detailOp, Edge{
		Kind:   "action-to-detail",
		From:   nodeFromOperation(op),
		To:     nodeFromOperation(detailOp),
		Reason: "action path already carries the resource id and a matching detail endpoint exists for follow-up verification",
	}, true
}

func inferListEdge(op *model.Operation, detailByBase map[string]*model.Operation) (*model.Operation, Edge, bool) {
	basePath, ok := listBasePath(op)
	if !ok {
		return nil, Edge{}, false
	}
	detailOp, ok := detailByBase[basePath]
	if !ok {
		return nil, Edge{}, false
	}
	_, schema, ok := successfulJSONResponseSchema(op)
	if !ok || !collectionExposesIdentifier(schema, 0) {
		return nil, Edge{}, false
	}

	return detailOp, Edge{
		Kind:   "list-to-detail",
		From:   nodeFromOperation(op),
		To:     nodeFromOperation(detailOp),
		Reason: "list or search response visibly exposes item ids and a matching detail endpoint exists",
	}, true
	}

func nodeFromOperation(op *model.Operation) Node {
	if op == nil {
		return Node{}
	}
	return Node{Path: op.Path, Method: op.Method, OperationID: op.OperationID}
}

func detailBasePath(op *model.Operation) (string, bool) {
	if op == nil || strings.ToUpper(op.Method) != "GET" {
		return "", false
	}
	segments := splitPathSegments(op.Path)
	if len(segments) != 2 || !isPathParam(segments[1]) {
		return "", false
	}
	paramName := strings.TrimSuffix(strings.TrimPrefix(segments[1], "{"), "}")
	if paramName != "id" {
		return "", false
	}
	return "/" + segments[0], true
}

func createBasePath(op *model.Operation) (string, bool) {
	if op == nil || strings.ToUpper(op.Method) != "POST" {
		return "", false
	}
	if strings.Contains(op.Path, "{") || strings.HasPrefix(op.Path, "/_action/") || strings.HasSuffix(op.Path, "/search") {
		return "", false
	}
	return op.Path, true
}

func listBasePath(op *model.Operation) (string, bool) {
	if op == nil || strings.Contains(op.Path, "{") {
		return "", false
	}
	method := strings.ToUpper(op.Method)
	if method == "GET" && strings.Contains(strings.ToLower(op.OperationID), "list") {
		return op.Path, true
	}
	if method == "POST" && strings.HasSuffix(op.Path, "/search") {
		basePath := strings.TrimSuffix(op.Path, "/search")
		if basePath == "" {
			return "", false
		}
		return basePath, true
	}
	return "", false
}

func successfulJSONResponseSchema(op *model.Operation) (string, *model.Schema, bool) {
	if op == nil {
		return "", nil, false
	}
	for _, code := range []string{"200", "201", "202"} {
		resp, ok := op.Responses[code]
		if !ok || resp == nil {
			continue
		}
		mt, ok := resp.Content["application/json"]
		if ok && mt != nil && mt.Schema != nil {
			return code, mt.Schema, true
		}
	}
	return "", nil, false
}

func actionTransitionDetailPath(op *model.Operation) (string, bool) {
	if op == nil || strings.ToUpper(op.Method) != "POST" {
		return "", false
	}
	segments := splitPathSegments(op.Path)
	if len(segments) != 5 {
		return "", false
	}
	if segments[0] != "_action" || !isPathParam(segments[2]) || segments[3] != "state" || !isPathParam(segments[4]) {
		return "", false
	}
	if segments[1] == "state-machine" {
		return "", false
	}
	resource := strings.ReplaceAll(segments[1], "_", "-")
	return "/" + resource + "/{id}", true
}

func responseExposesIdentifier(schema *model.Schema, depth int) bool {
	if schema == nil || depth > 3 {
		return false
	}
	if schema.Ref != "" {
		return true
	}
	if schema.Type == "array" {
		return responseExposesIdentifier(schema.Items, depth+1)
	}
	if schema.Type != "object" || len(schema.Properties) == 0 {
		return false
	}
	for _, candidate := range []string{"id"} {
		if _, ok := schema.Properties[candidate]; ok {
			return true
		}
	}
	for _, wrapper := range []string{"data", "result", "item"} {
		child, ok := schema.Properties[wrapper]
		if ok && responseExposesIdentifier(child, depth+1) {
			return true
		}
	}
	return false
}

func collectionExposesIdentifier(schema *model.Schema, depth int) bool {
	if schema == nil || depth > 3 {
		return false
	}
	if schema.Ref != "" {
		return true
	}
	if schema.Type == "array" {
		return responseExposesIdentifier(schema.Items, depth+1)
	}
	if schema.Type != "object" || len(schema.Properties) == 0 {
		return false
	}
	for _, wrapper := range []string{"data", "items", "elements", "result", "results", "records"} {
		child, ok := schema.Properties[wrapper]
		if !ok || child == nil {
			continue
		}
		if child.Type == "array" {
			return responseExposesIdentifier(child.Items, depth+1)
		}
		if collectionExposesIdentifier(child, depth+1) {
			return true
		}
	}
	return false
}

func splitPathSegments(path string) []string {
	parts := strings.Split(path, "/")
	segments := make([]string, 0, len(parts))
	for _, part := range parts {
		if part != "" {
			segments = append(segments, part)
		}
	}
	return segments
}

func isPathParam(segment string) bool {
	return strings.HasPrefix(segment, "{") && strings.HasSuffix(segment, "}")
}

func detailPathBaseAndParam(path string) (string, string, bool) {
	segments := splitPathSegments(path)
	if len(segments) == 0 {
		return "", "", false
	}
	last := segments[len(segments)-1]
	if !isPathParam(last) {
		return "", "", false
	}
	paramName := strings.TrimSuffix(strings.TrimPrefix(last, "{"), "}")
	return "/" + strings.Join(segments[:len(segments)-1], "/"), paramName, true
}

func title(s string) string {
	parts := strings.Split(s, "-")
	for i, part := range parts {
		if part == "" {
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func FormatMarkdown(specFile string, operationCount int, graph *Graph, scores map[string]*WorkflowScore, chainScores map[string]*ChainScore) string {
	out := "# API Workflows Report\n\n"
	out += fmt.Sprintf("**Spec:** %s | **Operations:** %d | **Inferred:** %d\n\n", specFile, operationCount, len(graph.Edges))

	if len(graph.Edges) == 0 {
		out += "No high-confidence workflows inferred.\n"
		return out
	}

	// Summary table
	groups := map[string][]Edge{}
	for i, edge := range graph.Edges {
		groups[edge.Kind] = append(groups[edge.Kind], edge)
		_ = i
	}

	out += "## Summary\n\n"
	out += "| Type | Count |\n"
	out += "|---|---|\n"
	for _, kind := range []string{"action-to-detail", "create-to-detail", "list-to-detail", "accepted-to-tracking"} {
		if edges, ok := groups[kind]; ok {
			out += fmt.Sprintf("| %s | %d |\n", title(kind), len(edges))
		}
	}
	out += "\n"

	// Workflows by type
	for _, kind := range []string{"action-to-detail", "create-to-detail", "list-to-detail"} {
		edges := groups[kind]
		if len(edges) == 0 {
			continue
		}

		out += fmt.Sprintf("## %s (%d)\n\n", title(kind), len(edges))
		out += fmt.Sprintf("**Representative (showing %d of %d):**\n\n", minInt(workflowSampleLimit, len(edges)), len(edges))

		for i, edge := range limitEdges(edges, workflowSampleLimit) {
			if i > 0 {
				out += "\n"
			}
			edgeKey := fmt.Sprintf("%d", findEdgeIndex(graph.Edges, &edge))
			var scoreStr string
			if score, ok := scores[edgeKey]; ok {
				scoreStr = fmt.Sprintf(" \n  **Scores:** %d/%d/%d — %s", score.UIIndependence, score.SchemaCompleteness, score.ClientGenerationQuality, score.Explanation)
			}
			out += fmt.Sprintf("- `%s %s` → `%s %s`%s\n", edge.From.Method, edge.From.Path, edge.To.Method, edge.To.Path, scoreStr)
			out += fmt.Sprintf("  — %s\n", edge.Reason)
		}

		if len(edges) > workflowSampleLimit {
			out += fmt.Sprintf("\n_(Use `--json` or `--verbose` for all %d workflows)_\n\n", len(edges))
		} else {
			out += "\n"
		}
	}

	out += formatChainMarkdownSection(graph.Chains, chainScores)

	return out
}

func formatChainTextSection(chains []Chain, chainScores map[string]*ChainScore, verbose bool) string {
	if len(chains) == 0 {
		return ""
	}

	groups := make(map[string][]Chain)
	for _, chain := range chains {
		groups[chain.Kind] = append(groups[chain.Kind], chain)
	}

	kinds := make([]string, 0, len(groups))
	for kind := range groups {
		kinds = append(kinds, kind)
	}
	sort.Strings(kinds)

	visibleKinds := kinds
	hiddenChainCount := 0
	if !verbose {
		visibleKinds = make([]string, 0)
		for _, kind := range kinds {
			if isStrongChainKind(kind) {
				visibleKinds = append(visibleKinds, kind)
			} else {
				hiddenChainCount += len(groups[kind])
			}
		}
	}

	out := "\nMulti-step chains\n"
	out += "-----------------\n"
	out += fmt.Sprintf("Inferred chains: %d\n\n", len(chains))
	if !verbose && hiddenChainCount > 0 {
		out += fmt.Sprintf("Showing stronger chains only in default output (%d chains hidden; use --verbose or --json for full list).\n\n", hiddenChainCount)
	}

	for _, kind := range visibleKinds {
		entries := groups[kind]
		avgUI, avgSchema, avgClient := averageChainScores(entries, chains, chainScores)
		out += fmt.Sprintf("%s (%d)\n", title(kind), len(entries))
		out += "---\n"
		out += fmt.Sprintf("  Signal: avg score %s\n", formatTriplet(avgUI, avgSchema, avgClient))
		out += fmt.Sprintf("  Why it matters: %s\n", chainImpactMessage(kind))
		if !verbose {
			out += fmt.Sprintf("  Representative pattern: %s\n", chainRepresentativePattern(kind))
		} else {
			representatives := selectRepresentativeChains(entries, len(entries))
			for _, chain := range representatives {
				chainIdx := findChainIndex(chains, &chain)
				scoreSuffix := ""
				if score, ok := chainScores[fmt.Sprintf("%d", chainIdx)]; ok {
					scoreSuffix = fmt.Sprintf(" [Score: %s]", formatTriplet(score.UIIndependence, score.SchemaCompleteness, score.ClientGenerationQuality))
				}
				out += fmt.Sprintf("  CHAIN: %s%s\n", chainToText(chain), scoreSuffix)
				out += fmt.Sprintf("      Why: %s\n", chain.Reason)
				if score, ok := chainScores[fmt.Sprintf("%d", chainIdx)]; ok {
					out += fmt.Sprintf("      Scoring: %s\n", score.Explanation)
				}
			}
		}
		if !verbose && len(entries) > 1 {
			out += fmt.Sprintf("  More chains: %d more hidden here; use --verbose or --json for the full list.\n", len(entries)-1)
		}
		out += "\n"
	}

	return out
}

func chainToText(chain Chain) string {
	parts := make([]string, 0, len(chain.Steps))
	for _, step := range chain.Steps {
		parts = append(parts, fmt.Sprintf("%s %s %s", strings.ToUpper(step.Node.Method), step.Node.Path, step.Role))
	}
	return strings.Join(parts, " => ")
}

func summarizeChains(chains []Chain) map[string]int {
	summary := map[string]int{}
	for _, chain := range chains {
		summary[chain.Kind]++
	}
	return summary
}

func formatChainMarkdownSection(chains []Chain, chainScores map[string]*ChainScore) string {
	if len(chains) == 0 {
		return ""
	}

	groups := make(map[string][]Chain)
	for _, chain := range chains {
		groups[chain.Kind] = append(groups[chain.Kind], chain)
	}

	kinds := make([]string, 0, len(groups))
	for kind := range groups {
		kinds = append(kinds, kind)
	}
	sort.Strings(kinds)

	visibleKinds := make([]string, 0)
	hiddenChainCount := 0
	for _, kind := range kinds {
		if isStrongChainKind(kind) {
			visibleKinds = append(visibleKinds, kind)
		} else {
			hiddenChainCount += len(groups[kind])
		}
	}

	out := "## Multi-step Chains\n\n"
	out += fmt.Sprintf("**Inferred chains:** %d\n\n", len(chains))
	out += "| Type | Count |\n"
	out += "|---|---|\n"
	for _, kind := range kinds {
		out += fmt.Sprintf("| %s | %d |\n", title(kind), len(groups[kind]))
	}
	out += "\n"
	if hiddenChainCount > 0 {
		out += fmt.Sprintf("_Showing stronger chains only below; %d chains hidden here. Use JSON output for the full chain list._\n\n", hiddenChainCount)
	}

	for _, kind := range visibleKinds {
		entries := groups[kind]
		avgUI, avgSchema, avgClient := averageChainScores(entries, chains, chainScores)
		out += fmt.Sprintf("### %s (%d)\n\n", title(kind), len(entries))
		out += fmt.Sprintf("- **Signal:** avg score %s\n", formatTriplet(avgUI, avgSchema, avgClient))
		out += fmt.Sprintf("- **Why it matters:** %s\n", chainImpactMessage(kind))
		out += fmt.Sprintf("- **Representative pattern:** `%s`\n", chainRepresentativePattern(kind))
		if len(entries) > 1 {
			out += fmt.Sprintf("\n_(Use `--json` or `--verbose` for all %d chains in this type)_\n", len(entries))
		}
		out += "\n"
	}

	return out
}

func isStrongChainKind(kind string) bool {
	return kind == "order-detail-to-action" || kind == "media-detail-to-follow-up-action"
}

func chainImpactMessage(kind string) string {
	switch kind {
	case "order-detail-to-action":
		return "captures order verification and transition flows where follow-up action clarity affects automation reliability"
	case "media-detail-to-follow-up-action":
		return "captures media post-processing flows where follow-up actions determine asset usability"
	case "list-to-detail-to-update":
		return "captures list-driven edit flows that often require user or caller item selection"
	case "create-to-detail-to-update":
		return "captures CRUD refinement flows where created entities are immediately modified"
	default:
		return "captures a deterministic multi-step API interaction"
	}
}

func findChainIndex(chains []Chain, target *Chain) int {
	for i, chain := range chains {
		if chain.Kind != target.Kind || len(chain.Steps) != len(target.Steps) {
			continue
		}
		match := true
		for j := range chain.Steps {
			if chain.Steps[j].Role != target.Steps[j].Role || chain.Steps[j].Node != target.Steps[j].Node {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}

func averageChainScores(entries []Chain, allChains []Chain, chainScores map[string]*ChainScore) (int, int, int) {
	if len(entries) == 0 {
		return 0, 0, 0
	}
	uiTotal := 0
	schemaTotal := 0
	clientTotal := 0
	count := 0
	for _, chain := range entries {
		idx := findChainIndex(allChains, &chain)
		if score, ok := chainScores[fmt.Sprintf("%d", idx)]; ok {
			uiTotal += score.UIIndependence
			schemaTotal += score.SchemaCompleteness
			clientTotal += score.ClientGenerationQuality
			count++
		}
	}
	if count == 0 {
		return 0, 0, 0
	}
	return uiTotal / count, schemaTotal / count, clientTotal / count
}

func summarizeChainScores(chains []Chain, chainScores map[string]*ChainScore) map[string]map[string]int {
	counts := map[string]int{}
	uiTotal := map[string]int{}
	schemaTotal := map[string]int{}
	clientTotal := map[string]int{}
	for i, chain := range chains {
		score, ok := chainScores[fmt.Sprintf("%d", i)]
		if !ok {
			continue
		}
		counts[chain.Kind]++
		uiTotal[chain.Kind] += score.UIIndependence
		schemaTotal[chain.Kind] += score.SchemaCompleteness
		clientTotal[chain.Kind] += score.ClientGenerationQuality
	}
	out := map[string]map[string]int{}
	for kind, count := range counts {
		if count == 0 {
			continue
		}
		out[kind] = map[string]int{
			"avg_ui_independence":           uiTotal[kind] / count,
			"avg_schema_completeness":       schemaTotal[kind] / count,
			"avg_client_generation_quality": clientTotal[kind] / count,
		}
	}
	return out
}

func limitChains(chains []Chain, limit int) []Chain {
	if len(chains) <= limit {
		return chains
	}
	return chains[:limit]
}

func selectRepresentativeChains(chains []Chain, limit int) []Chain {
	if len(chains) == 0 || limit <= 0 {
		return []Chain{}
	}
	ordered := make([]Chain, len(chains))
	copy(ordered, chains)
	sort.Slice(ordered, func(i, j int) bool {
		left := chainRepresentativeKey(ordered[i])
		right := chainRepresentativeKey(ordered[j])
		return left < right
	})
	if len(ordered) <= limit {
		return ordered
	}
	return ordered[:limit]
}

func chainRepresentativeKey(chain Chain) string {
	parts := []string{chain.Kind}
	for _, step := range chain.Steps {
		parts = append(parts, step.Role, strings.ToUpper(step.Node.Method), step.Node.Path)
	}
	parts = append(parts, chain.Reason)
	return strings.Join(parts, "|")
}

func chainRepresentativePattern(kind string) string {
	switch kind {
	case "order-detail-to-action":
		return "order search/list => order detail => order action"
	case "media-detail-to-follow-up-action":
		return "media create => media detail => media follow-up action"
	case "list-to-detail-to-update":
		return "resource list/search => resource detail => resource update"
	case "create-to-detail-to-update":
		return "resource create => resource detail => resource update"
	default:
		return "deterministic multi-step chain"
	}
}

func findEdgeIndex(edges []Edge, target *Edge) int {
	for i, edge := range edges {
		if edge.Kind == target.Kind && edge.From == target.From && edge.To == target.To {
			return i
		}
	}
	return -1
}

func limitEdges(edges []Edge, limit int) []Edge {
	if len(edges) <= limit {
		return edges
	}
	return edges[:limit]
}