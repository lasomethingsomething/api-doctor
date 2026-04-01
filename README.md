# api-doctor

Developer-facing CLI to analyze a local OpenAPI spec and report deterministic issues.

## Quick Usage

Default scan-friendly output:

```sh
api-doctor analyze --spec ./adminapi.json
```

Deeper technical detail for follow-up work:

```sh
api-doctor analyze --spec ./adminapi.json --verbose
```

Machine-readable output:

```sh
api-doctor analyze --spec ./adminapi.json --json
```

## Two Output Styles

1. Fast interpretation (default)

- Designed for quick triage.
- Each finding shows:
  - severity + rule code
  - endpoint (operation + path)
  - short "Why it matters" explanation
- Ends with a compact summary and a tip for `--verbose`.

1. Technical follow-up (`--verbose`)

- Includes everything from default mode.
- Adds per-finding technical detail (exact detection message).
- Keeps rule code and endpoint visible for implementation work.

## Checks (v1)

- missing request schema
- missing response schema
- generic object request body
- generic object response body
- deprecated operation

## Build and Test

```sh
go mod tidy
go test ./...
go build ./...
```

## Example (Default)

```text
API Doctor Analysis Report
==========================

Spec: ./testdata/adminapi.json
Operations analyzed: 5

Error (2 issues)
---
  [ERROR] missing-request-schema
      Endpoint: put updateProduct /products/{id}
      Why it matters: Request bodies should have a defined schema to describe the expected structure

Summary
-------
Total issues: 4
Errors: 2
Warnings: 2

Tip: use --verbose for technical detail per finding.
```

## Example (Verbose)

```text
  [ERROR] missing-response-schema
      Endpoint: put updateProduct /products/{id}
      Why it matters: Responses with content should have a defined schema to describe the response structure
      Technical detail: Response 200 has no schema for media type 'application/json'
      Rule: missing-response-schema
```
