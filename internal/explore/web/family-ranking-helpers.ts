declare var state: ExplorerState;

declare function humanizeSignalLabel(signal: string): string;
declare function familyPressureLabel(priorityCounts: StringMap<number>): string;
declare function issueDimensionForFinding(code: string, category: string, burdenFocus: string): string;
declare function escapeHtml(value: unknown): string;

function familyBurdenWhyText(family: ExplorerFamilySummary): string {
  var burden = state.activeTopTab === "workflow"
    ? "workflow-burden"
    : state.activeTopTab === "shape"
    ? "contract-shape"
    : "all";
  var topSignals = topFamilyBurdenSignals(family, burden, 2);
  if (burden === "workflow-burden") {
    var workflowDominant = topSignals[0] || "";
    var workflowSecondary = topSignals[1] ? (" Also: " + humanizeSignalLabel(topSignals[1]) + ".") : "";
    var workflowSentences: StringMap<string> = {
      "hidden token/context handoff appears likely": "Hidden token/context requirements across call chain.",
      "next step not clearly exposed": "Next-step requirements or identifiers not clearly exposed.",
      "sequencing appears brittle": "Call sequence depends on tracking implicit prior state.",
      "auth/header burden spread across steps": "Auth/header context spread unevenly across steps."
    };
    var workflowLead = workflowSentences[workflowDominant] || "Potential workflow sequencing or follow-up linkage issues.";
    return workflowLead + workflowSecondary;
  }
  if (burden === "contract-shape") {
    var shapeDominant = topSignals[0] || "";
    var shapeSecondary = topSignals[1] ? (" Also: " + humanizeSignalLabel(topSignals[1]) + ".") : "";
    var shapeSentences: StringMap<string> = {
      "response appears snapshot-heavy": "Snapshot-heavy response makes callers read backend graph detail before they can see the real task outcome.",
      "deep nesting appears likely": "Deep nesting buries the outcome, authoritative state, and handoff fields under incidental structure.",
      "duplicated state appears likely": "Duplicated state forces callers to guess which field is authoritative.",
      "incidental/internal fields appear to dominate": "Incidental/internal fields crowd the payload and invite coupling to storage concerns.",
      "source-of-truth fields are unclear": "Multiple state representations make the authoritative source-of-truth unclear.",
      "outcome framing is easy to miss": "Missing outcome framing makes callers infer what changed from raw payload structure.",
      "next action is weakly exposed": "Missing next-action cues make the follow-up call sequence hard to discover from the response."
    };
    var shapeLead = shapeSentences[shapeDominant] || "Response schema appears storage-shaped rather than task-oriented.";
    return shapeLead + shapeSecondary;
  }
  if (burden === "consistency") {
    var consistencyDominant = topSignals[0] || "";
    var consistencySecondary = topSignals[1] ? (" Also: " + humanizeSignalLabel(topSignals[1]) + ".") : "";
    var consistencySentences: StringMap<string> = {
      "parameter naming drift appears likely": "Similar routes use different parameter names for the same idea.",
      "path style drift appears likely": "Similar routes use different path patterns for similar actions.",
      "outcome modeled differently across similar endpoints": "Similar actions describe the result differently.",
      "response shape drift appears likely": "Similar endpoints return different response shapes."
    };
    var consistencyLead = consistencySentences[consistencyDominant] || "Similar operations drift in names, paths, or response shape.";
    return consistencyLead + consistencySecondary;
  }
  var allDimensions = (family.topDimensions || []).slice(0, 2);
  if (allDimensions.length) {
    return "Shows " + allDimensions.join(" and ") + ".";
  }
  return "Family across " + family.endpoints + " endpoint" + (family.endpoints === 1 ? "" : "s") + ".";
}

function sumSignalCounts(map: StringMap<number>): number {
  return Object.keys(map || {}).reduce(function (sum: number, key: string) {
    return sum + ((map && map[key]) || 0);
  }, 0);
}

function pickFamilyDominantDriver(family: ExplorerFamilySummary): { key: string; label: string; signalKey: string; score: number } {
  var workflowScore = sumSignalCounts(family.workflowSignalCounts || {});
  var shapeScore = sumSignalCounts(family.shapeSignalCounts || {});
  var contractScore = sumSignalCounts(family.consistencySignalCounts || {});

  Object.keys(family.burdenCounts || {}).forEach(function (key: string) {
    if (key !== "workflow-burden" && key !== "contract-shape") {
      contractScore += (family.burdenCounts && family.burdenCounts[key]) || 0;
    }
  });

  var contractishScore = contractScore + shapeScore;
  var top = Math.max(workflowScore, contractishScore);
  var second = Math.min(workflowScore, contractishScore);
  var mixed = top > 0 && second > 0 && (second / top) >= 0.6;
  var contractSignalKey = (shapeScore >= contractScore && shapeScore > 0) ? "shape" : "contract";

  if (mixed) {
    return { key: "mixed", label: "Mixed driver", signalKey: (workflowScore >= contractishScore ? "workflow" : contractSignalKey), score: top };
  }
  if (workflowScore >= contractishScore) {
    return { key: "workflow", label: "Mostly workflow driven", signalKey: "workflow", score: workflowScore };
  }
  return { key: "contract", label: "Mostly contract driven", signalKey: contractSignalKey, score: contractishScore };
}

function familyDominantSignalsForDriver(family: ExplorerFamilySummary, driverKey: string): string[] {
  if (driverKey === "workflow") {
    return sortedSignalLabels(family.workflowSignalCounts || {}, 2);
  }
  if (driverKey === "shape") {
    return sortedSignalLabels(family.shapeSignalCounts || {}, 2);
  }
  var contractSignals = sortedSignalLabels(family.consistencySignalCounts || {}, 2);
  if (contractSignals.length) return contractSignals;
  return (family.topDimensions || []).slice(0, 2);
}

function familyDxSignalFragment(signal: string): string {
  var map: StringMap<string> = {
    "hidden token/context handoff appears likely": "developers must infer required handoff IDs/context between calls",
    "next step not clearly exposed": "developers cannot tell the next valid call from the response",
    "sequencing appears brittle": "developers need undocumented ordering knowledge to proceed safely",
    "auth/header burden spread across steps": "developers chase scattered auth/header requirements across steps",
    "response appears snapshot-heavy": "developers sift large snapshots to find the actual outcome",
    "deep nesting appears likely": "developers hunt through nested objects to find outcome and handoff fields",
    "duplicated state appears likely": "developers reconcile conflicting state fields across the payload",
    "incidental/internal fields appear to dominate": "developers risk coupling to storage/internal fields",
    "source-of-truth fields are unclear": "developers cannot tell which field is authoritative",
    "outcome framing is easy to miss": "developers miss the outcome because it is not framed as a result",
    "next action is weakly exposed": "developers cannot reliably discover the next action from the response",
    "parameter naming drift appears likely": "developers special-case parameter names across sibling routes",
    "path style drift appears likely": "developers cannot compose sibling routes predictably",
    "response shape drift appears likely": "developers add per-endpoint parsing branches for sibling endpoints",
    "outcome modeled differently across similar endpoints": "developers cannot reuse the same success/failure handling across siblings"
  };
  return map[signal] || humanizeSignalLabel(signal).toLowerCase();
}

function toSentenceCase(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function familyRecommendedAction(driverKey: string, dominantSignals: string[]): string {
  var signals = dominantSignals || [];
  var signal0 = (signals[0] || "").toLowerCase();
  var signal1 = (signals[1] || "").toLowerCase();
  var blob = (signal0 + " | " + signal1).trim();

  if (driverKey === "workflow") {
    if (/handoff/.test(blob) && /next step|next action/.test(blob)) return "Return the handoff ID and next valid call together";
    if (/sequencing|brittle|prerequisite/.test(blob) && /next step|next action/.test(blob)) return "Expose prerequisites and name the next valid call";
    if (/auth\/header|auth|header/.test(blob) && /handoff/.test(blob)) return "Make auth inputs and carry-forward context explicit";
    if (/auth\/header|auth|header/.test(blob)) return "Make auth and required headers explicit";
    if (/sequencing|brittle|prerequisite/.test(blob)) return "Expose prerequisites and required ordering cues";
    if (/next step|next action/.test(blob)) return "Expose the next valid call in the response";
    if (/token|context handoff|handoff context|implicit|handoff/.test(blob)) return "Return the handoff ID or context needed for the next call";
    if (/description/.test(blob)) return "Add endpoint descriptions for purpose and continuation rules";
    if (/enum|typing|weak typing/.test(blob)) return "Declare missing enums and required workflow fields";
    return "Make the next step and required handoff state explicit";
  }

  if (driverKey === "shape") {
    if (/description/.test(blob)) return "Add missing response descriptions";
    if (/enum|typing|weak typing/.test(blob)) return "Declare missing enums";
    if (/snapshot-heavy|storage-shaped|outcome|next action/.test(blob)) return "Expose nextAction and required context";
    if (/deep nesting/.test(blob)) return "Move outcome and handoff IDs to top-level fields";
    if (/duplicated state/.test(blob)) return "Remove duplicated state; keep one canonical field";
    if (/internal fields|incidental/.test(blob)) return "Move internal fields out of default payloads";
    return "Expose nextAction and required context";
  }

  if (/description/.test(blob)) return "Add missing response descriptions";
  if (/enum|typing|weak typing/.test(blob)) return "Declare missing enums";
  if (/parameter naming/.test(blob)) return "Normalize parameter naming across sibling endpoints";
  if (/path style|path patterns/.test(blob)) return "Align path templates across sibling routes";
  if (/response shape drift|response shapes drift/.test(blob)) return "Align response schemas across sibling endpoints";
  return "Normalize contract patterns across sibling endpoints";
}

function familyWorkflowWhyThisMatters(dominantSignals: string[]): string {
  var signals = dominantSignals || [];
  var signal0 = (signals[0] || "").toLowerCase();
  var signal1 = (signals[1] || "").toLowerCase();
  var blob = (signal0 + " | " + signal1).trim();

  if (/handoff/.test(blob) && /next step|next action/.test(blob)) {
    return "Developers must guess which ID or context to carry forward and what call comes next.";
  }
  if (/sequencing|brittle|prerequisite/.test(blob) && /next step|next action/.test(blob)) {
    return "Developers learn ordering and follow-up calls from runtime behavior instead of the contract.";
  }
  if (/auth\/header|auth|header/.test(blob) && /handoff/.test(blob)) {
    return "Developers must discover auth requirements and carry-forward context across steps.";
  }
  if (/handoff context|token\/context|handoff/.test(blob)) {
    return "Developers must infer required handoff IDs or context between calls.";
  }
  if (/auth\/header|auth|header/.test(blob)) {
    return "Developers must discover auth and required headers step by step.";
  }
  if (/sequencing|brittle|prerequisite/.test(blob)) {
    return "Developers learn the safe call order from runtime behavior, not the contract.";
  }
  if (/next step|next action/.test(blob)) {
    return "Developers cannot tell the next valid call from the response.";
  }
  return "Developers cannot chain these calls safely from the contract alone.";
}

function familyPrimaryRisk(driverKey: string, dominantSignals: string[]): string {
  var signals = dominantSignals || [];
  var signal0 = (signals[0] || "").toLowerCase();
  var signal1 = (signals[1] || "").toLowerCase();
  var blob = (signal0 + " | " + signal1).trim();

  if (driverKey === "workflow") {
    if (/handoff context|token\/context/.test(blob)) return "Missing explicit handoff IDs/context between calls";
    if (/auth\/header|auth|header/.test(blob)) return "Scattered auth/context requirements across steps";
    if (/sequencing|brittle/.test(blob)) return "Implicit prerequisites and ordering (brittle sequencing)";
    if (/next step|next action|implicit/.test(blob)) return "Missing next-step contract (follow-up is not visible)";
    return "Workflow continuity breaks across calls (handoffs and next steps are implicit)";
  }

  if (driverKey === "shape") {
    if (/deep nesting/.test(blob)) return "Outcome and handoff fields are buried by nesting";
    if (/duplicated state/.test(blob)) return "Duplicated/conflicting state fields blur authority";
    if (/internal fields|incidental/.test(blob)) return "Incidental/internal fields are exposed as primary contract surface";
    if (/snapshot-heavy|storage-shaped/.test(blob)) return "Snapshot-heavy payload obscures the task outcome";
    if (/enum|weak typing|typing/.test(blob)) return "Weak typing and missing enums increase integration ambiguity";
    return "Response shape hides outcome and next-step cues";
  }

  if (/parameter naming/.test(blob)) return "Parameter naming drift across sibling routes";
  if (/path style|path patterns/.test(blob)) return "Path template drift across sibling routes";
  if (/response shape drift|response shapes drift/.test(blob)) return "Response shape drift across sibling endpoints";
  return "Inconsistent contract patterns across sibling endpoints";
}

function familyDriverFocus(driverKey: string, dominantSignals: string[]): string {
  var signals = (dominantSignals || []).map(function (signal: string) { return (signal || "").toLowerCase(); });
  var blob = signals.join(" | ");
  if (driverKey === "workflow") {
    if (/handoff/.test(blob)) return "Focus: handoff context + IDs";
    if (/next step|next action/.test(blob)) return "Focus: next step visibility";
    if (/sequencing|brittle/.test(blob)) return "Focus: prerequisites + ordering";
    return "Focus: continuity signals";
  }
  if (driverKey === "shape") {
    if (/deep nesting/.test(blob)) return "Focus: deep nesting";
    if (/snapshot-heavy/.test(blob)) return "Focus: snapshot-heavy responses";
    if (/duplicated state/.test(blob)) return "Focus: duplicated state";
    if (/internal/.test(blob)) return "Focus: internal fields";
    return "Focus: response shape";
  }
  if (/parameter naming/.test(blob)) return "Focus: parameter consistency";
  if (/path style/.test(blob)) return "Focus: route shape consistency";
  if (/response shape drift/.test(blob)) return "Focus: response consistency";
  return "Focus: sibling consistency";
}

function sortedSignalLabels(map: StringMap<number>, limit?: number): string[] {
  return Object.keys(map || {})
    .map(function (label: string) { return { label: label, count: (map && map[label]) || 0 }; })
    .sort(function (a: { label: string; count: number }, b: { label: string; count: number }) {
      if (a.count !== b.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit || 3)
    .map(function (entry: { label: string; count: number }) { return entry.label; });
}

function topFamilyBurdenSignals(family: ExplorerFamilySummary, burden: string, limit?: number): string[] {
  if (!family) return [];
  if (burden === "workflow-burden") return sortedSignalLabels(family.workflowSignalCounts || {}, limit || 3);
  if (burden === "contract-shape") return sortedSignalLabels(family.shapeSignalCounts || {}, limit || 3);
  if (burden === "consistency") return sortedSignalLabels(family.consistencySignalCounts || {}, limit || 3);
  return [];
}

function collectShapeSignalTotals(summaries: ExplorerFamilySummary[]): {
  deep: number;
  internal: number;
  dup: number;
  snapshot: number;
  source: number;
  outcome: number;
  nextAction: number;
  summary: string;
} {
  var totals = {
    deep: 0,
    internal: 0,
    dup: 0,
    snapshot: 0,
    source: 0,
    outcome: 0,
    nextAction: 0
  };

  (summaries || []).forEach(function (family: ExplorerFamilySummary) {
    var map = family.shapeSignalCounts || {};
    totals.snapshot += map["response appears snapshot-heavy"] || 0;
    totals.deep += map["deep nesting appears likely"] || 0;
    totals.dup += map["duplicated state appears likely"] || 0;
    totals.internal += map["incidental/internal fields appear to dominate"] || 0;
    totals.source += map["source-of-truth fields are unclear"] || 0;
    totals.outcome += map["outcome framing is easy to miss"] || 0;
    totals.nextAction += map["next action is weakly exposed"] || 0;
  });

  var highlights: string[] = [];
  if (totals.snapshot > 0) highlights.push("snapshot-heavy");
  if (totals.deep > 0) highlights.push("deep nesting");
  if (totals.dup > 0) highlights.push("duplicated state");
  if (totals.internal > 0) highlights.push("internal fields");
  if (totals.source > 0) highlights.push("unclear source-of-truth");
  if (totals.outcome > 0) highlights.push("missing outcome framing");
  if (totals.nextAction > 0) highlights.push("missing next-action cues");

  return {
    deep: totals.deep,
    internal: totals.internal,
    dup: totals.dup,
    snapshot: totals.snapshot,
    source: totals.source,
    outcome: totals.outcome,
    nextAction: totals.nextAction,
    summary: highlights.length
      ? ("highest recurring shape signals: " + highlights.join(", "))
      : "no dominant shape signal extracted from current families"
  };
}

function familyPressureByFamily(rows: ExplorerEndpointRow[]): StringMap<string> {
  var byFamily: StringMap<StringMap<number>> = {};
  rows.forEach(function (row: ExplorerEndpointRow) {
    var key = row.family || "unlabeled family";
    if (!byFamily[key]) byFamily[key] = { high: 0, medium: 0, low: 0 };
    byFamily[key][row.priority || "low"] = (byFamily[key][row.priority || "low"] || 0) + 1;
  });

  var output: StringMap<string> = {};
  Object.keys(byFamily).forEach(function (key: string) {
    output[key] = familyPressureLabel(byFamily[key]);
  });
  return output;
}

function bumpCounter(map: StringMap<number>, key: string): void {
  map[key] = (map[key] || 0) + 1;
}

function collectDynamicBurdenSignals(rows: ExplorerEndpointRow[], burdenLens: string): Array<{ label: string; count: number }> {
  var counts: StringMap<number> = {};
  var endpointDetails = (state.payload && state.payload.endpointDetails) ? state.payload.endpointDetails : {};

  rows.forEach(function (row: ExplorerEndpointRow) {
    var detail = endpointDetails[row.id];
    if (!detail || !detail.findings) return;

    detail.findings.forEach(function (finding: ExplorerFinding) {
      var code = finding.code || "";
      var msg = (finding.message || "").toLowerCase();
      var dim = issueDimensionForFinding(finding.code || "", finding.category || "", finding.burdenFocus || "");

      if (burdenLens === "workflow-burden") {
        if (code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || code === "weak-outcome-next-action-guidance" || code === "prerequisite-task-burden") {
          bumpCounter(counts, "hidden context/token handoff");
        }
        if (code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || code === "weak-outcome-next-action-guidance" || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed|workflow guidance/.test(msg)) {
          bumpCounter(counts, "next required step is not clearly exposed");
        }
        if (code === "prerequisite-task-burden" || /prior state|earlier|prerequisite|lookup/.test(msg)) {
          bumpCounter(counts, "workflow sequence feels brittle");
        }
        if (/auth|authorization|header|token|context|access\s*key|api[-\s]?key/.test(msg)) {
          bumpCounter(counts, "auth/header/context requirements spread across calls");
        }
      }

      if (burdenLens === "contract-shape") {
        if (code === "deeply-nested-response-structure" || dim === "shape / nesting complexity" || /nested|deep/.test(msg)) {
          bumpCounter(counts, "deep nesting shows up often in this view");
        }
        if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || /snapshot|storage|model structure/.test(msg)) {
          bumpCounter(counts, "snapshot-style state shows up often");
        }
        if (code === "duplicated-state-response" || /duplicate|duplicated/.test(msg)) {
          bumpCounter(counts, "similar state appears repeated across response branches");
        }
        if (code === "incidental-internal-field-exposure" || dim === "internal/incidental fields" || /internal|incidental|audit|raw id/.test(msg)) {
          bumpCounter(counts, "incidental/internal fields show up often");
        }
        if (code === "duplicated-state-response" || /source of truth|authoritative|single state|multiple state|duplicate state/.test(msg)) {
          bumpCounter(counts, "source-of-truth fields are unclear");
        }
        if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || code === "weak-outcome-next-action-guidance" || /outcome|what changed|result meaning/.test(msg)) {
          bumpCounter(counts, "outcome framing is easy to miss");
        }
        if (code === "weak-outcome-next-action-guidance" || code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) {
          bumpCounter(counts, "next action is weakly exposed");
        }
        if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || dim === "workflow outcome weakness" || /outcome|next action/.test(msg)) {
          bumpCounter(counts, "task outcome / next action is easy to miss");
        }
      }

      if (burdenLens === "consistency") {
        if (code === "detail-path-parameter-name-drift") {
          bumpCounter(counts, "parameter names differ");
        }
        if (code === "endpoint-path-style-drift" || code === "sibling-path-shape-drift") {
          bumpCounter(counts, "path patterns differ");
        }
        if (code === "inconsistent-response-shape" || code === "inconsistent-response-shape-family" || code === "inconsistent-response-shapes" || code === "inconsistent-response-shapes-family") {
          bumpCounter(counts, "response shapes differ");
          bumpCounter(counts, "outcome wording differs");
        }
      }
    });
  });

  return Object.keys(counts)
    .map(function (label: string) { return { label: label, count: counts[label] }; })
    .sort(function (a: { label: string; count: number }, b: { label: string; count: number }) {
      if (a.count !== b.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 4);
}

function renderDynamicBurdenSignals(rows: ExplorerEndpointRow[], burdenLens: string): string {
  var signals = collectDynamicBurdenSignals(rows, burdenLens);
  if (!signals.length) return "";

  var heading = burdenLens === "consistency"
    ? "Most common differences in this view:"
    : "Most common in this slice:";
  var parts = signals.slice(0, 4).map(function (signal: { label: string; count: number }) {
    var label = burdenLens === "consistency" ? humanizeSignalLabel(signal.label) : signal.label;
    return label + " (" + signal.count + ")";
  }).filter(Boolean);

  return '<div class="burden-dynamic-signals">'
    + '<p class="burden-dynamic-signals-line"><strong>' + escapeHtml(heading) + "</strong> "
    + escapeHtml(parts.join(", "))
    + ".</p></div>";
}
