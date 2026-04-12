declare var state: ExplorerState;

declare function filteredRows(): ExplorerEndpointRow[];
declare function rowsInScopeAll(): ExplorerEndpointRow[];
declare function lensFindingCountForRow(row: ExplorerEndpointRow | null | undefined): number;
declare function priorityRank(priority: string): number;
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function dominantSeverity(findings: ExplorerFinding[]): string;
declare function severityPriority(severity: string): number;
declare function groupFindings(findings: ExplorerFinding[]): IssueGroup[];
declare function hasWorkflowShapedExampleSignals(findings: ExplorerFinding[]): boolean;
declare function collectWorkflowShapedExamplePoints(endpoint: ExplorerEndpointRow, findings: ExplorerFinding[]): FamilyInsightPoints;
declare function pickFamilyDominantDriver(family: ExplorerFamilySummary): { key: string; label: string; signalKey: string; score: number };
declare function familyDominantSignalsForDriver(family: ExplorerFamilySummary, driverKey: string): string[];
declare function sortedSignalLabels(map: StringMap<number>, limit?: number): string[];
declare function familyDxSignalFragment(signal: string): string;
declare function uniq<T>(values: T[]): T[];
declare function toSentenceCase(text: string): string;
declare function familyDriverFocus(driverKey: string, dominantSignals: string[]): string;
declare function familyPrimaryRisk(driverKey: string, dominantSignals: string[]): string;
declare function familyRecommendedAction(driverKey: string, dominantSignals: string[]): string;
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
declare function dimensionCleanerHint(dimension: string): string;
declare function buildContractImprovementItems(
  detail: ExplorerEndpointDetail,
  findings: ExplorerFinding[]
): ContractImprovementItem[];
declare function renderOpenAPIContextPills(context: OpenAPIContext, compact: boolean): string;
declare function renderSpecRuleGroundingForGroup(group: IssueGroup): string;
declare function renderTrapGuidanceList(
  traps: WorkflowTrapGuidance[],
  options: { title?: string; className?: string; limit?: number }
): string;
declare function formatWhereWithOpenAPITarget(
  endpoint: ExplorerEndpointRow,
  context: OpenAPIContext,
  options: { kind?: string }
): string;
declare function renderWhatToDoNextBlock(
  endpoint: ExplorerEndpointRow,
  findings: ExplorerFinding[],
  options: { maxItems?: number; leadCopy?: string; showEndpointLabel?: boolean }
): string;
declare function formatIssueGroupCountLabel(group: IssueGroup): string;
declare function escapeHtml(value: unknown): string;
declare function payloadEndpointDetails(): StringMap<ExplorerEndpointDetail>;

function familyInsightBestEndpointIdForFamily(familyName: string): string {
  if (!familyName) return "";
  var rows = filteredRows().filter(function (row: ExplorerEndpointRow) {
    return (row.family || "unlabeled family") === familyName;
  });
  if (!rows.length) return "";

  var best: { id: string; score: number } | null = null;
  rows.forEach(function (row: ExplorerEndpointRow) {
    var detail = payloadEndpointDetails()[row.id] || null;
    var lens = detail ? findingsForActiveLens(detail.findings || []) : [];
    var count = lens.length;
    var severity = dominantSeverity(lens);
    var score = (count * 10) + Math.max(0, 3 - severityPriority(severity));
    if (!best || score > best.score) {
      best = { id: row.id, score: score };
    }
  });
  return best ? best.id : rows[0].id;
}

function familyInsightBuildRankedSummary(family: ExplorerFamilySummary): ExplorerFamilyRankedSummary {
  var driver = pickFamilyDominantDriver(family);
  if (state.activeTopTab === "workflow") {
    driver = { key: "workflow", label: "Workflow-driven", signalKey: "workflow", score: driver.score || 0 };
  }
  if (state.activeTopTab === "shape") {
    driver = { key: "shape", label: "Shape-driven", signalKey: "shape", score: driver.score || 0 };
  }
  var dominantSignals = familyDominantSignalsForDriver(family, driver.signalKey || driver.key);

  var dxSignals = dominantSignals.slice();
  if (state.activeTopTab === "shape") {
    dxSignals = sortedSignalLabels((family && family.shapeSignalCounts ? family.shapeSignalCounts : {}) as StringMap<number>, 6);
  }
  var dxReasons = uniq(dxSignals.map(function (s: string) { return familyDxSignalFragment(s); }).filter(Boolean));
  var dxParts = dxReasons.slice(0, 2);
  var dxConsequence = "";
  if (dxParts.length === 0) {
    dxConsequence = "Contract clarity is uneven, so similar operations may still teach different integration habits.";
  } else if (dxParts.length === 1) {
    dxConsequence = toSentenceCase(dxParts[0]) + ".";
  } else {
    dxConsequence = toSentenceCase(dxParts[0]) + " and " + dxParts[1] + ".";
  }

  return {
    dominantSignals: dominantSignals,
    driver: driver.key,
    driverLabel: driver.label,
    driverFocus: familyDriverFocus(driver.signalKey || driver.key, dominantSignals),
    primaryRisk: familyPrimaryRisk(driver.key, dominantSignals),
    dxParts: dxParts,
    dxReasons: dxReasons,
    dxConsequence: dxConsequence,
    recommendedAction: familyRecommendedAction(driver.key, dominantSignals)
  };
}

function familyInsightRowsInView(familyName: string): ExplorerEndpointRow[] {
  var key = familyName || "unlabeled family";
  var rows = filteredRows().filter(function (row: ExplorerEndpointRow) {
    return (row.family || "unlabeled family") === key && lensFindingCountForRow(row) > 0;
  });
  if (rows.length) return rows;

  return rowsInScopeAll().filter(function (row: ExplorerEndpointRow) {
    return (row.family || "unlabeled family") === key && lensFindingCountForRow(row) > 0;
  });
}

function familyInsightPickLeadRow(rows: ExplorerEndpointRow[]): ExplorerEndpointRow | null {
  if (!rows || !rows.length) return null;
  var selected = rows.find(function (row: ExplorerEndpointRow) { return row.id === state.selectedEndpointId; });
  if (selected) return selected;
  return rows.slice().sort(function (a: ExplorerEndpointRow, b: ExplorerEndpointRow) {
    if (priorityRank(a.priority || "") !== priorityRank(b.priority || "")) return priorityRank(a.priority || "") - priorityRank(b.priority || "");
    var aCount = lensFindingCountForRow(a);
    var bCount = lensFindingCountForRow(b);
    if (aCount !== bCount) return bCount - aCount;
    return (a.path || "").localeCompare(b.path || "");
  })[0] || null;
}

function familyInsightCollectCompactWorkflowContext(
  relatedChains: ExplorerWorkflowChain[],
  endpointId: string,
  endpointDetails: StringMap<ExplorerEndpointDetail>
): string[] {
  if (!relatedChains || !relatedChains.length) return [];
  var lines: string[] = [];

  relatedChains.slice(0, 2).forEach(function (chain: ExplorerWorkflowChain) {
    var stepIndex = (chain.endpointIds || []).indexOf(endpointId);
    if (stepIndex < 0) return;
    var parts: string[] = [];
    var totalSteps = (chain.endpointIds || []).length;
    var kind = chain.kind ? chain.kind.replaceAll("-", " to ") : "workflow";
    parts.push("Step " + (stepIndex + 1) + " of " + totalSteps + " in " + kind + ".");

    if (stepIndex > 0) {
      var prevDetail = endpointDetails[chain.endpointIds[stepIndex - 1]];
      if (prevDetail && prevDetail.endpoint) {
        parts.push("Comes from " + prevDetail.endpoint.method + " " + prevDetail.endpoint.path + ".");
      }
    }
    if (stepIndex < totalSteps - 1) {
      var nextDetail = endpointDetails[chain.endpointIds[stepIndex + 1]];
      if (nextDetail && nextDetail.endpoint) {
        parts.push("Leads to " + nextDetail.endpoint.method + " " + nextDetail.endpoint.path + ".");
      }
    }

    lines.push(parts.join(" "));
  });

  return lines;
}

function familyInsightBuildModel(familyName: string, preferredEndpointId: string): ExplorerFamilyInsightModel | null {
  var rows = familyInsightRowsInView(familyName);
  var leadRow: ExplorerEndpointRow | null = null;
  if (preferredEndpointId) {
    leadRow = rows.find(function (row: ExplorerEndpointRow) { return row.id === preferredEndpointId; }) || null;
  }
  if (!leadRow) {
    leadRow = familyInsightPickLeadRow(rows);
  }
  if (!leadRow) return null;

  var detail = payloadEndpointDetails()[leadRow.id] || ({ findings: [], endpoint: leadRow } as ExplorerEndpointDetail);
  var findings = findingsForActiveLens(detail.findings || []);
  var groups = groupFindings(findings);
  var topGroup = groups[0] || null;
  var topContext = topGroup ? topGroup.context : null;
  var points = hasWorkflowShapedExampleSignals(findings)
    ? collectWorkflowShapedExamplePoints(detail.endpoint || leadRow, findings)
    : { current: [], cleaner: [], evidence: [] };

  return {
    leadRow: leadRow,
    detail: detail,
    groups: groups,
    topGroup: topGroup,
    topContext: topContext,
    points: points,
    workflowLines: familyInsightCollectCompactWorkflowContext(detail.relatedChains || [], leadRow.id, payloadEndpointDetails())
  };
}

function familyInsightRenderPanel(family: ExplorerFamilySummary, preferredEndpointId: string): string {
  var familyName = family.family || "unlabeled family";
  var model = familyInsightBuildModel(familyName, preferredEndpointId || "");
  if (!model) {
    return '<div class="family-insight-panel">'
      + '<p class="subtle">No evidence-bearing endpoint is currently available for this family in the current view.</p>'
      + "</div>";
  }

  var rankedFamily = familyInsightBuildRankedSummary(family || ({ family: familyName, pressure: "" } as ExplorerFamilySummary));
  var lead = model.topGroup;
  var leadEndpoint = model.detail && model.detail.endpoint ? model.detail.endpoint : model.leadRow;
  var leadFindings = (model.detail && model.detail.findings) ? model.detail.findings : [];
  var workflowTabActive = state.activeTopTab === "workflow";
  var shapeTabActive = state.activeTopTab === "shape";
  var specRuleTabActive = state.activeTopTab === "spec-rule";
  var workflowTrapGuidance = workflowTabActive
    ? collectTrapGuidance(leadEndpoint, leadFindings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, "", false)
    : [];
  var primaryProblemText = lead && lead.messages[0] ? lead.messages[0] : "No direct issue text is available for this endpoint.";
  var whyMattersText = lead && lead.impact
    ? lead.impact
    : (specRuleTabActive
        ? "This violates an explicit OpenAPI rule expectation, which breaks client tooling and increases integration risk."
        : "Clients may need extra guesswork, follow-up reads, or runtime knowledge because the contract does not guide the next step clearly.");
  var recommendedChangeText = lead
    ? dimensionCleanerHint(lead.dimension)
    : (specRuleTabActive
        ? "Fix the OpenAPI rule violation at the referenced schema/response location."
        : "Return an outcome-first response with explicit nextAction and handoff IDs.");

  var insightEndpointLabel = model.leadRow.method + " " + model.leadRow.path;
  var lensFindings = findingsForActiveLens((model.detail && model.detail.findings) ? model.detail.findings : []);
  var improvementItems = buildContractImprovementItems(model.detail || ({ endpoint: leadEndpoint, findings: [] } as ExplorerEndpointDetail), lensFindings);
  var topEvidence = model.groups.slice(0, 3);

  var groundingHtml = '<div class="expansion-grounding">'
    + renderOpenAPIContextPills(model.topContext || createEmptyOpenAPIContext(), true)
    + (lead && lead.isSpecRule ? renderSpecRuleGroundingForGroup(lead) : "")
    + "</div>";

  var problemBlock = '<div class="expansion-section expansion-problem">'
    + '<p class="expansion-section-title">Lead issue</p>'
    + '<p class="expansion-text">' + escapeHtml(primaryProblemText) + "</p>"
    + groundingHtml
    + "</div>";

  var clientEffectText = rankedFamily && rankedFamily.dxConsequence ? rankedFamily.dxConsequence : "";
  var trapHtml = (workflowTabActive && workflowTrapGuidance.length)
    ? ('<div class="expansion-subblock">'
      + '<p class="expansion-text"><strong>Common traps:</strong></p>'
      + renderTrapGuidanceList(workflowTrapGuidance, { title: "", className: "", limit: 2 })
      + "</div>")
    : "";
  var workflowContextHtml = (workflowTabActive && model.workflowLines.length)
    ? ('<div class="expansion-subblock">'
      + '<p class="expansion-text"><strong>Workflow context:</strong></p>'
      + '<ul class="expansion-workflow-list">' + model.workflowLines.slice(0, 4).map(function (line: string) { return "<li>" + escapeHtml(line) + "</li>"; }).join("") + "</ul>"
      + "</div>")
    : "";

  var clientBlock = '<div class="expansion-section expansion-client-impact">'
    + '<p class="expansion-section-title">Why it matters</p>'
    + '<p class="expansion-text">' + escapeHtml(whyMattersText) + "</p>"
    + (clientEffectText ? ('<p class="expansion-text"><strong>Client effect:</strong> ' + escapeHtml(clientEffectText) + "</p>") : "")
    + trapHtml
    + workflowContextHtml
    + "</div>";

  var changeItemsHtml = improvementItems.length
    ? '<div class="expansion-contract-items">'
      + improvementItems.slice(0, 3).map(function (item: ContractImprovementItem) {
        var inspect = item.inspect || item.where || "";
        return '<div class="expansion-contract-item">'
          + '<p class="expansion-text"><strong>Change:</strong> ' + escapeHtml(item.change) + "</p>"
          + '<p class="expansion-text"><strong>Where:</strong> ' + escapeHtml(item.where) + "</p>"
          + (inspect ? ('<p class="expansion-text"><strong>Inspect in schema:</strong> ' + escapeHtml(inspect) + "</p>") : "")
          + '<p class="expansion-text"><strong>Why:</strong> ' + escapeHtml(item.why) + "</p>"
          + "</div>";
      }).join("")
      + "</div>"
    : '<p class="expansion-text"><strong>Recommended change:</strong> ' + escapeHtml(recommendedChangeText) + "</p>"
      + '<p class="expansion-text"><strong>Where:</strong> ' + escapeHtml(formatWhereWithOpenAPITarget(leadEndpoint, model.topContext || createEmptyOpenAPIContext(), {})) + "</p>";

  var shapeComparisonHtml = (shapeTabActive && (model.points.current.length || model.points.cleaner.length))
    ? ('<div class="expansion-subblock">'
      + '<p class="expansion-text"><strong>Current vs improved (illustrative):</strong></p>'
      + '<div class="expansion-cleaner-comparison">'
      + "<div><strong>Current</strong><ul>" + (model.points.current.length ? model.points.current.map(function (item: string) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") : '<li class="subtle">Storage-shaped, mixed outcome.</li>') + "</ul></div>"
      + "<div><strong>Improved</strong><ul>" + (model.points.cleaner.length ? model.points.cleaner.map(function (item: string) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") : '<li class="subtle">Task-shaped, outcome-first.</li>') + "</ul></div>"
      + "</div>"
      + "</div>")
    : "";

  var recommendedAction = rankedFamily && rankedFamily.recommendedAction ? rankedFamily.recommendedAction : "";
  var actionLine = recommendedAction
    ? ('<p class="expansion-text"><strong>Recommended action:</strong> ' + escapeHtml(recommendedAction) + "</p>")
    : "";
  var changeBlock = '<div class="expansion-section expansion-contract-change">'
    + '<p class="expansion-section-title">Recommended action</p>'
    + actionLine
    + renderWhatToDoNextBlock(leadEndpoint, lensFindings, { maxItems: 2, leadCopy: "" })
    + changeItemsHtml
    + shapeComparisonHtml
    + "</div>";

  var evidenceListHtml = topEvidence.length
    ? ('<ul class="expansion-evidence-list">'
      + topEvidence.map(function (group: IssueGroup) { return "<li>" + escapeHtml(formatIssueGroupCountLabel(group)) + "</li>"; }).join("")
      + "</ul>")
    : '<p class="subtle">No grouped evidence was available for this endpoint in the current view.</p>';

  var evidenceActions = '<div class="expansion-actions expansion-actions-inline">'
    + '<button type="button" class="secondary-action" data-open-evidence-id="' + escapeHtml(model.leadRow.id) + '">Open grouped deviations</button>'
    + '<button type="button" class="secondary-action" data-focus-family="' + escapeHtml(familyName) + '">Filter to family in list</button>'
    + "</div>";

  var evidenceBlock = '<div class="expansion-section expansion-open-evidence">'
    + '<p class="expansion-section-title">Grouped deviations</p>'
    + '<p class="subtle">Evidence grouped by schema field and issue type. Open grouped deviations to see the exact findings and schema grounding.</p>'
    + evidenceListHtml
    + evidenceActions
    + "</div>";

  var sections = [problemBlock, clientBlock, changeBlock, evidenceBlock];

  return '<div class="family-insight-panel">'
    + '<div class="expansion-header">'
    + '<div class="expansion-header-title">'
    + "<strong>" + escapeHtml(insightEndpointLabel) + "</strong>"
    + '<span class="expansion-secondary-label"> | Family Insight</span>'
    + "</div>"
    + "</div>"
    + '<div class="expansion-sections expansion-sections-ordered">'
    + sections.join("")
    + "</div>"
    + "</div>";
}
