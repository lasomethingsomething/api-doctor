package model

// Operation represents a single OpenAPI operation
type Operation struct {
	Path        string
	Method      string
	OperationID string
	Summary     string
	Deprecated  bool
	Tags        []string
	RequestBody *RequestBody
	Responses   map[string]*Response
}

// RequestBody represents the request body of an operation
type RequestBody struct {
	Required bool
	Content  map[string]*MediaType
}

// Response represents a response in an operation
type Response struct {
	Code        string
	Description string
	Content     map[string]*MediaType
}

// MediaType represents a media type (e.g., application/json)
type MediaType struct {
	Schema *Schema
}

// Schema represents a JSON schema
type Schema struct {
	Type                 string
	Properties           map[string]*Schema
	Items                *Schema
	Ref                  string
	Required             []string
	AdditionalProperties interface{}
	Description          string
	Enum                 []interface{}
}

// Issue represents a problem found during analysis
type Issue struct {
	Code        string
	Severity    string // error, warning, info
	Path        string
	Operation   string
	Message     string
	Description string

	// Spec-rule grounding — populated only for findings that are anchored to an
	// explicit OpenAPI normative statement (MUST / REQUIRED / SHOULD / SHOULD NOT).
	// Heuristic burden findings leave these zero-valued.
	EvidenceType   string // "spec-rule" when set; empty for heuristic findings
	SpecRuleID     string // stable internal ID, e.g. "OAS-RESPONSE-DESCRIPTION-REQUIRED"
	NormativeLevel string // "REQUIRED", "MUST", "SHOULD", "SHOULD NOT", "RECOMMENDED"
	SpecSource     string // OAS object area, e.g. "Response Object"
	SpecLocation   string // where in this API the issue was found, e.g. "200 response at GET /orders"
}

// AnalysisResult contains the analysis results
type AnalysisResult struct {
	SpecFile   string
	Operations []*Operation
	Issues     []*Issue
	Summary    map[string]int // count by severity
}
