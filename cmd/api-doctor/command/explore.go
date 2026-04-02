package command

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	intdiff "github.com/lasomethingsomething/api-doctor/internal/diff"
	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/explore"
	"github.com/lasomethingsomething/api-doctor/internal/openapi"
	"github.com/lasomethingsomething/api-doctor/internal/rule"
	"github.com/lasomethingsomething/api-doctor/internal/workflow"
	"github.com/spf13/cobra"
)

var (
	exploreSpecFile string
	exploreBaseSpec string
	exploreHeadSpec string
	explorePort     int
	exploreOpen     bool
)

var exploreCmd = &cobra.Command{
	Use:   "explore",
	Short: "Run local browser explorer",
	Long: `Run a local browser-based explorer over existing analyze/workflows/diff outputs.

Examples:
  api-doctor explore --spec ./adminapi.json
  api-doctor explore --spec ./adminapi.json --base ./adminapi-v1.json --head ./adminapi-v2.json --open`,
	RunE: runExplore,
}

func init() {
	exploreCmd.Flags().StringVarP(&exploreSpecFile, "spec", "s", "", "Path to OpenAPI spec file (JSON or YAML)")
	exploreCmd.Flags().StringVar(&exploreBaseSpec, "base", "", "Path to base OpenAPI spec for optional diff context")
	exploreCmd.Flags().StringVar(&exploreHeadSpec, "head", "", "Path to head OpenAPI spec for optional diff context")
	exploreCmd.Flags().IntVar(&explorePort, "port", 7777, "Local TCP port for explorer server (use 0 for auto)")
	exploreCmd.Flags().BoolVar(&exploreOpen, "open", false, "Open explorer URL in default browser")
	exploreCmd.MarkFlagRequired("spec")
	rootCmd.AddCommand(exploreCmd)
}

func validateExploreDiffInputs(base, head string) error {
	if (base == "") != (head == "") {
		return fmt.Errorf("--base and --head must be provided together")
	}
	return nil
}

func runExplore(cmd *cobra.Command, args []string) error {
	cmd.SilenceUsage = true

	if err := validateExploreDiffInputs(exploreBaseSpec, exploreHeadSpec); err != nil {
		return err
	}

	parser := openapi.NewParser()
	analysis, err := parser.ParseFile(exploreSpecFile)
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
	if exploreBaseSpec != "" && exploreHeadSpec != "" {
		baseResult, err := parser.ParseFile(exploreBaseSpec)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading base spec: %v\n", err)
			return err
		}
		headResult, err := parser.ParseFile(exploreHeadSpec)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading head spec: %v\n", err)
			return err
		}
		diffResult = intdiff.Compare(baseResult.SpecFile, headResult.SpecFile, baseResult.Operations, headResult.Operations)
	}

	payload := explore.BuildPayload(
		analysis,
		endpointScores,
		graph,
		workflowScores,
		chainScores,
		diffResult,
		time.Now(),
		exploreBaseSpec,
		exploreHeadSpec,
	)

	listener, err := explore.ListenLocalhost(explorePort)
	if err != nil {
		return err
	}

	handler := explore.NewHandler(payload)
	srv := &http.Server{Handler: handler}
	errCh := make(chan error, 1)
	go func() {
		if serveErr := srv.Serve(listener); serveErr != nil && serveErr != http.ErrServerClosed {
			errCh <- serveErr
		}
	}()

	url := "http://" + listener.Addr().String()
	fmt.Fprintf(cmd.OutOrStdout(), "Explorer available at %s\n", url)
	fmt.Fprintln(cmd.OutOrStdout(), "Press Ctrl+C to stop.")

	if exploreOpen {
		if openErr := openBrowser(url); openErr != nil {
			fmt.Fprintf(os.Stderr, "Could not open browser automatically: %v\n", openErr)
		}
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	select {
	case <-sigCh:
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		return srv.Shutdown(ctx)
	case serveErr := <-errCh:
		return serveErr
	}
}

func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}
