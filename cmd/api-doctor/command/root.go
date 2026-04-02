package command

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "api-doctor",
	Short: "Local, deterministic OpenAPI quality checker",
	Long: `api-doctor analyzes OpenAPI specs with deterministic local checks.
It helps you review API quality, call chaining clarity, and breaking diff risk.`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.AddCommand(analyzeCmd)
	rootCmd.AddCommand(diffCmd)
	rootCmd.AddCommand(workflowsCmd)
}
