package openapi

import (
	"encoding/json"
	"os"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

// Parser loads a local OpenAPI JSON file.
type Parser struct{}

type schemaResolver struct {
	schemas map[string]map[string]interface{}
	stack   map[string]bool
}

func NewParser() *Parser {
	return &Parser{}
}

func (p *Parser) ParseFile(path string) (*model.AnalysisResult, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var spec map[string]interface{}
	if err := json.Unmarshal(data, &spec); err != nil {
		return nil, err
	}

	result := &model.AnalysisResult{
		SpecFile:   path,
		Operations: []*model.Operation{},
		Issues:     []*model.Issue{},
		Summary:    map[string]int{},
	}

	paths, ok := spec["paths"].(map[string]interface{})
	if !ok {
		return result, nil
	}

	resolver := buildSchemaResolver(spec)

	for pathKey, pathVal := range paths {
		pathObj, ok := pathVal.(map[string]interface{})
		if !ok {
			continue
		}
		for method, opVal := range pathObj {
			if method == "parameters" || method == "servers" {
				continue
			}
			opObj, ok := opVal.(map[string]interface{})
			if !ok {
				continue
			}
			result.Operations = append(result.Operations, parseOperation(pathKey, method, opObj, resolver))
		}
	}

	return result, nil
}

func parseOperation(path, method string, opObj map[string]interface{}, resolver *schemaResolver) *model.Operation {
	op := &model.Operation{
		Path:      path,
		Method:    method,
		Responses: map[string]*model.Response{},
	}

	if id, ok := opObj["operationId"].(string); ok {
		op.OperationID = id
	}
	if dep, ok := opObj["deprecated"].(bool); ok {
		op.Deprecated = dep
	}

	if rb, ok := opObj["requestBody"].(map[string]interface{}); ok {
		op.RequestBody = parseRequestBody(rb, resolver)
	}

	if responses, ok := opObj["responses"].(map[string]interface{}); ok {
		for code, respVal := range responses {
			respObj, ok := respVal.(map[string]interface{})
			if !ok {
				continue
			}
			op.Responses[code] = parseResponse(code, respObj, resolver)
		}
	}

	return op
}

func parseRequestBody(rb map[string]interface{}, resolver *schemaResolver) *model.RequestBody {
	body := &model.RequestBody{Content: map[string]*model.MediaType{}}
	if req, ok := rb["required"].(bool); ok {
		body.Required = req
	}
	if content, ok := rb["content"].(map[string]interface{}); ok {
		for mt, mtVal := range content {
			mtObj, ok := mtVal.(map[string]interface{})
			if !ok {
				continue
			}
			body.Content[mt] = parseMediaType(mtObj, resolver)
		}
	}
	return body
}

func parseResponse(code string, resp map[string]interface{}, resolver *schemaResolver) *model.Response {
	out := &model.Response{Code: code, Content: map[string]*model.MediaType{}}
	if d, ok := resp["description"].(string); ok {
		out.Description = d
	}
	if content, ok := resp["content"].(map[string]interface{}); ok {
		for mt, mtVal := range content {
			mtObj, ok := mtVal.(map[string]interface{})
			if !ok {
				continue
			}
			out.Content[mt] = parseMediaType(mtObj, resolver)
		}
	}
	return out
}

func parseMediaType(mt map[string]interface{}, resolver *schemaResolver) *model.MediaType {
	out := &model.MediaType{}
	if schema, ok := mt["schema"].(map[string]interface{}); ok {
		out.Schema = parseSchema(schema, resolver, 0)
	}
	return out
}

func parseSchema(s map[string]interface{}, resolver *schemaResolver, depth int) *model.Schema {
	if depth > 8 {
		return &model.Schema{Properties: map[string]*model.Schema{}}
	}
	out := &model.Schema{Properties: map[string]*model.Schema{}}

	if ref, ok := s["$ref"].(string); ok {
		out.Ref = ref
		if name, ok := resolver.schemaNameFromRef(ref); ok {
			if resolved, expand := resolver.beginExpand(name); expand {
				mergeSchema(out, parseSchema(resolved, resolver, depth+1))
				resolver.endExpand(name)
			}
		}
	}

	if t, ok := s["type"].(string); ok {
		out.Type = t
	}
	if required, ok := s["required"].([]interface{}); ok {
		for _, field := range required {
			name, ok := field.(string)
			if !ok {
				continue
			}
			out.Required = append(out.Required, name)
		}
	}
	if enumValues, ok := s["enum"].([]interface{}); ok {
		out.Enum = append(out.Enum, enumValues...)
	}
	if items, ok := s["items"].(map[string]interface{}); ok {
		out.Items = parseSchema(items, resolver, depth+1)
	}
	if props, ok := s["properties"].(map[string]interface{}); ok {
		for k, v := range props {
			m, ok := v.(map[string]interface{})
			if !ok {
				continue
			}
			out.Properties[k] = parseSchema(m, resolver, depth+1)
		}
	}

	if allOf, ok := s["allOf"].([]interface{}); ok {
		for _, item := range allOf {
			m, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			mergeSchema(out, parseSchema(m, resolver, depth+1))
		}
	}

	return out
}

func buildSchemaResolver(spec map[string]interface{}) *schemaResolver {
	resolver := &schemaResolver{schemas: map[string]map[string]interface{}{}, stack: map[string]bool{}}
	components, ok := spec["components"].(map[string]interface{})
	if !ok {
		return resolver
	}
	schemas, ok := components["schemas"].(map[string]interface{})
	if !ok {
		return resolver
	}
	for name, raw := range schemas {
		m, ok := raw.(map[string]interface{})
		if ok {
			resolver.schemas[name] = m
		}
	}
	return resolver
}

func (r *schemaResolver) schemaNameFromRef(ref string) (string, bool) {
	if r == nil {
		return "", false
	}
	const prefix = "#/components/schemas/"
	if !strings.HasPrefix(ref, prefix) {
		return "", false
	}
	name := strings.TrimPrefix(ref, prefix)
	if name == "" {
		return "", false
	}
	return name, true
}

func (r *schemaResolver) beginExpand(name string) (map[string]interface{}, bool) {
	if r == nil || strings.TrimSpace(name) == "" {
		return nil, false
}
	if r.stack[name] {
		return nil, false
	}
	resolved, ok := r.schemas[name]
	if !ok {
		return nil, false
	}
	r.stack[name] = true
	return resolved, true
}

func (r *schemaResolver) endExpand(name string) {
	if r == nil {
		return
}
	delete(r.stack, name)
}

func mergeSchema(dst, src *model.Schema) {
	if dst == nil || src == nil {
		return
	}
	if dst.Type == "" {
		dst.Type = src.Type
	}
	if dst.Items == nil && src.Items != nil {
		dst.Items = src.Items
	}
	if len(dst.Required) == 0 && len(src.Required) > 0 {
		dst.Required = append(dst.Required, src.Required...)
	}
	if len(dst.Enum) == 0 && len(src.Enum) > 0 {
		dst.Enum = append(dst.Enum, src.Enum...)
	}
	if dst.Properties == nil {
		dst.Properties = map[string]*model.Schema{}
	}
	for k, v := range src.Properties {
		if _, exists := dst.Properties[k]; !exists {
			dst.Properties[k] = v
		}
	}
}
