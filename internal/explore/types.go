package explore

// Payload is the normalized single JSON model consumed by the browser explorer UI.
type Payload struct {
	Run             RunContext                `json:"run"`
	Summary         Summary                   `json:"summary"`
	FixFirst        []FixFirstItem            `json:"fixFirst"`
	Endpoints       []EndpointRow             `json:"endpoints"`
	EndpointDetails map[string]EndpointDetail `json:"endpointDetails"`
	Workflows       WorkflowSection           `json:"workflows"`
	Diff            *DiffSection              `json:"diff,omitempty"`
	GraphSeed       GraphSeed                 `json:"graphSeed"`
}

type RunContext struct {
	SpecPath     string `json:"specPath"`
	GeneratedAt  string `json:"generatedAt"`
	BaseSpecPath string `json:"baseSpecPath,omitempty"`
	HeadSpecPath string `json:"headSpecPath,omitempty"`
}

type Summary struct {
	TotalFindings      int            `json:"totalFindings"`
	SeverityCounts     map[string]int `json:"severityCounts"`
	EndpointsAnalyzed  int            `json:"endpointsAnalyzed"`
	WorkflowsInferred  int            `json:"workflowsInferred"`
	ChainsInferred     int            `json:"chainsInferred"`
	EndpointsWithIssue int            `json:"endpointsWithIssues"`
}

type FixFirstItem struct {
	ID          string       `json:"id"`
	Label       string       `json:"label"`
	Value       string       `json:"value"`
	Description string       `json:"description"`
	Filter      FilterPreset `json:"filter"`
}

type FilterPreset struct {
	Severity    string `json:"severity,omitempty"`
	Category    string `json:"category,omitempty"`
	BurdenFocus string `json:"burdenFocus,omitempty"`
	Query       string `json:"query,omitempty"`
}

type EndpointRow struct {
	ID             string         `json:"id"`
	Method         string         `json:"method"`
	Path           string         `json:"path"`
	Findings       int            `json:"findings"`
	SeverityCounts map[string]int `json:"severityCounts"`
	CategoryCounts map[string]int `json:"categoryCounts"`
	BurdenFocuses  []string       `json:"burdenFocuses"`
	Priority       string         `json:"priority"`
	RiskSummary    string         `json:"riskSummary"`
	Family         string         `json:"family"`
}

type EndpointDetail struct {
	Endpoint         EndpointRow       `json:"endpoint"`
	Findings         []FindingDetail   `json:"findings"`
	RelatedWorkflows []WorkflowEntry   `json:"relatedWorkflows"`
	RelatedChains    []ChainEntry      `json:"relatedChains"`
	RelatedDiff      []DiffChangeEntry `json:"relatedDiff"`
}

type FindingDetail struct {
	Code        string `json:"code"`
	Severity    string `json:"severity"`
	Category    string `json:"category"`
	BurdenFocus string `json:"burdenFocus"`
	Operation   string `json:"operation"`
	Message     string `json:"message"`
	Impact      string `json:"impact"`
}

type WorkflowSection struct {
	FamilyCounts map[string]int  `json:"familyCounts"`
	Entries      []WorkflowEntry `json:"entries"`
	Chains       []ChainEntry    `json:"chains"`
}

type WorkflowEntry struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	FromID    string `json:"fromId"`
	FromLabel string `json:"fromLabel"`
	ToID      string `json:"toId"`
	ToLabel   string `json:"toLabel"`
	Reason    string `json:"reason"`
	Score     string `json:"score,omitempty"`
}

type ChainEntry struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	EndpointIDs []string `json:"endpointIds"`
	Summary     string   `json:"summary"`
	Reason      string   `json:"reason"`
	Score       string   `json:"score,omitempty"`
}

type DiffSection struct {
	TotalChanges int               `json:"totalChanges"`
	ByCode       map[string]int    `json:"byCode"`
	BySeverity   map[string]int    `json:"bySeverity"`
	Entries      []DiffChangeEntry `json:"entries"`
}

type DiffChangeEntry struct {
	Code        string `json:"code"`
	Severity    string `json:"severity"`
	Path        string `json:"path"`
	Operation   string `json:"operation"`
	Location    string `json:"location"`
	Message     string `json:"message"`
	Description string `json:"description"`
}

type GraphSeed struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

type GraphNode struct {
	ID    string `json:"id"`
	Kind  string `json:"kind"`
	Label string `json:"label"`
}

type GraphEdge struct {
	From string `json:"from"`
	To   string `json:"to"`
	Kind string `json:"kind"`
}
