declare var state: ExplorerState;

declare function familySummaries(): ExplorerFamilySummary[];
declare function createEmptyEndpointRow(): ExplorerEndpointRow;
declare function endpointDetailForId(id: string): ExplorerEndpointDetail | null;
declare function groupFindings(findings: ExplorerFinding[]): IssueGroup[];
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function issueScopeLabelForKey(groupKey: string, familyName: string): string;
declare function renderIssueGroup(
  group: IssueGroup,
  index: number,
  options: { familyName?: string; endpoint?: ExplorerEndpointRow; commonScopeLabel?: string }
): string;
declare function escapeHtml(value: unknown): string;

function renderEndpointDiagnosticsEmptyState(): string {
  var families = familySummaries();
  if (!families.length) {
    return '<div class="empty">'
      + "<strong>Nothing to inspect yet</strong>"
      + '<p class="subtle">No families match the current table view, so no endpoint can be selected. Reset the table view above to continue.</p>'
      + "</div>";
  }
  return '<div class="empty"><p class="subtle">Endpoint diagnostics appear inline under the endpoint you select within a family’s expanded list.</p></div>';
}

function evidenceSectionTitleForActiveLens(): string {
  if (state.activeTopTab === "workflow") return "Evidence of workflow continuity risk";
  if (state.activeTopTab === "shape") return "Evidence of response-shape problems";
  return "Evidence of contract problems";
}

function evidenceGroupsSummaryLabel(groupCount: number): string {
  var count = (typeof groupCount === "number" && isFinite(groupCount)) ? groupCount : 0;
  return evidenceSectionTitleForActiveLens() + " (" + count + " by schema field and issue type)";
}

function evidenceGroupsGroupingBasisCopy(): string {
  return "Evidence grouped by schema field and issue type.";
}

function exactEvidenceTargetLabel(): string {
  return "Grouped deviations";
}

function exactEvidenceTabLabelWithCount(): string {
  var label = exactEvidenceTargetLabel();
  var detail = state.selectedEndpointId ? endpointDetailForId(state.selectedEndpointId) : null;
  if (!detail || !detail.findings) return label;
  var groups = groupFindings(findingsForActiveLens(detail.findings || []));
  var count = groups.length || 0;
  return label + " (" + count + " group" + (count === 1 ? "" : "s") + ")";
}

function exactEvidenceGroupsSummaryLabel(groupCount: number): string {
  var count = (typeof groupCount === "number" && isFinite(groupCount)) ? groupCount : 0;
  return exactEvidenceTargetLabel() + " (" + count + " group" + (count === 1 ? "" : "s") + ")";
}

function fullExactEvidenceClosedLabel(groupCount: number): string {
  var count = (typeof groupCount === "number" && isFinite(groupCount)) ? groupCount : 0;
  var unit = count === 1 ? "group" : "groups";
  return "Open grouped deviations (" + count + " " + unit + ")";
}

function fullExactEvidenceOpenLabel(): string {
  return "Hide grouped deviations";
}

function compactEvidenceOccurrenceLabel(message: string): string {
  var msg = (message || "").trim();
  if (!msg) return "";

  var responseMissingDescription = /^Response\s+([0-9]{3})\s+is\s+missing\s+(?:a\s+)?description\.?$/i.exec(msg);
  if (responseMissingDescription) return responseMissingDescription[1] + " missing description";

  var responseMissingSchema = /^Response\s+([0-9]{3})\s+has\s+no\s+schema\s+for\s+media\s+type\s+'([^']+)'\.?.*$/i.exec(msg);
  if (responseMissingSchema) return responseMissingSchema[1] + " missing schema (" + responseMissingSchema[2] + ")";

  var requestMissingSchema = /^Request\s+body\s+has\s+no\s+schema\s+for\s+media\s+type\s+'([^']+)'\.?.*$/i.exec(msg);
  if (requestMissingSchema) return "request missing schema (" + requestMissingSchema[1] + ")";

  var genericMissingDescription = /missing\s+the\s+required\s+"description"\s+field/i.exec(msg);
  if (genericMissingDescription) return "missing description";

  return msg.replace(/\s+/g, " ").replace(/\.$/, "");
}

function renderCountedOccurrencesList(groups: IssueGroup[]): string {
  var flat: string[] = [];
  (groups || []).forEach(function (group: IssueGroup) {
    var messages = group && group.messages ? group.messages : [];
    if (messages && messages.length) {
      messages.forEach(function (msg: string) {
        flat.push(String(msg || ""));
      });
      return;
    }
    if (group && group.preview) flat.push(String(group.preview || ""));
  });

  if (!flat.length) return "";

  var ordered: string[] = [];
  var counts: StringMap<number> = {};
  flat.forEach(function (msg: string) {
    var label = compactEvidenceOccurrenceLabel(msg);
    if (!label) return;
    if (!counts[label]) ordered.push(label);
    counts[label] = (counts[label] || 0) + 1;
  });

  if (!ordered.length) return "";
  var total = ordered.reduce(function (sum: number, label: string) { return sum + (counts[label] || 0); }, 0);
  var shown = ordered.slice(0, 10);
  var remaining = ordered.length - shown.length;

  return '<div class="counted-occurrences-summary" data-counted-occurrences="1">'
    + '<p class="counted-occurrences-title"><strong>Counted deviations</strong> (' + String(total) + ")</p>"
    + '<ul class="counted-occurrences-list">'
    + shown.map(function (label: string) {
      var n = counts[label] || 0;
      var suffix = n > 1 ? (" ×" + n) : "";
      return "<li>" + escapeHtml(label + suffix) + "</li>";
    }).join("")
    + "</ul>"
    + (remaining > 0 ? ('<p class="subtle counted-occurrences-more">+' + remaining + " more</p>") : "")
    + "</div>";
}

function renderFullExactEvidenceDrawer(
  groups: IssueGroup[],
  options?: { endpoint?: ExplorerEndpointRow; familyName?: string; open?: boolean }
): string {
  var opts = options || {};
  var endpoint = opts.endpoint || createEmptyEndpointRow();
  var familyName = opts.familyName || "";
  var openAttr = opts.open ? " open" : "";
  var groupCount = (groups || []).length || 0;
  var titleLabel = exactEvidenceGroupsSummaryLabel(groupCount);
  var closeControl = '<div class="details-close-row">'
    + '<button type="button" class="tertiary-action details-close-btn" data-close-details="1" aria-label="Hide evidence" title="Hide evidence">Hide evidence</button>'
    + "</div>";

  var commonScope = "";
  if (groups && groups.length > 1) {
    var scopeLabels = groups.map(function (group: IssueGroup) {
      return issueScopeLabelForKey((group && group.groupKey) ? group.groupKey : "", familyName);
    });
    commonScope = scopeLabels[0] || "";
    for (var i = 1; i < scopeLabels.length; i++) {
      if (scopeLabels[i] !== commonScope) {
        commonScope = "";
        break;
      }
    }
  }
  var scopeLine = commonScope
    ? ('<p class="subtle detail-section-copy detail-section-copy-scope"><strong>Scope:</strong> ' + escapeHtml(commonScope) + "</p>")
    : "";

  return '<details class="detail-evidence-drawer" data-full-exact-evidence="1"' + openAttr + ">"
    + '<summary><span class="evidence-drawer-title">' + escapeHtml(titleLabel) + "</span></summary>"
    + '<section class="detail-section detail-section-tight">'
    + closeControl
    + renderCountedOccurrencesList(groups)
    + '  <p class="subtle detail-section-copy">' + escapeHtml(evidenceGroupsGroupingBasisCopy()) + "</p>"
    + scopeLine
    + (groups || []).map(function (group: IssueGroup, index: number) {
      return renderIssueGroup(group, index, { familyName: familyName, endpoint: endpoint, commonScopeLabel: commonScope });
    }).join("")
    + "</section>"
    + "</details>";
}

function renderEndpointDiagnosticsTabs(): string {
  var tabs = [
    { id: "summary", label: "Endpoint summary", description: "what is wrong and why it matters" },
    { id: "exact", label: exactEvidenceTabLabelWithCount(), description: "evidence grouped by schema field and issue type" },
    { id: "consistency", label: "Consistency / drift", description: "sibling-route comparison" },
    { id: "cleaner", label: "Contract improvements", description: "concrete response and schema changes" }
  ];
  var activeTab = tabs.find(function (tab) {
    return tab.id === state.endpointDiagnosticsSubTab;
  }) || tabs[0];

  return '<div class="endpoint-diag-tabs-wrap">'
    + '<div class="endpoint-diag-tabs">'
    + tabs.map(function (tab) {
      var active = state.endpointDiagnosticsSubTab === tab.id ? " active" : "";
      return '<button type="button" class="endpoint-diag-tab' + active + '" data-endpoint-subtab="' + tab.id + '">' + escapeHtml(tab.label) + "</button>";
    }).join("")
    + "</div>"
    + '<p class="endpoint-diag-tab-description">' + escapeHtml(activeTab.description) + "</p>"
    + "</div>";
}
