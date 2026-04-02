package tui

import (
	"fmt"
	"sort"
	"strings"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	intdiff "github.com/lasomethingsomething/api-doctor/internal/diff"
	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/model"
	"github.com/lasomethingsomething/api-doctor/internal/workflow"
)

var (
	styleTitle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("24"))
	styleHeader = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("81")).
		Background(lipgloss.Color("255")).
		Foreground(lipgloss.Color("238")).
		Padding(0, 1)
	styleFooter = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("219")).
		Background(lipgloss.Color("255")).
		Foreground(lipgloss.Color("238")).
		Padding(0, 1)
	stylePanel = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("250")).
		Background(lipgloss.Color("255")).
		Foreground(lipgloss.Color("236")).
		Padding(0, 1)
	stylePanelTitle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("24"))
	styleSelection = lipgloss.NewStyle().Foreground(lipgloss.Color("198")).Bold(true)
	styleMuted = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	styleOK = lipgloss.NewStyle().Foreground(lipgloss.Color("28"))
	styleWarn = lipgloss.NewStyle().Foreground(lipgloss.Color("208"))
	styleBad = lipgloss.NewStyle().Foreground(lipgloss.Color("204")).Bold(true)
	styleNav = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("81")).
		Background(lipgloss.Color("255")).
		Padding(0, 1)
	styleNavItem = lipgloss.NewStyle().Foreground(lipgloss.Color("236"))
	styleNavActive = lipgloss.NewStyle().
		Foreground(lipgloss.Color("236")).
		Background(lipgloss.Color("189")).
		Bold(true)
	styleFocus = lipgloss.NewStyle().Foreground(lipgloss.Color("22")).Bold(true)
	styleFocusedPanel = lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("198")).Background(lipgloss.Color("255")).Foreground(lipgloss.Color("236")).Padding(0, 1)
	styleRowSelected = lipgloss.NewStyle().Foreground(lipgloss.Color("236")).Background(lipgloss.Color("189")).Bold(true)
	styleFocusBadge = lipgloss.NewStyle().Foreground(lipgloss.Color("236")).Background(lipgloss.Color("189")).Bold(true).Padding(0, 1)
)

type paneFocus int

const (
	paneNav paneFocus = iota
	paneMain
	paneDetail
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
	menuIndex int
	focusPane paneFocus

	helpModel help.Model
	keys     tuiKeyMap

	hotspotIndex int

	endpointIndex      int
	endpointDetailOpen bool
	endpointSortMode   int // 0=risk, 1=path

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

type tuiKeyMap struct {
	NavUp     key.Binding
	NavDown   key.Binding
	Select    key.Binding
	FocusPane key.Binding
	Open      key.Binding
	Close     key.Binding
	Section   key.Binding
	QuickJump key.Binding
	Quit      key.Binding
}

func defaultKeyMap() tuiKeyMap {
	return tuiKeyMap{
		NavUp: key.NewBinding(
			key.WithKeys("up", "k"),
			key.WithHelp("↑/k", "move"),
		),
		NavDown: key.NewBinding(
			key.WithKeys("down", "j"),
			key.WithHelp("↓/j", "move"),
		),
		Select: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "select/open"),
		),
		FocusPane: key.NewBinding(
			key.WithKeys("tab"),
			key.WithHelp("tab", "switch pane"),
		),
		Open: key.NewBinding(
			key.WithKeys("o", "d"),
			key.WithHelp("o/d", "open detail"),
		),
		Close: key.NewBinding(
			key.WithKeys("esc"),
			key.WithHelp("esc", "close detail"),
		),
		Section: key.NewBinding(
			key.WithKeys("w", "s"),
			key.WithHelp("w/s", "toggle section"),
		),
		QuickJump: key.NewBinding(
			key.WithKeys("1", "2", "3", "4", "5", "6"),
			key.WithHelp("1..6", "quick jump"),
		),
		Quit: key.NewBinding(
			key.WithKeys("q", "ctrl+c"),
			key.WithHelp("q", "quit"),
		),
	}
}

func (k tuiKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.NavUp, k.NavDown, k.Select, k.FocusPane, k.Open, k.Close, k.QuickJump, k.Quit}
}

func (k tuiKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.NavUp, k.NavDown, k.Select, k.FocusPane}, {k.Open, k.Close, k.Section, k.QuickJump, k.Quit}}
}

func NewModel(
	analysis *model.AnalysisResult,
	endpointScores map[string]*endpoint.EndpointScore,
	workflowGraph *workflow.Graph,
	workflowScores map[string]*workflow.WorkflowScore,
	chainScores map[string]*workflow.ChainScore,
	diffResult *intdiff.Result,
) Model {
	h := help.New()
	h.ShowAll = false
	return Model{
		active:         screenOverview,
		menuIndex:      0,
		focusPane:      paneNav,
		helpModel:      h,
		keys:           defaultKeyMap(),
		analysis:       analysis,
		endpointScores: endpointScores,
		endpointSortMode: 0,
		workflowGraph:  workflowGraph,
		workflowScores: workflowScores,
		chainScores:    chainScores,
		diffResult:     diffResult,
	}
}

const (
	endpointSortRisk = iota
	endpointSortPath
)

func (m Model) Init() tea.Cmd { return nil }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if key.Matches(msg, m.keys.Quit) {
			return m, tea.Quit
		}

		if key.Matches(msg, m.keys.FocusPane) {
			m.cyclePaneFocus(1)
			return m, nil
		}

		if msg.String() == "left" {
			m.cyclePaneFocus(-1)
			return m, nil
		}

		if msg.String() == "right" {
			m.cyclePaneFocus(1)
			return m, nil
		}

		if m.focusPane == paneNav {
			switch msg.String() {
			case "up", "k":
				m.moveMenu(-1)
				return m, nil
			case "down", "j":
				m.moveMenu(1)
				return m, nil
			case "enter":
				m.setActive(m.screenAtMenuIndex())
				m.focusPane = paneMain
				return m, nil
			}
		}

		if m.active == screenFindings && m.focusPane == paneMain {
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
					m.setActive(screenEndpoints)
					m.endpointIndex = m.indexOfOperation(op)
					m.endpointDetailOpen = true
				}
				return m, nil
			case "esc":
				m.findingsDetailOpen = false
				return m, nil
			}
		}

		if m.active == screenWorkflows && m.focusPane == paneMain {
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

		if m.active == screenEndpoints && m.focusPane == paneMain {
			switch msg.String() {
			case "up", "k":
				m.endpointMove(-1)
				return m, nil
			case "down", "j":
				m.endpointMove(1)
				return m, nil
			case "r":
				if m.endpointSortMode == endpointSortRisk {
					m.endpointSortMode = endpointSortPath
				} else {
					m.endpointSortMode = endpointSortRisk
				}
				m.endpointIndex = 0
				m.endpointDetailOpen = false
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

		if m.active == screenHotspots && m.focusPane == paneMain {
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
					m.setActive(screenEndpoints)
					m.endpointIndex = m.indexOfOperation(op)
					m.endpointDetailOpen = true
				} else if m.openWorkflowDetailFromSelectedHotspot() {
					m.setActive(screenWorkflows)
				}
				return m, nil
			}
		}

		if msg.String() == "esc" {
			switch m.active {
			case screenEndpoints:
				m.endpointDetailOpen = false
			case screenFindings:
				m.findingsDetailOpen = false
			case screenWorkflows:
				if m.workflowItemDetailOpen {
					m.workflowItemDetailOpen = false
				} else {
					m.workflowDetailOpen = false
				}
			}
			if m.focusPane == paneDetail {
				m.focusPane = paneMain
			}
			return m, nil
		}

		switch msg.String() {
		case "[", "h", "shift+tab":
			if m.active == 0 {
				m.setActive(screenDiff)
			} else {
				m.setActive(m.active - 1)
			}
		case "]", "l":
			if m.active == screenDiff {
				m.setActive(screenOverview)
			} else {
				m.setActive(m.active + 1)
			}
		case "home":
			m.setActive(screenOverview)
		case "end":
			m.setActive(screenDiff)
		case "1":
			m.setActive(screenOverview)
		case "2":
			m.setActive(screenHotspots)
		case "3":
			m.setActive(screenEndpoints)
			m.endpointDetailOpen = false
		case "4":
			m.setActive(screenFindings)
			m.findingsDetailOpen = false
		case "5":
			m.setActive(screenWorkflows)
			m.workflowDetailOpen = false
			m.workflowItemDetailOpen = false
		case "6":
			m.setActive(screenDiff)
		}
	}
	return m, nil
}

func (m Model) View() string {
	header := styleHeader.Render(strings.Join([]string{
		styleTitle.Render("api-doctor dashboard"),
		fmt.Sprintf("Section: %s | %s", m.activeTitle(), styleFocusBadge.Render("Focus: "+m.focusTitle())),
		m.dataStatusLine(),
	}, "\n"))

	mainTitle, mainBody, detailTitle, detailBody := m.currentPaneBodies()
	layout := lipgloss.JoinHorizontal(lipgloss.Top,
		m.viewSidebar(),
		m.renderPane(mainTitle, mainBody, paneMain, 54),
		m.renderPane(detailTitle, detailBody, paneDetail, 46),
	)
	footer := styleFooter.Render(strings.Join([]string{
		"Move focus: Left/Right or Tab   |   Navigate list: Up/Down",
		"Open/select: Enter   |   Drill-down: o / d   |   Close detail: Esc   |   Quit: q",
	}, "\n"))
	return lipgloss.JoinVertical(lipgloss.Left, header, layout, footer)
}

func (m *Model) cyclePaneFocus(delta int) {
	order := []paneFocus{paneNav, paneMain, paneDetail}
	idx := 0
	for i, p := range order {
		if p == m.focusPane {
			idx = i
			break
		}
	}
	idx = wrapIndex(idx+delta, len(order))
	m.focusPane = order[idx]
}

func (m Model) focusTitle() string {
	switch m.focusPane {
	case paneNav:
		return "Navigation"
	case paneMain:
		return "Main"
	case paneDetail:
		return "Detail"
	default:
		return "Unknown"
	}
}

func (m Model) activeTitle() string {
	for _, item := range m.menuItems() {
		if item.id == m.active {
			return item.label
		}
	}
	return "Unknown"
}

func (m *Model) setActive(s screen) {
	m.active = s
	m.menuIndex = int(s)
}

func (m *Model) moveMenu(delta int) {
	items := m.menuItems()
	if len(items) == 0 {
		m.menuIndex = 0
		return
	}
	m.menuIndex = wrapIndex(m.menuIndex+delta, len(items))
}

func (m Model) screenAtMenuIndex() screen {
	items := m.menuItems()
	if len(items) == 0 || m.menuIndex < 0 || m.menuIndex >= len(items) {
		return screenOverview
	}
	return items[m.menuIndex].id
}

type menuItem struct {
	id    screen
	label string
}

func (m Model) menuItems() []menuItem {
	return []menuItem{
		{id: screenOverview, label: "Overview"},
		{id: screenHotspots, label: "Hotspots"},
		{id: screenEndpoints, label: "Endpoints"},
		{id: screenFindings, label: "Findings"},
		{id: screenWorkflows, label: "Workflows"},
		{id: screenDiff, label: "Diff"},
	}
}

func (m Model) viewSidebar() string {
	lines := []string{stylePanelTitle.Render("Navigation")}
	if m.focusPane == paneNav {
		lines[0] = styleFocus.Render("Navigation - You are here")
	}
	for i, item := range m.menuItems() {
		prefix := "  "
		if item.id == m.active {
			prefix = "• "
		}
		line := fmt.Sprintf("%s%d. %s", prefix, i+1, item.label)
		if i == m.menuIndex {
			line = styleRowSelected.Render(line)
		} else {
			line = styleNavItem.Render(line)
		}
		lines = append(lines, line)
	}

	lines = append(lines, "", styleMuted.Render("Enter = open section"), styleMuted.Render("Tab = switch focus"))
	base := styleNav
	if m.focusPane == paneNav {
		base = styleFocusedPanel
	}
	return base.Width(26).Render(strings.Join(lines, "\n"))
}

func (m Model) renderPane(title, body string, p paneFocus, width int) string {
	base := stylePanel
	if m.focusPane == p {
		base = styleFocusedPanel
		title = styleFocus.Render(title + " - You are here")
	}
	return base.Width(width).Render(stylePanelTitle.Render(title) + "\n\n" + strings.TrimRight(body, "\n"))
}

func (m Model) currentPaneBodies() (string, string, string, string) {
	switch m.active {
	case screenOverview:
		return m.paneOverview()
	case screenHotspots:
		return m.paneHotspots()
	case screenEndpoints:
		return m.paneEndpoints()
	case screenFindings:
		return m.paneFindings()
	case screenWorkflows:
		return m.paneWorkflows()
	case screenDiff:
		return m.paneDiff()
	default:
		return "Main", "Unknown screen", "Detail", "No detail available"
	}
}

func (m Model) paneOverview() (string, string, string, string) {
	main := "\n"
	main += fmt.Sprintf("Endpoints analyzed from spec: %d\n", len(m.endpointOperations()))
	if m.analysis != nil {
		main += fmt.Sprintf("Total findings: %d\n", len(m.analysis.Issues))
		errCount := countSeverity(m.analysis.Issues, "error")
		warnCount := countSeverity(m.analysis.Issues, "warning")
		infoCount := countSeverity(m.analysis.Issues, "info")
		if infoCount > 0 {
			main += fmt.Sprintf("Findings by severity: errors %d, warnings %d, info %d\n", errCount, warnCount, infoCount)
		} else {
			main += fmt.Sprintf("Findings by severity: errors %d, warnings %d\n", errCount, warnCount)
		}
	}
	if m.workflowGraph != nil {
		main += fmt.Sprintf("Inferred pairwise workflow links: %d\n", len(m.workflowGraph.Edges))
		main += fmt.Sprintf("Inferred multi-step workflow chains: %d\n", len(m.workflowGraph.Chains))
	}
	detail := "This overview summarizes parsed endpoints, finding severity, and inferred workflow coverage.\n\nUse the left menu to explore details in each section."
	return "Overview", main, "What these numbers mean", detail
}

func (m Model) paneHotspots() (string, string, string, string) {
	items := m.hotspotItems()
	if len(items) == 0 {
		return "Hotspots", "No hotspot data available.", "Detail", "Provide --spec to populate this section."
	}
	idx := wrapIndex(m.hotspotIndex, len(items))
	list := fmt.Sprintf("Top hotspots: %d | Selected: %d/%d\n\n", len(items), idx+1, len(items))
	list += "Move with Up/Down. Press Enter or o to open related detail.\n\n"
	for i, item := range items {
		prefix := " "
		if i == idx {
			prefix = styleSelection.Render(">")
		}
		riskText := styleWarn.Render(fmt.Sprintf("risk:%3d", item.risk))
		if item.risk >= 10 {
			riskText = styleBad.Render(fmt.Sprintf("risk:%3d", item.risk))
		}
		row := fmt.Sprintf("%s %2d) %-16s %-30s %s %s", prefix, i+1, hotspotKindLabel(item.kind), truncate(item.label, 30), riskText, hotspotMetricLabel(item.value))
		if i == idx {
			row = styleRowSelected.Render(row)
		}
		list += row + "\n"
	}
	sel := items[idx]
	detail := fmt.Sprintf("Type: %s\nLabel: %s\nMetric: %s\n\nWhat this metric means:\n%s\n\nWhy this is a hotspot:\n%s\n\n", hotspotKindLabel(sel.kind), sel.label, hotspotMetricLabel(sel.value), hotspotMetricExplanation(sel.value), sel.detail)
	if sel.operation != nil {
		detail += "Press Enter or o in Main pane to jump to endpoint detail."
	} else {
		detail += "Press Enter or o in Main pane to open related context when available."
	}
	return "Hotspots", list, "Selected hotspot", detail
}

func (m Model) paneEndpoints() (string, string, string, string) {
	if m.analysis == nil {
		return "Endpoints", "No analysis data available.", "Detail", "Provide --spec to populate this section."
	}
	ops := m.endpointOperations()
	if len(ops) == 0 {
		return "Endpoints", "No endpoints were parsed from this spec.", "Detail", "No detail available."
	}
	idx := wrapIndex(m.endpointIndex, len(ops))
	list := fmt.Sprintf("Total endpoints: %d | Selected: %d/%d\n", len(ops), idx+1, len(ops))
	list += fmt.Sprintf("Sort: %s (press r to toggle)\n", m.endpointSortLabel())
	triples := m.endpointScoreTriples(3)
	if len(triples) > 0 {
		parts := make([]string, 0, len(triples))
		for _, item := range triples {
			parts = append(parts, fmt.Sprintf("%s=%d", item.key, item.count))
		}
		list += fmt.Sprintf("Common scores: %s\n", strings.Join(parts, ", "))
	}
	list += "\n"
	start, end := listWindow(len(ops), idx, 12)
	for i := start; i < end; i++ {
		op := ops[i]
		prefix := " "
		if i == idx {
			prefix = styleSelection.Render(">")
		}
		findings := len(m.findingsForOperation(op))
		score := m.endpointScoreSummary(op)
		risk := m.endpointRiskScore(op)
		row := fmt.Sprintf("%s %3d) %-6s %-28s findings:%-2d scores:%-5s risk:%-2d", prefix, i+1, strings.ToUpper(op.Method), truncate(op.Path, 28), findings, score, risk)
		if i == idx {
			row = styleRowSelected.Render(row)
		}
		list += row + "\n"
	}

	detail := styleMuted.Render("Press Enter or d in Main pane to open endpoint detail.\nRows show findings, score triplet, and risk to make clean vs problematic endpoints easier to trust.")
	if m.endpointDetailOpen {
		op := ops[idx]
		detail = fmt.Sprintf("Operation: %s %s\n", strings.ToUpper(op.Method), op.Path)
		if op.OperationID != "" {
			detail += fmt.Sprintf("Operation ID: %s\n", op.OperationID)
		}
		detail += fmt.Sprintf("Scores (schema/client/versioning): %s\n", m.endpointScoreSummary(op))
		detail += fmt.Sprintf("Findings count: %d\n", len(m.allFindingsForOperation(op)))
		detail += fmt.Sprintf("Risk score: %d\n\n", m.endpointRiskScore(op))
		matches := m.findingsForOperation(op)
		if len(matches) == 0 {
			detail += "Matching findings: none\n"
		} else {
			detail += "Matching findings:\n"
			for _, issue := range matches {
				detail += fmt.Sprintf("- [%s/%s] %s\n", issue.Severity, issue.Code, truncate(issue.Message, 70))
			}
		}
	}
	return "Endpoints", list, "Endpoint detail", detail
}

func (m Model) paneFindings() (string, string, string, string) {
	if m.analysis == nil {
		return "Findings", "No findings data available.", "Detail", "Provide --spec to populate this section."
	}
	buckets := m.findingCodeBuckets()
	if len(buckets) == 0 {
		return "Findings", "No findings detected in this run.", "Detail", "No detail available."
	}
	idx := wrapIndex(m.findingsBucketIndex, len(buckets))
	main := fmt.Sprintf("Total findings: %d | Buckets: %d\n\n", len(m.analysis.Issues), len(buckets))
	for i, b := range buckets {
		prefix := " "
		if i == idx {
			prefix = styleSelection.Render(">")
		}
		row := fmt.Sprintf("%s %2d) %-40s %4d", prefix, i+1, b.key, b.count)
		if i == idx {
			row = styleRowSelected.Render(row)
		}
		main += row + "\n"
	}
	detail := styleMuted.Render("Press Enter or d in Main pane to preview finding details.\nPress o to jump to endpoint detail.")
	if m.findingsDetailOpen {
		code := buckets[idx].key
		issues := m.findingIssuesByCode(code)
		detail = fmt.Sprintf("Finding: %s\n\n", code)
		detail += fmt.Sprintf("Summary: %s\n", m.findingSummary(code))
		detail += fmt.Sprintf("Affected endpoints: %d\n\n", len(issues))
		detail += "Representative examples:\n"
		exampleLimit := 4
		for i, issue := range issues {
			if i >= exampleLimit {
				break
			}
			endpoint := strings.TrimSpace(strings.Join([]string{strings.ToUpper(strings.TrimSpace(issue.Operation)), issue.Path}, " "))
			if endpoint == "" {
				endpoint = "(no endpoint context)"
			}
			detail += fmt.Sprintf("- %s\n  %s\n", truncate(endpoint, 72), truncate(strings.TrimSpace(issue.Message), 72))
		}
		detail += "\nWhy it matters:\n"
		detail += fmt.Sprintf("%s\n", m.findingWhyItMatters(code))
		if len(issues) > exampleLimit {
			detail += fmt.Sprintf("\nMore items: %d additional endpoints are hidden here. Use JSON output for full details.\n", len(issues)-exampleLimit)
		}
	}
	return "Findings", main, "Finding detail", detail
}

func (m Model) paneWorkflows() (string, string, string, string) {
	if m.workflowGraph == nil {
		return "Workflows", "No workflow data available.", "Detail", "Provide --spec to populate this section."
	}
	main := fmt.Sprintf("Inferred pairwise workflow links: %d\nInferred multi-step workflow chains: %d\n\n", len(m.workflowGraph.Edges), len(m.workflowGraph.Chains))
	if m.workflowSection == 0 {
		main += "Section: Pairwise edge families (route-to-route links)\n\n"
	} else {
		main += "Section: Multi-step chain families\n\n"
	}
	buckets := m.workflowActiveBuckets()
	if len(buckets) == 0 {
		return "Workflows", main + "No workflow buckets available.", "Workflow detail", "No detail available."
	}
	idx := wrapIndex(m.workflowBucketIndex, len(buckets))
	for i, b := range buckets {
		prefix := " "
		if i == idx {
			prefix = styleSelection.Render(">")
		}
		expl := workflowKindExample(b.key)
		row := fmt.Sprintf("%s %2d) %-22s %4d  %s", prefix, i+1, b.key, b.count, truncate(expl, 34))
		if i == idx {
			row = styleRowSelected.Render(row)
		}
		main += row + "\n"
	}
	main += "\nUse w/s to switch pairwise/chains."

	detail := styleMuted.Render("Press Enter or d for bucket preview.\nPress o for workflow/chain item detail.")
	if m.workflowDetailOpen {
		detail = fmt.Sprintf("Bucket: %s\n\n", buckets[idx].key)
		detail += fmt.Sprintf("What this kind means: %s\n\n", workflowKindExplanation(buckets[idx].key))
		if m.workflowSection == 0 {
			for _, line := range m.workflowEdgeDetails(buckets[idx].key, 7) {
				detail += fmt.Sprintf("- %s\n", line)
			}
		} else {
			for _, line := range m.workflowChainDetails(buckets[idx].key, 7) {
				detail += fmt.Sprintf("- %s\n", line)
			}
		}
	}
	if m.workflowItemDetailOpen {
		detail += "\nItem detail\n\n" + m.viewWorkflowItemDetail()
	}
	if m.workflowSection == 0 {
		detail += "\nNote\n"
		detail += "Equal counts between create-to-detail and list-to-detail can happen naturally when many resource families expose both flows. This indicates parallel coverage, not duplicate entries.\n"
	}
	return "Workflows", main, "Workflow detail", detail
}

func workflowKindExample(kind string) string {
	switch kind {
	case "create-to-detail":
		return "POST /x -> GET /x/{id}"
	case "list-to-detail":
		return "GET /x -> GET /x/{id}"
	case "action-to-detail":
		return "POST /_action/... -> GET /resource/{id}"
	case "accepted-to-tracking":
		return "POST /x (202) -> GET /x/status/{id}"
	default:
		return "deterministic workflow family"
	}
}

func workflowKindExplanation(kind string) string {
	switch kind {
	case "create-to-detail":
		return "Entity creation flow where the create response links to a follow-up detail read. Example: POST /x -> GET /x/{id}."
	case "list-to-detail":
		return "Collection browsing flow where a list/search endpoint links to per-item detail reads. Example: GET /x -> GET /x/{id}."
	case "action-to-detail":
		return "Action-triggered flow where a state-changing action links to a detail endpoint for verification."
	case "accepted-to-tracking":
		return "Async accepted flow where the initial endpoint should expose tracking linkage for status follow-up."
	default:
		return "A deterministic inferred workflow family grouped by kind."
	}
}

func (m Model) paneDiff() (string, string, string, string) {
	if m.diffResult == nil {
		main := "Diff mode is currently inactive.\n\nThis TUI session was started without --old and --new inputs."
		detail := "Diff data is not auto-discovered in this mode.\n\nUse your current local spec as --spec (for example ./adminapi.json) and provide both comparison files explicitly.\n\nExample:\napi-doctor tui --spec ./adminapi.json --old ./adminapi-v1.json --new ./adminapi-v2.json"
		return "Diff", main, "How to enable diff", detail
	}
	main := fmt.Sprintf("Old spec: %s\nNew spec: %s\nTotal changes: %d\n\n", m.diffResult.OldSpec, m.diffResult.NewSpec, len(m.diffResult.Changes))
	sev := map[string]int{}
	for _, c := range m.diffResult.Changes {
		sev[c.Severity]++
	}
	main += fmt.Sprintf("Errors: %d\nWarnings: %d\n", sev["error"], sev["warning"])
	detail := "Top change buckets\n\n"
	codes := map[string]int{}
	for _, c := range m.diffResult.Changes {
		codes[c.Code]++
	}
	for _, item := range topCounts(codes, 10) {
		detail += fmt.Sprintf("- %s: %d\n", item.key, item.count)
	}
	if len(codes) == 0 {
		detail += "No breaking changes detected.\n"
	}
	return "Diff", main, "Diff detail", detail
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
		return styleSelection.Render("[" + label + "]")
	}
	return styleMuted.Render(label)
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
	analysisText := styleOK.Render(analysisStatus)
	workflowText := styleOK.Render(workflowStatus)
	diffText := styleOK.Render(diffStatus)
	if m.analysis == nil {
		analysisText = styleWarn.Render(analysisStatus)
	}
	if m.workflowGraph == nil {
		workflowText = styleWarn.Render(workflowStatus)
	}
	if m.diffResult == nil {
		diffText = styleMuted.Render(diffStatus)
	}
	return "Data " + analysisText + " | " + workflowText + " | " + diffText
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
	items := m.hotspotItems()
	if len(items) == 0 {
		return m.panelSingle("Hotspots", "No hotspot data available for this run. Provide --spec to populate this view.")
	}

	idx := m.hotspotIndex
	if idx < 0 {
		idx = 0
	}
	if idx >= len(items) {
		idx = len(items) - 1
	}

	list := "Hotspots\n"
	list += styleMuted.Render("Worst areas first, ranked from deterministic signals.") + "\n\n"
	list += fmt.Sprintf("Top hotspots: %d | Selected: %d/%d\n\n", len(items), idx+1, len(items))
	for i, item := range items {
		prefix := " "
		if i == idx {
			prefix = styleSelection.Render(">")
		}
		riskText := styleWarn.Render(fmt.Sprintf("risk:%3d", item.risk))
		if item.risk >= 10 {
			riskText = styleBad.Render(fmt.Sprintf("risk:%3d", item.risk))
		}
		list += fmt.Sprintf("%s %2d) %-14s %-40s %s %s\n", prefix, i+1, item.kind, truncate(item.label, 40), riskText, item.value)
	}

	sel := items[idx]
	detail := "Selected hotspot\n\n"
	detail += fmt.Sprintf("- Type: %s\n", sel.kind)
	detail += fmt.Sprintf("- Label: %s\n", sel.label)
	detail += fmt.Sprintf("- Metric: %s\n", sel.value)
	detail += fmt.Sprintf("- Why risky: %s\n", sel.detail)
	if sel.operation != nil {
		detail += fmt.Sprintf("- Example endpoint: %s %s\n", strings.ToUpper(sel.operation.Method), sel.operation.Path)
		detail += styleMuted.Render("- Action: press enter (or o) to open endpoint detail in context.") + "\n"
	} else if sel.kind == "workflow-kind" || sel.kind == "chain-kind" {
		detail += styleMuted.Render("- Action: press enter (or o) to open workflow/chain detail in context.") + "\n"
	} else {
		detail += styleMuted.Render("- Action: no direct jump for this row.") + "\n"
	}

	return m.panelSplit("Hotspot ranking", list, "Hotspot detail", detail)
}

func (m Model) viewEndpoints() string {
	if m.analysis == nil {
		return m.panelSingle("Endpoints", "No analysis data available for this run. Provide --spec to populate this screen.")
	}

	ops := m.endpointOperations()
	list := "Endpoints Browser\n\n"
	list += fmt.Sprintf("Total endpoints: %d\n", len(ops))
	if len(ops) == 0 {
		return m.panelSingle("Endpoints", "No endpoints were parsed from this spec.")
	}

	mx := m.endpointIndex
	if mx < 0 {
		mx = 0
	}
	if mx >= len(ops) {
		mx = len(ops) - 1
	}
	list += fmt.Sprintf("Selected: %d/%d\n\n", mx+1, len(ops))

	start, end := listWindow(len(ops), mx, 10)
	for i := start; i < end; i++ {
		op := ops[i]
		prefix := " "
		if i == mx {
			prefix = styleSelection.Render(">")
		}
		findings := len(m.findingsForOperation(op))
		score := m.endpointScoreSummary(op)
		list += fmt.Sprintf("%s %3d) %-6s %-44s f:%-3d s:%s\n", prefix, i+1, strings.ToUpper(op.Method), truncate(op.Path, 44), findings, score)
	}

	detail := ""
	if m.endpointDetailOpen {
		op := ops[mx]
		detail += "Endpoint detail\n\n"
		detail += fmt.Sprintf("- Operation: %s %s\n", strings.ToUpper(op.Method), op.Path)
		if strings.TrimSpace(op.OperationID) != "" {
			detail += fmt.Sprintf("- Operation ID: %s\n", op.OperationID)
		}
		if strings.TrimSpace(op.Summary) != "" {
			detail += fmt.Sprintf("- Summary: %s\n", truncate(op.Summary, 90))
		}
		if len(op.Tags) > 0 {
			detail += fmt.Sprintf("- Tags: %s\n", truncate(strings.Join(op.Tags, ", "), 90))
		}

		s := m.endpointScoreForOperation(op)
		if s != nil {
			detail += fmt.Sprintf("- Scores (Schema/Client/Versioning): %d/%d/%d\n", s.SchemaCompleteness, s.ClientGenerationQuality, s.VersioningSafety)
			if strings.TrimSpace(s.Explanation) != "" {
				detail += fmt.Sprintf("- Score note: %s\n", truncate(s.Explanation, 120))
			}
		}

		matches := m.findingsForOperation(op)
		if len(matches) == 0 {
			detail += "- Matching findings: none\n"
		} else {
			detail += "- Matching findings (up to 8):\n"
			for _, issue := range matches {
				detail += fmt.Sprintf("  - [%s/%s] %s\n", issue.Severity, issue.Code, truncate(issue.Message, 90))
			}
		}

		edges, chains := m.workflowReferencesForOperation(op)
		if len(edges) == 0 && len(chains) == 0 {
			detail += "- Related workflows: none\n"
		} else {
			detail += "- Related workflows:\n"
			for _, line := range edges {
				detail += fmt.Sprintf("  - edge: %s\n", truncate(line, 100))
			}
			for _, line := range chains {
				detail += fmt.Sprintf("  - chain: %s\n", truncate(line, 100))
			}
		}

		detail += fmt.Sprintf("- Why this matters: %s\n", m.endpointWhyMatters(op, matches, edges, chains))
	} else {
		detail += styleMuted.Render("Tip: press enter (or d) on an endpoint to open related details.")
	}

	return m.panelSplit("Endpoint list", list, "Endpoint detail", detail)
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
	return m.panelSingle("Overview", out)
}

func (m Model) viewFindings() string {
	if m.analysis == nil {
		return m.panelSingle("Findings", "No findings data available for this run. Provide --spec to populate this screen.")
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

	return m.panelSingle("Findings", out)
}

func (m Model) viewWorkflows() string {
	if m.workflowGraph == nil {
		return m.panelSingle("Workflows", "No workflow data available for this run. Provide --spec to populate this screen.")
	}

	list := "Workflows Summary\n\n"
	list += fmt.Sprintf("Total pairwise workflows: %d\n", len(m.workflowGraph.Edges))
	list += fmt.Sprintf("Total multi-step chains:  %d\n", len(m.workflowGraph.Chains))
	if len(m.workflowGraph.Edges) == 0 && len(m.workflowGraph.Chains) == 0 {
		return m.panelSingle("Workflows", "No workflows detected in this run.")
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
		list += "\nActive section: Pairwise\n"
	} else {
		list += "\nActive section: Chains\n"
	}

	list += "\nPairwise kind buckets\n"
	edgeBuckets := topCounts(edgeKinds, 6)
	totalEdges := len(m.workflowGraph.Edges)
	for i, item := range edgeBuckets {
		prefix := " "
		if m.workflowSection == 0 && i == m.workflowBucketIndex {
			prefix = styleSelection.Render(">")
		}
		list += fmt.Sprintf("%s %d) %-42s %4d (%2d%%)\n", prefix, i+1, item.key, item.count, percent(item.count, totalEdges))
	}

	list += "\nChain kind buckets\n"
	chainBuckets := topCounts(chainKinds, 6)
	totalChains := len(m.workflowGraph.Chains)
	for i, item := range chainBuckets {
		prefix := " "
		if m.workflowSection == 1 && i == m.workflowBucketIndex {
			prefix = styleSelection.Render(">")
		}
		list += fmt.Sprintf("%s %d) %-42s %4d (%2d%%)\n", prefix, i+1, item.key, item.count, percent(item.count, totalChains))
	}

	detail := ""
	if m.workflowDetailOpen {
		active := m.workflowActiveBuckets()
		if len(active) > 0 {
			selected := active[m.workflowBucketIndex].key
			if m.workflowSection == 0 {
				detail += fmt.Sprintf("Pairwise details for %s (up to 5)\n", selected)
				for _, line := range m.workflowEdgeDetails(selected, 5) {
					detail += fmt.Sprintf("- %s\n", line)
				}
			} else {
				detail += fmt.Sprintf("Chain details for %s (up to 5)\n", selected)
				for _, line := range m.workflowChainDetails(selected, 5) {
					detail += fmt.Sprintf("- %s\n", line)
				}
			}
		}
	} else {
		detail += styleMuted.Render("Tip: press enter (or d) on the active section bucket for details.") + "\n"
	}

	if len(m.chainScores) > 0 {
		avg := averageChainScoresByKind(m.workflowGraph.Chains, m.chainScores)
		list += "\nChain score summary\n"
		for _, item := range topCounts(chainKinds, 4) {
			a, ok := avg[item.key]
			if !ok {
				continue
			}
			list += fmt.Sprintf("- %s: %d/%d/%d\n", item.key, a.ui, a.schema, a.client)
		}
	}

	if m.workflowItemDetailOpen {
		detail += "\nWorkflow item detail\n"
		detail += m.viewWorkflowItemDetail()
	}

	if strings.TrimSpace(detail) == "" {
		detail = styleMuted.Render("No detail selected yet. Use Enter for bucket preview or o for item detail.")
	}
	return m.panelSplit("Workflow buckets", list, "Workflow detail", detail)
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
		return m.panelSingle("Diff", "No diff data available for this run. Use --old and --new to populate this screen.")
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

	return m.panelSingle("Diff", out)
}

func (m Model) panelSingle(title, content string) string {
	width := 100
	body := stylePanelTitle.Render(title) + "\n\n" + strings.TrimRight(content, "\n")
	return stylePanel.Width(width).Render(body)
}

func (m Model) panelSplit(leftTitle, left, rightTitle, right string) string {
	leftPanel := stylePanel.Width(58).Render(stylePanelTitle.Render(leftTitle) + "\n\n" + strings.TrimRight(left, "\n"))
	rightPanel := stylePanel.Width(42).Render(stylePanelTitle.Render(rightTitle) + "\n\n" + strings.TrimRight(right, "\n"))
	return lipgloss.JoinHorizontal(lipgloss.Top, leftPanel, rightPanel)
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
	next := m.hotspotIndex + delta
	if next < 0 {
		next = 0
	}
	if next >= len(items) {
		next = len(items) - 1
	}
	m.hotspotIndex = next
}

func hotspotKindLabel(kind string) string {
	switch kind {
	case "finding-bucket":
		return "finding group"
	case "endpoint-family":
		return "endpoint family"
	case "workflow-kind":
		return "workflow family"
	case "chain-kind":
		return "chain family"
	default:
		return kind
	}
}

func hotspotMetricLabel(value string) string {
	v := strings.TrimSpace(value)
	v = strings.ReplaceAll(v, "count=", "affected=")
	v = strings.ReplaceAll(v, "avg-risk=", "avg-risk=")
	v = strings.ReplaceAll(v, "avg-score=", "avg-score=")
	return v
}

func hotspotMetricExplanation(value string) string {
	v := strings.TrimSpace(value)
	if strings.HasPrefix(v, "count=") {
		return "Count is how many findings in this grouped issue category were detected."
	}
	if strings.HasPrefix(v, "avg-risk=") {
		return "Average risk is the mean endpoint risk score for this path family. Higher means more score gaps and/or repeated findings."
	}
	if strings.HasPrefix(v, "avg-score=") {
		return "Average score is the mean workflow or chain score across this family. Lower averages indicate weaker automation clarity."
	}
	return "This value is a summary metric for the selected hotspot family."
}

func (m Model) endpointOperations() []*model.Operation {
	if m.analysis == nil {
		return nil
	}
	ops := append([]*model.Operation(nil), m.analysis.Operations...)
	sort.Slice(ops, func(i, j int) bool {
		if m.endpointSortMode == endpointSortRisk {
			leftRisk := m.endpointRiskScore(ops[i])
			rightRisk := m.endpointRiskScore(ops[j])
			if leftRisk != rightRisk {
				return leftRisk > rightRisk
			}
			leftFindings := len(m.allFindingsForOperation(ops[i]))
			rightFindings := len(m.allFindingsForOperation(ops[j]))
			if leftFindings != rightFindings {
				return leftFindings > rightFindings
			}
		}
		leftPath := ops[i].Path
		rightPath := ops[j].Path
		if leftPath != rightPath {
			return leftPath < rightPath
		}
		return strings.ToUpper(ops[i].Method) < strings.ToUpper(ops[j].Method)
	})
	return ops
}

func (m Model) endpointSortLabel() string {
	if m.endpointSortMode == endpointSortRisk {
		return "risk-first"
	}
	return "path"
}

func (m Model) endpointScoreTriples(limit int) []kvCount {
	ops := m.endpointOperations()
	counts := map[string]int{}
	for _, op := range ops {
		counts[m.endpointScoreSummary(op)]++
	}
	return topCounts(counts, limit)
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

func (m Model) findingIssuesByCode(code string) []*model.Issue {
	if m.analysis == nil {
		return nil
	}
	issues := make([]*model.Issue, 0)
	for _, issue := range m.analysis.Issues {
		if issue.Code == code {
			issues = append(issues, issue)
		}
	}
	sort.Slice(issues, func(i, j int) bool {
		if issues[i].Path != issues[j].Path {
			return issues[i].Path < issues[j].Path
		}
		return strings.ToLower(issues[i].Operation) < strings.ToLower(issues[j].Operation)
	})
	return issues
}

func (m Model) findingSummary(code string) string {
	issues := m.findingIssuesByCode(code)
	for _, issue := range issues {
		if strings.TrimSpace(issue.Description) != "" {
			return truncate(strings.TrimSpace(issue.Description), 120)
		}
	}
	for _, issue := range issues {
		if strings.TrimSpace(issue.Message) != "" {
			return truncate(strings.TrimSpace(issue.Message), 120)
		}
	}
	return "No summary text available for this finding code."
}

func (m Model) findingWhyItMatters(code string) string {
	issues := m.findingIssuesByCode(code)
	for _, issue := range issues {
		if strings.TrimSpace(issue.Description) != "" {
			return truncate(strings.TrimSpace(issue.Description), 180)
		}
	}
	if len(issues) > 0 {
		return "This finding appears repeatedly and can reduce schema clarity and integration confidence if left unresolved."
	}
	return "No impact summary available."
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
