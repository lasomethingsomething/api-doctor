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
	screenHotspots
	screenEndpoints
	screenFindings
	screenWorkflows
	screenDiff
)

type Model struct {
	active screen

	hotspotIndex int

	endpointIndex      int
	endpointDetailOpen bool

	findingsBucketIndex int
	findingsDetailOpen  bool

	workflowSection     int // 0=pairwise, 1=chain
	workflowBucketIndex int
	workflowDetailOpen  bool
	workflowItemDetailOpen bool
	workflowItemSection    int // 0=pairwise, 1=chain
	workflowItemKind       string
	workflowItemIndex      int

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
			case "enter", "d":
				if len(m.findingCodeBuckets()) > 0 {
					m.findingsDetailOpen = !m.findingsDetailOpen
				}
				return m, nil
			case "o":
				op := m.firstOperationForSelectedFindingBucket()
				if op != nil {
					m.active = screenEndpoints
					m.endpointIndex = m.indexOfOperation(op)
					m.endpointDetailOpen = true
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
			case "w", "s":
				if m.workflowSection == 0 {
					m.workflowSection = 1
				} else {
					m.workflowSection = 0
				}
				m.workflowBucketIndex = 0
				m.workflowDetailOpen = false
				m.workflowItemDetailOpen = false
				return m, nil
			case "enter", "d":
				if len(m.workflowActiveBuckets()) > 0 {
					m.workflowDetailOpen = !m.workflowDetailOpen
					m.workflowItemDetailOpen = false
				}
				return m, nil
			case "o":
				m.openWorkflowItemDetailForCurrentBucket()
				return m, nil
			case "esc":
				if m.workflowItemDetailOpen {
					m.workflowItemDetailOpen = false
				} else {
					m.workflowDetailOpen = false
				}
				return m, nil
			}
		}

		if m.active == screenEndpoints {
			switch msg.String() {
			case "up", "k":
				m.endpointMove(-1)
				return m, nil
			case "down", "j":
				m.endpointMove(1)
				return m, nil
			case "enter", "d":
				if len(m.endpointOperations()) > 0 {
					m.endpointDetailOpen = !m.endpointDetailOpen
				}
				return m, nil
			case "esc":
				m.endpointDetailOpen = false
				return m, nil
			}
		}

		if m.active == screenHotspots {
			switch msg.String() {
			case "up", "k":
				m.hotspotMove(-1)
				return m, nil
			case "down", "j":
				m.hotspotMove(1)
				return m, nil
			case "o", "enter":
				op := m.selectedHotspotOperation()
				if op != nil {
					m.active = screenEndpoints
					m.endpointIndex = m.indexOfOperation(op)
					m.endpointDetailOpen = true
				} else if m.openWorkflowDetailFromSelectedHotspot() {
					m.active = screenWorkflows
				}
				return m, nil
			}
		}

		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "left", "h", "shift+tab", "[":
			if m.active == 0 {
				m.active = screenDiff
			} else {
				m.active--
			}
		case "right", "l", "tab", "]":
			if m.active == screenDiff {
				m.active = screenOverview
			} else {
				m.active++
			}
		case "home":
			m.active = screenOverview
		case "end":
			m.active = screenDiff
		case "1":
			m.active = screenOverview
		case "2":
			m.active = screenHotspots
		case "3":
			m.active = screenEndpoints
			m.endpointDetailOpen = false
		case "4":
			m.active = screenFindings
			m.findingsDetailOpen = false
		case "5":
			m.active = screenWorkflows
			m.workflowDetailOpen = false
			m.workflowItemDetailOpen = false
		case "6":
			m.active = screenDiff
		}
	}
	return m, nil
}

func (m Model) View() string {
	header := "api-doctor TUI\n"
	header += m.screenTabs() + "\n"
	header += "Global keys: left/right/tab/[ ] switch, home/end jump, q quit\n"
	header += m.dataStatusLine() + "\n"
	header += m.screenHints() + "\n"
	header += strings.Repeat("=", 90) + "\n\n"

	switch m.active {
	case screenOverview:
		return header + m.viewOverview()
	case screenHotspots:
		return header + m.viewHotspots()
	case screenEndpoints:
		return header + m.viewEndpoints()
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

func (m Model) screenTabs() string {
	labels := []string{
		m.tabLabel(screenOverview, "1 Overview"),
		m.tabLabel(screenHotspots, "2 Hotspots"),
		m.tabLabel(screenEndpoints, "3 Endpoints"),
		m.tabLabel(screenFindings, "4 Findings"),
		m.tabLabel(screenWorkflows, "5 Workflows"),
		m.tabLabel(screenDiff, "6 Diff"),
	}
	return strings.Join(labels, "  ")
}

func (m Model) tabLabel(s screen, label string) string {
	if m.active == s {
		return "[" + label + "]"
	}
	return label
}

func (m Model) dataStatusLine() string {
	analysisStatus := "analysis:loaded"
	if m.analysis == nil {
		analysisStatus = "analysis:missing"
	}
	workflowStatus := "workflows:loaded"
	if m.workflowGraph == nil {
		workflowStatus = "workflows:missing"
	}
	diffStatus := "diff:loaded"
	if m.diffResult == nil {
		diffStatus = "diff:missing"
	}
	return "Data " + analysisStatus + " | " + workflowStatus + " | " + diffStatus
}

func (m Model) screenHints() string {
	switch m.active {
	case screenHotspots:
		return "Hotspots keys: up/down move, enter or o open related detail"
	case screenEndpoints:
		return "Endpoints keys: up/down move endpoint, enter or d details, esc back"
	case screenFindings:
		return "Findings keys: up/down move bucket, enter or d details, o open endpoint, esc back"
	case screenWorkflows:
		return "Workflows keys: up/down move bucket, w or s section, enter or d bucket preview, o item detail, esc back"
	default:
		return "Screen keys: none"
	}
}

type hotspotItem struct {
	kind      string
	label     string
	value     string
	risk      int
	detail    string
	operation *model.Operation
}

func (m Model) viewHotspots() string {
	out := "Hotspots\n\n"
	out += "Worst areas first, ranked from deterministic findings/scores/workflow signals.\n"

	items := m.hotspotItems()
	if len(items) == 0 {
		out += "\nNo hotspot data available for this run. Provide --spec to populate this view.\n"
		return out
	}

	idx := m.hotspotIndex
	if idx < 0 {
		idx = 0
	}
	if idx >= len(items) {
		idx = len(items) - 1
	}

	out += fmt.Sprintf("Top hotspots: %d | Selected: %d/%d\n\n", len(items), idx+1, len(items))
	for i, item := range items {
		prefix := " "
		if i == idx {
			prefix = ">"
		}
		out += fmt.Sprintf("%s %2d) %-14s %-40s risk:%3d %s\n", prefix, i+1, item.kind, truncate(item.label, 40), item.risk, item.value)
	}

	sel := items[idx]
	out += "\nSelected hotspot\n"
	out += fmt.Sprintf("- Type: %s\n", sel.kind)
	out += fmt.Sprintf("- Label: %s\n", sel.label)
	out += fmt.Sprintf("- Metric: %s\n", sel.value)
	out += fmt.Sprintf("- Why risky: %s\n", sel.detail)
	if sel.operation != nil {
		out += fmt.Sprintf("- Example endpoint: %s %s\n", strings.ToUpper(sel.operation.Method), sel.operation.Path)
		out += "- Action: press enter (or o) to open endpoint detail in context.\n"
	} else if sel.kind == "workflow-kind" || sel.kind == "chain-kind" {
		out += "- Action: press enter (or o) to open workflow/chain detail in context.\n"
	} else {
		out += "- Action: no direct endpoint jump for this row.\n"
	}

	return out
}

func (m Model) viewEndpoints() string {
	if m.analysis == nil {
		return "Endpoints Browser\n\nNo analysis data available for this run. Provide --spec to populate this screen.\n"
	}

	ops := m.endpointOperations()
	out := "Endpoints Browser\n\n"
	out += fmt.Sprintf("Total endpoints: %d\n", len(ops))
	if len(ops) == 0 {
		out += "\nNo endpoints were parsed from this spec.\n"
		return out
	}

	mx := m.endpointIndex
	if mx < 0 {
		mx = 0
	}
	if mx >= len(ops) {
		mx = len(ops) - 1
	}
	out += fmt.Sprintf("Selected: %d/%d\n\n", mx+1, len(ops))

	start, end := listWindow(len(ops), mx, 10)
	for i := start; i < end; i++ {
		op := ops[i]
		prefix := " "
		if i == mx {
			prefix = ">"
		}
		findings := len(m.findingsForOperation(op))
		score := m.endpointScoreSummary(op)
		out += fmt.Sprintf("%s %3d) %-6s %-44s f:%-3d s:%s\n", prefix, i+1, strings.ToUpper(op.Method), truncate(op.Path, 44), findings, score)
	}

	if m.endpointDetailOpen {
		op := ops[mx]
		out += "\nEndpoint detail\n"
		out += fmt.Sprintf("- Operation: %s %s\n", strings.ToUpper(op.Method), op.Path)
		if strings.TrimSpace(op.OperationID) != "" {
			out += fmt.Sprintf("- Operation ID: %s\n", op.OperationID)
		}
		if strings.TrimSpace(op.Summary) != "" {
			out += fmt.Sprintf("- Summary: %s\n", truncate(op.Summary, 90))
		}
		if len(op.Tags) > 0 {
			out += fmt.Sprintf("- Tags: %s\n", truncate(strings.Join(op.Tags, ", "), 90))
		}

		s := m.endpointScoreForOperation(op)
		if s != nil {
			out += fmt.Sprintf("- Scores (Schema/Client/Versioning): %d/%d/%d\n", s.SchemaCompleteness, s.ClientGenerationQuality, s.VersioningSafety)
			if strings.TrimSpace(s.Explanation) != "" {
				out += fmt.Sprintf("- Score note: %s\n", truncate(s.Explanation, 120))
			}
		}

		matches := m.findingsForOperation(op)
		if len(matches) == 0 {
			out += "- Matching findings: none\n"
		} else {
			out += "- Matching findings (up to 8):\n"
			for _, issue := range matches {
				out += fmt.Sprintf("  - [%s/%s] %s\n", issue.Severity, issue.Code, truncate(issue.Message, 90))
			}
		}

		edges, chains := m.workflowReferencesForOperation(op)
		if len(edges) == 0 && len(chains) == 0 {
			out += "- Related workflows: none\n"
		} else {
			out += "- Related workflows:\n"
			for _, line := range edges {
				out += fmt.Sprintf("  - edge: %s\n", truncate(line, 100))
			}
			for _, line := range chains {
				out += fmt.Sprintf("  - chain: %s\n", truncate(line, 100))
			}
		}

		out += fmt.Sprintf("- Why this matters: %s\n", m.endpointWhyMatters(op, matches, edges, chains))
	} else {
		out += "\nTip: press enter (or d) on an endpoint to open related details.\n"
	}

	return out
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
	out += fmt.Sprintf("Totals  ops:%d  findings:%d  edges:%d  chains:%d  diff:%s\n", ops, issues, edges, chains, diffChanges)
	if m.analysis != nil {
		out += "\nSeverity Summary\n"
		out += fmt.Sprintf("- Errors:   %d\n", countSeverity(m.analysis.Issues, "error"))
		out += fmt.Sprintf("- Warnings: %d\n", countSeverity(m.analysis.Issues, "warning"))
		out += fmt.Sprintf("- Info:     %d\n", countSeverity(m.analysis.Issues, "info"))
	} else {
		out += "\nNo analysis data loaded for this run. Provide --spec to populate this screen.\n"
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
	total := len(m.analysis.Issues)
	for i, item := range buckets {
		prefix := " "
		if i == m.findingsBucketIndex {
			prefix = ">"
		}
		pct := percent(item.count, total)
		out += fmt.Sprintf("%s %d) %-42s %4d (%2d%%)\n", prefix, i+1, item.key, item.count, pct)
	}

	if m.findingsDetailOpen && len(buckets) > 0 {
		selected := buckets[m.findingsBucketIndex].key
		out += fmt.Sprintf("\nDetails for %s (up to 5)\n", selected)
		for _, line := range m.findingDetails(selected, 5) {
			out += fmt.Sprintf("- %s\n", line)
		}
	} else {
		out += "\nTip: press enter (or d) on a bucket to preview details.\n"
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
		return "Workflows Summary\n\nNo workflow data available for this run. Provide --spec to populate this screen.\n"
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

	if m.workflowSection == 0 {
		out += "\nActive section: Pairwise\n"
	} else {
		out += "\nActive section: Chains\n"
	}

	out += "\nPairwise kind buckets\n"
	edgeBuckets := topCounts(edgeKinds, 6)
	totalEdges := len(m.workflowGraph.Edges)
	for i, item := range edgeBuckets {
		prefix := " "
		if m.workflowSection == 0 && i == m.workflowBucketIndex {
			prefix = ">"
		}
		out += fmt.Sprintf("%s %d) %-42s %4d (%2d%%)\n", prefix, i+1, item.key, item.count, percent(item.count, totalEdges))
	}

	out += "\nChain kind buckets\n"
	chainBuckets := topCounts(chainKinds, 6)
	totalChains := len(m.workflowGraph.Chains)
	for i, item := range chainBuckets {
		prefix := " "
		if m.workflowSection == 1 && i == m.workflowBucketIndex {
			prefix = ">"
		}
		out += fmt.Sprintf("%s %d) %-42s %4d (%2d%%)\n", prefix, i+1, item.key, item.count, percent(item.count, totalChains))
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
	} else {
		out += "\nTip: press enter (or d) on the active section bucket for details.\n"
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

	if m.workflowItemDetailOpen {
		out += "\nWorkflow item detail\n"
		out += m.viewWorkflowItemDetail()
	}

	return out
}

func (m Model) viewWorkflowItemDetail() string {
	if m.workflowGraph == nil {
		return "No workflow graph available.\n"
	}

	if m.workflowItemSection == 0 {
		if m.workflowItemIndex < 0 || m.workflowItemIndex >= len(m.workflowGraph.Edges) {
			return "No pairwise workflow selected.\n"
		}
		edge := m.workflowGraph.Edges[m.workflowItemIndex]
		out := ""
		out += fmt.Sprintf("- Kind: %s\n", edge.Kind)
		out += fmt.Sprintf("- Step sequence: %s %s -> %s %s\n", edge.From.Method, edge.From.Path, edge.To.Method, edge.To.Path)

		score := m.workflowScoreForIndex(m.workflowItemIndex)
		if score != nil {
			out += fmt.Sprintf("- Scores (UI/Schema/Client): %d/%d/%d\n", score.UIIndependence, score.SchemaCompleteness, score.ClientGenerationQuality)
			out += fmt.Sprintf("- Bottleneck: %s\n", workflowBottleneckSummary(score))
		} else {
			out += "- Scores (UI/Schema/Client): n/a\n"
			out += "- Bottleneck: score data not available\n"
		}

		fromOp := m.findOperationByMethodPath(edge.From.Method, edge.From.Path)
		toOp := m.findOperationByMethodPath(edge.To.Method, edge.To.Path)
		out += "- Related endpoints/findings:\n"
		out += fmt.Sprintf("  - %s %s findings:%d\n", edge.From.Method, edge.From.Path, len(m.allFindingsForOperation(fromOp)))
		out += fmt.Sprintf("  - %s %s findings:%d\n", edge.To.Method, edge.To.Path, len(m.allFindingsForOperation(toOp)))
		out += fmt.Sprintf("- Why this matters: %s\n", workflowWhyMatters(score, len(m.allFindingsForOperation(fromOp))+len(m.allFindingsForOperation(toOp))))
		return out
	}

	if m.workflowItemIndex < 0 || m.workflowItemIndex >= len(m.workflowGraph.Chains) {
		return "No chain selected.\n"
	}
	chain := m.workflowGraph.Chains[m.workflowItemIndex]
	out := ""
	out += fmt.Sprintf("- Kind: %s\n", chain.Kind)
	steps := make([]string, 0, len(chain.Steps))
	for _, step := range chain.Steps {
		steps = append(steps, fmt.Sprintf("%s %s", step.Node.Method, step.Node.Path))
	}
	if len(steps) == 0 {
		out += "- Step sequence: (empty)\n"
	} else {
		out += fmt.Sprintf("- Step sequence: %s\n", truncate(strings.Join(steps, " -> "), 180))
	}

	chainScore := m.chainScoreForIndex(m.workflowItemIndex)
	if chainScore != nil {
		out += fmt.Sprintf("- Scores (UI/Schema/Client): %d/%d/%d\n", chainScore.UIIndependence, chainScore.SchemaCompleteness, chainScore.ClientGenerationQuality)
		out += fmt.Sprintf("- Bottleneck: %s\n", chainBottleneckSummary(chainScore))
	} else {
		out += "- Scores (UI/Schema/Client): n/a\n"
		out += "- Bottleneck: score data not available\n"
	}

	totalFindings := 0
	out += "- Related endpoints/findings:\n"
	for _, step := range chain.Steps {
		op := m.findOperationByMethodPath(step.Node.Method, step.Node.Path)
		count := len(m.allFindingsForOperation(op))
		totalFindings += count
		out += fmt.Sprintf("  - %s %s findings:%d\n", step.Node.Method, step.Node.Path, count)
	}
	out += fmt.Sprintf("- Why this matters: %s\n", chainWhyMatters(chainScore, totalFindings))
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
	if len(m.diffResult.Changes) == 0 {
		out += "No breaking changes detected in this run.\n"
		return out
	}

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

func (m *Model) endpointMove(delta int) {
	ops := m.endpointOperations()
	if len(ops) == 0 {
		m.endpointIndex = 0
		m.endpointDetailOpen = false
		return
	}
	m.endpointIndex = wrapIndex(m.endpointIndex+delta, len(ops))
	m.endpointDetailOpen = false
}

func (m *Model) hotspotMove(delta int) {
	items := m.hotspotItems()
	if len(items) == 0 {
		m.hotspotIndex = 0
		return
	}
	m.hotspotIndex = wrapIndex(m.hotspotIndex+delta, len(items))
}

func (m Model) endpointOperations() []*model.Operation {
	if m.analysis == nil {
		return nil
	}
	ops := append([]*model.Operation(nil), m.analysis.Operations...)
	sort.Slice(ops, func(i, j int) bool {
		leftPath := ops[i].Path
		rightPath := ops[j].Path
		if leftPath != rightPath {
			return leftPath < rightPath
		}
		return strings.ToUpper(ops[i].Method) < strings.ToUpper(ops[j].Method)
	})
	return ops
}

func listWindow(total, selected, size int) (int, int) {
	if total <= 0 || size <= 0 {
		return 0, 0
	}
	if total <= size {
		return 0, total
	}
	half := size / 2
	start := selected - half
	if start < 0 {
		start = 0
	}
	end := start + size
	if end > total {
		end = total
		start = end - size
	}
	return start, end
}

func (m Model) endpointScoreSummary(op *model.Operation) string {
	s := m.endpointScoreForOperation(op)
	if s == nil {
		return "n/a"
	}
	return fmt.Sprintf("%d/%d/%d", s.SchemaCompleteness, s.ClientGenerationQuality, s.VersioningSafety)
}

func (m Model) endpointScoreForOperation(op *model.Operation) *endpoint.EndpointScore {
	if op == nil || len(m.endpointScores) == 0 {
		return nil
	}
	key := strings.Join([]string{op.Method, op.Path}, "|")
	if score, ok := m.endpointScores[key]; ok {
		return score
	}
	alt := strings.Join([]string{strings.ToUpper(op.Method), op.Path}, "|")
	if score, ok := m.endpointScores[alt]; ok {
		return score
	}
	return nil
}

func (m Model) findingsForOperation(op *model.Operation) []*model.Issue {
	if op == nil || m.analysis == nil {
		return nil
	}
	all := make([]*model.Issue, 0)
	for _, issue := range m.analysis.Issues {
		if issue.Path != op.Path {
			continue
		}
		all = append(all, issue)
	}
	sort.Slice(all, func(i, j int) bool {
		if all[i].Severity != all[j].Severity {
			return all[i].Severity < all[j].Severity
		}
		if all[i].Code != all[j].Code {
			return all[i].Code < all[j].Code
		}
		return all[i].Message < all[j].Message
	})
	if len(all) <= 8 {
		return all
	}
	return all[:8]
}

func (m Model) allFindingsForOperation(op *model.Operation) []*model.Issue {
	if op == nil || m.analysis == nil {
		return nil
	}
	all := make([]*model.Issue, 0)
	for _, issue := range m.analysis.Issues {
		if issue.Path != op.Path {
			continue
		}
		all = append(all, issue)
	}
	return all
}

func (m Model) endpointRiskScore(op *model.Operation) int {
	if op == nil {
		return 0
	}
	s := m.endpointScoreForOperation(op)
	scoreGap := 0
	if s != nil {
		scoreGap = 15 - (s.SchemaCompleteness + s.ClientGenerationQuality + s.VersioningSafety)
	}
	findings := len(m.allFindingsForOperation(op))
	return scoreGap + (findings * 2)
}

func pathFamily(path string) string {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" || trimmed == "/" {
		return "/"
	}
	parts := strings.Split(strings.TrimPrefix(trimmed, "/"), "/")
	if len(parts) == 0 || strings.TrimSpace(parts[0]) == "" {
		return "/"
	}
	return "/" + parts[0]
}

func (m Model) hotspotItems() []hotspotItem {
	items := make([]hotspotItem, 0)

	if m.analysis != nil {
		codes := map[string]int{}
		codeOp := map[string]*model.Operation{}
		for _, issue := range m.analysis.Issues {
			codes[issue.Code]++
			if codeOp[issue.Code] == nil {
				codeOp[issue.Code] = m.findOperationByIssue(issue)
			}
		}
		for _, item := range topCounts(codes, 4) {
			items = append(items, hotspotItem{
				kind:   "finding-bucket",
				label:  item.key,
				value:  fmt.Sprintf("count=%d", item.count),
				risk:   item.count * 3,
				detail: "Frequent finding code; likely repeated usability or schema trap.",
				operation: codeOp[item.key],
			})
		}

		if len(m.analysis.Operations) > 0 {
			totals := map[string]int{}
			counts := map[string]int{}
			representative := map[string]*model.Operation{}
			for _, op := range m.analysis.Operations {
				fam := pathFamily(op.Path)
				totals[fam] += m.endpointRiskScore(op)
				counts[fam]++
				if representative[fam] == nil || m.endpointRiskScore(op) > m.endpointRiskScore(representative[fam]) {
					representative[fam] = op
				}
			}
			familyRisk := make([]kvCount, 0, len(totals))
			for fam, total := range totals {
				avg := 0
				if counts[fam] > 0 {
					avg = total / counts[fam]
				}
				familyRisk = append(familyRisk, kvCount{key: fam, count: avg})
			}
			sort.Slice(familyRisk, func(i, j int) bool {
				if familyRisk[i].count != familyRisk[j].count {
					return familyRisk[i].count > familyRisk[j].count
				}
				return familyRisk[i].key < familyRisk[j].key
			})
			if len(familyRisk) > 3 {
				familyRisk = familyRisk[:3]
			}
			for _, fr := range familyRisk {
				items = append(items, hotspotItem{
					kind:      "endpoint-family",
					label:     fr.key,
					value:     fmt.Sprintf("avg-risk=%d", fr.count),
					risk:      fr.count,
					detail:    "Path family has weaker endpoint scores and/or repeated findings.",
					operation: representative[fr.key],
				})
			}
		}
	}

	if m.workflowGraph != nil {
		if len(m.workflowScores) > 0 {
			totals := map[string]int{}
			counts := map[string]int{}
			for i, edge := range m.workflowGraph.Edges {
				score, ok := m.workflowScores[fmt.Sprintf("%d", i)]
				if !ok || score == nil {
					continue
				}
				totals[edge.Kind] += score.UIIndependence + score.SchemaCompleteness + score.ClientGenerationQuality
				counts[edge.Kind]++
			}
			for kind, total := range totals {
				avg := total / counts[kind]
				risk := 15 - avg
				if risk <= 0 {
					continue
				}
				items = append(items, hotspotItem{
					kind:   "workflow-kind",
					label:  kind,
					value:  fmt.Sprintf("avg-score=%d/15", avg),
					risk:   risk,
					detail: "Lower workflow scores can signal weaker automation or schema continuity.",
				})
			}
		}

		if len(m.chainScores) > 0 {
			totals := map[string]int{}
			counts := map[string]int{}
			for i, chain := range m.workflowGraph.Chains {
				score, ok := m.chainScores[fmt.Sprintf("%d", i)]
				if !ok || score == nil {
					continue
				}
				totals[chain.Kind] += score.UIIndependence + score.SchemaCompleteness + score.ClientGenerationQuality
				counts[chain.Kind]++
			}
			for kind, total := range totals {
				avg := total / counts[kind]
				risk := 15 - avg
				if risk <= 0 {
					continue
				}
				items = append(items, hotspotItem{
					kind:   "chain-kind",
					label:  kind,
					value:  fmt.Sprintf("avg-score=%d/15", avg),
					risk:   risk,
					detail: "Lower chain scores can signal brittle multi-step integration paths.",
				})
			}
		}
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].risk != items[j].risk {
			return items[i].risk > items[j].risk
		}
		if items[i].kind != items[j].kind {
			return items[i].kind < items[j].kind
		}
		return items[i].label < items[j].label
	})
	if len(items) > 12 {
		return items[:12]
	}
	return items
}

func (m Model) selectedHotspotOperation() *model.Operation {
	items := m.hotspotItems()
	if len(items) == 0 {
		return nil
	}
	idx := m.hotspotIndex
	if idx < 0 {
		idx = 0
	}
	if idx >= len(items) {
		idx = len(items) - 1
	}
	if items[idx].operation != nil {
		return items[idx].operation
	}
	return nil
}

func (m Model) selectedHotspotWorkflowTarget() (int, string, bool) {
	items := m.hotspotItems()
	if len(items) == 0 {
		return 0, "", false
	}
	idx := m.hotspotIndex
	if idx < 0 {
		idx = 0
	}
	if idx >= len(items) {
		idx = len(items) - 1
	}
	s := items[idx]
	if s.kind == "workflow-kind" {
		return 0, s.label, true
	}
	if s.kind == "chain-kind" {
		return 1, s.label, true
	}
	return 0, "", false
}

func (m *Model) openWorkflowDetailFromSelectedHotspot() bool {
	section, kind, ok := m.selectedHotspotWorkflowTarget()
	if !ok {
		return false
	}
	m.workflowSection = section
	buckets := m.workflowBuckets(section)
	for i, b := range buckets {
		if b.key == kind {
			m.workflowBucketIndex = i
			break
		}
	}
	m.workflowDetailOpen = true
	return m.openWorkflowItemDetail(section, kind)
}

func (m *Model) openWorkflowItemDetailForCurrentBucket() bool {
	buckets := m.workflowActiveBuckets()
	if len(buckets) == 0 {
		m.workflowItemDetailOpen = false
		return false
	}
	idx := m.workflowBucketIndex
	if idx < 0 {
		idx = 0
	}
	if idx >= len(buckets) {
		idx = len(buckets) - 1
	}
	return m.openWorkflowItemDetail(m.workflowSection, buckets[idx].key)
}

func (m *Model) openWorkflowItemDetail(section int, kind string) bool {
	if m.workflowGraph == nil {
		m.workflowItemDetailOpen = false
		return false
	}
	index := -1
	if section == 0 {
		for i, edge := range m.workflowGraph.Edges {
			if edge.Kind == kind {
				index = i
				break
			}
		}
	} else {
		for i, chain := range m.workflowGraph.Chains {
			if chain.Kind == kind {
				index = i
				break
			}
		}
	}
	if index == -1 {
		m.workflowItemDetailOpen = false
		return false
	}
	m.workflowItemDetailOpen = true
	m.workflowItemSection = section
	m.workflowItemKind = kind
	m.workflowItemIndex = index
	return true
}

func (m Model) endpointWhyMatters(op *model.Operation, findings []*model.Issue, edges []string, chains []string) string {
	reasons := make([]string, 0)
	score := m.endpointScoreForOperation(op)
	if score != nil {
		if score.SchemaCompleteness <= 3 || score.ClientGenerationQuality <= 3 || score.VersioningSafety <= 3 {
			reasons = append(reasons, fmt.Sprintf("low score %d/%d/%d", score.SchemaCompleteness, score.ClientGenerationQuality, score.VersioningSafety))
		}
	}
	if len(findings) > 0 {
		codes := map[string]int{}
		for _, f := range findings {
			codes[f.Code]++
		}
		top := topCounts(codes, 2)
		labels := make([]string, 0, len(top))
		for _, t := range top {
			labels = append(labels, t.key)
		}
		reasons = append(reasons, fmt.Sprintf("%d matching findings (%s)", len(findings), strings.Join(labels, ", ")))
	}
	if len(edges)+len(chains) > 0 {
		reasons = append(reasons, fmt.Sprintf("appears in %d workflow references", len(edges)+len(chains)))
	}
	if len(reasons) == 0 {
		return "currently low risk from deterministic signals"
	}
	return strings.Join(reasons, "; ")
}

func workflowBottleneckSummary(score *workflow.WorkflowScore) string {
	if score == nil {
		return "score data not available"
	}
	parts := []string{}
	min := score.UIIndependence
	label := "UI independence"
	if score.SchemaCompleteness < min {
		min = score.SchemaCompleteness
		label = "schema completeness"
	}
	if score.ClientGenerationQuality < min {
		min = score.ClientGenerationQuality
		label = "client generation quality"
	}
	parts = append(parts, fmt.Sprintf("weakest dimension is %s (%d/5)", label, min))
	if strings.TrimSpace(score.Explanation) != "" {
		parts = append(parts, truncate(score.Explanation, 100))
	}
	return strings.Join(parts, "; ")
}

func chainBottleneckSummary(score *workflow.ChainScore) string {
	if score == nil {
		return "score data not available"
	}
	min := score.UIIndependence
	label := "UI independence"
	if score.SchemaCompleteness < min {
		min = score.SchemaCompleteness
		label = "schema completeness"
	}
	if score.ClientGenerationQuality < min {
		min = score.ClientGenerationQuality
		label = "client generation quality"
	}
	summary := fmt.Sprintf("weakest dimension is %s (%d/5)", label, min)
	if score.ContinuityPenalty > 0 {
		summary += fmt.Sprintf("; continuity penalty %d", score.ContinuityPenalty)
	}
	if strings.TrimSpace(score.Explanation) != "" {
		summary += "; " + truncate(score.Explanation, 100)
	}
	return summary
}

func workflowWhyMatters(score *workflow.WorkflowScore, findings int) string {
	parts := []string{}
	if score != nil {
		if score.UIIndependence <= 3 || score.SchemaCompleteness <= 3 || score.ClientGenerationQuality <= 3 {
			parts = append(parts, fmt.Sprintf("low score %d/%d/%d", score.UIIndependence, score.SchemaCompleteness, score.ClientGenerationQuality))
		}
	}
	if findings > 0 {
		parts = append(parts, fmt.Sprintf("touches endpoints with %d findings", findings))
	}
	if len(parts) == 0 {
		return "workflow path is currently low risk from deterministic signals"
	}
	return strings.Join(parts, "; ")
}

func chainWhyMatters(score *workflow.ChainScore, findings int) string {
	parts := []string{}
	if score != nil {
		if score.UIIndependence <= 3 || score.SchemaCompleteness <= 3 || score.ClientGenerationQuality <= 3 {
			parts = append(parts, fmt.Sprintf("low score %d/%d/%d", score.UIIndependence, score.SchemaCompleteness, score.ClientGenerationQuality))
		}
		if score.ContinuityPenalty > 0 {
			parts = append(parts, fmt.Sprintf("continuity penalty %d", score.ContinuityPenalty))
		}
	}
	if findings > 0 {
		parts = append(parts, fmt.Sprintf("touches endpoints with %d findings", findings))
	}
	if len(parts) == 0 {
		return "chain path is currently low risk from deterministic signals"
	}
	return strings.Join(parts, "; ")
}

func (m Model) firstOperationForSelectedFindingBucket() *model.Operation {
	buckets := m.findingCodeBuckets()
	if len(buckets) == 0 {
		return nil
	}
	idx := m.findingsBucketIndex
	if idx < 0 {
		idx = 0
	}
	if idx >= len(buckets) {
		idx = len(buckets) - 1
	}
	targetCode := buckets[idx].key

	for _, issue := range m.analysis.Issues {
		if issue.Code != targetCode {
			continue
		}
		op := m.findOperationByIssue(issue)
		if op != nil {
			return op
		}
	}
	return nil
}

func (m Model) findOperationByIssue(issue *model.Issue) *model.Operation {
	if issue == nil || m.analysis == nil {
		return nil
	}
	ops := m.endpointOperations()
	for _, op := range ops {
		if op.Path != issue.Path {
			continue
		}
		if strings.TrimSpace(issue.Operation) == "" || strings.EqualFold(op.Method, issue.Operation) {
			return op
		}
	}
	return nil
}

func (m Model) indexOfOperation(target *model.Operation) int {
	if target == nil {
		return 0
	}
	ops := m.endpointOperations()
	for i, op := range ops {
		if strings.EqualFold(op.Method, target.Method) && op.Path == target.Path {
			return i
		}
	}
	return 0
}

func nodeMatchesOperation(node workflow.Node, op *model.Operation) bool {
	if op == nil {
		return false
	}
	return node.Path == op.Path && strings.EqualFold(node.Method, op.Method)
}

func (m Model) workflowReferencesForOperation(op *model.Operation) ([]string, []string) {
	if op == nil || m.workflowGraph == nil {
		return nil, nil
	}

	edges := make([]string, 0)
	for _, edge := range m.workflowGraph.Edges {
		if !nodeMatchesOperation(edge.From, op) && !nodeMatchesOperation(edge.To, op) {
			continue
		}
		edges = append(edges, fmt.Sprintf("%s: %s %s -> %s %s", edge.Kind, edge.From.Method, edge.From.Path, edge.To.Method, edge.To.Path))
		if len(edges) >= 5 {
			break
		}
	}

	chains := make([]string, 0)
	for _, chain := range m.workflowGraph.Chains {
		matchedStep := -1
		for i, step := range chain.Steps {
			if nodeMatchesOperation(step.Node, op) {
				matchedStep = i + 1
				break
			}
		}
		if matchedStep == -1 || len(chain.Steps) == 0 {
			continue
		}
		first := chain.Steps[0].Node
		last := chain.Steps[len(chain.Steps)-1].Node
		chains = append(chains, fmt.Sprintf("%s step %d/%d: %s %s -> %s %s", chain.Kind, matchedStep, len(chain.Steps), first.Method, first.Path, last.Method, last.Path))
		if len(chains) >= 5 {
			break
		}
	}

	return edges, chains
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
		lines = append(lines, fmt.Sprintf("%s: %s", label, truncate(msg, 90)))
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
		m.workflowItemDetailOpen = false
		return
	}
	m.workflowBucketIndex = wrapIndex(m.workflowBucketIndex+delta, len(buckets))
	m.workflowDetailOpen = false
	m.workflowItemDetailOpen = false
}

func (m Model) workflowActiveBuckets() []kvCount {
	return m.workflowBuckets(m.workflowSection)
}

func (m Model) workflowBuckets(section int) []kvCount {
	if section == 0 {
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

func (m Model) findOperationByMethodPath(method, path string) *model.Operation {
	if m.analysis == nil {
		return nil
	}
	for _, op := range m.analysis.Operations {
		if op.Path == path && strings.EqualFold(op.Method, method) {
			return op
		}
	}
	return nil
}

func (m Model) workflowScoreForIndex(index int) *workflow.WorkflowScore {
	if index < 0 || len(m.workflowScores) == 0 {
		return nil
	}
	return m.workflowScores[fmt.Sprintf("%d", index)]
}

func (m Model) chainScoreForIndex(index int) *workflow.ChainScore {
	if index < 0 || len(m.chainScores) == 0 {
		return nil
	}
	return m.chainScores[fmt.Sprintf("%d", index)]
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
			summary := fmt.Sprintf("%d steps: %s %s -> %s %s", len(chain.Steps), first.Method, first.Path, last.Method, last.Path)
			if strings.TrimSpace(chain.Reason) != "" {
				summary += " | " + truncate(chain.Reason, 60)
			}
			lines = append(lines, summary)
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

func percent(part, total int) int {
	if total <= 0 || part <= 0 {
		return 0
	}
	return (part * 100) / total
}

func truncate(s string, max int) string {
	s = strings.TrimSpace(s)
	if max <= 3 || len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}
