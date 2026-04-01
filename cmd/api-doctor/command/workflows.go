package command

import (
	"fmt"
	"os"

	"github.com/lasomethingsomething/api-doctor/internal/openapi"
	"github.com/lasomethingsomething/api-doctor/internal/workflow"
	"github.com/spf13/cobra"
)

var workflowSpecFile string
var workflowJSONOut bool
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
	workflowsCmd.Flags().BoolVar(&workflowJSONOut, "json", false, "Output inferred workflows as JSON")
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

	graph := workflow.Infer(result.Operations)
	if workflowJSONOut {
		jsonStr, err := workflow.FormatJSON(result.SpecFile, len(result.Operations), graph)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error formatting JSON: %v\n", err)
			return err
		}
		fmt.Println(jsonStr)
		return nil
	}

	fmt.Print(workflow.FormatText(result.SpecFile, len(result.Operations), graph, workflowVerbose))
	return nil
}