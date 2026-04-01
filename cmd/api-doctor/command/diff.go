package command

import (
	"fmt"
	"os"

	intdiff "github.com/lasomethingsomething/api-doctor/internal/diff"
	"github.com/lasomethingsomething/api-doctor/internal/openapi"
	"github.com/spf13/cobra"
)

var (
	diffOldSpec string
	diffNewSpec string
	diffFormat  string
)

var diffCmd = &cobra.Command{
	Use:   "diff",
	Short: "Compare two OpenAPI specifications",
	Long: `Compare two OpenAPI specifications and report a narrow set of potentially breaking changes.

Example:
  api-doctor diff --old ./old.json --new ./new.json
  api-doctor diff --old ./old.json --new ./new.json --format markdown`,
	RunE: runDiff,
}

func init() {
	diffCmd.Flags().StringVar(&diffOldSpec, "old", "", "Path to the old OpenAPI spec")
	diffCmd.Flags().StringVar(&diffNewSpec, "new", "", "Path to the new OpenAPI spec")
	diffCmd.Flags().StringVar(&diffFormat, "format", "text", "Output format: text, markdown, or json")
	diffCmd.MarkFlagRequired("old")
	diffCmd.MarkFlagRequired("new")
}

func runDiff(cmd *cobra.Command, args []string) error {
	cmd.SilenceUsage = true

	parser := openapi.NewParser()
	oldResult, err := parser.ParseFile(diffOldSpec)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading old spec: %v\n", err)
		return err
	}
	newResult, err := parser.ParseFile(diffNewSpec)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading new spec: %v\n", err)
		return err
	}

	result := intdiff.Compare(oldResult.SpecFile, newResult.SpecFile, oldResult.Operations, newResult.Operations)
	switch diffFormat {
	case "json":
		jsonStr, err := intdiff.FormatJSON(result)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error formatting JSON: %v\n", err)
			return err
		}
		fmt.Println(jsonStr)
	case "markdown":
		fmt.Print(intdiff.FormatMarkdown(result))
	default:
		fmt.Print(intdiff.FormatText(result))
	}

	if len(result.Changes) > 0 {
		return fmt.Errorf("found %d potential breaking change(s)", len(result.Changes))
	}
	return nil
}