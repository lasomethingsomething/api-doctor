package rule

import (
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
	if len(issues) != 2 {
		t.Fatalf("expected exactly 2 issues from inconsistent response fixture, got %#v", issues)
	}

	for _, issue := range issues {
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
	if len(issues) != 2 {
		t.Fatalf("expected exactly 2 issues from family fixture, got %#v", issues)
	}

	for _, issue := range issues {
		if issue.Code != "inconsistent-response-shape" {
			t.Fatalf("expected inconsistent-response-shape, got %#v", issue)
		}
		if issue.Path != "/weak-items/by-id/{id}" && issue.Path != "/weak-items/by-code/{code}" {
			t.Fatalf("expected only weak family endpoints to trigger, got %#v", issue)
		}
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
