package tui

import (
	"fmt"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	intdiff "github.com/lasomethingsomething/api-doctor/internal/diff"
	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/model"
	"github.com/lasomethingsomething/api-doctor/internal/workflow"
)

type screen int

const (
	screenOverview screen = iota
	screenFindings
	screenWorkflows
	screenDiff
)

type Model struct {
	active screen

	analysis       *model.AnalysisResult
	endpointScores map[string]*endpoint.EndpointScore

	workflowGraph  *workflow.Graph
	workflowScores map[string]*workflow.WorkflowScore
	chainScores    map[string]*workflow.ChainScore

	diffResult *intdiff.Result
}

func NewModel(
	analysis *model.AnalysisResult,
	endpointScores map[string]*endpoint.EndpointScore,
	workflowGraph *workflow.Graph,
	workflowScores map[string]*workflow.WorkflowScore,
	chainScores map[string]*workflow.ChainScore,
	diffResult *intdiff.Result,
) Model {
	return Model{
		active:         screenOverview,
		analysis:       analysis,
		endpointScores: endpointScores,
		workflowGraph:  workflowGraph,
		workflowScores: workflowScores,
		chainScores:    chainScores,
		diffResult:     diffResult,
	}
}

func (m Model) Init() tea.Cmd { return nil }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "left", "h":
			if m.active == 0 {
				m.active = screenDiff
			} else {
				m.active--
			}
		case "right", "l", "tab":
			if m.active == screenDiff {
				m.active = screenOverview
			} else {
				m.active++
			}
		case "1":
			m.active = screenOverview
		case "2":
			m.active = screenFindings
		case "3":
			m.active = screenWorkflows
		case "4":
			m.active = screenDiff
		}
	}
	return m, nil
}

func (m Model) View() string {
	header := "api-doctor TUI | 1 Overview 2 Findings 3 Workflows 4 Diff | left/right/tab switch, q quit\n"
	header += strings.Repeat("=", 90) + "\n\n"

	switch m.active {
	case screenOverview:
		return header + m.viewOverview()
	case screenFindings:
		return header + m.viewFindings()
	case screenWorkflows:
		return header + m.viewWorkflows()
	case screenDiff:
		return header + m.viewDiff()
	default:
		return header + "Unknown screen\n"
	}
}

func (m Model) viewOverview() string {
	ops := 0
	issues := 0
	if m.analysis != nil {
		ops = len(m.analysis.Operations)
		issues = len(m.analysis.Issues)
	}

	edges := 0
	chains := 0
	if m.workflowGraph != nil {
		edges = len(m.workflowGraph.Edges)
		chains = len(m.workflowGraph.Chains)
	}

	diffChanges := "n/a"
	if m.diffResult != nil {
		diffChanges = fmt.Sprintf("%d", len(m.diffResult.Changes))
	}

	out := "Overview\n\n"
	out += fmt.Sprintf("Operations analyzed: %d\n", ops)
	out += fmt.Sprintf("Analysis findings:   %d\n", issues)
	out += fmt.Sprintf("Workflow edges:      %d\n", edges)
	out += fmt.Sprintf("Workflow chains:     %d\n", chains)
	out += fmt.Sprintf("Diff changes:        %s\n", diffChanges)
	if m.analysis != nil {
		out += "\nHealth signal\n"
		out += fmt.Sprintf("- Errors:   %d\n", countSeverity(m.analysis.Issues, "error"))
		out += fmt.Sprintf("- Warnings: %d\n", countSeverity(m.analysis.Issues, "warning"))
	}
	return out
}

func (m Model) viewFindings() string {
	if m.analysis == nil {
		return "Findings Summary\n\nNo analysis result available.\n"
	}

	out := "Findings Summary\n\n"
	out += fmt.Sprintf("Spec: %s\n", m.analysis.SpecFile)
	out += fmt.Sprintf("Total findings: %d\n\n", len(m.analysis.Issues))

	summary := map[string]int{}
	codes := map[string]int{}
	for _, issue := range m.analysis.Issues {
		summary[issue.Severity]++
		codes[issue.Code]++
	}
	out += fmt.Sprintf("Errors: %d\n", summary["error"])
	out += fmt.Sprintf("Warnings: %d\n", summary["warning"])
	out += fmt.Sprintf("Info: %d\n", summary["info"])

	out += "\nTop finding signals\n"
	for _, item := range topCounts(codes, 5) {
		out += fmt.Sprintf("- %s: %d\n", item.key, item.count)
	}

	if len(m.endpointScores) > 0 {
		out += "\nEndpoint score distribution\n"
		out += fmt.Sprintf("- Schema: %s\n", endpointDist(m.endpointScores, "schema"))
		out += fmt.Sprintf("- Client: %s\n", endpointDist(m.endpointScores, "client"))
		out += fmt.Sprintf("- Versioning: %s\n", endpointDist(m.endpointScores, "versioning"))
	}

	return out
}

func (m Model) viewWorkflows() string {
	if m.workflowGraph == nil {
		return "Workflow Summary\n\nNo workflow graph available.\n"
	}

	out := "Workflow Summary\n\n"
	out += fmt.Sprintf("Pairwise workflows: %d\n", len(m.workflowGraph.Edges))
	out += fmt.Sprintf("Multi-step chains:  %d\n", len(m.workflowGraph.Chains))

	edgeKinds := map[string]int{}
	for _, edge := range m.workflowGraph.Edges {
		edgeKinds[edge.Kind]++
	}
	chainKinds := map[string]int{}
	for _, chain := range m.workflowGraph.Chains {
		chainKinds[chain.Kind]++
	}

	out += "\nPairwise breakdown\n"
	for _, item := range topCounts(edgeKinds, 6) {
		out += fmt.Sprintf("- %s: %d\n", item.key, item.count)
	}

	out += "\nChain breakdown\n"
	for _, item := range topCounts(chainKinds, 6) {
		out += fmt.Sprintf("- %s: %d\n", item.key, item.count)
	}

	if len(m.chainScores) > 0 {
		avg := averageChainScoresByKind(m.workflowGraph.Chains, m.chainScores)
		out += "\nChain score signals\n"
		for _, item := range topCounts(chainKinds, 4) {
			a, ok := avg[item.key]
			if !ok {
				continue
			}
			out += fmt.Sprintf("- %s: %d/%d/%d\n", item.key, a.ui, a.schema, a.client)
		}
	}

	return out
}

func (m Model) viewDiff() string {
	out := "Diff Summary\n\n"
	if m.diffResult == nil {
		out += "No diff result available. Run with --old and --new to populate this view.\n"
		return out
	}

	out += fmt.Sprintf("Old spec: %s\n", m.diffResult.OldSpec)
	out += fmt.Sprintf("New spec: %s\n", m.diffResult.NewSpec)
	out += fmt.Sprintf("Total changes: %d\n\n", len(m.diffResult.Changes))

	sev := map[string]int{}
	codes := map[string]int{}
	for _, c := range m.diffResult.Changes {
		sev[c.Severity]++
		codes[c.Code]++
	}
	out += fmt.Sprintf("Errors: %d\n", sev["error"])
	out += fmt.Sprintf("Warnings: %d\n", sev["warning"])
	out += "\nTop diff signals\n"
	for _, item := range topCounts(codes, 6) {
		out += fmt.Sprintf("- %s: %d\n", item.key, item.count)
	}

	return out
}

type kvCount struct {
	key   string
	count int
}

func topCounts(m map[string]int, limit int) []kvCount {
	out := make([]kvCount, 0, len(m))
	for k, v := range m {
		out = append(out, kvCount{key: k, count: v})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].count != out[j].count {
			return out[i].count > out[j].count
		}
		return out[i].key < out[j].key
	})
	if len(out) <= limit {
		return out
	}
	return out[:limit]
}

func countSeverity(issues []*model.Issue, sev string) int {
	n := 0
	for _, issue := range issues {
		if issue.Severity == sev {
			n++
		}
	}
	return n
}

func endpointDist(scores map[string]*endpoint.EndpointScore, dim string) string {
	if len(scores) == 0 {
		return "n/a"
	}
	dist := map[int]int{}
	for _, s := range scores {
		v := 0
		switch dim {
		case "schema":
			v = s.SchemaCompleteness
		case "client":
			v = s.ClientGenerationQuality
		case "versioning":
			v = s.VersioningSafety
		}
		dist[v]++
	}
	parts := make([]string, 0)
	for _, score := range []int{5, 4, 3, 2, 1} {
		if dist[score] > 0 {
			parts = append(parts, fmt.Sprintf("%d/5=%d", score, dist[score]))
		}
	}
	return strings.Join(parts, " ")
}

type avgTriplet struct {
	ui     int
	schema int
	client int
}

func averageChainScoresByKind(chains []workflow.Chain, chainScores map[string]*workflow.ChainScore) map[string]avgTriplet {
	totals := map[string]avgTriplet{}
	counts := map[string]int{}

	for i, chain := range chains {
		score, ok := chainScores[fmt.Sprintf("%d", i)]
		if !ok {
			continue
		}
		t := totals[chain.Kind]
		t.ui += score.UIIndependence
		t.schema += score.SchemaCompleteness
		t.client += score.ClientGenerationQuality
		totals[chain.Kind] = t
		counts[chain.Kind]++
	}

	avg := map[string]avgTriplet{}
	for kind, t := range totals {
		c := counts[kind]
		if c == 0 {
			continue
		}
		avg[kind] = avgTriplet{ui: t.ui / c, schema: t.schema / c, client: t.client / c}
	}

	return avg
}
