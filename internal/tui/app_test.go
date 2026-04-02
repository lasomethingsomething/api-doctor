package tui

import (
	"fmt"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	intdiff "github.com/lasomethingsomething/api-doctor/internal/diff"
	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/model"
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
	if !strings.Contains(out, "Endpoints Browser") || !strings.Contains(out, "Scores (Schema/Client/Versioning): 4/5/5") || !strings.Contains(out, "weak-follow-up-linkage") || !strings.Contains(out, "Related workflows") {
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

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'o'}})
	next := updated.(Model)
	if next.active != screenWorkflows || !next.workflowItemDetailOpen {
		t.Fatalf("expected hotspots key 'o' to open workflow detail, got active=%v detail=%v", next.active, next.workflowItemDetailOpen)
	}
}
