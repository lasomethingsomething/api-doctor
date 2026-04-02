package explore

import (
	"testing"
	"time"

	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/model"
	"github.com/lasomethingsomething/api-doctor/internal/workflow"
)

func TestBuildPayloadShape(t *testing.T) {
	opList := []*model.Operation{
		{Path: "/items", Method: "get", OperationID: "listItems", Responses: map[string]*model.Response{"200": {Code: "200", Content: map[string]*model.MediaType{"application/json": {Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{"data": {Type: "array", Items: &model.Schema{Type: "object", Properties: map[string]*model.Schema{"id": {Type: "string"}}}}}}}}}}},
		{Path: "/items/{id}", Method: "get", OperationID: "getItem", Responses: map[string]*model.Response{"200": {Code: "200", Content: map[string]*model.MediaType{"application/json": {Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{"id": {Type: "string"}}}}}}}},
	}
	issues := []*model.Issue{{
		Code:        "weak-follow-up-linkage",
		Severity:    "warning",
		Path:        "/items",
		Operation:   "get listItems",
		Message:     "missing id",
		Description: "Follow-up is hard",
	}}
	analysis := &model.AnalysisResult{SpecFile: "spec.json", Operations: opList, Issues: issues}
	scores := endpoint.ScoreOperations(opList, issues)
	graph := workflow.Infer(opList)
	ws := workflow.ScoreGraph(graph, opList, issues)
	cs := workflow.ScoreChains(graph, opList, issues)

	payload := BuildPayload(analysis, scores, graph, ws, cs, nil, time.Unix(0, 0), "", "")
	if payload.Run.SpecPath != "spec.json" {
		t.Fatalf("unexpected spec path: %s", payload.Run.SpecPath)
	}
	if payload.Summary.TotalFindings != 1 {
		t.Fatalf("unexpected findings total: %d", payload.Summary.TotalFindings)
	}
	if len(payload.Endpoints) != 2 {
		t.Fatalf("expected 2 endpoints, got %d", len(payload.Endpoints))
	}
	if len(payload.FixFirst) < 3 {
		t.Fatalf("expected fix first sections")
	}
	if len(payload.GraphSeed.Nodes) == 0 {
		t.Fatalf("expected graph seed nodes")
	}
	listDetail := payload.EndpointDetails["GET|/items"]
	if len(listDetail.Findings) != 1 {
		t.Fatalf("expected /items detail findings to be populated, got %d", len(listDetail.Findings))
	}
	if payload.Summary.EndpointsWithIssue != 1 {
		t.Fatalf("expected 1 endpoint with issue, got %d", payload.Summary.EndpointsWithIssue)
	}
	if payload.EndpointDetails["GET|/items"].Endpoint.RiskSummary == "No score" {
		t.Fatalf("expected endpoint risk summary to resolve through score lookup")
	}
}

func TestBuildPayloadMapsResponseQualifiedIssuesToEndpoint(t *testing.T) {
	opList := []*model.Operation{{Path: "/orders/{id}", Method: "patch", OperationID: "updateOrder", Responses: map[string]*model.Response{"200": {Code: "200", Content: map[string]*model.MediaType{"application/json": {Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{"id": {Type: "string"}}}}}}}}}
	issues := []*model.Issue{{
		Code:        "contract-shape-workflow-guidance-burden",
		Severity:    "warning",
		Path:        "/orders/{id}",
		Operation:   "patch updateOrder (200)",
		Message:     "response hides task outcome",
		Description: "Follow-up guidance is hard to infer",
	}}
	analysis := &model.AnalysisResult{SpecFile: "spec.json", Operations: opList, Issues: issues}
	scores := endpoint.ScoreOperations(opList, issues)

	payload := BuildPayload(analysis, scores, nil, nil, nil, nil, time.Unix(0, 0), "", "")
	detail := payload.EndpointDetails["PATCH|/orders/{id}"]
	if len(detail.Findings) != 1 {
		t.Fatalf("expected response-qualified issue to map to endpoint detail, got %d", len(detail.Findings))
	}
	if detail.Findings[0].Code != "contract-shape-workflow-guidance-burden" {
		t.Fatalf("unexpected finding code: %s", detail.Findings[0].Code)
	}
	if payload.Summary.EndpointsWithIssue != 1 {
		t.Fatalf("expected 1 endpoint with issue, got %d", payload.Summary.EndpointsWithIssue)
	}
}
