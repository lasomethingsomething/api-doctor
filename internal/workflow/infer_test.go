package workflow

import (
	"strconv"
	"strings"
	"testing"

	"github.com/lasomethingsomething/api-doctor/internal/model"
	"github.com/lasomethingsomething/api-doctor/internal/openapi"
)

func TestInfer_WorkflowFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/workflow-inference.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	graph := Infer(result.Operations)
	if len(graph.Edges) != 3 {
		t.Fatalf("expected exactly 3 inferred workflow edges, got %#v", graph.Edges)
	}

	seen := map[string]bool{}
	for _, edge := range graph.Edges {
		seen[edge.Kind+"|"+edge.From.Path+"|"+edge.To.Path] = true
	}

	for _, key := range []string{
		"create-to-detail|/products|/products/{id}",
		"action-to-detail|/_action/order/{orderId}/state/{transition}|/order/{id}",
		"list-to-detail|/orders/search|/orders/{id}",
	} {
		if !seen[key] {
			t.Fatalf("expected inferred edge %s, got %#v", key, graph.Edges)
		}
	}

	for _, blocked := range []string{
		"create-to-detail|/widgets|/widgets/{id}",
		"list-to-detail|/users/search|/users/{id}",
	} {
		if seen[blocked] {
			t.Fatalf("did not expect inferred edge %s, got %#v", blocked, graph.Edges)
		}
	}
}

func TestFormatText_DefaultGroupsWorkflowKinds(t *testing.T) {
	graph := &Graph{Edges: []Edge{
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/products"},
			To:     Node{Method: "get", Path: "/products/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/customers"},
			To:     Node{Method: "get", Path: "/customers/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/orders"},
			To:     Node{Method: "get", Path: "/orders/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/media"},
			To:     Node{Method: "get", Path: "/media/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
		{
			Kind:   "action-to-detail",
			From:   Node{Method: "post", Path: "/_action/order/{orderId}/state/{transition}"},
			To:     Node{Method: "get", Path: "/order/{id}"},
			Reason: "action path already carries the resource id and a matching detail endpoint exists for follow-up verification",
		},
		{
			Kind:   "list-to-detail",
			From:   Node{Method: "get", Path: "/customers"},
			To:     Node{Method: "get", Path: "/customers/{id}"},
			Reason: "list or search response visibly exposes item ids and a matching detail endpoint exists",
		},
		{
			Kind:   "list-to-detail",
			From:   Node{Method: "post", Path: "/orders/search"},
			To:     Node{Method: "get", Path: "/orders/{id}"},
			Reason: "list or search response visibly exposes item ids and a matching detail endpoint exists",
		},
	}}

	out := FormatText("spec.json", 25, graph, nil, nil, false)
	if !strings.Contains(out, "Create To Detail (4)") {
		t.Fatalf("expected create-to-detail count, got: %s", out)
	}
	if !strings.Contains(out, "Action To Detail (1)") {
		t.Fatalf("expected action-to-detail count, got: %s", out)
	}
	if !strings.Contains(out, "List To Detail (2)") {
		t.Fatalf("expected updated list-to-detail count, got: %s", out)
	}
	if !strings.Contains(out, "Representative workflows: showing 3 of 4") {
		t.Fatalf("expected capped sample count, got: %s", out)
	}
	if !strings.Contains(out, "More workflows: 1 more hidden here; use --verbose or --json for the full list.") {
		t.Fatalf("expected hidden-count hint, got: %s", out)
	}
	if strings.Contains(out, "POST /media -> GET /media/{id}") {
		t.Fatalf("expected fourth create example to be hidden in default output, got: %s", out)
	}
	if !strings.Contains(out, "Tip: use --verbose or --json for the full inferred workflow list.") {
		t.Fatalf("expected default-output tip, got: %s", out)
	}
	if !strings.Contains(out, "GET list -> detail (1)") {
		t.Fatalf("expected GET list subtype wording, got: %s", out)
	}
	if !strings.Contains(out, "POST search -> detail (1)") {
		t.Fatalf("expected POST search subtype wording, got: %s", out)
	}
	if !strings.Contains(out, "GET /customers -> GET /customers/{id}") {
		t.Fatalf("expected sampled GET list workflow, got: %s", out)
	}
	if !strings.Contains(out, "POST /orders/search -> GET /orders/{id}") {
		t.Fatalf("expected sampled POST search workflow, got: %s", out)
	}
}

func TestFormatText_VerboseKeepsFullWorkflowDetails(t *testing.T) {
	graph := &Graph{Edges: []Edge{
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/products"},
			To:     Node{Method: "get", Path: "/products/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
		{
			Kind:   "create-to-detail",
			From:   Node{Method: "post", Path: "/media"},
			To:     Node{Method: "get", Path: "/media/{id}"},
			Reason: "create response visibly exposes an id and a matching detail endpoint exists",
		},
	}}

	out := FormatText("spec.json", 10, graph, nil, nil, true)
	if strings.Contains(out, "Representative workflows") {
		t.Fatalf("expected verbose output to avoid grouped summary wording, got: %s", out)
	}
	if !strings.Contains(out, "POST /products -> GET /products/{id}") {
		t.Fatalf("expected first full workflow in verbose output, got: %s", out)
	}
	if !strings.Contains(out, "POST /media -> GET /media/{id}") {
		t.Fatalf("expected second full workflow in verbose output, got: %s", out)
	}
	if strings.Contains(out, "Tip: use --verbose or --json") {
		t.Fatalf("expected no default-output tip in verbose mode, got: %s", out)
	}
	if strings.Contains(out, "More workflows:") {
		t.Fatalf("expected no hidden-count summary in verbose mode, got: %s", out)
	}
	if strings.Count(out, "POST /") != 2 {
		t.Fatalf("expected both workflows to remain visible in verbose output, got: %s", out)
	}
}

func TestFormatJSON_IncludesFullWorkflowEdges(t *testing.T) {
	graph := &Graph{Edges: []Edge{
		{
			Kind:   "action-to-detail",
			From:   Node{Method: "post", Path: "/_action/order/{orderId}/state/{transition}"},
			To:     Node{Method: "get", Path: "/order/{id}"},
			Reason: "action path already carries the resource id and a matching detail endpoint exists for follow-up verification",
		},
	}}

	out, err := FormatJSON("spec.json", 12, graph, nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "\"action-to-detail\"") {
		t.Fatalf("expected workflow kind in JSON output, got: %s", out)
	}
	if !strings.Contains(out, "\"edges\"") {
		t.Fatalf("expected full edges list in JSON output, got: %s", out)
	}
	if !strings.Contains(out, "\"inferred_workflows\": 1") {
		t.Fatalf("expected inferred workflow count in JSON output, got: %s", out)
	}
}

func TestScoreWorkflow_PerfectScoreWithNoIssues(t *testing.T) {
	edge := &Edge{
		Kind:   "create-to-detail",
		From:   Node{Method: "post", Path: "/products"},
		To:     Node{Method: "get", Path: "/products/{id}"},
		Reason: "create response visibly exposes an id and a matching detail endpoint exists",
	}
	fromOp := &model.Operation{
		Path:   "/products",
		Method: "post",
		Responses: map[string]*model.Response{
			"201": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{
							Type: "object",
							Properties: map[string]*model.Schema{
								"id": {Type: "string"},
							},
						},
					},
				},
			},
		},
	}
	toOp := &model.Operation{
		Path:   "/products/{id}",
		Method: "get",
	}

	score := ScoreWorkflow(edge, fromOp, toOp, []*model.Issue{})

	if score.UIIndependence != 5 {
		t.Fatalf("expected UI Independence 5, got %d", score.UIIndependence)
	}
	if score.SchemaCompleteness != 5 {
		t.Fatalf("expected Schema Completeness 5, got %d", score.SchemaCompleteness)
	}
	if score.ClientGenerationQuality != 5 {
		t.Fatalf("expected Client Generation Quality 5, got %d", score.ClientGenerationQuality)
	}
}

func TestScoreWorkflow_PenalizeForGenericObjects(t *testing.T) {
	edge := &Edge{
		Kind:   "create-to-detail",
		From:   Node{Method: "post", Path: "/products", OperationID: "createProduct"},
		To:     Node{Method: "get", Path: "/products/{id}", OperationID: "getProduct"},
		Reason: "create response visibly exposes an id and a matching detail endpoint exists",
	}
	fromOp := &model.Operation{
		Path:        "/products",
		Method:      "post",
		OperationID: "createProduct",
	}
	toOp := &model.Operation{
		Path:        "/products/{id}",
		Method:      "get",
		OperationID: "getProduct",
	}
	issues := []*model.Issue{
		{
			Code:      "generic-object-request",
			Path:      "/products",
			Operation: "post createProduct",
		},
		{
			Code:      "generic-object-response",
			Path:      "/products/{id}",
			Operation: "get getProduct (200)",
		},
	}

	score := ScoreWorkflow(edge, fromOp, toOp, issues)

	if score.SchemaCompleteness == 5 {
		t.Fatalf("expected Schema Completeness < 5 due to generic objects, got %d", score.SchemaCompleteness)
	}
	if score.ClientGenerationQuality == 5 {
		t.Fatalf("expected Client Generation Quality < 5 due to generic objects, got %d", score.ClientGenerationQuality)
	}
}

func TestScoreWorkflow_PenalizeForMissingEnums(t *testing.T) {
	edge := &Edge{
		Kind:   "list-to-detail",
		From:   Node{Method: "get", Path: "/products", OperationID: "listProducts"},
		To:     Node{Method: "get", Path: "/products/{id}", OperationID: "getProduct"},
		Reason: "list response visibly exposes item ids and a matching detail endpoint exists",
	}
	fromOp := &model.Operation{
		Path:        "/products",
		Method:      "get",
		OperationID: "listProducts",
	}
	toOp := &model.Operation{
		Path:        "/products/{id}",
		Method:      "get",
		OperationID: "getProduct",
	}
	issues := []*model.Issue{
		{
			Code:      "likely-missing-enum",
			Path:      "/products",
			Operation: "get listProducts (200)",
		},
	}

	score := ScoreWorkflow(edge, fromOp, toOp, issues)

	if score.ClientGenerationQuality == 5 {
		t.Fatalf("expected Client Generation Quality < 5 due to missing enum, got %d", score.ClientGenerationQuality)
	}
}

func TestScoreWorkflow_WeakLinkagePenalty(t *testing.T) {
	edge := &Edge{
		Kind:   "action-to-detail",
		From:   Node{Method: "post", Path: "/_action/order/{orderId}/state/{transition}", OperationID: "orderStateTransition"},
		To:     Node{Method: "get", Path: "/order/{id}", OperationID: "getOrder"},
		Reason: "action path already carries the resource id and a matching detail endpoint exists for follow-up verification",
	}
	fromOp := &model.Operation{
		Path:        "/_action/order/{orderId}/state/{transition}",
		Method:      "post",
		OperationID: "orderStateTransition",
	}
	toOp := &model.Operation{
		Path:        "/order/{id}",
		Method:      "get",
		OperationID: "getOrder",
	}
	issues := []*model.Issue{
		{
			Code:      "weak-action-follow-up-linkage",
			Path:      "/_action/order/{orderId}/state/{transition}",
			Operation: "post orderStateTransition (200)",
		},
	}

	score := ScoreWorkflow(edge, fromOp, toOp, issues)

	if score.SchemaCompleteness == 5 {
		t.Fatalf("expected Schema Completeness < 5 due to weak linkage, got %d", score.SchemaCompleteness)
	}
}

func TestInfer_ListDetailUpdateChain(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/workflow-chain-list-detail-update.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	graph := Infer(result.Operations)
	if len(graph.Chains) == 0 {
		t.Fatalf("expected multi-step chain inference, got none")
	}

	found := false
	for _, chain := range graph.Chains {
		if chain.Kind == "list-to-detail-to-update" {
			found = true
			if len(chain.Steps) != 3 {
				t.Fatalf("expected exactly 3 steps, got %+v", chain)
			}
		}
	}
	if !found {
		t.Fatalf("expected list-to-detail-to-update chain, got %+v", graph.Chains)
	}
}

func TestInfer_CreateDetailUpdateChain(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/workflow-chain-create-detail-update.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	graph := Infer(result.Operations)
	found := false
	for _, chain := range graph.Chains {
		if chain.Kind == "create-to-detail-to-update" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected create-to-detail-to-update chain, got %+v", graph.Chains)
	}
}

func TestInfer_OrderDetailActionChain(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/workflow-chain-order-action.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	graph := Infer(result.Operations)
	found := false
	for _, chain := range graph.Chains {
		if chain.Kind == "order-detail-to-action" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected order-detail-to-action chain, got %+v", graph.Chains)
	}
}

func TestInfer_MediaDetailFollowUpChain(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/workflow-chain-media-followup.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	graph := Infer(result.Operations)
	found := false
	for _, chain := range graph.Chains {
		if chain.Kind == "media-detail-to-follow-up-action" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected media-detail-to-follow-up-action chain, got %+v", graph.Chains)
	}
}

func TestFormatText_MultiStepChainsAreDistinct(t *testing.T) {
	graph := &Graph{
		Edges: []Edge{
			{Kind: "create-to-detail", From: Node{Method: "post", Path: "/customers"}, To: Node{Method: "get", Path: "/customers/{id}"}, Reason: "edge"},
		},
		Chains: []Chain{
			{
				Kind: "create-to-detail-to-update",
				Steps: []ChainStep{
					{Role: "create", Node: Node{Method: "post", Path: "/customers"}},
					{Role: "detail", Node: Node{Method: "get", Path: "/customers/{id}"}},
					{Role: "update", Node: Node{Method: "put", Path: "/customers/{id}"}},
				},
				Reason: "chain",
			},
		},
	}

	chainScores := map[string]*ChainScore{
		"0": {UIIndependence: 4, SchemaCompleteness: 5, ClientGenerationQuality: 5, Explanation: "Worst step 4/5/5 at create -> detail; no continuity penalty"},
	}
	out := FormatText("spec.json", 3, graph, nil, chainScores, true)
	if !strings.Contains(out, "Multi-step chains") {
		t.Fatalf("expected chain section in text output, got: %s", out)
	}
	if !strings.Contains(out, "CHAIN:") {
		t.Fatalf("expected distinct chain marker, got: %s", out)
	}
}

func TestInfer_CrudChainDedupPrefersListPerResource(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/workflow-chain-overlap-dedup.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	graph := Infer(result.Operations)
	createCount := 0
	listCount := 0
	for _, chain := range graph.Chains {
		if chain.Kind == "create-to-detail-to-update" {
			createCount++
		}
		if chain.Kind == "list-to-detail-to-update" {
			listCount++
		}
	}
	if createCount != 0 {
		t.Fatalf("expected create CRUD chain to be suppressed when list chain exists, got %d", createCount)
	}
	if listCount != 1 {
		t.Fatalf("expected exactly one list CRUD chain, got %d", listCount)
	}
}

func TestFormatText_DefaultShowsOnlyStrongChains(t *testing.T) {
	graph := &Graph{
		Edges: []Edge{},
		Chains: []Chain{
			{Kind: "create-to-detail-to-update", Steps: []ChainStep{{Role: "create", Node: Node{Method: "post", Path: "/a"}}, {Role: "detail", Node: Node{Method: "get", Path: "/a/{id}"}}, {Role: "update", Node: Node{Method: "patch", Path: "/a/{id}"}}}, Reason: "crud"},
			{Kind: "order-detail-to-action", Steps: []ChainStep{{Role: "search", Node: Node{Method: "post", Path: "/orders/search"}}, {Role: "detail", Node: Node{Method: "get", Path: "/orders/{id}"}}, {Role: "action", Node: Node{Method: "post", Path: "/_action/order/{orderId}/state/{transition}"}}}, Reason: "strong"},
		},
	}

	chainScores := map[string]*ChainScore{
		"0": {UIIndependence: 4, SchemaCompleteness: 5, ClientGenerationQuality: 5, Explanation: "crud"},
		"1": {UIIndependence: 3, SchemaCompleteness: 4, ClientGenerationQuality: 5, Explanation: "strong"},
	}
	out := FormatText("spec.json", 5, graph, nil, chainScores, false)
	if !strings.Contains(out, "No high-confidence pairwise workflows inferred.") {
		t.Fatalf("expected pairwise no-workflow message in chain-only graph, got: %s", out)
	}
	if !strings.Contains(out, "Showing stronger chains only in default output") {
		t.Fatalf("expected stronger-chain-only note, got: %s", out)
	}
	if strings.Contains(out, "Create To Detail To Update") {
		t.Fatalf("did not expect CRUD chain kind in default text output, got: %s", out)
	}
	if !strings.Contains(out, "Order Detail To Action") {
		t.Fatalf("expected strong chain kind in default text output, got: %s", out)
	}
	if !strings.Contains(out, "Signal: avg score") {
		t.Fatalf("expected concise signal summary for strong chain kind, got: %s", out)
	}
}

func TestScoreChains_WorstStepPlusContinuityPenalty(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/workflow-chain-list-detail-update.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	graph := Infer(result.Operations)
	chainScores := ScoreChains(graph, result.Operations, []*model.Issue{})
	if len(chainScores) == 0 {
		t.Fatalf("expected chain scores")
	}

	found := false
	for idx, chain := range graph.Chains {
		if chain.Kind != "list-to-detail-to-update" {
			continue
		}
		score, ok := chainScores[strconv.Itoa(idx)]
		if !ok {
			t.Fatalf("missing score for chain index %d", idx)
		}
		found = true
		if score.UIIndependence != 3 {
			t.Fatalf("expected UI score 3 due to worst-step plus list continuity penalty, got %d", score.UIIndependence)
		}
		if score.SchemaCompleteness != 5 || score.ClientGenerationQuality != 5 {
			t.Fatalf("expected schema/client to stay at worst-step value 5/5, got %d/%d", score.SchemaCompleteness, score.ClientGenerationQuality)
		}
		if score.ContinuityPenalty != 1 {
			t.Fatalf("expected continuity penalty 1, got %d", score.ContinuityPenalty)
		}
		if !strings.Contains(score.Explanation, "Worst step") {
			t.Fatalf("expected explanation to include worst-step wording, got %s", score.Explanation)
		}
	}
	if !found {
		t.Fatalf("expected list-to-detail-to-update chain")
	}
}

func TestFormatJSON_IncludesChainScores(t *testing.T) {
	graph := &Graph{
		Chains: []Chain{
			{
				Kind: "order-detail-to-action",
				Steps: []ChainStep{
					{Role: "search", Node: Node{Method: "get", Path: "/order"}},
					{Role: "detail", Node: Node{Method: "get", Path: "/order/{id}"}},
					{Role: "action", Node: Node{Method: "post", Path: "/_action/order/{orderId}/state/{transition}"}},
				},
				Reason: "strong",
			},
		},
	}
	chainScores := map[string]*ChainScore{
		"0": {UIIndependence: 3, SchemaCompleteness: 4, ClientGenerationQuality: 5, ContinuityPenalty: 2, Explanation: "Worst step 4/5/5 at detail -> action; continuity penalty: ..."},
	}

	out, err := FormatJSON("spec.json", 10, graph, nil, chainScores)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "\"chain_score_summary\"") {
		t.Fatalf("expected chain score summary in JSON output, got: %s", out)
	}
	if !strings.Contains(out, "\"continuity_penalty\": 2") {
		t.Fatalf("expected continuity penalty in chain JSON output, got: %s", out)
	}
	if !strings.Contains(out, "\"score_explanation\"") {
		t.Fatalf("expected chain score explanation in JSON output, got: %s", out)
	}
}

func TestFormatMarkdown_IncludesWorkflowAndChainSections(t *testing.T) {
	graph := &Graph{
		Edges: []Edge{
			{
				Kind:   "create-to-detail",
				From:   Node{Method: "post", Path: "/products"},
				To:     Node{Method: "get", Path: "/products/{id}"},
				Reason: "create response visibly exposes an id and a matching detail endpoint exists",
			},
		},
		Chains: []Chain{
			{
				Kind: "order-detail-to-action",
				Steps: []ChainStep{
					{Role: "detail", Node: Node{Method: "get", Path: "/order/{id}"}},
					{Role: "action", Node: Node{Method: "post", Path: "/_action/order/{orderId}/state/{transition}"}},
				},
				Reason: "strong",
			},
		},
	}

	scores := map[string]*WorkflowScore{
		"0": {
			UIIndependence:         5,
			SchemaCompleteness:     4,
			ClientGenerationQuality: 4,
			Explanation:            "strong deterministic linkage",
		},
	}
	chainScores := map[string]*ChainScore{
		"0": {
			UIIndependence:         4,
			SchemaCompleteness:     5,
			ClientGenerationQuality: 4,
		},
	}

	out := FormatMarkdown("spec.json", 20, graph, scores, chainScores)
	if !strings.Contains(out, "# API Workflows Report") || !strings.Contains(out, "## Summary") {
		t.Fatalf("expected markdown workflow header and summary, got: %s", out)
	}
	if !strings.Contains(out, "## Create To Detail (1)") || !strings.Contains(out, "`post /products`") {
		t.Fatalf("expected workflow section content, got: %s", out)
	}
	if !strings.Contains(out, "## Multi-step Chains") || !strings.Contains(out, "### Order Detail To Action (1)") {
		t.Fatalf("expected markdown chain section content, got: %s", out)
	}
}