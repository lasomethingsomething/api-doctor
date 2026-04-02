# Usage Guide

This page explains each api-doctor command in a simple, practical way.

Scope reminder:
- Primary target today: Shopware Admin API OpenAPI spec
- Included in that scope: Admin API action routes and Sync-related routes present in that spec
- Broader API support should not be assumed unless validated in this repository
- Store API support is not claimed here

## 1) analyze

### What it does

analyze reads one Shopware Admin API spec and reports quality findings.

It checks for things like:
- missing request or response schema details
- weak links between related endpoints
- patterns that can make generated clients harder to use

### Why you would use it

Use analyze when you want a quick quality health check for one spec file.

Good moments to run it:
- before sharing a spec with your team
- before releasing a new API version
- after making edits to endpoint schemas

### One example command

```sh
go run . analyze --spec ./adminapi.json
```

### What kind of output to expect

You get a summary of findings grouped by severity (for example, errors and warnings), plus score summaries.

By default, output is text.
You can also choose markdown or json with --format.

---

## 2) workflows

### What it does

workflows infers likely endpoint flows from the spec.

In plain words, it tries to show common API journeys, such as:
- list to detail
- create to detail
- action to follow-up

It also includes selected multi-step chains.

### Why you would use it

Use workflows when you want to understand whether the API looks easy to use as a sequence of calls.

Good moments to run it:
- when reviewing endpoint naming and shape consistency
- when checking if follow-up links feel clear
- when discussing API usability with backend and frontend teams

### One example command

```sh
go run . workflows --spec ./adminapi.json
```

### What kind of output to expect

You get a summary of inferred workflow buckets and counts.

In verbose mode, you get more detail.
JSON output includes complete structured workflow and chain data.

---

## 3) diff

### What it does

diff compares two Shopware Admin API spec versions.

It flags breaking changes such as removed paths, removed operations, and removed fields.

### Why you would use it

Use diff before upgrading clients or publishing a new version.

Good moments to run it:
- in release checks
- in CI before merge
- when validating that a change is backward compatible

### One example command

```sh
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json
```

### What kind of output to expect

You get a list of detected breaking changes and a summary count.

If breaking changes are found, the command exits with a non-zero status code.
That makes it useful in CI pipelines.

---

## 4) tui

### What it does

tui opens a read-only terminal interface for browsing results from analyze, workflows, and optional diff data.

It is built with Bubble Tea, but the important part for daily use is that it helps you move from high-level summaries to concrete items faster.

### Why you would use it

Use tui when plain command output feels too dense and you want a quick visual summary without changing any data.

Good moments to run it:
- local review sessions
- pair-review of findings and workflow signals
- quick triage before digging into JSON output

### Launch command

```sh
go run . tui --spec ./adminapi.json
```

Optional: include diff data for the Diff screen:

```sh
go run . tui --spec ./adminapi.json --old ./adminapi-v1.json --new ./adminapi-v2.json
```

### Navigation keys

- Global screen navigation: left/right, tab, [, ], home, end
- Direct screen jump: 1 Overview, 2 Endpoints, 3 Findings, 4 Workflows, 5 Diff
- Quit: q (or ctrl+c)
- Open/close detail preview on selected row: enter or d
- Close detail preview: esc
- Findings bucket move: up/down (or j/k)
- Workflows bucket move: up/down (or j/k)
- Workflows section toggle (pairwise vs chains): w or s

### Current screens and views

- Overview: totals and severity summary
- Endpoints: browsable endpoint list with score summary and finding counts
- Findings: finding-code bucket summary with short detail list
- Workflows: pairwise/chain bucket summary with short detail list
- Diff: change summary (only populated when --old and --new are both provided)

### Drill-down supported today

- Endpoints: select an endpoint row, then open a detail pane with operation info, endpoint score summary, and matching findings
- Findings: select a finding-code bucket, then open a short list of matching finding entries
- Workflows: select pairwise or chain section, select a kind bucket, then open a short list of matching workflow or chain entries

### Current limitations

- Read-only only: no editing, no inline spec changes, no live fetching
- No graph rendering yet
- Uses existing analyzer/workflow/diff outputs only; it does not add new inference logic
- Best suited for Shopware Admin API specs within the validated project scope

### What kind of output to expect

You get an interactive text UI in your terminal.

It is read-only and uses the same deterministic analysis/workflow/diff logic as the CLI commands.
If you provide --old and --new together, the Diff screen is populated too.
