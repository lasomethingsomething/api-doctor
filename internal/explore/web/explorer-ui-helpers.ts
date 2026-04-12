declare var el: ExplorerElements;

declare function clearCurrentLens(): void;
declare function humanFamilyLabel(name: string): string;
declare function render(): void;
declare function restoreFamilyTableBackState(state: ExplorerState): void;
declare function escapeHtml(value: unknown): string;

function uiDominantSeverity(findings: ExplorerFinding[]): string {
  if ((findings || []).some(function (finding) { return finding.severity === 'error'; })) return 'error';
  if ((findings || []).some(function (finding) { return finding.severity === 'warning'; })) return 'warning';
  return 'info';
}

function uiSeverityPriority(severity: string): number {
  if (severity === 'error') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

function uiSeverityIcon(severity: string): string {
  if (severity === 'error') return 'x';
  if (severity === 'warning') return '!';
  return 'i';
}

function uiPressureBadge(priority: string | undefined, kind?: string): string {
  var label = (priority || 'low').toUpperCase();
  return '<span class="pressure-badge pressure-' + escapeHtml(priority || 'low') + ' ' + escapeHtml(kind || '') + '">' + label + '</span>';
}

function uiHumanizeObjectName(value: string): string {
  if (!value) return 'resource';
  return value.replaceAll('-', ' ').replaceAll('_', ' ');
}

function uiSingularize(value: string): string {
  if (!value) return value;
  if (value.endsWith('ies')) return value.slice(0, -3) + 'y';
  if (value.endsWith('s') && value.length > 1) return value.slice(0, -1);
  return value;
}

function uiEndpointIntentCue(method: string, path: string): string {
  var segments = String(path || '').split('/').filter(Boolean);
  var staticSegments = segments.filter(function (segment) {
    return segment.indexOf('{') === -1 && segment.indexOf('}') === -1;
  });
  var objectName = staticSegments.length ? staticSegments[staticSegments.length - 1] : 'resource';
  var parentName = staticSegments.length > 1 ? staticSegments[staticSegments.length - 2] : objectName;
  objectName = uiHumanizeObjectName(objectName);
  parentName = uiHumanizeObjectName(parentName);

  if (method === 'GET') {
    if (segments.length && segments[segments.length - 1].indexOf('{') !== -1) return 'get ' + uiSingularize(parentName);
    if (objectName === 'search') return 'search ' + uiSingularize(parentName);
    return 'list ' + objectName;
  }
  if (method === 'POST') {
    if (segments.length > 1 && segments[segments.length - 1].indexOf('{') === -1 && staticSegments.length > 1) {
      return uiHumanizeObjectName(staticSegments[staticSegments.length - 1]) + ' ' + uiSingularize(parentName);
    }
    return 'create ' + uiSingularize(objectName);
  }
  if (method === 'PATCH' || method === 'PUT') {
    return 'update ' + uiSingularize(parentName);
  }
  if (method === 'DELETE') {
    return 'delete ' + uiSingularize(parentName);
  }
  return method.toLowerCase() + ' ' + uiSingularize(objectName);
}

function uiHumanizeSignalLabel(signal: string): string {
  var map: StringMap<string> = {
    'snapshot-heavy-response': 'snapshot-heavy',
    'deeply-nested-response-structure': 'deeply-nested',
    'duplicated-state-response': 'duplicated state',
    'incidental-internal-field-exposure': 'incidental fields',
    'weak-outcome-next-action-guidance': 'weak guidance',
    'missing-next-action': 'missing next-action',
    'storage-shaped-response': 'storage-shaped',
    'response appears snapshot-heavy': 'snapshot-heavy',
    'deep nesting appears likely': 'deep nesting',
    'duplicated state appears likely': 'duplicated state',
    'incidental/internal fields appear to dominate': 'internal fields',
    'source-of-truth fields are unclear': 'unclear source-of-truth',
    'outcome framing is easy to miss': 'missing outcome framing',
    'next action is weakly exposed': 'missing next-action cues',
    'hidden token/context handoff appears likely': 'hidden handoff',
    'next step not clearly exposed': 'unclear next-step',
    'sequencing appears brittle': 'brittle sequencing',
    'auth/header burden spread across steps': 'auth/header spread',
    'parameter naming drift appears likely': 'parameter name drift',
    'path style drift appears likely': 'path style drift',
    'response shape drift appears likely': 'response shape drift',
    'outcome modeled differently across similar endpoints': 'outcome mismatch',
    'parameter names differ': 'parameter name drift',
    'path patterns differ': 'path pattern drift',
    'response shapes differ': 'response shape drift',
    'outcome wording differs': 'outcome mismatch'
  };
  return map[signal] || signal.replaceAll('-', ' ');
}

function uiRenderRecoveryActions(actions: string[]): string {
  return '<div class="recovery-actions">' + actions.map(function (action) {
    return '<button type="button" class="secondary-action" data-recovery-action="' + escapeHtml(action) + '">' + escapeHtml(uiRecoveryLabel(action)) + '</button>';
  }).join('') + '</div>';
}

function uiBindRecoveryButtons(container: ParentNode | null, onAction: (action: string) => void): void {
  if (!container) return;
  Array.prototype.forEach.call(container.querySelectorAll('[data-recovery-action]'), function (btn: Element) {
    btn.addEventListener('click', function (event: Event) {
      event.stopPropagation();
      var action = btn.getAttribute('data-recovery-action');
      onAction(action || '');
    });
  });
}

function uiPulseLensUpdate(): void {
  [el.familySurfaceContext, el.listContext, el.workflowSection].forEach(function (node) {
    if (!node) return;
    node.classList.remove('lens-updated');
    void node.offsetWidth;
    node.classList.add('lens-updated');
  });
}

function uiRecoveryLabel(action: string): string {
  if (action === 'back-to-all-families') return 'Back to all families';
  if (action === 'back-to-family-table') return 'Back to family table';
  if (action === 'clear-search') return 'Clear search';
  if (action === 'reset-category') return 'Reset category';
  if (action === 'show-all-matching-families') return 'Show all matching families';
  if (action === 'show-all-families') return 'Show all families in current scope';
  if (action === 'clear-table-filters') return 'Clear table filters';
  if (action === 'show-all-workflows') return 'Show all workflow patterns';
  if (action === 'include-no-issue-rows') return 'Include no-issue rows';
  return 'Reset current view';
}

function uiIssueDimensionForFinding(code: string, category: string, burdenFocus: string): string {
  if (!code) return category ? category.replaceAll('-', ' ') : 'other issues';
  if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response') return 'shape / storage-style response weakness';
  if (code === 'duplicated-state-response') return 'shape / duplicated state exposure';
  if (code === 'incidental-internal-field-exposure') return 'internal/incidental fields';
  if (code === 'deeply-nested-response-structure') return 'shape / nesting complexity';
  if (code === 'prerequisite-task-burden') return 'hidden dependency / linkage burden';
  if (code === 'weak-list-detail-linkage' || code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage') {
    return 'workflow outcome weakness';
  }
  if (code === 'weak-outcome-next-action-guidance') return 'workflow outcome weakness';
  if (code === 'weak-array-items-schema') return 'shape / nesting complexity';
  if (code === 'internal-incidental-field') return 'internal/incidental fields';
  if (code === 'sibling-path-shape-drift' || code === 'endpoint-path-style-drift' || code === 'detail-path-parameter-name-drift') return 'consistency drift';
  if (code === 'likely-missing-enum' || code === 'generic-object-request' || code === 'generic-object-response') return 'typing/enum weakness';
  if ((category || '') === 'change-risk') return 'change-risk clues';
  if ((burdenFocus || '') === 'workflow-burden') return 'hidden dependency / linkage burden';
  if ((burdenFocus || '') === 'contract-shape') return 'shape / storage-style response weakness';
  if ((burdenFocus || '') === 'consistency') return 'consistency drift';
  return (category || 'other issues').replaceAll('-', ' ');
}

function uiDimensionImpact(dimension: string): string {
  switch (dimension) {
    case 'typing/enum weakness':
      return 'Clients cannot type-check valid values reliably, increasing runtime integration errors.';
    case 'shape / storage-style response weakness':
      return 'Clients must issue follow-up reads to confirm outcome, adding latency and uncertainty.';
    case 'hidden dependency / linkage burden':
      return 'Multi-step flows become fragile because required IDs/state are not surfaced directly.';
    case 'workflow outcome weakness':
      return 'Clients cannot confirm completion or next step cleanly after action/accepted responses.';
    case 'shape / nesting complexity':
      return 'Nested or weak shape contracts complicate generated models and parsing logic.';
    case 'shape / duplicated state exposure':
      return 'Repeated state across branches increases scan noise and can obscure the primary outcome.';
    case 'internal/incidental fields':
      return 'Leaking internal fields couples clients to implementation details.';
    case 'consistency drift':
      return 'Inconsistent path or payload patterns increase learning and maintenance cost.';
    case 'change-risk clues':
      return 'Deprecated or unstable paths can break existing client flows without migration planning.';
    default:
      return 'This evidence suggests avoidable client burden in the contract.';
  }
}

function uiFindingExamineHint(code: string, message: string): string {
  switch (code) {
    case 'weak-list-detail-linkage':
    case 'weak-follow-up-linkage': {
      var missingField = (message || '').match(/\(no ([^)]+)\)/);
      var field = missingField ? missingField[1] : 'an id field';
      return 'Add ' + field + ' to the response schema so the next request can be formed directly.';
    }
    case 'weak-action-follow-up-linkage':
      return 'Add state or resource identifier in the action response so clients can confirm outcome without guessing.';
    case 'weak-accepted-tracking-linkage':
      return 'Add tracking URL or task ID in the 202 response body to support deterministic polling.';
    case 'weak-outcome-next-action-guidance':
      return 'Add explicit outcome/status and next-step handoff fields so callers can safely continue the workflow.';
    case 'likely-missing-enum': {
      var enumField = (message || '').match(/property '([^']+)'/);
      return 'Declare enum values for ' + (enumField ? enumField[1] : 'the property') + ' in schema.';
    }
    case 'prerequisite-task-burden':
      return 'Expose prerequisite identifier/state in parent response or simplify required task linkage.';
    case 'contract-shape-workflow-guidance-burden':
    case 'snapshot-heavy-response':
      return 'Return a compact outcome payload with explicit status/link rather than a full snapshot.';
    case 'deeply-nested-response-structure':
      return 'Flatten the response so outcome and next-action fields are visible near the top level.';
    case 'duplicated-state-response':
      return 'Reduce repeated branch snapshots and keep one authoritative outcome-oriented state view.';
    case 'incidental-internal-field-exposure':
      return 'Hide backend-oriented metadata fields and keep only workflow-handoff-relevant response fields.';
    case 'sibling-path-shape-drift':
    case 'endpoint-path-style-drift':
    case 'detail-path-parameter-name-drift':
      return 'Align path parameter names and response shapes across sibling endpoints.';
    case 'generic-object-request':
      return 'Replace the generic request object with explicit named properties.';
    case 'generic-object-response':
      return 'Replace the generic response object with explicit named properties.';
    case 'internal-incidental-field':
      return 'Hide internal or incidental fields from the public response schema.';
    default:
      return 'Inspect in schema: the location referenced by the issue message, then tighten the contract.';
  }
}

function uiBuildContextTypeBadge(context: OpenAPIContext): string {
  var label = context.primaryLabel || '';
  var text = '';
  if (label.indexOf('Request') !== -1) {
    text = 'Request';
  } else if (label.indexOf('Response') !== -1) {
    text = context.statusCode ? 'Response ' + context.statusCode : 'Response';
  } else if (label.indexOf('Path') !== -1) {
    text = 'Path';
  }
  if (!text) return '';
  return '<span class="context-type-badge">' + escapeHtml(text) + '</span>';
}

function uiFamilyPressureLabel(priorityCounts: StringMap<number>): string {
  var high = priorityCounts.high || 0;
  var medium = priorityCounts.medium || 0;
  if (high >= 3) return 'high';
  if (high > 0 || medium >= 3) return 'medium';
  return 'low';
}

function uiSummarizeIssueDimensions(findings: ExplorerFinding[]): { label: string; count: number }[] {
  var counts: StringMap<number> = {};
  findings.forEach(function (finding) {
    var label = uiIssueDimensionForFinding(finding.code || '', finding.category || '', finding.burdenFocus || '');
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.entries(counts)
    .sort(function (a, b) { return b[1] - a[1]; })
    .slice(0, 6)
    .map(function (entry) { return { label: entry[0], count: entry[1] }; });
}

function uiTopFamilyByFindings(rows: ExplorerEndpointRow[]): { name: string; findings: number } {
  if (!rows || !rows.length) return { name: 'none', findings: 0 };
  var counts: StringMap<number> = {};
  rows.forEach(function (row) {
    var familyName = row.family || '';
    counts[familyName] = (counts[familyName] || 0) + (row.findings || 0);
  });
  var ranked = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });
  return ranked.length ? { name: ranked[0][0], findings: ranked[0][1] } : { name: 'none', findings: 0 };
}

function uiRenderChipList(items: string[], emptyText: string): string {
  if (!items || !items.length) return '<p class="subtle">' + escapeHtml(emptyText) + '</p>';
  return '<div class="chips">' + items.map(function (item) {
    return '<span class="chip">' + escapeHtml(item) + '</span>';
  }).join('') + '</div>';
}

function uiRenderBulletList(items: string[], emptyText: string): string {
  if (!items || !items.length) return '<p class="subtle">' + escapeHtml(emptyText) + '</p>';
  return '<ul>' + items.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>';
}

function uiRenderOpenAPISummary(items: string[]): string {
  if (!items || !items.length) {
    return '<p class="subtle">OpenAPI location is only available where the message exposes request, response, field, or media-type detail.</p>';
  }
  return '<div class="openapi-summary-list">' + items.map(function (item) {
    return '<span class="openapi-pill">' + escapeHtml(item) + '</span>';
  }).join('') + '</div>';
}

function uiPriorityRank(priority: string): number {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

function uiUniq<T>(items: T[]): T[] {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function uiFlatMap<T, U>(items: T[], fn: (item: T) => U[]): U[] {
  return items.reduce(function (acc, item) { return acc.concat(fn(item)); }, [] as U[]);
}
