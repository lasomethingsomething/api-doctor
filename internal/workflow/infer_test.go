package workflow

import (
	"strings"
	"testing"

	"github.com/lasomethingsomething/api-doctor/internal/openapi"
)

func TestInfer_WorkflowFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/workflow-inference.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	graph := Infer(result.Operations)
	if len(graph.Edges) != 3 {
		t.Fatalf("expected exactly 3 inferred workflow edges, got %#v", graph.Edges)
	}

	seen := map[string]bool{}
	for _, edge := range graph.Edges {
		seen[edge.Kind+"|"+edge.From.Path+"|"+edge.To.Path] = true
	}

	for _, key := range []string{
		"create-to-detail|/products|/products/{id}",
		"action-to-detail|/_action/order/{orderId}/state/{transition}|/order/{id}",
		"list-to-detail|/orders/search|/orders/{id}",
	} {
		if !seen[key] {
			t.Fatalf("expected inferred edge %s, got %#v", key, graph.Edges)
		}
	}

	for _, blocked := range []string{
		"create-to-detail|/widgets|/widgets/{id}",
		"list-to-detail|/users/search|/users/{id}",
	} {
		if seen[blocked] {
			t.Fatalf("did not expect inferred edge %s, got %#v", blocked, graph.Edges)
		}
	}
}

func TestFormatText_DefaultGroupsWorkflowKinds(t *testing.T) {
	graph := &Graph{Edges: []Edge{
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/products"},
			To:     Node{Method: "get", Path: "/products/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/customers"},
			To:     Node{Method: "get", Path: "/customers/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/orders"},
			To:     Node{Method: "get", Path: "/orders/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/media"},
			To:     Node{Method: "get", Path: "/media/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
		{
			Kind:   "action-to-detail",
			From:   Node{Method: "post", Path: "/_action/order/{orderId}/state/{transition}"},
			To:     Node{Method: "get", Path: "/order/{id}"},
			Reason: "action path already carries the resource id and a matching detail endpoint exists for follow-up verification",
		},
		{
			Kind:   "list-to-detail",
			From:   Node{Method: "get", Path: "/customers"},
			To:     Node{Method: "get", Path: "/customers/{id}"},
			Reason: "list or search response visibly exposes item ids and a matching detail endpoint exists",
		},
		{
			Kind:   "list-to-detail",
			From:   Node{Method: "post", Path: "/orders/search"},
			To:     Node{Method: "get", Path: "/orders/{id}"},
			Reason: "list or search response visibly exposes item ids and a matching detail endpoint exists",
		},
	}}

	out := FormatText("spec.json", 25, graph, false)
	if !strings.Contains(out, "Create To Detail (4)") {
		t.Fatalf("expected create-to-detail count, got: %s", out)
	}
	if !strings.Contains(out, "Action To Detail (1)") {
		t.Fatalf("expected action-to-detail count, got: %s", out)
	}
	if !strings.Contains(out, "List To Detail (2)") {
		t.Fatalf("expected updated list-to-detail count, got: %s", out)
	}
	if !strings.Contains(out, "Representative workflows: showing 3 of 4") {
		t.Fatalf("expected capped sample count, got: %s", out)
	}
	if !strings.Contains(out, "More workflows: 1 more hidden here; use --verbose or --json for the full list.") {
		t.Fatalf("expected hidden-count hint, got: %s", out)
	}
	if strings.Contains(out, "POST /media -> GET /media/{id}") {
		t.Fatalf("expected fourth create example to be hidden in default output, got: %s", out)
	}
	if !strings.Contains(out, "Tip: use --verbose or --json for the full inferred workflow list.") {
		t.Fatalf("expected default-output tip, got: %s", out)
	}
	if !strings.Contains(out, "GET list -> detail (1)") {
		t.Fatalf("expected GET list subtype wording, got: %s", out)
	}
	if !strings.Contains(out, "POST search -> detail (1)") {
		t.Fatalf("expected POST search subtype wording, got: %s", out)
	}
	if !strings.Contains(out, "GET /customers -> GET /customers/{id}") {
		t.Fatalf("expected sampled GET list workflow, got: %s", out)
	}
	if !strings.Contains(out, "POST /orders/search -> GET /orders/{id}") {
		t.Fatalf("expected sampled POST search workflow, got: %s", out)
	}
}

func TestFormatText_VerboseKeepsFullWorkflowDetails(t *testing.T) {
	graph := &Graph{Edges: []Edge{
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/products"},
			To:     Node{Method: "get", Path: "/products/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/media"},
			To:     Node{Method: "get", Path: "/media/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
	}}

	out := FormatText("spec.json", 10, graph, true)
	if strings.Contains(out, "Representative workflows") {
		t.Fatalf("expected verbose output to avoid grouped summary wording, got: %s", out)
	}
	if !strings.Contains(out, "POST /products -> GET /products/{id}") {
		t.Fatalf("expected first full workflow in verbose output, got: %s", out)
	}
	if !strings.Contains(out, "POST /media -> GET /media/{id}") {
		t.Fatalf("expected second full workflow in verbose output, got: %s", out)
	}
	if strings.Contains(out, "Tip: use --verbose or --json") {
		t.Fatalf("expected no default-output tip in verbose mode, got: %s", out)
	}
	if strings.Contains(out, "More workflows:") {
		t.Fatalf("expected no hidden-count summary in verbose mode, got: %s", out)
	}
	if strings.Count(out, "POST /") != 2 {
		t.Fatalf("expected both workflows to remain visible in verbose output, got: %s", out)
	}
}

func TestFormatJSON_IncludesFullWorkflowEdges(t *testing.T) {
	graph := &Graph{Edges: []Edge{
		{
			Kind:   "action-to-detail",
			From:   Node{Method: "post", Path: "/_action/order/{orderId}/state/{transition}"},
			To:     Node{Method: "get", Path: "/order/{id}"},
			Reason: "action path already carries the resource id and a matching detail endpoint exists for follow-up verification",
		},
	}}

	out, err := FormatJSON("spec.json", 12, graph)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "\"action-to-detail\"") {
		t.Fatalf("expected workflow kind in JSON output, got: %s", out)
	}
	if !strings.Contains(out, "\"edges\"") {
		t.Fatalf("expected full edges list in JSON output, got: %s", out)
	}
	if !strings.Contains(out, "\"inferred_workflows\": 1") {
		t.Fatalf("expected inferred workflow count in JSON output, got: %s", out)
	}
}