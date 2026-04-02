package tui

import (
	"fmt"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	intdiff "github.com/lasomethingsomething/api-doctor/internal/diff"
	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/model"
	"github.com/lasomethingsomething/api-doctor/internal/openapi"
	"github.com/lasomethingsomething/api-doctor/internal/rule"
	"github.com/lasomethingsomething/api-doctor/internal/workflow"
)

func TestViewOverview(t *testing.T) {
	m := NewModel(
		&model.AnalysisResult{
			SpecFile:   "spec.json",
			Operations: []*model.Operation{{Path: "/a", Method: "get"}},
			Issues:     []*model.Issue{{Severity: "warning", Code: "x"}},
		},
		nil,
		&workflow.Graph{Edges: []workflow.Edge{{Kind: "list-to-detail"}}, Chains: []workflow.Chain{{Kind: "order-detail-to-action"}}},
		nil,
		nil,
		&intdiff.Result{Changes: []*intdiff.Change{{Severity: "error", Code: "removed-path"}}},
	)
	out := m.viewOverview()
	if !strings.Contains(out, "Overview Summary") || !strings.Contains(out, "Totals  ops") {
		t.Fatalf("expected overview summary, got: %s", out)
	}
}

func TestPaneOverview_FramingCopy(t *testing.T) {
	m := NewModel(
		&model.AnalysisResult{
			SpecFile:   "spec.json",
			Operations: []*model.Operation{{Path: "/a", Method: "get"}},
			Issues:     []*model.Issue{{Severity: "warning", Code: "weak-follow-up-linkage"}},
		},
		nil,
		&workflow.Graph{Edges: []workflow.Edge{{Kind: "list-to-detail"}}},
		nil,
		nil,
		nil,
	)
	_, main, _, detail := m.paneOverview()
	if !strings.Contains(main, "Total burden/consistency/risk signals detected:") {
		t.Fatalf("expected overview main framing to use burden/consistency/risk wording, got: %s", main)
	}
	if !strings.Contains(main, "Signals by severity:") {
		t.Fatalf("expected overview severity framing to use signal language, got: %s", main)
	}
	if !strings.Contains(detail, "workflow burden") || !strings.Contains(detail, "contract-shape burden") || !strings.Contains(detail, "endpoint consistency outliers") {
		t.Fatalf("expected overview detail framing to reflect product focus, got: %s", detail)
	}
}

func TestViewFindings(t *testing.T) {
	m := NewModel(
		&model.AnalysisResult{SpecFile: "spec.json", Issues: []*model.Issue{{Severity: "warning", Code: "weak-follow-up-linkage"}, {Severity: "warning", Code: "weak-follow-up-linkage"}}},
		nil,
		nil,
		nil,
		nil,
		nil,
	)
	out := m.viewFindings()
	if !strings.Contains(out, "Top finding code buckets") || !strings.Contains(out, "weak-follow-up-linkage") {
		t.Fatalf("expected finding signal summary, got: %s", out)
	}
}

func TestViewWorkflows(t *testing.T) {
	g := &workflow.Graph{
		Edges:  []workflow.Edge{{Kind: "list-to-detail"}, {Kind: "create-to-detail"}},
		Chains: []workflow.Chain{{Kind: "order-detail-to-action"}},
	}
	m := NewModel(nil, nil, g, nil, map[string]*workflow.ChainScore{"0": {UIIndependence: 3, SchemaCompleteness: 3, ClientGenerationQuality: 5}}, nil)
	out := m.viewWorkflows()
	if !strings.Contains(out, "Workflows Summary") || !strings.Contains(out, "Chain kind buckets") {
		t.Fatalf("expected workflow summary, got: %s", out)
	}
}

func TestViewDiff(t *testing.T) {
	m := NewModel(nil, nil, nil, nil, nil, &intdiff.Result{OldSpec: "old.json", NewSpec: "new.json", Changes: []*intdiff.Change{{Severity: "error", Code: "removed-path"}}})
	out := m.viewDiff()
	if !strings.Contains(out, "Total changes") || !strings.Contains(out, "Top diff code buckets") {
		t.Fatalf("expected diff summary, got: %s", out)
	}
}

func TestSidebar_HidesDiffWhenInactive(t *testing.T) {
	m := NewModel(nil, nil, nil, nil, nil, nil)
	out := m.viewSidebar()
	if strings.Contains(out, "Diff") {
		t.Fatalf("expected Diff to be hidden when no diff data is loaded, got: %s", out)
	}
}

func TestSidebar_ShowsDiffWhenAvailable(t *testing.T) {
	m := NewModel(nil, nil, nil, nil, nil, &intdiff.Result{OldSpec: "old.json", NewSpec: "new.json"})
	out := m.viewSidebar()
	if !strings.Contains(out, "Diff") {
		t.Fatalf("expected Diff to be visible when diff data is loaded, got: %s", out)
	}
}

func TestQuickJump_SixIgnoredWhenDiffInactive(t *testing.T) {
	m := NewModel(nil, nil, nil, nil, nil, nil)
	m.active = screenWorkflows

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'6'}})
	next := updated.(Model)
	if next.active != screenWorkflows {
		t.Fatalf("expected key '6' to be ignored when diff is inactive, got active=%v", next.active)
	}
}

func TestScreenStep_SkipsDiffWhenInactive(t *testing.T) {
	m := NewModel(nil, nil, nil, nil, nil, nil)
	m.active = screenOverview

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'['}})
	next := updated.(Model)
	if next.active != screenWorkflows {
		t.Fatalf("expected bracket step to wrap to Workflows when diff is inactive, got active=%v", next.active)
	}
}

func TestViewSidebar_RealSpec_HidesDiffWhenNoComparisonData(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../adminapi.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	m := NewModel(result, nil, nil, nil, nil, nil)
	sidebar := m.viewSidebar()
	if strings.Contains(sidebar, "Diff") {
		t.Fatalf("expected Diff to be hidden in real-spec normal run, got: %s", sidebar)
	}
	t.Logf("REAL_SPEC_NAV_ITEMS_HIDE_DIFF: true")
}

func TestViewFindings_DetailOpen(t *testing.T) {
	m := NewModel(
		&model.AnalysisResult{SpecFile: "spec.json", Issues: []*model.Issue{{Severity: "warning", Code: "weak-follow-up-linkage", Path: "/orders/{id}", Operation: "get", Message: "follow-up link is weak"}}},
		nil,
		nil,
		nil,
		nil,
		nil,
	)
	m.findingsDetailOpen = true
	out := m.viewFindings()
	if !strings.Contains(out, "Details for weak-follow-up-linkage") || !strings.Contains(out, "follow-up link is weak") {
		t.Fatalf("expected findings detail list, got: %s", out)
	}
}

func TestViewWorkflows_EmptyState(t *testing.T) {
	m := NewModel(nil, nil, &workflow.Graph{}, nil, nil, nil)
	out := m.viewWorkflows()
	if !strings.Contains(out, "No workflows detected in this run") {
		t.Fatalf("expected workflow empty state, got: %s", out)
	}
}

func TestViewEndpoints_DetailWithRelatedData(t *testing.T) {
	op := &model.Operation{Path: "/orders/{id}", Method: "get", OperationID: "getOrder", Summary: "Get order by id"}
	analysis := &model.AnalysisResult{
		SpecFile:   "spec.json",
		Operations: []*model.Operation{op},
		Issues: []*model.Issue{
			{Severity: "warning", Code: "weak-follow-up-linkage", Path: "/orders/{id}", Message: "follow-up linkage is weak"},
		},
	}
	scores := map[string]*endpoint.EndpointScore{
		fmt.Sprintf("%s|%s", op.Method, op.Path): {SchemaCompleteness: 4, ClientGenerationQuality: 5, VersioningSafety: 5, Explanation: "Schema 4/5"},
	}
	g := &workflow.Graph{
		Edges: []workflow.Edge{{Kind: "list-to-detail", From: workflow.Node{Method: "get", Path: "/orders"}, To: workflow.Node{Method: "get", Path: "/orders/{id}"}}},
		Chains: []workflow.Chain{{Kind: "order-detail-to-action", Steps: []workflow.ChainStep{{Node: workflow.Node{Method: "get", Path: "/orders"}}, {Node: workflow.Node{Method: "get", Path: "/orders/{id}"}}}}},
	}
	m := NewModel(analysis, scores, g, nil, nil, nil)
	m.endpointDetailOpen = true
	out := m.viewEndpoints()
	if !strings.Contains(out, "Endpoints Browser") || !strings.Contains(out, "Scores (Schema/Client/Versioning):") || !strings.Contains(out, "4/5/5") || !strings.Contains(out, "weak-follow-up-linkage") || !strings.Contains(out, "Related workflows") {
		t.Fatalf("expected endpoint detail with related data, got: %s", out)
	}
}

func TestFindingsKeyOpenEndpoint(t *testing.T) {
	op := &model.Operation{Path: "/orders/{id}", Method: "get"}
	analysis := &model.AnalysisResult{
		Operations: []*model.Operation{op},
		Issues: []*model.Issue{
			{Severity: "warning", Code: "weak-follow-up-linkage", Path: "/orders/{id}", Operation: "get", Message: "follow-up linkage is weak"},
		},
	}
	m := NewModel(analysis, nil, nil, nil, nil, nil)
	m.active = screenFindings
	m.focusPane = paneMain

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'o'}})
	next := updated.(Model)
	if next.active != screenEndpoints || !next.endpointDetailOpen {
		t.Fatalf("expected findings key 'o' to open endpoint detail, got active=%v detail=%v", next.active, next.endpointDetailOpen)
	}
}

func TestViewHotspots(t *testing.T) {
	op := &model.Operation{Path: "/orders/{id}", Method: "get"}
	analysis := &model.AnalysisResult{
		Operations: []*model.Operation{op},
		Issues: []*model.Issue{
			{Severity: "warning", Code: "weak-follow-up-linkage", Path: "/orders/{id}", Operation: "get", Message: "follow-up linkage is weak"},
		},
	}
	scores := map[string]*endpoint.EndpointScore{
		fmt.Sprintf("%s|%s", op.Method, op.Path): {SchemaCompleteness: 3, ClientGenerationQuality: 4, VersioningSafety: 5},
	}
	m := NewModel(analysis, scores, nil, nil, nil, nil)
	out := m.viewHotspots()
	if !strings.Contains(out, "Hotspots") || !strings.Contains(out, "finding-bucket") {
		t.Fatalf("expected hotspots output, got: %s", out)
	}
}

func TestFindingBucketHotspotDetail_ContractShapeSpecificWording(t *testing.T) {
	detail := findingBucketHotspotDetail("contract-shape-workflow-guidance-burden")
	if !strings.Contains(detail, "snapshot-heavy") || !strings.Contains(detail, "task outcomes") {
		t.Fatalf("expected contract-shape specific hotspot detail wording, got: %s", detail)
	}
}

func TestHotspotFindingLabel_ContractShapePlainWording(t *testing.T) {
	label := hotspotFindingLabel("contract-shape-workflow-guidance-burden")
	if label != "Contract-shape workflow burden signal" {
		t.Fatalf("expected plain-language contract-shape hotspot label, got: %s", label)
	}
}

func TestHotspotsKeyOpenEndpoint(t *testing.T) {
	op := &model.Operation{Path: "/orders/{id}", Method: "get"}
	analysis := &model.AnalysisResult{
		Operations: []*model.Operation{op},
		Issues: []*model.Issue{
			{Severity: "warning", Code: "weak-follow-up-linkage", Path: "/orders/{id}", Operation: "get", Message: "follow-up linkage is weak"},
		},
	}
	m := NewModel(analysis, nil, nil, nil, nil, nil)
	m.active = screenHotspots
	m.focusPane = paneMain

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'o'}})
	next := updated.(Model)
	if next.active != screenEndpoints || !next.endpointDetailOpen {
		t.Fatalf("expected hotspots key 'o' to open endpoint detail, got active=%v detail=%v", next.active, next.endpointDetailOpen)
	}
}

func TestViewWorkflows_ItemDetail(t *testing.T) {
	g := &workflow.Graph{
		Edges: []workflow.Edge{{Kind: "list-to-detail", From: workflow.Node{Method: "get", Path: "/orders"}, To: workflow.Node{Method: "get", Path: "/orders/{id}"}}},
	}
	analysis := &model.AnalysisResult{
		Operations: []*model.Operation{{Method: "get", Path: "/orders"}, {Method: "get", Path: "/orders/{id}"}},
		Issues:     []*model.Issue{{Severity: "warning", Code: "weak-follow-up-linkage", Path: "/orders/{id}", Message: "follow-up linkage is weak"}},
	}
	m := NewModel(analysis, nil, g, map[string]*workflow.WorkflowScore{"0": {UIIndependence: 3, SchemaCompleteness: 4, ClientGenerationQuality: 5, Explanation: "UI depends on list context"}}, nil, nil)
	m.workflowItemDetailOpen = true
	m.workflowItemSection = 0
	m.workflowItemIndex = 0
	out := m.viewWorkflows()
	if !strings.Contains(out, "Workflow item detail") || !strings.Contains(out, "Bottleneck") || !strings.Contains(out, "Why this matters") {
		t.Fatalf("expected workflow item detail pane, got: %s", out)
	}
}

func TestHotspotsKeyOpenWorkflowDetail(t *testing.T) {
	g := &workflow.Graph{Edges: []workflow.Edge{{Kind: "list-to-detail", From: workflow.Node{Method: "get", Path: "/orders"}, To: workflow.Node{Method: "get", Path: "/orders/{id}"}}}}
	m := NewModel(&model.AnalysisResult{}, nil, g, map[string]*workflow.WorkflowScore{"0": {UIIndependence: 3, SchemaCompleteness: 4, ClientGenerationQuality: 5}}, nil, nil)
	m.active = screenHotspots
	m.focusPane = paneMain

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'o'}})
	next := updated.(Model)
	if next.active != screenWorkflows || !next.workflowItemDetailOpen {
		t.Fatalf("expected hotspots key 'o' to open workflow detail, got active=%v detail=%v", next.active, next.workflowItemDetailOpen)
	}
}

func TestPaneEndpoints_ChainingHintsAndMissingIdentifierStatus(t *testing.T) {
	ops := []*model.Operation{
		{Path: "/orders", Method: "get", OperationID: "listOrders"},
		{Path: "/orders/{id}", Method: "get", OperationID: "getOrder"},
		{Path: "/orders/{id}/line-items", Method: "get", OperationID: "getOrderLineItems"},
	}
	analysis := &model.AnalysisResult{
		Operations: ops,
		Issues: []*model.Issue{
			{Severity: "warning", Code: "weak-follow-up-linkage", Path: "/orders", Operation: "get", Message: "follow-up identifier is not clearly exposed"},
		},
	}
	g := &workflow.Graph{
		Edges: []workflow.Edge{{
			Kind:   "list-to-detail",
			From:   workflow.Node{Method: "get", Path: "/orders"},
			To:     workflow.Node{Method: "get", Path: "/orders/{id}"},
			Reason: "list response links to detail endpoint",
		}},
		Chains: []workflow.Chain{{
			Kind: "order-detail-to-lines",
			Steps: []workflow.ChainStep{
				{Node: workflow.Node{Method: "get", Path: "/orders"}},
				{Node: workflow.Node{Method: "get", Path: "/orders/{id}"}},
				{Node: workflow.Node{Method: "get", Path: "/orders/{id}/line-items"}},
			},
		}},
	}

	m := NewModel(analysis, nil, g, nil, nil, nil)
	m.endpointDetailOpen = true

	_, _, _, detail := m.paneEndpoints()
	if !strings.Contains(detail, "Likely next calls") || !strings.Contains(detail, "Required identifiers") {
		t.Fatalf("expected chaining hint sections in endpoint detail, got: %s", detail)
	}
	if !strings.Contains(detail, "GET /orders/{id}") || !strings.Contains(detail, "id") {
		t.Fatalf("expected next call and required identifier hints, got: %s", detail)
	}
	if !strings.Contains(detail, "Linkage status: identifier likely missing") {
		t.Fatalf("expected missing linkage status from weak linkage issue, got: %s", detail)
	}
	if !strings.Contains(detail, "Suggested call sequence:") {
		t.Fatalf("expected suggested call sequence in endpoint detail, got: %s", detail)
	}
}

func TestPaneEndpoints_ChainingHintsExposedIdentifierStatus(t *testing.T) {
	ops := []*model.Operation{
		{Path: "/products", Method: "post", OperationID: "createProduct"},
		{Path: "/products/{id}", Method: "get", OperationID: "getProduct"},
	}
	analysis := &model.AnalysisResult{Operations: ops}
	g := &workflow.Graph{Edges: []workflow.Edge{{
		Kind: "create-to-detail",
		From: workflow.Node{Method: "post", Path: "/products"},
		To:   workflow.Node{Method: "get", Path: "/products/{id}"},
	}}}

	m := NewModel(analysis, nil, g, nil, nil, nil)
	m.endpointDetailOpen = true

	_, _, _, detail := m.paneEndpoints()
	if !strings.Contains(detail, "Linkage status: identifier appears exposed by deterministic checks") {
		t.Fatalf("expected exposed linkage status when no weak linkage issue exists, got: %s", detail)
	}
}

func TestPaneFindings_TaskBurdenDiscoverability(t *testing.T) {
	analysis := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{
			{
				Severity:    "warning",
				Code:        "prerequisite-task-burden",
				Path:        "/products",
				Operation:   "post createProduct",
				Message:     "high prerequisite burden appears likely: requires 3 identifier-like inputs",
				Description: "Task likely requires extra coordination.",
			},
		},
	}

	m := NewModel(analysis, nil, nil, nil, nil, nil)
	m.findingsDetailOpen = true

	_, main, _, detail := m.paneFindings()
	if !strings.Contains(main, "Task burden signals flagged: 1 endpoints") {
		t.Fatalf("expected task burden count banner in findings list, got: %s", main)
	}
	if !strings.Contains(main, "[task burden] Task burden signal") {
		t.Fatalf("expected burden-tagged finding row, got: %s", main)
	}
	if !strings.Contains(detail, "Category type: task burden signal") {
		t.Fatalf("expected task burden detail category text, got: %s", detail)
	}
}

func TestPaneFindings_ContractShapeDiscoverability(t *testing.T) {
	analysis := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{
			{
				Severity:    "warning",
				Code:        "contract-shape-workflow-guidance-burden",
				Path:        "/category/{id}",
				Operation:   "patch updateCategory (200)",
				Message:     "medium contract-shape/workflow-guidance burden appears likely: response appears snapshot-heavy",
				Description: "Response appears closer to internal model state.",
			},
		},
	}

	m := NewModel(analysis, nil, nil, nil, nil, nil)
	m.findingsDetailOpen = true

	_, main, _, detail := m.paneFindings()
	if !strings.Contains(main, "Contract-shape burden signals flagged: 1 endpoints") {
		t.Fatalf("expected contract-shape count banner in findings list, got: %s", main)
	}
	if !strings.Contains(main, "[workflow burden] Contract-shape workflow burden signal") {
		t.Fatalf("expected workflow-burden tagged finding row, got: %s", main)
	}
	if !strings.Contains(detail, "Issue category: Contract-shape workflow burden signal") {
		t.Fatalf("expected plain contract-shape category label in detail, got: %s", detail)
	}
	if !strings.Contains(detail, "Category type: workflow/contract burden signal") {
		t.Fatalf("expected workflow/contract category type text, got: %s", detail)
	}
}

func TestPaneEndpoints_TaskBurdenCallout(t *testing.T) {
	op := &model.Operation{Path: "/products", Method: "post", OperationID: "createProduct"}
	analysis := &model.AnalysisResult{
		Operations: []*model.Operation{op},
		Issues: []*model.Issue{
			{
				Severity:    "warning",
				Code:        "prerequisite-task-burden",
				Path:        "/products",
				Operation:   "post createProduct",
				Message:     "high prerequisite burden appears likely: requires 3 identifier-like inputs",
				Description: "Task likely requires extra coordination.",
			},
		},
	}

	m := NewModel(analysis, nil, nil, nil, nil, nil)
	m.endpointDetailOpen = true

	_, _, _, detail := m.paneEndpoints()
	if !strings.Contains(detail, "Task burden signal:") {
		t.Fatalf("expected task burden section in endpoint detail, got: %s", detail)
	}
	if !strings.Contains(detail, "this task likely requires extra prerequisite coordination") {
		t.Fatalf("expected plain-language task burden wording in endpoint detail, got: %s", detail)
	}
}

func TestPaneEndpoints_ContractShapeBurdenCallout(t *testing.T) {
	op := &model.Operation{Path: "/products/{id}", Method: "patch", OperationID: "updateProduct"}
	analysis := &model.AnalysisResult{
		Operations: []*model.Operation{op},
		Issues: []*model.Issue{
			{
				Severity:    "warning",
				Code:        "contract-shape-workflow-guidance-burden",
				Path:        "/products/{id}",
				Operation:   "patch updateProduct (200)",
				Message:     "medium contract-shape/workflow-guidance burden appears likely: response appears snapshot-heavy (30 nested fields, depth 4)",
				Description: "Response appears storage-shaped.",
			},
		},
	}

	m := NewModel(analysis, nil, nil, nil, nil, nil)
	m.endpointDetailOpen = true

	_, _, _, detail := m.paneEndpoints()
	if !strings.Contains(detail, "Contract-shape burden signal:") {
		t.Fatalf("expected contract-shape burden section in endpoint detail, got: %s", detail)
	}
	if !strings.Contains(detail, "this response appears more workflow-heavy than task-focused") {
		t.Fatalf("expected plain-language contract-shape callout in endpoint detail, got: %s", detail)
	}
}

func TestEndpointFindingLabel_ContractShapePlainWording(t *testing.T) {
	label := endpointFindingLabel("contract-shape-workflow-guidance-burden")
	if label != "contract-shape workflow burden signal" {
		t.Fatalf("expected endpoint label to be plain contract-shape wording, got: %s", label)
	}
}

func TestPaneEndpoints_FilterByPathText(t *testing.T) {
	analysis := &model.AnalysisResult{
		Operations: []*model.Operation{
			{Path: "/orders", Method: "get", OperationID: "listOrders"},
			{Path: "/customers", Method: "get", OperationID: "listCustomers"},
		},
	}
	m := NewModel(analysis, nil, nil, nil, nil, nil)
	m.filterText = "orders"

	_, main, _, _ := m.paneEndpoints()
	if !strings.Contains(main, "/orders") {
		t.Fatalf("expected filtered endpoints to include /orders, got: %s", main)
	}
	if strings.Contains(main, "/customers") {
		t.Fatalf("expected filtered endpoints to exclude /customers, got: %s", main)
	}
}

func TestPaneFindings_FilterByCodeText(t *testing.T) {
	analysis := &model.AnalysisResult{
		Issues: []*model.Issue{
			{Severity: "warning", Code: "prerequisite-task-burden", Path: "/products", Message: "task burden"},
			{Severity: "warning", Code: "weak-follow-up-linkage", Path: "/orders", Message: "follow-up"},
		},
	}
	m := NewModel(analysis, nil, nil, nil, nil, nil)
	m.filterText = "task-burden"

	_, main, _, _ := m.paneFindings()
	if !strings.Contains(main, "[task burden] Task burden signal") {
		t.Fatalf("expected findings filter to keep burden bucket, got: %s", main)
	}
	if strings.Contains(main, "weak-follow-up-linkage") {
		t.Fatalf("expected findings filter to exclude unrelated bucket, got: %s", main)
	}
}

func TestRenderDetailViewport_ShowsScrollMarkers(t *testing.T) {
	m := NewModel(nil, nil, nil, nil, nil, nil)
	m.height = 18
	lines := make([]string, 0, 40)
	for i := 0; i < 40; i++ {
		lines = append(lines, fmt.Sprintf("line %02d", i))
	}
	body := strings.Join(lines, "\n")

	outTop := m.renderDetailViewport(body)
	if !strings.Contains(outTop, "↓ more") {
		t.Fatalf("expected down-scroll marker at top, got: %s", outTop)
	}

	m.detailScroll = 8
	outMiddle := m.renderDetailViewport(body)
	if !strings.Contains(outMiddle, "↑ more") || !strings.Contains(outMiddle, "↓ more") {
		t.Fatalf("expected both scroll markers in middle viewport, got: %s", outMiddle)
	}
}

func TestPaneEndpoints_ShowsInPaneFilterBannerWhenTyping(t *testing.T) {
	analysis := &model.AnalysisResult{
		Operations: []*model.Operation{{Path: "/orders", Method: "get", OperationID: "listOrders"}},
	}
	m := NewModel(analysis, nil, nil, nil, nil, nil)
	m.filterMode = true
	m.filterInput = "order"

	_, main, _, _ := m.paneEndpoints()
	if !strings.Contains(main, "Filtering Endpoints by: order_ (Esc clears filter)") {
		t.Fatalf("expected in-pane endpoint filter banner, got: %s", main)
	}
}

func TestPaneFindings_ShowsScreenSpecificFilterBanner(t *testing.T) {
	analysis := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{{Severity: "warning", Code: "weak-follow-up-linkage", Path: "/orders", Message: "x"}},
	}
	m := NewModel(analysis, nil, nil, nil, nil, nil)
	m.filterText = "follow-up"

	_, main, _, _ := m.paneFindings()
	if !strings.Contains(main, "Filtering Findings by: follow-up (Esc clears filter)") {
		t.Fatalf("expected in-pane findings filter banner, got: %s", main)
	}
}

func TestPaneOverview_ShowsContractShapeBurdenSummaryLine(t *testing.T) {
	analysis := &model.AnalysisResult{
		Operations: []*model.Operation{
			{Path: "/aggregate/customer", Method: "post", OperationID: "aggregateCustomer"},
			{Path: "/category/{id}", Method: "patch", OperationID: "updateCategory"},
		},
		Issues: []*model.Issue{
			{
				Severity:  "warning",
				Code:      "contract-shape-workflow-guidance-burden",
				Path:      "/aggregate/customer",
				Operation: "post aggregateCustomer (200)",
			},
			{
				Severity:  "warning",
				Code:      "contract-shape-workflow-guidance-burden",
				Path:      "/category/{id}",
				Operation: "patch updateCategory (200)",
			},
		},
	}

	m := NewModel(analysis, nil, nil, nil, nil, nil)
	_, main, _, _ := m.paneOverview()
	if !strings.Contains(main, "Contract-shape burden: appears in 2 endpoints across multiple families") {
		t.Fatalf("expected compact contract-shape burden summary in overview, got: %s", main)
	}
	if !strings.Contains(main, "snapshot-heavy") || !strings.Contains(main, "task outcomes") {
		t.Fatalf("expected plain-language burden context in overview, got: %s", main)
	}
}

func TestPaneOverview_RealSpecContractShapeSummaryLine(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../adminapi.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	result.Issues = rule.NewChecker().CheckAll(result.Operations)
	m := NewModel(result, nil, nil, nil, nil, nil)
	_, main, _, _ := m.paneOverview()

	var summaryLine string
	for _, line := range strings.Split(main, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "- Contract-shape burden: appears in") {
			summaryLine = trimmed
			break
		}
	}

	if summaryLine == "" {
		t.Fatalf("expected real-spec contract-shape summary line in overview, got: %s", main)
	}
	if !strings.Contains(summaryLine, "snapshot-heavy") || !strings.Contains(summaryLine, "task outcomes") {
		t.Fatalf("expected plain-language real-spec summary line, got: %s", summaryLine)
	}
	if !strings.Contains(summaryLine, "across multiple families") {
		t.Fatalf("expected aligned family-scope wording in real-spec summary line, got: %s", summaryLine)
	}

	t.Logf("REAL_SPEC_OVERVIEW_CONTRACT_SHAPE_LINE: %s", summaryLine)
}

func TestPaneOverview_RealSpecFixFirstBlock(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../adminapi.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	result.Issues = rule.NewChecker().CheckAll(result.Operations)
	m := NewModel(result, nil, nil, nil, nil, nil)
	_, main, _, _ := m.paneOverview()

	lines := strings.Split(main, "\n")
	block := make([]string, 0)
	inBlock := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "Fix first (deterministic snapshot)" {
			inBlock = true
			continue
		}
		if !inBlock {
			continue
		}
		if !strings.HasPrefix(trimmed, "-") {
			break
		}
		block = append(block, trimmed)
	}

	if len(block) == 0 {
		t.Fatalf("expected non-empty fix-first block in overview, got: %s", main)
	}

	t.Logf("REAL_SPEC_FIX_FIRST_BLOCK:\n%s", strings.Join(block, "\n"))
}

func TestContractShapeBurdenFootprint_FamilySkipsLeadingPathParam(t *testing.T) {
	analysis := &model.AnalysisResult{
		Issues: []*model.Issue{
			{Code: "contract-shape-workflow-guidance-burden", Path: "/{version}/products", Operation: "post upsertVersionedProduct (200)"},
			{Code: "contract-shape-workflow-guidance-burden", Path: "/products/{id}", Operation: "patch updateProduct (200)"},
		},
	}

	m := NewModel(analysis, nil, nil, nil, nil, nil)
	endpoints, families := m.contractShapeBurdenFootprint()
	if endpoints != 2 {
		t.Fatalf("expected two endpoints in burden footprint, got %d", endpoints)
	}
	if families != 1 {
		t.Fatalf("expected family grouping to align on /products when leading path param exists, got %d", families)
	}
}
