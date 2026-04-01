package endpoint

import (
	"testing"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

func TestScoreEndpoint_PerfectScoreWithNoIssues(t *testing.T) {
	op := &model.Operation{
		Path:   "/products",
		Method: "post",
	}
	issues := []*model.Issue{}

	score := ScoreEndpoint(op, issues)

	if score.SchemaCompleteness != 5 {
		t.Fatalf("expected Schema 5, got %d", score.SchemaCompleteness)
	}
	if score.ClientGenerationQuality != 5 {
		t.Fatalf("expected Client 5, got %d", score.ClientGenerationQuality)
	}
	if score.VersioningSafety != 5 {
		t.Fatalf("expected Versioning 5, got %d", score.VersioningSafety)
	}
}

func TestScoreEndpoint_PenalizeForGenericObjects(t *testing.T) {
	op := &model.Operation{
		Path:   "/products",
		Method: "post",
	}
	issues := []*model.Issue{
		{
			Code:      "generic-object-request",
			Path:      "/products",
			Operation: "post",
		},
		{
			Code:      "generic-object-response",
			Path:      "/products",
			Operation: "post createProduct (201)",
		},
	}

	score := ScoreEndpoint(op, issues)

	if score.SchemaCompleteness == 5 {
		t.Fatalf("expected Schema < 5, got %d", score.SchemaCompleteness)
	}
	if score.ClientGenerationQuality == 5 {
		t.Fatalf("expected Client < 5, got %d", score.ClientGenerationQuality)
	}
}

func TestScoreEndpoint_PenalizeForMissingEnums(t *testing.T) {
	op := &model.Operation{
		Path:   "/products",
		Method: "get",
	}
	issues := []*model.Issue{
		{
			Code:      "likely-missing-enum",
			Path:      "/products",
			Operation: "get listProducts (200)",
		},
	}

	score := ScoreEndpoint(op, issues)

	if score.ClientGenerationQuality == 5 {
		t.Fatalf("expected Client < 5, got %d", score.ClientGenerationQuality)
	}
	if score.SchemaCompleteness == 5 {
		t.Fatalf("expected Schema < 5, got %d", score.SchemaCompleteness)
	}
}

func TestScoreEndpoint_PenalizeForDeprecatedOperation(t *testing.T) {
	op := &model.Operation{
		Path:       "/legacy-endpoint",
		Method:     "get",
		Deprecated: true,
	}
	issues := []*model.Issue{
		{
			Code:      "deprecated-operation",
			Path:      "/legacy-endpoint",
			Operation: "get",
		},
	}

	score := ScoreEndpoint(op, issues)

	if score.VersioningSafety == 5 {
		t.Fatalf("expected Versioning < 5, got %d", score.VersioningSafety)
	}
	if score.SchemaCompleteness != 5 {
		t.Fatalf("expected Schema 5, got %d", score.SchemaCompleteness)
	}
	if score.ClientGenerationQuality != 5 {
		t.Fatalf("expected Client 5, got %d", score.ClientGenerationQuality)
	}
}

func TestScoreOperations_ScoresAllEndpoints(t *testing.T) {
	ops := []*model.Operation{
		{Path: "/products", Method: "post"},
		{Path: "/products/{id}", Method: "get"},
	}
	issues := []*model.Issue{
		{Code: "generic-object-response", Path: "/products", Operation: "post"},
	}

	scores := ScoreOperations(ops, issues)

	if len(scores) != 2 {
		t.Fatalf("expected 2 scores, got %d", len(scores))
	}

	postScore := scores["post|/products"]
	if postScore == nil {
		t.Fatalf("expected score for post /products")
	}
	if postScore.SchemaCompleteness == 5 {
		t.Fatalf("expected Schema < 5 for post /products, got %d", postScore.SchemaCompleteness)
	}

	getScore := scores["get|/products/{id}"]
	if getScore == nil {
		t.Fatalf("expected score for get /products/{id}")
	}
	if getScore.SchemaCompleteness != 5 {
		t.Fatalf("expected Schema 5 for get /products/{id}, got %d", getScore.SchemaCompleteness)
	}
}
