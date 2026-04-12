# Explorer Product Spec

## Purpose

This document defines the target product shape for the `explore` UI in this repo.

It is intended to replace the current mixed model where the Explorer acts as a dashboard, filter surface, inspector, workflow viewer, and evidence browser all at once.

The target Explorer should help a developer or API owner answer four questions quickly:

1. What is broken for developers here?
2. Is this mainly a contract problem, a workflow problem, or a response-shape problem?
3. What exact evidence supports that claim?
4. What should core change next?

This spec is repo-specific. It assumes the existing `api-doctor explore` server, payload shape, and current family/endpoint/workflow evidence model.

## Product Goal

The Explorer is not a generic dashboard.

The Explorer is a decision-support tool for API redesign. It should show:

- why a developer gets stuck
- what evidence supports that claim
- what concrete contract or API shape changes would reduce that stuckness

The Explorer should stop optimizing for “show all analyzer richness on one screen” and start optimizing for “make the next contract decision obvious.”

## Primary Modes

The UI should use exactly three primary modes:

1. `Contract Problems`
   Focus:
   schema/runtime mismatch, undocumented rules, weak typing, missing descriptions/enums, ambiguous 400/401/403/404 behavior, create/update/read confusion, inconsistent status semantics.

2. `Workflow Problems`
   Focus:
   hidden prerequisites, context/token handoffs, sequence traps, state-machine learning by failure, brittle multi-call journeys, missing next-action guidance, implicit auth/header requirements.

3. `Response Shape Problems`
   Focus:
   storage-shaped payloads, duplicated state, incidental/internal fields, deep nesting, weak outcome framing, missing authoritative state, missing explicit next actions.

These modes replace category-like top-level filtering. The mode is the primary lens.

## Non-Goals

The Explorer should not try to be:

- a generic docs browser
- a full schema browser
- a runtime trace viewer
- a detached inspector workspace
- a multi-panel dashboard where every surface competes equally for attention

## Page Structure

Each mode should use the same skeleton.

### 1. Header

Keep:

- title
- spec/generated context
- `View payload`

Do not add summary widgets or KPI cards here.

### 2. Top Mode Bar

Keep the three existing top-level buttons, but rename their intent in copy where needed:

- `Contract Problems`
- `Workflow Problems`
- `Response Shape Problems`

These are the only primary lens selectors.

### 3. Scope Bar

Keep only controls that are easy to explain in one sentence.

Allowed controls:

- `Search endpoint`
- `Severity band`
- `Show all endpoints in matching families` or remove entirely if it remains too subtle

Rejected controls:

- `Category`
- any burden/focus filter that duplicates the top modes
- any filter whose effect is not visible immediately in the main table

Rename:

- `Family priority` -> `Severity band`

If severity remains derived from internal scoring, the UI must explain it inline in plain language.

### 4. Primary Surface

The main results table is the product.

There should be one dominant interaction model:

`Family row -> Endpoint row -> Evidence block`

Do not use a detached bottom inspector as the primary reading surface.

Expanded content must always appear directly below the row that opened it.

### 5. Optional Secondary Surface

Workflow chains may exist as a compact supporting surface, but they should never overpower the table.

If present, they should be:

- compact
- clearly subordinate to the results table
- expandable on demand

## Core Interaction Model

### Family Row

Each family row answers:

- what kind of problem this family represents
- why it matters to developers
- what broad fix direction core should take

Actions:

- `Expand endpoints`
- optional `Show summary`

### Endpoint Row

Each endpoint row answers:

- where the developer gets stuck
- what kind of problem it is
- how severe it is
- what the likely next fix is

Actions:

- `Show evidence`
- `Show workflow chain` only when a real inferred chain exists

### Evidence Block

The evidence block is inline under the endpoint row.

It should contain three sections in this order:

1. `Why this is hard`
2. `Exact evidence`
3. `What should change next`

Optional fourth section:

4. `Workflow chain`

Only show the fourth section when a real inferred chain exists.

## Row Schemas

### Family Table Columns

Use one stable shape across modes:

- `Family`
- `Severity mix`
- `Endpoints`
- `Lead signal`
- `Why this matters`
- `Recommended fix direction`
- `Actions`

Column intent:

- `Family`: family label only
- `Severity mix`: concise severity counts
- `Endpoints`: count and expand affordance
- `Lead signal`: one primary developer-facing problem label
- `Why this matters`: one-sentence developer impact
- `Recommended fix direction`: one-sentence product/design direction
- `Actions`: single expansion action, no duplicates

### Endpoint Table Columns

Use:

- `Method + path`
- `Lead issue`
- `Type`
- `Severity`
- `Evidence count`
- `Suggested action`
- `Actions`

Do not split actions across multiple columns.

## Content Model

## Replace Internal Labels

Internal analyzer labels should not be primary UI copy.

Examples to avoid as primary labels:

- workflow burden
- shape burden
- contract improvement emphasis
- recommended next click

Replace with developer-facing statements such as:

- `Developers must infer next valid actions from runtime failures.`
- `Response exposes storage graph instead of task outcome.`
- `Auth/context handoff is implicit and easy to lose.`
- `Schema cannot be trusted to validate this write before runtime.`

## Concrete Fix Guidance

Each endpoint evidence block should end with 1–3 explicit changes.

Examples:

- `Add explicit response descriptions for 400 and 401.`
- `Expose nextActions and authoritative contextToken in the response.`
- `Replace the default response with a task-shaped outcome summary.`
- `Split create, update, and read schemas.`
- `Declare enum values for request and response fields used by clients.`
- `Model 401, 403, and 404 deterministically in OpenAPI.`

Avoid generic advice such as:

- `tighten the schema`
- `clean up the contract`
- `improve burden`

## Evidence Types

The Explorer should consistently render three evidence types:

1. `Contract deviation`
   Examples:
   missing descriptions, missing enums, ambiguous auth semantics, undocumented required behavior, route/doc mismatch.

2. `Workflow trap`
   Examples:
   hidden prerequisite, state mutation not exposed, token/context handoff, brittle next step, auth/header spread.

3. `Response-shape friction`
   Examples:
   deep nesting, duplicated state, internal-field dominance, no authoritative outcome, no next-actions object.

## Workflow Presentation

Workflow chains are important, but the current presentation is too dense.

### Rule

Only show workflow chains when there is a real inferred chain.

### Placement

Show them inline under the endpoint evidence block, not as a competing always-open workspace.

### Default State

Collapsed by default.

### Summary Row

The collapsed summary should show:

- step count
- primary trap label
- one sentence on why this flow is brittle

### Expanded Workflow Step Schema

Each step should show:

- `Purpose`
- `Authoritative state created/changed`
- `Required carry-forward state`
- `Likely next action`
- `Hidden trap`

Do not render all annotations at the same emphasis level.

The hidden trap should be one concise statement with optional evidence bullets underneath.

## Response Shape Presentation

For response-shape problems, the UI must compare `current` vs `better`.

### Required Subsections

`What caller needed`

Examples:

- order created?
- orderId
- orderNumber
- payment status
- next action

`What caller got instead`

Examples:

- stateMachineState
- versionIds
- deliveries[]
- transactions[]
- addresses[]
- internal-looking IDs

This contrast should make the redesign direction obvious.

## Contract Problem Presentation

For contract-focused issues, the UI should emphasize:

- what a client cannot infer safely from the schema
- how runtime behavior appears to exceed contract guidance
- what exact OpenAPI/modeling change would reduce ambiguity

Examples:

- deterministic 401/403/404 semantics
- split schemas by operation intent
- enum modeling for caller-used fields
- explicit request/response descriptions
- action route and documentation alignment

## Controls and UI Patterns to Remove

Remove or avoid these patterns:

- detached bottom inspector as the primary reading surface
- repeated filter-summary text that only restates visible controls
- non-clickable chips that look clickable
- duplicate expand/collapse controls for the same content
- full columns dedicated to “next click”
- tooltip-only explanations for core concepts
- generic fix-direction copy that does not name a contract change
- tiny side panels and right-edge content that clip on narrower screens

## Controls and UI Patterns to Keep

Keep:

- one dominant expandable table
- inline evidence blocks
- compact chips only when they summarize, not when they try to explain
- one clear action per expandable layer
- explicit text labels instead of relying on hover

## Detection Priorities

The analyzer and UI should directly support these anti-patterns.

### Workflow Anti-Patterns

- context token changed mid-flow
- cart became invalid after context change
- missing `sw-access-key` discovered only at runtime
- structurally valid response but semantically weak next-step guidance
- token expiry creating state-drift recovery burden

### Response Shape Anti-Patterns

- deeply nested response hides outcome
- duplicated address/payment state across branches
- internal IDs and version fields dominate default payload
- state machine state exposed where domain-level status should exist
- no authoritative next-step object

### Contract Anti-Patterns

- 400/401/403/404 semantics are not deterministic enough
- schema missing descriptions or enums
- runtime behavior differs from what clients can infer from schema
- hidden prerequisites are not represented in contract form
- action routes and documentation do not align

## Copy Rules

All top-level and row-level copy should follow these rules:

- prefer developer-facing outcome language over analyzer terminology
- one clear sentence beats three abstract labels
- recommendations must name a contract or response change
- severity language must explain developer impact, not only count findings
- every visible label should be understandable without hovering

## Interaction Rules

These rules extend the existing repo UI rules in `AGENTS.md`.

- One expansion control per content block.
- Expansions open directly under the row that triggered them.
- Clicking the same trigger closes that same expansion.
- No auto-scroll except for explicit jump actions.
- No detached inspector for primary evidence reading.
- No duplicate highlights.
- Mode switches preserve understandable defaults and never leave dead controls behind.

## Mobile and Narrow Width Behavior

The narrow-width behavior should preserve reading order rather than preserve every column.

Rules:

- collapse secondary columns before primary meaning columns
- never hide the only action control
- never clip fix-direction or impact text without an accessible expansion path
- prefer stacked inline evidence blocks over side panels

## Repo Implementation Plan

### Phase 1: Structural Simplification

Scope:

- remove detached inspector as primary surface
- make family -> endpoint -> evidence the dominant interaction model
- remove repeated scope summaries and any dead controls
- normalize table schemas across the three modes

Likely files:

- `internal/explore/web/index.html`
- `internal/explore/web/render-family-table.ts`
- `internal/explore/web/render-family-surface.ts`
- `internal/explore/web/render-endpoint-rows.ts`
- `internal/explore/web/render-endpoint-diagnostics.ts`
- `internal/explore/web/app-shell-helpers.ts`

### Phase 2: Content Rewrite

Scope:

- replace burden-oriented/internal labels with developer-facing problem statements
- replace generic recommendation copy with concrete contract changes
- standardize evidence sections: why hard, exact evidence, what to change next

Likely files:

- `internal/explore/web/family-ranking-helpers.ts`
- `internal/explore/web/family-insight-model.ts`
- `internal/explore/web/diagnostics-composition.ts`
- `internal/explore/web/contract-improvement-helpers.ts`
- `internal/explore/web/explorer-ui-helpers.ts`

### Phase 3: Detection Strengthening

Scope:

- explicit hidden handoff detection
- authoritative-state detection
- next-action absence detection
- storage-shape/duplication/internal-field detection
- schema/runtime mismatch detection improvements

Likely code areas:

- `internal/workflow`
- `internal/report`
- `internal/explore` payload shaping
- relevant analyzer/rule packages

## Acceptance Criteria

The redesign is successful when:

- a first-time reader can tell the active mode in under 3 seconds
- a family row states one clear developer-facing problem
- an endpoint row states one clear lead issue and one suggested action
- the evidence block names exact supporting evidence and 1–3 concrete changes
- workflow chains are readable without overwhelming the main table
- no dead controls, duplicate controls, detached evidence reading, or clipped primary content remain

## Open Questions

- Should `Include endpoints without issues` be removed entirely, or renamed and moved closer to the endpoint table?
- Should consistency remain embedded inside `Contract Problems`, or gain a labeled secondary subsection in endpoint evidence only?
- Should workflow chains appear only after expanding an endpoint, or also as a compact family-level summary when strongly inferred?

## Recommended Next Step

Use this document as the source of truth for the next Explorer rewrite.

Implementation should begin with Phase 1 structural simplification before any new evidence widgets or analyzer detail is added.
