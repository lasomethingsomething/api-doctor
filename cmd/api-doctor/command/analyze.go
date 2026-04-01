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
	format   string
	verbose  bool
)

func init() {
	analyzeCmd.Flags().StringVarP(&specFile, "spec", "s", "", "Path to OpenAPI spec file (JSON or YAML)")
	analyzeCmd.Flags().StringVar(&format, "format", "text", "Output format: text, markdown, or json")
	analyzeCmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Show deeper technical detail in text output")
	analyzeCmd.MarkFlagRequired("spec")
}

func runAnalyze(cmd *cobra.Command, args []string) error {
	// The command is valid at this point, so runtime analysis errors should not print usage.
	cmd.SilenceUsage = true

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
	switch format {
	case "json":
		jsonStr, err := report.FormatJSON(result)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error formatting JSON: %v\n", err)
			return err
		}
		fmt.Println(jsonStr)
	case "markdown":
		fmt.Print(report.FormatAnalysisMarkdown(result))
	default:
		fmt.Print(report.FormatText(result, verbose))
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
