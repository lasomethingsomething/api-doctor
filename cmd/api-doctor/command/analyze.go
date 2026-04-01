package command

import (
	"fmt"
	"os"

	"github.com/lasomethingsomething/api-doctor/internal/model"
	"github.com/lasomethingsomething/api-doctor/internal/openapi"
	"github.com/lasomethingsomething/api-doctor/internal/report"
	"github.com/lasomethingsomething/api-doctor/internal/rule"
	"github.com/spf13/cobra"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "Analyze an OpenAPI specification",
	Long: `Analyze an OpenAPI specification and run checks.

Example:
  api-doctor analyze --spec ./adminapi.json
  api-doctor analyze --spec ./openapi.yaml --json`,
	RunE: runAnalyze,
}

var (
	specFile string
	jsonOut  bool
)

func init() {
	analyzeCmd.Flags().StringVarP(&specFile, "spec", "s", "", "Path to OpenAPI spec file (JSON or YAML)")
	analyzeCmd.Flags().BoolVar(&jsonOut, "json", false, "Output results as JSON")
	analyzeCmd.MarkFlagRequired("spec")
}

func runAnalyze(cmd *cobra.Command, args []string) error {
	// Parse the OpenAPI spec
	parser := openapi.NewParser()
	result, err := parser.ParseFile(specFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading spec: %v\n", err)
		return err
	}

	// Run checks
	checker := rule.NewChecker()
	result.Issues = checker.CheckAll(result.Operations)

	// Format and print output
	if jsonOut {
		jsonStr, err := report.FormatJSON(result)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error formatting JSON: %v\n", err)
			return err
		}
		fmt.Println(jsonStr)
	} else {
		fmt.Print(report.FormatText(result))
	}

	// Exit with error code if there are errors
	errorCount := countSeverity(result.Issues, "error")
	if errorCount > 0 {
		return fmt.Errorf("found %d error(s)", errorCount)
	}

	return nil
}

func countSeverity(issues []*model.Issue, severity string) int {
	count := 0
	for _, issue := range issues {
		if issue.Severity == severity {
			count++
		}
	}
	return count
}
