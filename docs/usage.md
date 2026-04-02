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

tui opens a read-only terminal interface for quick browsing.

Current UI includes:
- four summary screens: Overview, Findings, Workflows, Diff
- keyboard navigation across screens
- lightweight drill-down on finding-code buckets and workflow-kind buckets

### Why you would use it

Use tui when plain command output feels too dense and you want a quick visual summary without changing any data.

Good moments to run it:
- local review sessions
- pair-review of findings and workflow signals
- quick triage before digging into JSON output

### One example command

```sh
go run . tui --spec ./adminapi.json
```

### What kind of output to expect

You get an interactive text UI in your terminal.

It is read-only and uses the same deterministic analysis/workflow/diff logic as the CLI commands.
If you provide --old and --new together, the Diff screen is populated too.
