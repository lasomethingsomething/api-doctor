# api-doctor

api-doctor is a local command-line helper for checking the quality of Shopware Admin API OpenAPI specs. What it does:

- points out things that may confuse API users.
- highlights risky changes between spec versions.
- gives quick summaries you can scan in the terminal.

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

- Primary target today is Shopware Admin API OpenAPI spec
- Included in that scope are Admin API action routes
- Broader API support should not be assumed unless validated in this repository
- Store API support is not provided yet

## Prerequisites

- Go 1.21+
- A local Shopware Admin API OpenAPI spec file in JSON format

## Install

Important for local development:

- Commands like `go run . ...`, `go build ./...`, and `go test ./...` must be run from the project root directory (the folder that contains `go.mod`).
- If you run them from another directory (for example `~`), they will fail because Go cannot find this module.

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

## Local Developer Workflows

You can use api-doctor locally in two simple ways while developing.

### 1) Run from the repo root

Use this when iterating quickly on code changes:

```sh
cd ~/api-doctor
go run . analyze --spec ./adminapi.json
go run . workflows --spec ./adminapi.json
go run . tui --spec ./adminapi.json
```

### 2) Build a local binary first

Use this when you want repeatable command runs without `go run` startup overhead:

```sh
cd ~/api-doctor
go build -o api-doctor .
./api-doctor analyze --spec ./adminapi.json
./api-doctor tui --spec ./adminapi.json
```

Both workflows are local-only and do not require packaging or any external CLI integration.

## Quickstart

Run one basic check on your Admin API spec:

```sh
go run . analyze --spec ./adminapi.json
```

If that works, try the read-only terminal UI:

```sh
go run . tui --spec ./adminapi.json
```

## 5-Minute Paths By Role

If you are an external developer and you need to chain calls safely:

1. Run `go run . workflows --spec ./adminapi.json` to see likely next-call routes.
2. Run `go run . tui --spec ./adminapi.json` and open Endpoints.
3. Pick a target endpoint and open detail.
4. Use `Likely next calls`, `Required identifiers`, and `Linkage status` to verify follow-up steps.
5. Check Issue categories for entries marked `[consistency]` to spot route/shape traps before integration.

If you are an internal API owner/team and you need to prioritize fixes:

1. Run `go run . analyze --spec ./adminapi.json` for issue summary and endpoint quality.
2. Open `go run . tui --spec ./adminapi.json`.
3. Start in Overview and read `Fix first (deterministic snapshot)`.
4. Use Hotspots for highest-priority endpoint areas and repeated issue categories.
5. Use Issue categories to inspect consistency findings and representative endpoints.

If you are a PM or stakeholder and you need a fast status snapshot:

1. Run `go run . analyze --spec ./adminapi.json`.
2. Capture top-line metrics: total issues, severity split, endpoint quality summary.
3. Open `go run . tui --spec ./adminapi.json` and check Overview for deterministic `Fix first` lines.
4. Review Workflows totals (single-step and multi-step) for usability signal.
5. If release comparison is needed, run `go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json`.

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

Diff mode note:

- `./adminapi.json` is your current local spec in this common workflow.
- Diff mode requires two additional files: an older spec (`--old`) and a newer spec (`--new`).
- Diff data is not auto-discovered in this TUI mode; you must pass both flags explicitly at launch.

Example:

```sh
go run . tui --spec ./adminapi.json --old ./adminapi-v1.json --new ./adminapi-v2.json
```

The TUI is read-only. It does not edit specs or change analyzer logic.

Current high-level screens:

- Overview: top-level totals, severity summary, and a compact deterministic "Fix first" snapshot
- Hotspots: ranked priority areas across issue categories, endpoint areas, and workflow patterns
- Endpoints: browsable endpoint list with explicit labels (`issues`, `quality`, `priority`) and risk/path sort toggle
- Issue categories: grouped issue-code categories with structured detail (summary, affected count, representative examples, why it matters)
- Workflows: single-step and multi-step workflow pattern summaries with inline examples
- Diff: diff summary when launched with --old and --new; otherwise shows how to enable diff mode with an example command

Common keybindings:

- Sidebar-first navigation: Up/down to choose section, Enter to open
- Focus switching: Tab or left/right moves focus across Navigation, Main, and Detail panes
- Quick section shortcuts: number keys 1..6 (secondary)
- Legacy section cycling: [ and ] (or h/l)
- Open related detail: Enter or o (context-dependent)
- Endpoints sort mode: r toggles priority-first and path order
- Close detail pane: Esc

First-time flow:

- Move in the left menu with up/down.
- Press Enter to open a section in the Main pane.
- Use Tab or right arrow to move to the Detail pane when a drill-down is open.


## Command overview

Use one command at a time based on what you need:

- analyze: check spec quality and get issues with actionable summaries
- workflows: see likely single-step and multi-step call chains
- diff: compare two spec versions for breaking changes
- tui: browse summaries interactively in a read-only terminal view

For beginner-friendly command walkthroughs, see:

- [docs/usage.md](docs/usage.md)
