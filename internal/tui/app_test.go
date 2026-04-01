package tui

import (
	"strings"
	"testing"

	intdiff "github.com/lasomethingsomething/api-doctor/internal/diff"
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
	if !strings.Contains(out, "Operations analyzed") || !strings.Contains(out, "Workflow chains") {
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
	if !strings.Contains(out, "Top finding signals") || !strings.Contains(out, "weak-follow-up-linkage") {
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
	if !strings.Contains(out, "Pairwise workflows") || !strings.Contains(out, "Chain breakdown") {
		t.Fatalf("expected workflow summary, got: %s", out)
	}
}

func TestViewDiff(t *testing.T) {
	m := NewModel(nil, nil, nil, nil, nil, &intdiff.Result{OldSpec: "old.json", NewSpec: "new.json", Changes: []*intdiff.Change{{Severity: "error", Code: "removed-path"}}})
	out := m.viewDiff()
	if !strings.Contains(out, "Total changes") || !strings.Contains(out, "Top diff signals") {
		t.Fatalf("expected diff summary, got: %s", out)
	}
}
