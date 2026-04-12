var state = createInitialExplorerState();

var el = createExplorerElements(document);

  el.familySurfaceSection = el.familySurface ? el.familySurface.closest('.section') : null;
  el.endpointListSection = el.endpointRows ? el.endpointRows.closest('.section') : null;

  fetch("/api/payload")
    .then(function (res) { return res.json(); })
		    .then(function (payload) {
		      state.payload = payload;
		      // Default to no selected endpoint. Selection should be user-driven via "Inspect endpoint"
		      // so row highlighting never sticks to an arbitrary auto-picked row.
		      state.selectedEndpointId = "";
		      state.userSelectedEndpoint = false;
		      bindControls();
		      renderFilterOptions();
		      render();
		    });

  function enforceSpecRuleTabFilterModel() {
    viewScopeEnforceSpecRuleTabFilterModel();
  }

  function enforceWorkflowTabFilterModel() {
    viewScopeEnforceWorkflowTabFilterModel();
  }

  function enforceShapeTabFilterModel() {
    viewScopeEnforceShapeTabFilterModel();
  }

  function normalizeSelectedEndpointForCurrentView() {
    viewScopeNormalizeSelectedEndpointForCurrentView();
  }

	  function payloadEndpointDetails(): StringMap<ExplorerEndpointDetail> {
	    return viewScopePayloadEndpointDetails();
	  }

	  function payloadWorkflowChains(): ExplorerWorkflowChain[] {
	    return viewScopePayloadWorkflowChains();
	  }

	  function lensFindingCountForRow(row: ExplorerEndpointRow | null | undefined): number {
	    return viewScopeLensFindingCountForRow(row);
	  }

	  function hasValidSelectedEndpointInCurrentView(): boolean {
	    return viewScopeHasValidSelectedEndpointInCurrentView();
	  }

		  function selectionRowsForActiveView(): ExplorerEndpointRow[] {
		    return viewScopeSelectionRowsForActiveView();
		  }

	  function issueScopeIndexCacheKey(): string {
	    return viewScopeIssueScopeIndexCacheKey();
	  }

	  function findingGroupKey(finding: ExplorerFinding): string {
	    return viewScopeFindingGroupKey(finding);
	  }

	  function buildIssueScopeIndexForCurrentView(): IssueScopeIndex {
	    return viewScopeBuildIssueScopeIndexForCurrentView();
	  }

	  function getIssueScopeIndex(): IssueScopeIndex {
	    return viewScopeGetIssueScopeIndex();
	  }

	  function issueScopeLabelForKey(groupKey: string, familyName: string): string {
	    return viewScopeIssueScopeLabelForKey(groupKey, familyName);
	  }

  function renderEndpointDiagnosticsSummary(detail) {
    return inspectorRenderEndpointDiagnosticsSummary(detail);
  }

  function renderCommonWorkflowJourneys(chains: ExplorerWorkflowChain[] | null | undefined): string {
    return inspectionShellRenderCommonWorkflowJourneys(chains);
	  }

  function renderWorkflowJourneyGuidance(kind, chains) {
    return inspectionShellRenderWorkflowJourneyGuidance(kind, chains);
  }

  function analyzeWorkflowPattern(kind, chains) {
    return inspectionShellAnalyzeWorkflowPattern(kind, chains);
  }

  function renderWorkflowJourneyProblems(problems) {
    return inspectionShellRenderWorkflowJourneyProblems(problems);
  }

  function renderWorkflowJourneyContractGaps(gaps) {
    return inspectionShellRenderWorkflowJourneyContractGaps(gaps);
  }

  function renderWorkflowJourneyProposal(kind, analysis) {
    return inspectionShellRenderWorkflowJourneyProposal(kind, analysis);
  }

	  function renderEndpointDiagnosticsShapeSummary(detail) {
      return inspectorRenderEndpointDiagnosticsShapeSummary(detail);
	  }

				  function renderEndpointDiagnosticsExact(detail) {
					    return inspectorRenderEndpointDiagnosticsExact(detail);
			  }

		  function renderInspectorGroundingAndFlowContext(detail) {
        return inspectorRenderGroundingAndFlowContext(detail);
			  }

		  function renderInspectorContentMap() {
        return inspectorRenderContentMap();
		  }

  function renderEndpointDiagnosticsCleaner(detail) {
    return diagnosticsRenderCleaner(detail, {
      findingsForActiveLens: findingsForActiveLens,
      buildContractImprovementItems: buildContractImprovementItems,
      collectShapePainSignals: collectShapePainSignals,
      escapeHtml: escapeHtml
    });
  }

  function buildContractImprovementItems(detail, findings) {
    return contractImprovementBuildItems(detail, findings, contractImprovementItemForFinding);
  }

	  function describeImprovementWhere(context, fallback) {
	    return contractImprovementDescribeWhere(context, fallback);
	  }

	  function openApiOperationPointer(endpoint) {
	    return openApiTargetOperationPointer(endpoint);
	  }

	  function openApiResponseObjectPointer(endpoint, statusCode) {
	    return openApiTargetResponseObjectPointer(endpoint, statusCode);
	  }

	  function openApiResponseSchemaPointer(endpoint, context) {
	    return openApiTargetResponseSchemaPointer(endpoint, context);
	  }

	  function openApiRequestSchemaPointer(endpoint, context) {
	    return openApiTargetRequestSchemaPointer(endpoint, context);
	  }

	  function formatWhereWithOpenAPITarget(endpoint, context, opts) {
	    return openApiTargetFormatWhere(endpoint, context, opts);
	  }

	  function contractImprovementItemForFinding(finding, endpoint) {
	    return contractImprovementBuildItemForFinding(finding, endpoint, {
	      extractOpenAPIContext: extractOpenAPIContext,
	      formatWhereWithOpenAPITarget: formatWhereWithOpenAPITarget,
	      openApiOperationPointer: openApiOperationPointer,
	      openApiResponseObjectPointer: openApiResponseObjectPointer,
	      specRuleWhy: SPEC_RULE_WHY
	    });
	  }

  function renderEndpointDiagnosticsConsistency(detail) {
    return diagnosticsRenderConsistency(detail, {
      consistencyFindingsForDetail: consistencyFindingsForDetail,
      selectedEndpointId: state.selectedEndpointId,
      payload: state.payload,
      escapeHtml: escapeHtml,
      humanFamilyLabel: humanFamilyLabel
    });
  }

  function renderConsistencySupportCard(detail, options) {
    return diagnosticsRenderConsistencySupportCard(detail, options, {
      consistencyFindingsForDetail: consistencyFindingsForDetail,
      escapeHtml: escapeHtml
    });
  }

	  function syncControls() {
    appRuntimeSyncControls();
	  }

					  function selectEndpointForInspector(endpointId, subTab) {
					    appRuntimeSelectEndpointForInspector(endpointId, subTab);
					  }

	  function endpointRowForId(endpointId: string): ExplorerEndpointRow | null {
	    return appRuntimeEndpointRowForId(endpointId);
	  }

	  function endpointDetailForId(endpointId: string): ExplorerEndpointDetail | null {
	    return appRuntimeEndpointDetailForId(endpointId);
	  }

	  function activeTopTabLabel() {
	    return inspectionShellActiveTopTabLabel();
	  }

  function formatScopeValue(value, fallback) {
    return viewScopeFormatScopeValue(value, fallback);
  }

  function renderFilterEmptyState() {
    viewScopeRenderFilterEmptyState();
  }

	  function renderWhatToDoNextBlock(endpoint, findings, options) {
	    return diagnosticsRenderWhatToDoNextBlock(endpoint, findings, options, {
	      escapeHtml: escapeHtml,
	      collectConcreteNextActions: collectConcreteNextActions
	    });
	  }

			  function renderInspectorWorkspaceHeader(detail, findings, options) {
			    return inspectionShellRenderInspectorWorkspaceHeader(detail, findings, options);
			  }

	  function collectConcreteNextActions(endpoint, findings) {
	    return diagnosticsCollectConcreteNextActions(endpoint, findings, {
	      findingsForActiveLens: findingsForActiveLens,
	      extractOpenAPIContext: extractOpenAPIContext,
	      buildContractImprovementItems: buildContractImprovementItems
	    });
	  }

	  function familySurfaceHelpCopy() {
	    return inspectionShellFamilySurfaceHelpCopy();
  }

  function renderWorkflowChains() {
    workflowSurfaceRenderChains();
	  }

		  function renderWorkflowChainsDrawer(innerHtml: string, chainCount: number): string {
		    return workflowSurfaceRenderChainsDrawer(innerHtml, chainCount);
		  }

		  function bindWorkflowChainsDrawerToggle(): void {
		    workflowSurfaceBindChainsDrawerToggle();
		  }

	  function renderWorkflowGuideSection(chains: ExplorerWorkflowChain[]): string {
	    return workflowSurfaceRenderGuideSection(chains);
  }

  function renderWorkflowGuideCard(chain: ExplorerWorkflowChain, isLead: boolean): string {
    return workflowSurfaceRenderGuideCard(chain, isLead);
  }

  function bindWorkflowStepInteractions(): void {
    workflowSurfaceBindStepInteractions();
  }

  function syncWorkflowStepSelectionHighlight(): void {
    workflowSurfaceSyncStepSelectionHighlight();
  }

  function renderWorkflowEmptyState(mode: string): string {
    return workflowSurfaceRenderEmptyState(mode);
  }

  function groupChainsByKind(
    chains: ExplorerWorkflowChain[],
    options?: { focusChainId?: string }
  ): WorkflowKindGroup[] {
    return workflowSurfaceGroupChainsByKind(chains, options);
  }

  function chainBurdenScore(chain: ExplorerWorkflowChain): number {
    return workflowSurfaceChainBurdenScore(chain);
  }

  function parseChainRoles(summary: string | undefined, count?: number): string[] {
    return workflowSurfaceParseChainRoles(summary, count);
  }

  function humanizeStepRole(roleSlug: string): string {
    return workflowSurfaceHumanizeStepRole(roleSlug);
  }

  var KIND_GROUP_LABEL = {
    'list-detail':             'Browse then inspect',
    'list-detail-update':      'Browse, inspect, and update',
    'list-detail-action':      'Browse, inspect, and act',
    'list-detail-create':      'Browse, inspect, and create',
    'create-detail':           'Create then inspect',
    'create-detail-update':    'Create then refine',
    'create-detail-action':    'Create then act',
    'action-follow-up':        'Act and follow up',
    'media-detail-follow-up':  'Upload then follow up',
    'order-detail-action':     'Submit then confirm'
  };

  function kindGroupLabel(kind: string): string {
    return workflowSurfaceKindGroupLabel(kind);
  }

  function chainTaskLabel(chain: ExplorerWorkflowChain): string {
    return workflowSurfaceChainTaskLabel(chain);
  }

  function chainResourceLabel(chain: ExplorerWorkflowChain): string {
    return workflowSurfaceChainResourceLabel(chain);
  }

  function formatWorkflowStepRefs(indices: number[]): string {
    return workflowSurfaceFormatStepRefs(indices);
  }

  function collectWorkflowBurdenSummary(chain: ExplorerWorkflowChain, roles: string[]): WorkflowBurdenSummaryItem[] {
    return workflowSurfaceCollectBurdenSummary(chain, roles);
  }

  function renderWorkflowBurdenSummary(chain: ExplorerWorkflowChain, roles: string[]): string {
    return workflowSurfaceRenderBurdenSummary(chain, roles);
  }

  function renderWorkflowKindGroup(group: WorkflowKindGroup): string {
    return workflowSurfaceRenderKindGroup(group);
  }

  function renderWorkflowChain(chain: ExplorerWorkflowChain, isPrimary: boolean): string {
    return workflowSurfaceRenderChain(chain, isPrimary);
  }

  function addUniqueClue(list: string[], text: string): void {
    workflowSurfaceAddUniqueClue(list, text);
  }

  function firstClues(list: string[], limit: number): string[] {
    return workflowSurfaceFirstClues(list, limit);
  }

  function renderWorkflowDependencyClues(clues: WorkflowDependencyClues | null | undefined): string {
    return workflowSurfaceRenderDependencyClues(clues);
  }

  function inferWorkflowCueSubject(text: string): string {
    return workflowSurfaceInferCueSubject(text);
  }

  function inferWorkflowTransitionCue(clues: WorkflowDependencyClues, roleLabel: string): WorkflowTransitionCue | null {
    return workflowSurfaceInferTransitionCue(clues, roleLabel);
  }

  function buildWorkflowDependencyClues(
    endpoint: ExplorerEndpointRow,
    findings: ExplorerFinding[],
    stepIndex: number,
    totalSteps: number,
    roleLabel: string,
    nextEndpoint: ExplorerEndpointRow | null,
    nextRoleLabel: string,
    linkageFindings: ExplorerFinding[],
    prerequisiteFindings: ExplorerFinding[]
  ): WorkflowDependencyClues {
    return workflowStepBuildDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings);
  }

  function collectTrapGuidance(
    endpoint: ExplorerEndpointRow,
    findings: ExplorerFinding[],
    clues: WorkflowDependencyClues,
    linkageFindings: ExplorerFinding[],
    prerequisiteFindings: ExplorerFinding[],
    nextEndpoint: ExplorerEndpointRow | null,
    roleLabel: string,
    isLast: boolean
  ): WorkflowTrapGuidance[] {
    return workflowStepCollectTrapGuidance(endpoint, findings, clues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast);
  }

  function renderTrapGuidanceList(traps, options) {
    return workflowStepRenderTrapGuidanceList(traps, options);
  }

	  function summarizeWorkflowStepNarrative(
      endpoint: ExplorerEndpointRow,
      roleLabel: string,
      nextEndpoint: ExplorerEndpointRow | null,
      clues: WorkflowDependencyClues,
      findings: ExplorerFinding[],
      linkageFindings: ExplorerFinding[],
      prerequisiteFindings: ExplorerFinding[],
      isLast: boolean
    ): WorkflowStepNarrative {
      return workflowStepSummarizeNarrative(endpoint, roleLabel, nextEndpoint, clues, findings, linkageFindings, prerequisiteFindings, isLast);
	  }

  function renderWorkflowStep(
    endpointId: string,
    stepIndex: number,
    totalSteps: number,
    roleLabel: string,
    nextEndpointId: string,
    nextRoleLabel: string
  ): string {
    return workflowStepRender(endpointId, stepIndex, totalSteps, roleLabel, nextEndpointId, nextRoleLabel);
  }

  var BURDEN_DIM_CHIP = {
    'workflow outcome weakness': 'missing next action',
    'hidden dependency / linkage burden': 'hidden dependency',
    'shape / storage-style response weakness': 'storage-shaped response',
    'shape / nesting complexity': 'deep nesting',
    'internal/incidental fields': 'incidental fields',
    'typing/enum weakness': 'weak typing',
    'consistency drift': 'path/param drift',
    'change-risk clues': 'change risk'
  };

		  function bestEndpointIdForFamily(familyName) {
		    return familyInsightBestEndpointIdForFamily(familyName);
		  }

			  function buildFamilyRankedSummary(family): ExplorerFamilyRankedSummary {
			    return familyInsightBuildRankedSummary(family);
		  }

  function bumpFamilySignal(map, label) {
    map[label] = (map[label] || 0) + 1;
  }

  function familyRowsInView(familyName): ExplorerEndpointRow[] {
    return familyInsightRowsInView(familyName);
  }

  function pickFamilyLeadRow(rows: ExplorerEndpointRow[]): ExplorerEndpointRow | null {
    return familyInsightPickLeadRow(rows);
  }

  function collectCompactWorkflowContext(
    relatedChains: ExplorerWorkflowChain[],
    endpointId: string,
    endpointDetails: StringMap<ExplorerEndpointDetail>
  ): string[] {
    return familyInsightCollectCompactWorkflowContext(relatedChains, endpointId, endpointDetails);
  }

  function familyInsightModel(familyName, preferredEndpointId): ExplorerFamilyInsightModel | null {
    return familyInsightBuildModel(familyName, preferredEndpointId);
  }

		  function renderFamilyInsightPanel(family, preferredEndpointId) {
		    return familyInsightRenderPanel(family, preferredEndpointId || '');
			  }

  function buildFamilySurfaceContext(summaries) {
    return familySummaryBuildSurfaceContext(summaries);
  }

		  function familySummariesRaw(): ExplorerFamilySummary[] {
	    return familySummaryRawList();
	  }

  function familySummaries(): ExplorerFamilySummary[] {
    return familySummaryList();
  }

	  function buildListContext(matches, total) {
      return inspectionShellBuildListContext(matches, total);
  }

		  function renderEndpointInspectionContent(detail, options) {
		    return inspectionShellRenderEndpointInspectionContent(detail, options);
  }

		  function syncSelectedEndpointHighlight() {
		    inspectionShellSyncSelectedEndpointHighlight();
  }

		  function endpointHasWorkflowBurden(detail) {
	    return inspectionShellEndpointHasWorkflowBurden(detail);
  }

	  function renderInspectorWorkflowContextSupport(detail, options) {
	    return inspectionShellRenderInspectorWorkflowContextSupport(detail, options);
		  }

  // ---------------------------------------------------------------------------
  // SHAPE BURDEN: pain-signal analysis
  // Maps real finding codes → developer pain, concrete examples, caller-needed
  // ---------------------------------------------------------------------------

	  function collectShapePainSignals(endpoint, findings) {
	    return diagnosticsCollectShapePainSignals(endpoint, findings || []);
  }

	  function renderShapePainSignals(signals) {
	    if (!signals || !signals.length) return '';

	    function sentenceCount(text) {
	      if (!text) return 0;
	      var t = String(text).trim();
	      if (!t) return 0;
	      var parts = t.split(/[.!?]+/).map(function (p) { return p.trim(); }).filter(Boolean);
	      return parts.length || 1;
	    }

	    function firstSentence(text) {
	      if (!text) return '';
	      var t = String(text).trim();
	      if (!t) return '';
	      var m = t.match(/^(.+?[.!?])(\s|$)/);
	      return m ? m[1].trim() : t;
	    }

	    function renderConcreteExample(signal) {
	      // Every expandable example must include three explicit parts:
	      // 1) What is shown in the current payload (pattern)
	      // 2) Why this is burdensome for the caller
	      // 3) What an improved task-shaped contract would surface instead
	      var current = (signal.example || '').trim();
	      var burden = (signal.notice || '').trim() || firstSentence(signal.pain || '');
	      var improved = (signal.callerNeeded || '').trim();
	      var change = (signal.recommendedChange || '').trim();

	      // Build the 3-part content (always explicit, even when not expandable).
	      var blocks = [];
	      blocks.push('<div class="shape-example-item">'
	        + '<span class="shape-example-label">Current payload shows</span>'
	        + '<p class="shape-example-text">' + escapeHtml(current || 'A storage-shaped response pattern where the outcome is not foregrounded.') + '</p>'
	        + '</div>');
	      blocks.push('<div class="shape-example-item">'
	        + '<span class="shape-example-label">Why this burdens the caller</span>'
	        + '<p class="shape-example-text">' + escapeHtml(burden || 'The caller must infer outcome meaning, traverse deep state, or carry hidden context into the next step.') + '</p>'
	        + '</div>');

	      var improvedBody = '';
	      if (improved) {
	        improvedBody += '<pre class="shape-example-code"><code>' + escapeHtml(improved) + '</code></pre>';
	      } else {
	        improvedBody += '<p class="shape-example-text">Return an outcome-first payload with explicit nextAction/context fields.</p>';
	      }
	      if (change) {
	        improvedBody += '<p class="shape-example-text"><strong>Contract change:</strong> ' + escapeHtml(change) + '</p>';
	      }
	      blocks.push('<div class="shape-example-item">'
	        + '<span class="shape-example-label">Improved task-shaped contract would surface</span>'
	        + improvedBody
	        + '</div>');

	      // Keep accordions only when they reveal materially more than one-line filler
	      // (payload fragments, before/after examples, multi-part guidance).
	      var material = false;
	      if (improved) material = true; // code fragment is always material
	      if (!material && current && sentenceCount(current) > 1) material = true;
	      if (!material && change && change.length > 90) material = true;
	      if (!material && (String(current).length + String(burden).length + String(improved).length + String(change).length) > 260) material = true;

	      if (!material) {
	        return '<div class="shape-example-inline-block">'
	          + '<p class="subtle"><strong>Concrete example:</strong></p>'
	          + '<div class="shape-example-grid">' + blocks.join('') + '</div>'
	          + '</div>';
	      }

	      return '<details class="shape-pain-detail">'
	        + '<summary>Concrete example</summary>'
	        + '<div class="shape-example-grid">' + blocks.join('') + '</div>'
	        + '</details>';
	    }

	    return '<div class="shape-pain-signals">'
	      + signals.map(function (signal) {
	          return '<div class="shape-pain-signal">'
	            + '<div class="shape-pain-signal-header">'
	            + '<span class="shape-pain-icon">' + signal.icon + '</span>'
	            + '<strong class="shape-pain-label">' + escapeHtml(signal.label) + '</strong>'
	            + '</div>'
	            + '<p class="shape-pain-why">' + escapeHtml(signal.pain) + '</p>'
	            + renderConcreteExample(signal)
	            + '</div>';
	        }).join('')
	      + '</div>';
	  }

  // Render normative grounding block from a group object (aggregated by specRuleId).
  // Shows "N occurrences" instead of a specific location when the group has many messages.
	  function renderSpecRuleGroundingForGroup(group) {
	    return openApiRenderSpecRuleGroundingForGroup(group, escapeHtml);
	  }

	  function severityWord(severity) {
	    var s = (severity || '').toLowerCase();
	    if (s === 'error') return 'Error';
	    if (s === 'warning' || s === 'warn') return 'Warning';
	    if (s === 'info') return 'Info';
	    return 'Info';
	  }

	  function evidenceGroupTitleLine(group) {
	    // Tooltip-friendly full title for a group. The on-screen header is rendered
	    // as structured "kind + human title + metadata row" to avoid duplicate chips.
	    if (!group) return 'Issue group';
	    if (group.isSpecRule) {
	      return group.title || group.specRuleId || 'Spec rule';
	    }
	    return group.title || group.preview || group.code || 'Issue';
	  }

	  function inspectTargetForGroup(group, endpoint) {
	    return openApiInspectTargetForGroup(group, endpoint);
	  }

			  function renderIssueGroup(group, index, options) {
			    return issueGroupRenderGroup(group, index, options, {
			      escapeHtml: escapeHtml,
			      severityBadge: severityBadge,
			      renderSpecRuleGroundingForGroup: renderSpecRuleGroundingForGroup,
			      inspectTargetForGroup: inspectTargetForGroup,
			      issueScopeLabelForKey: issueScopeLabelForKey
			    });
		  }

	  function groupFindings(findings) {
	    return groupFindingsByContext(findings, {
	      dimensionForFinding: issueDimensionForFinding,
	      dimensionImpact: dimensionImpact,
	      findingExamineHint: findingExamineHint,
	      formatIssueGroupTitle: formatIssueGroupTitle,
	      severityPriority: severityPriority,
	      specRuleSummary: SPEC_RULE_SUMMARY
	    });
  }

  function renderOpenAPIContextPills(context, compact) {
    return issueGroupRenderOpenAPIContextPills(context, compact, escapeHtml);
  }

  function renderOpenAPILocationCuesBlock(context, compact) {
    return issueGroupRenderOpenAPILocationCuesBlock(context, compact, escapeHtml);
  }

  function formatIssueGroupTitle(finding, context) {
    return issueGroupFormatTitle(finding, context, issueDimensionForFinding);
  }

  function formatIssueGroupCountLabel(group) {
    return issueGroupFormatCountLabel(group);
  }

  function topFieldPaths(groups) {
    return issueGroupTopFieldPaths(groups, uniq);
  }

  function topOpenAPIHighlights(groups) {
    return issueGroupTopOpenAPIHighlights(groups, uniq);
  }

	  function scopedRows(rows) {
	    return appRuntimeScopedRows(rows);
	  }

	  function rowsInScopeAll() {
	    return appRuntimeRowsInScopeAll();
	  }

	  function filteredRows() {
	    return appRuntimeFilteredRows();
	  }

	  function firstEvidenceEndpointId(rows) {
	    return appRuntimeFirstEvidenceEndpointId(rows);
	  }

	  function firstVisibleEndpointId(rows) {
	    return appRuntimeFirstVisibleEndpointId(rows);
	  }

  function rowDominantIssue(row) {
    return appRuntimeRowDominantIssue(row);
  }

  function dominantSeverity(findings) {
    return uiDominantSeverity(findings);
  }

  function severityPriority(severity) {
    return uiSeverityPriority(severity);
  }

	  function severityBadge(severity) {
	    // Static severity label (non-interactive). Use severityBadgeInteractive when the pill
	    // is intended to act as a control.
	    return '<span class="severity-badge severity-' + escapeHtml(severity) + '" title="' + escapeHtml('Severity: ' + String(severity || '').toUpperCase()) + '">'
	      + '<span class="severity-icon">' + escapeHtml(severityIcon(severity)) + '</span>'
	      + '<span>' + escapeHtml(severity.toUpperCase()) + '</span>'
	      + '</span>';
	  }

			  function severityBadgeInteractive(severity) {
			    return '<span class="severity-badge severity-' + escapeHtml(severity) + ' is-interactive" role="button" tabindex="0" title="Open grouped deviations for this endpoint">'
			      + '<span class="severity-icon">' + escapeHtml(severityIcon(severity)) + '</span>'
			      + '<span>' + escapeHtml(severity.toUpperCase()) + '</span>'
			      + '</span>';
			  }

			  function severityBadgeEvidenceCTA(severity, endpointId) {
			    if (!severity) return '';
			    if (!endpointId) return severityBadge(severity);
			    return '<button type="button" class="severity-badge severity-' + escapeHtml(severity) + ' is-interactive" data-open-evidence-id="' + escapeHtml(endpointId) + '" aria-label="Open grouped deviations" title="Open grouped deviations">'
			      + '<span class="severity-icon" aria-hidden="true">' + escapeHtml(severityIcon(severity)) + '</span>'
			      + '<span>' + escapeHtml(severity.toUpperCase()) + '</span>'
			      + '</button>';
			  }

  function severityIcon(severity) {
    return uiSeverityIcon(severity);
  }

  function pressureBadge(priority, kind) {
    return uiPressureBadge(priority, kind);
  }

  function endpointIntentCue(method, path) {
    return uiEndpointIntentCue(method, path);
  }

  function humanizeObjectName(value) {
    return uiHumanizeObjectName(value);
  }

  function singularize(value) {
    return uiSingularize(value);
  }

  function humanizeSignalLabel(signal) {
    return uiHumanizeSignalLabel(signal);
  }

  function renderRecoveryActions(actions) {
    return uiRenderRecoveryActions(actions);
  }

  function bindRecoveryButtons(container) {
    uiBindRecoveryButtons(container, applyRecoveryAction);
  }

			  function applyRecoveryAction(action) {
		    appRuntimeApplyRecoveryAction(action);
	  }

  function pulseLensUpdate() {
    uiPulseLensUpdate();
  }

  function recoveryLabel(action) {
    return uiRecoveryLabel(action);
  }

  function issueDimensionForFinding(code, category, burdenFocus) {
    return uiIssueDimensionForFinding(code, category, burdenFocus);
  }

  function dimensionImpact(dimension) {
    return uiDimensionImpact(dimension);
  }

  function findingExamineHint(code, message) {
    return uiFindingExamineHint(code, message);
  }

  function buildContextTypeBadge(context) {
    return uiBuildContextTypeBadge(context);
  }

	  function dimensionCleanerHint(dimension) {
	    return appRuntimeDimensionCleanerHint(dimension);
	  }

  function familyPressureLabel(priorityCounts) {
    return uiFamilyPressureLabel(priorityCounts);
  }

  function summarizeIssueDimensions(findings) {
    return uiSummarizeIssueDimensions(findings);
  }

  function topFamilyByFindings(rows) {
    return uiTopFamilyByFindings(rows);
  }

  function humanFamilyLabel(name) {
    return appRuntimeHumanFamilyLabel(name);
  }

  function renderChipList(items, emptyText) {
    return uiRenderChipList(items, emptyText);
  }

  function renderBulletList(items, emptyText) {
    return uiRenderBulletList(items, emptyText);
  }

  function renderOpenAPISummary(items) {
    return uiRenderOpenAPISummary(items);
  }

  function priorityRank(priority) {
    return uiPriorityRank(priority);
  }

  function uniq<T>(items: T[]): T[] {
    return uiUniq(items);
  }

  function flatMap<T, U>(items: T[], fn: (item: T) => U[]): U[] {
    return uiFlatMap(items, fn);
  }

  function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
