function contractImprovementDescribeWhere(context: OpenAPIContext | null | undefined, fallback: string): string {
  if (!context) return fallback;
  if (context.primaryLabel && context.primaryValue) {
    return context.primaryLabel + ' ' + context.primaryValue;
  }
  if (context.primaryLabel && context.statusCode) {
    return context.primaryLabel + ' for response ' + context.statusCode;
  }
  if (context.primaryLabel) {
    return context.primaryLabel;
  }
  return fallback;
}

function contractImprovementBuildItemForFinding(
  finding: ExplorerFinding,
  endpoint: ExplorerEndpointRow,
  helpers: {
    extractOpenAPIContext: (finding: ExplorerFinding) => OpenAPIContext;
    formatWhereWithOpenAPITarget: (endpoint: ExplorerEndpointRow, context: OpenAPIContext, opts: { kind?: string }) => string;
    openApiOperationPointer: (endpoint: ExplorerEndpointRow) => string;
    openApiResponseObjectPointer: (endpoint: ExplorerEndpointRow, statusCode: string) => string;
    specRuleWhy: StringMap<string>;
  }
): ContractImprovementItem | null {
  var code = finding.code || '';
  var context = helpers.extractOpenAPIContext(finding);
  var endpointLabel = (endpoint.method && endpoint.path) ? (endpoint.method + ' ' + endpoint.path) : 'this endpoint';

  if (finding.evidenceType === 'spec-rule') {
    var ruleId = finding.specRuleId || code;
    if (ruleId === 'OAS-RESPONSE-DESCRIPTION-REQUIRED') {
      var descriptionTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-description' });
      return {
        change: 'Add a non-empty `description` to the Response Object.',
        where: descriptionTarget,
        inspect: descriptionTarget,
        why: helpers.specRuleWhy[ruleId] || 'Docs and generated clients need response semantics to remain clear.'
      };
    }
    if (ruleId === 'OAS-OPERATION-ID-UNIQUE') {
      var operationIdTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'operation-id' });
      return {
        change: 'Rename `operationId` to a unique value (no duplicates across the spec).',
        where: operationIdTarget,
        inspect: operationIdTarget,
        why: helpers.specRuleWhy[ruleId] || 'Tooling that keys by operationId can break when IDs collide.'
      };
    }
    if (ruleId === 'OAS-NO-SUCCESS-RESPONSE') {
      var successTarget = helpers.openApiResponseObjectPointer(endpoint, '200');
      var successInspect = successTarget ? ('OpenAPI: ' + successTarget + '.content[mediaType].schema') : endpointLabel;
      return {
        change: 'Add at least one 2xx success response with an explicit schema (typically `200`).',
        where: successInspect,
        inspect: successInspect,
        why: helpers.specRuleWhy[ruleId] || 'Clients cannot know the happy-path shape without a declared success response.'
      };
    }
    if (ruleId === 'OAS-GET-REQUEST-BODY') {
      var requestBodyTarget = helpers.openApiOperationPointer(endpoint);
      var requestInspect = requestBodyTarget ? ('OpenAPI: ' + requestBodyTarget + '.requestBody') : endpointLabel;
      return {
        change: 'Remove the request body from this GET/HEAD operation (move inputs to query params or change to POST).',
        where: requestInspect,
        inspect: requestInspect,
        why: helpers.specRuleWhy[ruleId] || 'HTTP intermediaries and tooling may drop or mishandle GET bodies.'
      };
    }
    if (ruleId === 'OAS-204-HAS-CONTENT') {
      var noContentTarget = helpers.openApiResponseObjectPointer(endpoint, '204');
      var noContentInspect = noContentTarget ? ('OpenAPI: ' + noContentTarget + '.content') : endpointLabel;
      return {
        change: 'Remove response content/schema from the 204 response (204 must not include a body).',
        where: noContentInspect,
        inspect: noContentInspect,
        why: helpers.specRuleWhy[ruleId] || 'Clients may mis-handle responses when 204 contradicts a response body.'
      };
    }
  }

  if (code === 'missing-response-schema') {
    var responseSchemaTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
    return {
      change: 'Define an explicit response schema instead of leaving this response untyped.',
      where: responseSchemaTarget,
      inspect: responseSchemaTarget,
      why: 'Clients can generate typed models, validate the payload, and stop guessing which fields are safe to read.'
    };
  }
  if (code === 'generic-object-response') {
    var genericTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
    return {
      change: 'Replace the generic object response with a named schema that lists the actual fields returned.',
      where: genericTarget,
      inspect: genericTarget,
      why: 'Clients can code against documented fields instead of probing the payload at runtime.'
    };
  }
  if (code === 'weak-array-items-schema') {
    var itemsTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-field' });
    return {
      change: 'Define the array item schema with named properties instead of leaving items generic.',
      where: itemsTarget,
      inspect: itemsTarget,
      why: 'Clients can iterate over collection items with stable field names and fewer defensive null checks.'
    };
  }
  if (code === 'deeply-nested-response-structure') {
    var nestedTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
    return {
      change: 'Promote the task outcome and handoff fields to the top level of the response instead of burying them in nested objects.',
      where: nestedTarget,
      inspect: nestedTarget,
      why: 'Clients can find the result and next-step data quickly without walking a deep object tree.'
    };
  }
  if (code === 'duplicated-state-response') {
    var duplicateTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
    return {
      change: 'Remove duplicate state copies and keep one authoritative representation of the resource state.',
      where: duplicateTarget,
      inspect: duplicateTarget,
      why: 'Clients stop choosing between conflicting copies of the same state and reduce silent drift bugs.'
    };
  }
  if (code === 'incidental-internal-field-exposure') {
    var internalField = context.primaryValue || '';
    var internalTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: internalField ? 'response-field' : 'response-schema' });
    return {
      change: internalField
        ? ('Remove `' + internalField + '` from the public response schema (or move it behind an explicitly internal component).')
        : 'Remove incidental internal fields from the public response schema (or move them behind an explicitly internal component).',
      where: internalTarget,
      inspect: internalTarget,
      why: 'Clients see the fields they actually need for the task instead of relying on internal data that may change without notice.'
    };
  }
  if (code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage') {
    var followUpTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-field' });
    return {
      change: 'Add an explicit follow-up field that names the next endpoint or returns the handoff identifier needed for the next call.',
      where: followUpTarget,
      inspect: followUpTarget,
      why: 'Clients can continue the workflow without reverse-engineering which identifier to carry forward.'
    };
  }
  if (code === 'weak-outcome-next-action-guidance') {
    var outcomeTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
    return {
      change: 'Add explicit outcome and next-action fields to the response contract.',
      where: outcomeTarget,
      inspect: outcomeTarget,
      why: 'Clients can tell what changed and what operation is valid next without reading docs or guessing from status alone.'
    };
  }
  if (code === 'prerequisite-task-burden') {
    var prereqTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, {
      kind: (context.primaryLabel && context.primaryLabel.indexOf('Request') === 0) ? 'request-schema' : 'path-params'
    });
    return {
      change: 'Document prerequisite inputs as explicit request fields or required parameters instead of leaving them implicit.',
      where: prereqTarget,
      inspect: prereqTarget,
      why: 'Clients learn which prior state is mandatory before calling the endpoint and fail less often in multi-step flows.'
    };
  }
  if (code === 'detail-path-parameter-name-drift') {
    var paramTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'path-params' });
    return {
      change: 'Rename the path parameter so it matches the family’s dominant parameter naming pattern.',
      where: paramTarget,
      inspect: paramTarget,
      why: 'Clients can reuse route builders and stop maintaining endpoint-specific parameter aliases.'
    };
  }
  if (code === 'endpoint-path-style-drift' || code === 'sibling-path-shape-drift') {
    var pathTarget = 'OpenAPI: paths["' + (endpoint.path || '') + '"]';
    return {
      change: 'Normalize this route shape so it matches sibling endpoints for the same resource workflow.',
      where: pathTarget,
      inspect: pathTarget,
      why: 'Clients can predict sibling routes and compose calls without one-off path rules.'
    };
  }
  if (code === 'inconsistent-response-shape' || code === 'inconsistent-response-shape-family' || code === 'inconsistent-response-shapes' || code === 'inconsistent-response-shapes-family') {
    var alignTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
    return {
      change: 'Align this response schema with sibling endpoints so the same concept is returned under the same field structure.',
      where: alignTarget,
      inspect: alignTarget,
      why: 'Clients can share parsing code across sibling routes instead of branching on endpoint-specific payload shapes.'
    };
  }
  if (code === 'missing-request-schema') {
    var requestSchemaTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'request-schema' });
    return {
      change: 'Define the request body schema and mark the required fields explicitly.',
      where: requestSchemaTarget,
      inspect: requestSchemaTarget,
      why: 'Clients can construct valid requests without trial-and-error against server validation.'
    };
  }
  if (code === 'generic-object-request') {
    var requestObjectTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'request-schema' });
    return {
      change: 'Replace the generic request object with a named request schema that lists supported fields.',
      where: requestObjectTarget,
      inspect: requestObjectTarget,
      why: 'Clients know which inputs are accepted and can generate typed request builders.'
    };
  }
  if (code === 'likely-missing-enum') {
    var msg = finding.message || '';
    var enumField = (msg.match(/property '([^']+)'/) || msg.match(/field '([^']+)'/));
    var field = enumField ? enumField[1] : (context.primaryValue || '');
    var enumContext = Object.assign({}, context);
    if (!enumContext.primaryValue && field) enumContext.primaryValue = field;
    var enumTarget = helpers.formatWhereWithOpenAPITarget(endpoint, enumContext, { kind: field ? 'response-field' : 'response-schema' });
    return {
      change: field
        ? ('Declare explicit enum values for `' + field + '` (avoid bare string with no constraints).')
        : 'Declare explicit enum values for finite value sets (avoid bare string with no constraints).',
      where: enumTarget,
      inspect: enumTarget,
      why: 'Clients can validate inputs/outputs and avoid silent breakage when servers start rejecting or introducing new string variants.'
    };
  }

  return null;
}

function contractImprovementBuildItems(
  detail: ExplorerEndpointDetail | { endpoint: ExplorerEndpointRow } | null | undefined,
  findings: ExplorerFinding[],
  contractImprovementForFinding: (finding: ExplorerFinding, endpoint: ExplorerEndpointRow) => ContractImprovementItem | null
): ContractImprovementItem[] {
  var endpoint = (detail && detail.endpoint) || ({ id: "", method: "", path: "" } as ExplorerEndpointRow);
  var items: ContractImprovementItem[] = [];
  var seen: StringMap<boolean> = {};

  (findings || []).forEach(function (finding) {
    var item = contractImprovementForFinding(finding, endpoint);
    if (!item) return;
    var key = [item.change, item.where, item.why].join('|');
    if (seen[key]) return;
    seen[key] = true;
    items.push(item);
  });

  return items.slice(0, 6);
}
