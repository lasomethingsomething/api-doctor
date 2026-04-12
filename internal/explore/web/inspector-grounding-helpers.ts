declare var state: ExplorerState;

declare function createEmptyOpenAPIContext(): OpenAPIContext;
declare function buildChainContext(
  chains: ExplorerWorkflowChain[],
  endpointId: string,
  endpointDetails: StringMap<ExplorerEndpointDetail>
): string;
declare function collectShapePainSignals(endpoint: ExplorerEndpointRow, findings: ExplorerFinding[]): ShapePainSignal[];
declare function collectShapeSignalTotalsForDetail(detail: ExplorerEndpointDetail): ShapeSignalTotals;
declare function dominantSeverity(findings: ExplorerFinding[]): string;
declare function endpointIntentCue(method: string, path: string): string;
declare function exactEvidenceTargetLabel(): string;
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function formatIssueGroupCountLabel(group: IssueGroup): string;
declare function groupFindings(findings: ExplorerFinding[]): IssueGroup[];
declare function humanFamilyLabel(name: string): string;
declare function issueScopeLabelForKey(groupKey: string, familyName: string): string;
declare function pressureBadge(priority: string, kind?: string): string;
declare function renderFullExactEvidenceDrawer(
  groups: IssueGroup[],
  options?: { endpoint?: ExplorerEndpointRow; familyName?: string; open?: boolean }
): string;
declare function renderInspectorContractShapeComparison(
  detail: ExplorerEndpointDetail,
  findings: ExplorerFinding[],
  options?: { title?: string; context?: string }
): string;
declare function renderOpenAPIContextPills(context: OpenAPIContext, compact?: boolean): string;
declare function renderOpenAPILocationCuesBlock(context: OpenAPIContext, compact?: boolean): string;
declare function renderShapePainSignals(signals: ShapePainSignal[]): string;
declare function renderSpecRuleGroundingForGroup(group: IssueGroup): string;
declare function renderTrapGuidanceList(
  traps: WorkflowTrapGuidance[],
  options?: { title?: string; className?: string; limit?: number }
): string;
declare function severityBadge(severity: string): string;
declare function topOpenAPIHighlights(groups: IssueGroup[]): string[];
declare function collectTrapGuidance(
  endpoint: ExplorerEndpointRow,
  findings: ExplorerFinding[],
  clues: WorkflowDependencyClues,
  roles: string[],
  hiddenTransitions: string[],
  chain: ExplorerWorkflowChain | null,
  roleLabel: string,
  isFinalStep: boolean
): WorkflowTrapGuidance[];
declare function escapeHtml(value: unknown): string;

function inspectorRenderEndpointDiagnosticsSummary(detail: ExplorerEndpointDetail): string {
  var findings = findingsForActiveLens(detail.findings || []);
  var endpoint = detail.endpoint || createEmptyEndpointRow();
  var groups = groupFindings(findings);
  var topGroup = groups[0] || null;
  var topContext = topGroup ? topGroup.context : createEmptyOpenAPIContext();
  var severity = dominantSeverity(findings);
  var contextBadge = uiBuildContextTypeBadge(topContext);
  var openApiBlock = renderOpenAPILocationCuesBlock(topContext, true);
  var specGrounding = topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '';
  var groundingBits = '';
  groundingBits += openApiBlock;
  if (specGrounding) {
    groundingBits += specGrounding;
  }
  var groundingHtml = groundingBits
    ? ('    <div class="lead-finding-grounding">' + groundingBits + '</div>')
    : '';

  return '<div class="endpoint-diag-pane">'
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
    + '    <div class="lead-finding-head">' + contextBadge + '</div>'
    + '    <p class="lead-finding-message">' + escapeHtml(topGroup && topGroup.messages[0] ? topGroup.messages[0] : 'No issue message extracted.') + '</p>'
    + groundingHtml
    + '  </div>'
    + '</div>'
    + '</div>';
}

function inspectorRenderEndpointDiagnosticsShapeSummary(detail: ExplorerEndpointDetail): string {
  var endpoint = detail.endpoint || createEmptyEndpointRow();
  var findings = findingsForActiveLens(detail.findings || []);
  var groups = groupFindings(findings);
  var topGroup = groups[0] || null;
  var shapeTotals = collectShapeSignalTotalsForDetail(detail);

  var painSignals = collectShapePainSignals(endpoint, findings);
  var painHtml = renderShapePainSignals(painSignals);

  var comparisonHtml = renderInspectorContractShapeComparison(detail, findings, {
    title: 'Current response shape vs better workflow-first response shape',
    context: 'shape'
  });

  var guidance = collectTrapGuidance(endpoint, findings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, '', false);
  var guidanceHtml = renderTrapGuidanceList(guidance, {
    title: 'Shape trap guidance',
    className: 'inspector-trap-guidance',
    limit: 3
  });

  var profileItems = [
    { key: 'deep', label: 'deep nesting', val: shapeTotals.deep },
    { key: 'dup', label: 'duplicated state', val: shapeTotals.dup },
    { key: 'internal-fields', label: 'incidental/internal fields', val: shapeTotals.internal },
    { key: 'snapshot-heavy', label: 'snapshot-heavy response', val: shapeTotals.snapshot },
    { key: 'missing-outcome', label: 'missing outcome framing', val: shapeTotals.outcome },
    { key: 'missing-next-action', label: 'missing next-action cues', val: shapeTotals.nextAction }
  ].filter(function (item) { return item.val > 0; });

  var profileHtml = profileItems.length
    ? '<div class="shape-profile-row">'
        + profileItems.map(function (item) {
            return '<span class="shape-profile-chip">'
              + '<strong>' + item.val + '</strong> ' + escapeHtml(item.label)
              + '</span>';
          }).join('')
        + '</div>'
    : '';

  var locationHighlights = topOpenAPIHighlights(groups).slice(0, 3);
  var locationHtml = locationHighlights.length
    ? '<p class="shape-location-hint">Schema locations with most signals: '
        + locationHighlights.map(function (location) { return '<code>' + escapeHtml(location) + '</code>'; }).join(' · ')
        + '</p>'
    : '';

  var noSignalsHtml = !painSignals.length
    ? '<div class="family-insight-card">'
        + '<p class="insight-kicker">Endpoint-local shape evidence</p>'
        + '<p class="subtle"><strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong> has '
        + findings.length + ' shape finding' + (findings.length === 1 ? '' : 's')
        + ' grouped into ' + groups.length + ' cluster' + (groups.length === 1 ? '' : 's')
        + '. No specific pain-signal pattern matched in this slice — use response-shape burden evidence below for the raw grouped messages.</p>'
        + (topGroup
            ? '<p class="subtle"><strong>Lead cluster:</strong> ' + escapeHtml(formatIssueGroupCountLabel(topGroup)) + '</p>'
            : '')
        + '</div>'
    : '';

  return '<div class="endpoint-diag-pane">'
    + '<div class="shape-summary-intro">'
    + '<p class="shape-summary-kicker">Why this response is hard to use</p>'
    + '<p class="shape-summary-head"><strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong> — '
    + (painSignals.length
        ? escapeHtml(painSignals.length + ' active DX pain signal' + (painSignals.length === 1 ? '' : 's') + ' detected')
        : 'shape signals present — see profile below')
    + '</p>'
    + profileHtml
    + locationHtml
    + '</div>'
    + noSignalsHtml
    + painHtml
    + comparisonHtml
    + guidanceHtml
    + renderFullExactEvidenceDrawer(groups, { endpoint: endpoint, familyName: endpoint.family || '', open: false })
    + '</div>';
}

function inspectorRenderEndpointDiagnosticsExact(detail: ExplorerEndpointDetail): string {
  var findings = findingsForActiveLens(detail.findings || []);
  var endpoint = detail.endpoint || createEmptyEndpointRow();
  var familyName = endpoint.family || '';
  var groups = groupFindings(findings);
  var openDrawer = state.detailEvidenceOpenForId === state.selectedEndpointId;

  return '<div class="endpoint-diag-pane">'
    + renderFullExactEvidenceDrawer(groups, { endpoint: endpoint, familyName: familyName, open: openDrawer })
    + inspectorRenderGroundingAndFlowContext(detail)
    + '</div>';
}

function inspectorRenderGroundingAndFlowContext(detail: ExplorerEndpointDetail): string {
  var specRuleTabActive = state.activeTopTab === 'spec-rule';
  var workflowTabActive = state.activeTopTab === 'workflow';
  var endpoint = detail.endpoint || createEmptyEndpointRow();
  var findings = findingsForActiveLens(detail.findings || []);
  var groups = groupFindings(findings);
  var topGroup = groups[0] || null;
  var topContext = topGroup ? topGroup.context : createEmptyOpenAPIContext();
  var endpointDetails = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails : {};
  var chainContext = (workflowTabActive && !specRuleTabActive)
    ? buildChainContext(detail.relatedChains || [], endpoint.id || state.selectedEndpointId, endpointDetails)
    : '';
  var scopeFamilyName = endpoint.family || '';
  var scopeLabel = topGroup ? issueScopeLabelForKey(topGroup.groupKey || '', scopeFamilyName) : '';
  var inspectTarget = topGroup ? (inspectTargetForGroup(topGroup, endpoint) || topGroup.inspectHint || '') : '';
  var schemaClues = topOpenAPIHighlights(groups).slice(0, 4);
  var openApiPills = renderOpenAPIContextPills(topContext, true);
  var specGrounding = topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '';
  var groundingHtml = (openApiPills || specGrounding)
    ? ('<div class="family-insight-grounding">' + openApiPills + specGrounding + '</div>')
    : '';

  var leadMessage = topGroup && topGroup.messages && topGroup.messages[0]
    ? topGroup.messages[0]
    : (findings[0] && findings[0].message ? findings[0].message : 'No issue message extracted.');
  var whyMatters = topGroup && topGroup.impact
    ? topGroup.impact
    : (topGroup ? dimensionImpact(topGroup.dimension) : 'Why-it-matters context was not available for this endpoint.');
  var schemaClueHtml = schemaClues.length
    ? ('<p class="subtle grounding-clues"><strong>Schema clues:</strong> '
        + schemaClues.map(function (location) { return '<code>' + escapeHtml(location) + '</code>'; }).join(' · ')
        + '</p>')
    : '<p class="subtle grounding-clues"><strong>Schema clues:</strong> No stable OpenAPI location hint was extracted from the grouped messages.</p>';
  var summaryGrid = '<div class="grounding-summary-grid">'
    + '<div class="grounding-summary-item"><span class="grounding-summary-label">Evidence target</span><span class="grounding-summary-value">' + escapeHtml(exactEvidenceTargetLabel()) + '</span></div>'
    + (scopeLabel ? ('<div class="grounding-summary-item"><span class="grounding-summary-label">Scope</span><span class="grounding-summary-value">' + escapeHtml(scopeLabel) + '</span></div>') : '')
    + (inspectTarget ? ('<div class="grounding-summary-item grounding-summary-item-wide"><span class="grounding-summary-label">Inspect in schema</span><span class="grounding-summary-value"><code>' + escapeHtml(inspectTarget) + '</code></span></div>') : '')
    + '</div>';

  var schemaSection = '<section class="detail-section detail-section-tight">'
    + '<h3>Schema grounding</h3>'
    + '<div class="family-insight-card">'
    + summaryGrid
    + '<p class="family-insight-lead-message">' + escapeHtml(leadMessage) + '</p>'
    + schemaClueHtml
    + '<p class="subtle grounding-why"><strong>Why it matters:</strong> ' + escapeHtml(whyMatters) + '</p>'
    + (groundingHtml ? groundingHtml : '<p class="subtle">No OpenAPI location cues or spec-rule grounding were available for the lead message.</p>')
    + '</div>'
    + '</section>';

  var workflowSection = '';
  if (workflowTabActive && !specRuleTabActive) {
    workflowSection = chainContext
      ? '<section class="detail-section detail-section-tight"><h3>Workflow context</h3>' + chainContext + '</section>'
      : '<section class="detail-section detail-section-tight"><h3>Workflow context</h3>'
          + '<p class="subtle">No inferred workflow chain includes this endpoint in the current view. If this endpoint participates in a multi-step client flow, that linkage is not being exposed clearly by the contract signals we extracted.</p>'
          + '</section>';
  }

  return '<details class="detail-evidence-drawer">'
    + '<summary>' + ((specRuleTabActive || !workflowTabActive) ? 'Schema grounding' : 'Schema grounding and workflow context') + '</summary>'
    + '<div class="details-close-row"><button type="button" class="tertiary-action details-close-btn" data-close-details="1" aria-label="Hide grounding" title="Hide grounding">Hide grounding</button></div>'
    + schemaSection
    + workflowSection
    + '</details>';
}

function inspectorRenderContentMap(): string {
  var workflowTabActive = state.activeTopTab === 'workflow';
  var shapeTabActive = state.activeTopTab === 'shape';
  var mapping = workflowTabActive
    ? 'Workflow Guidance inspector: Continuity summary = step-position context, hidden deps, traps. Grouped deviations = evidence grouped by schema field + issue type.'
    : shapeTabActive
    ? 'Response Shape inspector: Shape pain = per-signal DX analysis + caller-needed. Contract improvements = exact response/schema edits. Grouped deviations = evidence grouped by schema field + issue type.'
    : 'Contract Issues inspector: OpenAPI rule violations (REQUIRED vs SHOULD) + consistency drift. Grouped deviations = evidence grouped by schema field + issue type.';
  return '<p class="subtle inspector-content-map-inline"><strong>Inspector scope:</strong> ' + escapeHtml(mapping) + '</p>';
}
