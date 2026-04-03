package rule

// spec_rules.go — OpenAPI-normative findings.
//
// Each rule implemented here is grounded in an explicit MUST, MUST NOT,
// REQUIRED, SHOULD, SHOULD NOT, or RECOMMENDED statement from the OpenAPI
// Specification 3.x. Findings from this file carry EvidenceType "spec-rule"
// and a stable SpecRuleID.
//
// Severity mapping (for spec-grounded findings only):
//   - error   → REQUIRED or MUST/MUST NOT violation
//   - warning → SHOULD/SHOULD NOT/RECOMMENDED concern, or strong interoperability risk
//   - info    → lower-confidence spec-adjacent observation
//
// Do NOT apply this severity mapping to heuristic burden rules.

import (
	"fmt"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

// specIssue builds a model.Issue with all spec-rule fields populated.
func specIssue(code, ruleID, level, source, location, severity, path, operation, message, description string) *model.Issue {
	return &model.Issue{
		Code:           code,
		Severity:       severity,
		Path:           path,
		Operation:      operation,
		Message:        message,
		Description:    description,
		EvidenceType:   "spec-rule",
		SpecRuleID:     ruleID,
		NormativeLevel: level,
		SpecSource:     source,
		SpecLocation:   location,
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// OAS-RESPONSE-DESCRIPTION-REQUIRED
//
// OAS 3.0 Response Object: "description — REQUIRED. A description of the response."
// OAS 3.1 retained this as a REQUIRED field.
// Severity: error (REQUIRED)
// ─────────────────────────────────────────────────────────────────────────────

type SpecResponseDescriptionRequiredRule struct{}

func NewSpecResponseDescriptionRequiredRule() *SpecResponseDescriptionRequiredRule {
	return &SpecResponseDescriptionRequiredRule{}
}
func (r *SpecResponseDescriptionRequiredRule) Name() string {
	return "oas-response-description-required"
}

func (r *SpecResponseDescriptionRequiredRule) Check(op *model.Operation) []*model.Issue {
	var issues []*model.Issue
	for code, resp := range op.Responses {
		if resp == nil || resp.Description != "" {
			continue
		}
		location := fmt.Sprintf("%s response at %s %s", code, strings.ToUpper(op.Method), op.Path)
		issues = append(issues, specIssue(
			r.Name(),
			"OAS-RESPONSE-DESCRIPTION-REQUIRED",
			"REQUIRED",
			"Response Object",
			location,
			"error",
			op.Path,
			fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			fmt.Sprintf("Response %s is missing a description (REQUIRED field in the OpenAPI Response Object)", code),
			"The OpenAPI specification defines 'description' as a REQUIRED field on every Response Object. Tooling that generates documentation or client SDKs may fail or produce empty stubs when this field is absent.",
		))
	}
	return issues
}

// ─────────────────────────────────────────────────────────────────────────────
// OAS-OPERATION-ID-UNIQUE
//
// OAS 3.0 Operation Object: "operationId — … The id MUST be unique among all
// operations described in the API."
// Severity: error (MUST)
// ─────────────────────────────────────────────────────────────────────────────

type SpecOperationIDUniqueRule struct{}

func NewSpecOperationIDUniqueRule() *SpecOperationIDUniqueRule {
	return &SpecOperationIDUniqueRule{}
}
func (r *SpecOperationIDUniqueRule) Name() string { return "oas-operation-id-unique" }

func (r *SpecOperationIDUniqueRule) CheckAll(operations []*model.Operation) []*model.Issue {
	seen := map[string][]string{} // operationId → list of "METHOD path"
	for _, op := range operations {
		if op.OperationID == "" {
			continue
		}
		key := strings.ToLower(op.OperationID)
		seen[key] = append(seen[key], strings.ToUpper(op.Method)+" "+op.Path)
	}

	var issues []*model.Issue
	for _, op := range operations {
		if op.OperationID == "" {
			continue
		}
		key := strings.ToLower(op.OperationID)
		duplicates := seen[key]
		if len(duplicates) < 2 {
			continue
		}
		location := fmt.Sprintf("operationId '%s' at %s %s", op.OperationID, strings.ToUpper(op.Method), op.Path)
		issues = append(issues, specIssue(
			r.Name(),
			"OAS-OPERATION-ID-UNIQUE",
			"MUST",
			"Operation Object",
			location,
			"error",
			op.Path,
			fmt.Sprintf("%s %s", op.Method, op.OperationID),
			fmt.Sprintf("operationId '%s' is duplicated across %d operations: %s", op.OperationID, len(duplicates), strings.Join(duplicates, ", ")),
			"The OpenAPI specification states that operationId MUST be unique across all operations. Duplicate IDs break SDK generation, server-stub generation, and tooling that routes by operation name.",
		))
	}
	return issues
}

// ─────────────────────────────────────────────────────────────────────────────
// OAS-NO-SUCCESS-RESPONSE
//
// OAS 3.0 Responses Object: "… if only one response code is supplied it
// SHOULD be the response for a successful operation."
// Also: any operation MUST document at least one response.
// No 2xx defined is not a MUST violation per se, but a strong SHOULD concern.
// Severity: warning (SHOULD)
// ─────────────────────────────────────────────────────────────────────────────

type SpecNoSuccessResponseRule struct{}

func NewSpecNoSuccessResponseRule() *SpecNoSuccessResponseRule {
	return &SpecNoSuccessResponseRule{}
}
func (r *SpecNoSuccessResponseRule) Name() string { return "oas-no-success-response" }

func (r *SpecNoSuccessResponseRule) Check(op *model.Operation) []*model.Issue {
	if len(op.Responses) == 0 {
		// No responses at all — stronger than just missing 2xx; still warning here
		// because the parser may not capture every inline format.
		location := fmt.Sprintf("%s %s", strings.ToUpper(op.Method), op.Path)
		return []*model.Issue{specIssue(
			r.Name(),
			"OAS-NO-SUCCESS-RESPONSE",
			"SHOULD",
			"Responses Object",
			location,
			"warning",
			op.Path,
			fmt.Sprintf("%s %s", op.Method, op.OperationID),
			"Operation defines no responses at all",
			"The OpenAPI Responses Object SHOULD include at least one successful response code. An operation with no responses defined cannot be correctly integrated by client generators or documentation tools.",
		)}
	}
	for code := range op.Responses {
		if len(code) == 3 && code[0] == '2' {
			return nil
		}
		if code == "default" {
			// 'default' can serve as a wildcard success response; treat as satisfying
			return nil
		}
	}
	location := fmt.Sprintf("%s %s (responses: %s)", strings.ToUpper(op.Method), op.Path, sortedResponseCodes(op.Responses))
	return []*model.Issue{specIssue(
		r.Name(),
		"OAS-NO-SUCCESS-RESPONSE",
		"SHOULD",
		"Responses Object",
		location,
		"warning",
		op.Path,
		fmt.Sprintf("%s %s", op.Method, op.OperationID),
		fmt.Sprintf("Operation defines no 2xx success response (defined codes: %s)", sortedResponseCodes(op.Responses)),
		"If only one response is defined the OpenAPI specification SHOULD have it represent a successful outcome. Missing a 2xx definition makes it impossible for clients to know the expected happy-path shape.",
	)}
}

// ─────────────────────────────────────────────────────────────────────────────
// OAS-GET-REQUEST-BODY
//
// RFC 7231 §4.3.1 (referenced by OAS 3.x): "A payload within a GET request
// message has no defined semantics." OAS 3.0 notes that GET/HEAD requests with
// bodies SHOULD NOT be used.
// Severity: warning (SHOULD NOT)
// ─────────────────────────────────────────────────────────────────────────────

type SpecGetRequestBodyRule struct{}

func NewSpecGetRequestBodyRule() *SpecGetRequestBodyRule { return &SpecGetRequestBodyRule{} }
func (r *SpecGetRequestBodyRule) Name() string           { return "oas-get-request-body" }

func (r *SpecGetRequestBodyRule) Check(op *model.Operation) []*model.Issue {
	method := strings.ToUpper(op.Method)
	if method != "GET" && method != "HEAD" {
		return nil
	}
	if op.RequestBody == nil || len(op.RequestBody.Content) == 0 {
		return nil
	}
	location := fmt.Sprintf("requestBody on %s %s", method, op.Path)
	return []*model.Issue{specIssue(
		r.Name(),
		"OAS-GET-REQUEST-BODY",
		"SHOULD NOT",
		"Operation Object / RFC 7231",
		location,
		"warning",
		op.Path,
		fmt.Sprintf("%s %s", op.Method, op.OperationID),
		fmt.Sprintf("%s %s defines a request body, which SHOULD NOT be used on GET/HEAD operations", method, op.Path),
		"RFC 7231 defines no semantics for payloads in GET or HEAD requests. Many HTTP intermediaries and server frameworks will ignore or reject such bodies, making this a portability and interoperability concern.",
	)}
}

// ─────────────────────────────────────────────────────────────────────────────
// OAS-204-HAS-CONTENT
//
// RFC 7231 §6.3.5: "204 No Content — The server has successfully fulfilled the
// request and that there is no additional content to send in the response
// payload body."
// An OAS 3.x 204 response with a non-empty content map violates this HTTP
// semantic. This is a clear interoperability concern.
// Severity: warning (SHOULD NOT per HTTP semantics)
// ─────────────────────────────────────────────────────────────────────────────

type SpecEmptyResponseContentRule struct{}

func NewSpecEmptyResponseContentRule() *SpecEmptyResponseContentRule {
	return &SpecEmptyResponseContentRule{}
}
func (r *SpecEmptyResponseContentRule) Name() string { return "oas-204-has-content" }

func (r *SpecEmptyResponseContentRule) Check(op *model.Operation) []*model.Issue {
	var issues []*model.Issue
	for _, code := range []string{"204", "205"} {
		resp, ok := op.Responses[code]
		if !ok || resp == nil || len(resp.Content) == 0 {
			continue
		}
		location := fmt.Sprintf("%s response at %s %s", code, strings.ToUpper(op.Method), op.Path)
		issues = append(issues, specIssue(
			r.Name(),
			"OAS-204-HAS-CONTENT",
			"SHOULD NOT",
			"Response Object / RFC 7231",
			location,
			"warning",
			op.Path,
			fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			fmt.Sprintf("Response %s (No Content) defines a content body, which is not permitted by HTTP semantics", code),
			"RFC 7231 specifies that a 204 No Content response must not include a body. Defining content on a 204 in the OpenAPI spec contradicts the HTTP contract and will confuse generated clients.",
		))
	}
	return issues
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

func sortedResponseCodes(responses map[string]*model.Response) string {
	codes := make([]string, 0, len(responses))
	for code := range responses {
		codes = append(codes, code)
	}
	// simple insertion sort — response maps are small
	for i := 1; i < len(codes); i++ {
		for j := i; j > 0 && codes[j] < codes[j-1]; j-- {
			codes[j], codes[j-1] = codes[j-1], codes[j]
		}
	}
	return strings.Join(codes, ", ")
}
