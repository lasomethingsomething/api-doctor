declare var state: ExplorerState;

declare function scopedRows(rows: ExplorerEndpointRow[]): ExplorerEndpointRow[];
declare function lensFindingCountForRow(row: ExplorerEndpointRow | null | undefined): number;
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function issueDimensionForFinding(code: string, category: string, burdenFocus: string): string;
declare function bumpFamilySignal(map: StringMap<number>, label: string): void;
declare function familyPressureLabel(priorityCounts: StringMap<number>): string;
declare function priorityRank(priority: string): number;
declare function sumSignalCounts(map: StringMap<number>): number;
declare function renderRecoveryActions(actions: string[]): string;
declare function escapeHtml(value: unknown): string;

function familySummaryBuildSurfaceContext(summaries: ExplorerFamilySummary[]): string {
  var visibleFamilies = summaries.length;
  var allFamiliesInLens = familySummaryRawList();
  var totalInLens = allFamiliesInLens.length;

  var specTotal = new Set((state.payload.endpoints || []).map(function (r: ExplorerEndpointRow) {
    return r.family || "unlabeled family";
  })).size;

  var familiesInPressureTier = state.filters.familyPressure === "all"
    ? totalInLens
    : allFamiliesInLens.filter(function (family: ExplorerFamilySummary) { return family.pressure === state.filters.familyPressure; }).length;

  var showingTruncated = visibleFamilies < familiesInPressureTier;

  var hasNarrowing = !!(state.filters.search
    || state.filters.category !== "all"
    || state.filters.familyPressure !== "all"
    || state.filters.includeNoIssueRows
    || state.familyTableBackState);

  var summaryLine = "";
  if (!totalInLens) {
    summaryLine = "No families match the current scope.";
  } else if (showingTruncated) {
    summaryLine = "Showing " + visibleFamilies + " of " + familiesInPressureTier + " matching families (" + specTotal + " total in spec).";
  } else {
    summaryLine = "Showing " + visibleFamilies + " matching famil" + (visibleFamilies === 1 ? "y" : "ies") + " (" + specTotal + " total in spec).";
  }

  if (state.activeTopTab === "shape") {
    if (!totalInLens) {
      summaryLine = "No families with response-shape findings match the current filtered view.";
    } else if (showingTruncated) {
      summaryLine = "Showing " + visibleFamilies + " families with response-shape findings in the current filtered view ("
        + familiesInPressureTier + " matching families in scope; " + specTotal + " families in spec total).";
    } else {
      summaryLine = "Showing " + visibleFamilies + " families with response-shape findings in the current filtered view ("
        + specTotal + " families in spec total).";
    }
  }

  var actionButtons: string[] = [];
  if (showingTruncated && !state.familyTableShowAll) {
    actionButtons.push('<button type="button" class="secondary-action" data-recovery-action="show-all-families">Show all families in current scope</button>');
  }
  if (hasNarrowing) {
    actionButtons.push('<button type="button" class="secondary-action" data-recovery-action="clear-table-filters">Clear table filters</button>');
  }
  var actionsHtml = actionButtons.length
    ? ('<div class="context-actions">' + actionButtons.join("") + "</div>")
    : "";

  var copy = '<div class="context-block family-context-block">';
  if (state.activeTopTab === "shape") {
    var scopeLine = "Scope: Ranks families by response-shape burden and highlights top shape signals for endpoints matching the current filters.";
    var resultsLine = "Results: " + summaryLine;
    copy += '<p class="context-summary context-summary-shape">' + escapeHtml(scopeLine) + "</p>";
    copy += '<p class="context-summary context-summary-shape">' + escapeHtml(resultsLine) + "</p>";
  } else {
    copy += '<p class="context-summary">' + escapeHtml(summaryLine) + "</p>";
  }
  copy += actionsHtml;
  copy += "</div>";
  return copy;
}

function familySummaryRawList(): ExplorerFamilySummary[] {
  var counts: StringMap<number> = {};
  function lensCount(row: ExplorerEndpointRow): number {
    if (!row || !row.id) return 0;
    if (counts[row.id] !== undefined) return counts[row.id];
    counts[row.id] = lensFindingCountForRow(row);
    return counts[row.id];
  }

  var lensLocked = state.filters.category !== "all" || state.activeTopTab === "workflow" || state.activeTopTab === "shape";
  var rows = scopedRows(state.payload.endpoints || []);
  if (lensLocked) {
    rows = rows.filter(function (row: ExplorerEndpointRow) { return lensCount(row) > 0; });
  }
  var byFamily: StringMap<ExplorerFamilySummary> = {};
  var endpointDetails = state.payload.endpointDetails || {};

  rows.forEach(function (row: ExplorerEndpointRow) {
    var inScopeFindings = lensCount(row);
    var hasEvidence = inScopeFindings > 0;
    if (!hasEvidence && !state.filters.includeNoIssueRows) return;

    var key = row.family || "unlabeled family";
    if (!byFamily[key]) {
      byFamily[key] = {
        family: key,
        pressure: "",
        findings: 0,
        endpoints: 0,
        workflowChainKeys: {},
        workflowChainCount: 0,
        priorityCounts: { high: 0, medium: 0, low: 0 },
        burdenCounts: {},
        dimensionCounts: {},
        workflowSignalCounts: {},
        shapeSignalCounts: {},
        consistencySignalCounts: {}
      };
    }

    var item = byFamily[key];
    item.findings = (item.findings || 0) + inScopeFindings;
    item.endpoints = (item.endpoints || 0) + 1;
    var priorityCounts = item.priorityCounts || {};
    priorityCounts[row.priority || "low"] = (priorityCounts[row.priority || "low"] || 0) + 1;
    item.priorityCounts = priorityCounts;

    var burdenWeight = hasEvidence ? inScopeFindings : 1;
    (row.burdenFocuses || []).forEach(function (focus: string) {
      var burdenCounts = item.burdenCounts || {};
      burdenCounts[focus] = (burdenCounts[focus] || 0) + burdenWeight;
      item.burdenCounts = burdenCounts;
    });

    var detail = endpointDetails[row.id];
    if (detail && detail.relatedChains && detail.relatedChains.length) {
      detail.relatedChains.forEach(function (chain: ExplorerWorkflowChain) {
        var ids = (chain && chain.endpointIds) ? chain.endpointIds : [];
        if (!ids.length) return;
        var kind = (chain && chain.kind) ? String(chain.kind) : "workflow";
        var chainKey = kind + "|" + ids.join(",");
        (item.workflowChainKeys || {})[chainKey] = true;
      });
      item.workflowChainCount = Object.keys(item.workflowChainKeys || {}).length;
    }

    if (detail && detail.findings) {
      var lensFindings = findingsForActiveLens(detail.findings || []);
      lensFindings.forEach(function (finding: ExplorerFinding) {
        var dimension = issueDimensionForFinding(finding.code || "", finding.category || "", finding.burdenFocus || "");
        var dimensionCounts = item.dimensionCounts || {};
        dimensionCounts[dimension] = (dimensionCounts[dimension] || 0) + 1;
        item.dimensionCounts = dimensionCounts;

        var code = finding.code || "";
        var msg = (finding.message || "").toLowerCase();
        if (finding.evidenceType === "spec-rule") return;

        if (code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || code === "weak-outcome-next-action-guidance" || code === "prerequisite-task-burden") {
          bumpFamilySignal(item.workflowSignalCounts || {}, "hidden token/context handoff appears likely");
        }
        if (code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || code === "weak-outcome-next-action-guidance" || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed|workflow guidance/.test(msg)) {
          bumpFamilySignal(item.workflowSignalCounts || {}, "next step not clearly exposed");
        }
        if (code === "prerequisite-task-burden" || /prior state|earlier|sequence|brittle/.test(msg)) {
          bumpFamilySignal(item.workflowSignalCounts || {}, "sequencing appears brittle");
        }
        if (/auth|authorization|header|token|context|access\s*key|api[-\s]?key/.test(msg)) {
          bumpFamilySignal(item.workflowSignalCounts || {}, "auth/header burden spread across steps");
        }

        if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || /snapshot|storage|model structure/.test(msg)) {
          bumpFamilySignal(item.shapeSignalCounts || {}, "response appears snapshot-heavy");
        }
        if (code === "deeply-nested-response-structure" || dimension === "shape / nesting complexity" || /nested|deep/.test(msg)) {
          bumpFamilySignal(item.shapeSignalCounts || {}, "deep nesting appears likely");
        }
        if (code === "duplicated-state-response" || /duplicate|duplicated/.test(msg)) {
          bumpFamilySignal(item.shapeSignalCounts || {}, "duplicated state appears likely");
        }
        if (code === "incidental-internal-field-exposure" || dimension === "internal/incidental fields" || /internal|incidental|audit|raw id/.test(msg)) {
          bumpFamilySignal(item.shapeSignalCounts || {}, "incidental/internal fields appear to dominate");
        }
        if (code === "duplicated-state-response" || /source of truth|authoritative|single state|multiple state|duplicate state/.test(msg)) {
          bumpFamilySignal(item.shapeSignalCounts || {}, "source-of-truth fields are unclear");
        }
        if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || code === "weak-outcome-next-action-guidance" || /outcome|what changed|result meaning/.test(msg)) {
          bumpFamilySignal(item.shapeSignalCounts || {}, "outcome framing is easy to miss");
        }
        if (code === "weak-outcome-next-action-guidance" || code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) {
          bumpFamilySignal(item.shapeSignalCounts || {}, "next action is weakly exposed");
        }

        if (code === "detail-path-parameter-name-drift") {
          bumpFamilySignal(item.consistencySignalCounts || {}, "parameter naming drift appears likely");
        }
        if (code === "endpoint-path-style-drift" || code === "sibling-path-shape-drift") {
          bumpFamilySignal(item.consistencySignalCounts || {}, "path style drift appears likely");
        }
        if (code === "inconsistent-response-shape" || code === "inconsistent-response-shape-family" || code === "inconsistent-response-shapes" || code === "inconsistent-response-shapes-family") {
          bumpFamilySignal(item.consistencySignalCounts || {}, "outcome modeled differently across similar endpoints");
          bumpFamilySignal(item.consistencySignalCounts || {}, "response shape drift appears likely");
        }
      });
    }
  });

  return Object.values(byFamily).map(function (family: ExplorerFamilySummary) {
    var dominantBurden = Object.entries(family.burdenCounts || {}).sort(function (a, b) { return b[1] - a[1]; });
    var dimensions = Object.entries(family.dimensionCounts || {}).sort(function (a, b) { return b[1] - a[1]; });
    family.pressure = familyPressureLabel(family.priorityCounts || {});
    family.dominantBurden = dominantBurden.length ? dominantBurden[0][0].replaceAll("-", " ") : "mixed";
    family.topDimensions = dimensions.slice(0, 3).map(function (entry) { return entry[0]; });
    return family;
  }).sort(function (a: ExplorerFamilySummary, b: ExplorerFamilySummary) {
    if (state.activeTopTab === "workflow") {
      var aScore = sumSignalCounts(a.workflowSignalCounts || {});
      var bScore = sumSignalCounts(b.workflowSignalCounts || {});
      if (aScore !== bScore) return bScore - aScore;
      if ((a.workflowChainCount || 0) !== (b.workflowChainCount || 0)) return (b.workflowChainCount || 0) - (a.workflowChainCount || 0);
      if ((a.findings || 0) !== (b.findings || 0)) return (b.findings || 0) - (a.findings || 0);
      if (priorityRank(a.pressure || "") !== priorityRank(b.pressure || "")) return priorityRank(a.pressure || "") - priorityRank(b.pressure || "");
      return (a.family || "").localeCompare(b.family || "");
    }

    if (priorityRank(a.pressure || "") !== priorityRank(b.pressure || "")) return priorityRank(a.pressure || "") - priorityRank(b.pressure || "");
    if ((a.findings || 0) !== (b.findings || 0)) return (b.findings || 0) - (a.findings || 0);
    return (a.family || "").localeCompare(b.family || "");
  });
}

function familySummaryList(): ExplorerFamilySummary[] {
  var families = familySummaryRawList().filter(function (family: ExplorerFamilySummary) {
    return state.filters.familyPressure === "all" || family.pressure === state.filters.familyPressure;
  });
  return state.familyTableShowAll ? families : families.slice(0, 24);
}
