# Usage Guide

This page explains each api-doctor command in a simple, practical way.

Scope reminder:

- Primary target today: Shopware Admin API OpenAPI spec
- Included in that scope: Admin API action routes and Sync-related routes present in that spec
- Broader API support should not be assumed unless validated in this repository
- Store API support is not claimed here

## Local Usage Setup (Important)

When developing locally, run commands from the project root (the directory that contains `go.mod`).

Why this matters:

- `go run . ...`, `go build ./...`, and `go test ./...` are module-aware commands.
- If you run them outside this repo root (for example from `~`), they fail because Go cannot find the module.

Two supported local usage patterns:

### 1) Run from the repo root

```sh
cd ~/api-doctor
go run . analyze --spec ./adminapi.json
go run . workflows --spec ./adminapi.json
go run . tui --spec ./adminapi.json
```

### 2) Build a local binary first

```sh
cd ~/api-doctor
go build -o api-doctor .
./api-doctor analyze --spec ./adminapi.json
./api-doctor tui --spec ./adminapi.json
```

This is documentation for local development usage only. Packaging and external tool integration are optional and not required for the workflows above.

## 1) Analyze

### What it does

analyze reads one Shopware Admin API spec and reports quality findings.

It checks for things like:

- Missing request or response schema details
- Weak links between related endpoints
- Patterns that can make generated clients harder to use

### Why you would use it

Use analyze when you want a quick quality health check for one spec file.

Good moments to run it:

- Before sharing a spec with your team
- Before releasing a new API version
- After making edits to endpoint schemas

### One example command

```sh
go run . analyze --spec ./adminapi.json
```

### What kind of output to expect

You get a summary of findings grouped by severity (for example, errors and warnings), plus score summaries.

By default, output is text.
You can also choose markdown or JSON with --format.

---

## 2) Workflows

### What it does

workflows infers likely endpoint flows from the spec.

In plain words, it tries to show common API journeys, such as:

- List to detail
- Create to detail
- Action to follow-up

It also includes selected multi-step chains.

### Why you would use it

Use workflows when you want to understand whether the API looks easy to use as a sequence of calls.

Good moments to run it:

- When reviewing endpoint naming and shape consistency
- When checking if follow-up links feel clear
- When discussing API usability with backend and frontend teams

### One example command

```sh
go run . workflows --spec ./adminapi.json
```

### What kind of output to expect

You get a summary of inferred workflow buckets and counts.

In verbose mode, you get more detail.
JSON output includes complete structured workflow and chain data.

---

## 3) Diff

### What it does

diff compares two Shopware Admin API spec versions.

It flags breaking changes such as removed paths, removed operations, and removed fields.

### Why you would use it

Use diff before upgrading clients or publishing a new version.

Good moments to run it:

- In release checks
- In CI before merge
- When validating that a change is backward compatible

### One example command

```sh
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json
```

### What kind of output to expect

You get a list of detected breaking changes and a summary count.

If breaking changes are found, the command exits with a non-zero status code.
That makes it useful in CI pipelines.

---

## 4) TUI

### What it does

tui opens a read-only terminal interface for browsing results from analyze, workflows, and optional diff data.

It is built with Bubble Tea, but the important part for daily use is that it helps you move from high-level summaries to concrete items faster.

Current maturity:

- This is an early dashboard-style browsing layer for triage and review.
- It already supports practical drill-down flows, but remains intentionally read-only and scope-limited.
- For strict automation and complete downstream processing, JSON command output is still the primary interface.

### Why you would use it

Use tui when plain command output feels too dense and you want a quick visual summary without changing any data.

Good moments to run it:

- Local review sessions
- Pair-review of findings and workflow signals
- Quick triage before digging into JSON output

### Launch command

```sh
go run . tui --spec ./adminapi.json
```

Optional: include diff data for the Diff screen:

```sh
go run . tui --spec ./adminapi.json --old ./adminapi-v1.json --new ./adminapi-v2.json
```

### Navigation keys

- Sidebar navigation (primary): up/down (or j/k), Enter to open selected section
- Pane focus: Tab or left/right moves focus across Navigation, Main, and Detail panes
- Secondary screen shortcuts: 1 Overview, 2 Hotspots, 3 Endpoints, 4 Findings, 5 Workflows, 6 Diff
- Legacy quick cycling: [ and ] (or h/l)
- Quit: q (or Ctrl+C)
- Open related detail: Enter or o (context-dependent)
- Open/close bucket preview: Enter or d (Findings/Workflows buckets)
- Close detail pane/preview: Esc
- Findings bucket move: up/down (or j/k)
- Workflows bucket move: up/down (or j/k)
- Workflows section toggle (pairwise vs chains): w or s

### Current screens and views

The layout is menu-driven:

- Left sidebar: always-visible section menu for guided navigation
- Main content pane: selected section summary/list content
- Detail/drill-down pane: shown when endpoint/workflow/findings detail is opened
- Persistent footer: key hints via Charm help component

Recommended first-run navigation:

- Start in the sidebar and choose a section with up/down.
- Press Enter to load that section in the Main pane.
- Use Enter, o, d, and Esc in Main to open and close drill-down detail.
- Move to the Detail pane with Tab or right arrow when a drill-down is open.

- Overview: totals and severity summary
- Hotspots: worst-first ranking across finding buckets, endpoint families, and workflow/chain categories
- Endpoints: browsable endpoint list with score summary and finding counts
- Findings: finding-code bucket summary with short detail list and endpoint jump option
- Workflows: pairwise/chain bucket summary with short bucket preview and item-level detail pane
- Diff: change summary (only populated when --old and --new are both provided)

### Drill-down supported today

- Endpoints: select an endpoint row, then open a detail pane with operation info, endpoint score summary, matching findings, related workflows/chains, and a short why-this-matters summary
- Findings: select a finding-code bucket, open a short list of matching findings, or press o to jump to a related endpoint detail
- Workflows: select pairwise or chain section, preview a kind bucket, then press o to open a specific workflow/chain item detail (kind, step sequence, scores, bottleneck summary, related endpoints/findings, why-this-matters)
- Hotspots: select a hotspot row, then press Enter or o to jump into related endpoint detail or workflow/chain detail when available

### Current limitations

- Read-only only: no editing, no inline spec changes, no live fetching
- No graph rendering yet
- Uses existing analyzer/workflow/diff outputs only; it does not add new inference logic
- Best suited for Shopware Admin API specs within the validated project scope

### What kind of output to expect

You get an interactive text UI in your terminal.

It is read-only and uses the same deterministic analysis/workflow/diff logic as the CLI commands.
If you provide --old and --new together, the Diff screen is populated too.
