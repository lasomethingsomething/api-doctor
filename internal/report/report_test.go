package report

import (
	"strings"
	"testing"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

func TestFormatText_NoIssues(t *testing.T) {
	result := &model.AnalysisResult{SpecFile: "spec.json", Operations: []*model.Operation{}}
	out := FormatText(result)
	if !strings.Contains(out, "No issues found") {
		t.Fatalf("expected no-issues message, got: %s", out)
	}
}

func TestFormatJSON_WithIssues(t *testing.T) {
	result := &model.AnalysisResult{
		SpecFile: "spec.json",
		Issues: []*model.Issue{{
			Code:      "deprecated-operation",
			Severity:  "warning",
			Path:      "/products/{id}",
			Operation: "PUT updateProduct",
			Message:   "Operation is marked as deprecated",
		}},
	}

	out, err := FormatJSON(result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "deprecated-operation") || !strings.Contains(out, "warning") {
		t.Fatalf("expected issue in json output, got: %s", out)
	}
}
