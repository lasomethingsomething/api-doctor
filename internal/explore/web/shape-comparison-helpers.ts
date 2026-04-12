declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function escapeHtml(value: unknown): string;

interface InspectorContractComparisonPoints {
  themes: string[];
  current: string[];
  improved: string[];
}

function hasWorkflowShapedExampleSignals(findings: ExplorerFinding[]): boolean {
  return (findings || []).some(function (finding: ExplorerFinding) {
    var code = finding.code || "";
    if (code === "contract-shape-workflow-guidance-burden"
      || code === "snapshot-heavy-response"
      || code === "duplicated-state-response"
      || code === "incidental-internal-field-exposure"
      || code === "deeply-nested-response-structure"
      || code === "prerequisite-task-burden"
      || code === "weak-follow-up-linkage"
      || code === "weak-action-follow-up-linkage"
      || code === "weak-accepted-tracking-linkage"
      || code === "generic-object-response"
      || code === "weak-array-items-schema") {
      return true;
    }
    var msg = (finding.message || "").toLowerCase();
    return /follow[-\s]?up|next[-\s]?step|tracking|identifier|token|context|header|nested|snapshot|internal|source of truth|authoritative|outcome|what changed/.test(msg);
  });
}

function collectInspectorContractComparisonPoints(
  endpoint: ExplorerEndpointRow,
  findings: ExplorerFinding[]
): InspectorContractComparisonPoints {
  var current: string[] = [];
  var improved: string[] = [];
  var themes: string[] = [];

  function pushUnique(list: string[], text: string): void {
    if (list.indexOf(text) === -1) list.push(text);
  }

  function addTheme(theme: string, currentText: string, improvedText: string): void {
    if (themes.indexOf(theme) === -1) themes.push(theme);
    pushUnique(current, currentText);
    pushUnique(improved, improvedText);
  }

  (findings || []).forEach(function (finding: ExplorerFinding) {
    var code = finding.code || "";
    var msg = (finding.message || "").toLowerCase();

    if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || /snapshot|storage|model structure|full model/.test(msg)) {
      addTheme("storage-shaped vs task-shaped", "Storage-shaped payload dominates the response surface.", "Return a task-shaped response: lead with outcome, authoritative state, and handoff fields.");
      addTheme("graph dump vs explicit outcome", "Graph-style payload forces readers to infer what changed.", "Add an explicit outcome block: state what changed and whether the step is complete.");
    }
    if (code === "incidental-internal-field-exposure" || /internal|incidental|audit|raw id/.test(msg)) {
      addTheme("internal state vs domain-level state", "Internal/storage fields dominate over domain-level state.", "Move internal/storage fields out of the default payload; keep domain-level state primary.");
    }
    if (code === "duplicated-state-response" || /duplicate|duplicated|source of truth|authoritative/.test(msg)) {
      addTheme("duplicated state vs single source of truth", "Duplicated state appears across branches with unclear source-of-truth.", "Expose one authoritative state field as the single source of truth.");
    }
    if (code === "weak-outcome-next-action-guidance" || code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) {
      addTheme("missing next action vs explicit next action", "Next action is missing or weakly modeled in the response.", "Include nextAction plus the required id/link for the next call.");
    }
    if (code === "prerequisite-task-burden" || /prerequisite|prior state|hidden dependency|handoff|implicit/.test(msg)) {
      addTheme("hidden dependency vs surfaced prerequisite / handoff", "Prerequisite/handoff dependency is implicit and easy to miss.", "Return prerequisite state and handoff fields explicitly in the response.");
    }
  });

  var path = ((endpoint && endpoint.path) || "").toLowerCase();
  if (/order|cart|checkout|payment/.test(path)) {
    pushUnique(improved, "Return domain-level outcome status (order/cart/payment state), not a backend object dump.");
  }

  if (!themes.length) {
    addTheme(
      "storage-shaped vs task-shaped",
      "Current shape requires readers to infer intent from broad payload structure.",
      "Return outcome, authoritative state, and nextAction explicitly."
    );
  }

  return {
    themes: themes,
    current: current.slice(0, 4),
    improved: improved.slice(0, 4)
  };
}

function renderInspectorContractShapeComparison(
  detail: ExplorerEndpointDetail,
  findingsOverride: ExplorerFinding[],
  options?: { title?: string; context?: string }
): string {
  var opts = options || {};
  var endpoint = (detail && detail.endpoint) || createEmptyEndpointRow();
  var findings = findingsOverride || findingsForActiveLens((detail && detail.findings) || []);
  var points = collectInspectorContractComparisonPoints(endpoint, findings);
  var title = opts.title || "Current response shape vs better workflow-first response shape";
  var themeLine = points.themes.length ? points.themes.join(" | ") : "storage-shaped vs task-shaped";

  return '<section class="inspector-contract-compare">'
    + "<h3>" + escapeHtml(title) + "</h3>"
    + '<p class="inspector-contract-compare-note"><strong>Themes:</strong> ' + escapeHtml(themeLine) + "</p>"
    + '<div class="inspector-contract-compare-grid">'
    + '  <div class="inspector-contract-compare-col">'
    + "    <h4>Current response shape</h4>"
    + "    <ul>" + points.current.map(function (item: string) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>"
    + "  </div>"
    + '  <div class="inspector-contract-compare-col">'
    + "    <h4>Better workflow-first response shape</h4>"
    + "    <ul>" + points.improved.map(function (item: string) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>"
    + "  </div>"
    + "</div>"
    + "</section>";
}

function collectWorkflowShapedExamplePoints(
  endpoint: ExplorerEndpointRow,
  findings: ExplorerFinding[]
): FamilyInsightPoints {
  var current: string[] = [];
  var cleaner: string[] = [];
  var evidence: string[] = [];

  function pushUnique(list: string[], text: string): void {
    if (list.indexOf(text) === -1) list.push(text);
  }

  (findings || []).forEach(function (finding: ExplorerFinding) {
    var code = finding.code || "";
    if (evidence.indexOf(code) === -1) evidence.push(code);

    if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response") {
      pushUnique(current, "Storage/model structure dominates the response.");
      pushUnique(cleaner, "Return task outcome and authoritative state first.");
    }
    if (code === "deeply-nested-response-structure") {
      pushUnique(current, "Deep nesting hides outcome meaning.");
      pushUnique(cleaner, "Move outcome and nextAction near the top of the response.");
    }
    if (code === "duplicated-state-response") {
      pushUnique(current, "Repeated state adds scan noise and obscures source-of-truth.");
      pushUnique(cleaner, "Expose one authoritative state field; remove repeated snapshots.");
    }
    if (code === "incidental-internal-field-exposure") {
      pushUnique(current, "Incidental internal fields crowd outcome visibility.");
      pushUnique(cleaner, "Move internal linkage/audit fields out of the default success payload.");
    }
    if (code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage") {
      pushUnique(current, "Next step is weakly signaled.");
      pushUnique(cleaner, "Include nextAction and the handoff ID/link needed for the next call.");
    }
    if (code === "weak-outcome-next-action-guidance") {
      pushUnique(current, "Outcome and next action framing is weak.");
      pushUnique(cleaner, "Return explicit outcome and nextAction fields in the response.");
    }
    if (code === "prerequisite-task-burden") {
      pushUnique(current, "Hidden prerequisites are doing too much work.");
      pushUnique(cleaner, "Return prerequisite state/IDs explicitly so the step can be formed deterministically.");
    }
    if (code === "generic-object-response" || code === "weak-array-items-schema") {
      pushUnique(current, "Generic shape weakens handoff meaning.");
      pushUnique(cleaner, "Replace generic objects with named properties and typed array item schemas.");
    }
  });

  var path = ((endpoint && endpoint.path) || "").toLowerCase();
  if (/login|auth|session|register/.test(path)) {
    pushUnique(cleaner, "Return one authoritative auth/context token field for follow-up calls.");
  }
  if (/customer/.test(path)) {
    pushUnique(cleaner, "Return reusable customer identifiers/links needed for follow-up calls.");
  }
  if (/cart/.test(path)) {
    pushUnique(cleaner, "Return cart outcome plus minimal handoff fields (IDs/links) in the response.");
  }
  if (/order/.test(path)) {
    pushUnique(cleaner, "Return order outcome plus nextAction(s) in the response.");
  }
  if (/payment|checkout/.test(path)) {
    pushUnique(cleaner, "Return payment outcome meaning plus the authoritative transaction state.");
  }

  return {
    current: current.slice(0, 2),
    cleaner: cleaner.slice(0, 3),
    evidence: evidence.slice(0, 4)
  };
}

function renderWorkflowShapedExample(
  detail: ExplorerEndpointDetail,
  findingsOverride?: ExplorerFinding[]
): string {
  var findings = findingsOverride || findingsForActiveLens(detail.findings || []);
  if (!hasWorkflowShapedExampleSignals(findings)) return "";

  var points = collectWorkflowShapedExamplePoints(detail.endpoint || createEmptyEndpointRow(), findings);
  if (!points.current.length && !points.cleaner.length) return "";

  var currentHtml = points.current.length
    ? ("<ul>" + points.current.map(function (item: string) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>")
    : '<p class="subtle">Current storage-shaped emphasis appears mixed; handoff meaning is not consistently clear.</p>';
  var cleanerHtml = points.cleaner.length
    ? ("<ul>" + points.cleaner.map(function (item: string) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>")
    : '<p class="subtle">Return outcome-first payloads with authoritative context and explicit nextAction.</p>';

  var evidenceHint = points.evidence.length
    ? ('<p class="workflow-example-evidence"><strong>Signals:</strong> ' + escapeHtml(points.evidence.join(", ")) + "</p>")
    : "";

  return '<section class="workflow-example-block">'
    + "<h3>Current storage-shaped vs improved task-shaped response (illustrative)</h3>"
    + '<p class="workflow-example-note">Illustrative only — not a generated replacement or runtime guarantee.</p>'
    + '<div class="workflow-example-grid">'
    + '  <div class="workflow-example-col">'
    + "    <h4>Current storage-shaped response</h4>"
    + currentHtml
    + "  </div>"
    + '  <div class="workflow-example-col">'
    + "    <h4>Improved task-shaped response</h4>"
    + cleanerHtml
    + "  </div>"
    + "</div>"
    + evidenceHint
    + "</section>";
}

function collectShapeSignalTotalsForDetail(detail: ExplorerEndpointDetail): ShapeSignalTotals {
  var findings = findingsForActiveLens((detail && detail.findings) || []);
  var totals: ShapeSignalTotals = {
    deep: 0,
    internal: 0,
    dup: 0,
    snapshot: 0,
    source: 0,
    outcome: 0,
    nextAction: 0
  };

  findings.forEach(function (finding: ExplorerFinding) {
    var code = finding.code || "";
    var msg = (finding.message || "").toLowerCase();
    if (code === "deeply-nested-response-structure" || /nested|deep/.test(msg)) totals.deep += 1;
    if (code === "incidental-internal-field-exposure" || /internal|incidental|audit|raw id/.test(msg)) totals.internal += 1;
    if (code === "duplicated-state-response" || /duplicate|duplicated/.test(msg)) totals.dup += 1;
    if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || /snapshot|storage|model structure/.test(msg)) totals.snapshot += 1;
    if (code === "duplicated-state-response" || /source of truth|authoritative|single state|multiple state|duplicate state/.test(msg)) totals.source += 1;
    if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || code === "weak-outcome-next-action-guidance" || /outcome|what changed|result meaning/.test(msg)) totals.outcome += 1;
    if (code === "weak-outcome-next-action-guidance" || code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) totals.nextAction += 1;
  });

  return totals;
}
