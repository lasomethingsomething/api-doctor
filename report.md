# api-doctor - Current Admin API Checkpoint

Spec: Shopware Admin API (`adminapi.json`)
Operations analyzed: 1036
Date: April 2026

---

## What the tool is optimized for now

The current product shape is not just generic schema linting.

For the validated Admin API scope, api-doctor is now positioned around four practical review questions:

- Where does the spec create workflow burden?
- Which responses create contract-shape burden?
- Where do related endpoints drift in naming or shape?
- What changed in ways that create breaking-change risk?

This remains deterministic, local-only, and spec-only.

---

## Current real-spec snapshot

Current `adminapi.json` runs show:

- Analyze: 2828 warnings in the current real-spec snapshot
- Workflow burden: `weak-follow-up-linkage` remains the dominant signal with 137 hits
- Contract-shape burden: 20 representative `contract-shape-workflow-guidance-burden` findings are surfaced in human-facing output
- Workflows: 277 inferred single-step workflows
- Multi-step chains: 139 inferred chains, with default output surfacing only the stronger representative chain families

This is the current practical reading of the spec:

- many common create/list-to-detail flows are inferable
- follow-up verification and next-step clarity remain the biggest workflow weakness
- some `200` responses still look more like large internal snapshots than compact task-level outcomes
- diff analysis continues to provide release-risk checks for breaking changes

---

## Endpoint score snapshot

Current markdown analyze output reports these endpoint score distributions:

| Dimension | Excellent (5) | Good (4) | Fair (3) | Poor (<=2) |
|---|---|---|---|---|
| Schema Completeness | 61 | 182 | 176 | 617 |
| Client Generation | 65 | 178 | 252 | 541 |
| Versioning Safety | 1035 | 1 | 0 | 0 |

Interpretation:

- endpoint scoring is now based on broader contract inspection than the earlier checkpoint state
- versioning safety remains strong in the current Admin API snapshot
- the main pain is not version markers, but how clearly request/response contracts support practical client and workflow use

---

## Workflow burden snapshot

Current workflow inference remains intentionally deterministic and conservative.

Single-step workflows:

- 137 Create To Detail
- 137 List To Detail
- 3 Action To Detail

Representative multi-step chains currently surfaced by default:

- Media Detail To Follow Up Action
- Order Detail To Action

What this means:

- the spec often contains enough structure to infer the next obvious call
- the main gap is still whether responses clearly expose the identifiers or outcome cues needed for reliable follow-up automation

---

## Contract-shape burden snapshot

The newer contract-shape/workflow-guidance slice is now part of the real-spec checkpoint.

In the current Admin API snapshot, it highlights 20 representative endpoints where a response appears too snapshot-heavy, too internal-state-oriented, or too weak on next-step guidance for a compact task contract.

Representative affected endpoints include:

- `POST /aggregate/customer`
- `POST /aggregate/order`
- `POST /customer`
- `POST /media`
- `POST /order`

Important presentation note:

- human-facing grouped summaries intentionally use qualitative family-breadth wording
- the representative endpoint slice is capped to keep output stable and reviewable
- JSON output still contains the concrete finding entries used for downstream inspection

---

## Consistency and change-risk snapshot

Consistency analysis is now part of the product framing and TUI/report summaries, even when it is not the dominant signal in a given real-spec run.

Current practical reading:

- consistency outliers are available for triage in analyze output and the TUI
- they matter most as workflow friction multipliers when route naming or response shape expectations drift across related endpoint families
- in this checkpoint, workflow burden and contract-shape burden are more prominent than consistency noise

Diff remains the explicit change-risk surface.

Validated proof point still used in this repo:

- `POST /_action/sync` removed `request[].filter` from the request-body schema

Why it matters:

- confirms the diff engine catches production-relevant breaking changes
- demonstrates useful detection for nested field removals, not only top-level path changes

---

## Explorer and TUI status

Explorer is the primary interactive surface.

The TUI is read-only and secondary, meant for fast terminal triage when browser use is not preferred.

Explorer default URL (after `api-doctor explore --spec ...`):

- http://127.0.0.1:7777/

Current focus areas:

- Overview: top-level counts plus deterministic `Fix first` lines for workflow burden, contract-shape burden, consistency outliers, and endpoint priorities
- Hotspots: ranked priority areas across issue categories, endpoint areas, and workflow patterns
- Endpoints: browsable endpoint rows with issue/quality/priority labels and inline endpoint workspaces for drill-down detail
- Issue categories: grouped findings with summaries, representative examples, and why-it-matters text
- Workflows: single-step and multi-step summaries with preview/detail flows
- Diff: available only when the TUI is launched with `--old` and `--new`

Explorer UI clarity goals (recent):

- each top-level tab has its own accent styling, used only for focus/CTA/scope cues
- family headers and empty/no-match cards are intentionally concise: one scope sentence + only real recovery actions
- Contract Issues no-match states explain what happened + provide concrete recovery actions
- header utility action "View payload" opens the raw analyzer payload backing the UI

---

## Current constraints

- validated scope remains Shopware Admin API-first; Store API support is not claimed
- analysis is still spec-only and local-only
- local component-schema `$ref` expansion is now part of scoring and rule checks, but broader OpenAPI support should still be treated as validated only within this repo's tested scope
- multi-step workflow inference remains intentionally conservative
