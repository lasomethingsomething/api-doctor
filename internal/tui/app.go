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

	findingsBucketIndex int
	findingsDetailOpen  bool

	workflowSection     int // 0=pairwise, 1=chain
	workflowBucketIndex int
	workflowDetailOpen  bool

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
		if m.active == screenFindings {
			switch msg.String() {
			case "up", "k":
				m.findingsMove(-1)
				return m, nil
			case "down", "j":
				m.findingsMove(1)
				return m, nil
			case "enter":
				if len(m.findingCodeBuckets()) > 0 {
					m.findingsDetailOpen = !m.findingsDetailOpen
				}
				return m, nil
			case "esc":
				m.findingsDetailOpen = false
				return m, nil
			}
		}

		if m.active == screenWorkflows {
			switch msg.String() {
			case "up", "k":
				m.workflowMove(-1)
				return m, nil
			case "down", "j":
				m.workflowMove(1)
				return m, nil
			case "w":
				if m.workflowSection == 0 {
					m.workflowSection = 1
				} else {
					m.workflowSection = 0
				}
				m.workflowBucketIndex = 0
				m.workflowDetailOpen = false
				return m, nil
			case "enter":
				if len(m.workflowActiveBuckets()) > 0 {
					m.workflowDetailOpen = !m.workflowDetailOpen
				}
				return m, nil
			case "esc":
				m.workflowDetailOpen = false
				return m, nil
			}
		}

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
			m.findingsDetailOpen = false
		case "3":
			m.active = screenWorkflows
			m.workflowDetailOpen = false
		case "4":
			m.active = screenDiff
		}
	}
	return m, nil
}

func (m Model) View() string {
	header := "api-doctor TUI | 1 Overview 2 Findings 3 Workflows 4 Diff\n"
	header += "Global keys: left/right/tab switch screens, q quit\n"
	header += m.screenHints() + "\n"
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

func (m Model) screenHints() string {
	switch m.active {
	case screenFindings:
		return "Findings keys: up/down move bucket, enter details, esc back"
	case screenWorkflows:
		return "Workflows keys: up/down move bucket, w toggle pairwise/chain, enter details, esc back"
	default:
		return ""
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

	out := "Overview Summary\n\n"
	out += fmt.Sprintf("Total operations:      %d\n", ops)
	out += fmt.Sprintf("Total findings:        %d\n", issues)
	out += fmt.Sprintf("Total workflow edges:  %d\n", edges)
	out += fmt.Sprintf("Total workflow chains: %d\n", chains)
	out += fmt.Sprintf("Total diff changes:    %s\n", diffChanges)
	if m.analysis != nil {
		out += "\nSeverity Summary\n"
		out += fmt.Sprintf("- Errors:   %d\n", countSeverity(m.analysis.Issues, "error"))
		out += fmt.Sprintf("- Warnings: %d\n", countSeverity(m.analysis.Issues, "warning"))
		out += fmt.Sprintf("- Info:     %d\n", countSeverity(m.analysis.Issues, "info"))
	} else {
		out += "\nNo analysis data loaded for this run.\n"
	}
	return out
}

func (m Model) viewFindings() string {
	if m.analysis == nil {
		return "Findings Summary\n\nNo findings data available for this run. Provide --spec to populate this screen.\n"
	}

	out := "Findings Summary\n\n"
	out += fmt.Sprintf("Spec: %s\n", m.analysis.SpecFile)
	out += fmt.Sprintf("Total findings: %d\n\n", len(m.analysis.Issues))
	if len(m.analysis.Issues) == 0 {
		out += "No findings detected in this run.\n"
		return out
	}

	summary := map[string]int{}
	codes := map[string]int{}
	for _, issue := range m.analysis.Issues {
		summary[issue.Severity]++
		codes[issue.Code]++
	}
	out += fmt.Sprintf("Errors: %d\n", summary["error"])
	out += fmt.Sprintf("Warnings: %d\n", summary["warning"])
	out += fmt.Sprintf("Info: %d\n", summary["info"])

	out += "\nTop finding code buckets\n"
	buckets := m.findingCodeBuckets()
	for i, item := range buckets {
		prefix := " "
		if i == m.findingsBucketIndex {
			prefix = ">"
		}
		out += fmt.Sprintf("%s %s: %d\n", prefix, item.key, item.count)
	}

	if m.findingsDetailOpen && len(buckets) > 0 {
		selected := buckets[m.findingsBucketIndex].key
		out += fmt.Sprintf("\nDetails for %s (up to 5)\n", selected)
		for _, line := range m.findingDetails(selected, 5) {
			out += fmt.Sprintf("- %s\n", line)
		}
	}

	if len(m.endpointScores) > 0 {
		out += "\nEndpoint score summary\n"
		out += fmt.Sprintf("- Schema: %s\n", endpointDist(m.endpointScores, "schema"))
		out += fmt.Sprintf("- Client: %s\n", endpointDist(m.endpointScores, "client"))
		out += fmt.Sprintf("- Versioning: %s\n", endpointDist(m.endpointScores, "versioning"))
	}

	return out
}

func (m Model) viewWorkflows() string {
	if m.workflowGraph == nil {
		return "Workflows Summary\n\nNo workflow data available for this run.\n"
	}

	out := "Workflows Summary\n\n"
	out += fmt.Sprintf("Total pairwise workflows: %d\n", len(m.workflowGraph.Edges))
	out += fmt.Sprintf("Total multi-step chains:  %d\n", len(m.workflowGraph.Chains))
	if len(m.workflowGraph.Edges) == 0 && len(m.workflowGraph.Chains) == 0 {
		out += "\nNo workflows detected in this run.\n"
		return out
	}

	edgeKinds := map[string]int{}
	for _, edge := range m.workflowGraph.Edges {
		edgeKinds[edge.Kind]++
	}
	chainKinds := map[string]int{}
	for _, chain := range m.workflowGraph.Chains {
		chainKinds[chain.Kind]++
	}

	out += "\nPairwise kind buckets\n"
	for i, item := range topCounts(edgeKinds, 6) {
		prefix := " "
		if m.workflowSection == 0 && i == m.workflowBucketIndex {
			prefix = ">"
		}
		out += fmt.Sprintf("%s %s: %d\n", prefix, item.key, item.count)
	}

	out += "\nChain kind buckets\n"
	for i, item := range topCounts(chainKinds, 6) {
		prefix := " "
		if m.workflowSection == 1 && i == m.workflowBucketIndex {
			prefix = ">"
		}
		out += fmt.Sprintf("%s %s: %d\n", prefix, item.key, item.count)
	}

	if m.workflowDetailOpen {
		active := m.workflowActiveBuckets()
		if len(active) > 0 {
			selected := active[m.workflowBucketIndex].key
			if m.workflowSection == 0 {
				out += fmt.Sprintf("\nPairwise details for %s (up to 5)\n", selected)
				for _, line := range m.workflowEdgeDetails(selected, 5) {
					out += fmt.Sprintf("- %s\n", line)
				}
			} else {
				out += fmt.Sprintf("\nChain details for %s (up to 5)\n", selected)
				for _, line := range m.workflowChainDetails(selected, 5) {
					out += fmt.Sprintf("- %s\n", line)
				}
			}
		}
	}

	if len(m.chainScores) > 0 {
		avg := averageChainScoresByKind(m.workflowGraph.Chains, m.chainScores)
		out += "\nChain score summary\n"
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
		out += "No diff data available for this run. Use --old and --new to populate this screen.\n"
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
	out += "\nTop diff code buckets\n"
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

func (m *Model) findingsMove(delta int) {
	buckets := m.findingCodeBuckets()
	if len(buckets) == 0 {
		m.findingsBucketIndex = 0
		m.findingsDetailOpen = false
		return
	}
	m.findingsBucketIndex = wrapIndex(m.findingsBucketIndex+delta, len(buckets))
	m.findingsDetailOpen = false
}

func (m Model) findingCodeBuckets() []kvCount {
	if m.analysis == nil {
		return nil
	}
	codes := map[string]int{}
	for _, issue := range m.analysis.Issues {
		codes[issue.Code]++
	}
	return topCounts(codes, 6)
}

func (m Model) findingDetails(code string, limit int) []string {
	if m.analysis == nil {
		return nil
	}
	lines := make([]string, 0)
	for _, issue := range m.analysis.Issues {
		if issue.Code != code {
			continue
		}
		label := strings.TrimSpace(strings.Join([]string{issue.Operation, issue.Path}, " "))
		if label == "" {
			label = "(no operation context)"
		}
		msg := strings.TrimSpace(issue.Message)
		if msg == "" {
			msg = "no message"
		}
		lines = append(lines, fmt.Sprintf("%s: %s", label, msg))
		if len(lines) >= limit {
			break
		}
	}
	if len(lines) == 0 {
		return []string{"No issue details available."}
	}
	return lines
}

func (m *Model) workflowMove(delta int) {
	buckets := m.workflowActiveBuckets()
	if len(buckets) == 0 {
		m.workflowBucketIndex = 0
		m.workflowDetailOpen = false
		return
	}
	m.workflowBucketIndex = wrapIndex(m.workflowBucketIndex+delta, len(buckets))
	m.workflowDetailOpen = false
}

func (m Model) workflowActiveBuckets() []kvCount {
	if m.workflowSection == 0 {
		kinds := map[string]int{}
		if m.workflowGraph != nil {
			for _, edge := range m.workflowGraph.Edges {
				kinds[edge.Kind]++
			}
		}
		return topCounts(kinds, 6)
	}
	kinds := map[string]int{}
	if m.workflowGraph != nil {
		for _, chain := range m.workflowGraph.Chains {
			kinds[chain.Kind]++
		}
	}
	return topCounts(kinds, 6)
}

func (m Model) workflowEdgeDetails(kind string, limit int) []string {
	if m.workflowGraph == nil {
		return nil
	}
	lines := make([]string, 0)
	for _, edge := range m.workflowGraph.Edges {
		if edge.Kind != kind {
			continue
		}
		lines = append(lines, fmt.Sprintf("%s %s -> %s %s", edge.From.Method, edge.From.Path, edge.To.Method, edge.To.Path))
		if len(lines) >= limit {
			break
		}
	}
	if len(lines) == 0 {
		return []string{"No workflow edge details available."}
	}
	return lines
}

func (m Model) workflowChainDetails(kind string, limit int) []string {
	if m.workflowGraph == nil {
		return nil
	}
	lines := make([]string, 0)
	for _, chain := range m.workflowGraph.Chains {
		if chain.Kind != kind {
			continue
		}
		if len(chain.Steps) == 0 {
			lines = append(lines, "(empty chain)")
		} else {
			first := chain.Steps[0].Node
			last := chain.Steps[len(chain.Steps)-1].Node
			lines = append(lines, fmt.Sprintf("%s steps: %s %s -> %s %s", fmt.Sprintf("%d", len(chain.Steps)), first.Method, first.Path, last.Method, last.Path))
		}
		if len(lines) >= limit {
			break
		}
	}
	if len(lines) == 0 {
		return []string{"No workflow chain details available."}
	}
	return lines
}

func wrapIndex(v, size int) int {
	if size <= 0 {
		return 0
	}
	if v < 0 {
		return size - 1
	}
	if v >= size {
		return 0
	}
	return v
}
