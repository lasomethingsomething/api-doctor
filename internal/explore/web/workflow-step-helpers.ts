declare function buildChainContext(
  chains: ExplorerWorkflowChain[],
  endpointId: string,
  endpointDetails: StringMap<ExplorerEndpointDetail>
): string;
declare function endpointIntentCue(method: string, path: string): string;
declare function escapeHtml(value: unknown): string;
declare function humanFamilyLabel(name: string): string;
declare function humanizeStepRole(roleSlug: string): string;
declare function inferWorkflowTransitionCue(clues: WorkflowDependencyClues, roleLabel: string): WorkflowTransitionCue | null;
declare function payloadEndpointDetails(): StringMap<ExplorerEndpointDetail>;
declare function pressureBadge(priority: string, kind?: string): string;
declare function renderFullExactEvidenceDrawer(
  groups: IssueGroup[],
  options?: { endpoint?: ExplorerEndpointRow; familyName?: string; open?: boolean }
): string;
declare function renderOpenAPILocationCuesBlock(context: OpenAPIContext, compact?: boolean): string;
declare function renderSpecRuleGroundingForGroup(group: IssueGroup): string;
declare function severityBadge(severity: string): string;
declare function uniq<T>(items: T[]): T[];
declare function buildContextTypeBadge(context: OpenAPIContext): string;
declare function buildIssueScopeIndex(
  rows: ExplorerEndpointRow[],
  endpointDetails: StringMap<ExplorerEndpointDetail> | null,
  findingsForLens: (findings: ExplorerFinding[]) => ExplorerFinding[],
  groupKeyForFinding: (finding: ExplorerFinding) => string
): IssueScopeIndex;
declare function dominantSeverity(findings: ExplorerFinding[]): string;
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function groupFindings(findings: ExplorerFinding[]): IssueGroup[];

function workflowStepBuildDependencyClues(
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
  var clues: WorkflowDependencyClues = { prereq: [], establish: [], nextNeeds: [], hidden: [] };
  var path = (endpoint.path || '').toLowerCase();
  var method = (endpoint.method || '').toUpperCase();
  var role = (roleLabel || '').toLowerCase();
  var nextPath = nextEndpoint ? (nextEndpoint.path || '').toLowerCase() : '';
  var nextMethod = nextEndpoint ? (nextEndpoint.method || '').toUpperCase() : '';
  var nextRole = (nextRoleLabel || '').toLowerCase();
  var isLast = stepIndex === (totalSteps - 1);
  var messages = (findings || []).map(function (f) { return f.message || ''; }).join(' | ');

  if (stepIndex > 0 && (role === 'action' || role === 'update' || role === 'delete' || role === 'checkout' || role === 'payment' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
    workflowSurfaceAddUniqueClue(clues.prereq, 'appears to require prior state from an earlier step');
  }
  if (/(header|authorization|bearer|access\s*key|api[-\s]?key|token|context)/i.test(messages)) {
    workflowSurfaceAddUniqueClue(clues.prereq, 'appears to require auth/header or context token');
  }
  if (path.indexOf('/_action/') !== -1 || role === 'action') {
    workflowSurfaceAddUniqueClue(clues.prereq, 'appears to require an earlier mutation or lookup');
  }
  if ((path.indexOf('cart') !== -1 || path.indexOf('order') !== -1 || path.indexOf('customer') !== -1) && stepIndex > 0) {
    workflowSurfaceAddUniqueClue(clues.prereq, 'suggests dependency on prior cart/customer/order context');
  }

  if (path.indexOf('auth') !== -1 || path.indexOf('login') !== -1 || path.indexOf('session') !== -1 || path.indexOf('register') !== -1) {
    workflowSurfaceAddUniqueClue(clues.establish, 'appears to establish auth context');
  }
  if (path.indexOf('customer') !== -1 && (method === 'POST' || role === 'create' || role === 'register' || role === 'login')) {
    workflowSurfaceAddUniqueClue(clues.establish, 'appears to establish customer context');
  }
  if (/(token|context)/i.test(messages)) {
    workflowSurfaceAddUniqueClue(clues.establish, 'appears to establish or store context token');
  }
  if (path.indexOf('cart') !== -1 && (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
    workflowSurfaceAddUniqueClue(clues.establish, 'appears to mutate cart state');
  }
  if (path.indexOf('order') !== -1 && method === 'POST') {
    workflowSurfaceAddUniqueClue(clues.establish, 'appears to create order identity');
  }
  if (path.indexOf('payment') !== -1 || role === 'payment' || role === 'checkout') {
    workflowSurfaceAddUniqueClue(clues.establish, 'appears to trigger payment follow-up');
  }
  if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
    workflowSurfaceAddUniqueClue(clues.establish, 'likely changes authoritative state for later calls');
  }

  if (!isLast && nextEndpoint) {
    if (/(token|context)/i.test(messages)) {
      workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely needs context token');
    }
    if (/(header|authorization|bearer|access\s*key|api[-\s]?key)/i.test(messages)) {
      workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely needs auth or access header');
    }
    if (nextPath.indexOf('{') !== -1 || nextRole === 'detail') {
      workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely needs cart/customer/order identity');
    }
    if (nextMethod === 'PATCH' || nextMethod === 'PUT' || nextMethod === 'DELETE' || nextRole === 'action') {
      workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely depends on changed state from this step');
    }
    if (nextPath.indexOf('payment') !== -1 || nextRole === 'payment' || nextRole === 'checkout') {
      workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely depends on prior order or transaction state');
    }
    if (nextPath.indexOf('/_action/') !== -1) {
      workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely needs action/context prerequisites');
    }
    if (!clues.nextNeeds.length && method === 'GET') {
      workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely needs selected resource context');
    }
  }

  if (linkageFindings.length) {
    workflowSurfaceAddUniqueClue(clues.hidden, 'does not clearly expose next required identifier or header');
    workflowSurfaceAddUniqueClue(clues.hidden, 'does not clearly expose authoritative token or context');
    workflowSurfaceAddUniqueClue(clues.hidden, isLast
      ? 'follow-up step appears brittle from contract alone'
      : 'next required state appears implicit in the contract');
  }
  if (prerequisiteFindings.length) {
    workflowSurfaceAddUniqueClue(clues.hidden, 'likely depends on prior state transition not clearly modeled');
  }
  if (/(follow[-\s]?up|next[-\s]?step|tracking|identifier)/i.test(messages) && !isLast) {
    workflowSurfaceAddUniqueClue(clues.hidden, 'suggests dependency on data not clearly surfaced in response fields');
  }

  return clues;
}

function workflowStepCollectTrapGuidance(
  endpoint: ExplorerEndpointRow,
  findings: ExplorerFinding[],
  clues: WorkflowDependencyClues,
  linkageFindings: ExplorerFinding[],
  prerequisiteFindings: ExplorerFinding[],
  nextEndpoint: ExplorerEndpointRow | null,
  roleLabel: string,
  isLast: boolean
): WorkflowTrapGuidance[] {
  var path = ((endpoint && endpoint.path) || '').toLowerCase();
  var nextPath = ((nextEndpoint && nextEndpoint.path) || '').toLowerCase();
  var messages = (findings || []).map(function (f) { return (f.message || '').toLowerCase(); }).join(' | ');
  var cluesText = ((clues && clues.prereq) || []).concat((clues && clues.establish) || [], (clues && clues.nextNeeds) || [], (clues && clues.hidden) || []).join(' | ').toLowerCase();
  var traps: WorkflowTrapGuidance[] = [];

  function addTrap(id: string, title: string, happened: string, whyMissed: string, next: string): void {
    if (traps.some(function (t) { return t.id === id; })) return;
    traps.push({ id: id, title: title, happened: happened, whyMissed: whyMissed, next: next });
  }

  var loginOrRegister = /login|register|auth|session/.test(path);
  var hasTokenContextSignals = /(token|context|authorization|bearer|auth)/.test(messages + ' | ' + cluesText);
  var hasAccessKeySignals = /(sw-access-key|access\s*key|api[-\s]?key)/.test(messages + ' | ' + cluesText);
  var hasLinkageSignals = (linkageFindings || []).length > 0 || /(next[-\s]?step|follow[-\s]?up|tracking|identifier|handoff)/.test(messages + ' | ' + cluesText);
  var hasPrereqSignals = (prerequisiteFindings || []).length > 0 || ((clues && clues.prereq) || []).length > 0;
  var hasShapeOutcomeSignals = false;

  if (loginOrRegister && hasTokenContextSignals) {
    addTrap('context-token-replacement-after-login-register', 'Context token replacement after login/register', 'This step can replace the active context/auth token.', 'Contract responses often do not clearly mark prior context as stale.', 'Treat previous token/context as invalid and persist the new token before downstream calls.');
  }
  if (/(cart)/.test(path + ' ' + nextPath) && hasTokenContextSignals) {
    addTrap('cart-loss-after-context-change', 'Cart loss after context change', 'Changing context can detach or invalidate the active cart reference.', 'Cart continuity is usually implicit, not modeled as an explicit invalidation rule.', 'Reload cart identity after context change, then continue checkout/update calls.');
  }
  if (/(store-api|store api|session|ephemeral)/.test(path + ' ' + messages + ' ' + cluesText) && hasTokenContextSignals) {
    addTrap('ephemeral-store-api-context', 'Ephemeral Store API context', 'Store API context appears ephemeral across requests.', 'TTL/replacement behavior is commonly omitted from explicit contract fields.', 'Read context token freshness per step and add retry/recovery for expired context.');
  }
  if (hasAccessKeySignals && hasTokenContextSignals) {
    addTrap('sw-access-key-vs-auth-token-confusion', 'sw-access-key vs auth token confusion', 'Both sw-access-key and auth/context token requirements appear in this flow.', 'Contract text can blur static key responsibilities vs per-session token handoff.', 'Document precedence and send each credential explicitly where required; fail fast on mismatch.');
  }
  if (hasPrereqSignals) {
    addTrap('hidden-prerequisites-before-step-valid', 'Hidden prerequisites before a step is valid', 'This step appears to require hidden prerequisite state before it is valid.', 'Required prior state/identifier is implied rather than explicitly modeled.', 'Surface prerequisite state in previous responses or add explicit precondition fields.');
  }
  if (hasPrereqSignals || hasLinkageSignals) {
    addTrap('runtime-taught-rule-contract-did-not', 'Runtime taught me the rule, contract did not', 'A behavioral rule is likely learned only at runtime, not from contract shape.', 'The schema does not provide enough explicit guardrails to predict the failure upfront.', 'Add explicit outcome/status/constraint fields so clients can validate before the next call.');
  }
  if (hasLinkageSignals || isLast) {
    addTrap('weak-or-absent-next-step-modeling', 'Weak or absent next-step modeling', 'Next-step modeling is weak or absent for this response.', 'There is no single explicit next-action/handoff field to follow safely.', 'Return nextAction plus required identifier/link in the response contract.');
  }
  if (hasShapeOutcomeSignals || /internal|snapshot|storage|model structure/.test(messages)) {
    addTrap('backend-internal-state-exposed-not-workflow-outcomes', 'Backend internal state exposed instead of workflow outcomes', 'Response emphasizes backend internal/storage state over workflow outcome.', 'Large snapshots look informative but hide completion meaning and next action.', 'Return compact outcome, authoritative state, and next action near top-level fields.');
  }

  return traps;
}

function workflowStepRenderTrapGuidanceList(
  traps: WorkflowTrapGuidance[],
  options?: { title?: string; className?: string; limit?: number }
): string {
  var opts = options || {};
  var list = (traps || []).slice(0, opts.limit || 3);
  if (!list.length) return '';
  var title = opts.title || 'Trap guidance';
  var cls = opts.className || 'trap-guidance';
  return '<section class="' + cls + '">'
    + '<p class="insight-kicker">' + escapeHtml(title) + '</p>'
    + '<ul class="trap-guidance-list">'
    + list.map(function (trap) {
        return '<li class="trap-guidance-item">'
          + '<p><strong>Trap:</strong> ' + escapeHtml(trap.title || trap.id) + '</p>'
          + '<p><strong>What happened:</strong> ' + escapeHtml(trap.happened) + '</p>'
          + '<p><strong>Easy to miss:</strong> ' + escapeHtml(trap.whyMissed) + '</p>'
          + '<p><strong>Do next:</strong> ' + escapeHtml(trap.next) + '</p>'
          + '</li>';
      }).join('')
    + '</ul>'
    + '</section>';
}

function workflowStepSummarizeNarrative(
  endpoint: ExplorerEndpointRow,
  roleLabel: string,
  nextEndpoint: ExplorerEndpointRow | null,
  clues: WorkflowDependencyClues,
  findings: ExplorerFinding[],
  linkageFindings: ExplorerFinding[],
  prerequisiteFindings: ExplorerFinding[],
  isLast: boolean
): WorkflowStepNarrative {
  var path = (endpoint.path || '').toLowerCase();
  var method = (endpoint.method || '').toUpperCase();
  var role = (roleLabel || '').toLowerCase();
  var nextPath = nextEndpoint ? ((nextEndpoint.path || '').toLowerCase()) : '';
  var messages = (findings || []).map(function (f) { return (f.message || '').toLowerCase(); }).join(' | ');

  var callDoes = endpointIntentCue(method, endpoint.path || '');
  if (role) {
    callDoes = humanizeStepRole(role) + ' (' + callDoes + ')';
  }

  var changed = '';
  if ((clues.establish || []).length) {
    changed = clues.establish[0];
  } else if (method === 'POST') {
    changed = 'creates new server-side state (response should expose the new identifier/status)';
  } else if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
    changed = 'mutates server-side state (response should expose the outcome and updated authoritative fields)';
  } else {
    changed = 'returns current state for downstream steps (response should expose the fields needed for the next call)';
  }

  var requiredState = '';
  if ((clues.prereq || []).length) {
    requiredState = clues.prereq[0];
  } else if ((clues.nextNeeds || []).length) {
    requiredState = clues.nextNeeds[0];
  } else if (/(token|context|authorization|header|access\s*key|api[-\s]?key)/i.test(messages)) {
    requiredState = 'auth/context token in response or headers';
  } else if (/(identifier|id|tracking)/i.test(messages) || /(\{[^}]+\})/.test(endpoint.path || '')) {
    requiredState = 'resource identifier carried forward from an earlier response';
  } else if (/cart|order|customer/.test(path)) {
    requiredState = 'current ' + (path.indexOf('cart') !== -1 ? 'cart' : (path.indexOf('order') !== -1 ? 'order' : 'customer')) + ' state';
  } else {
    requiredState = 'response state needed by downstream calls';
  }

  var nextAction = '';
  if (isLast) {
    nextAction = 'confirm outcome or poll if asynchronous';
  } else if (nextEndpoint) {
    nextAction = endpointIntentCue(nextEndpoint.method || '', nextEndpoint.path || '') + ' via ' + (nextEndpoint.method || '') + ' ' + (nextEndpoint.path || '');
    if ((clues.nextNeeds || []).length) {
      nextAction += ' (needs: ' + clues.nextNeeds[0] + ')';
    }
  } else {
    nextAction = 'follow-up step not inferred';
  }

  var traps: string[] = [];
  if ((/login|register|auth|session/.test(path)) && /(token|context|authorization|header|access\s*key|api[-\s]?key)/i.test(messages)) {
    traps.push('token/context replacement after login/register');
  }
  if (/cart/.test(path + ' ' + nextPath) && /(token|context|customer|auth)/i.test(messages + ' | ' + (clues.hidden || []).join(' | '))) {
    traps.push('cart invalidation after context change');
  }
  if (prerequisiteFindings.length || (clues.prereq || []).length) {
    traps.push('hidden prerequisites');
  }
  if ((/payment|checkout/.test(path) || role === 'payment' || role === 'checkout') && (isLast || linkageFindings.length || /(next[-\s]?step|follow[-\s]?up)/i.test(messages))) {
    traps.push('ambiguous payment next steps');
  }
  if (linkageFindings.length || /(identifier|tracking|handoff)/i.test(messages)) {
    traps.push('weak handoff identifiers');
  }

  return {
    callDoes: callDoes,
    changesAfter: changed,
    requiredState: requiredState,
    nextAction: nextAction,
    traps: uniq(traps)
  };
}

function workflowStepRender(
  endpointId: string,
  stepIndex: number,
  totalSteps: number,
  roleLabel: string,
  nextEndpointId: string,
  nextRoleLabel: string
): string {
  var endpointDetails = payloadEndpointDetails();
  var detail = endpointDetails[endpointId];
  if (!detail) return '';

  var endpoint = detail.endpoint;
  var findings = detail.findings || [];
  var nextDetail = nextEndpointId ? endpointDetails[nextEndpointId] : null;
  var nextEndpoint = nextDetail ? nextDetail.endpoint : null;

  var linkageFindings = findings.filter(function (f) {
    return f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage' || f.code === 'weak-outcome-next-action-guidance';
  });

  var prerequisiteFindings = findings.filter(function (f) {
    return f.code === 'prerequisite-task-burden';
  });

  var isLast = stepIndex === (totalSteps - 1);

  var warnings: WorkflowWarningBadge[] = [];
  if (linkageFindings.length) warnings.push({ type: 'linkage', count: linkageFindings.length, label: 'missing follow-up ID' });
  if (prerequisiteFindings.length) warnings.push({ type: 'prerequisite', count: prerequisiteFindings.length, label: 'hidden dependency' });

  var continuityBurden = '';
  if (isLast && linkageFindings.length) {
    continuityBurden = '<p class="workflow-burden-note"><strong>Workflow ends weakly:</strong> The response does not clearly expose the outcome or required next-step identifier. Clients may need manual confirmation or polling.</p>';
  } else if (!isLast && linkageFindings.length) {
    continuityBurden = '<p class="workflow-burden-note"><strong>Continuity burden:</strong> This step does not clearly expose the identifier or state needed for the next step. Clients must track or fetch separately.</p>';
  }

  var warningBadges = warnings.map(function (warning) {
    return '<span class="workflow-warning-badge workflow-warning-' + warning.type + '">'
      + '<strong>' + warning.count + '</strong> ' + warning.label
      + '</span>';
  }).join('');

  var dependencyClues = workflowStepBuildDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings);
  var dependencyHtml = workflowSurfaceRenderDependencyClues(dependencyClues);

  var roleSlug = roleLabel ? roleLabel.toLowerCase().replace(/[^a-z]/g, '') : '';
  var humanRole = roleLabel ? humanizeStepRole(roleLabel) : '';
  var roleHtml = humanRole
    ? '<span class="step-role-pill step-role-' + escapeHtml(roleSlug) + '">' + escapeHtml(humanRole) + '</span>'
    : '<span class="step-number">Step ' + (stepIndex + 1) + ' of ' + totalSteps + '</span>';

  var transitionCue = inferWorkflowTransitionCue(dependencyClues, roleLabel);
  var narrative = workflowStepSummarizeNarrative(endpoint, roleLabel, nextEndpoint, dependencyClues, findings, linkageFindings, prerequisiteFindings, isLast);
  var trapGuidance = workflowStepCollectTrapGuidance(endpoint, findings, dependencyClues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast);
  var narrativeHtml = '<div class="step-narrative">'
    + '<div class="step-narrative-row"><span class="step-narrative-label">What this call does</span><span class="step-narrative-value">' + escapeHtml(narrative.callDoes) + '</span></div>'
    + '<div class="step-narrative-row"><span class="step-narrative-label">What you need before calling it</span><span class="step-narrative-value">' + escapeHtml(narrative.requiredState) + '</span></div>'
    + '<div class="step-narrative-row"><span class="step-narrative-label">Authoritative state after success</span><span class="step-narrative-value">' + escapeHtml(narrative.changesAfter || '') + '</span></div>'
    + '<div class="step-narrative-row"><span class="step-narrative-label">What to call next</span><span class="step-narrative-value">' + escapeHtml(narrative.nextAction) + '</span></div>'
    + '</div>';
  var trapHtml = workflowStepRenderTrapGuidanceList(trapGuidance, {
    title: 'Common hidden traps',
    className: 'step-trap-guidance',
    limit: 2
  });
  var arrow = '';
  if (!isLast) {
    var connectorClass = transitionCue ? (' workflow-connector-' + transitionCue.kind) : '';
    var arrowClass = transitionCue && transitionCue.kind === 'weak' ? ' workflow-arrow-weak' : '';
    var cueHtml = transitionCue
      ? '<span class="workflow-transition-chip workflow-transition-' + transitionCue.kind + '">' + escapeHtml(transitionCue.label) + '</span>'
      : '';
    arrow = '<div class="workflow-connector' + connectorClass + '">'
      + '<div class="workflow-arrow' + arrowClass + '">\u2192</div>'
      + cueHtml
      + '</div>';
  }

  return '<div class="workflow-step" data-step-id="' + escapeHtml(endpointId) + '">'
    + '<div class="step-box">'
    + roleHtml
    + '<div class="step-endpoint">'
    + '<strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>'
    + '</div>'
    + narrativeHtml
    + (dependencyHtml || '')
    + trapHtml
    + (warningBadges ? '<div class="step-warnings">' + warningBadges + '</div>' : '')
    + (continuityBurden || '')
    + '<div class="step-actions">'
    + '<button type="button" class="secondary-action step-open-evidence" data-step-open-evidence="' + escapeHtml(endpointId) + '">Open endpoint evidence</button>'
    + '</div>'
    + '<span class="step-inspect-hint">\u2197 inspect detail: exact issue text</span>'
    + '</div>'
    + arrow
    + '</div>';
}
