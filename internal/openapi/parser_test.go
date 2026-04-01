package openapi

import (
	"os"
	"testing"
)

func TestParserParseFile(t *testing.T) {
	parser := NewParser()
	result, err := parser.ParseFile("../../testdata/adminapi.json")
	if err != nil {
		t.Fatalf("Error parsing spec: %v", err)
	}

	if result.SpecFile != "../../testdata/adminapi.json" {
		t.Errorf("Expected spec file to be '../../testdata/adminapi.json', got %s", result.SpecFile)
	}

	if len(result.Operations) == 0 {
		t.Errorf("Expected operations to be parsed, got 0")
	}

	// Check specific operations
	operationFound := false
	for _, op := range result.Operations {
		if op.OperationID == "listProducts" {
			operationFound = true
			if op.Path != "/products" {
				t.Errorf("Expected path '/products', got %s", op.Path)
			}
			if op.Method != "get" {
				t.Errorf("Expected method 'get', got %s", op.Method)
			}
			break
		}
	}

	if !operationFound {
		t.Errorf("Expected to find 'listProducts' operation")
	}
}

func TestParserParseFile_NotFound(t *testing.T) {
	parser := NewParser()
	_, err := parser.ParseFile("/nonexistent/spec.json")
	if err == nil {
		t.Errorf("Expected error for nonexistent file, got nil")
	}
}

func TestParserParseFile_InvalidJSON(t *testing.T) {
	parser := NewParser()
	// Create a temporary invalid JSON file
	tmpFile := "/tmp/invalid.json"
	err := os.WriteFile(tmpFile, []byte("{invalid json"), 0644)
	if err != nil {
		t.Fatalf("Error creating temp file: %v", err)
	}
	defer os.Remove(tmpFile)

	_, err = parser.ParseFile(tmpFile)
	if err == nil {
		t.Errorf("Expected error for invalid JSON, got nil")
	}
}
