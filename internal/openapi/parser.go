package openapi

import (
	"encoding/json"
	"os"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

// Parser loads a local OpenAPI JSON file.
type Parser struct{}

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
			result.Operations = append(result.Operations, parseOperation(pathKey, method, opObj))
		}
	}

	return result, nil
}

func parseOperation(path, method string, opObj map[string]interface{}) *model.Operation {
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
		op.RequestBody = parseRequestBody(rb)
	}

	if responses, ok := opObj["responses"].(map[string]interface{}); ok {
		for code, respVal := range responses {
			respObj, ok := respVal.(map[string]interface{})
			if !ok {
				continue
			}
			op.Responses[code] = parseResponse(code, respObj)
		}
	}

	return op
}

func parseRequestBody(rb map[string]interface{}) *model.RequestBody {
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
			body.Content[mt] = parseMediaType(mtObj)
		}
	}
	return body
}

func parseResponse(code string, resp map[string]interface{}) *model.Response {
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
			out.Content[mt] = parseMediaType(mtObj)
		}
	}
	return out
}

func parseMediaType(mt map[string]interface{}) *model.MediaType {
	out := &model.MediaType{}
	if schema, ok := mt["schema"].(map[string]interface{}); ok {
		out.Schema = parseSchema(schema)
	}
	return out
}

func parseSchema(s map[string]interface{}) *model.Schema {
	out := &model.Schema{Properties: map[string]*model.Schema{}}
	if t, ok := s["type"].(string); ok {
		out.Type = t
	}
	if ref, ok := s["$ref"].(string); ok {
		out.Ref = ref
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
		out.Items = parseSchema(items)
	}
	if props, ok := s["properties"].(map[string]interface{}); ok {
		for k, v := range props {
			m, ok := v.(map[string]interface{})
			if !ok {
				continue
			}
			out.Properties[k] = parseSchema(m)
		}
	}
	return out
}
