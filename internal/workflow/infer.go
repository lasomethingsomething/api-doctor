package workflow

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

type Node struct {
	Path        string
	Method      string
	OperationID string
}

type Edge struct {
	Kind   string
	From   Node
	To     Node
	Reason string
}

type Graph struct {
	Nodes []Node
	Edges []Edge
}

const workflowSampleLimit = 3

func Infer(operations []*model.Operation) *Graph {
	graph := &Graph{
		Nodes: make([]Node, 0, len(operations)),
		Edges: make([]Edge, 0),
	}

	for _, op := range operations {
		graph.Nodes = append(graph.Nodes, nodeFromOperation(op))
	}

	detailByBase := map[string]*model.Operation{}
	for _, op := range operations {
		basePath, ok := detailBasePath(op)
		if !ok {
			continue
		}
		detailByBase[basePath] = op
	}

	seen := map[string]bool{}
	for _, op := range operations {
		if detailOp, edge, ok := inferCreateEdge(op, detailByBase); ok {
			appendEdge(graph, seen, op, detailOp, edge)
		}
		if detailOp, edge, ok := inferActionEdge(op, detailByBase); ok {
			appendEdge(graph, seen, op, detailOp, edge)
		}
		if detailOp, edge, ok := inferListEdge(op, detailByBase); ok {
			appendEdge(graph, seen, op, detailOp, edge)
		}
	}

	sort.Slice(graph.Edges, func(i, j int) bool {
		if graph.Edges[i].Kind != graph.Edges[j].Kind {
			return graph.Edges[i].Kind < graph.Edges[j].Kind
		}
		if graph.Edges[i].From.Path != graph.Edges[j].From.Path {
			return graph.Edges[i].From.Path < graph.Edges[j].From.Path
		}
		return graph.Edges[i].To.Path < graph.Edges[j].To.Path
	})

	return graph
}

func FormatText(specFile string, operationCount int, graph *Graph, verbose bool) string {
	out := "API Doctor Workflow Report\n"
	out += "==========================\n\n"
	out += fmt.Sprintf("Spec: %s\n", specFile)
	out += fmt.Sprintf("Operations analyzed: %d\n", operationCount)
	out += fmt.Sprintf("Inferred workflows: %d\n\n", len(graph.Edges))

	if len(graph.Edges) == 0 {
		out += "No high-confidence workflows inferred.\n"
		return out
	}

	groups := map[string][]Edge{}
	for _, edge := range graph.Edges {
		groups[edge.Kind] = append(groups[edge.Kind], edge)
	}

	for _, kind := range []string{"action-to-detail", "create-to-detail", "list-to-detail"} {
		edges := groups[kind]
		if len(edges) == 0 {
			continue
		}

		out += fmt.Sprintf("%s (%d)\n", title(kind), len(edges))
		out += "---\n"

		if !verbose {
			if kind == "list-to-detail" {
				out += formatListDetailSummary(edges)
				out += "\n"
				continue
			}

			out += fmt.Sprintf("  Representative workflows: showing %d of %d\n", minInt(len(edges), workflowSampleLimit), len(edges))
			for _, edge := range edges[:minInt(len(edges), workflowSampleLimit)] {
				out += fmt.Sprintf("  %s %s -> %s %s\n", strings.ToUpper(edge.From.Method), edge.From.Path, strings.ToUpper(edge.To.Method), edge.To.Path)
				out += fmt.Sprintf("      Why: %s\n", edge.Reason)
			}
			if len(edges) > workflowSampleLimit {
				out += fmt.Sprintf("  More workflows: %d more hidden here; use --verbose or --json for the full list.\n", len(edges)-workflowSampleLimit)
			}
			out += "\n"
			continue
		}

		for _, edge := range edges {
			out += fmt.Sprintf("  %s %s -> %s %s\n", strings.ToUpper(edge.From.Method), edge.From.Path, strings.ToUpper(edge.To.Method), edge.To.Path)
			out += fmt.Sprintf("      Why: %s\n", edge.Reason)
		}
		out += "\n"
	}

	if !verbose {
		out += "Tip: use --verbose or --json for the full inferred workflow list.\n"
	}

	return out
}

func FormatJSON(specFile string, operationCount int, graph *Graph) (string, error) {
	summary := map[string]int{}
	for _, edge := range graph.Edges {
		summary[edge.Kind]++
	}

	payload := map[string]interface{}{
		"spec":               specFile,
		"operations":         operationCount,
		"inferred_workflows": len(graph.Edges),
		"summary":            summary,
		"edges":              graph.Edges,
	}

	b, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func formatListDetailSummary(edges []Edge) string {
	getList := make([]Edge, 0)
	postSearch := make([]Edge, 0)
	other := make([]Edge, 0)

	for _, edge := range edges {
		switch strings.ToUpper(edge.From.Method) {
		case "GET":
			getList = append(getList, edge)
		case "POST":
			if strings.HasSuffix(edge.From.Path, "/search") {
				postSearch = append(postSearch, edge)
			} else {
				other = append(other, edge)
			}
		default:
			other = append(other, edge)
		}
	}

	out := ""
	out += fmt.Sprintf("  Representative workflows: showing %d of %d\n", minInt(len(edges), workflowSampleLimit), len(edges))
	if len(getList) > 0 {
		out += formatWorkflowSubtype("GET list -> detail", getList)
	}
	if len(postSearch) > 0 {
		out += formatWorkflowSubtype("POST search -> detail", postSearch)
	}
	if len(other) > 0 {
		out += formatWorkflowSubtype("Other list/detail flows", other)
	}
	if len(edges) > workflowSampleLimit {
		out += fmt.Sprintf("  More workflows: %d more hidden here; use --verbose or --json for the full list.\n", len(edges)-workflowSampleLimit)
	}
	return out
}

func formatWorkflowSubtype(label string, edges []Edge) string {
	out := ""
	out += fmt.Sprintf("  %s (%d)\n", label, len(edges))
	for _, edge := range edges[:minInt(len(edges), workflowSampleLimit)] {
		out += fmt.Sprintf("  %s %s -> %s %s\n", strings.ToUpper(edge.From.Method), edge.From.Path, strings.ToUpper(edge.To.Method), edge.To.Path)
		out += fmt.Sprintf("      Why: %s\n", edge.Reason)
	}
	return out
}

func appendEdge(graph *Graph, seen map[string]bool, from *model.Operation, to *model.Operation, edge Edge) {
	key := strings.Join([]string{edge.Kind, from.Method, from.Path, to.Method, to.Path}, "|")
	if seen[key] {
		return
	}
	seen[key] = true
	graph.Edges = append(graph.Edges, edge)
}

func inferCreateEdge(op *model.Operation, detailByBase map[string]*model.Operation) (*model.Operation, Edge, bool) {
	basePath, ok := createBasePath(op)
	if !ok {
		return nil, Edge{}, false
	}
	detailOp, ok := detailByBase[basePath]
	if !ok {
		return nil, Edge{}, false
	}
	_, schema, ok := successfulJSONResponseSchema(op)
	if !ok || !responseExposesIdentifier(schema, 0) {
		return nil, Edge{}, false
	}

	return detailOp, Edge{
		Kind:   "create-to-detail",
		From:   nodeFromOperation(op),
		To:     nodeFromOperation(detailOp),
		Reason: "create response visibly exposes an id and a matching detail endpoint exists",
	}, true
}

func inferActionEdge(op *model.Operation, detailByBase map[string]*model.Operation) (*model.Operation, Edge, bool) {
	detailPath, ok := actionTransitionDetailPath(op)
	if !ok {
		return nil, Edge{}, false
	}
	basePath, _, ok := detailPathBaseAndParam(detailPath)
	if !ok {
		return nil, Edge{}, false
	}
	detailOp, ok := detailByBase[basePath]
	if !ok {
		return nil, Edge{}, false
	}

	return detailOp, Edge{
		Kind:   "action-to-detail",
		From:   nodeFromOperation(op),
		To:     nodeFromOperation(detailOp),
		Reason: "action path already carries the resource id and a matching detail endpoint exists for follow-up verification",
	}, true
}

func inferListEdge(op *model.Operation, detailByBase map[string]*model.Operation) (*model.Operation, Edge, bool) {
	basePath, ok := listBasePath(op)
	if !ok {
		return nil, Edge{}, false
	}
	detailOp, ok := detailByBase[basePath]
	if !ok {
		return nil, Edge{}, false
	}
	_, schema, ok := successfulJSONResponseSchema(op)
	if !ok || !collectionExposesIdentifier(schema, 0) {
		return nil, Edge{}, false
	}

	return detailOp, Edge{
		Kind:   "list-to-detail",
		From:   nodeFromOperation(op),
		To:     nodeFromOperation(detailOp),
		Reason: "list or search response visibly exposes item ids and a matching detail endpoint exists",
	}, true
	}

func nodeFromOperation(op *model.Operation) Node {
	if op == nil {
		return Node{}
	}
	return Node{Path: op.Path, Method: op.Method, OperationID: op.OperationID}
}

func detailBasePath(op *model.Operation) (string, bool) {
	if op == nil || strings.ToUpper(op.Method) != "GET" {
		return "", false
	}
	segments := splitPathSegments(op.Path)
	if len(segments) != 2 || !isPathParam(segments[1]) {
		return "", false
	}
	paramName := strings.TrimSuffix(strings.TrimPrefix(segments[1], "{"), "}")
	if paramName != "id" {
		return "", false
	}
	return "/" + segments[0], true
}

func createBasePath(op *model.Operation) (string, bool) {
	if op == nil || strings.ToUpper(op.Method) != "POST" {
		return "", false
	}
	if strings.Contains(op.Path, "{") || strings.HasPrefix(op.Path, "/_action/") || strings.HasSuffix(op.Path, "/search") {
		return "", false
	}
	return op.Path, true
}

func listBasePath(op *model.Operation) (string, bool) {
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

func successfulJSONResponseSchema(op *model.Operation) (string, *model.Schema, bool) {
	if op == nil {
		return "", nil, false
	}
	for _, code := range []string{"200", "201", "202"} {
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

func actionTransitionDetailPath(op *model.Operation) (string, bool) {
	if op == nil || strings.ToUpper(op.Method) != "POST" {
		return "", false
	}
	segments := splitPathSegments(op.Path)
	if len(segments) != 5 {
		return "", false
	}
	if segments[0] != "_action" || !isPathParam(segments[2]) || segments[3] != "state" || !isPathParam(segments[4]) {
		return "", false
	}
	if segments[1] == "state-machine" {
		return "", false
	}
	resource := strings.ReplaceAll(segments[1], "_", "-")
	return "/" + resource + "/{id}", true
}

func responseExposesIdentifier(schema *model.Schema, depth int) bool {
	if schema == nil || depth > 3 {
		return false
	}
	if schema.Ref != "" {
		return true
	}
	if schema.Type == "array" {
		return responseExposesIdentifier(schema.Items, depth+1)
	}
	if schema.Type != "object" || len(schema.Properties) == 0 {
		return false
	}
	for _, candidate := range []string{"id"} {
		if _, ok := schema.Properties[candidate]; ok {
			return true
		}
	}
	for _, wrapper := range []string{"data", "result", "item"} {
		child, ok := schema.Properties[wrapper]
		if ok && responseExposesIdentifier(child, depth+1) {
			return true
		}
	}
	return false
}

func collectionExposesIdentifier(schema *model.Schema, depth int) bool {
	if schema == nil || depth > 3 {
		return false
	}
	if schema.Ref != "" {
		return true
	}
	if schema.Type == "array" {
		return responseExposesIdentifier(schema.Items, depth+1)
	}
	if schema.Type != "object" || len(schema.Properties) == 0 {
		return false
	}
	for _, wrapper := range []string{"data", "items", "elements", "result", "results", "records"} {
		child, ok := schema.Properties[wrapper]
		if !ok || child == nil {
			continue
		}
		if child.Type == "array" {
			return responseExposesIdentifier(child.Items, depth+1)
		}
		if collectionExposesIdentifier(child, depth+1) {
			return true
		}
	}
	return false
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
	return "/" + strings.Join(segments[:len(segments)-1], "/"), paramName, true
}

func title(s string) string {
	parts := strings.Split(s, "-")
	for i, part := range parts {
		if part == "" {
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}