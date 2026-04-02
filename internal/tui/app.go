package tui

import (
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

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
	width int
	height int
	detailScroll int
	filterText string
	filterMode bool
	filterInput string

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
	Filter    key.Binding
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
		Filter: key.NewBinding(
			key.WithKeys("/"),
			key.WithHelp("/", "filter"),
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
	return []key.Binding{k.NavUp, k.NavDown, k.Select, k.FocusPane, k.Open, k.Close, k.Filter, k.QuickJump, k.Quit}
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
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil
	case tea.KeyMsg:
		if m.filterMode {
			switch msg.Type {
			case tea.KeyEsc:
				m.filterMode = false
				m.filterInput = ""
				m.filterText = ""
				m.resetScreenSelectionAfterFilter()
				return m, nil
			case tea.KeyEnter:
				m.filterMode = false
				m.filterText = strings.TrimSpace(m.filterInput)
				m.filterInput = ""
				m.resetScreenSelectionAfterFilter()
				return m, nil
			case tea.KeyBackspace:
				if len(m.filterInput) > 0 {
					_, size := utf8.DecodeLastRuneInString(m.filterInput)
					m.filterInput = m.filterInput[:len(m.filterInput)-size]
				}
				return m, nil
			case tea.KeyCtrlH:
				if len(m.filterInput) > 0 {
					_, size := utf8.DecodeLastRuneInString(m.filterInput)
					m.filterInput = m.filterInput[:len(m.filterInput)-size]
				}
				return m, nil
			case tea.KeyRunes:
				m.filterInput += string(msg.Runes)
				return m, nil
			default:
				return m, nil
			}
		}

		if key.Matches(msg, m.keys.Quit) {
			return m, tea.Quit
		}

		if key.Matches(msg, m.keys.Filter) {
			m.filterMode = true
			m.filterInput = m.filterText
			return m, nil
		}

		if m.focusPane == paneDetail {
			_, _, _, detailBody := m.currentPaneBodies()
			maxScroll := m.maxDetailScroll(detailBody)
			switch msg.String() {
			case "up", "k":
				if m.detailScroll > 0 {
					m.detailScroll--
				}
				return m, nil
			case "down", "j":
				if m.detailScroll < maxScroll {
					m.detailScroll++
				}
				return m, nil
			case "pgup":
				m.detailScroll -= m.detailViewportHeight() / 2
				if m.detailScroll < 0 {
					m.detailScroll = 0
				}
				return m, nil
			case "pgdown":
				m.detailScroll += m.detailViewportHeight() / 2
				if m.detailScroll > maxScroll {
					m.detailScroll = maxScroll
				}
				return m, nil
			case "home":
				m.detailScroll = 0
				return m, nil
			case "end":
				m.detailScroll = maxScroll
				return m, nil
			}
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
					m.detailScroll = 0
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
					m.detailScroll = 0
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
				if len(m.filteredEndpointOperations()) > 0 {
					m.endpointDetailOpen = !m.endpointDetailOpen
					m.detailScroll = 0
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
			m.setActive(m.stepScreen(-1))
		case "]", "l":
			m.setActive(m.stepScreen(1))
		case "home":
			m.setActive(m.firstAvailableScreen())
		case "end":
			m.setActive(m.lastAvailableScreen())
		case "1", "2", "3", "4", "5", "6":
			if target, ok := m.quickJumpScreen(msg.String()); ok {
				m.setActive(target)
				switch target {
				case screenEndpoints:
					m.endpointDetailOpen = false
				case screenFindings:
					m.findingsDetailOpen = false
				case screenWorkflows:
					m.workflowDetailOpen = false
					m.workflowItemDetailOpen = false
				}
			}
		}
	}
	return m, nil
}

func (m Model) View() string {
	header := styleHeader.Render(strings.Join([]string{
		styleTitle.Render("api-doctor dashboard"),
		fmt.Sprintf("Section: %s | %s", m.activeTitle(), styleFocusBadge.Render("Focus: "+m.focusTitle())),
		fmt.Sprintf("Filter: %s", m.filterStatusText()),
		m.dataStatusLine(),
	}, "\n"))

	mainTitle, mainBody, detailTitle, detailBody := m.currentPaneBodies()
	layout := lipgloss.JoinHorizontal(lipgloss.Top,
		m.viewSidebar(),
		m.renderPane(mainTitle, mainBody, paneMain, 54),
		m.renderPane(detailTitle, detailBody, paneDetail, 46),
	)
	footer := styleFooter.Render(strings.Join([]string{
		"Move focus: Left/Right or Tab   |   Navigate list: Up/Down   |   Filter: /",
		"Open/select: Enter   |   Drill-down: o / d   |   Detail scroll: Up/Down, PgUp/PgDn   |   Close detail: Esc   |   Quit: q",
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
	if !m.isScreenAvailable(s) {
		s = m.firstAvailableScreen()
	}
	m.active = s
	m.menuIndex = int(s)
	m.detailScroll = 0
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
	items := make([]menuItem, 0, 6)
	for _, s := range m.availableScreens() {
		items = append(items, menuItem{id: s, label: m.screenLabel(s)})
	}
	return items
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
	if p == paneDetail {
		body = m.renderDetailViewport(body)
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
		main += fmt.Sprintf("Total burden/consistency/risk signals detected: %d\n", len(m.analysis.Issues))
		errCount := countSeverity(m.analysis.Issues, "error")
		warnCount := countSeverity(m.analysis.Issues, "warning")
		infoCount := countSeverity(m.analysis.Issues, "info")
		if infoCount > 0 {
			main += fmt.Sprintf("Signals by severity: errors %d, warnings %d, informational %d\n", errCount, warnCount, infoCount)
		} else {
			main += fmt.Sprintf("Signals by severity: errors %d, warnings %d\n", errCount, warnCount)
		}
	}
	if m.workflowGraph != nil {
		main += fmt.Sprintf("Single-step workflow handoffs found: %d\n", len(m.workflowGraph.Edges))
		main += fmt.Sprintf("Multi-step workflow paths found: %d\n", len(m.workflowGraph.Chains))
	}
	fixFirst := m.fixFirstSummaryLines()
	if len(fixFirst) > 0 {
		main += "\nFix first (deterministic snapshot)\n"
		for _, line := range fixFirst {
			main += fmt.Sprintf("- %s\n", line)
		}
	}
	detail := "This overview summarizes workflow burden, contract-shape burden, endpoint consistency outliers, and change-risk context from the API spec.\n\nUse the left menu to inspect each area in plain detail."
	return "Overview", main, "What these numbers mean", detail
}

func (m Model) paneHotspots() (string, string, string, string) {
	items := m.hotspotItems()
	if len(items) == 0 {
		if strings.TrimSpace(m.activeFilterText()) != "" {
			return "Hotspots", "No hotspots match the current filter.", "Detail", "Press / and then Esc to clear filter."
		}
		return "Hotspots", "No hotspot data available.", "Detail", "Provide --spec to populate this section."
	}
	idx := wrapIndex(m.hotspotIndex, len(items))
	list := fmt.Sprintf("Top hotspots shown: %d (ranked summary, not every issue) | Selected: %d/%d\n\n", len(items), idx+1, len(items))
	list += m.screenFilterBanner("Hotspots")
	list += "Move with Up/Down. Press Enter or o to open related detail.\n\n"
	for i, item := range items {
		prefix := " "
		if i == idx {
			prefix = styleSelection.Render(">")
		}
		riskText := styleWarn.Render(fmt.Sprintf("priority:%3d", item.risk))
		if item.risk >= 10 {
			riskText = styleBad.Render(fmt.Sprintf("priority:%3d", item.risk))
		}
		row := fmt.Sprintf("%s %2d) %-16s %-30s %s %s", prefix, i+1, hotspotKindLabel(item.kind), truncate(hotspotDisplayLabel(item), 30), riskText, hotspotMetricLabel(item.value))
		if i == idx {
			row = styleRowSelected.Render(row)
		}
		list += row + "\n"
	}
	sel := items[idx]
	detail := fmt.Sprintf("Type: %s\nLabel: %s\nMetric: %s\n\nWhat this metric means:\n%s\n\nWhy this is ranked high:\n%s\n\n", hotspotKindLabel(sel.kind), hotspotDisplayLabel(sel), hotspotMetricLabel(sel.value), hotspotMetricExplanation(sel.value), sel.detail)
	if (sel.kind == "finding-bucket" || sel.kind == "consistency-bucket") && isConsistencyFindingCode(sel.label) {
		detail += fmt.Sprintf("Consistency problem: yes\n\nHow to read this:\n%s\n\n", consistencyFindingExplanation(sel.label))
	}
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
	ops := m.filteredEndpointOperations()
	if len(ops) == 0 {
		if strings.TrimSpace(m.activeFilterText()) != "" {
			return "Endpoints", "No endpoints match the current filter.", "Detail", "Press / and then Esc to clear filter."
		}
		return "Endpoints", "No endpoints were parsed from this spec.", "Detail", "No detail available."
	}
	idx := wrapIndex(m.endpointIndex, len(ops))
	list := fmt.Sprintf("Total endpoints: %d | Selected: %d/%d\n", len(ops), idx+1, len(ops))
	list += m.screenFilterBanner("Endpoints")
	list += fmt.Sprintf("Sort: %s (press r to toggle)\n", m.endpointSortLabel())
	list += "Quality score dimensions: schema completeness / client generation / versioning safety (1=low, 5=high)\n"
	triples := m.endpointScoreTriples(3)
	if len(triples) > 0 {
		parts := make([]string, 0, len(triples))
		for _, item := range triples {
			parts = append(parts, fmt.Sprintf("%s on %d endpoints", item.key, item.count))
		}
		list += fmt.Sprintf("Most common quality profiles: %s\n", strings.Join(parts, "; "))
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
		row := fmt.Sprintf("%s %3d) %-6s %-28s issues:%-2d quality:%-5s priority:%-2d", prefix, i+1, strings.ToUpper(op.Method), truncate(op.Path, 28), findings, score, risk)
		if i == idx {
			row = styleRowSelected.Render(row)
		}
		list += row + "\n"
	}

	detail := styleMuted.Render("Press Enter or d in Main pane to open endpoint detail.\nRows show issue count, quality score, and priority ranking to help you spot weaker endpoints first.")
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
		nextCalls := m.likelyNextCallsForOperation(op, 3)
		if len(matches) == 0 {
			detail += "Matching findings: none\n"
		} else {
			detail += "Matching findings:\n"
			for _, issue := range matches {
				label := endpointFindingLabel(issue.Code)
				if isConsistencyFindingCode(issue.Code) {
					label = "consistency: " + endpointFindingLabel(issue.Code)
				}
				detail += fmt.Sprintf("- [%s/%s] %s\n", issue.Severity, label, strings.TrimSpace(issue.Message))
			}
		}

		burdenFindings := m.findingsByCodeForOperation(op, "prerequisite-task-burden")
		detail += "\nTask burden signal:\n"
		if len(burdenFindings) == 0 {
			detail += "- none detected for this endpoint\n"
		} else {
			detail += "- this task likely requires extra prerequisite coordination\n"
			detail += fmt.Sprintf("- evidence: %s\n", strings.TrimSpace(burdenFindings[0].Message))
		}

		contractShapeFindings := m.findingsByCodeForOperation(op, "contract-shape-workflow-guidance-burden")
		detail += "\nContract-shape burden signal:\n"
		if len(contractShapeFindings) == 0 {
			detail += "- none detected for this endpoint\n"
		} else {
			detail += "- this response appears more workflow-heavy than task-focused\n"
			detail += fmt.Sprintf("- evidence: %s\n", strings.TrimSpace(contractShapeFindings[0].Message))
		}

		detail += "\nLikely next calls:\n"
		if len(nextCalls) == 0 {
			detail += "- none detected from deterministic workflow links\n"
		} else {
			for _, next := range nextCalls {
				reason := strings.TrimSpace(next.reason)
				if reason == "" {
					reason = "detected workflow link"
				}
				detail += fmt.Sprintf("- %s %s (%s)\n", strings.ToUpper(next.method), next.path, reason)
			}
		}

		detail += "\nRequired identifiers:\n"
		required := m.requiredIdentifiersByNextCall(nextCalls)
		if len(required) == 0 {
			detail += "- none for detected next calls\n"
		} else {
			for _, line := range required {
				detail += fmt.Sprintf("- %s\n", line)
			}
		}

		detail += fmt.Sprintf("\nLinkage status: %s\n", m.endpointIdentifierLinkageStatus(op))
		sequence := m.suggestedCallSequence(op)
		if sequence != "" {
			detail += fmt.Sprintf("Suggested call sequence: %s\n", sequence)
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
		if strings.TrimSpace(m.activeFilterText()) != "" {
			return "Findings", "No finding buckets match the current filter.", "Detail", "Press / and then Esc to clear filter."
		}
		return "Findings", "No findings detected in this run.", "Detail", "No detail available."
	}
	idx := wrapIndex(m.findingsBucketIndex, len(buckets))
	main := fmt.Sprintf("Total findings: %d | Buckets: %d\n\n", len(m.filteredFindingIssues()), len(buckets))
	main += m.screenFilterBanner("Findings")
	taskBurdenTotal := len(m.findingIssuesByCode("prerequisite-task-burden"))
	if taskBurdenTotal > 0 {
		main += fmt.Sprintf("Task burden signals flagged: %d endpoints\n", taskBurdenTotal)
		main += "Look for rows marked with [task burden].\n\n"
	}
	contractShapeTotal := len(m.findingIssuesByCode("contract-shape-workflow-guidance-burden"))
	if contractShapeTotal > 0 {
		main += fmt.Sprintf("Contract-shape burden signals flagged: %d endpoints\n", contractShapeTotal)
		main += "Look for rows marked with [workflow burden].\n\n"
	}
	consistencyTotal, consistencyCategories := m.consistencyFindingCounts()
	if consistencyTotal > 0 {
		main += fmt.Sprintf("Consistency checks flagged: %d findings across %d categories\n", consistencyTotal, consistencyCategories)
		main += "Look for rows marked with [consistency].\n\n"
	}
	for i, b := range buckets {
		prefix := " "
		if i == idx {
			prefix = styleSelection.Render(">")
		}
		label := findingBucketLabel(b.key)
		row := fmt.Sprintf("%s %2d) %-40s %4d", prefix, i+1, label, b.count)
		if i == idx {
			row = styleRowSelected.Render(row)
		}
		main += row + "\n"
	}
	detail := styleMuted.Render("Press Enter or d in Main pane to preview finding details.\nPress o to jump to endpoint detail.")
	if m.findingsDetailOpen {
		code := buckets[idx].key
		issues := m.findingIssuesByCode(code)
		detail = fmt.Sprintf("Issue category: %s\n", findingCategoryLabel(code))
		detail += fmt.Sprintf("Rule code: %s\n", code)
		if isConsistencyFindingCode(code) {
			detail += "Category type: consistency problem\n"
			detail += fmt.Sprintf("Consistency meaning: %s\n", consistencyFindingExplanation(code))
		} else if isTaskBurdenFindingCode(code) {
			detail += "Category type: task burden signal\n"
			detail += "Task burden meaning: This task appears to require extra prerequisite coordination to complete a basic flow.\n"
		} else if isContractShapeBurdenFindingCode(code) {
			detail += "Category type: workflow/contract burden signal\n"
			detail += "Contract-shape meaning: Responses may look snapshot-heavy and may not clearly show task outcomes or next actions.\n"
		}
		detail += "\n"
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
			detail += fmt.Sprintf("- %s\n  %s\n", endpoint, strings.TrimSpace(issue.Message))
		}
		detail += "\nWhy it matters:\n"
		detail += fmt.Sprintf("%s\n", m.findingWhyItMatters(code))
		if len(issues) > exampleLimit {
			detail += fmt.Sprintf("\nMore items: %d additional endpoints are hidden here. Use JSON output for full details.\n", len(issues)-exampleLimit)
		}
	}
	return "Issue categories", main, "Issue category detail", detail
}

func (m Model) paneWorkflows() (string, string, string, string) {
	if m.workflowGraph == nil {
		return "Workflows", "No workflow data available.", "Detail", "Provide --spec to populate this section."
	}
	edges := m.filteredWorkflowEdges()
	chains := m.filteredWorkflowChains()
	main := fmt.Sprintf("Single-step workflow handoffs found: %d\nMulti-step workflow paths found: %d\n\n", len(edges), len(chains))
	main += m.screenFilterBanner("Workflows")
	if m.workflowSection == 0 {
		main += "Workflow pattern types (single-step):\n\n"
	} else {
		main += "Workflow pattern types (multi-step):\n\n"
	}
	buckets := m.workflowActiveBuckets()
	if len(buckets) == 0 {
		if strings.TrimSpace(m.activeFilterText()) != "" {
			return "Workflows", main + "No workflow buckets match the current filter.", "Workflow detail", "Press / and then Esc to clear filter."
		}
		return "Workflows", main + "No workflow buckets available.", "Workflow detail", "No detail available."
	}
	idx := wrapIndex(m.workflowBucketIndex, len(buckets))
	for i, b := range buckets {
		prefix := " "
		if i == idx {
			prefix = styleSelection.Render(">")
		}
		expl := workflowKindExample(b.key)
		row := fmt.Sprintf("%s %2d) %-22s %4d  %s", prefix, i+1, workflowKindLabel(b.key), b.count, truncate(expl, 34))
		if i == idx {
			row = styleRowSelected.Render(row)
		}
		main += row + "\n"
	}
	main += "\nOnly pattern types detected in this spec are listed. Use w/s to switch single-step and multi-step patterns."

	detail := styleMuted.Render("Press Enter or d for bucket preview.\nPress o for workflow/chain item detail.")
	if m.workflowDetailOpen {
		detail = fmt.Sprintf("Pattern: %s\n\n", workflowKindLabel(buckets[idx].key))
		detail += fmt.Sprintf("What this pattern means: %s\n\n", workflowKindExplanation(buckets[idx].key))
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
		return "POST /products -> GET /products/{id}"
	case "list-to-detail":
		return "GET /products -> GET /products/{id}"
	case "action-to-detail":
		return "POST /_action/order/... -> GET /order/{id}"
	case "accepted-to-tracking":
		return "POST /sync (202) -> GET /sync/status/{id}"
	default:
		return "detected workflow pattern"
	}
}

func workflowKindLabel(kind string) string {
	switch kind {
	case "create-to-detail":
		return "Create -> detail"
	case "list-to-detail":
		return "List -> detail"
	case "action-to-detail":
		return "Action -> detail"
	case "accepted-to-tracking":
		return "Accepted -> status tracking"
	default:
		return kind
	}
}

func workflowKindExplanation(kind string) string {
	switch kind {
	case "create-to-detail":
		return "Create flow where the response links to a follow-up detail read. Example: POST /products -> GET /products/{id}."
	case "list-to-detail":
		return "Browse flow where a list/search endpoint links to per-item detail reads. Example: GET /products -> GET /products/{id}."
	case "action-to-detail":
		return "Action flow where a state-changing endpoint links to a detail endpoint for verification."
	case "accepted-to-tracking":
		return "Async flow where an accepted response should expose tracking for later status checks."
	default:
		return "A detected workflow pattern grouped by type."
	}
}

func (m Model) paneDiff() (string, string, string, string) {
	if m.diffResult == nil {
		main := "Diff mode is currently inactive.\n\nThis TUI session was started without --old and --new inputs."
		detail := "Diff compares two versions of an API spec: an older file and a newer file.\n\nWhere to get the older file: from your previous release branch, a tagged version snapshot, or a saved local copy.\n\nLaunch example:\napi-doctor tui --spec ./adminapi.json --old ./adminapi-v1.json --new ./adminapi-v2.json\n\nAfter relaunching with both files, this tab will show detected breaking changes between those versions."
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
	labels := make([]string, 0, 6)
	for i, s := range m.availableScreens() {
		labels = append(labels, m.tabLabel(s, fmt.Sprintf("%d %s", i+1, m.screenLabel(s))))
	}
	return strings.Join(labels, "  ")
}

func (m Model) tabLabel(s screen, label string) string {
	if m.active == s {
		return styleSelection.Render("[" + label + "]")
	}
	return styleMuted.Render(label)
}

func (m Model) availableScreens() []screen {
	screens := []screen{screenOverview, screenHotspots, screenEndpoints, screenFindings, screenWorkflows}
	if m.diffResult != nil {
		screens = append(screens, screenDiff)
	}
	return screens
}

func (m Model) isScreenAvailable(target screen) bool {
	for _, s := range m.availableScreens() {
		if s == target {
			return true
		}
	}
	return false
}

func (m Model) firstAvailableScreen() screen {
	screens := m.availableScreens()
	if len(screens) == 0 {
		return screenOverview
	}
	return screens[0]
}

func (m Model) lastAvailableScreen() screen {
	screens := m.availableScreens()
	if len(screens) == 0 {
		return screenOverview
	}
	return screens[len(screens)-1]
}

func (m Model) stepScreen(delta int) screen {
	screens := m.availableScreens()
	if len(screens) == 0 {
		return screenOverview
	}

	idx := 0
	for i, s := range screens {
		if s == m.active {
			idx = i
			break
		}
	}
	return screens[wrapIndex(idx+delta, len(screens))]
}

func (m Model) quickJumpScreen(key string) (screen, bool) {
	if len(key) != 1 || key[0] < '1' || key[0] > '9' {
		return screenOverview, false
	}
	idx := int(key[0] - '1')
	screens := m.availableScreens()
	if idx < 0 || idx >= len(screens) {
		return screenOverview, false
	}
	return screens[idx], true
}

func (m Model) screenLabel(s screen) string {
	switch s {
	case screenOverview:
		return "Overview"
	case screenHotspots:
		return "Hotspots"
	case screenEndpoints:
		return "Endpoints"
	case screenFindings:
		return "Issue categories"
	case screenWorkflows:
		return "Workflows"
	case screenDiff:
		return "Diff"
	default:
		return "Unknown"
	}
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
		return "Issue categories keys: up/down move category, enter or d details, o open endpoint, esc back"
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
		if strings.TrimSpace(m.activeFilterText()) != "" {
			return m.panelSingle("Hotspots", "No hotspots match the current filter. Press / and then Esc to clear filter.")
		}
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
	list += m.screenFilterBanner("Hotspots")
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
		list += fmt.Sprintf("%s %2d) %-14s %-40s %s %s\n", prefix, i+1, item.kind, truncate(hotspotDisplayLabel(item), 40), riskText, item.value)
	}

	sel := items[idx]
	detail := "Selected hotspot\n\n"
	detail += fmt.Sprintf("- Type: %s\n", sel.kind)
	detail += fmt.Sprintf("- Label: %s\n", hotspotDisplayLabel(sel))
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

	ops := m.filteredEndpointOperations()
	list := "Endpoints Browser\n\n"
	list += fmt.Sprintf("Total endpoints: %d\n", len(ops))
	list += m.screenFilterBanner("Endpoints")
	if len(ops) == 0 {
		if strings.TrimSpace(m.activeFilterText()) != "" {
			return m.panelSingle("Endpoints", "No endpoints match the current filter. Press / and then Esc to clear filter.")
		}
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
				detail += fmt.Sprintf("  - [%s/%s] %s\n", issue.Severity, endpointFindingLabel(issue.Code), truncate(issue.Message, 90))
			}
		}

		burdenFindings := m.findingsByCodeForOperation(op, "prerequisite-task-burden")
		if len(burdenFindings) == 0 {
			detail += "- Task burden signal: none\n"
		} else {
			detail += "- Task burden signal: likely extra prerequisite coordination\n"
			detail += fmt.Sprintf("  - Evidence: %s\n", truncate(burdenFindings[0].Message, 100))
		}

		contractShapeFindings := m.findingsByCodeForOperation(op, "contract-shape-workflow-guidance-burden")
		if len(contractShapeFindings) == 0 {
			detail += "- Contract-shape burden signal: none\n"
		} else {
			detail += "- Contract-shape burden signal: response appears workflow-heavy vs task-focused\n"
			detail += fmt.Sprintf("  - Evidence: %s\n", truncate(contractShapeFindings[0].Message, 100))
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
		out += "\nSignal Severity\n"
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
	filteredIssues := m.filteredFindingIssues()
	out += fmt.Sprintf("Total findings: %d\n\n", len(filteredIssues))
	out += m.screenFilterBanner("Findings")
	if len(filteredIssues) == 0 {
		if strings.TrimSpace(m.activeFilterText()) != "" {
			out += "No findings match the current filter.\n"
			return out
		}
		out += "No findings detected in this run.\n"
		return out
	}

	summary := map[string]int{}
	codes := map[string]int{}
	for _, issue := range filteredIssues {
		summary[issue.Severity]++
		codes[issue.Code]++
	}
	out += fmt.Sprintf("Errors: %d\n", summary["error"])
	out += fmt.Sprintf("Warnings: %d\n", summary["warning"])
	out += fmt.Sprintf("Info: %d\n", summary["info"])
	taskBurdenCount := codes["prerequisite-task-burden"]
	if taskBurdenCount > 0 {
		out += fmt.Sprintf("Task burden signals: %d\n", taskBurdenCount)
	}

	out += "\nTop finding code buckets\n"
	buckets := m.findingCodeBuckets()
	total := len(filteredIssues)
	for i, item := range buckets {
		prefix := " "
		if i == m.findingsBucketIndex {
			prefix = ">"
		}
		pct := percent(item.count, total)
		out += fmt.Sprintf("%s %d) %-42s %4d (%2d%%)\n", prefix, i+1, findingBucketLabel(item.key), item.count, pct)
	}

	if m.findingsDetailOpen && len(buckets) > 0 {
		selected := buckets[m.findingsBucketIndex].key
		out += fmt.Sprintf("\nDetails for %s (up to 5)\n", findingDisplayName(selected))
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

	edges := m.filteredWorkflowEdges()
	chains := m.filteredWorkflowChains()
	list := "Workflows Summary\n\n"
	list += fmt.Sprintf("Total pairwise workflows: %d\n", len(edges))
	list += fmt.Sprintf("Total multi-step chains:  %d\n", len(chains))
	list += "\n" + m.screenFilterBanner("Workflows")
	if len(edges) == 0 && len(chains) == 0 {
		if strings.TrimSpace(m.activeFilterText()) != "" {
			return m.panelSingle("Workflows", "No workflows match the current filter. Press / and then Esc to clear filter.")
		}
		return m.panelSingle("Workflows", "No workflows detected in this run.")
	}

	edgeKinds := map[string]int{}
	for _, edge := range edges {
		edgeKinds[edge.Kind]++
	}
	chainKinds := map[string]int{}
	for _, chain := range chains {
		chainKinds[chain.Kind]++
	}

	if m.workflowSection == 0 {
		list += "\nActive section: Pairwise\n"
	} else {
		list += "\nActive section: Chains\n"
	}

	list += "\nPairwise kind buckets\n"
	edgeBuckets := topCounts(edgeKinds, 6)
	totalEdges := len(edges)
	for i, item := range edgeBuckets {
		prefix := " "
		if m.workflowSection == 0 && i == m.workflowBucketIndex {
			prefix = styleSelection.Render(">")
		}
		list += fmt.Sprintf("%s %d) %-42s %4d (%2d%%)\n", prefix, i+1, item.key, item.count, percent(item.count, totalEdges))
	}

	list += "\nChain kind buckets\n"
	chainBuckets := topCounts(chainKinds, 6)
	totalChains := len(chains)
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
	m.detailScroll = 0
}

func (m *Model) endpointMove(delta int) {
	ops := m.filteredEndpointOperations()
	if len(ops) == 0 {
		m.endpointIndex = 0
		m.endpointDetailOpen = false
		return
	}
	m.endpointIndex = wrapIndex(m.endpointIndex+delta, len(ops))
	m.endpointDetailOpen = false
	m.detailScroll = 0
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
	m.detailScroll = 0
}

func hotspotKindLabel(kind string) string {
	switch kind {
	case "finding-bucket":
		return "issue category"
	case "consistency-bucket":
		return "consistency issue"
	case "endpoint-family":
		return "endpoint area"
	case "workflow-kind":
		return "workflow pattern"
	case "chain-kind":
		return "multi-step pattern"
	default:
		return kind
	}
}

func hotspotMetricLabel(value string) string {
	v := strings.TrimSpace(value)
	v = strings.ReplaceAll(v, "count=", "issues=")
	v = strings.ReplaceAll(v, "avg-risk=", "avg-priority=")
	v = strings.ReplaceAll(v, "avg-score=", "avg-quality=")
	return v
}

func hotspotMetricExplanation(value string) string {
	v := strings.TrimSpace(value)
	if strings.HasPrefix(v, "count=") {
		return "How many times this issue category appears in the analyzed spec."
	}
	if strings.HasPrefix(v, "avg-risk=") {
		return "Average priority across endpoints in this area. Higher usually means lower quality scores and/or more repeated issues."
	}
	if strings.HasPrefix(v, "avg-score=") {
		return "Average workflow quality score for this pattern. Lower values indicate weaker schema/automation clarity."
	}
	return "This value is a summary metric for the selected hotspot family."
}

func hotspotDisplayLabel(item hotspotItem) string {
	if item.kind == "finding-bucket" || item.kind == "consistency-bucket" {
		return hotspotFindingLabel(item.label)
	}
	return item.label
}

func hotspotFindingLabel(code string) string {
	if isContractShapeBurdenFindingCode(code) {
		return "Contract-shape workflow burden signal"
	}
	if isTaskBurdenFindingCode(code) {
		return "Prerequisite task burden signal"
	}
	return findingDisplayName(code)
}

func endpointFindingLabel(code string) string {
	if isContractShapeBurdenFindingCode(code) {
		return "contract-shape workflow burden signal"
	}
	if isTaskBurdenFindingCode(code) {
		return "task burden signal"
	}
	return findingDisplayName(code)
}

func findingBucketHotspotDetail(code string) string {
	if isContractShapeBurdenFindingCode(code) {
		return "Contract-shape workflow burden appears across multiple endpoints; some responses look snapshot-heavy or do not clearly show task outcomes."
	}
	if isTaskBurdenFindingCode(code) {
		return "Task burden appears across multiple endpoints, which can indicate extra prerequisite coordination before or after the main call."
	}
	return "Frequent issue category across endpoints, which suggests a repeated schema or usability gap."
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

func (m Model) filteredEndpointOperations() []*model.Operation {
	ops := m.endpointOperations()
	filter := m.activeFilterText()
	if filter == "" {
		return ops
	}
	filtered := make([]*model.Operation, 0, len(ops))
	for _, op := range ops {
		if op == nil {
			continue
		}
		combined := strings.Join([]string{strings.ToUpper(op.Method), op.Path, op.OperationID, op.Summary}, " ")
		if containsFold(combined, filter) {
			filtered = append(filtered, op)
		}
	}
	return filtered
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

func (m Model) findingsByCodeForOperation(op *model.Operation, code string) []*model.Issue {
	if op == nil || m.analysis == nil || strings.TrimSpace(code) == "" {
		return nil
	}
	out := make([]*model.Issue, 0)
	for _, issue := range m.analysis.Issues {
		if issue.Path != op.Path || issue.Code != code {
			continue
		}
		out = append(out, issue)
	}
	return out
}

func isTaskBurdenFindingCode(code string) bool {
	return strings.TrimSpace(code) == "prerequisite-task-burden"
}

func isContractShapeBurdenFindingCode(code string) bool {
	return strings.TrimSpace(code) == "contract-shape-workflow-guidance-burden"
}

func findingDisplayName(code string) string {
	if isTaskBurdenFindingCode(code) {
		return "prerequisite-task-burden (task burden signal)"
	}
	if isContractShapeBurdenFindingCode(code) {
		return "contract-shape-workflow-guidance-burden (contract shape burden signal)"
	}
	return code
}

func findingBucketLabel(code string) string {
	if isConsistencyFindingCode(code) {
		return "[consistency] " + findingCategoryLabel(code)
	}
	if isTaskBurdenFindingCode(code) {
		return "[task burden] " + findingCategoryLabel(code)
	}
	if isContractShapeBurdenFindingCode(code) {
		return "[workflow burden] " + findingCategoryLabel(code)
	}
	return findingCategoryLabel(code)
}

func findingCategoryLabel(code string) string {
	if isContractShapeBurdenFindingCode(code) {
		return "Contract-shape workflow burden signal"
	}
	if isTaskBurdenFindingCode(code) {
		return "Task burden signal"
	}
	return findingDisplayName(code)
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
		consistencyCodes := map[string]int{}
		codeOp := map[string]*model.Operation{}
		for _, issue := range m.analysis.Issues {
			if isConsistencyFindingCode(issue.Code) {
				consistencyCodes[issue.Code]++
			} else {
				codes[issue.Code]++
			}
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
				detail: findingBucketHotspotDetail(item.key),
				operation: codeOp[item.key],
			})
		}
		for _, item := range topCounts(consistencyCodes, 3) {
			items = append(items, hotspotItem{
				kind:      "consistency-bucket",
				label:     item.key,
				value:     fmt.Sprintf("count=%d", item.count),
				risk:      item.count*4 + 2,
				detail:    "Repeated endpoint consistency problem; this can make API behavior harder to predict across similar routes.",
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
					detail:    "This endpoint area combines weaker quality scores and/or repeated issue categories.",
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
					detail: "Lower workflow quality here can indicate weak linkage or continuity between related endpoints.",
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
					detail: "Lower multi-step workflow quality can indicate brittle integration paths.",
				})
			}
		}
	}

	filter := m.activeFilterText()
	if filter != "" {
		filtered := make([]hotspotItem, 0, len(items))
		for _, item := range items {
			combined := strings.Join([]string{item.kind, hotspotDisplayLabel(item), item.value, item.detail}, " ")
			if containsFold(combined, filter) {
				filtered = append(filtered, item)
			}
		}
		items = filtered
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
			labels = append(labels, findingDisplayName(t.key))
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

type nextCallHint struct {
	method string
	path   string
	reason string
}

func pathParamNames(path string) []string {
	segments := strings.Split(path, "/")
	params := make([]string, 0)
	for _, segment := range segments {
		if strings.HasPrefix(segment, "{") && strings.HasSuffix(segment, "}") && len(segment) > 2 {
			params = append(params, strings.TrimSuffix(strings.TrimPrefix(segment, "{"), "}"))
		}
	}
	return params
}

func (m Model) likelyNextCallsForOperation(op *model.Operation, limit int) []nextCallHint {
	if op == nil || m.workflowGraph == nil || limit <= 0 {
		return nil
	}

	seen := map[string]bool{}
	hints := make([]nextCallHint, 0)

	for _, edge := range m.workflowGraph.Edges {
		if !nodeMatchesOperation(edge.From, op) {
			continue
		}
		key := strings.ToLower(edge.To.Method) + "|" + edge.To.Path
		if seen[key] {
			continue
		}
		seen[key] = true
		reason := strings.TrimSpace(edge.Reason)
		if reason == "" {
			reason = workflowKindLabel(edge.Kind)
		}
		hints = append(hints, nextCallHint{method: edge.To.Method, path: edge.To.Path, reason: reason})
		if len(hints) >= limit {
			return hints
		}
	}

	for _, chain := range m.workflowGraph.Chains {
		for i := 0; i < len(chain.Steps)-1; i++ {
			if !nodeMatchesOperation(chain.Steps[i].Node, op) {
				continue
			}
			next := chain.Steps[i+1].Node
			key := strings.ToLower(next.Method) + "|" + next.Path
			if seen[key] {
				continue
			}
			seen[key] = true
			reason := strings.TrimSpace(chain.Reason)
			if reason == "" {
				reason = "detected multi-step workflow link"
			}
			hints = append(hints, nextCallHint{method: next.Method, path: next.Path, reason: reason})
			if len(hints) >= limit {
				return hints
			}
		}
	}

	return hints
}

func (m Model) requiredIdentifiersByNextCall(calls []nextCallHint) []string {
	if len(calls) == 0 {
		return nil
	}
	out := make([]string, 0)
	for _, call := range calls {
		ids := pathParamNames(call.path)
		if len(ids) == 0 {
			out = append(out, fmt.Sprintf("%s %s: none", strings.ToUpper(call.method), call.path))
			continue
		}
		out = append(out, fmt.Sprintf("%s %s: %s", strings.ToUpper(call.method), call.path, strings.Join(ids, ", ")))
	}
	return out
}

func (m Model) endpointIdentifierLinkageStatus(op *model.Operation) string {
	if op == nil {
		return "identifier linkage unavailable"
	}
	for _, issue := range m.allFindingsForOperation(op) {
		switch issue.Code {
		case "weak-follow-up-linkage", "weak-list-detail-linkage", "weak-action-follow-up-linkage", "weak-accepted-tracking-linkage":
			return "identifier likely missing"
		}
	}
	return "identifier appears exposed by deterministic checks"
}

func (m Model) suggestedCallSequence(op *model.Operation) string {
	if op == nil {
		return ""
	}
	nextCalls := m.likelyNextCallsForOperation(op, 1)
	if len(nextCalls) == 0 {
		return ""
	}
	first := nextCalls[0]
	parts := []string{
		fmt.Sprintf("%s %s", strings.ToUpper(op.Method), op.Path),
		fmt.Sprintf("%s %s", strings.ToUpper(first.method), first.path),
	}

	firstOp := m.findOperationByMethodPath(first.method, first.path)
	if firstOp != nil {
		followOn := m.likelyNextCallsForOperation(firstOp, 1)
		if len(followOn) > 0 {
			next := followOn[0]
			if !strings.EqualFold(next.method, op.Method) || next.path != op.Path {
				parts = append(parts, fmt.Sprintf("%s %s", strings.ToUpper(next.method), next.path))
			}
		}
	}

	return strings.Join(parts, " -> ")
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

func (m Model) filteredWorkflowEdges() []workflow.Edge {
	if m.workflowGraph == nil {
		return nil
	}
	filter := m.activeFilterText()
	if filter == "" {
		return m.workflowGraph.Edges
	}
	filtered := make([]workflow.Edge, 0, len(m.workflowGraph.Edges))
	for _, edge := range m.workflowGraph.Edges {
		combined := strings.Join([]string{edge.Kind, edge.From.Method, edge.From.Path, edge.To.Method, edge.To.Path, edge.Reason}, " ")
		if containsFold(combined, filter) {
			filtered = append(filtered, edge)
		}
	}
	return filtered
}

func (m Model) filteredWorkflowChains() []workflow.Chain {
	if m.workflowGraph == nil {
		return nil
	}
	filter := m.activeFilterText()
	if filter == "" {
		return m.workflowGraph.Chains
	}
	filtered := make([]workflow.Chain, 0, len(m.workflowGraph.Chains))
	for _, chain := range m.workflowGraph.Chains {
		parts := []string{chain.Kind, chain.Reason}
		for _, step := range chain.Steps {
			parts = append(parts, step.Node.Method, step.Node.Path)
		}
		if containsFold(strings.Join(parts, " "), filter) {
			filtered = append(filtered, chain)
		}
	}
	return filtered
}

func (m Model) findingCodeBuckets() []kvCount {
	issues := m.filteredFindingIssues()
	if len(issues) == 0 {
		return nil
	}
	codes := map[string]int{}
	for _, issue := range issues {
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
	issues := make([]*model.Issue, 0)
	for _, issue := range m.filteredFindingIssues() {
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

func (m Model) filteredFindingIssues() []*model.Issue {
	if m.analysis == nil {
		return nil
	}
	filter := m.activeFilterText()
	if filter == "" {
		return m.analysis.Issues
	}
	filtered := make([]*model.Issue, 0, len(m.analysis.Issues))
	for _, issue := range m.analysis.Issues {
		if issue == nil {
			continue
		}
		combined := strings.Join([]string{issue.Code, issue.Path, issue.Operation, issue.Message, issue.Description}, " ")
		if containsFold(combined, filter) {
			filtered = append(filtered, issue)
		}
	}
	return filtered
}

func (m Model) findingSummary(code string) string {
	if isConsistencyFindingCode(code) {
		return consistencyFindingSummary(code)
	}
	if isTaskBurdenFindingCode(code) {
		return "Task likely requires too much prerequisite coordination before or after the main call."
	}
	if isContractShapeBurdenFindingCode(code) {
		return "Response appears storage-shaped and may not clearly communicate workflow outcome or next valid actions."
	}
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
	if isConsistencyFindingCode(code) {
		return consistencyFindingImpact(code)
	}
	if isTaskBurdenFindingCode(code) {
		return "Higher prerequisite burden can make simple product or order/media tasks feel like managing internal IDs and state handoffs."
	}
	if isContractShapeBurdenFindingCode(code) {
		return "Storage-shaped responses can force developers to infer what changed, which state is authoritative, and what they should do next."
	}
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
	m.detailScroll = 0
}

func (m Model) workflowActiveBuckets() []kvCount {
	return m.workflowBuckets(m.workflowSection)
}

func (m Model) workflowBuckets(section int) []kvCount {
	if section == 0 {
		kinds := map[string]int{}
		for _, edge := range m.filteredWorkflowEdges() {
				kinds[edge.Kind]++
		}
		return topCounts(kinds, 6)
	}
	kinds := map[string]int{}
	for _, chain := range m.filteredWorkflowChains() {
			kinds[chain.Kind]++
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
	for _, edge := range m.filteredWorkflowEdges() {
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
	for _, chain := range m.filteredWorkflowChains() {
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
				summary += " | " + chain.Reason
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

func (m *Model) resetScreenSelectionAfterFilter() {
	m.detailScroll = 0
	switch m.active {
	case screenEndpoints:
		m.endpointIndex = 0
		m.endpointDetailOpen = false
	case screenFindings:
		m.findingsBucketIndex = 0
		m.findingsDetailOpen = false
	case screenWorkflows:
		m.workflowBucketIndex = 0
		m.workflowDetailOpen = false
		m.workflowItemDetailOpen = false
	case screenHotspots:
		m.hotspotIndex = 0
	}
}

func (m Model) filterStatusText() string {
	if m.filterMode {
		return "typing: " + m.filterInput + "_"
	}
	if strings.TrimSpace(m.filterText) == "" {
		return "none (press /)"
	}
	return m.filterText
}

func (m Model) detailViewportHeight() int {
	if m.height <= 0 {
		return 20
	}
	h := m.height - 14
	if h < 6 {
		return 6
	}
	return h
}

func (m Model) maxDetailScroll(body string) int {
	lines := strings.Split(strings.ReplaceAll(body, "\r\n", "\n"), "\n")
	max := len(lines) - m.detailViewportHeight()
	if max < 0 {
		return 0
	}
	return max
}

func (m Model) renderDetailViewport(body string) string {
	lines := strings.Split(strings.ReplaceAll(body, "\r\n", "\n"), "\n")
	visible := m.detailViewportHeight()
	if len(lines) <= visible {
		return body
	}

	start := m.detailScroll
	if start < 0 {
		start = 0
	}
	maxStart := len(lines) - visible
	if maxStart < 0 {
		maxStart = 0
	}
	if start > maxStart {
		start = maxStart
	}
	end := start + visible
	if end > len(lines) {
		end = len(lines)
	}

	out := make([]string, 0, visible+2)
	if start > 0 {
		out = append(out, styleMuted.Render(fmt.Sprintf("↑ more (%d lines)", start)))
	}
	out = append(out, lines[start:end]...)
	if end < len(lines) {
		out = append(out, styleMuted.Render(fmt.Sprintf("↓ more (%d lines)", len(lines)-end)))
	}
	return strings.Join(out, "\n")
}

func containsFold(haystack, needle string) bool {
	if strings.TrimSpace(needle) == "" {
		return true
	}
	return strings.Contains(strings.ToLower(haystack), strings.ToLower(needle))
}

func (m Model) activeFilterText() string {
	return strings.TrimSpace(m.filterText)
}

func (m Model) screenFilterBanner(scope string) string {
	if strings.TrimSpace(scope) == "" {
		scope = "items"
	}

	if !m.filterMode && strings.TrimSpace(m.filterText) == "" {
		return ""
	}

	query := strings.TrimSpace(m.filterText)
	if m.filterMode {
		query = m.filterInput + "_"
	}
	if strings.TrimSpace(query) == "" {
		query = "..."
	}

	return fmt.Sprintf("Filtering %s by: %s (Esc clears filter)\n\n", scope, query)
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

func (m Model) fixFirstSummaryLines() []string {
	lines := make([]string, 0)

	if chaining := m.topChainingBlockers(2); len(chaining) > 0 {
		parts := make([]string, 0, len(chaining))
		for _, item := range chaining {
			parts = append(parts, fmt.Sprintf("%s (%d)", item.label, item.count))
		}
		lines = append(lines, "Workflow burden: "+strings.Join(parts, "; "))
	}

	if endpoints, families := m.contractShapeBurdenFootprint(); endpoints > 0 {
		scope := "across multiple families"
		if families == 1 {
			scope = "within one family"
		}
		lines = append(lines, fmt.Sprintf("Contract-shape burden: appears in %d endpoints %s; some responses look snapshot-heavy or do not clearly show task outcomes.", endpoints, scope))
	}

	if consistency := m.topConsistencyOutliers(2); len(consistency) > 0 {
		parts := make([]string, 0, len(consistency))
		for _, item := range consistency {
			parts = append(parts, fmt.Sprintf("%s (%d)", item.label, item.count))
		}
		lines = append(lines, "Consistency outliers: "+strings.Join(parts, "; "))
	}

	if families := m.topPriorityEndpointFamilies(2); len(families) > 0 {
		parts := make([]string, 0, len(families))
		for _, item := range families {
			parts = append(parts, fmt.Sprintf("%s (priority %d)", item.label, item.count))
		}
		lines = append(lines, "High-priority endpoint families: "+strings.Join(parts, "; "))
	}

	return lines
}

func (m Model) contractShapeBurdenFootprint() (int, int) {
	if m.analysis == nil {
		return 0, 0
	}

	endpointSet := map[string]bool{}
	familySet := map[string]bool{}
	for _, issue := range m.analysis.Issues {
		if issue == nil || !isContractShapeBurdenFindingCode(issue.Code) {
			continue
		}
		key := strings.ToUpper(strings.TrimSpace(issue.Operation)) + "|" + strings.TrimSpace(issue.Path)
		endpointSet[key] = true
		familySet[contractShapeSummaryFamily(issue.Path)] = true
	}

	return len(endpointSet), len(familySet)
}

func contractShapeSummaryFamily(path string) string {
	segments := strings.Split(strings.Trim(path, "/"), "/")
	for _, segment := range segments {
		if segment == "" || strings.HasPrefix(segment, "{") {
			continue
		}
		return "/" + segment
	}
	return "/"
}

type labeledCount struct {
	label string
	count int
}

func (m Model) topChainingBlockers(limit int) []labeledCount {
	if m.analysis == nil || limit <= 0 {
		return nil
	}
	counts := map[string]int{}
	for _, issue := range m.analysis.Issues {
		switch issue.Code {
		case "weak-follow-up-linkage", "weak-list-detail-linkage", "weak-action-follow-up-linkage", "weak-accepted-tracking-linkage":
			counts[issue.Code]++
		}
	}
	ordered := topCounts(counts, limit)
	out := make([]labeledCount, 0, len(ordered))
	for _, item := range ordered {
		out = append(out, labeledCount{label: chainingBlockerLabel(item.key), count: item.count})
	}
	return out
}

func chainingBlockerLabel(code string) string {
	switch code {
	case "weak-follow-up-linkage":
		return "follow-up identifier clarity"
	case "weak-list-detail-linkage":
		return "list-to-detail identifier clarity"
	case "weak-action-follow-up-linkage":
		return "action follow-up verification clarity"
	case "weak-accepted-tracking-linkage":
		return "accepted-response tracking clarity"
	default:
		return code
	}
}

func (m Model) topConsistencyOutliers(limit int) []labeledCount {
	if m.analysis == nil || limit <= 0 {
		return nil
	}
	counts := map[string]int{}
	for _, issue := range m.analysis.Issues {
		if isConsistencyFindingCode(issue.Code) {
			counts[issue.Code]++
		}
	}
	ordered := topCounts(counts, limit)
	out := make([]labeledCount, 0, len(ordered))
	for _, item := range ordered {
		out = append(out, labeledCount{label: consistencyFindingSummary(item.key), count: item.count})
	}
	return out
}

func (m Model) topPriorityEndpointFamilies(limit int) []labeledCount {
	if m.analysis == nil || limit <= 0 || len(m.analysis.Operations) == 0 {
		return nil
	}
	totals := map[string]int{}
	counts := map[string]int{}
	for _, op := range m.analysis.Operations {
		family := pathFamily(op.Path)
		totals[family] += m.endpointRiskScore(op)
		counts[family]++
	}
	familyRisk := make([]labeledCount, 0, len(totals))
	for family, total := range totals {
		avg := 0
		if counts[family] > 0 {
			avg = total / counts[family]
		}
		familyRisk = append(familyRisk, labeledCount{label: family, count: avg})
	}
	sort.Slice(familyRisk, func(i, j int) bool {
		if familyRisk[i].count != familyRisk[j].count {
			return familyRisk[i].count > familyRisk[j].count
		}
		return familyRisk[i].label < familyRisk[j].label
	})
	if len(familyRisk) > limit {
		return familyRisk[:limit]
	}
	return familyRisk
}

func isConsistencyFindingCode(code string) bool {
	switch strings.TrimSpace(code) {
	case "detail-path-parameter-name-drift", "endpoint-path-style-drift", "sibling-path-shape-drift", "inconsistent-response-shape":
		return true
	default:
		return false
	}
}

func consistencyFindingSummary(code string) string {
	switch code {
	case "detail-path-parameter-name-drift":
		return "Related detail endpoints use different identifier parameter names for similar routes."
	case "endpoint-path-style-drift":
		return "Sibling endpoints mix static path naming styles (for example kebab-case vs snake_case)."
	case "sibling-path-shape-drift":
		return "A sibling endpoint uses a different path structure than the dominant family shape."
	case "inconsistent-response-shape":
		return "Similar endpoints return different response structures in success responses."
	default:
		return "Consistency issue detected across related endpoints."
	}
}

func consistencyFindingImpact(code string) string {
	switch code {
	case "detail-path-parameter-name-drift":
		return "Inconsistent identifier names increase client branching and make reusable request helpers harder to maintain."
	case "endpoint-path-style-drift":
		return "Mixed path naming styles make endpoint discovery and route conventions less predictable for integrators."
	case "sibling-path-shape-drift":
		return "Outlier sibling path shapes can break assumptions in generated clients and manual route exploration."
	case "inconsistent-response-shape":
		return "Different response shapes for similar endpoints force extra mapping logic and reduce confidence in shared handling."
	default:
		return "Consistency drift across related endpoints can lower trust and increase implementation overhead."
	}
}

func consistencyFindingExplanation(code string) string {
	switch code {
	case "detail-path-parameter-name-drift":
		return "Check similar detail routes and align identifier placeholder names (for example prefer one of id/orderId consistently)."
	case "endpoint-path-style-drift":
		return "Check sibling routes in the same family and unify static segment style (kebab-case or snake_case)."
	case "sibling-path-shape-drift":
		return "Compare this route to sibling routes for the same method/family and decide whether the path depth/segment pattern should be aligned."
	case "inconsistent-response-shape":
		return "Compare success response schemas for sibling endpoints and align top-level structure where practical."
	default:
		return "Review similar endpoints together and align naming/shape conventions."
	}
}

func (m Model) consistencyFindingCounts() (int, int) {
	if m.analysis == nil {
		return 0, 0
	}
	total := 0
	cats := map[string]bool{}
	for _, issue := range m.analysis.Issues {
		if !isConsistencyFindingCode(issue.Code) {
			continue
		}
		total++
		cats[issue.Code] = true
	}
	return total, len(cats)
}
