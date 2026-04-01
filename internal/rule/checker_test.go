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
