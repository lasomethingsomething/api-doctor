package rule

import (
	"fmt"
	"sort"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

type Checker struct {
	rules    []Rule
	setRules []SetRule
}

type Rule interface {
	Check(op *model.Operation) []*model.Issue
	Name() string
}

type SetRule interface {
	CheckAll(operations []*model.Operation) []*model.Issue
	Name() string
}

func NewChecker() *Checker {
	return &Checker{
		rules: []Rule{
			NewMissingRequestSchemaRule(),
			NewMissingResponseSchemaRule(),
			NewGenericObjectRequestRule(),
			NewGenericObjectResponseRule(),
			NewWeakArrayItemsRule(),
			NewLikelyMissingEnumRule(),
			NewDeprecatedOperationRule(),
		},
		setRules: []SetRule{
			NewInconsistentResponseShapeRule(),
			NewWeakFollowUpLinkageRule(),
			NewWeakListDetailLinkageRule(),
			NewWeakAcceptedTrackingLinkageRule(),
		},
	}
}

func (c *Checker) CheckAll(operations []*model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		for _, r := range c.rules {
			issues = append(issues, r.Check(op)...)
		}
	}
	for _, r := range c.setRules {
		issues = append(issues, r.CheckAll(operations)...)
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

type LikelyMissingEnumRule struct{}

func NewLikelyMissingEnumRule() *LikelyMissingEnumRule { return &LikelyMissingEnumRule{} }
func (r *LikelyMissingEnumRule) Name() string          { return "likely-missing-enum" }

func (r *LikelyMissingEnumRule) Check(op *model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)

	if op.RequestBody != nil {
		for mtName, mt := range op.RequestBody.Content {
			if mt == nil {
				continue
			}
			for _, propertyPath := range findLikelyMissingEnums(mt.Schema, "") {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "warning",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
					Message:     fmt.Sprintf("Request schema property '%s' looks enum-like but has no enum for media type '%s'", propertyPath, mtName),
					Description: "Enum-like string fields without explicit enums weaken generated client typing and make allowed value changes harder to track across versions.",
				})
			}
		}
	}

	for code, resp := range op.Responses {
		if resp == nil {
			continue
		}
		for mtName, mt := range resp.Content {
			if mt == nil {
				continue
			}
			for _, propertyPath := range findLikelyMissingEnums(mt.Schema, "") {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "warning",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
					Message:     fmt.Sprintf("Response schema property '%s' looks enum-like but has no enum for media type '%s'", propertyPath, mtName),
					Description: "Enum-like string fields without explicit enums weaken generated client typing and make allowed value changes harder to track across versions.",
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


type WeakFollowUpLinkageRule struct{}

func NewWeakFollowUpLinkageRule() *WeakFollowUpLinkageRule { return &WeakFollowUpLinkageRule{} }
func (r *WeakFollowUpLinkageRule) Name() string            { return "weak-follow-up-linkage" }

func (r *WeakFollowUpLinkageRule) CheckAll(operations []*model.Operation) []*model.Issue {
	detailParamsByBase := map[string][]string{}
	for _, op := range operations {
		basePath, paramName, ok := detailPathBaseAndParam(op.Path)
		if !ok {
			continue
		}
		detailParamsByBase[basePath] = appendUnique(detailParamsByBase[basePath], paramName)
	}

	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		if !isLikelyWorkflowSource(op) {
			continue
		}

		params := detailParamsByBase[op.Path]
		if len(params) == 0 {
			continue
		}

		code, schema, ok := successfulJSONResponseSchema(op)
		if !ok {
			continue
		}

		known, linked := exposesFollowUpIdentifier(schema, params)
		if !known || linked {
			continue
		}

		issues = append(issues, &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message:     fmt.Sprintf("Response does not clearly expose a follow-up identifier for related detail endpoint(s): %s", strings.Join(linkagePropertyCandidates(params), ", ")),
			Description: "Two-step flows are harder to automate when a collection or create response does not visibly provide the identifier needed for the next endpoint.",
		})
	}

	return issues
}

type WeakListDetailLinkageRule struct{}

func NewWeakListDetailLinkageRule() *WeakListDetailLinkageRule { return &WeakListDetailLinkageRule{} }
func (r *WeakListDetailLinkageRule) Name() string              { return "weak-list-detail-linkage" }

func (r *WeakListDetailLinkageRule) CheckAll(operations []*model.Operation) []*model.Issue {
	detailBases := map[string]bool{}
	for _, op := range operations {
		if basePath, ok := detailPathBaseForID(op.Path); ok {
			detailBases[basePath] = true
		}
	}

	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		basePath, ok := listOrSearchBasePath(op)
		if !ok || !detailBases[basePath] {
			continue
		}

		code, schema, ok := successfulJSONResponseSchema(op)
		if !ok {
			continue
		}

		reason, linked := listDetailLinkageReason(schema)
		if reason == "" || linked {
			continue
		}

		issues = append(issues, &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message:     fmt.Sprintf("High confidence: response item schema does not clearly expose an 'id' needed for the related detail endpoint (%s)", reason),
			Description: "List and search flows are harder to automate when the response does not visibly include the identifier needed to fetch a specific item next.",
		})
	}

	return issues
}

type WeakAcceptedTrackingLinkageRule struct{}

func NewWeakAcceptedTrackingLinkageRule() *WeakAcceptedTrackingLinkageRule {
	return &WeakAcceptedTrackingLinkageRule{}
}

func (r *WeakAcceptedTrackingLinkageRule) Name() string { return "weak-accepted-tracking-linkage" }

func (r *WeakAcceptedTrackingLinkageRule) CheckAll(operations []*model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		if !isLikelyAcceptedWorkflowSource(op) {
			continue
		}

		resp, ok := op.Responses["202"]
		if !ok || resp == nil {
			continue
		}

		reason, linked := acceptedTrackingReason(resp)
		if linked || reason == "" {
			continue
		}

		issues = append(issues, &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s (202)", op.Method, op.OperationID),
			Message:     reason,
			Description: "Accepted-now-check-later workflows are harder to automate when the initiating response does not clearly show how to track completion.",
		})
	}

	return issues
}

type InconsistentResponseShapeRule struct{}

func NewInconsistentResponseShapeRule() *InconsistentResponseShapeRule { return &InconsistentResponseShapeRule{} }
func (r *InconsistentResponseShapeRule) Name() string                  { return "inconsistent-response-shape" }

func (r *InconsistentResponseShapeRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type comparable struct {
		op        *model.Operation
		code      string
		shape     string
		groupKey  string
		normPath  string
	}

	groups := map[string][]comparable{}
	for _, op := range operations {
		code, shape, ok := comparableResponseShape(op)
		if !ok {
			continue
		}
		for _, groupKey := range similarEndpointGroupKeys(op) {
			groups[groupKey] = append(groups[groupKey], comparable{
				op:       op,
				code:     code,
				shape:    shape,
				groupKey: groupKey,
				normPath: normalizePathTemplate(op.Path),
			})
		}
	}

	issues := make([]*model.Issue, 0)
	seen := map[string]bool{}
	for _, entries := range groups {
		if len(entries) < 2 {
			continue
		}

		shapes := map[string]int{}
		for _, entry := range entries {
			shapes[entry.shape]++
		}
		if len(shapes) < 2 {
			continue
		}

		shapeNames := make([]string, 0, len(shapes))
		for shape := range shapes {
			shapeNames = append(shapeNames, shape)
		}
		sort.Strings(shapeNames)

		for _, entry := range entries {
			issueKey := strings.Join([]string{r.Name(), entry.op.Path, entry.op.Method, entry.op.OperationID, entry.code}, "|")
			if seen[issueKey] {
				continue
			}
			seen[issueKey] = true

			issues = append(issues, &model.Issue{
				Code:        r.Name(),
				Severity:    "warning",
				Path:        entry.op.Path,
				Operation:   fmt.Sprintf("%s %s (%s)", entry.op.Method, entry.op.OperationID, entry.code),
				Message:     fmt.Sprintf("Similar endpoint group '%s' has inconsistent response shapes: %s", entry.groupKey, strings.Join(shapeNames, ", ")),
				Description: "Similar endpoints with different response shapes make generated clients and shared integration logic harder to rely on consistently.",
			})
		}
	}

	return issues
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

func comparableResponseShape(op *model.Operation) (string, string, bool) {
	if op == nil {
		return "", "", false
	}

	preferredCodes := []string{"200", "201", "202"}
	for _, code := range preferredCodes {
		if resp, ok := op.Responses[code]; ok {
			if shape, ok := responseShape(resp); ok {
				return code, shape, true
			}
		}
	}

	for code, resp := range op.Responses {
		if strings.HasPrefix(code, "2") {
			if shape, ok := responseShape(resp); ok {
				return code, shape, true
			}
		}
	}

	return "", "", false
}

func responseShape(resp *model.Response) (string, bool) {
	if resp == nil {
		return "", false
	}
	mt, ok := resp.Content["application/json"]
	if !ok || mt == nil || mt.Schema == nil {
		return "", false
	}
	return schemaShape(mt.Schema), true
}

func schemaShape(schema *model.Schema) string {
	if schema == nil {
		return "unknown"
	}
	if schema.Ref != "" {
		return "ref:" + schema.Ref
	}
	if schema.Type == "array" {
		return "array<" + schemaShape(schema.Items) + ">"
	}
	if schema.Type == "object" {
		if len(schema.Properties) == 0 {
			return "object{}"
		}
		return "object"
	}
	if schema.Type == "" {
		return "unknown"
	}
	return schema.Type
}

func normalizePathTemplate(path string) string {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			parts[i] = "{}"
		}
	}
	return strings.Join(parts, "/")
}

func similarEndpointGroupKeys(op *model.Operation) []string {
	keys := []string{strings.ToUpper(op.Method) + " " + normalizePathTemplate(op.Path)}

	segments := splitPathSegments(op.Path)
	if len(segments) >= 3 && isPathParam(segments[len(segments)-1]) {
		familySegments := append([]string{}, segments...)
		familySegments[len(familySegments)-1] = "{}"
		familySegments[len(familySegments)-2] = "*"
		keys = append(keys, strings.ToUpper(op.Method)+" "+joinPathSegments(familySegments))
	}

	return keys
}

func splitPathSegments(path string) []string {
	parts := strings.Split(path, "/")
	segments := make([]string, 0, len(parts))
	for _, part := range parts {
		if part != "" {
			segments = append(segments, part)
		}
	}
	return segments
}

func joinPathSegments(segments []string) string {
	if len(segments) == 0 {
		return "/"
	}
	return "/" + strings.Join(segments, "/")
}

func isPathParam(segment string) bool {
	return strings.HasPrefix(segment, "{") && strings.HasSuffix(segment, "}")
}

func detailPathBaseAndParam(path string) (string, string, bool) {
	segments := splitPathSegments(path)
	if len(segments) == 0 {
		return "", "", false
	}
	last := segments[len(segments)-1]
	if !isPathParam(last) {
		return "", "", false
	}
	paramName := strings.TrimSuffix(strings.TrimPrefix(last, "{"), "}")
	return joinPathSegments(segments[:len(segments)-1]), paramName, true
}

func detailPathBaseForID(path string) (string, bool) {
	basePath, paramName, ok := detailPathBaseAndParam(path)
	if !ok || paramName != "id" {
		return "", false
	}
	return basePath, true
}

func isLikelyWorkflowSource(op *model.Operation) bool {
	if op == nil {
		return false
	}
	if strings.Contains(op.Path, "{") {
		return false
	}
	return strings.ToUpper(op.Method) == "POST"
}

func isLikelyAcceptedWorkflowSource(op *model.Operation) bool {
	if op == nil {
		return false
	}

	switch strings.ToUpper(op.Method) {
	case "POST", "PUT", "PATCH", "DELETE":
		return true
	default:
		return false
	}
}

func successfulJSONResponseSchema(op *model.Operation) (string, *model.Schema, bool) {
	if op == nil {
		return "", nil, false
	}
	preferredCodes := []string{"200", "201", "202"}
	for _, code := range preferredCodes {
		resp, ok := op.Responses[code]
		if !ok || resp == nil {
			continue
		}
		mt, ok := resp.Content["application/json"]
		if ok && mt != nil && mt.Schema != nil {
			return code, mt.Schema, true
		}
	}
	return "", nil, false
}

func listOrSearchBasePath(op *model.Operation) (string, bool) {
	if op == nil || strings.Contains(op.Path, "{") {
		return "", false
	}

	method := strings.ToUpper(op.Method)
	if method == "GET" && strings.Contains(strings.ToLower(op.OperationID), "list") {
		return op.Path, true
	}

	if method == "POST" && strings.HasSuffix(op.Path, "/search") {
		basePath := strings.TrimSuffix(op.Path, "/search")
		if basePath == "" {
			return "", false
		}
		return basePath, true
	}

	return "", false
}

func acceptedTrackingReason(resp *model.Response) (string, bool) {
	if resp == nil {
		return "", false
	}

	mt, ok := resp.Content["application/json"]
	if !ok || mt == nil || mt.Schema == nil {
		return "202 Accepted response has no JSON body to expose a tracking identifier", false
	}

	if exposesAcceptedTrackingIdentifier(mt.Schema, 0) {
		return "", true
	}

	return fmt.Sprintf(
		"202 Accepted response body does not clearly expose a tracking identifier such as %s",
		strings.Join(acceptedTrackingCandidates(), ", "),
	), false
}

func acceptedTrackingCandidates() []string {
	return []string{"id", "jobId", "taskId", "processId", "operationId", "runId"}
}

func exposesAcceptedTrackingIdentifier(schema *model.Schema, depth int) bool {
	if schema == nil || schema.Ref != "" || depth > 3 {
		return false
	}

	if schema.Type == "array" {
		return exposesAcceptedTrackingIdentifier(schema.Items, depth+1)
	}

	if schema.Type != "object" || len(schema.Properties) == 0 {
		return false
	}

	for _, candidate := range acceptedTrackingCandidates() {
		if _, ok := schema.Properties[candidate]; ok {
			return true
		}
	}

	for _, wrapper := range []string{"data", "result", "job", "task", "process"} {
		child, ok := schema.Properties[wrapper]
		if !ok || child == nil {
			continue
		}
		if exposesAcceptedTrackingIdentifier(child, depth+1) {
			return true
		}
	}

	return false
}

func exposesFollowUpIdentifier(schema *model.Schema, params []string) (bool, bool) {
	if schema == nil || schema.Ref != "" {
		return false, false
	}

	candidates := linkagePropertyCandidates(params)
	return exposesFollowUpIdentifierRecursive(schema, candidates, 0)
}

func linkagePropertyCandidates(params []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0)
	for _, param := range params {
		for _, candidate := range []string{param, "id"} {
			if candidate == "" || seen[candidate] {
				continue
			}
			seen[candidate] = true
			out = append(out, candidate)
		}
	}
	sort.Strings(out)
	return out
}

func appendUnique(values []string, value string) []string {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}

func listDetailLinkageReason(schema *model.Schema) (string, bool) {
	itemSchema, reason, ok := collectionItemSchema(schema, 0)
	if !ok {
		return "", false
	}
	if itemSchema == nil || itemSchema.Ref != "" || itemSchema.Type != "object" || len(itemSchema.Properties) == 0 {
		return "", false
	}
	if _, ok := itemSchema.Properties["id"]; ok {
		return reason, true
	}
	return reason, false
}

func collectionItemSchema(schema *model.Schema, depth int) (*model.Schema, string, bool) {
	if schema == nil || schema.Ref != "" || depth > 3 {
		return nil, "", false
	}

	if schema.Type == "array" {
		if schema.Items == nil {
			return nil, "", false
		}
		return schema.Items, "top-level array items", true
	}

	if schema.Type != "object" || len(schema.Properties) == 0 {
		return nil, "", false
	}

	for _, wrapper := range []string{"data", "items", "elements", "result", "results", "records"} {
		child, ok := schema.Properties[wrapper]
		if !ok || child == nil {
			continue
		}
		if child.Type == "array" && child.Items != nil {
			return child.Items, wrapper + " array items", true
		}
		if child.Type == "object" && len(child.Properties) > 0 {
			if nested, reason, ok := collectionItemSchema(child, depth+1); ok {
				return nested, wrapper + "." + reason, true
			}
		}
	}

	return nil, "", false
}

func exposesIdentifierRecursive(schema *model.Schema, candidates []string, wrappers []string, depth int) (bool, bool) {
	if schema == nil || schema.Ref != "" || depth > 3 {
		return false, false
	}

	if schema.Type == "array" {
		if schema.Items == nil {
			return false, false
		}
		return exposesIdentifierRecursive(schema.Items, candidates, wrappers, depth+1)
	}

	if schema.Type != "object" || len(schema.Properties) == 0 {
		return false, false
	}

	for _, candidate := range candidates {
		if _, ok := schema.Properties[candidate]; ok {
			return true, true
		}
	}

	known := true
	for _, wrapper := range wrappers {
		child, ok := schema.Properties[wrapper]
		if !ok {
			continue
		}
		childKnown, childLinked := exposesIdentifierRecursive(child, candidates, wrappers, depth+1)
		if childLinked {
			return true, true
		}
		if childKnown {
			known = true
		}
	}

	return known, false
}

func exposesFollowUpIdentifierRecursive(schema *model.Schema, candidates []string, depth int) (bool, bool) {
	return exposesIdentifierRecursive(schema, candidates, []string{"data", "items", "elements", "result", "results", "records"}, depth)
}

func findLikelyMissingEnums(schema *model.Schema, prefix string) []string {
	if schema == nil {
		return nil
	}

	paths := make([]string, 0)
	for name, property := range schema.Properties {
		propertyPath := name
		if prefix != "" {
			propertyPath = prefix + "." + name
		}

		if isLikelyEnumProperty(name, property) {
			paths = append(paths, propertyPath)
		}
		paths = append(paths, findLikelyMissingEnums(property, propertyPath)...)
	}

	if schema.Items != nil {
		itemPrefix := prefix + "[]"
		if prefix == "" {
			itemPrefix = "[]"
		}
		paths = append(paths, findLikelyMissingEnums(schema.Items, itemPrefix)...)
	}

	return paths
}

func isLikelyEnumProperty(name string, schema *model.Schema) bool {
	if schema == nil {
		return false
	}
	if schema.Ref != "" || schema.Type != "string" || len(schema.Enum) > 0 {
		return false
	}
	switch name {
	case "status", "state", "type", "mode", "scope", "level":
		return true
	default:
		return false
	}
}
