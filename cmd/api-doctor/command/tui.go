package command

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	intdiff "github.com/lasomethingsomething/api-doctor/internal/diff"
	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/openapi"
	"github.com/lasomethingsomething/api-doctor/internal/rule"
	"github.com/lasomethingsomething/api-doctor/internal/tui"
	"github.com/lasomethingsomething/api-doctor/internal/workflow"
	"github.com/spf13/cobra"
)

var (
	tuiSpecFile string
	tuiOldSpec  string
	tuiNewSpec  string
)

var tuiCmd = &cobra.Command{
	Use:   "tui",
	Short: "Run interactive read-only TUI",
	Long: `Run an interactive read-only Bubble Tea TUI over existing analysis/workflow/diff outputs.

Example:
  api-doctor tui --spec ./adminapi.json
  api-doctor tui --spec ./adminapi.json --old ./v1.json --new ./v2.json`,
	RunE: runTUI,
}

func init() {
	tuiCmd.Flags().StringVarP(&tuiSpecFile, "spec", "s", "", "Path to OpenAPI spec file (JSON or YAML)")
	tuiCmd.Flags().StringVar(&tuiOldSpec, "old", "", "Path to old OpenAPI spec for diff summary (optional)")
	tuiCmd.Flags().StringVar(&tuiNewSpec, "new", "", "Path to new OpenAPI spec for diff summary (optional)")
	tuiCmd.MarkFlagRequired("spec")
	rootCmd.AddCommand(tuiCmd)
}

func runTUI(cmd *cobra.Command, args []string) error {
	cmd.SilenceUsage = true

	if (tuiOldSpec == "") != (tuiNewSpec == "") {
		return fmt.Errorf("--old and --new must be provided together")
	}

	parser := openapi.NewParser()
	analysis, err := parser.ParseFile(tuiSpecFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading spec: %v\n", err)
		return err
	}

	checker := rule.NewChecker()
	analysis.Issues = checker.CheckAll(analysis.Operations)
	endpointScores := endpoint.ScoreOperations(analysis.Operations, analysis.Issues)

	graph := workflow.Infer(analysis.Operations)
	workflowScores := workflow.ScoreGraph(graph, analysis.Operations, analysis.Issues)
	chainScores := workflow.ScoreChains(graph, analysis.Operations, analysis.Issues)

	var diffResult *intdiff.Result
	if tuiOldSpec != "" && tuiNewSpec != "" {
		oldResult, err := parser.ParseFile(tuiOldSpec)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading old spec: %v\n", err)
			return err
		}
		newResult, err := parser.ParseFile(tuiNewSpec)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading new spec: %v\n", err)
			return err
		}
		diffResult = intdiff.Compare(oldResult.SpecFile, newResult.SpecFile, oldResult.Operations, newResult.Operations)
	}

	model := tui.NewModel(analysis, endpointScores, graph, workflowScores, chainScores, diffResult)
	program := tea.NewProgram(model)
	_, err = program.Run()
	return err
}
