package command

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "api-doctor",
	Short: "OpenAPI specification analyzer and validator",
	Long: `api-doctor is a tool for analyzing OpenAPI specifications.
It performs various checks on your OpenAPI specs to identify issues.`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.AddCommand(analyzeCmd)
}
