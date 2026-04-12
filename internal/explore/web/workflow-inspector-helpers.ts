declare var state: ExplorerState;

declare function escapeHtml(value: unknown): string;
declare function payloadEndpointDetails(): StringMap<ExplorerEndpointDetail>;
declare function parseChainRoles(summary: string | undefined, count?: number): string[];
declare function chainTaskLabel(chain: ExplorerWorkflowChain): string;
declare function kindGroupLabel(kind: string): string;
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
declare function collectTrapGuidance(
  endpoint: ExplorerEndpointRow,
  findings: ExplorerFinding[],
  clues: WorkflowDependencyClues,
  linkageFindings: ExplorerFinding[],
  prerequisiteFindings: ExplorerFinding[],
  nextEndpoint: ExplorerEndpointRow | null,
  roleLabel: string,
  isLast: boolean
): WorkflowTrapGuidance[];
declare function summarizeWorkflowStepNarrative(
  endpoint: ExplorerEndpointRow,
  roleLabel: string,
  nextEndpoint: ExplorerEndpointRow | null,
  clues: WorkflowDependencyClues,
  findings: ExplorerFinding[],
  linkageFindings: ExplorerFinding[],
  prerequisiteFindings: ExplorerFinding[],
  isLast: boolean
): WorkflowStepNarrative;
declare function humanizeStepRole(roleSlug: string): string;
declare function chainBurdenScore(chain: ExplorerWorkflowChain): number;
declare function endpointDetailForId(id: string): ExplorerEndpointDetail | null;
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function groupFindings(findings: ExplorerFinding[]): IssueGroup[];
declare function renderTrapGuidanceList(
  traps: WorkflowTrapGuidance[],
  options: { title?: string; className?: string; limit?: number }
): string;
declare function renderFullExactEvidenceDrawer(
  groups: IssueGroup[],
  options: { endpoint?: ExplorerEndpointRow; familyName?: string; open?: boolean }
): string;
declare function createEmptyEndpointRow(): ExplorerEndpointRow;
declare function humanizeObjectName(value: string): string;
declare function issueScopeLabelForKey(groupKey: string, familyName: string): string;
declare function exactEvidenceTargetLabel(): string;
declare function topOpenAPIHighlights(groups: IssueGroup[]): string[];
declare function renderOpenAPIContextPills(context: OpenAPIContext, compact: boolean): string;
declare function renderSpecRuleGroundingForGroup(group: IssueGroup): string;
declare function inspectTargetForGroup(group: IssueGroup, endpoint: ExplorerEndpointRow): string;
declare function dimensionImpact(dimension: string): string;

function renderWorkflowChainContextForEndpoint(detail: ExplorerEndpointDetail): string {
  var endpoint = detail.endpoint || createEmptyEndpointRow();
  var endpointId = endpoint.id || state.selectedEndpointId;
  var relatedChains = detail.relatedChains || [];
  var endpointDetails = payloadEndpointDetails();

  if (!relatedChains.length) return "";

  var primaryChain = relatedChains[0] || ({ endpointIds: [] } as ExplorerWorkflowChain);
  var steps = primaryChain.endpointIds || [];
  var currentStepIndex = steps.indexOf(endpointId);
  var roles = parseChainRoles(primaryChain.summary, steps.length);
  var taskLabel = chainTaskLabel(primaryChain);
  var chainKindLabel = kindGroupLabel(primaryChain.kind || "workflow");

  var stepElements = steps.map(function (endpointStepId: string, stepIdx: number) {
    var nextEndpointId = stepIdx < (steps.length - 1) ? steps[stepIdx + 1] : "";
    var isCurrent = stepIdx === currentStepIndex;
    var isAfterCurrent = stepIdx > currentStepIndex;
    var stepDetail = endpointDetails[endpointStepId];
    if (!stepDetail) return "";

    var stepEndpoint = stepDetail.endpoint;
    var findings = stepDetail.findings || [];
    var role = roles[stepIdx] || "";
    var nextEndpointDetail = nextEndpointId ? endpointDetails[nextEndpointId] : null;
    var nextRole = roles[stepIdx + 1] || "";

    return renderInspectorWorkflowChainStep(
      endpointStepId,
      stepIdx,
      steps.length,
      role,
      nextEndpointId,
      nextRole,
      isCurrent,
      isAfterCurrent,
      findings,
      stepEndpoint,
      nextEndpointDetail ? nextEndpointDetail.endpoint : null
    );
  }).join("");

  return '<div class="workflow-chain-context-card">'
    + '<div class="workflow-chain-context-header">'
    + '<p class="workflow-chain-kicker">' + escapeHtml(chainKindLabel) + "</p>"
    + '<p class="workflow-chain-task"><strong>' + escapeHtml(taskLabel) + '</strong> <span class="workflow-chain-meta">' + steps.length + " steps</span></p>"
    + "</div>"
    + '<div class="workflow-chain-steps-container">'
    + stepElements
    + "</div>"
    + "</div>";
}

function renderInspectorWorkflowChainStep(
  endpointId: string,
  stepIndex: number,
  totalSteps: number,
  roleLabel: string,
  nextEndpointId: string,
  nextRoleLabel: string,
  isCurrent: boolean,
  isAfterCurrent: boolean,
  findings: ExplorerFinding[],
  endpoint: ExplorerEndpointRow,
  nextEndpoint: ExplorerEndpointRow | null
): string {
  var method = endpoint.method || "";
  var path = endpoint.path || "";
  var isLast = stepIndex === (totalSteps - 1);
  var shapeFindings = findings.filter(function (finding: ExplorerFinding) {
    return finding.code === "contract-shape-workflow-guidance-burden";
  });
  var linkageFindings = findings.filter(function (finding: ExplorerFinding) {
    return finding.code === "weak-follow-up-linkage"
      || finding.code === "weak-action-follow-up-linkage"
      || finding.code === "weak-accepted-tracking-linkage"
      || finding.code === "weak-outcome-next-action-guidance";
  });
  var prerequisiteFindings = findings.filter(function (finding: ExplorerFinding) {
    return finding.code === "prerequisite-task-burden";
  });

  var dependencyClues = buildWorkflowDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings);
  var trapGuidance = collectTrapGuidance(endpoint, findings, dependencyClues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast);
  var narrative = summarizeWorkflowStepNarrative(endpoint, roleLabel, nextEndpoint, dependencyClues, findings, linkageFindings, prerequisiteFindings, isLast);

  var trapHtml = "";
  if (trapGuidance.length) {
    trapHtml = '<div class="inspector-chain-step-trap">'
      + '<span class="trap-icon">Trap</span>'
      + '<span class="trap-text"><strong>Common hidden traps:</strong> ' + escapeHtml(trapGuidance[0].title || trapGuidance[0].happened || trapGuidance[0].id) + "</span>"
      + "</div>";
  }

  var warnings: string[] = [];
  if (shapeFindings.length) warnings.push("storage-shaped response");
  if (linkageFindings.length) warnings.push("missing next-step ID");
  if (prerequisiteFindings.length) warnings.push("hidden dependency");
  var warningHtml = warnings.length
    ? ('<div class="inspector-chain-step-warnings">' + warnings.join(", ") + "</div>")
    : "";

  var humanRole = roleLabel ? humanizeStepRole(roleLabel) : ("Step " + (stepIndex + 1));
  var currentClass = isCurrent ? " inspector-chain-step-current" : (isAfterCurrent ? " inspector-chain-step-future" : "");

  return '<div class="inspector-chain-step' + currentClass + '" data-chain-step-id="' + escapeHtml(endpointId) + '">'
    + '<div class="inspector-chain-step-number">' + (stepIndex + 1) + "</div>"
    + '<div class="inspector-chain-step-content">'
    + '<div class="inspector-chain-step-role">' + escapeHtml(humanRole) + "</div>"
    + '<div class="inspector-chain-step-endpoint"><strong>' + escapeHtml(method + " " + path) + "</strong></div>"
    + '<div class="inspector-chain-step-purpose"><span class="label">What this call does:</span> ' + escapeHtml(narrative.callDoes) + "</div>"
    + '<div class="inspector-chain-step-state"><span class="label">What you need before calling it:</span> ' + escapeHtml(narrative.requiredState || "none explicitly defined") + "</div>"
    + '<div class="inspector-chain-step-change"><span class="label">What changes after it succeeds:</span> ' + escapeHtml(narrative.changesAfter || "") + "</div>"
    + (narrative.nextAction ? ('<div class="inspector-chain-step-next"><span class="label">What to call next:</span> ' + escapeHtml(narrative.nextAction) + "</div>") : "")
    + warningHtml
    + trapHtml
    + "</div>"
    + "</div>";
}

function pickPrimaryWorkflowChainForEndpoint(detail: ExplorerEndpointDetail): ExplorerWorkflowChain | null {
  var endpoint = (detail && detail.endpoint) ? detail.endpoint : createEmptyEndpointRow();
  var endpointId = endpoint.id || state.selectedEndpointId || "";
  var chains = (detail && detail.relatedChains) ? detail.relatedChains : [];
  if (!endpointId || !chains.length) return null;

  var candidates = chains.filter(function (chain: ExplorerWorkflowChain) {
    var ids = chain && chain.endpointIds ? chain.endpointIds : [];
    return ids.indexOf(endpointId) >= 0;
  });
  if (!candidates.length) return null;

  candidates.sort(function (a: ExplorerWorkflowChain, b: ExplorerWorkflowChain) {
    var aScore = chainBurdenScore(a || ({ endpointIds: [] } as ExplorerWorkflowChain));
    var bScore = chainBurdenScore(b || ({ endpointIds: [] } as ExplorerWorkflowChain));
    if (aScore !== bScore) return bScore - aScore;
    var aLength = (a && a.endpointIds) ? a.endpointIds.length : 0;
    var bLength = (b && b.endpointIds) ? b.endpointIds.length : 0;
    if (aLength !== bLength) return bLength - aLength;
    return String((a && a.kind) || "").localeCompare(String((b && b.kind) || ""));
  });
  return candidates[0] || null;
}

function renderWorkflowStepWorkspace(detail: ExplorerEndpointDetail): string {
  var endpoint = (detail && detail.endpoint) ? detail.endpoint : createEmptyEndpointRow();
  var endpointId = endpoint.id || state.selectedEndpointId || "";
  var chain = pickPrimaryWorkflowChainForEndpoint(detail);
  if (!endpointId) return "";

  var steps = chain ? (chain.endpointIds || []) : [];
  var roles = chain ? parseChainRoles(chain.summary, steps.length) : [];
  var stepIndex = chain ? steps.indexOf(endpointId) : -1;

  var nextEndpointId = stepIndex < (steps.length - 1) ? steps[stepIndex + 1] : "";
  var nextDetail = nextEndpointId ? endpointDetailForId(nextEndpointId) : null;
  var nextEndpoint = nextDetail ? nextDetail.endpoint : null;

  var linkageFindings = (detail.findings || []).filter(function (finding: ExplorerFinding) {
    return finding && (finding.code === "weak-follow-up-linkage" || finding.code === "weak-action-follow-up-linkage" || finding.code === "weak-accepted-tracking-linkage" || finding.code === "weak-outcome-next-action-guidance");
  });
  var prerequisiteFindings = (detail.findings || []).filter(function (finding: ExplorerFinding) {
    return finding && finding.code === "prerequisite-task-burden";
  });

  var clues = buildWorkflowDependencyClues(
    endpoint,
    detail.findings || [],
    Math.max(0, stepIndex),
    Math.max(1, steps.length || 1),
    roles[stepIndex] || "",
    nextEndpoint,
    roles[stepIndex + 1] || "",
    linkageFindings,
    prerequisiteFindings
  );
  var narrative = summarizeWorkflowStepNarrative(
    endpoint,
    roles[stepIndex] || "",
    nextEndpoint,
    clues,
    detail.findings || [],
    linkageFindings,
    prerequisiteFindings,
    stepIndex >= 0 ? (stepIndex === (steps.length - 1)) : false
  );

  var hiddenHandoff = (clues.hidden && clues.hidden.length)
    ? clues.hidden.slice(0, 2).join(" | ")
    : (linkageFindings.length
      ? "This response does not clearly surface the identifier/context the next step needs."
      : "No obvious hidden handoff signal was detected for this step in the current lens.");

  var contractFailed = linkageFindings.length
    ? "The contract does not make the next-step dependency explicit. It should return the next-step ID/context in an obvious field and document what the next call needs."
    : (prerequisiteFindings.length
      ? "The contract implies prerequisites without modeling them explicitly (clients must learn ordering at runtime)."
      : "The contract problem here is mainly about sequence clarity and context transfer, not a single missing field.");

  var stepLabel = (stepIndex >= 0 && steps.length) ? ("Step " + (stepIndex + 1) + " of " + steps.length) : "Current step";
  var kind = chain && chain.kind ? String(chain.kind).replace(/-/g, " to ") : "workflow";
  var stepPrefix = (chain && steps.length) ? (stepLabel + " — " + kind + " — ") : "";
  var nextActionFallback = nextEndpoint
    ? (nextEndpoint.method + " " + nextEndpoint.path)
    : (chain && steps.length ? "No next step was inferred for this chain." : "Expand endpoints in this family and inspect the next likely call.");

  return '<div class="family-insight-card workflow-step-workspace">'
    + '<p class="insight-kicker">Workflow step guidance</p>'
    + '<ul class="family-top-evidence">'
    + '<li><strong>Current step:</strong> ' + escapeHtml(stepPrefix + endpoint.method + " " + endpoint.path) + "</li>"
    + '<li><strong>What this step needs:</strong> ' + escapeHtml(narrative.requiredState || "No explicit prerequisites are visible in the contract; treat prior context as required.") + "</li>"
    + '<li><strong>Hidden handoff/context dependency:</strong> ' + escapeHtml(hiddenHandoff) + "</li>"
    + '<li><strong>What to call next:</strong> ' + escapeHtml(narrative.nextAction || nextActionFallback) + "</li>"
    + '<li><strong>Where the contract failed to communicate it:</strong> ' + escapeHtml(contractFailed) + "</li>"
    + "</ul>"
    + "</div>";
}

function summarizeWorkflowHeaderSignals(detail: ExplorerEndpointDetail): string {
  var findings = (detail && detail.findings) || [];
  var messages = findings.map(function (finding: ExplorerFinding) { return (finding.message || "").toLowerCase(); }).join(" | ");

  function hasCode(codes: string[]): boolean {
    return findings.some(function (finding: ExplorerFinding) { return codes.indexOf(finding.code || "") !== -1; });
  }

  var labels: string[] = [];
  if (hasCode(["weak-follow-up-linkage", "weak-action-follow-up-linkage", "weak-accepted-tracking-linkage", "weak-outcome-next-action-guidance"])
    || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed/.test(messages)) {
    labels.push("next-step gap");
  }
  if (hasCode(["weak-follow-up-linkage", "weak-action-follow-up-linkage", "weak-accepted-tracking-linkage"])
    || /handoff|identifier|tracking|hidden/.test(messages)) {
    labels.push("hidden handoff");
  }
  if (/auth|authorization|bearer|token|header|context|access\s*key|api[-\s]?key/.test(messages)) {
    labels.push("auth/context spread");
  }
  if (hasCode(["prerequisite-task-burden"])
    || /prior state|earlier|sequence|prerequisite|brittle/.test(messages)) {
    labels.push("sequencing risk");
  }

  if (!labels.length) return "workflow clues are limited for this endpoint";
  return "main workflow clues: " + labels.join(", ");
}

function renderWorkflowDiagnosticsFrame(detail: ExplorerEndpointDetail): string {
  var findings = detail.findings || [];
  var messages = findings.map(function (finding: ExplorerFinding) { return (finding.message || "").toLowerCase(); }).join(" | ");

  function hasCode(codes: string[]): boolean {
    return findings.some(function (finding: ExplorerFinding) { return codes.indexOf(finding.code || "") !== -1; });
  }

  var activeSignals: string[] = [];
  if (hasCode(["weak-follow-up-linkage", "weak-action-follow-up-linkage", "weak-accepted-tracking-linkage", "weak-outcome-next-action-guidance"])
    || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed/.test(messages)) {
    activeSignals.push("Next-step gap is signaled: follow-up requirement is not clearly exposed.");
  }
  if (hasCode(["weak-follow-up-linkage", "weak-action-follow-up-linkage", "weak-accepted-tracking-linkage"])
    || /handoff|identifier|tracking|hidden/.test(messages)) {
    activeSignals.push("Hidden handoff is signaled: identifier/context transfer appears implicit.");
  }
  if (/auth|authorization|bearer|token|header|context|access\s*key|api[-\s]?key/.test(messages)) {
    activeSignals.push("Auth/header/context requirements appear spread across messages for this endpoint.");
  }
  if (hasCode(["prerequisite-task-burden"])
    || /prior state|earlier|sequence|prerequisite|brittle/.test(messages)) {
    activeSignals.push("Sequencing risk is signaled: this step appears to depend on prior state setup.");
  }

  var signalList = activeSignals.length
    ? activeSignals.map(function (text: string) { return "<li>" + escapeHtml(text) + "</li>"; }).join("")
    : "<li>No explicit workflow continuity clue is attached to this endpoint in the current workflow view.</li>";

  return '<div class="family-insight-card">'
    + '<p class="insight-kicker">Workflow diagnostics framing</p>'
    + '<p class="subtle">This panel focuses on where a developer can get stuck in the call sequence: what the next step needs, what state is hidden, and where sequencing may be brittle.</p>'
    + '<ul class="family-top-evidence">'
    + signalList
    + "</ul>"
    + "</div>";
}

function buildChainContext(
  relatedChains: ExplorerWorkflowChain[],
  endpointId: string,
  endpointDetails: StringMap<ExplorerEndpointDetail>
): string {
  if (!relatedChains || !relatedChains.length) return "";

  var html = '<section class="detail-chain-context">';
  relatedChains.forEach(function (chain: ExplorerWorkflowChain) {
    var stepIndex = chain.endpointIds.indexOf(endpointId);
    if (stepIndex < 0) return;

    var totalSteps = chain.endpointIds.length;
    var stepNum = stepIndex + 1;
    var hasPrev = stepIndex > 0;
    var hasNext = stepIndex < totalSteps - 1;
    var kind = chain.kind ? chain.kind.replaceAll("-", " to ") : "workflow";

    html += '<div class="chain-context-block">'
      + '<div class="chain-position-banner">Step ' + stepNum + " of " + totalSteps + " — " + escapeHtml(kind) + "</div>";

    if (hasPrev) {
      var prevId = chain.endpointIds[stepIndex - 1];
      var prevDetail = endpointDetails[prevId];
      if (prevDetail) {
        html += '<div class="chain-step-info prev-step">'
          + '<p class="chain-step-label">Came from</p>'
          + "<strong>" + escapeHtml(prevDetail.endpoint.method + " " + prevDetail.endpoint.path) + "</strong>"
          + "<p class=\"subtle\">That step's response provides context or identifiers used here.</p>"
          + "</div>";
      }
    }

    if (hasNext) {
      var nextId = chain.endpointIds[stepIndex + 1];
      var nextDetail = endpointDetails[nextId];
      if (nextDetail) {
        var nextNeeds = describeNextStepNeeds(chain.endpointIds[stepIndex], nextDetail);
        html += '<div class="chain-step-info next-step">'
          + '<p class="chain-step-label">Leads to</p>'
          + "<strong>" + escapeHtml(nextDetail.endpoint.method + " " + nextDetail.endpoint.path) + "</strong>"
          + '<p class="subtle">' + escapeHtml(nextNeeds) + "</p>"
          + "</div>";
      }
    }

    html += "</div>";
  });

  html += "</section>";
  return html;
}

function describeNextStepNeeds(fromId: string, toDetail: ExplorerEndpointDetail): string {
  var toPath = toDetail.endpoint.path;
  if (toPath.indexOf("{") !== -1) {
    return "This step needs to extract an identifier from " + humanizeObjectName(toPath.split("/").pop()!.replace(/{|}/g, "")) + " and pass it forward.";
  }
  return "The next step needs context or identifiers from this response to proceed. Check the response schema for required IDs.";
}

function renderEndpointDiagnosticsWorkflowSummary(detail: ExplorerEndpointDetail): string {
  var endpoint = detail.endpoint || createEmptyEndpointRow();
  var findings = findingsForActiveLens(detail.findings || []);
  var groups = groupFindings(findings);
  var chainCount = (detail.relatedChains || []).length;
  var signalSummary = summarizeWorkflowHeaderSignals(detail);
  var guidance = collectTrapGuidance(endpoint, findings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, "", false);
  var guidanceHtml = renderTrapGuidanceList(guidance, {
    title: "Workflow trap guidance",
    className: "inspector-trap-guidance",
    limit: 3
  });
  var chainContextHtml = renderWorkflowChainContextForEndpoint(detail);

  return '<div class="endpoint-diag-pane">'
    + chainContextHtml
    + '<div class="family-insight-card">'
    + '<p class="insight-kicker">Workflow continuity evidence</p>'
    + '<p class="subtle"><strong>' + escapeHtml(endpoint.method + " " + endpoint.path) + "</strong> "
    + (chainCount ? ("appears in " + chainCount + " workflow chain" + (chainCount === 1 ? "" : "s")) : "is not currently linked to an inferred chain")
    + " and is prioritized here for continuity burden signals.</p>"
    + '<ul class="family-top-evidence">'
    + '<li><strong>Primary continuity signals:</strong> ' + escapeHtml(signalSummary.replace(/^primary continuity signals:\s*/i, "")) + ".</li>"
    + "<li><strong>Why this matters to a client:</strong> When the contract does not expose next-step IDs/context, clients must guess, store hidden state, or add extra reads between calls.</li>"
    + "</ul>"
    + guidanceHtml
    + "</div>"
    + renderFullExactEvidenceDrawer(groups, { endpoint: endpoint, familyName: endpoint.family || "", open: false })
    + "</div>";
}
