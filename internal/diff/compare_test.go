package diff

import (
	"strings"
	"testing"

	"github.com/lasomethingsomething/api-doctor/internal/openapi"
)

func TestCompare_RemovedResponseStatusCode(t *testing.T) {
	parser := openapi.NewParser()
	oldResult, err := parser.ParseFile("../../testdata/diff-removed-status-old.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	newResult, err := parser.ParseFile("../../testdata/diff-removed-status-new.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	result := Compare(oldResult.SpecFile, newResult.SpecFile, oldResult.Operations, newResult.Operations)

	seen := map[string]bool{}
	for _, change := range result.Changes {
		seen[change.Code+"|"+change.Path+"|"+change.Location] = true
	}

	if !seen["removed-response-status-code|/weak-op|response 404"] {
		t.Fatalf("expected removed-response-status-code for /weak-op 404, got %#v", result.Changes)
	}
	if seen["removed-response-status-code|/strong-op|response 404"] {
		t.Fatalf("did not expect removed-response-status-code for /strong-op, got %#v", result.Changes)
	}
}

func TestCompare_RemovedRequestField(t *testing.T) {
	parser := openapi.NewParser()
	oldResult, err := parser.ParseFile("../../testdata/diff-removed-request-field-old.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	newResult, err := parser.ParseFile("../../testdata/diff-removed-request-field-new.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	result := Compare(oldResult.SpecFile, newResult.SpecFile, oldResult.Operations, newResult.Operations)

	seen := map[string]bool{}
	for _, change := range result.Changes {
		seen[change.Code+"|"+change.Path+"|"+change.Location] = true
	}

	if !seen["removed-request-field|/weak-op|request.notes"] {
		t.Fatalf("expected removed-request-field for /weak-op notes, got %#v", result.Changes)
	}
	if seen["removed-request-field|/strong-op|request.notes"] {
		t.Fatalf("did not expect removed-request-field for /strong-op, got %#v", result.Changes)
	}
}

func TestCompare_Fixture(t *testing.T) {
	parser := openapi.NewParser()
	oldResult, err := parser.ParseFile("../../testdata/diff-old.json")
	if err != nil {
		t.Fatalf("unexpected old parse error: %v", err)
	}
	newResult, err := parser.ParseFile("../../testdata/diff-new.json")
	if err != nil {
		t.Fatalf("unexpected new parse error: %v", err)
	}

	result := Compare(oldResult.SpecFile, newResult.SpecFile, oldResult.Operations, newResult.Operations)
	if len(result.Changes) != 5 {
		t.Fatalf("expected exactly 5 diff changes, got %#v", result.Changes)
	}

	seen := map[string]bool{}
	for _, change := range result.Changes {
		seen[change.Code+"|"+change.Path+"|"+change.Location] = true
	}

	for _, key := range []string{
		"removed-path|/removed-path|",
		"removed-operation|/products|",
		"removed-response-field|/orders|response.status",
		"field-became-required|/orders|response.id",
		"enum-value-removed|/orders|response.state",
	} {
		if !seen[key] {
			t.Fatalf("expected diff change %s, got %#v", key, result.Changes)
		}
	}
	text := FormatText(result)
	if !strings.Contains(text, "Error (5 changes)") {
		t.Fatalf("expected readable diff text summary, got: %s", text)
	}
	jsonOut, err := FormatJSON(result)
	if err != nil {
		t.Fatalf("unexpected json error: %v", err)
	}
	if !strings.Contains(jsonOut, "\"removed-path\"") || !strings.Contains(jsonOut, "\"changes\"") {
		t.Fatalf("expected diff json output, got: %s", jsonOut)
	}
}

func TestFormatMarkdown_WithChanges(t *testing.T) {
	result := &Result{
		OldSpec: "old.json",
		NewSpec: "new.json",
		Changes: []*Change{
			{
				Code:        "removed-path",
				Severity:    "error",
				Path:        "/products",
				Description: "Path removed from new spec.",
				Message:     "Path /products no longer exists",
			},
		},
	}

	out := FormatMarkdown(result)
	if !strings.Contains(out, "# API Diff Report") || !strings.Contains(out, "## Summary") {
		t.Fatalf("expected markdown diff header and summary, got: %s", out)
	}
	if !strings.Contains(out, "| Error | removed-path | 1 |") {
		t.Fatalf("expected markdown summary row for removed-path, got: %s", out)
	}
	if !strings.Contains(out, "### `removed-path` (1)") || !strings.Contains(out, "**Path:** `/products`") {
		t.Fatalf("expected markdown details for removed-path change, got: %s", out)
	}
}