declare var state: ExplorerState;
declare var el: ExplorerElements;

declare function activeTopTabConfig(): ExplorerTopTab;
declare function familySummaries(): ExplorerFamilySummary[];
declare function buildFamilySurfaceContext(summaries: ExplorerFamilySummary[]): string;
declare function bindRecoveryButtons(container: HTMLElement | null): void;
declare function renderRecoveryActions(actions: string[]): string;
declare function familySurfaceHelpCopy(): string;
declare function renderFamilyTableView(summaries: ExplorerFamilySummary[]): string;
declare function familyTableColumnCountForActiveTab(): number;
declare function escapeHtml(value: unknown): string;
declare function renderFamilyInsightPanel(family: ExplorerFamilySummary, preferredEndpointId?: string): string;
declare function syncFamilyInsightToggleButtons(
  familySurface: HTMLElement | null,
  state: ExplorerState,
  setFamilyInsightToggleButton: (btn: Element, expanded: boolean) => void
): void;
declare function bindInsightPanelActions(
  row: Element | null,
  focusFamily: (family: string) => void,
  openEvidence: (endpointId: string) => void
): void;
declare function focusFamilySurface(state: ExplorerState, family: string, filteredRows: () => ExplorerEndpointRow[], render: () => void): void;
declare function filteredRows(): ExplorerEndpointRow[];
declare function render(): void;
declare function selectEndpointForInspector(endpointId: string, subTab?: string): void;
declare function syncWorkflowStepSelectionHighlight(): void;
declare function toggleFamilyInsightInline(options: {
  familySurface: HTMLElement | null;
  state: ExplorerState;
  button: Element | null;
  family: string;
  captureBackState: () => void;
  familySummaries: () => ExplorerFamilySummary[];
  familyInsightRowHtml: (family: ExplorerFamilySummary) => string;
  bindInsightPanelActions: (row: Element | null) => void;
  setFamilyInsightToggleButton: (btn: Element, expanded: boolean) => void;
}): void;
declare function captureFamilyTableBackStateIfNeeded(state: ExplorerState): void;
declare function bindFamilySurfaceEndpointInteractions(options: {
  familySurface: HTMLElement | null;
  state: ExplorerState;
  captureBackState: () => void;
  renderFamilySurface: () => void;
  renderEndpointDiagnostics: () => void;
  renderEndpointDetail: () => void;
  syncSelectedEndpointHighlight: () => void;
  syncWorkflowStepSelectionHighlight: () => void;
  selectEndpointForInspector: (endpointId: string, subTab?: string) => void;
  focusFamily: (family: string) => void;
}): void;
declare function renderEndpointDiagnostics(): void;
declare function renderEndpointDetail(): void;
declare function syncSelectedEndpointHighlight(): void;

function renderFamilySurface(): void {
  var tab = activeTopTabConfig();
  // Keep the family surface framing aligned with the active lens while using one
  // shared family table/expansion pattern across all top-level tabs.
  var familySection = el.familySurface ? (el.familySurface.closest('.section') as HTMLElement | null) : null;
  if (familySection) {
    var heading = familySection.querySelector<HTMLElement>('.section-heading h2');
    var eyebrow = familySection.querySelector<HTMLElement>('.section-heading .eyebrow');
    if (eyebrow) eyebrow.textContent = tab.familyEyebrow;
    if (heading) heading.textContent = tab.familyHeading;
  }

  var summaries = familySummaries();
  var lensContext = buildFamilySurfaceContext(summaries);
  var visibleFamilies: StringMap<boolean> = {};
  summaries.forEach(function (family: ExplorerFamilySummary) {
    visibleFamilies[family.family || 'unlabeled family'] = true;
  });

  // Single-expand policy: expanding a new family collapses any previously expanded family.
  // `expandedFamily` drives the nested endpoints table, while `expandedFamilyInsight` drives
  // the inline insight panel. We do not support multi-expand across different families.
  if (state.expandedFamily && state.expandedFamilyInsight && state.expandedFamily !== state.expandedFamilyInsight) {
    state.expandedFamilyInsight = '';
  }
  if (state.expandedFamily && !visibleFamilies[state.expandedFamily]) {
    state.expandedFamily = "";
  }
  if (state.expandedFamilyInsight && !visibleFamilies[state.expandedFamilyInsight]) {
    state.expandedFamilyInsight = "";
  }

  if (!summaries.length) {
    el.familySurfaceHelp.textContent = tab.emptyHelp || '';
    // Avoid duplicating the Contract Issues empty-state story: that lives under the filter bar.
    if (state.activeTopTab === 'spec-rule') {
      el.familySurfaceContext.innerHTML = '';
    } else {
      el.familySurfaceContext.innerHTML = lensContext;
      bindRecoveryButtons(el.familySurfaceContext);
    }
    var hasWidenAction = !!(state.filters.search
      || state.filters.category !== 'all'
      || state.filters.familyPressure !== 'all'
      || state.filters.includeNoIssueRows
      || state.familyTableBackState);
    // Contract Issues no-match recovery belongs in the single empty-state block under the filter bar.
    // Keep the surface body minimal so we do not duplicate guidance in multiple panels.
    var recovery = (state.activeTopTab === 'spec-rule') ? '' : (hasWidenAction ? renderRecoveryActions(['clear-table-filters']) : '');
    if (state.activeTopTab === 'spec-rule') {
      el.familySurface.innerHTML = '<div class="empty empty-quiet" aria-hidden="true"></div>';
    } else {
      el.familySurface.innerHTML = '<div class="empty">'
        + '<strong>No matching families.</strong>'
        + '<p class="subtle">No families match the current table view.' + (hasWidenAction ? ' Reset the table view to widen it.' : '') + '</p>'
        + recovery
        + '</div>';
      bindRecoveryButtons(el.familySurface);
    }
    return;
  }

  el.familySurfaceHelp.textContent = tab.familyHelp || familySurfaceHelpCopy();
  el.familySurfaceContext.innerHTML = lensContext;
  bindRecoveryButtons(el.familySurfaceContext);
  var tableHtml = renderFamilyTableView(summaries);

  el.familySurface.innerHTML = tableHtml;
  bindRecoveryButtons(el.familySurface);
  Array.prototype.forEach.call(el.familySurface.querySelectorAll('button[data-family-sort]'), function (btn: HTMLButtonElement) {
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var sortKey = btn.getAttribute('data-family-sort') || 'default';
      if (state.familyTableSort.key === sortKey) {
        state.familyTableSort.direction = state.familyTableSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.familyTableSort.key = sortKey;
        state.familyTableSort.direction = 'asc';
      }
      renderFamilySurface();
    });
  });

  function familyInsightRowHtml(family: ExplorerFamilySummary): string {
    var familyName = family.family || 'unlabeled family';
    return '<tr class="family-expansion-row family-inline-insight-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="' + escapeHtml(familyName) + '">'
      + '<td colspan="' + String(familyTableColumnCountForActiveTab()) + '" class="family-expansion-cell">'
      + '<div class="family-row-insight">'
      + renderFamilyInsightPanel(family)
      + '</div>'
      + '</td>'
      + '</tr>';
  }

  function setFamilyInsightToggleButton(btn: Element, expanded: boolean): void {
    if (!btn) return;
    var label = expanded ? 'Hide insight' : 'Show insight';
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.setAttribute('title', label);
    var action = btn.querySelector<HTMLElement>('.family-name-action');
    if (action) action.textContent = label;
  }

  function syncInlineFamilyInsightButtons() {
    syncFamilyInsightToggleButtons(el.familySurface, state, setFamilyInsightToggleButton);
  }

  function bindInlineInsightPanelActions(row: Element | null): void {
    bindInsightPanelActions(
      row,
      function (family: string) {
        focusFamilySurface(state, family, filteredRows, render);
      },
      function (endpointId: string) {
        state.inspectPlacementHint = 'nested';
        state.detailEvidenceOpenForId = endpointId;
        selectEndpointForInspector(endpointId, 'exact');
        syncWorkflowStepSelectionHighlight();
      }
    );
  }

  // Family insight toggle handling (family name button).
  Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-insight-toggle]"), function (btn: HTMLButtonElement) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var family = btn.getAttribute("data-insight-toggle") || "";
      if (!family) return;
      toggleFamilyInsightInline({
        familySurface: el.familySurface,
        state: state,
        button: btn,
        family: family,
        captureBackState: function () { captureFamilyTableBackStateIfNeeded(state); },
        familySummaries: familySummaries,
        familyInsightRowHtml: familyInsightRowHtml,
        bindInsightPanelActions: bindInlineInsightPanelActions,
        setFamilyInsightToggleButton: setFamilyInsightToggleButton
      });
    });
  });
  syncInlineFamilyInsightButtons();

  bindFamilySurfaceEndpointInteractions({
    familySurface: el.familySurface,
    state: state,
    captureBackState: function () { captureFamilyTableBackStateIfNeeded(state); },
    renderFamilySurface: renderFamilySurface,
    renderEndpointDiagnostics: renderEndpointDiagnostics,
    renderEndpointDetail: renderEndpointDetail,
    syncSelectedEndpointHighlight: syncSelectedEndpointHighlight,
    syncWorkflowStepSelectionHighlight: syncWorkflowStepSelectionHighlight,
    selectEndpointForInspector: selectEndpointForInspector,
    focusFamily: function (family) {
      focusFamilySurface(state, family, filteredRows, render);
    }
  });

  // Endpoint workspace is rendered inline beneath the selected endpoint row.
}
