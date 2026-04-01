# api-doctor

Small standalone Go CLI to analyze a local OpenAPI spec and report deterministic issues.

## Command

```sh
api-doctor analyze --spec ./adminapi.json
```

Optional JSON output:

```sh
api-doctor analyze --spec ./adminapi.json --json
```

## Checks (v1)

- missing request schema
- missing response schema
- generic object request body
- generic object response body
- deprecated operation

## Build and Test

```sh
go build -o api-doctor ./
go test ./...
```

## Sample Output

```text
API Doctor Analysis Report
==========================

Spec: ./testdata/adminapi.json
Operations analyzed: 5

Error (2 issues)
---
  [missing-request-schema] Request body has no schema for media type 'application/json'
      Path: /products/{id}
      Op: put updateProduct
      Request bodies should have a defined schema to describe the expected structure

  [missing-response-schema] Response 200 has no schema for media type 'application/json'
      Path: /products/{id}
      Op: put updateProduct
      Responses with content should have a defined schema to describe the response structure

Warning (2 issues)
---
  [generic-object-response] Response uses a generic object type without properties
      Path: /users
      Op: get listUsers (200)
      Define specific properties in the response schema instead of using a generic object

  [deprecated-operation] Operation is marked as deprecated
      Path: /products/{id}
      Op: put updateProduct
      This operation is deprecated and should not be used for new integrations. Check the API documentation for recommended alternatives.

Summary
-------
Total issues: 4
Errors: 2
Warnings: 2
```
