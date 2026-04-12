declare var state: ExplorerState;
declare var el: ExplorerElements;

declare function escapeHtml(value: unknown): string;
declare function renderInspectorWorkspaceHeader(
  detail: ExplorerEndpointDetail,
  findings: ExplorerFinding[],
  options: { collapseTarget?: string; collapsed?: boolean }
): string;
declare function renderWorkflowStepWorkspace(detail: ExplorerEndpointDetail): string;
declare function renderWhatToDoNextBlock(
  endpoint: ExplorerEndpointRow,
  findings: ExplorerFinding[],
  options: { maxItems?: number; leadCopy?: string; showEndpointLabel?: boolean }
): string;
declare function renderWorkflowDiagnosticsFrame(detail: ExplorerEndpointDetail): string;
declare function renderInspectorWorkflowContextSupport(
  detail: ExplorerEndpointDetail,
  options: { defaultOpen?: boolean }
): string;
declare function renderInspectorContentMap(): string;
declare function renderEndpointDiagnosticsTabs(): string;
declare function renderEndpointDiagnosticsEmptyState(): string;
declare function renderEndpointDiagnosticsExact(detail: ExplorerEndpointDetail): string;
declare function renderEndpointDiagnosticsConsistency(detail: ExplorerEndpointDetail): string;
declare function renderEndpointDiagnosticsCleaner(detail: ExplorerEndpointDetail): string;
declare function renderEndpointDiagnosticsWorkflowSummary(detail: ExplorerEndpointDetail): string;
declare function renderEndpointDiagnosticsShapeSummary(detail: ExplorerEndpointDetail): string;
declare function renderEndpointDiagnosticsSummary(detail: ExplorerEndpointDetail): string;
declare function exactEvidenceTargetLabel(): string;
declare function render(): void;
declare function selectEndpointForInspector(endpointId: string, subTab?: string): void;
declare function endpointDetailForId(endpointId: string): ExplorerEndpointDetail | null;
declare function hasValidSelectedEndpointInCurrentView(): boolean;
declare function findInlineInspectorMount(endpointId: string): HTMLElement | null;
declare function syncSelectedEndpointHighlight(): void;
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];

type BoundWorkspaceCollapseButton = HTMLButtonElement & { __workspaceCollapseBound?: boolean };

function buildEndpointDiagnosticsBody(detail: ExplorerEndpointDetail, findings: ExplorerFinding[]): string {
  var endpoint = (detail && detail.endpoint) ? detail.endpoint : createEmptyEndpointRow();
  var workflowTabActive = state.activeTopTab === 'workflow';
  var shapeTabActive = state.activeTopTab === 'shape';
  var relatedChains = (detail && detail.relatedChains) ? detail.relatedChains : [];

  var body = '';
  var collapseTarget = shapeTabActive ? 'shape-workspace' : '';
  body += renderInspectorWorkspaceHeader(detail, findings, {
    collapseTarget: collapseTarget,
    collapsed: shapeTabActive ? !!state.shapeWorkspaceCollapsed : false
  });

  var workspaceBodyClass = 'inspector-workspace-body'
    + (shapeTabActive && state.shapeWorkspaceCollapsed ? ' is-collapsed' : '');
  var workspaceBodyAttr = collapseTarget
    ? (' data-workspace-collapse-target="' + escapeHtml(collapseTarget) + '"')
    : '';
  body += '<div class="' + workspaceBodyClass + '"' + workspaceBodyAttr + '>';

  if (workflowTabActive) {
    body += renderWorkflowStepWorkspace(detail);
  }

  if (workflowTabActive) {
    body += renderEndpointDiagnosticsWorkflowSummary(detail);
    body += '</div>';
    return body;
  }

  if (!workflowTabActive && relatedChains.length) {
    var primary = relatedChains[0] || ({ endpointIds: [] } as ExplorerWorkflowChain);
    var steps = primary.endpointIds || [];
    var idx = state.selectedEndpointId ? steps.indexOf(state.selectedEndpointId) : -1;
    var stepLabel = (idx >= 0 && steps.length)
      ? ('Step ' + (idx + 1) + ' of ' + steps.length)
      : (steps.length ? (steps.length + ' steps') : 'in chain');
    var linkTitle = 'Workflow chain available';
    var linkHelper = 'Switches tabs and opens this endpoint\u2019s inferred workflow chain.';
    var linkCopy = 'This endpoint participates in an inferred call sequence. The chain view shows purpose, required context, traps, and likely next actions.';
    body += '<section class="workflow-chain-link-card" aria-label="' + escapeHtml(linkTitle) + '">'
      + '<div class="workflow-chain-link-row">'
      + '<p class="workflow-chain-link-title"><strong>' + escapeHtml(linkTitle) + '</strong> <span class="subtle">' + escapeHtml(stepLabel) + '</span></p>'
      + '<button type="button" class="workflow-chain-link-action" data-open-workflow-chain="1" title="Open this chain in Workflow Guidance tab">Open this chain in Workflow Guidance tab</button>'
      + '</div>'
      + '<p class="subtle workflow-chain-link-helper">' + escapeHtml(linkHelper) + '</p>'
      + '<p class="subtle workflow-chain-link-copy">' + escapeHtml(linkCopy) + '</p>'
      + '</section>';
  }
  if (findings && findings.length) {
    body += renderWhatToDoNextBlock(endpoint, findings, { maxItems: 2, showEndpointLabel: false });
  }

  body += renderInspectorContentMap();
  body += renderEndpointDiagnosticsTabs();
  if (!findings || !findings.length) {
    body += renderEndpointDiagnosticsEmptyState();
  } else if (state.endpointDiagnosticsSubTab === 'exact') {
    body += renderEndpointDiagnosticsExact(detail);
  } else if (state.endpointDiagnosticsSubTab === 'consistency') {
    body += renderEndpointDiagnosticsConsistency(detail);
  } else if (state.endpointDiagnosticsSubTab === 'cleaner') {
    body += renderEndpointDiagnosticsCleaner(detail);
  } else {
    body += workflowTabActive
      ? renderEndpointDiagnosticsWorkflowSummary(detail)
      : (shapeTabActive ? renderEndpointDiagnosticsShapeSummary(detail) : renderEndpointDiagnosticsSummary(detail));
  }

  body += '</div>';
  return body;
}

function bindEndpointDiagnosticsInteractions(container: HTMLElement): void {
  if (!container) return;

  var workflowContextDrawer = container.querySelector('[data-inspector-workflow-context]') as HTMLDetailsElement | null;
  if (workflowContextDrawer) {
    workflowContextDrawer.addEventListener('toggle', function () {
      state.inspectorWorkflowContextOpen = !!workflowContextDrawer.open;
    });
  }

  var workspaceCollapseBtn = container.querySelector('button[data-workspace-collapse-toggle]') as BoundWorkspaceCollapseButton | null;
  if (workspaceCollapseBtn && !workspaceCollapseBtn.__workspaceCollapseBound) {
    workspaceCollapseBtn.__workspaceCollapseBound = true;
    var target = workspaceCollapseBtn.getAttribute('data-workspace-collapse-toggle') || '';
    var workspaceBody = target
      ? container.querySelector('[data-workspace-collapse-target="' + target + '"]')
      : null;
    var openLabel = workspaceCollapseBtn.getAttribute('data-open-label') || 'Collapse';
    var closedLabel = workspaceCollapseBtn.getAttribute('data-closed-label') || 'Expand';

    function syncWorkspaceCollapseUi(collapsed) {
      if (!workspaceBody) return;
      workspaceBody.classList.toggle('is-collapsed', !!collapsed);
      workspaceCollapseBtn.textContent = collapsed ? closedLabel : openLabel;
      workspaceCollapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      workspaceCollapseBtn.title = collapsed ? 'Expand workspace' : 'Collapse workspace';
    }

    if (state.activeTopTab === 'shape' && target === 'shape-workspace') {
      syncWorkspaceCollapseUi(!!state.shapeWorkspaceCollapsed);
    }

    workspaceCollapseBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!workspaceBody) return;
      var nextCollapsed = !workspaceBody.classList.contains('is-collapsed');
      if (state.activeTopTab === 'shape' && target === 'shape-workspace') {
        state.shapeWorkspaceCollapsed = nextCollapsed;
      }
      syncWorkspaceCollapseUi(nextCollapsed);
    });
  }

  Array.prototype.forEach.call(container.querySelectorAll('details.detail-evidence-drawer'), function (drawer: HTMLDetailsElement) {
    var labelNode = drawer.querySelector<HTMLElement>('[data-evidence-drawer-label]');
    if (!labelNode) return;
    function syncLabel() {
      labelNode.textContent = drawer.open ? 'Hide grouped deviations' : exactEvidenceTargetLabel();
    }
    drawer.addEventListener('toggle', syncLabel);
    syncLabel();
  });

  Array.prototype.forEach.call(container.querySelectorAll('button[data-close-details="1"]'), function (btn: HTMLButtonElement) {
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var drawer = btn.closest('details');
      if (drawer) drawer.open = false;
    });
  });

  Array.prototype.forEach.call(container.querySelectorAll('button[data-endpoint-subtab]'), function (btn: HTMLButtonElement) {
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var subtab = btn.getAttribute('data-endpoint-subtab') || 'summary';
      if (state.endpointDiagnosticsSubTab === subtab) return;
      state.endpointDiagnosticsSubTab = subtab;
      renderEndpointDiagnostics();
    });
  });

  Array.prototype.forEach.call(container.querySelectorAll('button[data-open-workflow-chain="1"]'), function (btn: HTMLButtonElement) {
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      state.activeTopTab = 'workflow';
      state.endpointDiagnosticsSubTab = 'summary';
      render();
      if (state.selectedEndpointId) {
        selectEndpointForInspector(state.selectedEndpointId, 'summary');
      }
    });
  });
}

function renderEndpointDiagnostics(): void {
  var detail = state.selectedEndpointId ? endpointDetailForId(state.selectedEndpointId) : null;
  var hasValidSelection = !!detail && hasValidSelectedEndpointInCurrentView();
  document.body.classList.toggle('has-endpoint-selection', hasValidSelection);

  var inlineMount = findInlineInspectorMount(state.selectedEndpointId);
  if (!inlineMount) return;

  if (!hasValidSelection) {
    inlineMount.innerHTML = renderEndpointDiagnosticsEmptyState();
    bindEndpointDiagnosticsInteractions(inlineMount);
    syncSelectedEndpointHighlight();
    return;
  }

  syncSelectedEndpointHighlight();

  var findings = findingsForActiveLens((detail.findings || []));
  var body = buildEndpointDiagnosticsBody(detail, findings);
  inlineMount.innerHTML = body;
  bindEndpointDiagnosticsInteractions(inlineMount);
}

function renderEndpointDetail(): void {
  if (!el.endpointDetail) return;
  var pane = el.endpointDetail.closest('.detail-pane') as HTMLElement | null;
  if (pane) {
    pane.style.display = 'none';
    pane.setAttribute('aria-hidden', 'true');
  }
  if (el.detailHelp) {
    el.detailHelp.textContent = '';
  }
  el.endpointDetail.innerHTML = '';
}
