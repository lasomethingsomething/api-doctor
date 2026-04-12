declare var state: ExplorerState;
declare var el: ExplorerElements;

declare function escapeHtml(value: unknown): string;
declare function filteredRows(): ExplorerEndpointRow[];
declare function rowsInScopeAll(): ExplorerEndpointRow[];
declare function renderRecoveryActions(actions: string[]): string;
declare function bindRecoveryButtons(container: HTMLElement | null): void;
declare function renderCommonWorkflowJourneys(chains: ExplorerWorkflowChain[] | null | undefined): string;
declare function renderWorkflowStep(
  endpointId: string,
  stepIndex: number,
  totalSteps: number,
  roleLabel: string,
  nextEndpointId: string,
  nextRoleLabel: string
): string;
declare function buildWorkflowDependencyClues(
  endpoint: ExplorerEndpointRow,
  findings: ExplorerFinding[],
  stepIndex: number,
  totalSteps: number,
  roleLabel: string,
  nextEndpoint: ExplorerEndpointRow | null,
  nextRoleLabel: string,
  linkageFindings: ExplorerFinding[],
  prerequisiteFindings: ExplorerFinding[]
): WorkflowDependencyClues;
declare function captureFamilyTableBackStateIfNeeded(state: ExplorerState): void;
declare function selectEndpointForInspector(endpointId: string, subTab?: string): void;
declare function renderEndpointRows(): void;
declare function renderEndpointDiagnostics(): void;
declare function renderEndpointDetail(): void;
declare function payloadEndpointDetails(): StringMap<ExplorerEndpointDetail>;

var workflowSurfaceKindGroupLabelMap: StringMap<string> = {
  "list-detail": "Browse then inspect",
  "list-detail-update": "Browse, inspect, and update",
  "list-detail-action": "Browse, inspect, and act",
  "list-detail-create": "Browse, inspect, and create",
  "create-detail": "Create then inspect",
  "create-detail-update": "Create then refine",
  "create-detail-action": "Create then act",
  "action-follow-up": "Act and follow up",
  "media-detail-follow-up": "Upload then follow up",
  "order-detail-action": "Submit then confirm"
};

function workflowSurfaceRenderChains(): void {
  if (state.activeTopTab !== "workflow") {
    el.workflowSection.style.display = "none";
    el.workflowHelp.textContent = "";
    el.workflowChains.innerHTML = "";
    return;
  }

  var allChains = state.payload.workflows.chains || [];
  if (!allChains.length) {
    el.workflowSection.style.display = "block";
    el.workflowHelp.textContent = "Optional workflow-path guidance for this slice. Open only when developers are getting stuck between calls.";
    el.workflowChains.innerHTML = workflowSurfaceRenderChainsDrawer(workflowSurfaceRenderEmptyState("absent"), 0);
    workflowSurfaceBindChainsDrawerToggle();
    return;
  }

  var visibleRows = filteredRows();
  var visibleByID: StringMap<boolean> = {};
  visibleRows.forEach(function (row: ExplorerEndpointRow) {
    visibleByID[row.id] = true;
  });
  var filteredChains = allChains.filter(function (chain: ExplorerWorkflowChain) {
    return (chain.endpointIds || []).some(function (eid: string) {
      return !!visibleByID[eid];
    });
  });

  var scopedByID: StringMap<boolean> = {};
  rowsInScopeAll().forEach(function (row: ExplorerEndpointRow) {
    scopedByID[row.id] = true;
  });
  var scopedChains = allChains.filter(function (chain: ExplorerWorkflowChain) {
    return (chain.endpointIds || []).some(function (eid: string) {
      return !!scopedByID[eid];
    });
  });

  el.workflowSection.style.display = "block";

  var chainSource = filteredChains.length ? filteredChains : scopedChains;
  var workflowGuideHtml = workflowSurfaceRenderGuideSection(chainSource);
  var journeyGuidanceHtml = renderCommonWorkflowJourneys(chainSource);
  var supportingContextHtml = workflowSurfaceRenderSupportingContext(workflowGuideHtml, journeyGuidanceHtml);

  if (filteredChains.length) {
    el.workflowHelp.textContent = "Optional workflow-path guidance for the current slice. Open this when you need hidden prerequisites, carry-forward state, or the likely next call.";
    var groups = workflowSurfaceGroupChainsByKind(filteredChains, { focusChainId: state.workflowChainFocusChainId || "" });
    el.workflowChains.innerHTML = workflowSurfaceRenderChainsDrawer(
      '<section class="workflow-chain-surface-primary">'
        + '<div class="workflow-chain-surface-header">'
        + '<h3 class="workflow-guide-title">Workflow steps and hidden traps</h3>'
        + '<p class="workflow-guide-copy">Use this only when the sequence itself is the problem. Click a step to scope the family table above to the matching API surface.</p>'
        + '</div>'
        + groups.map(workflowSurfaceRenderKindGroup).join("")
      + "</section>"
      + supportingContextHtml,
      filteredChains.length
    );
    workflowSurfaceBindStepInteractions();
    workflowSurfaceSyncStepSelectionHighlight();
    workflowSurfaceBindChainsDrawerToggle();
    return;
  }

  if (scopedChains.length) {
    el.workflowHelp.textContent = "No workflow path lines up with the current evidence-only table view, but related call sequences are still available if you need sequence context.";
    var scopedGroups = workflowSurfaceGroupChainsByKind(scopedChains, { focusChainId: state.workflowChainFocusChainId || "" });
    el.workflowChains.innerHTML = workflowSurfaceRenderChainsDrawer(
      '<section class="workflow-chain-surface-primary">'
        + '<div class="workflow-chain-surface-header">'
        + '<h3 class="workflow-guide-title">Workflow steps and hidden traps</h3>'
        + '<p class="workflow-guide-copy">These paths stay available from the scoped endpoint set so you can still inspect sequence and weak handoffs when needed.</p>'
        + '</div>'
        + '<div class="workflow-no-match">'
        + '<p class="workflow-empty-title"><strong>Related workflow paths are still available</strong></p>'
        + '<p class="workflow-empty-copy">The current table view is narrower than the available chain evidence, so this section keeps the related sequence visible from the endpoints still in view.</p>'
        + renderRecoveryActions(["show-all-workflows"])
        + "</div>"
        + scopedGroups.map(workflowSurfaceRenderKindGroup).join("")
      + "</section>"
      + supportingContextHtml,
      scopedChains.length
    );
    bindRecoveryButtons(el.workflowChains);
    workflowSurfaceBindStepInteractions();
    workflowSurfaceSyncStepSelectionHighlight();
    workflowSurfaceBindChainsDrawerToggle();
    return;
  }

  el.workflowHelp.textContent = "";
  el.workflowChains.innerHTML = workflowSurfaceRenderChainsDrawer(
    supportingContextHtml + workflowSurfaceRenderEmptyState("filtered"),
    0
  );
  bindRecoveryButtons(el.workflowChains);
  workflowSurfaceBindChainsDrawerToggle();
}

function workflowSurfaceRenderChainsDrawer(innerHtml: string, chainCount: number): string {
  var count = (typeof chainCount === "number" && isFinite(chainCount)) ? chainCount : 0;
  var countLabel = count
    ? (count + " chain" + (count === 1 ? "" : "s") + " in view")
    : "no chains in view";
  var openAttr = state.workflowChainsOpen ? " open" : "";

  return '<details class="workflow-chains-drawer"' + openAttr + ' data-workflow-chains-drawer="1">'
    + '<summary class="workflow-chains-drawer-summary">'
    + "<strong>Workflow paths</strong>"
    + '<span class="workflow-chains-drawer-meta">' + escapeHtml(countLabel) + "</span>"
    + "</summary>"
    + '<div class="workflow-chains-drawer-body">'
    + innerHtml
    + "</div>"
    + "</details>";
}

function workflowSurfaceBindChainsDrawerToggle(): void {
  var drawer = el.workflowChains ? el.workflowChains.querySelector("[data-workflow-chains-drawer]") as HTMLDetailsElement | null : null;
  if (!drawer) return;
  drawer.addEventListener("toggle", function () {
    state.workflowChainsOpen = !!drawer.open;
  });
}

function workflowSurfaceRenderSupportingContext(workflowGuideHtml: string, journeyGuidanceHtml: string): string {
  var contentHtml = (workflowGuideHtml || "") + (journeyGuidanceHtml || "");
  if (!contentHtml) return "";

  return '<details class="workflow-supporting-drawer">'
    + '<summary class="workflow-supporting-summary">'
    + "<strong>Supporting workflow notes</strong>"
    + '<span class="workflow-supporting-copy">Compact path summaries and redesign guidance</span>'
    + "</summary>"
    + '<div class="workflow-supporting-body">'
    + contentHtml
    + "</div>"
    + "</details>";
}

function workflowSurfaceRenderGuideSection(chains: ExplorerWorkflowChain[]): string {
  var sourceChains = (chains || []).slice();
  if (!sourceChains.length) return "";

  var featured = sourceChains.slice().sort(function (a: ExplorerWorkflowChain, b: ExplorerWorkflowChain) {
    var burdenDiff = workflowSurfaceChainBurdenScore(b) - workflowSurfaceChainBurdenScore(a);
    if (burdenDiff !== 0) return burdenDiff;
    return (b.endpointIds || []).length - (a.endpointIds || []).length;
  }).slice(0, 3);

  if (!featured.length) return "";

  return '<section class="workflow-guide-section">'
    + '<div class="workflow-guide-header">'
    + '<h3 class="workflow-guide-title">Path summaries</h3>'
    + '<p class="workflow-guide-copy">Compact reads on the heaviest workflow paths. Use these as supporting context, not the main investigation surface.</p>'
    + "</div>"
    + '<div class="workflow-guide-cards">'
    + featured.map(function (chain: ExplorerWorkflowChain, index: number) {
      return workflowSurfaceRenderGuideCard(chain, index === 0);
    }).join("")
    + "</div>"
    + "</section>";
}

function workflowSurfaceRenderGuideCard(chain: ExplorerWorkflowChain, isLead: boolean): string {
  var roles = workflowSurfaceParseChainRoles(chain.summary, (chain.endpointIds || []).length);
  var burdenSummary = workflowSurfaceRenderBurdenSummary(chain, roles);
  var leadClass = isLead ? " workflow-guide-card-lead" : "";
  var reasonHtml = chain.reason
    ? '<p class="workflow-guide-reason"><strong>Why developers get stuck here:</strong> ' + escapeHtml(chain.reason) + "</p>"
    : "";

  return '<article class="workflow-guide-card' + leadClass + '">'
    + '<div class="workflow-guide-card-head">'
    + '<p class="workflow-guide-card-kicker">' + escapeHtml(workflowSurfaceKindGroupLabel(chain.kind || "workflow")) + "</p>"
    + '<div class="workflow-guide-card-meta">'
    + "<strong>" + escapeHtml(workflowSurfaceChainTaskLabel(chain)) + "</strong>"
    + "<span>" + escapeHtml((chain.endpointIds || []).length + " steps") + "</span>"
    + "<span>" + escapeHtml(workflowSurfaceChainBurdenScore(chain) + " workflow signals") + "</span>"
    + "</div>"
    + "</div>"
    + reasonHtml
    + burdenSummary
    + '<div class="workflow-guide-chain">'
    + workflowSurfaceRenderChain(chain, true)
    + "</div>"
    + "</article>";
}

function workflowSurfaceBindStepInteractions(): void {
  var endpointDetails = payloadEndpointDetails();
  Array.prototype.forEach.call(el.workflowChains.querySelectorAll("[data-step-id]"), function (elem: HTMLElement) {
    elem.addEventListener("click", function () {
      var endpointId = elem.getAttribute("data-step-id") || "";
      if (!endpointId) return;
      var detail = endpointDetails[endpointId];
      var family = detail && detail.endpoint ? (detail.endpoint.family || "") : "";
      state.selectedEndpointId = endpointId;
      state.userSelectedEndpoint = true;
      state.endpointDiagnosticsSubTab = "summary";
      if (family) {
        captureFamilyTableBackStateIfNeeded(state);
        state.filters.search = family.trim().toLowerCase();
        state.familyTableShowAll = false;
        state.expandedFamilyInsight = "";
        state.detailEvidenceOpenForId = "";
        state.inspectPlacementHint = "nested";
        selectEndpointForInspector(endpointId, "summary");
        workflowSurfaceSyncStepSelectionHighlight();
        return;
      }
      renderEndpointRows();
      renderEndpointDiagnostics();
      renderEndpointDetail();
      workflowSurfaceSyncStepSelectionHighlight();
    });
  });

  Array.prototype.forEach.call(el.workflowChains.querySelectorAll("[data-step-open-evidence]"), function (btn: HTMLButtonElement) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var endpointId = btn.getAttribute("data-step-open-evidence") || "";
      if (!endpointId) return;
      var detail = endpointDetails[endpointId];
      var family = detail && detail.endpoint ? (detail.endpoint.family || "") : "";
      state.selectedEndpointId = endpointId;
      state.userSelectedEndpoint = true;
      state.endpointDiagnosticsSubTab = "exact";
      state.detailEvidenceOpenForId = endpointId;
      if (family) {
        captureFamilyTableBackStateIfNeeded(state);
        state.filters.search = family.trim().toLowerCase();
        state.familyTableShowAll = false;
        state.expandedFamilyInsight = "";
        state.inspectPlacementHint = "nested";
        selectEndpointForInspector(endpointId, "exact");
        state.detailEvidenceOpenForId = endpointId;
        workflowSurfaceSyncStepSelectionHighlight();
        return;
      }
      renderEndpointRows();
      renderEndpointDiagnostics();
      renderEndpointDetail();
      workflowSurfaceSyncStepSelectionHighlight();
    });
  });
}

function workflowSurfaceSyncStepSelectionHighlight(): void {
  Array.prototype.forEach.call(el.workflowChains.querySelectorAll(".step-box"), function (box: HTMLElement) {
    box.classList.remove("step-active");
  });
  if (!state.selectedEndpointId) return;
  Array.prototype.forEach.call(el.workflowChains.querySelectorAll("[data-step-id]"), function (elem: HTMLElement) {
    if ((elem.getAttribute("data-step-id") || "") !== state.selectedEndpointId) return;
    var box = elem.querySelector<HTMLElement>(".step-box");
    if (box) box.classList.add("step-active");
  });
}

function workflowSurfaceRenderEmptyState(mode: string): string {
  if (mode === "absent") {
    return '<div class="workflow-no-match workflow-no-match-final">'
      + '<p class="workflow-empty-title"><strong>No workflow paths detected</strong></p>'
      + '<p class="workflow-empty-copy">This spec currently reads as isolated endpoints rather than a linked call sequence, so there is nothing to expand in this section.</p>'
      + '<p class="workflow-empty-note">That is a final state for this spec, not a filter mismatch.</p>'
      + "</div>";
  }

  if (!filteredRows().length) {
    return '<div class="workflow-no-match">'
      + '<p class="workflow-empty-title"><strong>No workflow paths match the current table view</strong></p>'
      + '<p class="workflow-empty-copy">Reset the table view or show all workflow paths to widen this section.</p>'
      + renderRecoveryActions(["show-all-workflows"])
      + "</div>";
  }

  return '<div class="workflow-no-match">'
    + '<p class="workflow-empty-title"><strong>No workflow paths match the current table view</strong></p>'
    + '<p class="workflow-empty-copy">Show all workflow paths to widen this section without changing tabs.</p>'
    + renderRecoveryActions(["show-all-workflows"])
    + "</div>";
}

function workflowSurfaceGroupChainsByKind(
  chains: ExplorerWorkflowChain[],
  options?: { focusChainId?: string }
): WorkflowKindGroup[] {
  var opts = options || {};
  var focusChainId = opts.focusChainId || "";
  var byKind: StringMap<ExplorerWorkflowChain[]> = {};
  chains.forEach(function (chain: ExplorerWorkflowChain) {
    var kind = chain.kind || "workflow";
    if (!byKind[kind]) byKind[kind] = [];
    byKind[kind].push(chain);
  });

  return Object.keys(byKind).map(function (kind) {
    var kindChains = byKind[kind].slice();
    kindChains.sort(function (a: ExplorerWorkflowChain, b: ExplorerWorkflowChain) {
      return workflowSurfaceChainBurdenScore(b) - workflowSurfaceChainBurdenScore(a);
    });
    if (focusChainId) {
      var idx = kindChains.findIndex(function (c: ExplorerWorkflowChain) { return (c && c.id) === focusChainId; });
      if (idx > 0) {
        var picked = kindChains.splice(idx, 1)[0];
        kindChains.unshift(picked);
      }
    }
    return { kind: kind, chains: kindChains };
  }).sort(function (a: WorkflowKindGroup, b: WorkflowKindGroup) {
    if (focusChainId) {
      var aHas = a.chains.some(function (c: ExplorerWorkflowChain) { return (c && c.id) === focusChainId; });
      var bHas = b.chains.some(function (c: ExplorerWorkflowChain) { return (c && c.id) === focusChainId; });
      if (aHas && !bHas) return -1;
      if (bHas && !aHas) return 1;
    }
    var aScore = a.chains.reduce(function (s: number, c: ExplorerWorkflowChain) { return s + workflowSurfaceChainBurdenScore(c); }, 0);
    var bScore = b.chains.reduce(function (s: number, c: ExplorerWorkflowChain) { return s + workflowSurfaceChainBurdenScore(c); }, 0);
    return bScore - aScore;
  });
}

function workflowSurfaceChainBurdenScore(chain: ExplorerWorkflowChain): number {
  var endpointDetails = payloadEndpointDetails();
  return (chain.endpointIds || []).reduce(function (total: number, eid: string) {
    var d = endpointDetails[eid];
    if (!d) return total;
    return total + (d.findings || []).filter(function (f: ExplorerFinding) {
      return f.burdenFocus === "workflow-burden";
    }).length;
  }, 0);
}

function workflowSurfaceParseChainRoles(summary: string | undefined, count?: number): string[] {
  if (!summary) return [];
  var parts = summary.split(" -> ");
  return parts.map(function (part) {
    var i = part.indexOf(": ");
    return i >= 0 ? part.substring(0, i) : "";
  });
}

function workflowSurfaceHumanizeStepRole(roleSlug: string): string {
  var map: StringMap<string> = {
    "list": "browse list",
    "search": "search / filter",
    "detail": "load item",
    "create": "create",
    "update": "update",
    "delete": "delete",
    "action": "trigger action",
    "checkout": "checkout",
    "payment": "handle payment",
    "auth": "authenticate",
    "login": "authenticate",
    "register": "register",
    "submit": "submit",
    "confirm": "confirm",
    "follow-up": "follow up",
    "followup": "follow up",
    "cancel": "cancel",
    "upload": "upload",
    "download": "download",
    "refresh": "refresh",
    "poll": "poll status"
  };
  if (!roleSlug) return "";
  var slug = roleSlug.toLowerCase();
  return map[slug] || slug.replace(/-/g, " ");
}

function workflowSurfaceKindGroupLabel(kind: string): string {
  return workflowSurfaceKindGroupLabelMap[kind] || kind.replace(/-/g, " to ");
}

function workflowSurfaceChainTaskLabel(chain: ExplorerWorkflowChain): string {
  var roles = workflowSurfaceParseChainRoles(chain.summary);
  if (roles.length >= 2) {
    var first = workflowSurfaceHumanizeStepRole(roles[0]);
    var last = workflowSurfaceHumanizeStepRole(roles[roles.length - 1]);
    if (first && last && first !== last) {
      return first + " to " + last;
    }
  }
  return workflowSurfaceChainResourceLabel(chain);
}

function workflowSurfaceChainResourceLabel(chain: ExplorerWorkflowChain): string {
  var ids = chain.endpointIds || [];
  var detail = ids.length ? payloadEndpointDetails()[ids[0]] : null;
  if (!detail) return chain.kind || "workflow";
  var segs = detail.endpoint.path.split("/").filter(function (p) { return p && !p.startsWith("{"); });
  return segs.length ? segs[segs.length - 1] : detail.endpoint.path;
}

function workflowSurfaceFormatStepRefs(indices: number[]): string {
  if (!indices || !indices.length) return "";
  var sorted = indices.slice().sort(function (a, b) { return a - b; });
  var labels = sorted.map(function (n) { return String(n + 1); });
  return "shows up in step" + (labels.length > 1 ? "s " : " ") + labels.join(", ");
}

function workflowSurfaceCollectBurdenSummary(chain: ExplorerWorkflowChain, roles: string[]): WorkflowBurdenSummaryItem[] {
  var steps = chain.endpointIds || [];
  var endpointDetails = payloadEndpointDetails();
  var burdens: StringMap<WorkflowBurdenSummaryItem> = {
    hidden: { key: "hidden", label: "hidden handoff", why: "the next call is not told clearly what state or ID to carry forward", steps: [] },
    outcome: { key: "outcome", label: "next step is unclear", why: "the response does not make the result and next move obvious", steps: [] },
    sequence: { key: "sequence", label: "sequencing is brittle", why: "later calls appear to depend on undocumented prior state", steps: [] },
    auth: { key: "auth", label: "auth or context is spread across steps", why: "headers, tokens, or context requirements are learned step by step", steps: [] }
  };

  steps.forEach(function (endpointId: string, idx: number) {
    var detail = endpointDetails[endpointId];
    if (!detail) return;
    var endpoint = detail.endpoint || createEmptyEndpointRow();
    var findings = detail.findings || [];
    var nextEndpointId = idx < (steps.length - 1) ? steps[idx + 1] : "";
    var nextDetail = nextEndpointId ? endpointDetails[nextEndpointId] : null;
    var nextEndpoint = nextDetail ? nextDetail.endpoint : null;
    var role = roles[idx] || "";
    var nextRole = roles[idx + 1] || "";
    var linkageFindings = findings.filter(function (f: ExplorerFinding) {
      return f.code === "weak-follow-up-linkage" || f.code === "weak-action-follow-up-linkage" || f.code === "weak-accepted-tracking-linkage" || f.code === "weak-outcome-next-action-guidance";
    });
    var prerequisiteFindings = findings.filter(function (f: ExplorerFinding) {
      return f.code === "prerequisite-task-burden";
    });
    var clues = buildWorkflowDependencyClues(endpoint, findings, idx, steps.length, role, nextEndpoint, nextRole, linkageFindings, prerequisiteFindings);
    var joined = (clues.prereq || []).concat(clues.establish || [], clues.nextNeeds || [], clues.hidden || []).join(" | ").toLowerCase();

    if ((clues.hidden || []).length || prerequisiteFindings.length) {
      if (burdens.hidden.steps.indexOf(idx) === -1) burdens.hidden.steps.push(idx);
    }
    if (findings.some(function (f: ExplorerFinding) {
      return f.code === "weak-follow-up-linkage" || f.code === "weak-action-follow-up-linkage" || f.code === "weak-accepted-tracking-linkage" || f.code === "weak-outcome-next-action-guidance";
    })) {
      if (burdens.outcome.steps.indexOf(idx) === -1) burdens.outcome.steps.push(idx);
    }
    if ((clues.hidden || []).length || (clues.prereq || []).some(function (c: string) { return /prior state|earlier step|mutation|lookup/i.test(c); })) {
      if (burdens.sequence.steps.indexOf(idx) === -1) burdens.sequence.steps.push(idx);
    }
    if (/(auth|header|token|context|access\s*key|api[-\s]?key)/i.test(joined)) {
      if (burdens.auth.steps.indexOf(idx) === -1) burdens.auth.steps.push(idx);
    }
  });

  var priorityOrder = ["hidden", "outcome", "auth", "sequence"];
  return Object.keys(burdens)
    .map(function (k) { return burdens[k]; })
    .filter(function (b: WorkflowBurdenSummaryItem) { return b.steps.length > 0; })
    .sort(function (a: WorkflowBurdenSummaryItem, b: WorkflowBurdenSummaryItem) {
      if (b.steps.length !== a.steps.length) return b.steps.length - a.steps.length;
      return priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key);
    });
}

function workflowSurfaceRenderBurdenSummary(chain: ExplorerWorkflowChain, roles: string[]): string {
  var items = workflowSurfaceCollectBurdenSummary(chain, roles);
  if (!items.length) return "";
  var html = items.map(function (item: WorkflowBurdenSummaryItem, idx: number) {
    var priorityCls = idx === 0 ? " workflow-burden-primary" : " workflow-burden-secondary";
    return '<span class="workflow-burden-item workflow-burden-' + item.key + priorityCls + '">'
      + "<strong>" + escapeHtml(item.label) + "</strong>"
      + "<em>" + escapeHtml(workflowSurfaceFormatStepRefs(item.steps)) + "</em>"
      + "<span>" + escapeHtml(item.why) + "</span>"
      + "</span>";
  }).join("");
  return '<div class="workflow-burden-summary">' + html + "</div>";
}

function workflowSurfaceRenderKindGroup(group: WorkflowKindGroup): string {
  var kindLabel = workflowSurfaceKindGroupLabel(group.kind);
  var count = group.chains.length;
  var countBadge = count > 1 ? '<span class="kind-chain-count">' + count + " chains</span>" : "";

  var primaryHtml = workflowSurfaceRenderChain(group.chains[0], true);
  var secondaryHtml = group.chains.slice(1).map(function (chain: ExplorerWorkflowChain) {
    return workflowSurfaceRenderChain(chain, false);
  }).join("");

  return '<div class="workflow-kind-group">'
    + '<div class="workflow-kind-header">'
    + "<strong>" + escapeHtml(kindLabel) + "</strong>"
    + countBadge
    + "</div>"
    + primaryHtml
    + secondaryHtml
    + "</div>";
}

function workflowSurfaceRenderChain(chain: ExplorerWorkflowChain, isPrimary: boolean): string {
  var steps = chain.endpointIds || [];
  var roles = workflowSurfaceParseChainRoles(chain.summary, steps.length);
  var burdenScore = workflowSurfaceChainBurdenScore(chain);
  var burdenBadge = burdenScore > 0
    ? '<span class="chain-burden-count">' + burdenScore + " workflow issue" + (burdenScore === 1 ? "" : "s") + "</span>"
    : "";

  var stepElements = steps.map(function (endpointId: string, idx: number) {
    var nextEndpointId = idx < (steps.length - 1) ? steps[idx + 1] : "";
    return renderWorkflowStep(endpointId, idx, steps.length, roles[idx] || "", nextEndpointId, roles[idx + 1] || "");
  }).join("");

  var taskLabel = workflowSurfaceChainTaskLabel(chain);
  var burdenSummary = workflowSurfaceRenderBurdenSummary(chain, roles);
  var stepsAndReason = burdenSummary
    + '<div class="workflow-steps">' + stepElements + "</div>"
    + (chain.reason ? '<div class="workflow-reason">' + escapeHtml(chain.reason) + "</div>" : "");

  if (isPrimary) {
    return '<div class="workflow-chain">'
      + '<div class="chain-resource-label">'
      + '<span class="chain-resource-name">' + escapeHtml(taskLabel) + "</span>"
      + '<span class="chain-step-count">' + steps.length + " steps</span>"
      + burdenBadge
      + "</div>"
      + stepsAndReason
      + "</div>";
  }
  return '<details class="workflow-chain-compact">'
    + "<summary>"
    + '<span class="chain-compact-resource">' + escapeHtml(taskLabel) + "</span>"
    + '<span class="chain-compact-steps">' + steps.length + " steps</span>"
    + burdenBadge
    + "</summary>"
    + '<div class="workflow-chain-compact-body">'
    + stepsAndReason
    + "</div>"
    + "</details>";
}

function workflowSurfaceAddUniqueClue(list: string[], text: string): void {
  if (!text) return;
  if (list.indexOf(text) === -1) list.push(text);
}

function workflowSurfaceFirstClues(list: string[], limit: number): string[] {
  return (list || []).slice(0, limit);
}

function workflowSurfaceRenderDependencyClues(clues: WorkflowDependencyClues | null | undefined): string {
  if (!clues) return "";
  var prereq = workflowSurfaceFirstClues(clues.prereq, 2);
  var establish = workflowSurfaceFirstClues(clues.establish, 2);
  var nextNeeds = workflowSurfaceFirstClues(clues.nextNeeds, 2);
  var hidden = workflowSurfaceFirstClues(clues.hidden, 2);
  if (!prereq.length && !establish.length && !nextNeeds.length && !hidden.length) return "";

  function clueRow(label: string, items: string[], klass: string, icon: string): string {
    if (!items.length) return "";
    return '<div class="step-clue-row ' + klass + '">'
      + '<span class="step-clue-label"><span class="step-clue-icon">' + icon + "</span>" + label + "</span>"
      + '<span class="step-clue-text">' + escapeHtml(items.join(" | ")) + "</span>"
      + "</div>";
  }

  return '<div class="step-dependency-clues">'
    + clueRow("Depends on", prereq, "step-clue-prereq", "\u25cb")
    + clueRow("Appears to establish", establish, "step-clue-establish", "\u25b8")
    + clueRow("Next step likely needs", nextNeeds, "step-clue-next", "\u2192")
    + clueRow("Not clearly exposed", hidden, "step-clue-hidden", "!")
    + "</div>";
}

function workflowSurfaceInferCueSubject(text: string): string {
  if (!text) return "";

  if (/(auth|bearer|authorization|access\s*key|api[-\s]?key|auth\/header)/.test(text)) return "auth header";
  if (/(token|context)/.test(text)) return "context token";
  if (/(payment|transaction)/.test(text)) return "payment";
  if (/order identity/.test(text)) return "order id";
  if (/cart/.test(text) && /(identity|identifier|selected resource context)/.test(text)) return "cart id";
  if (/customer/.test(text) && /(identity|identifier)/.test(text)) return "customer id";
  if (/order/.test(text) && /(state|changed state|prior state|authoritative state|order context)/.test(text)) return "order state";
  if (/cart/.test(text) && /(state|changed state|prior state|authoritative state|cart context)/.test(text)) return "cart state";
  if (/customer/.test(text) && /(state|context)/.test(text)) return "customer context";
  if (/(action|lookup)/.test(text)) return "action prerequisite";
  if (/(identifier|header)/.test(text)) return "id/header";
  if (/(state transition|changed state|prior state|authoritative state)/.test(text)) return "state change";

  return "";
}

function workflowSurfaceInferTransitionCue(clues: WorkflowDependencyClues, roleLabel: string): WorkflowTransitionCue | null {
  var prereq = clues && clues.prereq ? clues.prereq : [];
  var establish = clues && clues.establish ? clues.establish : [];
  var nextNeeds = clues && clues.nextNeeds ? clues.nextNeeds : [];
  var hidden = clues && clues.hidden ? clues.hidden : [];
  var role = (roleLabel || "").toLowerCase();
  var allText = (prereq.concat(establish, nextNeeds, hidden)).join(" | ").toLowerCase();
  var handoffText = (establish.concat(nextNeeds)).join(" | ").toLowerCase();
  var subject = workflowSurfaceInferCueSubject(allText);
  var handoffSubject = workflowSurfaceInferCueSubject(handoffText) || subject;

  if (/(auth|bearer|authorization|access\s*key|api[-\s]?key)/.test(allText)) {
    return { kind: "context", label: hidden.length ? "auth header dependency" : "auth header handoff" };
  }
  if (/(token|context)/.test(allText)) {
    return { kind: "context", label: hidden.length ? "context token dependency" : "context token handoff" };
  }
  if (/(order identity|order state|order context)/.test(allText)) {
    return { kind: "state", label: "order identity handoff" };
  }
  if (/(cart|order|customer)/.test(allText) && hidden.length) {
    if (subject === "order state" || subject === "cart state" || subject === "customer context") {
      return { kind: "state", label: subject + " dependency" };
    }
    if (subject === "order id" || subject === "cart id" || subject === "customer id") {
      return { kind: "state", label: subject + " dependency" };
    }
    return { kind: "state", label: "resource state dependency" };
  }
  if (/(cart|order|customer|state)/.test(handoffText) || role === "action" || role === "update") {
    if (handoffSubject === "order id" || handoffSubject === "cart id" || handoffSubject === "customer id") {
      return { kind: "state", label: handoffSubject + " handoff" };
    }
    if (handoffSubject === "order state" || handoffSubject === "cart state" || handoffSubject === "customer context") {
      return { kind: "state", label: handoffSubject + " handoff" };
    }
    return { kind: "state", label: "state change handoff" };
  }
  if (/(payment|follow-up|follow up|transaction)/.test(allText) || role === "payment" || role === "checkout") {
    if (/transaction/.test(allText)) {
      return { kind: "followup", label: hidden.length ? "transaction follow-up" : "transaction handoff" };
    }
    return { kind: "followup", label: hidden.length ? "payment follow-up" : "payment handoff" };
  }
  if (hidden.length) {
    if (subject === "action prerequisite") return { kind: "weak", label: "action prerequisite" };
    if (subject === "id/header") return { kind: "weak", label: "hidden id/header" };
    if (subject === "state change") return { kind: "weak", label: "hidden state handoff" };
    if (prereq.length) return { kind: "weak", label: "prior state handoff" };
    return { kind: "weak", label: "hidden handoff" };
  }
  if (prereq.length) {
    if (subject === "action prerequisite") return { kind: "prereq", label: "action prerequisite" };
    if (subject === "order state" || subject === "cart state" || subject === "customer context") {
      return { kind: "prereq", label: subject + " dependency" };
    }
    return { kind: "prereq", label: "prior state dependency" };
  }
  return null;
}
