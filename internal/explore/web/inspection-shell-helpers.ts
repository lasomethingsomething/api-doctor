declare var state: ExplorerState;
declare var el: ExplorerElements;
declare var focusMap: StringMap<boolean> | null;

declare function aggregateSpecRuleFindings(rows: ExplorerEndpointRow[]): SpecRuleAggregateGroup[];
declare function buildChainContext(
  chains: ExplorerWorkflowChain[],
  endpointId: string,
  endpointDetails: StringMap<ExplorerEndpointDetail>
): string;
declare function buildContextTypeBadge(context: OpenAPIContext): string;
declare function createEmptyEndpointRow(): ExplorerEndpointRow;
declare function dimensionCleanerHint(dimension: string): string;
declare function dominantSeverity(findings: ExplorerFinding[]): string;
declare function endpointIntentCue(method: string, path: string): string;
declare function escapeHtml(value: unknown): string;
declare function familyPressureByFamily(rows: ExplorerEndpointRow[]): StringMap<string>;
declare function filteredRows(): ExplorerEndpointRow[];
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function groupFindings(findings: ExplorerFinding[]): IssueGroup[];
declare function humanFamilyLabel(name: string): string;
declare function lensFindingCountForRow(row: ExplorerEndpointRow | null | undefined): number;
declare function pressureBadge(priority: string, kind?: string): string;
declare function renderDynamicBurdenSignals(rows: ExplorerEndpointRow[], burdenFocus: string): string;
declare function renderFullExactEvidenceDrawer(
  groups: IssueGroup[],
  options?: { endpoint?: ExplorerEndpointRow; familyName?: string; open?: boolean }
): string;
declare function renderOpenAPILocationCuesBlock(context: OpenAPIContext, compact?: boolean): string;
declare function renderSpecRuleAggregate(groups: SpecRuleAggregateGroup[]): string;
declare function renderSpecRuleBanner(groups: SpecRuleAggregateGroup[], visibleRowCount: number): string;
declare function renderSpecRuleGroundingForGroup(group: IssueGroup): string;
declare function renderWorkflowChainContextForEndpoint(detail: ExplorerEndpointDetail): string;
declare function renderWorkflowShapedExample(detail: ExplorerEndpointDetail, findings: ExplorerFinding[]): string;
declare function severityBadge(severity: string): string;

function inspectionShellActiveTopTabLabel(): string {
  if (state.activeTopTab === 'workflow') return 'Workflow Guidance';
  if (state.activeTopTab === 'shape') return 'Response Shape';
  return 'Contract Issues';
}

function inspectionShellRenderInspectorWorkspaceHeader(
  detail: ExplorerEndpointDetail,
  findings: ExplorerFinding[],
  options?: { collapseTarget?: string; collapsed?: boolean }
): string {
  var opts = options || {};
  var endpoint = (detail && detail.endpoint) ? detail.endpoint : createEmptyEndpointRow();
  var lensFindings = Array.isArray(findings) ? findings : findingsForActiveLens(findings || []);
  var countLabel = lensFindings.length + ' issue' + (lensFindings.length === 1 ? '' : 's');
  var endpointLabel = (((endpoint.method || '').toUpperCase() + ' ' + (endpoint.path || '')).trim());
  var collapseTarget = String(opts.collapseTarget || '');
  var collapsed = !!opts.collapsed;
  var collapseBtn = collapseTarget
    ? ('<button type="button" class="tertiary-action workspace-collapse-toggle"'
        + ' data-workspace-collapse-toggle="' + escapeHtml(collapseTarget) + '"'
        + ' aria-expanded="' + (collapsed ? 'false' : 'true') + '"'
        + ' data-open-label="Collapse" data-closed-label="Expand"'
        + ' title="' + escapeHtml(collapsed ? 'Expand workspace' : 'Collapse workspace') + '">'
        + escapeHtml(collapsed ? 'Expand' : 'Collapse')
        + '</button>')
    : '';

  return '<div class="inspector-workspace-head">'
    + '<div class="inspector-identity-row">'
    + '<div class="inspector-selected-line">'
    + '<code class="inspector-endpoint-code">' + escapeHtml(endpointLabel) + '</code>'
    + '<span class="inspector-issue-count" aria-label="' + escapeHtml(countLabel) + '">' + escapeHtml(countLabel) + '</span>'
    + '</div>'
    + collapseBtn
    + '</div>'
    + '</div>';
}

function inspectionShellFamilySurfaceHelpCopy(): string {
  if (state.activeTopTab === 'shape') {
    return '';
  }
  if (state.activeTopTab === 'workflow') {
    return 'Families ranked by workflow burden in the current slice: hidden dependencies, brittle sequencing, missing handoff IDs, and weak next-step cues.';
  }
  return state.activeTopTab === 'shape'
    ? 'Response Shape: families ranked by shape friction for the current slice.'
    : state.activeTopTab === 'workflow'
    ? 'Workflow Guidance: families ranked by visible workflow pressure for the current slice.'
    : 'Contract Issues: families ranked by visible contract evidence for the current slice.';
}

function inspectionShellBuildListContext(matches: number, total: number): string {
  var lens: string[] = [];
  if (state.filters.search) lens.push('\u201c' + state.filters.search + '\u201d');
  if (state.filters.category === 'spec-rule' && state.activeTopTab !== 'spec-rule') lens.push('rules-based view: spec rule');
  else if (state.filters.category !== 'all') lens.push('category: ' + state.filters.category.replaceAll('-', ' '));
  if (state.filters.familyPressure !== 'all') lens.push('pressure: ' + state.filters.familyPressure);

  var mode = state.filters.includeNoIssueRows ? 'all rows' : 'evidence-only';
  var visibleRows = filteredRows();
  var burdenExplanation = '';
  if (state.filters.category === 'spec-rule' && state.activeTopTab !== 'spec-rule') {
    var ruleGroups = aggregateSpecRuleFindings(filteredRows());
    var ruleBanner = renderSpecRuleBanner(ruleGroups, visibleRows.length);
    burdenExplanation = '<div class="burden-explanation spec-rule-explanation">'
      + ruleBanner
      + '<details class="spec-rule-details">'
      + '<summary>Show rule details</summary>'
      + '<p class="subtle spec-rule-details-copy"><strong>Contract Issues</strong> \u2014 findings backed by explicit OpenAPI rule language. REQUIRED / MUST violations are <strong>errors</strong>; SHOULD / RECOMMENDED concerns are <strong>warnings</strong>.</p>'
      + renderSpecRuleAggregate(ruleGroups)
      + '</details>'
      + '</div>';
  } else if (state.activeTopTab === 'workflow') {
    burdenExplanation = '<div class="burden-explanation">'
      + '<span class="evidence-track-label evidence-track-heuristic">Guidance view</span>'
      + '<strong>Workflow Guidance</strong> — family cards highlight cross-step continuity pressure that makes real call paths harder to complete safely.'
      + '<ul>'
      + '<li>Hidden token/context/header dependencies appear across steps.</li>'
      + '<li>Sequencing suggests brittle handoffs where the next required step is not clearly exposed.</li>'
      + '<li>Outcome guidance appears weak, so callers likely infer what to do next.</li>'
      + '<li>Endpoint rows provide supporting evidence and open inline diagnostics when selected.</li>'
      + '</ul>'
      + renderDynamicBurdenSignals(visibleRows, 'workflow-burden')
      + '</div>';
  } else if (state.activeTopTab === 'shape') {
    burdenExplanation = '<div class="burden-explanation">'
      + '<span class="evidence-track-label evidence-track-heuristic">Guidance view</span>'
      + '<strong>Response Shape</strong> — diagnoses real DX cost from storage-shaped payloads, not backend graph completeness.'
      + '<ul>'
      + '<li>Diagnose deep nesting, duplicated state, snapshot-heavy payloads, internal-field exposure, and unclear source-of-truth fields.</li>'
      + '<li>Diagnose missing outcome framing and missing next-action cues in shape-heavy responses.</li>'
      + '<li>Grouped deviations include OpenAPI location cues and show concrete schema locations for each finding.</li>'
      + '</ul>'
      + renderDynamicBurdenSignals(visibleRows, 'contract-shape')
      + '</div>';
  }

  var workflowTabActive = state.activeTopTab === 'workflow';
  var shapeTabActive = state.activeTopTab === 'shape';
  var guide = matches > 0
    ? (workflowTabActive
        ? 'Family cards summarize continuity pressure; selecting an endpoint opens inline diagnostics and grouped deviations.'
      : shapeTabActive
      ? 'Family cards rank response-shape burden; selecting an endpoint opens inline diagnostics and grouped deviations.'
        : 'Family cards group contract issues by family; selecting an endpoint opens grouped deviations with OpenAPI location cues.')
    : 'No rows match. Use the family no-match recovery above to widen the view.';

  var actionsHtml = (matches > 0 && !workflowTabActive && !shapeTabActive)
    ? '<div class="context-actions">'
      + '<button type="button" class="secondary-action" data-recovery-action="show-all-families">Show all families in current scope</button>'
      + '<button type="button" class="secondary-action" data-recovery-action="clear-table-filters">Clear table filters</button>'
      + '</div>'
    : '';

  return '<div class="context-block compact-context-block">'
    + '<p><strong>' + matches + ' / ' + total + '</strong> endpoints \u2014 ' + escapeHtml(mode)
    + (lens.length ? ' | filtered by: ' + escapeHtml(lens.join(', ')) : '') + '</p>'
    + burdenExplanation
    + '<p class="subtle">' + escapeHtml(guide) + '</p>'
    + actionsHtml
    + '</div>';
}

function inspectionShellRenderEndpointInspectionContent(
  detail: ExplorerEndpointDetail,
  options?: { openEvidence?: boolean }
): string {
  var opts = options || {};
  var findings = findingsForActiveLens(detail.findings || []);
  var endpoint = detail.endpoint || createEmptyEndpointRow();
  var familyName = endpoint.family || '';
  var groups = groupFindings(findings);
  var severity = dominantSeverity(findings);
  var topGroup = groups[0] || null;
  var relatedChains = detail.relatedChains || [];
  var endpointDetails = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails : {};
  var chainContext = buildChainContext(relatedChains, endpoint.id || state.selectedEndpointId, endpointDetails);

  var topMsg = topGroup && topGroup.messages[0] ? topGroup.messages[0] : 'No issue message extracted.';
  var topContext = topGroup ? topGroup.context : createEmptyOpenAPIContext();
  var contextBadge = buildContextTypeBadge(topContext);
  var cleanerHint = topGroup ? dimensionCleanerHint(topGroup.dimension) : '';
  var leadNotes = '';

  if (topGroup && (topGroup.impact || cleanerHint)) {
    leadNotes = '<details class="lead-finding-notes">'
      + '<summary>Why this matters' + (cleanerHint ? ' and what to change in the contract' : '') + '</summary>'
      + '<div class="lead-finding-notes-body">'
      + (topGroup.impact ? '<p class="lead-finding-impact"><strong>Why this is problematic:</strong> ' + escapeHtml(topGroup.impact) + '</p>' : '')
      + (cleanerHint ? '<p class="lead-finding-cleaner"><strong>Direct contract edit:</strong> ' + escapeHtml(cleanerHint) + '</p>' : '')
      + '</div>'
      + '</details>';
  }

  var workflowExample = renderWorkflowShapedExample(detail, findings);
  var openDrawer = !!opts.openEvidence;

  var html = ''
    + '<div class="detail-hero pressure-' + endpoint.priority + '">'
    + '  <div class="detail-hero-head">'
    + '    <div>'
    + '      <strong class="detail-path">' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>'
    + '      <div class="detail-subline">' + escapeHtml(endpointIntentCue(endpoint.method, endpoint.path)) + ' | ' + escapeHtml(humanFamilyLabel(endpoint.family || '')) + '</div>'
    + '    </div>'
    + '    <div class="detail-badges">'
    +        pressureBadge(endpoint.priority || '', 'pressure')
    +        severityBadge(severity)
    + '    </div>'
    + '  </div>'
    + '  <div class="lead-finding">'
    + '    <div class="lead-finding-head">'
    +        contextBadge
    + '    </div>'
    + '    <p class="lead-finding-message">' + escapeHtml(topMsg) + '</p>'
    + '    <div class="lead-finding-grounding">'
    +        renderOpenAPILocationCuesBlock(topContext, false)
    +        (topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '')
    +    '</div>'
    + leadNotes
    + '  </div>'
    + '</div>';

  if (workflowExample) {
    html += workflowExample;
  }

  html += renderFullExactEvidenceDrawer(groups, { endpoint: endpoint, familyName: familyName, open: openDrawer });

  if (chainContext) {
    html += chainContext;
  }

  return html;
}

function inspectionShellSyncSelectedEndpointHighlight(): void {
  if (!el.familySurface) return;

  Array.prototype.forEach.call(el.familySurface.querySelectorAll('.family-row.row-selected, .endpoint-subrow.row-selected, .nested-endpoint-row.row-selected'), function (row: Element) {
    row.classList.remove('row-selected');
  });
  Array.prototype.forEach.call(el.familySurface.querySelectorAll('tr[data-family-row="true"].row-has-selected-child'), function (row: Element) {
    row.classList.remove('row-has-selected-child');
  });

  if (!state.selectedEndpointId) return;

  var endpointDetails = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails : {};
  var selectedDetail = endpointDetails[state.selectedEndpointId];
  var selectedFamilyName = selectedDetail && selectedDetail.endpoint ? (selectedDetail.endpoint.family || '') : '';

  var selectedSubrow = el.familySurface.querySelector('.nested-endpoint-row[data-endpoint-id="' + state.selectedEndpointId + '"], .endpoint-subrow[data-endpoint-id="' + state.selectedEndpointId + '"]') as HTMLElement | null;
  if (selectedSubrow) {
    selectedSubrow.classList.add('row-selected');
    var ownerFamily = selectedSubrow.getAttribute('data-family') || selectedFamilyName;
    if (ownerFamily) {
      var ownerRow = el.familySurface.querySelector('tr[data-family="' + ownerFamily + '"][data-family-row="true"]') as HTMLElement | null;
      if (ownerRow) ownerRow.classList.add('row-has-selected-child');
    }
    return;
  }
  if (selectedFamilyName) {
    var familyRow = el.familySurface.querySelector('tr[data-family="' + selectedFamilyName + '"][data-family-row="true"]') as HTMLElement | null;
    if (familyRow) familyRow.classList.add('row-selected');
  }
}

function inspectionShellEndpointHasWorkflowBurden(detail: ExplorerEndpointDetail | null | undefined): boolean {
  if (state.activeTopTab !== 'workflow') return false;
  if (!detail) return false;
  if ((detail.relatedChains || []).length) return true;
  var findings = detail.findings || [];
  return findings.some(function (f) {
    if (!f) return false;
    if (f.burdenFocus === 'workflow-burden') return true;
    var code = f.code || '';
    return code === 'prerequisite-task-burden'
      || code === 'weak-follow-up-linkage'
      || code === 'weak-action-follow-up-linkage'
      || code === 'weak-accepted-tracking-linkage'
      || code === 'weak-outcome-next-action-guidance'
      || code === 'contract-shape-workflow-guidance-burden';
  });
}

function inspectionShellRenderInspectorWorkflowContextSupport(
  detail: ExplorerEndpointDetail,
  options?: { defaultOpen?: boolean }
): string {
  var opts = options || {};
  if (!inspectionShellEndpointHasWorkflowBurden(detail)) return '';

  var chainCount = (detail.relatedChains || []).length;
  var hasChain = chainCount > 0;
  var summaryMeta = hasChain
    ? (chainCount + ' chain' + (chainCount === 1 ? '' : 's'))
    : 'no inferred chain';

  var defaultOpen = !!opts.defaultOpen;
  var open = (typeof state.inspectorWorkflowContextOpen === 'boolean')
    ? state.inspectorWorkflowContextOpen
    : defaultOpen;
  var openAttr = open ? ' open' : '';
  var bodyHtml = hasChain
    ? renderWorkflowChainContextForEndpoint(detail)
    : '<div class="family-insight-card"><p class="subtle">Workflow burden signals exist for this endpoint, but it is not currently linked to an inferred call chain in this payload.</p></div>';

  return '<details class="detail-evidence-drawer inspector-workflow-context-drawer"' + openAttr + ' data-inspector-workflow-context="1">'
    + '<summary>Workflow chain context (' + escapeHtml(summaryMeta) + ')</summary>'
    + '<div class="workspace-section-body">'
    + '<p class="subtle">Use this when the contract forces hidden handoffs or unclear next steps. Steps are linked to inline endpoint diagnostics.</p>'
    + bodyHtml
    + '</div>'
    + '</details>';
}

function inspectionShellRenderCommonWorkflowJourneys(chains: ExplorerWorkflowChain[] | null | undefined): string {
  var allChains = (chains && chains.length) ? chains : viewScopePayloadWorkflowChains();
  if (!allChains.length) return '';

  var byKind: StringMap<ExplorerWorkflowChain[]> = {};
  allChains.forEach(function (chain) {
    var kind = chain.kind || 'workflow';
    if (!byKind[kind]) byKind[kind] = [];
    byKind[kind].push(chain);
  });

  var journeyPatterns = Object.keys(byKind)
    .map(function (kind) {
      var kindChains = byKind[kind];
      var totalBurden = kindChains.reduce(function (sum, chain) { return sum + workflowSurfaceChainBurdenScore(chain); }, 0);
      return { kind: kind, chains: kindChains, totalBurden: totalBurden };
    })
    .filter(function (entry) { return entry.totalBurden > 0; })
    .sort(function (a, b) { return b.totalBurden - a.totalBurden; })
    .slice(0, 4);

  if (!journeyPatterns.length) return '';

  var journeyHtml = journeyPatterns.map(function (pattern) {
    return workflowJourneyRenderGuidance(
      pattern.kind,
      pattern.chains,
      workflowJourneyAnalyzePattern(
        pattern.kind,
        pattern.chains,
        viewScopePayloadEndpointDetails(),
        workflowSurfaceParseChainRoles,
        workflowSurfaceCollectBurdenSummary,
        workflowStepBuildDependencyClues,
        workflowSurfaceHumanizeStepRole
      ),
      workflowSurfaceKindGroupLabel(pattern.kind),
      pattern.totalBurden,
      escapeHtml
    );
  }).join('');

  return '<div class="workflow-journeys-section">'
    + '<div class="workflow-journeys-header">'
    + '<p class="workflow-journeys-kicker">Common workflow journeys</p>'
    + '<p class="workflow-journeys-copy">Problem-finding guide for developers. Identifies where the contract fails to guide you through each workflow and what a workflow-first contract must expose.</p>'
    + '</div>'
    + journeyHtml
    + '</div>';
}

function inspectionShellAnalyzeWorkflowPattern(kind: string, chains: ExplorerWorkflowChain[]) {
  return workflowJourneyAnalyzePattern(
    kind,
    chains,
    viewScopePayloadEndpointDetails(),
    workflowSurfaceParseChainRoles,
    workflowSurfaceCollectBurdenSummary,
    workflowStepBuildDependencyClues,
    workflowSurfaceHumanizeStepRole
  );
}

function inspectionShellRenderWorkflowJourneyGuidance(kind: string, chains: ExplorerWorkflowChain[]): string {
  var totalBurden = chains.reduce(function (sum, chain) { return sum + workflowSurfaceChainBurdenScore(chain); }, 0);
  var analysis = inspectionShellAnalyzeWorkflowPattern(kind, chains);
  return workflowJourneyRenderGuidance(kind, chains, analysis, workflowSurfaceKindGroupLabel(kind), totalBurden, escapeHtml);
}

function inspectionShellRenderWorkflowJourneyProblems(problems): string {
  return workflowJourneyRenderProblems(problems, escapeHtml);
}

function inspectionShellRenderWorkflowJourneyContractGaps(gaps): string {
  return workflowJourneyRenderContractGaps(gaps, escapeHtml);
}

function inspectionShellRenderWorkflowJourneyProposal(kind: string, analysis): string {
  return workflowJourneyRenderProposal(kind, analysis, escapeHtml);
}
