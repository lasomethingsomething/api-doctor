package command

import (
	"fmt"
	"os"

	"github.com/lasomethingsomething/api-doctor/internal/openapi"
	"github.com/lasomethingsomething/api-doctor/internal/rule"
	"github.com/lasomethingsomething/api-doctor/internal/workflow"
	"github.com/spf13/cobra"
)

var workflowSpecFile string
var workflowFormat string
var workflowVerbose bool

var workflowsCmd = &cobra.Command{
	Use:   "workflows",
	Short: "Infer a small high-confidence workflow graph",
	Long: `Infer a small set of high-confidence workflows from an OpenAPI specification.

Example:
  api-doctor workflows --spec ./adminapi.json`,
	RunE: runWorkflows,
}

func init() {
	workflowsCmd.Flags().StringVarP(&workflowSpecFile, "spec", "s", "", "Path to OpenAPI spec file (JSON or YAML)")
	workflowsCmd.Flags().StringVar(&workflowFormat, "format", "text", "Output format: text, markdown, or json")
	workflowsCmd.Flags().BoolVarP(&workflowVerbose, "verbose", "v", false, "Show full inferred workflow detail in text output")
	workflowsCmd.MarkFlagRequired("spec")
}

func runWorkflows(cmd *cobra.Command, args []string) error {
	cmd.SilenceUsage = true

	parser := openapi.NewParser()
	result, err := parser.ParseFile(workflowSpecFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading spec: %v\n", err)
		return err
	}

	// Run checks to populate issues for scoring
	checker := rule.NewChecker()
	result.Issues = checker.CheckAll(result.Operations)

	graph := workflow.Infer(result.Operations)
	scores := workflow.ScoreGraph(graph, result.Operations, result.Issues)
	chainScores := workflow.ScoreChains(graph, result.Operations, result.Issues)

	switch workflowFormat {
	case "json":
		jsonStr, err := workflow.FormatJSON(result.SpecFile, len(result.Operations), graph, scores, chainScores)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error formatting JSON: %v\n", err)
			return err
		}
		fmt.Println(jsonStr)
	case "markdown":
		fmt.Print(workflow.FormatMarkdown(result.SpecFile, len(result.Operations), graph, scores, chainScores))
	default:
		fmt.Print(workflow.FormatText(result.SpecFile, len(result.Operations), graph, scores, chainScores, workflowVerbose))
	}
	return nil
}