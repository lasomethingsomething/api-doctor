package rule

import (
	"fmt"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

type Checker struct {
	rules []Rule
}

type Rule interface {
	Check(op *model.Operation) []*model.Issue
	Name() string
}

func NewChecker() *Checker {
	return &Checker{rules: []Rule{
		NewMissingRequestSchemaRule(),
		NewMissingResponseSchemaRule(),
		NewGenericObjectRequestRule(),
		NewGenericObjectResponseRule(),
		NewWeakArrayItemsRule(),
		NewDeprecatedOperationRule(),
	}}
}

func (c *Checker) CheckAll(operations []*model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		for _, r := range c.rules {
			issues = append(issues, r.Check(op)...)
		}
	}
	return issues
}

type MissingRequestSchemaRule struct{}

func NewMissingRequestSchemaRule() *MissingRequestSchemaRule { return &MissingRequestSchemaRule{} }
func (r *MissingRequestSchemaRule) Name() string            { return "missing-request-schema" }

func (r *MissingRequestSchemaRule) Check(op *model.Operation) []*model.Issue {
	if op.RequestBody == nil {
		return nil
	}
	issues := make([]*model.Issue, 0)
	for mtName, mt := range op.RequestBody.Content {
		if mt == nil || mt.Schema == nil {
			issues = append(issues, &model.Issue{
				Code:        r.Name(),
				Severity:    "error",
				Path:        op.Path,
				Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
				Message:     fmt.Sprintf("Request body has no schema for media type '%s'", mtName),
				Description: "Request bodies should have a defined schema to describe the expected structure",
			})
		}
	}
	return issues
}

type MissingResponseSchemaRule struct{}

func NewMissingResponseSchemaRule() *MissingResponseSchemaRule { return &MissingResponseSchemaRule{} }
func (r *MissingResponseSchemaRule) Name() string              { return "missing-response-schema" }

func (r *MissingResponseSchemaRule) Check(op *model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)
	for code, resp := range op.Responses {
		if resp == nil {
			continue
		}
		for mtName, mt := range resp.Content {
			if mt == nil || mt.Schema == nil {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "error",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
					Message:     fmt.Sprintf("Response %s has no schema for media type '%s'", code, mtName),
					Description: "Responses with content should have a defined schema to describe the response structure",
				})
			}
		}
	}
	return issues
}

type GenericObjectRequestRule struct{}

func NewGenericObjectRequestRule() *GenericObjectRequestRule { return &GenericObjectRequestRule{} }
func (r *GenericObjectRequestRule) Name() string             { return "generic-object-request" }

func (r *GenericObjectRequestRule) Check(op *model.Operation) []*model.Issue {
	if op.RequestBody == nil {
		return nil
	}
	issues := make([]*model.Issue, 0)
	for _, mt := range op.RequestBody.Content {
		if mt != nil && isGenericObject(mt.Schema) {
			issues = append(issues, &model.Issue{
				Code:        r.Name(),
				Severity:    "warning",
				Path:        op.Path,
				Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
				Message:     "Request body uses a generic object type without properties",
				Description: "Define specific properties in the request schema instead of using a generic object",
			})
		}
	}
	return issues
}

type GenericObjectResponseRule struct{}

func NewGenericObjectResponseRule() *GenericObjectResponseRule { return &GenericObjectResponseRule{} }
func (r *GenericObjectResponseRule) Name() string              { return "generic-object-response" }

func (r *GenericObjectResponseRule) Check(op *model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)
	for code, resp := range op.Responses {
		if resp == nil {
			continue
		}
		for _, mt := range resp.Content {
			if mt != nil && isGenericObject(mt.Schema) {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "warning",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
					Message:     "Response uses a generic object type without properties",
					Description: "Define specific properties in the response schema instead of using a generic object",
				})
			}
		}
	}
	return issues
}

type WeakArrayItemsRule struct{}

func NewWeakArrayItemsRule() *WeakArrayItemsRule { return &WeakArrayItemsRule{} }
func (r *WeakArrayItemsRule) Name() string       { return "weak-array-items-schema" }

func (r *WeakArrayItemsRule) Check(op *model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)

	if op.RequestBody != nil {
		for mtName, mt := range op.RequestBody.Content {
			if mt != nil && hasWeakArrayItems(mt.Schema) {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "warning",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
					Message:     fmt.Sprintf("Request body array has missing or overly generic items schema for media type '%s'", mtName),
					Description: "Generated clients depend on array item schemas for strong typing; weak item definitions often become loosely typed collections.",
				})
			}
		}
	}

	for code, resp := range op.Responses {
		if resp == nil {
			continue
		}
		for mtName, mt := range resp.Content {
			if mt != nil && hasWeakArrayItems(mt.Schema) {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "warning",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
					Message:     fmt.Sprintf("Response array has missing or overly generic items schema for media type '%s'", mtName),
					Description: "Generated clients depend on array item schemas for strong typing; weak item definitions often become loosely typed collections.",
				})
			}
		}
	}

	return issues
}

type DeprecatedOperationRule struct{}

func NewDeprecatedOperationRule() *DeprecatedOperationRule { return &DeprecatedOperationRule{} }
func (r *DeprecatedOperationRule) Name() string            { return "deprecated-operation" }

func (r *DeprecatedOperationRule) Check(op *model.Operation) []*model.Issue {
	if !op.Deprecated {
		return nil
	}
	return []*model.Issue{{
		Code:        r.Name(),
		Severity:    "warning",
		Path:        op.Path,
		Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
		Message:     "Operation is marked as deprecated",
		Description: "This operation is deprecated and should not be used for new integrations. Check the API documentation for recommended alternatives.",
	}}
}

func isGenericObject(schema *model.Schema) bool {
	if schema == nil {
		return false
	}
	return schema.Type == "object" && len(schema.Properties) == 0 && schema.Ref == ""
}

func hasWeakArrayItems(schema *model.Schema) bool {
	if schema == nil || schema.Type != "array" {
		return false
	}
	if schema.Items == nil {
		return true
	}
	if schema.Items.Ref != "" {
		return false
	}
	if schema.Items.Type == "" {
		return true
	}
	if isGenericObject(schema.Items) {
		return true
	}
	return false
}
