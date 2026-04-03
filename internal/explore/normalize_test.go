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

func TestBuildPayloadMapsSnapshotHeavyToContractShapeBurden(t *testing.T) {
	opList := []*model.Operation{{Path: "/orders/{id}/sync", Method: "post", OperationID: "syncOrder", Responses: map[string]*model.Response{"200": {Code: "200", Content: map[string]*model.MediaType{"application/json": {Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{"id": {Type: "string"}}}}}}}}}
	issues := []*model.Issue{{
		Code:        "snapshot-heavy-response",
		Severity:    "warning",
		Path:        "/orders/{id}/sync",
		Operation:   "post syncOrder (200)",
		Message:     "Response 200 application/json appears snapshot-heavy: 14 top-level fields",
		Description: "heuristic broad object graph exposure",
	}}
	analysis := &model.AnalysisResult{SpecFile: "spec.json", Operations: opList, Issues: issues}
	payload := BuildPayload(analysis, nil, nil, nil, nil, nil, time.Unix(0, 0), "", "")

	detail := payload.EndpointDetails["POST|/orders/{id}/sync"]
	if len(detail.Findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(detail.Findings))
	}
	if detail.Findings[0].Category != "contract-shape" {
		t.Fatalf("expected contract-shape category, got %q", detail.Findings[0].Category)
	}
	if detail.Findings[0].BurdenFocus != "contract-shape" {
		t.Fatalf("expected contract-shape burden focus, got %q", detail.Findings[0].BurdenFocus)
	}

	var contractShapeFixFirst *FixFirstItem
	for i := range payload.FixFirst {
		if payload.FixFirst[i].ID == "contract-shape" {
			contractShapeFixFirst = &payload.FixFirst[i]
			break
		}
	}
	if contractShapeFixFirst == nil {
		t.Fatal("expected contract-shape fix-first entry")
	}
	if contractShapeFixFirst.Value != "1 findings" {
		t.Fatalf("expected contract-shape count to include snapshot-heavy finding, got %q", contractShapeFixFirst.Value)
	}
}

func TestBuildPayloadMapsDeepNestingToContractShapeBurden(t *testing.T) {
	opList := []*model.Operation{{Path: "/orders/{id}/finalize", Method: "post", OperationID: "finalizeOrder", Responses: map[string]*model.Response{"200": {Code: "200", Content: map[string]*model.MediaType{"application/json": {Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{"id": {Type: "string"}}}}}}}}}
	issues := []*model.Issue{{
		Code:        "deeply-nested-response-structure",
		Severity:    "warning",
		Path:        "/orders/{id}/finalize",
		Operation:   "post finalizeOrder (200)",
		Message:     "Response 200 application/json appears deeply nested: max object nesting depth=6",
		Description: "heuristic nested response structure burden",
	}}
	analysis := &model.AnalysisResult{SpecFile: "spec.json", Operations: opList, Issues: issues}
	payload := BuildPayload(analysis, nil, nil, nil, nil, nil, time.Unix(0, 0), "", "")

	detail := payload.EndpointDetails["POST|/orders/{id}/finalize"]
	if len(detail.Findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(detail.Findings))
	}
	if detail.Findings[0].Category != "contract-shape" {
		t.Fatalf("expected contract-shape category, got %q", detail.Findings[0].Category)
	}
	if detail.Findings[0].BurdenFocus != "contract-shape" {
		t.Fatalf("expected contract-shape burden focus, got %q", detail.Findings[0].BurdenFocus)
	}
}

func TestBuildPayloadMapsDuplicatedStateToContractShapeBurden(t *testing.T) {
	opList := []*model.Operation{{Path: "/orders/{id}/review", Method: "post", OperationID: "reviewOrder", Responses: map[string]*model.Response{"200": {Code: "200", Content: map[string]*model.MediaType{"application/json": {Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{"id": {Type: "string"}}}}}}}}}
	issues := []*model.Issue{{
		Code:        "duplicated-state-response",
		Severity:    "warning",
		Path:        "/orders/{id}/review",
		Operation:   "post reviewOrder (200)",
		Message:     "Response 200 application/json appears to repeat similar state across branches",
		Description: "heuristic duplicated state exposure",
	}}
	analysis := &model.AnalysisResult{SpecFile: "spec.json", Operations: opList, Issues: issues}
	payload := BuildPayload(analysis, nil, nil, nil, nil, nil, time.Unix(0, 0), "", "")

	detail := payload.EndpointDetails["POST|/orders/{id}/review"]
	if len(detail.Findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(detail.Findings))
	}
	if detail.Findings[0].Category != "contract-shape" {
		t.Fatalf("expected contract-shape category, got %q", detail.Findings[0].Category)
	}
	if detail.Findings[0].BurdenFocus != "contract-shape" {
		t.Fatalf("expected contract-shape burden focus, got %q", detail.Findings[0].BurdenFocus)
	}
}

func TestBuildPayloadMapsIncidentalInternalFieldsToContractShapeBurden(t *testing.T) {
	opList := []*model.Operation{{Path: "/orders/{id}/ack", Method: "post", OperationID: "ackOrder", Responses: map[string]*model.Response{"200": {Code: "200", Content: map[string]*model.MediaType{"application/json": {Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{"id": {Type: "string"}}}}}}}}}
	issues := []*model.Issue{{
		Code:        "incidental-internal-field-exposure",
		Severity:    "warning",
		Path:        "/orders/{id}/ack",
		Operation:   "post ackOrder (200)",
		Message:     "Response 200 application/json appears to expose incidental/internal fields",
		Description: "heuristic backend-oriented field exposure",
	}}
	analysis := &model.AnalysisResult{SpecFile: "spec.json", Operations: opList, Issues: issues}
	payload := BuildPayload(analysis, nil, nil, nil, nil, nil, time.Unix(0, 0), "", "")

	detail := payload.EndpointDetails["POST|/orders/{id}/ack"]
	if len(detail.Findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(detail.Findings))
	}
	if detail.Findings[0].Category != "contract-shape" {
		t.Fatalf("expected contract-shape category, got %q", detail.Findings[0].Category)
	}
	if detail.Findings[0].BurdenFocus != "contract-shape" {
		t.Fatalf("expected contract-shape burden focus, got %q", detail.Findings[0].BurdenFocus)
	}
}

func TestBuildPayloadMapsWeakOutcomeGuidanceToWorkflowBurden(t *testing.T) {
	opList := []*model.Operation{{Path: "/payments/{id}/capture", Method: "post", OperationID: "capturePayment", Responses: map[string]*model.Response{"200": {Code: "200", Content: map[string]*model.MediaType{"application/json": {Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{"id": {Type: "string"}}}}}}}}}
	issues := []*model.Issue{{
		Code:        "weak-outcome-next-action-guidance",
		Severity:    "warning",
		Path:        "/payments/{id}/capture",
		Operation:   "post capturePayment (200)",
		Message:     "Response 200 application/json may weaken workflow guidance",
		Description: "heuristic weak outcome/next-action guidance",
	}}
	analysis := &model.AnalysisResult{SpecFile: "spec.json", Operations: opList, Issues: issues}
	payload := BuildPayload(analysis, nil, nil, nil, nil, nil, time.Unix(0, 0), "", "")

	detail := payload.EndpointDetails["POST|/payments/{id}/capture"]
	if len(detail.Findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(detail.Findings))
	}
	if detail.Findings[0].Category != "workflow-burden" {
		t.Fatalf("expected workflow-burden category, got %q", detail.Findings[0].Category)
	}
	if detail.Findings[0].BurdenFocus != "workflow-burden" {
		t.Fatalf("expected workflow-burden focus, got %q", detail.Findings[0].BurdenFocus)
	}
}

func TestBuildPayloadSpecRuleFieldsThreaded(t *testing.T) {
	opList := []*model.Operation{
		{Path: "/orders", Method: "get", OperationID: "listOrders", Responses: map[string]*model.Response{
			"200": {Code: "200", Description: "", Content: map[string]*model.MediaType{}},
		}},
	}
	issues := []*model.Issue{{
		Code:           "oas-response-description-required",
		Severity:       "error",
		Path:           "/orders",
		Operation:      "get listOrders (200)",
		Message:        "Response 200 is missing a description",
		Description:    "REQUIRED field is absent",
		EvidenceType:   "spec-rule",
		SpecRuleID:     "OAS-RESPONSE-DESCRIPTION-REQUIRED",
		NormativeLevel: "REQUIRED",
		SpecSource:     "Response Object",
		SpecLocation:   "200 response at GET /orders",
	}}
	analysis := &model.AnalysisResult{SpecFile: "spec.json", Operations: opList, Issues: issues}
	payload := BuildPayload(analysis, nil, nil, nil, nil, nil, time.Unix(0, 0), "", "")

	detail := payload.EndpointDetails["GET|/orders"]
	if len(detail.Findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(detail.Findings))
	}
	f := detail.Findings[0]
	if f.EvidenceType != "spec-rule" {
		t.Fatalf("expected evidenceType spec-rule, got %q", f.EvidenceType)
	}
	if f.SpecRuleID != "OAS-RESPONSE-DESCRIPTION-REQUIRED" {
		t.Fatalf("expected SpecRuleID OAS-RESPONSE-DESCRIPTION-REQUIRED, got %q", f.SpecRuleID)
	}
	if f.NormativeLevel != "REQUIRED" {
		t.Fatalf("expected NormativeLevel REQUIRED, got %q", f.NormativeLevel)
	}
	if f.SpecSource != "Response Object" {
		t.Fatalf("expected SpecSource Response Object, got %q", f.SpecSource)
	}
	if f.SpecLocation != "200 response at GET /orders" {
		t.Fatalf("expected SpecLocation to be set, got %q", f.SpecLocation)
	}
	if f.Category != "spec-rule" {
		t.Fatalf("expected Category spec-rule, got %q", f.Category)
	}
	if f.BurdenFocus != "" {
		t.Fatalf("expected empty BurdenFocus for spec-rule finding, got %q", f.BurdenFocus)
	}

	// Check that the FixFirst spec-rule entry is present
	var specRuleFixFirst *FixFirstItem
	for i := range payload.FixFirst {
		if payload.FixFirst[i].ID == "spec-rule" {
			specRuleFixFirst = &payload.FixFirst[i]
			break
		}
	}
	if specRuleFixFirst == nil {
		t.Fatal("expected FixFirst to include spec-rule entry")
	}
	if specRuleFixFirst.Filter.Category != "spec-rule" {
		t.Fatalf("spec-rule FixFirst filter should have Category=spec-rule, got %q", specRuleFixFirst.Filter.Category)
	}
}

func TestBuildPayloadSpecRuleDoesNotPolluteBurdenFocus(t *testing.T) {
	// Heuristic findings must NOT have EvidenceType set and must retain their burden focus.
	opList := []*model.Operation{
		{Path: "/orders", Method: "post", OperationID: "createOrder", Responses: map[string]*model.Response{
			"200": {Code: "200", Content: map[string]*model.MediaType{}},
		}},
	}
	issues := []*model.Issue{
		{
			Code:        "weak-follow-up-linkage",
			Severity:    "warning",
			Path:        "/orders",
			Operation:   "post createOrder (200)",
			Message:     "response does not expose follow-up id",
			Description: "heuristic burden",
		},
		{
			Code:           "oas-response-description-required",
			Severity:       "error",
			Path:           "/orders",
			Operation:      "post createOrder (200)",
			Message:        "Response 200 missing description",
			Description:    "REQUIRED",
			EvidenceType:   "spec-rule",
			SpecRuleID:     "OAS-RESPONSE-DESCRIPTION-REQUIRED",
			NormativeLevel: "REQUIRED",
			SpecSource:     "Response Object",
		},
	}
	analysis := &model.AnalysisResult{SpecFile: "spec.json", Operations: opList, Issues: issues}
	payload := BuildPayload(analysis, nil, nil, nil, nil, nil, time.Unix(0, 0), "", "")

	detail := payload.EndpointDetails["POST|/orders"]
	if len(detail.Findings) != 2 {
		t.Fatalf("expected 2 findings, got %d", len(detail.Findings))
	}

	var heuristic, specRule *FindingDetail
	for i := range detail.Findings {
		f := &detail.Findings[i]
		if f.EvidenceType == "spec-rule" {
			specRule = f
		} else {
			heuristic = f
		}
	}
	if heuristic == nil || specRule == nil {
		t.Fatalf("expected both heuristic and spec-rule findings, heuristic=%v specRule=%v", heuristic, specRule)
	}
	if heuristic.BurdenFocus != "workflow-burden" {
		t.Fatalf("heuristic finding should retain workflow-burden focus, got %q", heuristic.BurdenFocus)
	}
	if heuristic.Category != "workflow-burden" {
		t.Fatalf("heuristic finding should retain workflow-burden category, got %q", heuristic.Category)
	}
	if specRule.BurdenFocus != "" {
		t.Fatalf("spec-rule finding should have empty burden focus, got %q", specRule.BurdenFocus)
	}
	if specRule.Category != "spec-rule" {
		t.Fatalf("spec-rule finding should have spec-rule category, got %q", specRule.Category)
	}
}
