package diff

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

type Change struct {
	Code        string
	Severity    string
	Path        string
	Operation   string
	Location    string
	Message     string
	Description string
}

type Result struct {
	OldSpec string
	NewSpec string
	Changes []*Change
}

func Compare(oldSpecFile, newSpecFile string, oldOps []*model.Operation, newOps []*model.Operation) *Result {
	result := &Result{OldSpec: oldSpecFile, NewSpec: newSpecFile, Changes: make([]*Change, 0)}

	oldByPath := operationsByPath(oldOps)
	newByPath := operationsByPath(newOps)

	paths := sortedKeys(oldByPath)
	for _, path := range paths {
		oldPathOps := oldByPath[path]
		newPathOps, ok := newByPath[path]
		if !ok {
			result.Changes = append(result.Changes, &Change{
				Code:        "removed-path",
				Severity:    "error",
				Path:        path,
				Message:     "Path was removed from the new spec",
				Description: "Removing an existing path breaks clients that still call that endpoint.",
			})
			continue
		}

		methods := sortedKeys(oldPathOps)
		for _, method := range methods {
			oldOp := oldPathOps[method]
			newOp, ok := newPathOps[method]
			if !ok {
				result.Changes = append(result.Changes, &Change{
					Code:        "removed-operation",
					Severity:    "error",
					Path:        path,
					Operation:   formatOperation(oldOp),
					Message:     "Operation was removed from the new spec",
					Description: "Removing an existing operation breaks clients that still call that method on this path.",
				})
				continue
			}

			result.Changes = append(result.Changes, compareOperation(oldOp, newOp)...)
		}
	}

	sort.Slice(result.Changes, func(i, j int) bool {
		if result.Changes[i].Path != result.Changes[j].Path {
			return result.Changes[i].Path < result.Changes[j].Path
		}
		if result.Changes[i].Operation != result.Changes[j].Operation {
			return result.Changes[i].Operation < result.Changes[j].Operation
		}
		if result.Changes[i].Location != result.Changes[j].Location {
			return result.Changes[i].Location < result.Changes[j].Location
		}
		return result.Changes[i].Code < result.Changes[j].Code
	})

	return result
}

func FormatText(result *Result) string {
	out := "API Doctor Diff Report\n"
	out += "======================\n\n"
	out += fmt.Sprintf("Old spec: %s\n", result.OldSpec)
	out += fmt.Sprintf("New spec: %s\n\n", result.NewSpec)

	if len(result.Changes) == 0 {
		out += "No breaking changes detected in the current diff scope.\n"
		return out
	}

	groups := map[string][]*Change{}
	for _, change := range result.Changes {
		groups[change.Severity] = append(groups[change.Severity], change)
	}

	for _, severity := range []string{"error", "warning"} {
		changes := groups[severity]
		if len(changes) == 0 {
			continue
		}

		out += fmt.Sprintf("%s (%d changes)\n", title(severity), len(changes))
		out += "---\n"
		for _, change := range changes {
			out += fmt.Sprintf("  [%s] %s\n", strings.ToUpper(change.Severity), change.Code)
			if change.Operation != "" {
				out += fmt.Sprintf("      Endpoint: %s %s\n", change.Operation, change.Path)
			} else {
				out += fmt.Sprintf("      Path: %s\n", change.Path)
			}
			if change.Location != "" {
				out += fmt.Sprintf("      Location: %s\n", change.Location)
			}
			out += fmt.Sprintf("      Why it matters: %s\n", change.Description)
			out += fmt.Sprintf("      Technical detail: %s\n\n", change.Message)
		}
	}

	out += "Summary\n"
	out += "-------\n"
	out += fmt.Sprintf("Total changes: %d\n", len(result.Changes))
	if errors := groups["error"]; len(errors) > 0 {
		out += fmt.Sprintf("Errors: %d\n", len(errors))
	}
	if warnings := groups["warning"]; len(warnings) > 0 {
		out += fmt.Sprintf("Warnings: %d\n", len(warnings))
	}

	return out
}

func FormatJSON(result *Result) (string, error) {
	summary := map[string]int{}
	for _, change := range result.Changes {
		summary[change.Severity]++
	}
	payload := map[string]interface{}{
		"old_spec":      result.OldSpec,
		"new_spec":      result.NewSpec,
		"total_changes": len(result.Changes),
		"summary":       summary,
		"changes":       result.Changes,
	}
	b, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func compareOperation(oldOp *model.Operation, newOp *model.Operation) []*Change {
	changes := make([]*Change, 0)

	// Check for removed response status codes.
	for _, code := range sortedKeys(oldOp.Responses) {
		if _, ok := newOp.Responses[code]; !ok {
			changes = append(changes, &Change{
				Code:        "removed-response-status-code",
				Severity:    "error",
				Path:        oldOp.Path,
				Operation:   formatOperation(oldOp),
				Location:    "response " + code,
				Message:     fmt.Sprintf("Response status code %s was removed", code),
				Description: "Removing a documented response code breaks clients that branch on it for success/error handling.",
			})
		}
	}

	// Check for removed request body fields.
	if oldOp.RequestBody != nil && newOp.RequestBody != nil {
		oldMT := oldOp.RequestBody.Content["application/json"]
		newMT := newOp.RequestBody.Content["application/json"]
		if oldMT != nil && newMT != nil && oldMT.Schema != nil && newMT.Schema != nil {
			changes = append(changes, compareRequestSchema(oldOp, oldMT.Schema, newMT.Schema, "request")...)
		}
	}

	// Check existing response codes for schema-level changes.
	commonCodes := commonResponseCodes(oldOp.Responses, newOp.Responses)
	for _, code := range commonCodes {
		oldResp := oldOp.Responses[code]
		newResp := newOp.Responses[code]
		oldSchema := jsonResponseSchema(oldResp)
		newSchema := jsonResponseSchema(newResp)
		if oldSchema == nil || newSchema == nil {
			continue
		}
		changes = append(changes, compareSchema(oldOp, code, oldSchema, newSchema, "response")...)
	}
	return changes
}

func compareRequestSchema(op *model.Operation, oldSchema *model.Schema, newSchema *model.Schema, prefix string) []*Change {
	changes := make([]*Change, 0)
	if oldSchema == nil || newSchema == nil || oldSchema.Ref != "" || newSchema.Ref != "" {
		return changes
	}

	for _, name := range sortedKeys(oldSchema.Properties) {
		childOld := oldSchema.Properties[name]
		childNew, ok := newSchema.Properties[name]
		childPath := joinLocation(prefix, name)
		if !ok {
			changes = append(changes, newChange(op, "removed-request-field", "error", childPath, "request", "Request field was removed", "Removing a request field breaks clients that still send that field and rely on its acceptance."))
			continue
		}
		changes = append(changes, compareRequestSchema(op, childOld, childNew, childPath)...)
	}

	if oldSchema.Items != nil && newSchema.Items != nil {
		changes = append(changes, compareRequestSchema(op, oldSchema.Items, newSchema.Items, prefix+"[]")...)
	}

	return changes
}

func compareSchema(op *model.Operation, responseCode string, oldSchema *model.Schema, newSchema *model.Schema, prefix string) []*Change {
	changes := make([]*Change, 0)
	if oldSchema == nil || newSchema == nil {
		return changes
	}
	if oldSchema.Ref != "" || newSchema.Ref != "" {
		return changes
	}

	if len(oldSchema.Enum) > 0 && len(newSchema.Enum) > 0 {
		oldValues := enumSet(oldSchema.Enum)
		newValues := enumSet(newSchema.Enum)
		for _, value := range sortedEnumRemoved(oldValues, newValues) {
			changes = append(changes, newChange(op, "enum-value-removed", "error", prefix, responseCode, fmt.Sprintf("Enum value '%s' was removed", value), "Removing an enum value breaks clients that still send or expect that value."))
		}
	}

	oldRequired := requiredSet(oldSchema.Required)
	newRequired := requiredSet(newSchema.Required)

	propertyNames := sortedKeys(oldSchema.Properties)
	for _, name := range propertyNames {
		childOld := oldSchema.Properties[name]
		childNew, ok := newSchema.Properties[name]
		childPath := joinLocation(prefix, name)
		if !ok {
			changes = append(changes, newChange(op, "removed-response-field", "error", childPath, responseCode, "Response field was removed", "Removing a response field breaks clients that still read that field."))
			continue
		}
		if !oldRequired[name] && newRequired[name] {
			changes = append(changes, newChange(op, "field-became-required", "error", childPath, responseCode, "Field changed from optional to required", "Making a previously optional field required can break clients and producers that relied on the older contract."))
		}
		changes = append(changes, compareSchema(op, responseCode, childOld, childNew, childPath)...)
	}

	if oldSchema.Items != nil && newSchema.Items != nil {
		changes = append(changes, compareSchema(op, responseCode, oldSchema.Items, newSchema.Items, prefix+"[]")...)
	}

	return changes
}

func newChange(op *model.Operation, code string, severity string, location string, responseCode string, message string, description string) *Change {
	operation := ""
	path := ""
	if op != nil {
		operation = fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, responseCode)
		path = op.Path
	}
	return &Change{
		Code:        code,
		Severity:    severity,
		Path:        path,
		Operation:   operation,
		Location:    location,
		Message:     message,
		Description: description,
	}
	}

func operationsByPath(operations []*model.Operation) map[string]map[string]*model.Operation {
	paths := map[string]map[string]*model.Operation{}
	for _, op := range operations {
		if _, ok := paths[op.Path]; !ok {
			paths[op.Path] = map[string]*model.Operation{}
		}
		paths[op.Path][strings.ToUpper(op.Method)] = op
	}
	return paths
}

func commonResponseCodes(oldResponses map[string]*model.Response, newResponses map[string]*model.Response) []string {
	codes := make([]string, 0)
	for code := range oldResponses {
		if _, ok := newResponses[code]; ok {
			codes = append(codes, code)
		}
	}
	sort.Strings(codes)
	return codes
}

func jsonResponseSchema(resp *model.Response) *model.Schema {
	if resp == nil {
		return nil
	}
	mt, ok := resp.Content["application/json"]
	if !ok || mt == nil {
		return nil
	}
	return mt.Schema
}

func enumSet(values []interface{}) map[string]bool {
	set := map[string]bool{}
	for _, value := range values {
		set[fmt.Sprintf("%v", value)] = true
	}
	return set
}

func sortedEnumRemoved(oldSet map[string]bool, newSet map[string]bool) []string {
	values := make([]string, 0)
	for value := range oldSet {
		if !newSet[value] {
			values = append(values, value)
		}
	}
	sort.Strings(values)
	return values
}

func requiredSet(values []string) map[string]bool {
	set := map[string]bool{}
	for _, value := range values {
		set[value] = true
	}
	return set
}

func sortedKeys[T any](m map[string]T) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func joinLocation(prefix string, child string) string {
	if prefix == "" {
		return child
	}
	return prefix + "." + child
}

func formatOperation(op *model.Operation) string {
	if op == nil {
		return ""
	}
	return fmt.Sprintf("%s %s", op.Method, op.OperationID)
}

func title(s string) string {
	if len(s) == 0 {
		return s
	}
	if s[0] >= 'a' && s[0] <= 'z' {
		return string(s[0]-'a'+'A') + s[1:]
	}
	return s
}

func FormatMarkdown(result *Result) string {
	out := "# API Diff Report\n\n"
	out += fmt.Sprintf("**Old:** %s | **New:** %s\n\n", result.OldSpec, result.NewSpec)

	if len(result.Changes) == 0 {
		out += "No breaking changes detected in the current diff scope.\n"
		return out
	}

	// Summary table
	groups := map[string][]*Change{}
	for _, change := range result.Changes {
		groups[change.Severity] = append(groups[change.Severity], change)
	}

	out += "## Summary\n\n"
	out += "| Severity | Finding | Count |\n"
	out += "|---|---|---|\n"
	for _, severity := range []string{"error", "warning"} {
		changes := groups[severity]
		if len(changes) == 0 {
			continue
		}

		codeGroups := map[string]int{}
		for _, change := range changes {
			codeGroups[change.Code]++
		}

		for code, count := range codeGroups {
			out += fmt.Sprintf("| %s | %s | %d |\n", title(severity), code, count)
		}
	}
	out += "\n"

	// Changes grouped by severity
	out += "## Changes\n\n"
	for _, severity := range []string{"error", "warning"} {
		changes := groups[severity]
		if len(changes) == 0 {
			continue
		}

		codeGroups := map[string][]*Change{}
		for _, change := range changes {
			codeGroups[change.Code] = append(codeGroups[change.Code], change)
		}

		codes := make([]string, 0, len(codeGroups))
		for code := range codeGroups {
			codes = append(codes, code)
		}
		sort.Strings(codes)

		for _, code := range codes {
			codeChanges := codeGroups[code]
			out += fmt.Sprintf("### `%s` (%d)\n\n", code, len(codeChanges))
			for _, change := range codeChanges {
				out += fmt.Sprintf("- **Path:** `%s`\n", change.Path)
				if change.Operation != "" {
					out += fmt.Sprintf("  **Operation:** `%s`\n", change.Operation)
				}
				if change.Location != "" {
					out += fmt.Sprintf("  **Location:** `%s`\n", change.Location)
				}
				out += fmt.Sprintf("  **Impact:** %s\n", change.Description)
				out += fmt.Sprintf("  **Details:** %s\n", change.Message)
				out += "\n"
			}
		}
	}

	return out
}