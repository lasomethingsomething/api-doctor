package rule

import (
	"strings"
	"testing"

	"github.com/lasomethingsomething/api-doctor/internal/openapi"
	"github.com/lasomethingsomething/api-doctor/internal/model"
)

func TestMissingRequestSchemaRule(t *testing.T) {
	r := NewMissingRequestSchemaRule()
	op := &model.Operation{
		Path:        "/products",
		Method:      "POST",
		OperationID: "createProduct",
		RequestBody: &model.RequestBody{Content: map[string]*model.MediaType{
			"application/json": {Schema: nil},
		}},
	}

	issues := r.Check(op)
	if len(issues) != 1 || issues[0].Code != "missing-request-schema" {
		t.Fatalf("expected missing-request-schema issue, got %#v", issues)
	}
}

func TestGenericObjectResponseRule(t *testing.T) {
	r := NewGenericObjectResponseRule()
	op := &model.Operation{
		Path:        "/users",
		Method:      "GET",
		OperationID: "listUsers",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{}},
					},
				},
			},
		},
	}

	issues := r.Check(op)
	if len(issues) != 1 || issues[0].Code != "generic-object-response" {
		t.Fatalf("expected generic-object-response issue, got %#v", issues)
	}
}

func TestDeprecatedOperationRule(t *testing.T) {
	r := NewDeprecatedOperationRule()
	op := &model.Operation{Path: "/x", Method: "PUT", OperationID: "update", Deprecated: true}

	issues := r.Check(op)
	if len(issues) != 1 || issues[0].Code != "deprecated-operation" {
		t.Fatalf("expected deprecated-operation issue, got %#v", issues)
	}
}

func TestWeakArrayItemsRule_MissingRequestItems(t *testing.T) {
	r := NewWeakArrayItemsRule()
	op := &model.Operation{
		Path:        "/sync",
		Method:      "POST",
		OperationID: "sync",
		RequestBody: &model.RequestBody{Content: map[string]*model.MediaType{
			"application/json": {Schema: &model.Schema{Type: "array"}},
		}},
	}

	issues := r.Check(op)
	if len(issues) != 1 || issues[0].Code != "weak-array-items-schema" {
		t.Fatalf("expected weak-array-items-schema issue, got %#v", issues)
	}
}

func TestWeakArrayItemsRule_GenericResponseItems(t *testing.T) {
	r := NewWeakArrayItemsRule()
	op := &model.Operation{
		Path:        "/items",
		Method:      "GET",
		OperationID: "listItems",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{
							Type:  "array",
							Items: &model.Schema{Type: "object", Properties: map[string]*model.Schema{}},
						},
					},
				},
			},
		},
	}

	issues := r.Check(op)
	if len(issues) != 1 || issues[0].Code != "weak-array-items-schema" {
		t.Fatalf("expected weak-array-items-schema issue, got %#v", issues)
	}
}

func TestWeakArrayItemsRule_StrongItemsNoIssue(t *testing.T) {
	r := NewWeakArrayItemsRule()
	op := &model.Operation{
		Path:        "/items",
		Method:      "GET",
		OperationID: "listItems",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{
							Type: "array",
							Items: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
								"id": {Type: "string"},
							}},
						},
					},
				},
			},
		},
	}

	issues := r.Check(op)
	if len(issues) != 0 {
		t.Fatalf("expected no issues, got %#v", issues)
	}
}

func TestChecker_CheckAll_ArrayItemsContrastFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/array-items-contrast.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from contrast fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "weak-array-items-schema" {
		t.Fatalf("expected weak-array-items-schema issue, got %#v", issue)
	}
	if issue.Path != "/weak-items" {
		t.Fatalf("expected weak endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "get listWeakItems (200)" {
		t.Fatalf("expected weak operation details, got %#v", issue)
	}
}

func TestChecker_CheckAll_LikelyMissingEnumFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/likely-missing-enum.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from enum fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "likely-missing-enum" {
		t.Fatalf("expected likely-missing-enum issue, got %#v", issue)
	}
	if issue.Path != "/weak-enum" {
		t.Fatalf("expected weak enum endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "get getWeakEnum (200)" {
		t.Fatalf("expected weak enum operation details, got %#v", issue)
	}
	if issue.Message == "" {
		t.Fatalf("expected descriptive issue message, got %#v", issue)
	}
}

func TestChecker_CheckAll_InconsistentResponseShapesFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/inconsistent-response-shapes.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "inconsistent-response-shape" {
			matched = append(matched, issue)
		}
	}
	if len(matched) != 2 {
		t.Fatalf("expected exactly 2 inconsistent-response-shape issues from fixture, got %#v", matched)
	}

	for _, issue := range matched {
		if issue.Code != "inconsistent-response-shape" {
			t.Fatalf("expected inconsistent-response-shape, got %#v", issue)
		}
		if issue.Path != "/weak-items/{id}" && issue.Path != "/weak-items/{itemId}" {
			t.Fatalf("expected only weak item endpoints to trigger, got %#v", issue)
		}
	}
}

func TestChecker_CheckAll_InconsistentResponseShapesFamilyFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/inconsistent-response-shapes-family.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "inconsistent-response-shape" {
			matched = append(matched, issue)
		}
	}
	if len(matched) != 2 {
		t.Fatalf("expected exactly 2 inconsistent-response-shape issues from family fixture, got %#v", matched)
	}

	for _, issue := range matched {
		if issue.Code != "inconsistent-response-shape" {
			t.Fatalf("expected inconsistent-response-shape, got %#v", issue)
		}
		if issue.Path != "/weak-items/by-id/{id}" && issue.Path != "/weak-items/by-code/{code}" {
			t.Fatalf("expected only weak family endpoints to trigger, got %#v", issue)
		}
	}
}

func TestChecker_CheckAll_DetailPathParameterNameDriftFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/detail-path-parameter-name-drift.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "detail-path-parameter-name-drift" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 2 {
		t.Fatalf("expected exactly 2 detail-path-parameter-name-drift issues, got %#v", matched)
	}

	for _, issue := range matched {
		if issue.Path != "/weak-items/{id}" && issue.Path != "/weak-items/{itemId}" {
			t.Fatalf("expected weak detail endpoints only, got %#v", issue)
		}
		if !strings.Contains(issue.Message, "id, itemId") {
			t.Fatalf("expected message to include drifted identifier names, got %#v", issue)
		}
	}
}

func TestChecker_CheckAll_EndpointPathStyleDriftFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/endpoint-path-style-drift.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "endpoint-path-style-drift" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 1 {
		t.Fatalf("expected exactly 1 endpoint-path-style-drift issue, got %#v", matched)
	}

	issue := matched[0]
	if issue.Path != "/catalog/{id}/media_upload" {
		t.Fatalf("expected only the non-dominant snake_case endpoint to be flagged, got %#v", issue)
	}
	if !strings.Contains(issue.Message, "dominant: kebab-case") {
		t.Fatalf("expected dominant-style hint in message, got %#v", issue)
	}
	if strings.Contains(issue.Path, "/_action/") || strings.Contains(issue.Path, "/search/") {
		t.Fatalf("expected excluded prefixes to be ignored, got %#v", issue)
	}
}

func TestChecker_CheckAll_SiblingPathShapeDriftFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/sibling-path-shape-drift.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "sibling-path-shape-drift" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 1 {
		t.Fatalf("expected exactly 1 sibling-path-shape-drift issue, got %#v", matched)
	}

	issue := matched[0]
	if issue.Path != "/catalog/{id}/detail" {
		t.Fatalf("expected only minority catalog shape endpoint to be flagged, got %#v", issue)
	}
	if !strings.Contains(issue.Message, "mostly use shape") {
		t.Fatalf("expected plain-language dominant-vs-observed message, got %#v", issue)
	}
	if strings.Contains(issue.Path, "/_action/") || strings.Contains(issue.Path, "/search/") {
		t.Fatalf("expected excluded families to be ignored, got %#v", issue)
	}
}

func TestChecker_CheckAll_WeakFollowUpLinkageFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/weak-follow-up-linkage.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from follow-up linkage fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "weak-follow-up-linkage" {
		t.Fatalf("expected weak-follow-up-linkage issue, got %#v", issue)
	}
	if issue.Path != "/weak-items" {
		t.Fatalf("expected only weak list endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "post createWeakItem (200)" {
		t.Fatalf("expected weak create operation details, got %#v", issue)
	}
}

func TestChecker_CheckAll_WeakListDetailLinkageFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/weak-list-detail-linkage.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from list-detail linkage fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "weak-list-detail-linkage" {
		t.Fatalf("expected weak-list-detail-linkage issue, got %#v", issue)
	}
	if issue.Path != "/weak-items/search" {
		t.Fatalf("expected only weak search endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "post searchWeakItems (200)" {
		t.Fatalf("expected weak search operation details, got %#v", issue)
	}
}

func TestChecker_CheckAll_WeakAcceptedTrackingLinkageFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/weak-accepted-tracking-linkage.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from accepted tracking fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "weak-accepted-tracking-linkage" {
		t.Fatalf("expected weak-accepted-tracking-linkage issue, got %#v", issue)
	}
	if issue.Path != "/imports/run" {
		t.Fatalf("expected only weak accepted endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "post startWeakImport (202)" {
		t.Fatalf("expected weak accepted operation details, got %#v", issue)
	}
	if issue.Message == "" {
		t.Fatalf("expected descriptive accepted tracking message, got %#v", issue)
	}
}

func TestChecker_CheckAll_WeakActionFollowUpLinkageFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/weak-action-follow-up-linkage.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from action follow-up fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "weak-action-follow-up-linkage" {
		t.Fatalf("expected weak-action-follow-up-linkage issue, got %#v", issue)
	}
	if issue.Path != "/_action/order/{orderId}/state/{transition}" {
		t.Fatalf("expected only weak action endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "post transitionWeakOrder (200)" {
		t.Fatalf("expected weak action operation details, got %#v", issue)
	}
	if issue.Message == "" {
		t.Fatalf("expected descriptive action follow-up message, got %#v", issue)
	}
}

func TestChecker_CheckAll_PrerequisiteTaskBurdenFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/prerequisite-task-burden.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "prerequisite-task-burden" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 4 {
		t.Fatalf("expected exactly 4 prerequisite-task-burden issues from fixture, got %#v", matched)
	}

	byPath := map[string]*model.Issue{}
	for _, issue := range matched {
		byPath[issue.Path] = issue
		if issue.Severity != "warning" {
			t.Fatalf("expected warning severity for burden issue, got %#v", issue)
		}
		if !strings.Contains(issue.Message, "appears likely") {
			t.Fatalf("expected cautious wording in message, got %#v", issue)
		}
	}

	for _, expectedPath := range []string{
		"/products",
		"/products/{id}",
		"/_action/order/{orderId}/state/{transition}",
		"/products/{id}/media",
	} {
		if _, ok := byPath[expectedPath]; !ok {
			t.Fatalf("expected prerequisite-task-burden issue for %s, got %#v", expectedPath, matched)
		}
	}

	if _, ok := byPath["/profiles/{id}"]; ok {
		t.Fatalf("did not expect task-level update endpoint to be flagged, got %#v", byPath["/profiles/{id}"])
	}

	createIssue := byPath["/products"]
	if !strings.Contains(createIssue.Message, "requires") || !strings.Contains(createIssue.Message, "identifier-like inputs") {
		t.Fatalf("expected dependent identifier count reason for create flow, got %#v", createIssue)
	}
	if !strings.Contains(createIssue.Message, "likely needs pre-task identifier lookup") {
		t.Fatalf("expected pre-task lookup reason for create flow, got %#v", createIssue)
	}
	if !strings.Contains(createIssue.Message, "does not clearly expose") {
		t.Fatalf("expected weak follow-up exposure reason for create flow, got %#v", createIssue)
	}
}

func TestChecker_CheckAll_ContractShapeWorkflowGuidanceBurdenFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/contract-shape-workflow-guidance-burden.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "contract-shape-workflow-guidance-burden" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 1 {
		t.Fatalf("expected exactly 1 representative contract-shape-workflow-guidance-burden issue from fixture, got %#v", matched)
	}

	byPath := map[string]*model.Issue{}
	for _, issue := range matched {
		byPath[issue.Path] = issue
		if issue.Severity != "warning" {
			t.Fatalf("expected warning severity, got %#v", issue)
		}
		if !strings.Contains(issue.Message, "appears likely") {
			t.Fatalf("expected cautious wording in message, got %#v", issue)
		}
	}

	if _, ok := byPath["/products/{id}/sync"]; !ok {
		if _, ok := byPath["/media/{id}/replace"]; !ok {
			t.Fatalf("expected representative issue for one storage-shaped endpoint, got %#v", matched)
		}
	}

	if _, ok := byPath["/orders/{id}/cancel"]; ok {
		t.Fatalf("did not expect task-shaped cancel response to be flagged, got %#v", byPath["/orders/{id}/cancel"])
	}
	if _, ok := byPath["/profiles/{id}"]; ok {
		t.Fatalf("did not expect small update response to be flagged, got %#v", byPath["/profiles/{id}"])
	}

	selected := byPath["/products/{id}/sync"]
	if selected == nil {
		selected = byPath["/media/{id}/replace"]
	}
	message := selected.Message
	if !strings.Contains(message, "snapshot-heavy") {
		t.Fatalf("expected snapshot-heavy reason, got %#v", selected)
	}
	if !strings.Contains(message, "internal-looking") {
		t.Fatalf("expected internal exposure reason, got %#v", selected)
	}
}
