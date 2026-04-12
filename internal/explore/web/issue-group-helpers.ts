function buildFindingGroupKeyFromContext(finding: ExplorerFinding | null | undefined, context: OpenAPIContext): string {
  if (!finding) return "";
  if (finding.evidenceType === "spec-rule" && finding.specRuleId) {
    return "spec-rule|" + finding.specRuleId;
  }
  var ctx = context || ({} as OpenAPIContext);
  return [
    finding.code || "",
    ctx.primaryLabel || "",
    ctx.primaryValue || "",
    ctx.mediaType || "",
    ctx.statusCode || ""
  ].join("|");
}

function buildIssueScopeIndex(
  rows: ExplorerEndpointRow[],
  endpointDetails: StringMap<ExplorerEndpointDetail> | null,
  findingsForActiveLens: (findings: ExplorerFinding[]) => ExplorerFinding[],
  getFindingGroupKey: (finding: ExplorerFinding) => string
): IssueScopeIndex {
  var index: IssueScopeIndex = {
    keyToEndpointIds: {},
    keyToFamilies: {},
    keyFamilyToEndpointIds: {}
  };

  (rows || []).forEach(function (row) {
    var family = row.family || "unlabeled family";
    var detail = endpointDetails ? endpointDetails[row.id] : null;
    if (!detail || !detail.findings) return;
    var findings = findingsForActiveLens(detail.findings || []);
    if (!findings.length) return;

    findings.forEach(function (finding) {
      var key = getFindingGroupKey(finding);
      if (!key) return;

      if (!index.keyToEndpointIds[key]) index.keyToEndpointIds[key] = {};
      index.keyToEndpointIds[key][row.id] = true;

      if (!index.keyToFamilies[key]) index.keyToFamilies[key] = {};
      index.keyToFamilies[key][family] = true;

      var familyKey = key + "||" + family;
      if (!index.keyFamilyToEndpointIds[familyKey]) {
        index.keyFamilyToEndpointIds[familyKey] = {};
      }
      index.keyFamilyToEndpointIds[familyKey][row.id] = true;
    });
  });

  return index;
}

function deriveIssueScopeLabelForKey(
  groupKey: string,
  familyName: string,
  issueScopeIndex: IssueScopeIndex
): string {
  if (!groupKey) return "Endpoint only";
  var index = issueScopeIndex || {
    keyToEndpointIds: {},
    keyToFamilies: {},
    keyFamilyToEndpointIds: {}
  };
  var endpoints = index.keyToEndpointIds[groupKey] || {};
  var endpointCount = Object.keys(endpoints).length;
  if (endpointCount <= 1) return "Endpoint only";
  var families = index.keyToFamilies[groupKey] || {};
  var familyCount = Object.keys(families).length;
  if (familyCount > 1) return "Repeated across current view";
  var familyKey = groupKey + "||" + (familyName || "unlabeled family");
  var familyEndpoints = index.keyFamilyToEndpointIds[familyKey] || {};
  if (Object.keys(familyEndpoints).length > 1) return "Repeated across family";
  return "Repeated across current view";
}

function extractOpenAPIContext(finding: ExplorerFinding): OpenAPIContext {
  var message = finding.message || "";
  var context: OpenAPIContext = {
    primaryLabel: "",
    primaryValue: "",
    mediaType: "",
    statusCode: "",
    parameterKind: "",
    parameterNames: ""
  };

  var mediaType = /media type '([^']+)'/.exec(message);
  if (mediaType) context.mediaType = mediaType[1];

  var responseMissingSchema = /^Response ([0-9]{3}) has no schema for media type/.exec(message);
  if (responseMissingSchema) {
    context.primaryLabel = "Response schema";
    context.statusCode = responseMissingSchema[1];
  }

  var responseMissingDescription = /^Response ([0-9]{3}) is missing a description/.exec(message);
  if (responseMissingDescription) {
    context.primaryLabel = "Response Object";
    context.statusCode = responseMissingDescription[1];
  }

  var requestMissingSchema = /^Request body has no schema for media type/.exec(message);
  if (requestMissingSchema) {
    context.primaryLabel = "Request schema";
  }

  var requestField = /^Request schema property '([^']+)'/.exec(message);
  if (requestField) {
    context.primaryLabel = "Request schema field";
    context.primaryValue = requestField[1];
  }

  var responseField = /^Response schema property '([^']+)'/.exec(message);
  if (responseField) {
    context.primaryLabel = "Response schema field";
    context.primaryValue = responseField[1];
  }

  var requestArray = /^Request body array has missing or overly generic items schema/.exec(message);
  if (requestArray) {
    context.primaryLabel = "Request schema field";
    context.primaryValue = "array items";
  }

  var responseArray = /^Response array has missing or overly generic items schema/.exec(message);
  if (responseArray) {
    context.primaryLabel = "Response schema field";
    context.primaryValue = "array items";
  }

  var followUpCandidates = /related detail endpoint\(s\): (.+)$/.exec(message);
  if (followUpCandidates) {
    context.primaryLabel = "Response schema field";
    context.primaryValue = followUpCandidates[1];
  }

  var responseItemField = /response item schema does not clearly expose an '([^']+)'/.exec(message);
  if (responseItemField) {
    context.primaryLabel = "Response schema field";
    context.primaryValue = responseItemField[1];
  }

  var trackingField = /tracking identifier such as (.+)$/.exec(message);
  if (trackingField) {
    context.primaryLabel = "Response schema field";
    context.primaryValue = trackingField[1];
    context.statusCode = context.statusCode || "202";
  }

  var pathParameters = /parameter names: (.+)$/.exec(message);
  if (pathParameters) {
    context.primaryLabel = "Path parameter";
    context.primaryValue = pathParameters[1];
    context.parameterKind = "path";
    context.parameterNames = pathParameters[1];
  }

  if (!context.primaryLabel) {
    if (finding.code === "generic-object-request" || finding.code === "missing-request-schema") {
      context.primaryLabel = "Request schema";
    } else if (
      finding.code === "generic-object-response"
      || finding.code === "missing-response-schema"
      || finding.code === "contract-shape-workflow-guidance-burden"
      || finding.code === "snapshot-heavy-response"
      || finding.code === "deeply-nested-response-structure"
      || finding.code === "duplicated-state-response"
      || finding.code === "incidental-internal-field-exposure"
      || finding.code === "weak-outcome-next-action-guidance"
    ) {
      context.primaryLabel = "Response schema";
    } else if (
      finding.code === "detail-path-parameter-name-drift"
      || finding.code === "endpoint-path-style-drift"
      || finding.code === "sibling-path-shape-drift"
    ) {
      context.primaryLabel = "Path parameter";
    } else if (finding.code === "prerequisite-task-burden") {
      context.primaryLabel = "Request parameter set";
    }
  }

  return context;
}

function groupFindingsByContext(
  findings: ExplorerFinding[],
  options: {
    dimensionForFinding: (code: string, category: string, burdenFocus: string) => string;
    dimensionImpact: (dimension: string) => string;
    findingExamineHint: (code: string, message: string) => string;
    formatIssueGroupTitle: (finding: ExplorerFinding, context: OpenAPIContext) => string;
    severityPriority: (severity: string) => number;
    specRuleSummary: StringMap<string>;
  }
): IssueGroup[] {
  var groups: StringMap<IssueGroup> = {};

  (findings || []).forEach(function (finding) {
    var context = extractOpenAPIContext(finding);
    var isSpecRule = finding.evidenceType === "spec-rule";
    var key = buildFindingGroupKeyFromContext(finding, context);

    if (!groups[key]) {
      var groupContext: OpenAPIContext = context || ({} as OpenAPIContext);
      if (isSpecRule) {
        groupContext = Object.assign({}, groupContext, { statusCodes: [] });
      }

      var dimension = options.dimensionForFinding(
        finding.code,
        finding.category,
        finding.burdenFocus
      );

      groups[key] = {
        groupKey: key,
        code: finding.code || "n/a",
        severity: finding.severity || "info",
        dimension: dimension,
        context: groupContext,
        messages: [],
        count: 0,
        preview: finding.message || "",
        impact: options.dimensionImpact(dimension),
        inspectHint: options.findingExamineHint(finding.code, finding.message),
        title: (isSpecRule && finding.specRuleId)
          ? ((options.specRuleSummary && options.specRuleSummary[finding.specRuleId]) || finding.specRuleId.replace(/^OAS-/, "").replace(/-/g, " "))
          : options.formatIssueGroupTitle(finding, context),
        isSpecRule: isSpecRule,
        specRuleId: isSpecRule ? (finding.specRuleId || "") : "",
        normativeLevel: isSpecRule ? (finding.normativeLevel || "") : "",
        specSource: isSpecRule ? (finding.specSource || "") : ""
      };
    }

    groups[key].messages.push(finding.message || "");
    groups[key].count += 1;

    if (isSpecRule && context && context.statusCode) {
      var codes = groups[key].context.statusCodes || [];
      var codeStr = String(context.statusCode);
      if (codes.indexOf(codeStr) === -1) codes.push(codeStr);
      groups[key].context.statusCodes = codes;
      if (!groups[key].context.statusCode) groups[key].context.statusCode = codeStr;
    }

    if (options.severityPriority(finding.severity) < options.severityPriority(groups[key].severity)) {
      groups[key].severity = finding.severity;
    }
  });

  return Object.values(groups).sort(function (a: IssueGroup, b: IssueGroup) {
    if (options.severityPriority(a.severity) !== options.severityPriority(b.severity)) {
      return options.severityPriority(a.severity) - options.severityPriority(b.severity);
    }
    if (a.count !== b.count) return b.count - a.count;
    return a.title.localeCompare(b.title);
  });
}
