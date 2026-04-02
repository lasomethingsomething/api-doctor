# api-doctor

api-doctor is a local command-line helper for checking the quality of Shopware Admin API OpenAPI specs.

Think of it like a spell-checker for API specs:

- It points out things that may confuse API users.
- It highlights risky changes between spec versions.
- It gives quick summaries you can scan in the terminal.

It is deterministic and local-only.

- No network calls
- No AI calls

## What problem this helps solve

When API specs grow, it gets hard to spot quality issues by eye.

api-doctor helps you quickly answer:

- Are there obvious schema quality issues?
- Do routes look easy to chain into workflows?
- Did a new spec version introduce breaking changes?

## Current scope (important)

Current validated scope is intentionally narrow:

- Primary target today: Shopware Admin API OpenAPI spec
- Included in that scope: Admin API action routes and Sync-related routes present in that spec
- Broader API support should not be assumed unless validated in this repository
- Store API support is not claimed here

## Prerequisites

- Go 1.21+
- A local Shopware Admin API OpenAPI spec file in JSON format

## Install

Build and verify locally:

```sh
go mod tidy
go build ./...
go test ./...
```

Optional: install the binary in your Go bin path:

```sh
go install .
```

## Quickstart

Run one basic check on your Admin API spec:

```sh
go run . analyze --spec ./adminapi.json
```

If that works, try the read-only terminal UI:

```sh
go run . tui --spec ./adminapi.json
```

## TUI (interactive, read-only)

The TUI is an interactive terminal view over the same analysis data that the CLI commands produce.

Maturity note:

- Current state is an early dashboard-style interface meant for fast triage and drill-downs.
- Polished enough for daily local use, but still intentionally narrow and evolving.
- Not a full replacement for exported JSON in advanced automation/reporting workflows.

Why use it instead of plain CLI output:

- Easier to scan large result sets quickly.
- Easier to move from summary to concrete endpoint/finding/workflow context.
- Useful for triage sessions before exporting or scripting against JSON output.

How to launch:

```sh
go run . tui --spec ./adminapi.json
```

The TUI is read-only. It does not edit specs or change analyzer logic.

Current high-level screens:

- Overview: top-level totals and severity summary
- Hotspots: worst areas first across findings, endpoint families, and workflow categories
- Endpoints: browsable endpoint list with related score and finding detail
- Findings: finding-code buckets and short detail preview
- Workflows: workflow/chain buckets with both bucket preview and item-level detail
- Diff: diff summary when launched with --old and --new

Common keybindings:

- Sidebar-first navigation: Up/down to choose section, Enter to open
- Focus switching: Tab (or left/right) toggles Navigation and Content focus
- Quick section shortcuts: number keys 1..6 (secondary)
- Legacy section cycling: [ and ] (or h/l)
- Open related detail: Enter or o (context-dependent)
- Close detail pane: Esc

First-time flow:

- Move in the left menu with up/down.
- Press Enter to open a section in the main pane.
- Use Tab to move into content and open drill-down details.

## Command overview

Use one command at a time based on what you need:

- analyze: check spec quality and get findings
- workflows: see inferred route-to-route flow signals
- diff: compare two spec versions for breaking changes
- tui: browse summaries interactively in a read-only terminal view

For beginner-friendly command walkthroughs, see:

- [docs/usage.md](docs/usage.md)
