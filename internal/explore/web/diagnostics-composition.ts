function diagnosticsCollectShapePainSignals(endpoint: ExplorerEndpointRow | null | undefined, findings: ExplorerFinding[]): ShapePainSignal[] {
  var path = ((endpoint && endpoint.path) || '').toLowerCase();
  var method = ((endpoint && endpoint.method) || '').toUpperCase();
  var signals: ShapePainSignal[] = [];

  function hasCode(code: string): boolean {
    return (findings || []).some(function (f) { return (f.code || '') === code; });
  }
  function hasMsgMatch(re: RegExp): boolean {
    return (findings || []).some(function (f) { return re.test((f.message || '').toLowerCase()); });
  }

  var isOrder = /\/order/.test(path);
  var isCart = /\/cart/.test(path);
  var isPayment = /\/payment|\/checkout/.test(path);
  var isProduct = /\/product/.test(path);
  var isCustomer = /\/customer/.test(path);
  var isAction = path.indexOf('/_action/') !== -1;
  var isMutation = method === 'POST' || method === 'PATCH' || method === 'PUT';

  if (hasCode('deeply-nested-response-structure') || hasMsgMatch(/nested|deep/)) {
    var nestEx = isOrder
      ? 'An order creation response returns the full order graph: lineItems[].product.media[].thumbnails.url alongside billing/shipping addresses, all at equal depth. The "did my order succeed?" answer is buried 3–4 levels down in a structure meant for the database, not the client.'
      : isCart
      ? 'Cart mutation returns the full cart snapshot. The updated price the developer actually needs requires traversing lineItems[] to unitPrice to gross, while product thumbnails and nested options sit at the same depth.'
      : 'The response nests outcome data inside multiple levels of objects or arrays, placing immediately-relevant fields (status, id, next action) at the same depth as incidental configuration data.';
    var nestNeeded = isOrder
      ? '{ "orderId": "…", "status": "open", "paymentRequired": true, "paymentUrl": "…" }'
      : isCart
      ? '{ "token": "…", "itemCount": 3, "total": { "gross": 99.95, "currency": "EUR" }, "nextAction": "checkout" }'
      : 'A flat outcome block with changed state and next action near the top, not buried inside nested objects.';
    signals.push({
      code: 'deep-nesting',
      label: 'Deep nesting hides outcome meaning',
      pain: 'Developers must traverse multiple nesting levels to reach what actually changed. Access paths like response.lineItems[0].product.price.gross become fragile — a schema change at any level silently breaks the client. The fields needed for the next API call may require 4+ chained property lookups.',
      example: nestEx,
      callerNeeded: nestNeeded,
      notice: 'Outcome IDs/status/nextAction are not top-level, so callers must traverse incidental branches to continue the workflow.',
      recommendedChange: 'Flatten outcome and nextAction fields near the top level (or add a dedicated outcome block) so clients can read the result without deep traversal.',
      icon: 'Depth'
    });
  }

  if (hasCode('snapshot-heavy-response') || hasCode('contract-shape-workflow-guidance-burden') || hasMsgMatch(/snapshot|storage|model structure|full model/)) {
    var snapEx = isOrder || isPayment
      ? 'POST /order returns the full persisted entity: internal tracking fields, all audit timestamps, every configuration object, every address format — when the developer only needed to know: order was created, here\'s your ID and payment URL. The "created" confirmation is on equal footing with versionId and autoIncrement.'
      : isCart
      ? 'PATCH /line-item returns the full cart snapshot including product metadata, nested shipping options, and pricing rules — when the developer only needed to confirm the line item was added and see the updated total.'
      : 'The response mirrors the internal storage model rather than summarising the task outcome. Outcome-critical fields (status, authoritative ID, next step) are equally weighted with internal bookkeeping.';
    var snapNeeded = isOrder
      ? '{ "id": "…", "orderNumber": "10001", "status": "open", "paymentUrl": "/payment/handle/…", "confirmationRequired": false }'
      : isCart
      ? '{ "token": "…", "gross": 99.95, "net": 84.00, "tax": 15.95, "currency": "EUR", "itemCount": 3 }'
      : 'A compact outcome-first payload: status, authoritative identifiers, and next action close to the top level with incidental fields omitted.';
    signals.push({
      code: 'snapshot-heavy',
      label: 'Storage-shaped response — the database model mirrors back',
      pain: 'The response reflects what the server stores rather than what the caller needs next. Developers must reverse-engineer which fields are authoritative, which are incidental, and what the operation actually changed. Onboarding cost multiplies because there is no contract-level hint about purpose — developers read the whole object hoping to find the relevant fragment.',
      example: snapEx,
      callerNeeded: snapNeeded,
      notice: 'The success outcome is not foregrounded; storage/internal fields compete visually with the task result.',
      recommendedChange: 'Return a compact outcome-first payload (ids, status, nextActions) and move full snapshots behind explicit follow-up endpoints.',
      icon: 'Snapshot'
    });
  }

  if (hasCode('duplicated-state-response') || hasMsgMatch(/duplicate|source of truth|authoritative/)) {
    var dupEx = isOrder
      ? 'order.status, order.stateMachineState.name, and order.stateMachineState.technicalName all appear in the same response and express the same concept. If any diverge (due to cache lag or partial write), the developer has no contract-based way to decide which is authoritative.'
      : 'The same conceptual state appears under multiple keys in the response — for example price appearing in both lineItem.price and lineItem.unitPrice.gross — with no documented source-of-truth.';
    var dupNeeded = isOrder
      ? 'A single explicit status field. If state machine detail is needed separately, expose it as a sub-resource: { "status": "open", "stateDetail": "/order/{id}/state" }'
      : 'One canonical field name mapped to one authoritative value. Derived representations removed or explicitly labelled as read-only views.';
    signals.push({
      code: 'duplicated-state',
      label: 'Duplicated state — no clear source of truth',
      pain: 'When the same concept appears under multiple keys, developers pick one and rely on it. When those values diverge in production (cache lag, eventual consistency, partial update), the bug is silent until a customer notices. Client code that picked the "wrong" duplicate is correct until the day it isn\'t.',
      example: dupEx,
      callerNeeded: dupNeeded,
      notice: 'The same domain concept is represented multiple ways with no contract hint about which field is authoritative.',
      recommendedChange: 'Pick one canonical field for the concept (status/total/etc), remove duplicates, and if derived views must remain, label them explicitly as derived/read-only.',
      icon: 'State'
    });
  }

  if (hasCode('incidental-internal-field-exposure') || hasMsgMatch(/internal|incidental|audit|raw id/)) {
    var intEx = isOrder || isProduct
      ? 'The order response includes fields like createdById, updatedAt, versionId, autoIncrement, childCount, and raw UUID join columns alongside the orderNumber, status, and total that the developer actually uses. Every internal field adds cognitive load and becomes a silent coupling surface.'
      : isCustomer
      ? 'Customer detail includes internal fields like legacyEncoderKey, versionId, and raw storage IDs. Developers who key off these create coupling to the backend\'s storage layer, not the domain model.'
      : 'Storage-level identifiers, audit timestamps, and backend join columns appear alongside domain-level response data at equal depth.';
    var intNeeded = isOrder
      ? 'Domain fields only: { "id": "…", "orderNumber": "…", "customerId": "…", "status": "…", "total": { "gross": …, "currency": "…" } }'
      : 'Only fields that carry domain meaning or are needed for the next API call. Internal/audit fields behind a separate admin-scoped endpoint if tooling genuinely needs them.';
    signals.push({
      code: 'internal-fields',
      label: 'Incidental internal fields crowd out domain meaning',
      pain: 'Internal fields force developers to figure out which fields matter. They become accidental documentation targets: once a developer couples client code to versionId or autoIncrement, those fields can\'t be renamed without a breaking change. The contract grows stickier in the wrong direction.',
      example: intEx,
      callerNeeded: intNeeded,
      notice: 'Backend/audit/join fields appear alongside domain fields at equal depth, encouraging accidental coupling.',
      recommendedChange: 'Remove internal/audit fields from the default success payload (or move them to explicitly internal components/endpoints) and keep only domain + workflow-handoff fields.',
      icon: 'Internal'
    });
  }

  if (hasCode('weak-outcome-next-action-guidance') || hasMsgMatch(/outcome|what changed|result mean/)) {
    var outEx = isPayment
      ? 'POST /handle-payment returns 200 but the body doesn\'t indicate whether payment was accepted, deferred, or requires redirect. The developer writes a secondary GET to confirm state — a round-trip the contract could have eliminated.'
      : isAction
      ? 'An /_action/ endpoint returns 200 with data but no outcome framing. Was the action applied? Is it pending? Does the caller need to poll? The developer must infer this from context or read docs each time.'
      : isMutation
      ? 'A mutation (POST/PATCH/PUT) returns the resource but doesn\'t clearly distinguish between \'I applied your changes immediately\' and \'I queued them\' or \'this requires a follow-up confirmation step\'.'
      : 'The response contains populated fields but no framing that contextualises the result. Success vs partial success vs async acceptance look the same to the caller.';
    var outNeeded = isPayment
      ? '{ "outcome": "redirect_required", "redirectUrl": "…", "transactionId": "…", "pollFor": "transaction.status" }'
      : isAction
      ? '{ "outcome": "accepted", "appliedNow": false, "transitionTo": "in_progress", "followUp": "/order/{id}/state" }'
      : '{ "applied": true, "status": "confirmed", "nextAction": null } — or for async: { "accepted": true, "pendingConfirmation": true, "confirmUrl": "…" }';
    signals.push({
      code: 'missing-outcome',
      label: 'Missing outcome framing — caller must infer what happened',
      pain: 'Without explicit outcome framing, developers write defensive code that checks 3–4 fields to infer state. "Did it work?" becomes a runtime question that needs a contract-level answer. Integration tests grow complex because they must mock guesses rather than trust explicit outcome fields.',
      example: outEx,
      callerNeeded: outNeeded,
      notice: 'Success/accepted/pending outcomes look the same; clients must poll or do follow-up reads to confirm what happened.',
      recommendedChange: 'Add explicit outcome fields (applied/accepted/pending, status, trackingId/confirmUrl) so clients can continue without reverse-engineering.',
      icon: 'Outcome'
    });
  }

  if (hasCode('weak-follow-up-linkage') || hasCode('weak-action-follow-up-linkage') || hasCode('weak-accepted-tracking-linkage') || hasMsgMatch(/next[-\s]?step|follow[-\s]?up|tracking/)) {
    var nextEx = isOrder
      ? 'POST /order succeeds but the response doesn\'t include a payment URL, whether confirmation is needed, or any indication of required customer steps. The developer reads the API docs or asks in Slack to learn these rules — then hard-codes assumptions that can break when the payment provider changes.'
      : isCart
      ? 'PATCH /cart returns the updated cart but doesn\'t indicate whether the cart is now ready for checkout or if there are blockers (e.g., shipping method not selected, item now out of stock). The developer polls or adds defensive checks.'
      : 'The operation completes but the response does not expose what the next call needs to be, which ID to carry forward, or whether additional steps are required before the workflow continues.';
    var nextNeeded = isOrder
      ? '{ "orderId": "…", "status": "open", "nextActions": [{ "type": "payment", "url": "…", "required": true }] }'
      : isCart
      ? '{ "token": "…", "readyForCheckout": false, "blockers": [{ "type": "shippingMethod", "message": "Select a shipping method to continue" }] }'
      : 'An explicit nextAction field or _links object that guides the caller to the next step without requiring out-of-band documentation.';
    signals.push({
      code: 'missing-next-action',
      label: 'Missing next-action cues — handoff requires reading docs',
      pain: 'Without next-step cues, developers learn the call sequence from documentation, Slack questions, or reverse-engineering prior implementations. This multiplies per-developer integration time and produces brittle hard-coded assumptions about workflow sequencing — assumptions that break when the workflow changes.',
      example: nextEx,
      callerNeeded: nextNeeded,
      notice: 'The response does not name the next valid operation or provide the identifier/linkage needed for the next step.',
      recommendedChange: 'Expose `nextActions` (or `_links`) with the next endpoint(s), required context, and handoff IDs so the workflow can be chained deterministically.',
      icon: 'Next'
    });
  }

  return signals;
}

function diagnosticsCollectConcreteNextActions(
  endpoint: ExplorerEndpointRow,
  findings: ExplorerFinding[],
  helpers: {
    findingsForActiveLens: (findings: ExplorerFinding[]) => ExplorerFinding[];
    extractOpenAPIContext: (finding: ExplorerFinding) => OpenAPIContext;
    buildContractImprovementItems: (detail: { endpoint: ExplorerEndpointRow }, findings: ExplorerFinding[]) => ContractImprovementItem[];
  }
): string[] {
  var actions: string[] = [];
  var seen: StringMap<boolean> = {};

  function push(action: string): void {
    if (!action) return;
    var key = action.trim().toLowerCase();
    if (!key || seen[key]) return;
    seen[key] = true;
    actions.push(action);
  }

  var endpointLabel = (endpoint && endpoint.method && endpoint.path) ? (endpoint.method + ' ' + endpoint.path) : 'this endpoint';
  var lensFindings = helpers.findingsForActiveLens(findings || []);

  var missingDescCodes: StringMap<boolean> = {};
  lensFindings.forEach(function (finding) {
    if (!finding || finding.evidenceType !== 'spec-rule') return;
    var ruleId = finding.specRuleId || finding.code || '';
    if (ruleId !== 'OAS-RESPONSE-DESCRIPTION-REQUIRED') return;
    var ctx = helpers.extractOpenAPIContext(finding);
    if (ctx && ctx.statusCode) missingDescCodes[ctx.statusCode] = true;
  });
  var descCodes = Object.keys(missingDescCodes).sort();
  if (descCodes.length) {
    push('Add missing response descriptions for responses ' + descCodes.join('/') + ' on ' + endpointLabel + '.');
  }

  var enumField = '';
  lensFindings.some(function (finding) {
    if (!finding) return false;
    if ((finding.code || '') !== 'likely-missing-enum') return false;
    var msg = finding.message || '';
    var match = msg.match(/property '([^']+)'/) || msg.match(/field '([^']+)'/);
    enumField = match ? match[1] : (helpers.extractOpenAPIContext(finding).primaryValue || '');
    return true;
  });
  if (enumField) {
    push('Declare enum values for ' + enumField + '.');
  }

  var hasNextAction = lensFindings.some(function (f) {
    var c = (f && f.code) ? f.code : '';
    return c === 'weak-outcome-next-action-guidance'
      || c === 'weak-follow-up-linkage'
      || c === 'weak-action-follow-up-linkage'
      || c === 'weak-accepted-tracking-linkage'
      || c === 'prerequisite-task-burden';
  });
  if (hasNextAction) {
    push('Expose `nextAction` and required context/handoff identifiers explicitly in the response.');
  }

  if (actions.length < 1) {
    var items = helpers.buildContractImprovementItems({ endpoint: endpoint }, lensFindings);
    items.slice(0, 2).forEach(function (item) {
      if (!item || !item.change) return;
      push(item.change + (item.where ? (' (Where: ' + item.where + ')') : ''));
    });
  }

  return actions;
}

function diagnosticsRenderWhatToDoNextBlock(
  endpoint: ExplorerEndpointRow | null | undefined,
  findings: ExplorerFinding[],
  options: { maxItems?: number; leadCopy?: string; showEndpointLabel?: boolean } | null | undefined,
  helpers: {
    escapeHtml: (value: unknown) => string;
    collectConcreteNextActions: (endpoint: ExplorerEndpointRow, findings: ExplorerFinding[]) => string[];
  }
): string {
  var opts = options || {};
  var maxItems = typeof opts.maxItems === 'number' ? opts.maxItems : 2;
  var endpointLabel = (endpoint && endpoint.method && endpoint.path) ? (endpoint.method + ' ' + endpoint.path) : '';

  var actions = helpers.collectConcreteNextActions(endpoint || createEmptyEndpointRow(), findings || []);
  if (!actions.length) return '';
  actions = actions.slice(0, Math.max(1, maxItems));

  var headline = 'What to do next';
  var lead = opts.leadCopy || 'Pick one of these concrete changes and apply it directly in the OpenAPI contract.';

  return '<section class="next-actions-block" aria-label="' + helpers.escapeHtml(headline) + '">'
    + '<p class="next-actions-title">' + helpers.escapeHtml(headline) + '</p>'
    + (lead ? '<p class="subtle next-actions-lead">' + helpers.escapeHtml(lead) + '</p>' : '')
    + '<ul class="next-actions-list">'
    + actions.map(function (a) { return '<li>' + helpers.escapeHtml(a) + '</li>'; }).join('')
    + '</ul>'
    + (endpointLabel && opts.showEndpointLabel ? '<p class="subtle next-actions-endpoint">' + helpers.escapeHtml(endpointLabel) + '</p>' : '')
    + '</section>';
}

function diagnosticsRenderCleaner(
  detail: ExplorerEndpointDetail,
  helpers: {
    findingsForActiveLens: (findings: ExplorerFinding[]) => ExplorerFinding[];
    buildContractImprovementItems: (detail: ExplorerEndpointDetail, findings: ExplorerFinding[]) => ContractImprovementItem[];
    collectShapePainSignals: (endpoint: ExplorerEndpointRow, findings: ExplorerFinding[]) => ShapePainSignal[];
    escapeHtml: (value: unknown) => string;
  }
): string {
  var findings = helpers.findingsForActiveLens(detail.findings || []);
  var endpoint = detail.endpoint || createEmptyEndpointRow();
  var improvementItems = helpers.buildContractImprovementItems(detail, findings);
  var painSignals = helpers.collectShapePainSignals(endpoint, findings);
  var signalSummaryHtml = painSignals.length
    ? '<div class="cleaner-signal-summary">'
      + painSignals.map(function (s) {
        return '<span class="cleaner-signal-chip">' + s.icon + ' ' + helpers.escapeHtml(s.label) + '</span>';
      }).join('')
      + '</div>'
    : '';

  if (improvementItems.length) {
    return '<div class="endpoint-diag-pane">'
      + signalSummaryHtml
      + '<section class="detail-section detail-section-tight contract-improvements-list">'
      + '<h3>Contract improvements</h3>'
      + '<p class="subtle detail-section-copy">Concrete response/schema edits for <strong>' + helpers.escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>.</p>'
      + '<div class="contract-improvements-items">'
      + improvementItems.map(function (item) {
        var inspect = item.inspect || item.where || '';
        return '<article class="contract-improvement-item">'
          + '<p><strong>Change:</strong> ' + helpers.escapeHtml(item.change) + '</p>'
          + '<p><strong>Where:</strong> ' + helpers.escapeHtml(item.where) + '</p>'
          + (inspect ? ('<p><strong>Inspect in schema:</strong> ' + helpers.escapeHtml(inspect) + '</p>') : '')
          + '<p><strong>Why:</strong> ' + helpers.escapeHtml(item.why) + '</p>'
          + '</article>';
      }).join('')
      + '</div>'
      + '</section>'
      + '</div>';
  }

  return '<div class="endpoint-diag-pane">'
    + signalSummaryHtml
    + '<p class="subtle">No concrete response or schema edit could be derived from the current findings.</p>'
    + '</div>';
}

function diagnosticsRenderConsistency(
  detail: ExplorerEndpointDetail,
  helpers: {
    consistencyFindingsForDetail: (findings: ExplorerFinding[]) => ExplorerFinding[];
    selectedEndpointId: string;
    payload: { endpoints?: ExplorerEndpointRow[] } | null | undefined;
    escapeHtml: (value: unknown) => string;
    humanFamilyLabel: (name: string) => string;
  }
): string {
  var endpoint = detail.endpoint || createEmptyEndpointRow();
  var findings = detail.findings || [];
  var consistencyFindings = helpers.consistencyFindingsForDetail(findings);
  var siblings = ((helpers.payload && helpers.payload.endpoints) || []).filter(function (row: ExplorerEndpointRow) {
    return row.id !== helpers.selectedEndpointId && (row.family || 'unlabeled family') === (endpoint.family || 'unlabeled family');
  }).slice(0, 6);

  var codesSeen: StringMap<boolean> = {};
  consistencyFindings.forEach(function (f) {
    codesSeen[f.code || ''] = true;
  });

  var driftBullets: string[] = [];
  if (codesSeen['detail-path-parameter-name-drift']) driftBullets.push('Parameter naming drift detected for this endpoint.');
  if (codesSeen['endpoint-path-style-drift'] || codesSeen['sibling-path-shape-drift']) driftBullets.push('Path style drift detected against sibling routes.');
  if (codesSeen['inconsistent-response-shape'] || codesSeen['inconsistent-response-shape-family'] || codesSeen['inconsistent-response-shapes'] || codesSeen['inconsistent-response-shapes-family']) {
    driftBullets.push('Response shape/outcome drift detected in related endpoints.');
  }

  return '<div class="endpoint-diag-pane">'
    + '<div class="family-insight-card">'
    + '<p class="insight-kicker">Consistency / drift for selected endpoint</p>'
    + '<p class="subtle">Selection context: ' + helpers.escapeHtml(endpoint.method + ' ' + endpoint.path) + ' | ' + helpers.escapeHtml(helpers.humanFamilyLabel(endpoint.family)) + '</p>'
    + (driftBullets.length
      ? '<ul class="family-top-evidence">' + driftBullets.map(function (b) { return '<li>' + helpers.escapeHtml(b) + '</li>'; }).join('') + '</ul>'
      : '<p class="subtle">No direct consistency drift findings are attached to this endpoint in the current view.</p>')
    + (consistencyFindings.length
      ? '<details class="detail-evidence-drawer">'
        + '<summary>Consistency evidence (' + consistencyFindings.length + ')</summary>'
        + '<ul class="family-top-evidence">'
        + consistencyFindings.slice(0, 8).map(function (f) { return '<li><strong>' + helpers.escapeHtml(f.code || 'consistency') + ':</strong> ' + helpers.escapeHtml(f.message || '') + '</li>'; }).join('')
        + '</ul>'
        + '</details>'
      : '')
    + (siblings.length
      ? '<p class="insight-kicker endpoint-diag-subkicker">Sibling endpoints for comparison</p><ul class="family-workflow-context">'
        + siblings.map(function (s) { return '<li>' + helpers.escapeHtml(s.method + ' ' + s.path) + '</li>'; }).join('')
        + '</ul>'
      : '<p class="subtle">No sibling endpoints available in this family for drift comparison.</p>')
    + '</div>'
    + '</div>';
}

function diagnosticsRenderConsistencySupportCard(
  detail: ExplorerEndpointDetail,
  options: { title?: string; emptyText?: string } | null | undefined,
  helpers: {
    consistencyFindingsForDetail: (findings: ExplorerFinding[]) => ExplorerFinding[];
    escapeHtml: (value: unknown) => string;
  }
): string {
  var opts = options || {};
  var endpoint = (detail && detail.endpoint) || createEmptyEndpointRow();
  var consistencyFindings = helpers.consistencyFindingsForDetail((detail && detail.findings) || []);
  var lines: string[] = [];
  var codesSeen: StringMap<boolean> = {};
  consistencyFindings.forEach(function (f) {
    codesSeen[f.code || ''] = true;
  });

  if (codesSeen['detail-path-parameter-name-drift']) lines.push('Parameter naming drift vs sibling routes.');
  if (codesSeen['endpoint-path-style-drift'] || codesSeen['sibling-path-shape-drift']) lines.push('Path style drift against related endpoints.');
  if (codesSeen['inconsistent-response-shape'] || codesSeen['inconsistent-response-shape-family'] || codesSeen['inconsistent-response-shapes'] || codesSeen['inconsistent-response-shapes-family']) {
    lines.push('Response shape or outcome wording drift across similar operations.');
  }

  var body = lines.length
    ? '<ul class="family-top-evidence">' + lines.slice(0, 3).map(function (line) { return '<li>' + helpers.escapeHtml(line) + '</li>'; }).join('') + '</ul>'
    : '<p class="subtle">' + helpers.escapeHtml(opts.emptyText || 'No direct consistency/drift signal is attached to this endpoint.') + '</p>';

  return '<div class="family-insight-card">'
    + '<p class="insight-kicker">' + helpers.escapeHtml(opts.title || 'Consistency / drift (supporting view)') + '</p>'
    + '<p class="subtle">' + helpers.escapeHtml(endpoint.method + ' ' + endpoint.path) + ' keeps drift analysis available as supporting context, not a primary navigation path.</p>'
    + body
    + '</div>';
}
