package endpoint

import (
	"fmt"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

// EndpointScore rates an endpoint across three dimensions (1-5)
type EndpointScore struct {
	SchemaCompleteness      int    // 1-5: how well-defined are request/response shapes?
	ClientGenerationQuality int    // 1-5: can generators create strongly-typed APIs?
	VersioningSafety        int    // 1-5: how resilient is the endpoint to safe evolution?
	Explanation             string // brief explanation of scores
}

// ScoreEndpoint rates a single endpoint based on analysis findings
func ScoreEndpoint(op *model.Operation, issues []*model.Issue) *EndpointScore {
	issuesByCode := countIssuesByCode(issues, op.Path)

	score := &EndpointScore{
		SchemaCompleteness:      5,
		ClientGenerationQuality: 5,
		VersioningSafety:        5,
	}

	// Schema Completeness: penalize for generic objects, missing enums, and weak linkage
	score.SchemaCompleteness -= issuesByCode["generic-object-request"]
	score.SchemaCompleteness -= issuesByCode["generic-object-response"]
	score.SchemaCompleteness -= issuesByCode["likely-missing-enum"]
	score.SchemaCompleteness -= issuesByCode["weak-accepted-tracking-linkage"]
	score.SchemaCompleteness -= issuesByCode["weak-action-follow-up-linkage"]
	score.SchemaCompleteness -= issuesByCode["weak-follow-up-linkage"]

	// Client Generation Quality: penalize for missing enums and generic objects
	score.ClientGenerationQuality -= issuesByCode["likely-missing-enum"]
	score.ClientGenerationQuality -= issuesByCode["generic-object-request"]
	score.ClientGenerationQuality -= issuesByCode["generic-object-response"]

	// Versioning Safety: penalize for deprecated operations
	score.VersioningSafety -= issuesByCode["deprecated-operation"]

	// Clamp scores to 1-5 range
	score.SchemaCompleteness = clampScore(score.SchemaCompleteness)
	score.ClientGenerationQuality = clampScore(score.ClientGenerationQuality)
	score.VersioningSafety = clampScore(score.VersioningSafety)

	// Build explanation
	score.Explanation = buildEndpointExplanation(score, issuesByCode)

	return score
}

// ScoreOperations scores all operations in a result
func ScoreOperations(operations []*model.Operation, issues []*model.Issue) map[string]*EndpointScore {
	scores := make(map[string]*EndpointScore)
	for _, op := range operations {
		// Use method|path as key to match with issues
		key := strings.Join([]string{op.Method, op.Path}, "|")
		scores[key] = ScoreEndpoint(op, issues)
	}
	return scores
}

// Helper functions

func countIssuesByCode(issues []*model.Issue, path string) map[string]int {
	counts := make(map[string]int)
	for _, issue := range issues {
		if issue.Path == path {
			counts[issue.Code]++
		}
	}
	return counts
}

func clampScore(score int) int {
	if score < 1 {
		return 1
	}
	if score > 5 {
		return 5
	}
	return score
}

func buildEndpointExplanation(score *EndpointScore, issuesByCode map[string]int) string {
	var parts []string

	// Schema Completeness explanation
	if score.SchemaCompleteness < 5 {
		reasons := []string{}
		if issuesByCode["generic-object-request"] > 0 || issuesByCode["generic-object-response"] > 0 {
			reasons = append(reasons, "generic objects in schema")
		}
		if issuesByCode["weak-accepted-tracking-linkage"] > 0 {
			reasons = append(reasons, "202 Accepted lacks tracking ID")
		}
		if issuesByCode["weak-action-follow-up-linkage"] > 0 {
			reasons = append(reasons, "no state exposed in action response")
		}
		if issuesByCode["weak-follow-up-linkage"] > 0 {
			reasons = append(reasons, "follow-up contract not self-describing")
		}
		parts = append(parts, fmt.Sprintf("Schema %d/5: %s", score.SchemaCompleteness, strings.Join(reasons, "; ")))
	} else {
		parts = append(parts, fmt.Sprintf("Schema %d/5", score.SchemaCompleteness))
	}

	// Client Generation Quality explanation
	if score.ClientGenerationQuality < 5 {
		reasons := []string{}
		if issuesByCode["likely-missing-enum"] > 0 {
			reasons = append(reasons, "missing enums")
		}
		if issuesByCode["generic-object-request"] > 0 || issuesByCode["generic-object-response"] > 0 {
			reasons = append(reasons, "generic objects")
		}
		parts = append(parts, fmt.Sprintf("Client %d/5: %s", score.ClientGenerationQuality, strings.Join(reasons, "; ")))
	} else {
		parts = append(parts, fmt.Sprintf("Client %d/5", score.ClientGenerationQuality))
	}

	// Versioning Safety explanation
	if score.VersioningSafety < 5 {
		reasons := []string{}
		if issuesByCode["deprecated-operation"] > 0 {
			reasons = append(reasons, "operation is deprecated")
		}
		parts = append(parts, fmt.Sprintf("Versioning %d/5: %s", score.VersioningSafety, strings.Join(reasons, "; ")))
	} else {
		parts = append(parts, fmt.Sprintf("Versioning %d/5", score.VersioningSafety))
	}

	return strings.Join(parts, " | ")
}
