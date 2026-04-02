package report

import (
	"strings"
	"testing"

	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/model"
)

func TestFormatText_NoIssues(t *testing.T) {
	result := &model.AnalysisResult{SpecFile: "spec.json", Operations: []*model.Operation{}}
	scores := make(map[string]*endpoint.EndpointScore)
	out := FormatText(result, scores, false)
	if !strings.Contains(out, "No issues found") {
		t.Fatalf("expected no-issues message, got: %s", out)
	}
}

func TestFormatText_VerboseIncludesTechnicalDetail(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{{
			Code:        "missing-response-schema",
			Severity:    "error",
			Path:        "/products/{id}",
			Operation:   "put updateProduct",
			Message:     "Response 200 has no schema for media type 'application/json'",
			Description: "Responses with content should have a defined schema to describe the response structure",
		}},
	}

	scores := make(map[string]*endpoint.EndpointScore)
	out := FormatText(result, scores, true)
	if !strings.Contains(out, "Why it matters:") {
		t.Fatalf("expected why-it-matters explanation, got: %s", out)
	}
	if !strings.Contains(out, "Technical detail:") {
		t.Fatalf("expected technical detail in verbose output, got: %s", out)
	}
}

func TestFormatJSON_WithIssues(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Operations: []*model.Operation{},
		Issues: []*model.Issue{{
			Code:      "deprecated-operation",
			Severity:  "warning",
			Path:      "/products/{id}",
			Operation: "PUT updateProduct",
			Message:   "Operation is marked as deprecated",
		}},
	}

	scores := make(map[string]*endpoint.EndpointScore)
	out, err := FormatJSON(result, scores)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "deprecated-operation") || !strings.Contains(out, "warning") {
		t.Fatalf("expected issue in json output, got: %s", out)
	}
}

func TestFormatAnalysisMarkdown_IncludesSummaryAndIssueDetails(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Operations: []*model.Operation{
			{Method: "get", Path: "/products"},
		},
		Issues: []*model.Issue{
			{
				Code:        "deprecated-operation",
				Severity:    "warning",
				Path:        "/products/{id}",
				Operation:   "PUT updateProduct",
				Description: "Deprecated endpoint should be replaced.",
				Message:     "Operation is marked as deprecated",
			},
		},
	}

	scores := map[string]*endpoint.EndpointScore{
		"get|/products": {
			SchemaCompleteness:       5,
			ClientGenerationQuality: 4,
			VersioningSafety:        3,
		},
	}

	out := FormatAnalysisMarkdown(result, scores)
	if !strings.Contains(out, "# API Analysis Report") {
		t.Fatalf("expected markdown title, got: %s", out)
	}
	if !strings.Contains(out, "## Summary") || !strings.Contains(out, "| WARNING | 1 |") {
		t.Fatalf("expected markdown summary table with warning count, got: %s", out)
	}
	if !strings.Contains(out, "## Endpoint Quality Summary") || !strings.Contains(out, "| Schema Completeness | 1 | 0 | 0 | 0 |") {
		t.Fatalf("expected endpoint quality markdown section, got: %s", out)
	}
	if !strings.Contains(out, "### `deprecated-operation`") || !strings.Contains(out, "**Impact:** Deprecated endpoint should be replaced.") {
		t.Fatalf("expected grouped issue details in markdown output, got: %s", out)
	}
}

func TestFormatText_GroupsWeakAcceptedTrackingInDefaultOutput(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{
			{
				Code:        "weak-accepted-tracking-linkage",
				Severity:    "warning",
				Path:        "/flow/import",
				Operation:   "post startFlowImport (202)",
				Message:     "202 Accepted response has no JSON body to expose a tracking identifier",
				Description: "Accepted-now-check-later workflows are harder to automate when the initiating response does not clearly show how to track completion.",
			},
			{
				Code:        "weak-accepted-tracking-linkage",
				Severity:    "warning",
				Path:        "/flow/export",
				Operation:   "post startFlowExport (202)",
				Message:     "202 Accepted response has no JSON body to expose a tracking identifier",
				Description: "Accepted-now-check-later workflows are harder to automate when the initiating response does not clearly show how to track completion.",
			},
			{
				Code:        "weak-accepted-tracking-linkage",
				Severity:    "warning",
				Path:        "/rule/preview",
				Operation:   "post previewRule (202)",
				Message:     "202 Accepted response body does not clearly expose a tracking identifier such as id, jobId, taskId, processId, operationId, runId",
				Description: "Accepted-now-check-later workflows are harder to automate when the initiating response does not clearly show how to track completion.",
			},
			{
				Code:        "weak-accepted-tracking-linkage",
				Severity:    "warning",
				Path:        "/tax-provider/check",
				Operation:   "post checkTaxProvider (202)",
				Message:     "202 Accepted response body does not clearly expose a tracking identifier such as id, jobId, taskId, processId, operationId, runId",
				Description: "Accepted-now-check-later workflows are harder to automate when the initiating response does not clearly show how to track completion.",
			},
			{
				Code:        "deprecated-operation",
				Severity:    "warning",
				Path:        "/products/{id}",
				Operation:   "PUT updateProduct",
				Message:     "Operation is marked as deprecated",
				Description: "This operation is deprecated and should not be used for new integrations. Check the API documentation for recommended alternatives.",
			},
		},
	}

	scores := make(map[string]*endpoint.EndpointScore)
	out := FormatText(result, scores, false)
	if !strings.Contains(out, "Workflow self-descriptiveness signal: 4 endpoints across 3 endpoint families.") {
		t.Fatalf("expected grouped accepted-tracking summary, got: %s", out)
	}
	if !strings.Contains(out, "Pattern: 202 Accepted responses with no JSON tracking payload") {
		t.Fatalf("expected grouped no-json pattern, got: %s", out)
	}
	if !strings.Contains(out, "Pattern: 202 Accepted JSON responses with no clear tracking identifier") {
		t.Fatalf("expected grouped json-body pattern, got: %s", out)
	}
	if !strings.Contains(out, "Sample families: /flow (2)") {
		t.Fatalf("expected family summary, got: %s", out)
	}
	if !strings.Contains(out, "[WARNING] deprecated-operation") {
		t.Fatalf("expected other warnings to remain itemized, got: %s", out)
	}
	if strings.Count(out, "[WARNING] weak-accepted-tracking-linkage") != 1 {
		t.Fatalf("expected accepted-tracking warning to be grouped once, got: %s", out)
	}
	if strings.Contains(out, "Endpoint: post startFlowImport (202) /flow/import") {
		t.Fatalf("expected accepted-tracking endpoints to be summarized by default, got: %s", out)
	}
	if !strings.Contains(out, "Sample endpoints: post previewRule (202) /rule/preview; post checkTaxProvider (202) /tax-provider/check") {
		t.Fatalf("expected summarized sample endpoints, got: %s", out)
	}
}

func TestFormatText_VerboseKeepsFullWeakAcceptedTrackingDetails(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{
			{
				Code:        "weak-accepted-tracking-linkage",
				Severity:    "warning",
				Path:        "/imports/run",
				Operation:   "post startWeakImport (202)",
				Message:     "202 Accepted response has no JSON body to expose a tracking identifier",
				Description: "Accepted-now-check-later workflows are harder to automate when the initiating response does not clearly show how to track completion.",
			},
			{
				Code:        "weak-accepted-tracking-linkage",
				Severity:    "warning",
				Path:        "/exports/run",
				Operation:   "post startWeakExport (202)",
				Message:     "202 Accepted response body does not clearly expose a tracking identifier such as id, jobId, taskId, processId, operationId, runId",
				Description: "Accepted-now-check-later workflows are harder to automate when the initiating response does not clearly show how to track completion.",
			},
		},
	}

	scores := make(map[string]*endpoint.EndpointScore)
	out := FormatText(result, scores, true)
	if strings.Contains(out, "Workflow self-descriptiveness signal:") {
		t.Fatalf("expected verbose output to keep full issue detail instead of grouped summary, got: %s", out)
	}
	if !strings.Contains(out, "Endpoint: post startWeakImport (202) /imports/run") {
		t.Fatalf("expected verbose endpoint detail for first accepted-tracking issue, got: %s", out)
	}
	if !strings.Contains(out, "Endpoint: post startWeakExport (202) /exports/run") {
		t.Fatalf("expected verbose endpoint detail for second accepted-tracking issue, got: %s", out)
	}
	if strings.Count(out, "[WARNING] weak-accepted-tracking-linkage") != 2 {
		t.Fatalf("expected verbose output to keep both accepted-tracking findings, got: %s", out)
	}
}

func TestFormatText_GroupsWeakFollowUpLinkageInDefaultOutput(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{
			{
				Code:        "weak-follow-up-linkage",
				Severity:    "warning",
				Path:        "/flow",
				Operation:   "post createFlow (200)",
				Message:     "Response does not clearly expose a follow-up identifier for related detail endpoint(s): id",
				Description: "Two-step flows are harder to automate when a collection or create response does not visibly provide the identifier needed for the next endpoint.",
			},
			{
				Code:        "weak-follow-up-linkage",
				Severity:    "warning",
				Path:        "/flow-template",
				Operation:   "post createFlowTemplate (200)",
				Message:     "Response does not clearly expose a follow-up identifier for related detail endpoint(s): id",
				Description: "Two-step flows are harder to automate when a collection or create response does not visibly provide the identifier needed for the next endpoint.",
			},
			{
				Code:        "weak-follow-up-linkage",
				Severity:    "warning",
				Path:        "/rule",
				Operation:   "post createRule (200)",
				Message:     "Response does not clearly expose a follow-up identifier for related detail endpoint(s): id, ruleId",
				Description: "Two-step flows are harder to automate when a collection or create response does not visibly provide the identifier needed for the next endpoint.",
			},
			{
				Code:        "deprecated-operation",
				Severity:    "warning",
				Path:        "/products/{id}",
				Operation:   "PUT updateProduct",
				Message:     "Operation is marked as deprecated",
				Description: "This operation is deprecated and should not be used for new integrations. Check the API documentation for recommended alternatives.",
			},
		},
	}

	scores := make(map[string]*endpoint.EndpointScore)
	out := FormatText(result, scores, false)
	if !strings.Contains(out, "[WARNING] weak-follow-up-linkage") {
		t.Fatalf("expected grouped follow-up summary, got: %s", out)
	}
	if !strings.Contains(out, "Workflow self-descriptiveness signal: 3 endpoints across 3 endpoint families.") {
		t.Fatalf("expected follow-up summary count, got: %s", out)
	}
	if !strings.Contains(out, "Pattern: Follow-up identifier not clearly exposed for id") {
		t.Fatalf("expected grouped follow-up pattern for id, got: %s", out)
	}
	if !strings.Contains(out, "Pattern: Follow-up identifier not clearly exposed for id, ruleId") {
		t.Fatalf("expected grouped follow-up pattern for id, ruleId, got: %s", out)
	}
	if strings.Contains(out, "Endpoint: post createFlow (200) /flow") {
		t.Fatalf("expected follow-up endpoints to be summarized by default, got: %s", out)
	}
	if !strings.Contains(out, "Sample endpoints: post createFlow (200) /flow; post createFlowTemplate (200) /flow-template") {
		t.Fatalf("expected summarized follow-up sample endpoints, got: %s", out)
	}
	if !strings.Contains(out, "[WARNING] deprecated-operation") {
		t.Fatalf("expected unrelated warnings to remain itemized, got: %s", out)
	}
	if strings.Count(out, "[WARNING] weak-follow-up-linkage") != 1 {
		t.Fatalf("expected follow-up warning to be grouped once, got: %s", out)
	}
	if !strings.Contains(out, "Sample families: /flow (1), /flow-template (1)") {
		t.Fatalf("expected follow-up family summary, got: %s", out)
	}
	if !strings.Contains(out, "Sample families: /rule (1)") {
		t.Fatalf("expected second grouped family summary, got: %s", out)
	}
	if strings.Contains(out, "Technical detail:") {
		t.Fatalf("expected default output to omit technical detail, got: %s", out)
	}
}

func TestFormatText_VerboseKeepsFullWeakFollowUpDetails(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{
			{
				Code:        "weak-follow-up-linkage",
				Severity:    "warning",
				Path:        "/imports",
				Operation:   "post createImport (200)",
				Message:     "Response does not clearly expose a follow-up identifier for related detail endpoint(s): id",
				Description: "Two-step flows are harder to automate when a collection or create response does not visibly provide the identifier needed for the next endpoint.",
			},
			{
				Code:        "weak-follow-up-linkage",
				Severity:    "warning",
				Path:        "/exports",
				Operation:   "post createExport (200)",
				Message:     "Response does not clearly expose a follow-up identifier for related detail endpoint(s): id, exportId",
				Description: "Two-step flows are harder to automate when a collection or create response does not visibly provide the identifier needed for the next endpoint.",
			},
		},
	}

	scores := make(map[string]*endpoint.EndpointScore)
	out := FormatText(result, scores, true)
	if strings.Contains(out, "Workflow self-descriptiveness signal:") {
		t.Fatalf("expected verbose output to keep full issue detail instead of grouped follow-up summary, got: %s", out)
	}
	if !strings.Contains(out, "Endpoint: post createImport (200) /imports") {
		t.Fatalf("expected verbose endpoint detail for first follow-up issue, got: %s", out)
	}
	if !strings.Contains(out, "Endpoint: post createExport (200) /exports") {
		t.Fatalf("expected verbose endpoint detail for second follow-up issue, got: %s", out)
	}
	if strings.Count(out, "[WARNING] weak-follow-up-linkage") != 2 {
		t.Fatalf("expected verbose output to keep both follow-up findings, got: %s", out)
	}
	if !strings.Contains(out, "Technical detail: Response does not clearly expose a follow-up identifier for related detail endpoint(s): id") {
		t.Fatalf("expected verbose technical detail for follow-up issue, got: %s", out)
	}
}

func TestFormatText_DefaultShowsShapeDetailForSiblingPathShapeDrift(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{
			{
				Code:        "sibling-path-shape-drift",
				Severity:    "warning",
				Path:        "/app-system/{appName}/privileges/accepted",
				Operation:   "get getAcceptedPrivileges",
				Message:     "Sibling endpoints in 'GET /app-system' mostly use shape '3 segments (static -> static -> static)', but this endpoint uses '4 segments (static -> param -> static -> static)'",
				Description: "Sibling endpoints are easier to discover and automate when they follow one dominant path shape within a method and family.",
			},
		},
	}

	scores := make(map[string]*endpoint.EndpointScore)
	out := FormatText(result, scores, false)
	if !strings.Contains(out, "[WARNING] sibling-path-shape-drift") {
		t.Fatalf("expected sibling-path-shape-drift warning entry, got: %s", out)
	}
	if !strings.Contains(out, "Shape detail: Sibling endpoints in 'GET /app-system' mostly use shape") {
		t.Fatalf("expected dominant-vs-observed shape detail in default output, got: %s", out)
	}
	if strings.Contains(out, "Technical detail:") {
		t.Fatalf("expected default output to remain non-verbose, got: %s", out)
	}
}

func TestFormatText_GroupsPrerequisiteTaskBurdenInDefaultOutput(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{
			{
				Code:        "prerequisite-task-burden",
				Severity:    "warning",
				Path:        "/products",
				Operation:   "post createProduct",
				Message:     "high prerequisite burden appears likely: requires 3 identifier-like inputs (body.manufacturerId, body.taxId, path.id)",
				Description: "Task likely requires extra coordination.",
			},
			{
				Code:        "prerequisite-task-burden",
				Severity:    "warning",
				Path:        "/products/{id}/media",
				Operation:   "post addProductMedia",
				Message:     "medium prerequisite burden appears likely: requires 2 identifier-like inputs (body.mediaId, path.id)",
				Description: "Task likely requires extra coordination.",
			},
			{
				Code:        "deprecated-operation",
				Severity:    "warning",
				Path:        "/products/{id}",
				Operation:   "put updateProduct",
				Message:     "Operation is marked as deprecated",
				Description: "Deprecated endpoint should be replaced.",
			},
		},
	}

	scores := make(map[string]*endpoint.EndpointScore)
	out := FormatText(result, scores, false)
	if !strings.Contains(out, "[WARNING] prerequisite-task-burden (task burden signal)") {
		t.Fatalf("expected grouped burden signal summary, got: %s", out)
	}
	if !strings.Contains(out, "Prerequisite burden signal: 2 endpoints across 1 endpoint families.") {
		t.Fatalf("expected burden count summary, got: %s", out)
	}
	if !strings.Contains(out, "Burden levels: high=1, medium=1, low=0") {
		t.Fatalf("expected burden level breakdown, got: %s", out)
	}
	if strings.Contains(out, "Endpoint: post createProduct /products") {
		t.Fatalf("expected grouped burden issues to be summarized in default output, got: %s", out)
	}
	if !strings.Contains(out, "[WARNING] deprecated-operation") {
		t.Fatalf("expected non-burden warning to stay itemized, got: %s", out)
	}
}

func TestFormatAnalysisMarkdown_UsesTaskBurdenLabel(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Operations: []*model.Operation{
			{Method: "post", Path: "/products"},
		},
		Issues: []*model.Issue{
			{
				Code:        "prerequisite-task-burden",
				Severity:    "warning",
				Path:        "/products",
				Operation:   "post createProduct",
				Description: "Task likely requires extra coordination.",
				Message:     "high prerequisite burden appears likely: requires 3 identifier-like inputs",
			},
		},
	}

	out := FormatAnalysisMarkdown(result, map[string]*endpoint.EndpointScore{})
	if !strings.Contains(out, "### `prerequisite-task-burden (task burden signal)`") {
		t.Fatalf("expected markdown burden label to be plain-language friendly, got: %s", out)
	}
}
