package rule

import (
	"testing"

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
