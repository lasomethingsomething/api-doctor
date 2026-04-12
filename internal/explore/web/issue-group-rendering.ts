function issueGroupRenderOpenAPIContextPills(
  context: OpenAPIContext,
  compact: boolean,
  escapeHtml: (value: unknown) => string
): string {
  var pills = [];
  if (!compact) {
    if (context.primaryLabel && context.primaryValue) {
      pills.push('<span class="openapi-pill"><strong>' + escapeHtml(context.primaryLabel) + ':</strong> ' + escapeHtml(context.primaryValue) + '</span>');
    } else if (context.primaryLabel) {
      pills.push('<span class="openapi-pill"><strong>' + escapeHtml(context.primaryLabel) + '</strong></span>');
    }
    if (context.statusCode) {
      pills.push('<span class="openapi-pill"><strong>Response code:</strong> ' + escapeHtml(context.statusCode) + '</span>');
    }
  }
  if (context.mediaType) {
    pills.push('<span class="openapi-pill"><strong>Media type:</strong> ' + escapeHtml(context.mediaType) + '</span>');
  }

  if (!pills.length) {
    return compact ? '' : '<span class="openapi-pill subtle">OpenAPI location not derivable from this message.</span>';
  }

  return pills.join('');
}

function issueGroupRenderOpenAPILocationCuesBlock(
  context: OpenAPIContext | null | undefined,
  compact: boolean,
  escapeHtml: (value: unknown) => string
): string {
  var pills = issueGroupRenderOpenAPIContextPills(context || createEmptyOpenAPIContext(), !!compact, escapeHtml);
  var body = pills
    ? ('<div class="openapi-summary-list">' + pills + '</div>')
    : '<p class="subtle location-cues-empty">No location cues available.</p>';
  return '<div class="location-cues-block">'
    + '<div class="location-cues-heading">OpenAPI location cues</div>'
    + body
    + '</div>';
}

function issueGroupFormatTitle(
  finding: ExplorerFinding,
  context: OpenAPIContext,
  issueDimensionForFinding: (code: string, category: string, burdenFocus: string) => string
): string {
  var dimension = issueDimensionForFinding(finding.code, finding.category, finding.burdenFocus);
  if (context.primaryLabel === 'Request schema field' || context.primaryLabel === 'Response schema field' || context.primaryLabel === 'Path parameter') {
    return context.primaryValue ? context.primaryValue + ' | ' + dimension : dimension;
  }
  return dimension;
}

function issueGroupFormatCountLabel(group: IssueGroup | null | undefined): string {
  if (!group) return 'No grouped issue label available';
  var title = (group.title || '').trim();
  var dimension = (group.dimension || '').trim();
  var target = '';
  var ctx = group.context || createEmptyOpenAPIContext();
  if (ctx.primaryValue) target = String(ctx.primaryValue);
  var baseTitle = group.title || 'Grouped issue';
  var count = group.count || 0;
  var unit = count === 1 ? 'occurrence' : 'occurrences';
  if (!group.isSpecRule) {
    if (dimension === 'hidden dependency / linkage burden') {
      return (target
        ? ('Required handoff or follow-up field is unclear: ' + target)
        : 'Required handoff or follow-up field is unclear')
        + ' - ' + count + ' ' + unit + ' on this endpoint';
    }
    if (dimension === 'workflow outcome weakness') {
      return (target
        ? ('Response does not clearly say what changed or what to do next: ' + target)
        : 'Response does not clearly say what changed or what to do next')
        + ' - ' + count + ' ' + unit + ' on this endpoint';
    }
    if (dimension === 'shape / storage-style response weakness') {
      return (target
        ? ('Response shape is too storage-oriented for the next step: ' + target)
        : 'Response shape is too storage-oriented for the next step')
        + ' - ' + count + ' ' + unit + ' on this endpoint';
    }
  }
  return baseTitle + ' - ' + count + ' ' + unit + ' on this endpoint';
}

function issueGroupTopFieldPaths(groups: IssueGroup[], uniq: (items: string[]) => string[]): string[] {
  return uniq((groups || []).map(function (group) {
    if (!group.context) return '';
    if (group.context.primaryLabel === 'Request schema field' || group.context.primaryLabel === 'Response schema field' || group.context.primaryLabel === 'Path parameter') {
      return group.context.primaryValue;
    }
    return '';
  })).slice(0, 6);
}

function issueGroupTopOpenAPIHighlights(groups: IssueGroup[], uniq: (items: string[]) => string[]): string[] {
  var highlights: string[] = [];
  (groups || []).forEach(function (group) {
    if (group.context && group.context.primaryLabel) {
      if (group.context.primaryValue) {
        highlights.push(group.context.primaryLabel + ': ' + group.context.primaryValue);
      } else {
        highlights.push(group.context.primaryLabel);
      }
    }
    if (group.context && group.context.mediaType) {
      highlights.push('Media type: ' + group.context.mediaType);
    }
  });
  return uniq(highlights).slice(0, 6);
}

function issueGroupRenderGroup(
  group: IssueGroup,
  index: number,
  options: { familyName?: string; commonScopeLabel?: string; endpoint?: ExplorerEndpointRow | null } | null | undefined,
  helpers: {
    escapeHtml: (value: unknown) => string;
    severityBadge: (severity: string) => string;
    renderSpecRuleGroundingForGroup: (group: IssueGroup) => string;
    inspectTargetForGroup: (group: IssueGroup, endpoint: ExplorerEndpointRow | null | undefined) => string;
    issueScopeLabelForKey: (groupKey: string, familyName: string) => string;
  }
): string {
  options = options || {};
  var escapeHtml = helpers.escapeHtml;
  var openAttr = index < 2 ? ' open' : '';
  var cap = 3;
  var visibleMsgs = (group.isSpecRule && group.messages.length > cap)
    ? group.messages.slice(0, cap) : group.messages;
  var hiddenCount = group.messages.length - visibleMsgs.length;
  var messageList = visibleMsgs.map(function (message: string) {
    return '<li>' + escapeHtml(message) + '</li>';
  }).join('');
  var expandMore = hiddenCount > 0
    ? '<details class="spec-rule-expand"><summary class="spec-rule-expand-toggle">+' + hiddenCount + ' more occurrences</summary>'
      + '<ul>' + group.messages.slice(cap).map(function (message: string) { return '<li>' + escapeHtml(message) + '</li>'; }).join('') + '</ul>'
      + '</details>'
    : '';
  var openAPICuesBlock = issueGroupRenderOpenAPILocationCuesBlock(group.context, true, escapeHtml);
  var specGrounding = group.isSpecRule ? helpers.renderSpecRuleGroundingForGroup(group) : '';
  var openAPIMeta = '  <div class="issue-group-meta">' + openAPICuesBlock + '</div>';

  function issueGroupKindLabel(innerGroup: IssueGroup | null | undefined): string {
    if (!innerGroup) return 'Issue';
    if (innerGroup.isSpecRule) return 'Spec rule';
    var dim = (innerGroup.dimension || '').trim();
    if (!dim) return 'Issue';
    return dim.replace(/(^|\s)([a-z])/g, function (_, prefix, chr) { return prefix + chr.toUpperCase(); });
  }

  function issueGroupHumanTitle(innerGroup: IssueGroup | null | undefined): string {
    if (!innerGroup) return 'Grouped issue';
    if (innerGroup.isSpecRule) return innerGroup.title || innerGroup.specRuleId || 'Spec rule';
    return innerGroup.title || innerGroup.preview || innerGroup.code || 'Issue';
  }

  function issueGroupResponseCodes(innerGroup: IssueGroup | null | undefined): string {
    var ctx = innerGroup && innerGroup.context ? innerGroup.context : createEmptyOpenAPIContext();
    if (ctx.statusCodes && ctx.statusCodes.length) return ctx.statusCodes.join('/');
    if (ctx.statusCode) return String(ctx.statusCode);
    return '';
  }

  function issueMetaChip(label: string, value: string, metaKey: string, useCode: boolean): string {
    if (!value) return '';
    var renderedValue = useCode ? ('<code>' + escapeHtml(value) + '</code>') : escapeHtml(value);
    var keyAttr = metaKey ? (' data-meta="' + escapeHtml(metaKey) + '"') : '';
    return '<span class="issue-meta-chip"' + keyAttr + '><strong>' + escapeHtml(label) + ':</strong> ' + renderedValue + '</span>';
  }

  function issueMetaChips(innerGroup: IssueGroup | null | undefined): string {
    if (!innerGroup) return '';
    var ctx = innerGroup.context || createEmptyOpenAPIContext();
    var chips = [];
    var target = '';
    if (ctx.primaryLabel && ctx.primaryValue) target = ctx.primaryLabel + ': ' + ctx.primaryValue;
    else if (ctx.primaryLabel) target = ctx.primaryLabel;
    var responses = issueGroupResponseCodes(innerGroup);
    if (target) chips.push(issueMetaChip('Target', target, 'target', false));
    if (responses) chips.push(issueMetaChip('Responses', responses, 'responses', false));
    if (innerGroup.isSpecRule && innerGroup.specRuleId) chips.push(issueMetaChip('Rule', innerGroup.specRuleId, 'rule', true));
    var count = innerGroup.count || 0;
    if (count) chips.push('<span class="issue-meta-chip" data-meta="count"><strong>Count:</strong> ' + String(count) + ' deviation' + (count === 1 ? '' : 's') + '</span>');
    return chips.join('');
  }

  var scopeFamilyName = options.familyName || '';
  var scopeLabel = helpers.issueScopeLabelForKey(group.groupKey || '', scopeFamilyName);
  var commonScopeLabel = options.commonScopeLabel || '';
  var showScopeInline = !commonScopeLabel || scopeLabel !== commonScopeLabel;
  var scopePill = '<span class="issue-group-scope-pill" title="' + escapeHtml('Scope: ' + scopeLabel) + '"><strong>Scope:</strong> ' + escapeHtml(scopeLabel) + '</span>';
  var titleLine = issueGroupHumanTitle(group);
  var kindLabel = issueGroupKindLabel(group);
  var titleHtml = '<span class="issue-group-titleline" title="' + escapeHtml(titleLine) + '">' + escapeHtml(titleLine) + '</span>';
  var metaRow = '<span class="issue-group-meta-row">' + issueMetaChips(group) + '</span>';
  var inspectTarget = helpers.inspectTargetForGroup(group, options.endpoint || null) || group.inspectHint || '';

  return '<details class="issue-group'
    + (index > 0 ? ' issue-group-secondary' : '')
    + (group.isSpecRule ? ' issue-group-spec-rule' : '')
    + '"' + openAttr + '>'
    + '<summary>'
    + '<span class="issue-toggle-indicator"></span>'
    + helpers.severityBadge(group.severity)
    + '<span class="issue-group-summary-main">'
    + '<span class="issue-group-kind">' + escapeHtml(kindLabel) + '</span>'
    + titleHtml
    + metaRow
    + '</span>'
    + '<span class="issue-group-summary-side">'
    + (showScopeInline ? scopePill : '')
    + '</span>'
    + '</summary>'
    + '<div class="issue-group-body">'
    + '  <div class="issue-messages">'
    + '    <ul>' + messageList + '</ul>'
    + '  </div>'
    + expandMore
    + specGrounding
    + openAPIMeta
    + (showScopeInline ? ('  <p class="issue-scope-line"><strong>Scope:</strong> ' + escapeHtml(scopeLabel) + '</p>') : '')
    + (inspectTarget ? ('  <p class="issue-inspect-hint"><strong>Inspect in schema:</strong> ' + escapeHtml(inspectTarget) + '</p>') : '')
    + '  <p class="issue-impact"><strong>Why it matters:</strong> ' + escapeHtml(group.impact) + '</p>'
    + '</div>'
    + '</details>';
}
