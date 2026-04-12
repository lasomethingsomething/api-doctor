declare var state: ExplorerState;

declare function escapeHtml(value: unknown): string;

var SPEC_RULE_SUMMARY: StringMap<string> = {
  "OAS-RESPONSE-DESCRIPTION-REQUIRED": 'Response Object is missing the required "description" field',
  "OAS-OPERATION-ID-UNIQUE": "operationId must be unique across all operations",
  "OAS-NO-SUCCESS-RESPONSE": "Operation should define at least one 2xx success response",
  "OAS-GET-REQUEST-BODY": "GET/HEAD operations should not define a request body",
  "OAS-204-HAS-CONTENT": "204 No Content response should not define a response body"
};

var SPEC_RULE_WHY: StringMap<string> = {
  "OAS-RESPONSE-DESCRIPTION-REQUIRED": "Docs and generated clients lose intent when response semantics are missing.",
  "OAS-OPERATION-ID-UNIQUE": "Client generation and tooling can break when operationId collides.",
  "OAS-NO-SUCCESS-RESPONSE": "Clients cannot rely on a success contract when 2xx responses are undefined.",
  "OAS-GET-REQUEST-BODY": "Tooling and intermediaries may drop or mishandle GET request bodies.",
  "OAS-204-HAS-CONTENT": "Clients may mis-handle responses when 204 contradicts a response body."
};

function aggregateSpecRuleFindings(rows: ExplorerEndpointRow[]): SpecRuleAggregateGroup[] {
  var totalEndpoints = rows.length;
  var byRule: StringMap<SpecRuleAggregateGroup> = {};
  var endpointDetails = (state.payload && state.payload.endpointDetails) ? state.payload.endpointDetails : {};

  rows.forEach(function (row: ExplorerEndpointRow) {
    var detail = endpointDetails[row.id];
    if (!detail) return;
    (detail.findings || []).forEach(function (finding: ExplorerFinding) {
      if (finding.evidenceType !== "spec-rule") return;
      var ruleId = finding.specRuleId || finding.code || "";
      if (!byRule[ruleId]) {
        byRule[ruleId] = {
          ruleId: ruleId,
          normativeLevel: finding.normativeLevel || "",
          specSource: finding.specSource || "",
          severity: finding.severity || "info",
          occurrences: 0,
          endpointCount: 0,
          _seen: {},
          summary: SPEC_RULE_SUMMARY[ruleId] || ruleId.replace(/^OAS-/, "").replace(/-/g, " ").toLowerCase()
        };
      }
      byRule[ruleId].occurrences++;
      if (!byRule[ruleId]._seen || !byRule[ruleId]._seen[row.id]) {
        if (!byRule[ruleId]._seen) byRule[ruleId]._seen = {};
        byRule[ruleId]._seen[row.id] = true;
        byRule[ruleId].endpointCount++;
      }
    });
  });

  var apiWideThreshold = 0.8;
  var normPriority: StringMap<number> = {
    REQUIRED: 0,
    MUST: 0,
    "MUST NOT": 0,
    "SHOULD NOT": 1,
    SHOULD: 1,
    RECOMMENDED: 2
  };

  return Object.keys(byRule).map(function (key: string) {
    var rule = byRule[key];
    rule.isApiWide = totalEndpoints > 0 && (rule.endpointCount / totalEndpoints) >= apiWideThreshold;
    return rule;
  }).sort(function (a: SpecRuleAggregateGroup, b: SpecRuleAggregateGroup) {
    var aPriority = normPriority[a.normativeLevel] !== undefined ? normPriority[a.normativeLevel] : 3;
    var bPriority = normPriority[b.normativeLevel] !== undefined ? normPriority[b.normativeLevel] : 3;
    if (aPriority !== bPriority) return aPriority - bPriority;
    if (b.endpointCount !== a.endpointCount) return b.endpointCount - a.endpointCount;
    return b.occurrences - a.occurrences;
  });
}

function renderSpecRuleAggregate(ruleGroups: SpecRuleAggregateGroup[]): string {
  if (!ruleGroups.length) {
    return '<p class="subtle">No spec-rule findings are visible in the current view.</p>';
  }
  var apiWide = ruleGroups.filter(function (rule: SpecRuleAggregateGroup) { return !!rule.isApiWide; });
  var localized = ruleGroups.filter(function (rule: SpecRuleAggregateGroup) { return !rule.isApiWide; });

  function buildTableRows(rules: SpecRuleAggregateGroup[]): string {
    return rules.map(function (rule: SpecRuleAggregateGroup) {
      var levelClass = (rule.normativeLevel === "REQUIRED" || rule.normativeLevel === "MUST" || rule.normativeLevel === "MUST NOT")
        ? "spec-level-must"
        : "spec-level-should";
      var endpointNote = rule.endpointCount === 1 ? "1 endpoint" : (rule.endpointCount + " endpoints");
      return '<tr class="spec-agg-row">'
        + '<td class="spec-agg-id"><code>' + escapeHtml(rule.ruleId) + '</code><div class="spec-agg-summary">' + escapeHtml(rule.summary) + "</div></td>"
        + '<td class="spec-agg-level"><span class="spec-norm-badge ' + levelClass + '">' + escapeHtml(rule.normativeLevel) + "</span></td>"
        + '<td class="spec-agg-count">' + rule.occurrences + "</td>"
        + '<td class="spec-agg-scope">' + escapeHtml(endpointNote) + "</td>"
        + "</tr>";
    }).join("");
  }

  var html = '<div class="spec-rule-aggregate">';
  if (apiWide.length) {
    html += '<div class="spec-agg-section spec-agg-apiwide">'
      + '<p class="spec-agg-section-label">This issue appears in most visible endpoints, so it is likely a broad contract problem, not a one-off.</p>'
      + '<table class="spec-agg-table"><thead><tr><th>Rule ID &amp; summary</th><th>Level</th><th>Count</th><th>Scope</th></tr></thead><tbody>'
      + buildTableRows(apiWide)
      + "</tbody></table></div>";
  }

  if (localized.length) {
    html += '<div class="spec-agg-section">'
      + (apiWide.length
        ? '<p class="spec-agg-section-label">Concentrated issues — affects a smaller share of endpoints. Easier to fix endpoint-by-endpoint.</p>'
        : '<p class="spec-agg-label">Sorted by normative level, then breadth of impact. Rows open grouped deviations with normative grounding.</p>')
      + '<table class="spec-agg-table"><thead><tr><th>Rule ID &amp; summary</th><th>Level</th><th>Count</th><th>Scope</th></tr></thead><tbody>'
      + buildTableRows(localized)
      + "</tbody></table></div>";
  }

  html += '<p class="spec-agg-footer">Endpoint rows open grouped deviations with exact occurrences and normative grounding.</p>';
  html += "</div>";
  return html;
}

function renderSpecRuleBanner(ruleGroups: SpecRuleAggregateGroup[], totalEndpoints: number): string {
  if (!ruleGroups || !ruleGroups.length) return "";
  var top = ruleGroups[0];
  var summary = top.summary || SPEC_RULE_SUMMARY[top.ruleId] || top.ruleId;
  var more = ruleGroups.length > 1 ? (" (and " + (ruleGroups.length - 1) + " more)") : "";
  var severityLabel = (top.severity || "info").toUpperCase();
  var level = top.normativeLevel || "";
  var affected = (top.endpointCount || 0) + "/" + (totalEndpoints || 0);
  var why = SPEC_RULE_WHY[top.ruleId] || "Improves spec validity and makes tooling and client integrations more reliable.";

  return '<div class="spec-rule-banner">'
    + '<div class="spec-rule-banner-field"><span class="spec-rule-banner-label">Rule</span><span class="spec-rule-banner-value"><code>'
    + escapeHtml(top.ruleId)
    + '</code> <span class="spec-rule-banner-summary">'
    + escapeHtml(summary)
    + more
    + "</span></span></div>"
    + '<div class="spec-rule-banner-field"><span class="spec-rule-banner-label">Severity</span><span class="spec-rule-banner-value"><span class="spec-rule-severity sev-'
    + escapeHtml(top.severity || "info")
    + '">'
    + escapeHtml(severityLabel)
    + "</span>"
    + (level
      ? (' <span class="spec-norm-badge ' + ((level === "REQUIRED" || level === "MUST" || level === "MUST NOT") ? "spec-level-must" : "spec-level-should") + '">' + escapeHtml(level) + "</span>")
      : "")
    + "</span></div>"
    + '<div class="spec-rule-banner-field"><span class="spec-rule-banner-label">Affected endpoints</span><span class="spec-rule-banner-value">'
    + escapeHtml(affected)
    + "</span></div>"
    + '<div class="spec-rule-banner-field"><span class="spec-rule-banner-label">Why it matters</span><span class="spec-rule-banner-value">'
    + escapeHtml(why)
    + "</span></div>"
    + "</div>";
}
