function openApiTargetOperationPointer(endpoint: ExplorerEndpointRow | null | undefined): string {
  if (!endpoint || !endpoint.method || !endpoint.path) return '';
  return 'paths["' + endpoint.path + '"].' + String(endpoint.method).toLowerCase();
}

function openApiTargetResponseObjectPointer(endpoint: ExplorerEndpointRow | null | undefined, statusCode: string): string {
  var op = openApiTargetOperationPointer(endpoint);
  if (!op) return '';
  if (statusCode) return op + '.responses["' + statusCode + '"]';
  return op + '.responses';
}

function openApiTargetResponseSchemaPointer(endpoint: ExplorerEndpointRow | null | undefined, context: OpenAPIContext | null | undefined): string {
  var ctx = context || createEmptyOpenAPIContext();
  var base = openApiTargetResponseObjectPointer(endpoint, ctx.statusCode || '');
  if (!base) return '';
  if (ctx.mediaType) {
    return base + '.content["' + ctx.mediaType + '"].schema';
  }
  return base + '.content[mediaType].schema';
}

function openApiTargetRequestSchemaPointer(endpoint: ExplorerEndpointRow | null | undefined, context: OpenAPIContext | null | undefined): string {
  var ctx = context || createEmptyOpenAPIContext();
  var op = openApiTargetOperationPointer(endpoint);
  if (!op) return '';
  if (ctx.mediaType) {
    return op + '.requestBody.content["' + ctx.mediaType + '"].schema';
  }
  return op + '.requestBody.content[mediaType].schema';
}

function openApiTargetFormatWhere(
  endpoint: ExplorerEndpointRow | null | undefined,
  context: OpenAPIContext | null | undefined,
  opts: { kind?: string } | null | undefined
): string {
  var options = opts || {};
  var ctx = context || createEmptyOpenAPIContext();
  var kind = options.kind || '';
  var pointer = '';
  var suffix = '';

  if (kind === 'response-description') {
    pointer = openApiTargetResponseObjectPointer(endpoint, ctx.statusCode || '');
    pointer = pointer ? (pointer + '.description') : '';
  } else if (kind === 'operation-id') {
    pointer = openApiTargetOperationPointer(endpoint);
    pointer = pointer ? (pointer + '.operationId') : '';
  } else if (kind === 'request-schema') {
    pointer = openApiTargetRequestSchemaPointer(endpoint, ctx);
  } else if (kind === 'request-field') {
    pointer = openApiTargetRequestSchemaPointer(endpoint, ctx);
    if (ctx.primaryValue) suffix = ' (field: ' + ctx.primaryValue + ')';
  } else if (kind === 'path-params') {
    pointer = openApiTargetOperationPointer(endpoint);
    pointer = pointer ? (pointer + '.parameters') : '';
    if (ctx.parameterNames || ctx.primaryValue) {
      suffix = ' (path params: ' + (ctx.parameterNames || ctx.primaryValue) + ')';
    }
  } else if (kind === 'response-object') {
    pointer = openApiTargetResponseObjectPointer(endpoint, ctx.statusCode || '');
  } else if (kind === 'response-field') {
    pointer = openApiTargetResponseSchemaPointer(endpoint, ctx);
    if (ctx.primaryValue) suffix = ' (field: ' + ctx.primaryValue + ')';
  } else {
    pointer = openApiTargetResponseSchemaPointer(endpoint, ctx);
    if (ctx.primaryLabel === 'Request schema') pointer = openApiTargetRequestSchemaPointer(endpoint, ctx);
    if (ctx.primaryLabel === 'Request schema field') {
      pointer = openApiTargetRequestSchemaPointer(endpoint, ctx);
      if (ctx.primaryValue) suffix = ' (field: ' + ctx.primaryValue + ')';
    }
    if (ctx.primaryLabel === 'Path parameter') {
      pointer = openApiTargetOperationPointer(endpoint);
      pointer = pointer ? (pointer + '.parameters') : '';
      if (ctx.primaryValue) suffix = ' (path params: ' + ctx.primaryValue + ')';
    }
  }

  if (!pointer) {
    var fallback = (endpoint && endpoint.method && endpoint.path)
      ? ('operation ' + endpoint.method + ' ' + endpoint.path)
      : 'this endpoint';
    return fallback;
  }
  return 'OpenAPI: ' + pointer + suffix;
}

function openApiRenderSpecRuleGroundingForGroup(
  group: IssueGroup,
  escapeHtml: (value: unknown) => string
): string {
  if (!group.isSpecRule || !group.specRuleId) return '';
  var levelClass = (group.normativeLevel === 'REQUIRED' || group.normativeLevel === 'MUST' || group.normativeLevel === 'MUST NOT')
    ? 'spec-level-must' : 'spec-level-should';
  return '<div class="spec-rule-grounding">'
    + '<span class="spec-norm-badge ' + levelClass + '">' + escapeHtml(group.normativeLevel || '') + '</span>'
    + '<span class="spec-source">' + escapeHtml(group.specSource || '') + '</span>'
    + '</div>';
}

function openApiInspectTargetForGroup(group: IssueGroup | null | undefined, endpoint: ExplorerEndpointRow | null | undefined): string {
  if (!group) return '';
  var ctx = group.context || createEmptyOpenAPIContext();

  if (group.isSpecRule) {
    var ruleId = group.specRuleId || '';
    if (ruleId === 'OAS-RESPONSE-DESCRIPTION-REQUIRED') {
      return openApiTargetFormatWhere(endpoint, ctx, { kind: 'response-description' });
    }
    if (ruleId === 'OAS-OPERATION-ID-UNIQUE') {
      return openApiTargetFormatWhere(endpoint, ctx, { kind: 'operation-id' });
    }
    if (ruleId === 'OAS-NO-SUCCESS-RESPONSE') {
      var successTarget = openApiTargetResponseObjectPointer(endpoint, '200');
      return successTarget ? ('OpenAPI: ' + successTarget + '.content[mediaType].schema') : '';
    }
    if (ruleId === 'OAS-GET-REQUEST-BODY') {
      var operationTarget = openApiTargetOperationPointer(endpoint);
      return operationTarget ? ('OpenAPI: ' + operationTarget + '.requestBody') : '';
    }
    if (ruleId === 'OAS-204-HAS-CONTENT') {
      var noContentTarget = openApiTargetResponseObjectPointer(endpoint, '204');
      return noContentTarget ? ('OpenAPI: ' + noContentTarget + '.content') : '';
    }
    return openApiTargetFormatWhere(endpoint, ctx, { kind: 'response-object' });
  }

  if (ctx.primaryLabel === 'Response schema field') {
    return openApiTargetFormatWhere(endpoint, ctx, { kind: 'response-field' });
  }
  if (ctx.primaryLabel === 'Request schema field') {
    return openApiTargetFormatWhere(endpoint, ctx, { kind: 'request-field' });
  }
  if (ctx.primaryLabel === 'Response schema') {
    return openApiTargetFormatWhere(endpoint, ctx, { kind: 'response-schema' });
  }
  if (ctx.primaryLabel === 'Request schema') {
    return openApiTargetFormatWhere(endpoint, ctx, { kind: 'request-schema' });
  }
  if (ctx.primaryLabel === 'Path parameter') {
    return openApiTargetFormatWhere(endpoint, ctx, { kind: 'path-params' });
  }
  if (ctx.primaryLabel === 'Response Object') {
    return openApiTargetFormatWhere(endpoint, ctx, { kind: 'response-object' });
  }
  return openApiTargetFormatWhere(endpoint, ctx, {});
}
