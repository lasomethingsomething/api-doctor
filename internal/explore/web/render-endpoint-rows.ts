declare var state: ExplorerState;
declare var el: ExplorerElements;

declare function filteredRows(): ExplorerEndpointRow[];
declare function rowsInScopeAll(): ExplorerEndpointRow[];
declare function evidenceSectionTitleForActiveLens(): string;
declare function buildListContext(matches: number, total: number): string;
declare function bindRecoveryButtons(container: HTMLElement | null): void;
declare function bindEndpointListInteractions(options: {
  endpointRows: HTMLElement | null;
  state: ExplorerState;
  renderEndpointRows: () => void;
  renderEndpointDiagnostics: () => void;
  selectEndpointForInspector: (endpointId: string, subTab?: string) => void;
}): void;
declare function renderEndpointDiagnostics(): void;
declare function selectEndpointForInspector(endpointId: string, subTab?: string): void;
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function issueScopeLabelForKey(groupKey: string, familyName: string): string;
declare function findingGroupKey(finding: ExplorerFinding): string;
declare function endpointIntentCue(method: string, path: string): string;
declare function dominantSeverity(findings: ExplorerFinding[]): string;
declare function extractOpenAPIContext(finding: ExplorerFinding): OpenAPIContext;
declare function renderOpenAPIContextPills(context: OpenAPIContext, compact: boolean): string;
declare function escapeHtml(value: unknown): string;
declare function severityBadgeEvidenceCTA(severity: string, endpointId: string): string;
declare function severityBadgeInteractive(severity: string): string;
declare function humanFamilyLabel(name: string | undefined): string;
declare function pressureBadge(priority: string | undefined, kind: string): string;
declare function rowDominantIssue(row: ExplorerEndpointRow): { label: string; code: string };
declare function buildContractImprovementItems(
  detail: ExplorerEndpointDetail,
  findings: ExplorerFinding[]
): ContractImprovementItem[];

interface RenderEndpointRowOptions {
  familyName?: string;
  inlineTable?: boolean;
}

function renderEndpointRows(): void {
  if (!el.endpointRows || !el.listContext) {
    return;
  }
  // The investigation flow is now: filters -> family table -> inline endpoints -> inline inspector.
  // Avoid detached endpoint evidence below the family table. All useful endpoint
  // detail now opens inline beneath the family or endpoint row that triggered it.
  var listSection = el.endpointRows ? (el.endpointRows.closest('.section') as HTMLElement | null) : null;
  if (listSection) {
    listSection.style.display = 'none';
    listSection.setAttribute('aria-hidden', 'true');
  }
  el.listContext.innerHTML = '';
  el.endpointRows.innerHTML = '';
  return;

  var rows = filteredRows();
  var total = rowsInScopeAll().length;
  var evidenceListTitle = evidenceSectionTitleForActiveLens();

  // Keep section heading in sync with the active tab
  var listHeading = listSection ? listSection.querySelector<HTMLElement>('#endpointListHeading') : null;
  var listEyebrow = listSection ? listSection.querySelector<HTMLElement>('.section-heading .eyebrow') : null;
  var evidenceHeader = listSection ? listSection.querySelector<HTMLElement>('thead th:nth-child(3)') : null;
  if (listHeading) {
    listHeading.textContent = state.activeTopTab === 'workflow'
      ? 'Workflow Problems — endpoint evidence'
      : state.activeTopTab === 'shape'
      ? 'Response Shape Problems — endpoint evidence'
      : 'Contract Problems — endpoint evidence';
  }
  if (listEyebrow) {
    listEyebrow.textContent = evidenceListTitle;
  }
  if (evidenceHeader) {
    evidenceHeader.textContent = evidenceListTitle;
  }

  if (listSection) {
    if (state.activeTopTab === 'workflow') {
      listSection.classList.add('endpoint-list-workflow-secondary');
      listSection.classList.remove('endpoint-list-shape-secondary');
    } else if (state.activeTopTab === 'shape') {
      listSection.classList.add('endpoint-list-shape-secondary');
      listSection.classList.remove('endpoint-list-workflow-secondary');
    } else {
      listSection.classList.remove('endpoint-list-workflow-secondary');
      listSection.classList.remove('endpoint-list-shape-secondary');
    }
  }

  el.listContext.innerHTML = buildListContext(rows.length, total);
  bindRecoveryButtons(el.listContext);

  if (!rows.length) {
    state.selectedEndpointId = "";
    el.endpointRows.innerHTML = '<tr><td colspan="3">'
      + '<div class="empty inline-empty">'
      + '<strong>No endpoints match this view.</strong>'
      + '<p class="subtle">No endpoints remain in the current table view. Reset the table view above to continue.</p>'
      + '</div>'
      + '</td></tr>';
    return;
  }

  if (!rows.find(function (row) { return row.id === state.selectedEndpointId; })) {
    // Never auto-pick a different endpoint. If filters invalidate selection,
    // clear it and let the user pick via "Inspect endpoint".
    state.selectedEndpointId = '';
  }

  el.endpointRows.innerHTML = rows.map(function (row) {
    return renderEndpointRow(row);
  }).join("");

  bindEndpointListInteractions({
    endpointRows: el.endpointRows,
    state: state,
    renderEndpointRows: renderEndpointRows,
    renderEndpointDiagnostics: renderEndpointDiagnostics,
    selectEndpointForInspector: selectEndpointForInspector
  });
}

function renderEndpointRow(row: ExplorerEndpointRow, options?: RenderEndpointRowOptions): string {
  options = options || {};
  var endpointDetails = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails as StringMap<ExplorerEndpointDetail> : {};
  var detail = endpointDetails[row.id] || ({ endpoint: row, findings: [] } as ExplorerEndpointDetail);
  var lensFindings = findingsForActiveLens(detail.findings || []);
  var firstFinding = lensFindings[0] || null;
  var scopeFamilyName = row.family || 'unlabeled family';
  var primaryScope = firstFinding ? issueScopeLabelForKey(findingGroupKey(firstFinding), scopeFamilyName) : '';
  var selected = row.id === state.selectedEndpointId ? "active" : "";
  var intent = endpointIntentCue(row.method, row.path);
  var severity = dominantSeverity(lensFindings);
  var topIssueLabel = firstFinding ? (firstFinding.message || 'No direct issue evidence') : 'No direct issue evidence';
  var instanceCount = lensFindings.length;
  var firstContext = firstFinding ? extractOpenAPIContext(firstFinding) : null;
  var contextLine = firstContext ? renderOpenAPIContextPills(firstContext, true) : '<span class="context-inline subtle">OpenAPI location is not clear from the top message.</span>';
  var additionalFindings = lensFindings.slice(1);
  var additionalCount = additionalFindings.length;
  var additionalOpen = !!state.expandedEndpointRowFindings[row.id];
  var additionalFindingsControl = additionalCount
    ? '<button type="button" class="row-additional-findings-toggle" data-toggle-row-findings="' + escapeHtml(row.id) + '" aria-expanded="' + (additionalOpen ? 'true' : 'false') + '">' + (additionalOpen ? 'Hide ' : 'Show ') + additionalCount + ' additional finding' + (additionalCount === 1 ? '' : 's') + '</button>'
    : '';
  var additionalFindingsList = additionalCount && additionalOpen
    ? (function (): string {
        var scopes = additionalFindings.map(function (finding) {
          return issueScopeLabelForKey(findingGroupKey(finding), scopeFamilyName);
        });
        var common = scopes[0] || '';
        for (var i = 1; i < scopes.length; i++) {
          if (scopes[i] !== common) { common = ''; break; }
        }
        var headerScopeLine = '';
        if (common && common !== primaryScope) {
          headerScopeLine = '<p class="row-additional-findings-scope"><strong>Scope:</strong> ' + escapeHtml(common) + '</p>';
        }
        return '<div class="row-additional-findings-list">'
          + headerScopeLine
          + additionalFindings.map(function (finding: ExplorerFinding) {
              var scope = issueScopeLabelForKey(findingGroupKey(finding), scopeFamilyName);
              var findingContext = renderOpenAPIContextPills(extractOpenAPIContext(finding), true);
              var scopeLine = '';
              if (!common && scope && scope !== primaryScope) {
                scopeLine = '<p class="row-additional-finding-scope"><strong>Scope:</strong> ' + escapeHtml(scope) + '</p>';
              }
              return '<div class="row-additional-finding-item">'
                + '<p class="row-additional-finding-message">' + escapeHtml(finding.message || 'No issue message extracted.') + '</p>'
                + scopeLine
                + '<div class="row-additional-finding-context">' + findingContext + '</div>'
                + '</div>';
            }).join('')
          + '</div>';
      })()
    : '';
  var additionalFindingsRowInline = '';
  var inspectLoading = state.inspectingEndpointId === row.id;
  var inspectSelected = state.selectedEndpointId === row.id && !inspectLoading;
  var inspectButtonClass = 'tertiary-action endpoint-inspect-action'
    + (inspectLoading ? ' is-loading' : '')
    + (inspectSelected ? ' is-selected' : '');
  var inspectButtonLabel = inspectLoading ? 'Inspecting...' : 'Inspect endpoint';
  var rowClasses = (options.inlineTable ? 'nested-endpoint-row ' : '') + selected + ' row-pressure-' + row.priority + (additionalOpen ? ' findings-expanded' : '');

  if (options.inlineTable) {
    var suggestedAction = (function (): string {
      var items = buildContractImprovementItems(detail, lensFindings);
      if (items && items.length && items[0] && items[0].change) return items[0].change;
      if (firstFinding) return "Clarify the contract so this problem is visible before runtime.";
      return "No suggested contract change.";
    })();
    var workflowInline = state.activeTopTab === 'workflow';
    var issueType = rowDominantIssue(row).label || (workflowInline ? "Workflow problem" : "Issue");
    var endpointIdentityTitle = escapeHtml(((row.method || '').toUpperCase() + ' ' + (row.path || '') + ' — ' + intent).trim());
    var detailToggleLabel = state.expandedEndpointInsightIds[row.id] ? 'Hide details' : 'Show details';
    var rowHtml = '<tr class="' + rowClasses.trim() + '" data-id="' + row.id + '" data-endpoint-id="' + row.id + '"' + (options.familyName ? ' data-family="' + escapeHtml(options.familyName) + '"' : '') + '>'
      + '<td class="nested-endpoint-path-cell">'
      + '<div class="endpoint-row-main">'
      + '<strong title="' + endpointIdentityTitle + '">' + escapeHtml((row.method || '').toUpperCase() + ' ' + (row.path || '')) + '</strong>'
      + '</div>'
      + '</td>'
      + '<td class="nested-endpoint-issue-cell">'
      + '<div class="nested-endpoint-issue-top">'
      + '<div class="nested-endpoint-primary-issue" title="' + escapeHtml(topIssueLabel) + '">' + escapeHtml(topIssueLabel) + '</div>'
      + '</div>'
      + '</td>'
      + '<td class="nested-endpoint-type-cell"><div class="nested-endpoint-type-label" title="' + escapeHtml(issueType) + '">' + escapeHtml(issueType) + '</div></td>'
      + '<td class="nested-endpoint-severity-cell">' + (firstFinding ? severityBadge(severity) : '<span class="subtle">No issue</span>') + '</td>'
      + '<td class="nested-endpoint-instance-cell"><span class="instance-count-chip">' + instanceCount + ' ' + (workflowInline ? 'signal' : 'deviation') + (instanceCount === 1 ? '' : 's') + '</span></td>'
      + '<td class="nested-endpoint-actionhint-cell"><div class="nested-endpoint-actionhint" title="' + escapeHtml(suggestedAction) + '">' + escapeHtml(suggestedAction) + '</div></td>'
      + '<td class="nested-endpoint-actions-cell">'
      + '<div class="nested-endpoint-actions">'
      + '<button type="button" class="tertiary-action endpoint-insight-toggle" data-endpoint-insight-toggle="' + escapeHtml(row.id) + '">' + escapeHtml(detailToggleLabel) + '</button>'
      + '</div>'
      + '</td>'
      + '</tr>';
    var inspectorInlineRowNested = (row.id === state.selectedEndpointId && state.inspectPlacementHint === 'nested')
      ? renderInlineInspectorMountRow(row.id, 7, 'nested')
      : '';
    return rowHtml + additionalFindingsRowInline + inspectorInlineRowNested;
  }

  var baseRow = '<tr class="' + rowClasses.trim() + '" data-id="' + row.id + '" data-endpoint-id="' + row.id + '"' + (options.familyName ? ' data-family="' + escapeHtml(options.familyName) + '"' : '') + '>'
    + '<td>'
    + '<div class="endpoint-row-main">'
    + '<div class="endpoint-row-identity">'
    + '<span class="endpoint-method-chip">' + escapeHtml((row.method || '').toUpperCase()) + '</span>'
    + '<strong class="endpoint-path-text">' + escapeHtml(row.path || '') + '</strong>'
    + '</div>'
    + '<div class="endpoint-row-meta">'
    + '<span class="intent-cue">' + escapeHtml(intent) + '</span>'
    + '<span class="subtle">' + escapeHtml(humanFamilyLabel(row.family)) + '</span>'
    + '</div>'
    + '</div>'
    + '</td>'
    + '<td>'
    + '<div class="row-cause">' + pressureBadge(row.priority, 'pressure') + '</div>'
    + '<div class="row-cause-label">' + escapeHtml(rowDominantIssue(row).label) + '</div>'
    + '</td>'
    + '<td>'
    + '<div class="endpoint-evidence-row">'
    + '<div class="endpoint-evidence-top">'
    + '<div class="endpoint-evidence-severity">' + (firstFinding ? severityBadgeInteractive(severity) : '') + '</div>'
    + '<div class="endpoint-evidence-primary" title="' + escapeHtml(firstFinding ? firstFinding.message : 'No direct issue messages') + '">' + escapeHtml(firstFinding ? firstFinding.message : 'No direct issue messages') + '</div>'
    + '<div class="endpoint-evidence-actions">'
    + '<button type="button" class="' + inspectButtonClass + '" data-focus-endpoint="' + escapeHtml(row.id) + '" aria-pressed="' + (inspectSelected ? 'true' : 'false') + '" aria-busy="' + (inspectLoading ? 'true' : 'false') + '">' + inspectButtonLabel + '</button>'
    + '</div>'
    + '</div>'
    + '<div class="endpoint-evidence-meta">'
    + (firstFinding ? ('<span class="row-issue-scope-pill" title="' + escapeHtml('Scope: ' + primaryScope) + '"><strong>Scope:</strong> ' + escapeHtml(primaryScope) + '</span>') : '')
    + (firstFinding ? ('<button type="button" class="instance-count-chip is-interactive" data-open-evidence-id="' + escapeHtml(row.id) + '" title="Open grouped deviations" aria-label="Open grouped deviations">' + instanceCount + ' deviation' + (instanceCount === 1 ? '' : 's') + '</button>') : '')
    + additionalFindingsControl
    + '</div>'
    + '<div class="context-inline-wrap">' + contextLine + '</div>'
    + '</div>'
    + '</td>'
    + '</tr>';

  var additionalFindingsRow = additionalFindingsList
    ? '<tr class="endpoint-row-findings-row" data-endpoint-id="' + escapeHtml(row.id) + '"' + (options.familyName ? ' data-family="' + escapeHtml(options.familyName) + '"' : '') + '>'
        + '<td colspan="3" class="endpoint-row-findings-cell">'
        + additionalFindingsList
        + '</td>'
      + '</tr>'
    : '';

  var inspectorInlineRow = (row.id === state.selectedEndpointId && state.inspectPlacementHint === 'endpoint-list')
    ? renderInlineInspectorMountRow(row.id, 3, 'endpoint-list')
    : '';

  return baseRow + additionalFindingsRow + inspectorInlineRow;
}

function renderInlineInspectorMountRow(endpointId: string, colSpan: number, variant?: string): string {
  var v = variant || 'nested';
  return '<tr class="inline-inspector-row inline-inspector-row-' + escapeHtml(v) + '" data-inline-inspector-row="1" data-endpoint-id="' + escapeHtml(endpointId) + '">'
    + '<td colspan="' + String(colSpan || 1) + '" class="inline-inspector-cell">'
    + '<div class="inline-inspector-shell inline-inspector-shell-' + escapeHtml(v) + '" data-inline-inspector-mount="1" data-inline-endpoint-id="' + escapeHtml(endpointId) + '"></div>'
    + '</td>'
    + '</tr>';
}

function findInlineInspectorMount(endpointId: string): HTMLElement | null {
  if (!endpointId) return null;
  var mounts = document.querySelectorAll<HTMLElement>('[data-inline-inspector-mount="1"]');
  for (var i = 0; i < mounts.length; i++) {
    if ((mounts[i].getAttribute('data-inline-endpoint-id') || '') === endpointId) {
      return mounts[i];
    }
  }
  return null;
}
