declare var state: ExplorerState;

declare function escapeHtml(value: unknown): string;
declare function humanizeSignalLabel(value: string): string;
declare function humanFamilyLabel(value: string): string;
declare function sortedSignalLabels(map: StringMap<number>, limit?: number): string[];
declare function activeTopTabConfig(): ExplorerTopTab;
declare function pressureBadge(priority: string, className?: string): string;
declare function familyInsightBuildRankedSummary(family: ExplorerFamilySummary): ExplorerFamilyRankedSummary;
declare function uniq<T>(items: T[]): T[];
declare function hasFamilyDrillActive(
  state: ExplorerState,
  isExactFamilyName: (value: string) => boolean
): boolean;
declare function isExactFamilyName(value: string): boolean;
declare function filteredRows(): ExplorerEndpointRow[];
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function groupFindings(findings: ExplorerFinding[]): IssueGroup[];
declare function renderEndpointRow(
  endpoint: ExplorerEndpointRow,
  options?: { familyName?: string; inlineTable?: boolean }
): string;
declare function dominantSeverity(findings: ExplorerFinding[]): string;
declare function evidenceGroupTitleLine(group: IssueGroup): string;
declare function severityBadge(priority: string, className?: string): string;
declare function evidenceSectionTitleForActiveLens(): string;
declare function renderFamilyInsightPanel(
  family: ExplorerFamilySummary,
  preferredEndpointId?: string
): string;
declare function buildContractImprovementItems(
  detail: ExplorerEndpointDetail,
  findings: ExplorerFinding[]
): ContractImprovementItem[];

interface FamilyTableColumnContext {
  familyName: string;
  ranked: ExplorerFamilyRankedSummary;
  dxCounts: StringMap<number>;
}

interface FamilyTableColumn {
  key: string;
  thClass?: string;
  th?: string;
  thHtml?: string;
  thAttrs?: string;
  tdClass?: string;
  render?: (family: ExplorerFamilySummary, ctx: FamilyTableColumnContext) => string;
}

interface FamilyClientEffectCellValue {
  html: boolean;
  value: string;
}

interface FamilyTableRowRenderOptions {
  ranked?: ExplorerFamilyRankedSummary;
  dxCounts?: StringMap<number>;
  columns?: FamilyTableColumn[];
}

function renderFamilyTableClamp(text: string, className: string): string {
  var value = text || "—";
  return '<div class="' + className + '" title="' + escapeHtml(value) + '">' + escapeHtml(value) + "</div>";
}

function familyTopSignalLabelForRow(
  family: ExplorerFamilySummary,
  ranked: ExplorerFamilyRankedSummary
): string {
  var items = familySignalItemsForActiveLens(family, ranked).filter(Boolean);
  var top = items.length ? items[0] : "";
  return top ? humanizeSignalLabel(top) : "—";
}

function familySignalItemsForActiveLens(
  family: ExplorerFamilySummary,
  ranked: ExplorerFamilyRankedSummary
): string[] {
  if (state.activeTopTab === "workflow") {
    return sortedSignalLabels(family.workflowSignalCounts || {}, 50);
  }
  if (state.activeTopTab === "shape") {
    return sortedSignalLabels(family.shapeSignalCounts || {}, 50);
  }
  var dims = (family.topDimensions || []).slice();
  if (dims.length) return dims;
  return (ranked && ranked.dominantSignals) ? ranked.dominantSignals.slice() : [];
}

function renderFamilyDominantSignalsCell(
  family: ExplorerFamilySummary,
  ranked: ExplorerFamilyRankedSummary
): string {
  var items = familySignalItemsForActiveLens(family, ranked).filter(Boolean);
  if (!items.length) {
    if (state.activeTopTab === "workflow") items = ["missing next action"];
    else if (state.activeTopTab === "shape") items = ["storage-shaped response"];
    else items = ["mixed contract signals"];
  }

  var familyName = family.family || "unlabeled family";
  var inlineExpand = state.activeTopTab === "shape";
  var expanded = inlineExpand && !!(state.expandedFamilySignals && state.expandedFamilySignals[familyName]);
  var visibleCount = inlineExpand
    ? (expanded ? items.length : (items.length <= 4 ? items.length : 2))
    : (items.length <= 3 ? items.length : 2);
  var visible = items.slice(0, visibleCount);
  var hidden = items.slice(visibleCount);
  var visibleChips = visible.map(function (item: string, index: number) {
    var cls = index === 0 ? "chip chip-primary family-signal-chip" : "chip chip-secondary family-signal-chip";
    var label = humanizeSignalLabel(item);
    return '<span class="' + cls + '" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">'
      + escapeHtml(label)
      + "</span></span>";
  }).join("");

  var hiddenChips = hidden.map(function (item: string) {
    var label = humanizeSignalLabel(item);
    return '<span class="chip chip-secondary family-signal-chip" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">'
      + escapeHtml(label)
      + "</span></span>";
  }).join("");

  var more = "";
  if (inlineExpand && items.length > 4) {
    var label = expanded ? "Hide extra signals" : ("Show " + hidden.length + " more");
    more = '<button type="button" class="tertiary-action family-signal-expand" data-expand-signals="'
      + escapeHtml(familyName)
      + '" aria-expanded="' + (expanded ? "true" : "false") + '">'
      + escapeHtml(label)
      + "</button>";
  }

  return '<div class="family-signal-cell">'
    + '<div class="chips family-signal-chips">' + visibleChips + "</div>"
    + ((expanded && hiddenChips) ? ('<div class="chips family-signal-reveal" aria-label="More shape signals">' + hiddenChips + "</div>") : "")
    + more
    + "</div>";
}

function renderFamilyTopSignalCell(
  family: ExplorerFamilySummary,
  ranked: ExplorerFamilyRankedSummary
): string {
  var items = familySignalItemsForActiveLens(family, ranked).filter(Boolean);
  if (!items.length) {
    if (state.activeTopTab === "workflow") items = ["missing next action"];
    else if (state.activeTopTab === "shape") items = ["storage-shaped response"];
    else items = ["mixed contract signals"];
  }

  var familyName = family.family || "unlabeled family";
  var inlineExpand = state.activeTopTab === "shape";
  var expanded = inlineExpand && !!(state.expandedFamilySignals && state.expandedFamilySignals[familyName]);
  var visibleCount = state.activeTopTab === "workflow"
    ? Math.min(items.length, 2)
    : state.activeTopTab === "shape"
    ? 1
    : inlineExpand
    ? (expanded ? items.length : (items.length <= 4 ? items.length : 2))
    : (items.length <= 3 ? items.length : 2);
  var visible = items.slice(0, visibleCount).map(function (raw: string, index: number) {
    var label = raw ? humanizeSignalLabel(raw) : "—";
    var cls = index === 0 ? "chip chip-primary family-signal-chip" : "chip chip-secondary family-signal-chip";
    return '<span class="' + cls + '" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">'
      + escapeHtml(label)
      + "</span></span>";
  }).join("");
  var hidden = items.slice(visibleCount);

  var hiddenChips = hidden.map(function (item: string) {
    var label = humanizeSignalLabel(item);
    return '<span class="chip chip-secondary family-signal-chip" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">'
      + escapeHtml(label)
      + "</span></span>";
  }).join("");

  var more = "";
  if (inlineExpand && items.length > 4) {
    var label = expanded ? "Hide extra signals" : ("Show " + hidden.length + " more");
    more = '<button type="button" class="tertiary-action family-signal-expand" data-expand-signals="'
      + escapeHtml(familyName)
      + '" aria-expanded="' + (expanded ? "true" : "false") + '">'
      + escapeHtml(label)
      + "</button>";
  }

  return '<div class="family-signal-cell family-top-signal-cell">'
    + '<div class="chips family-signal-chips">' + visible + "</div>"
    + ((expanded && hiddenChips) ? ('<div class="chips family-signal-reveal" aria-label="More shape signals">' + hiddenChips + "</div>") : "")
    + more
    + "</div>";
}

function familyTableColumnsForActiveTab(): FamilyTableColumn[] {
  var tab = activeTopTabConfig();
  var shape = tab.id === "shape";
  var workflow = tab.id === "workflow";

  function severityMixHeaderHtml(): string {
    return '<span class="th-title">Severity mix</span>'
      + '<span class="th-helper" title="Counts are endpoints in this family with in-scope findings at each severity (High/Med/Low).">endpoint counts</span>';
  }

  function endpointsHeaderHtml(): string {
    return '<span class="th-title">Endpoints</span>'
      + '<span class="th-helper" title="Expands the family to show endpoint rows and inline evidence.">inline evidence</span>';
  }

  var cols: FamilyTableColumn[] = [
    {
      key: "family",
      thClass: "family-col-name",
      th: "Family",
      tdClass: "family-col-name",
      render: function (family: ExplorerFamilySummary, ctx: FamilyTableColumnContext): string {
        var familyName = ctx.familyName;
        return '<div class="family-name-static">'
          + '<span class="family-name-main">'
          + '<strong title="' + escapeHtml(humanFamilyLabel(familyName)) + '">' + escapeHtml(humanFamilyLabel(familyName)) + "</strong>"
          + '<span class="family-name-badgewrap">' + pressureBadge(family.pressure, "pressure-badge") + "</span>"
          + "</span>"
          + "</div>";
      }
    },
    {
      key: "priority",
      thClass: "family-col-priority",
      thHtml: severityMixHeaderHtml(),
      th: "",
      tdClass: "family-col-priority",
      render: function (family: ExplorerFamilySummary): string {
        return renderFamilyPriorityCountStack(family.priorityCounts || {});
      }
    },
    {
      key: "endpoints",
      thClass: "family-col-endpoints",
      thAttrs: ' title="Expand the family to see its endpoints and inline evidence."',
      thHtml: endpointsHeaderHtml(),
      tdClass: "family-col-endpoints",
      render: function (family: ExplorerFamilySummary, ctx: FamilyTableColumnContext): string {
        var familyName = ctx.familyName;
        var endpointsExpanded = state.expandedFamily === familyName;
        return '<button type="button" class="endpoints-expand' + (endpointsExpanded ? " is-expanded" : "") + '" data-expand-endpoints="'
          + escapeHtml(familyName)
          + '" aria-expanded="' + (endpointsExpanded ? "true" : "false") + '" title="'
          + escapeHtml(endpointsExpanded ? "Hide endpoints in this family" : "Show endpoints in this family")
          + '" aria-label="'
          + escapeHtml(endpointsExpanded ? "Hide endpoints in this family" : "Show endpoints in this family")
          + '">'
          + '<span class="endpoints-expand-count">' + family.endpoints + "</span>"
          + '<span class="endpoints-expand-chevron" aria-hidden="true"></span>'
          + "</button>";
      }
    }
  ];

  cols.push({
    key: "signals",
    thClass: "family-col-top-signal",
    th: workflow ? "Main blocker" : shape ? "Main shape problem" : "Lead signal",
    tdClass: "family-col-top-signal",
    render: function (family: ExplorerFamilySummary, ctx: FamilyTableColumnContext): string {
      return renderFamilyTopSignalCell(family, ctx.ranked);
    }
  });

  cols.push({
    key: "risk",
    thClass: "family-col-primary-risk",
    th: workflow ? "Why developers get stuck" : shape ? "Why this response is hard" : "Why this matters",
    tdClass: "family-col-primary-risk",
    render: function (_family: ExplorerFamilySummary, ctx: FamilyTableColumnContext): string {
      var ranked = ctx.ranked || familyInsightBuildRankedSummary(_family);
      var whyText = ranked.dxConsequence || ranked.primaryRisk || (ranked.driver === "workflow"
        ? "Developers must infer multi-step behavior from runtime instead of contract guidance."
        : ranked.driver === "shape"
        ? "Developers have to interpret storage-shaped payloads instead of a task outcome."
        : "Developers cannot reliably infer behavior from the contract alone.");
      var clampClass = state.activeTopTab === "workflow"
        ? "family-table-clamp family-table-clamp-2 family-table-clamp-risk"
        : shape
        ? "family-table-clamp family-table-clamp-risk"
        : "family-table-clamp family-table-clamp-3 family-table-clamp-risk";
      return renderFamilyTableClamp(whyText, clampClass);
    }
  });

  cols.push({
    key: "impact",
    thClass: "family-col-client-effect",
    th: workflow ? "What should change" : shape ? "What should change" : "Recommended fix direction",
    tdClass: "family-col-client-effect",
    render: function (family: ExplorerFamilySummary, ctx: FamilyTableColumnContext): string {
      var ranked = ctx.ranked || familyInsightBuildRankedSummary(family);
      var clampClass = state.activeTopTab === "workflow"
        ? "family-table-clamp family-table-clamp-2 family-table-clamp-effect"
        : "family-table-clamp family-table-clamp-3 family-table-clamp-effect";
      return renderFamilyTableClamp(ranked.recommendedAction || "Clarify the contract for the next developer action.", clampClass);
    }
  });

  cols.push({
    key: "actions",
    thClass: "family-col-actions",
    th: "Actions",
    tdClass: "family-col-actions",
    render: function (_family: ExplorerFamilySummary, ctx: FamilyTableColumnContext): string {
      var familyName = ctx.familyName;
      var insightExpanded = state.expandedFamilyInsight === familyName;
      return '<button type="button" class="secondary-action family-row-action" data-insight-toggle="' + escapeHtml(familyName) + '"'
        + ' aria-expanded="' + (insightExpanded ? "true" : "false") + '"'
        + ' title="' + escapeHtml(insightExpanded ? "Hide details" : "Show details") + '">'
        + escapeHtml(insightExpanded ? "Hide details" : "Show details")
        + "</button>";
    }
  });

  return cols;
}

function familyTableColumnCountForActiveTab(): number {
  return familyTableColumnsForActiveTab().length;
}

function renderFamilyTableColGroup(cols: FamilyTableColumn[]): string {
  if (!cols || !cols.length) return "";
  return "<colgroup>" + cols.map(function (col: FamilyTableColumn) {
    var klass = col.tdClass || col.thClass || "";
    return "<col" + (klass ? (' class="' + escapeHtml(klass) + '"') : "") + ">";
  }).join("") + "</colgroup>";
}

function renderFamilyTableView(summaries: ExplorerFamilySummary[]): string {
  if (!summaries.length) return "";

  function familyHeaderLabelHtml(col: FamilyTableColumn): string {
    if (!col) return "";
    if (col.thHtml) return col.thHtml;
    if (col.th) return '<span class="th-title">' + escapeHtml(col.th) + "</span>";
    return "";
  }

  function focusedFamilyNameFromSummaries(items: ExplorerFamilySummary[]): string {
    var search = (state.filters.search || "").trim().toLowerCase();
    if (!search || search.charAt(0) !== "/") return "";
    var match = (items || []).find(function (family: ExplorerFamilySummary) {
      return ((family.family || "").trim().toLowerCase() === search);
    });
    return match ? (match.family || "") : "";
  }

  var drilled = hasFamilyDrillActive(state, isExactFamilyName);
  var focusedFamily = focusedFamilyNameFromSummaries(summaries);
  var expansionOwnsContext = !!state.expandedFamily;
  var hasContextBar = !expansionOwnsContext && (drilled || !!focusedFamily);
  var contextLabel = focusedFamily
    ? ("<strong>Focused family:</strong> " + escapeHtml(focusedFamily))
    : "<strong>All families</strong>";
  var backControl = drilled && !expansionOwnsContext
    ? '<button type="button" class="secondary-action family-table-back" data-recovery-action="back-to-all-families">Back to all families</button>'
    : "";
  var contextBar = hasContextBar
    ? '<div class="family-table-contextbar" role="status" aria-label="Family table context">'
        + '<div class="family-table-contextlabel">' + contextLabel + "</div>"
        + '<div class="family-table-contextactions">' + backControl + "</div>"
      + "</div>"
    : "";
  var cols = familyTableColumnsForActiveTab();

  var rankedByFamily: StringMap<ExplorerFamilyRankedSummary> = {};
  var dxConsequenceCounts: StringMap<number> = {};
  summaries.forEach(function (family: ExplorerFamilySummary) {
    var key = family.family || "unlabeled family";
    var ranked = familyInsightBuildRankedSummary(family);
    rankedByFamily[key] = ranked;
    var dx = ranked.dxConsequence || "";
    dxConsequenceCounts[dx] = (dxConsequenceCounts[dx] || 0) + 1;
  });

  var rows: string[] = [];
  summaries.forEach(function (family: ExplorerFamilySummary) {
    var key = family.family || "unlabeled family";
    rows.push(renderFamilyTableRow(family, {
      ranked: rankedByFamily[key],
      dxCounts: dxConsequenceCounts,
      columns: cols
    }));
    var familyInsightRow = renderFamilyInlineInsightRow(family);
    if (familyInsightRow) rows.push(familyInsightRow);
    var expansionHtml = renderFamilyEndpointExpansion(family);
    if (expansionHtml) rows.push(expansionHtml);
  });

  return '<div class="family-table-shell' + (hasContextBar ? " family-table-shell-scoped" : "") + (focusedFamily ? " family-table-shell-has-focus" : "") + '">'
    + contextBar
    + '<table class="family-table">'
    + renderFamilyTableColGroup(cols)
    + '<thead class="family-table-head"><tr>'
    + cols.map(function (col: FamilyTableColumn) {
      var klass = col.thClass ? (' class="' + col.thClass + '"') : "";
      var attrs = col.thAttrs || "";
      return "<th" + klass + attrs + ">" + familyHeaderLabelHtml(col) + "</th>";
    }).join("")
    + "</tr></thead>"
    + "<tbody>"
    + rows.join("")
    + "</tbody>"
    + "</table>"
    + "</div>";
}

function renderFamilyTableRow(
  family: ExplorerFamilySummary,
  options?: FamilyTableRowRenderOptions
): string {
  var settings = options || {};
  var familyName = family.family || "unlabeled family";
  var ranked = settings.ranked || familyInsightBuildRankedSummary(family);
  var expandedClass = state.expandedFamily === familyName ? " is-expanded" : "";
  var search = (state.filters.search || "").trim().toLowerCase();
  var isFocused = (search && search.charAt(0) === "/" && familyName.trim().toLowerCase() === search)
    || state.expandedFamily === familyName
    || state.expandedFamilyInsight === familyName;
  var focusedClass = isFocused ? " row-focused" : "";
  var workflowFamilyActiveClass = (state.activeTopTab === "workflow" && state.expandedFamily === familyName)
    ? " family-row-workflow-active"
    : "";
  var cols = settings.columns || [];
  var ctx: FamilyTableColumnContext = {
    familyName: familyName,
    ranked: ranked,
    dxCounts: settings.dxCounts || {}
  };

  return '<tr class="family-row pressure-' + family.pressure + expandedClass + focusedClass + workflowFamilyActiveClass + '" data-family="'
    + escapeHtml(family.family)
    + '" data-family-row="true" data-driver="' + escapeHtml(ranked.driver || "contract") + '">'
    + cols.map(function (col: FamilyTableColumn) {
      var tdClass = col.tdClass ? (' class="' + col.tdClass + '"') : "";
      var extra = col.key === "family" ? (' data-focus-family-cell="' + escapeHtml(familyName) + '"') : "";
      return "<td" + tdClass + extra + ">" + (col.render ? col.render(family, ctx) : "") + "</td>";
    }).join("")
    + "</tr>";
}

function renderDxConsequenceCellValue(
  ranked: ExplorerFamilyRankedSummary,
  repeatCount: number
): FamilyClientEffectCellValue {
  var consequence = (ranked && ranked.dxConsequence) ? ranked.dxConsequence : "";
  if (!consequence) return { html: false, value: "—" };

  if (repeatCount >= 4) {
    var parts = (ranked.dxParts && ranked.dxParts.length) ? ranked.dxParts : [consequence.replace(/\.$/, "")];
    var label = parts[0] || consequence.replace(/\.$/, "");
    if (parts.length > 2) {
      label = label + " (+" + (parts.length - 1) + ")";
    }
    return {
      html: true,
      value: '<span class="family-effect-repeat" title="' + escapeHtml(consequence) + '">' + escapeHtml(label) + "</span>"
    };
  }

  return { html: false, value: consequence };
}

function renderCallerBurdenCellValue(
  ranked: ExplorerFamilyRankedSummary
): FamilyClientEffectCellValue {
  var reasons = (ranked && ranked.dxReasons && ranked.dxReasons.length)
    ? ranked.dxReasons.slice()
    : ((ranked && ranked.dxParts && ranked.dxParts.length) ? ranked.dxParts.slice() : []);
  reasons = uniq((reasons || []).filter(Boolean));
  if (!reasons.length) return { html: false, value: "—" };

  var primary = reasons[0] || "";
  var secondary = reasons[1] || "";
  var hidden = reasons.slice(1);

  if (reasons.length === 1) {
    return {
      html: true,
      value: '<div class="caller-burden-cell">'
        + '<span class="chip chip-primary caller-burden-chip" title="' + escapeHtml(primary) + '">'
        + escapeHtml(primary)
        + "</span>"
        + "</div>"
    };
  }

  if (reasons.length === 2) {
    return {
      html: true,
      value: '<div class="caller-burden-cell">'
        + '<span class="chip chip-primary caller-burden-chip" title="' + escapeHtml(primary) + '">'
        + escapeHtml(primary)
        + "</span>"
        + '<span class="chip chip-secondary caller-burden-chip" title="' + escapeHtml(secondary) + '">'
        + escapeHtml(secondary)
        + "</span>"
        + "</div>"
    };
  }

  return {
    html: true,
    value: '<div class="caller-burden-cell">'
      + '<span class="chip chip-primary caller-burden-chip" title="' + escapeHtml(primary) + '">'
      + escapeHtml(primary)
      + "</span>"
      + '<span class="chip chip-secondary caller-burden-chip caller-burden-more" title="' + escapeHtml(hidden.join("; ")) + '">+'
      + String(hidden.length)
      + " more</span>"
      + "</div>"
  };
}

function renderFamilyClientEffectCell(effect: FamilyClientEffectCellValue): string {
  var resolved = effect || { html: false, value: "—" };
  if (resolved.html) {
    return '<div class="family-client-effect-chipwrap">' + resolved.value + "</div>";
  }
  return renderFamilyTableClamp(resolved.value || "—", "family-table-clamp family-table-clamp-3 family-table-clamp-effect");
}

function renderFamilyPriorityCountStack(priorityCounts: StringMap<number>): string {
  var counts = priorityCounts || {};

  if (state.activeTopTab === "workflow" || state.activeTopTab === "shape") {
    var high = counts.high || 0;
    var medium = counts.medium || 0;
    var low = counts.low || 0;
    var title = "Severity mix (endpoint counts): High " + high + ", Medium " + medium + ", Low " + low + ". Counts are endpoints in this family with in-scope findings at each severity.";

    function chip(key: string, shortLabel: string, value: number): string {
      return '<span class="pressure-mix-chip mix-' + escapeHtml(key) + '" title="' + escapeHtml(shortLabel + ": " + value + " endpoints") + '">'
        + '<span class="pressure-mix-label">' + escapeHtml(shortLabel) + "</span>"
        + '<span class="pressure-mix-count">' + String(value) + "</span>"
        + "</span>";
    }

    return '<div class="pressure-mix-inline" title="' + escapeHtml(title) + '">'
      + chip("high", "High", high)
      + chip("medium", "Med", medium)
      + chip("low", "Low", low)
      + "</div>";
  }

  var items = [
    { key: "high", label: "High:" },
    { key: "medium", label: "Medium:" },
    { key: "low", label: "Low:" }
  ];
  var lines = items.filter(function (item) {
    return (counts[item.key] || 0) > 0;
  }).map(function (item) {
    var value = counts[item.key] || 0;
    return '<div class="family-priority-line" title="' + escapeHtml(item.label.replace(":", "") + ": " + value) + '">'
      + '<span class="family-priority-chip priority-' + escapeHtml(item.key) + '">' + escapeHtml(item.label) + "</span>"
      + '<span class="family-priority-count">' + value + "</span>"
      + "</div>";
  }).join("");

  if (!lines) return '<span class="subtle">—</span>';
  return '<div class="family-priority-stack">' + lines + "</div>";
}

function renderFamilyInlineInsightRow(family: ExplorerFamilySummary): string {
  var familyName = family.family || "unlabeled family";
  if (state.expandedFamilyInsight !== familyName) return "";

  return '<tr class="family-expansion-row family-inline-insight-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="'
    + escapeHtml(family.family)
    + '"><td colspan="'
    + String(familyTableColumnCountForActiveTab())
    + '" class="family-expansion-cell"><div class="family-row-insight">'
    + renderFamilyInsightPanel(family)
    + "</div></td></tr>";
}

function renderFamilyEndpointExpansion(family: ExplorerFamilySummary): string {
  var familyName = family.family || "unlabeled family";
  if (state.expandedFamily !== familyName) return "";

  var familyLabel = humanFamilyLabel(familyName);
  var familyHeader = '<p class="family-endpoint-table-title">'
    + (state.activeTopTab === "workflow"
      ? 'Workflow evidence in <code>' + escapeHtml(familyLabel) + '</code> family'
      : 'Endpoints in <code>' + escapeHtml(familyLabel) + '</code> family')
    + "</p>";
  var headerRow = '<div class="family-endpoint-table-header-row">' + familyHeader + "</div>";
  var backToTableControl = state.familyTableBackState
    ? '<button type="button" class="secondary-action family-endpoint-footer-action" data-recovery-action="back-to-all-families">Back to all families</button>'
    : "";
  var collapseControl = '<button type="button" class="tertiary-action family-endpoint-toggle family-endpoint-footer-action" data-expand-endpoints="'
    + escapeHtml(familyName)
    + '" aria-label="Hide endpoints" title="Hide endpoints"><span class="family-endpoint-toggle-label">Hide endpoints</span><span class="family-endpoint-toggle-chevron" aria-hidden="true"></span></button>';
  var footerActions = '<div class="family-endpoint-table-actions family-endpoint-table-footer-actions">'
    + backToTableControl
    + collapseControl
    + "</div>";

  var endpointsInFamily = filteredRows().filter(function (endpoint: ExplorerEndpointRow) {
    return (endpoint.family || "unlabeled family") === familyName;
  });

  if (!endpointsInFamily.length) {
    return '<tr class="family-expansion-row family-endpoint-table-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="'
      + escapeHtml(family.family)
      + '"><td colspan="'
      + String(familyTableColumnCountForActiveTab())
      + '" class="family-expansion-cell"><div class="family-endpoint-table-shell"><div class="empty inline-empty family-inline-empty"><section class="family-endpoint-table-section" aria-label="'
      + escapeHtml("Endpoints in " + familyLabel + " family")
      + '">'
      + headerRow
      + "<strong>No endpoint rows match this family in the current lens.</strong>"
      + '<p class="subtle">Widen the current table view to repopulate this family-owned endpoint table.</p>'
      + '<div class="family-endpoint-table-footer">' + footerActions + "</div>"
      + "</section></div></div></td></tr>";
  }

  var endpointDetails = state.payload ? state.payload.endpointDetails || {} : {};
  var nestedRows = endpointsInFamily.map(function (endpoint: ExplorerEndpointRow) {
    var detail = endpointDetails[endpoint.id];
    var findings = detail ? findingsForActiveLens(detail.findings || []) : [];
    var groups = groupFindings(findings);
    var topGroup = groups[0] || null;
    var html = renderEndpointRow(endpoint, {
      familyName: familyName,
      inlineTable: true
    });

    if (state.expandedEndpointInsightIds[endpoint.id]) {
      var topMsg = topGroup && topGroup.messages && topGroup.messages[0]
        ? topGroup.messages[0]
        : (findings[0] && findings[0].message ? findings[0].message : "No issue message extracted.");
      var severity = dominantSeverity(findings);
      var why = topGroup && topGroup.impact
        ? topGroup.impact
        : "Clients may need extra guesswork or follow-up reads because the contract does not make the next step or safe fields obvious.";
      var improvementItems = buildContractImprovementItems(detail || ({ endpoint: endpoint, findings: findings } as ExplorerEndpointDetail), findings);
      var nextChanges = (improvementItems || []).slice(0, 3).map(function (item: ContractImprovementItem) {
        return '<li>' + escapeHtml(item.change || "Clarify the contract for the next developer action.") + "</li>";
      }).join("");
      var evidenceCount = groups.length || 0;
      var topEvidenceTitle = topGroup ? evidenceGroupTitleLine(topGroup) : "";
      var evidenceSummary = evidenceCount
        ? ('<p class="nested-endpoint-preview-why"><strong>' + evidenceCount + ' evidence group' + (evidenceCount === 1 ? '' : 's') + '.</strong> '
          + escapeHtml(topEvidenceTitle || 'Open details to inspect grouped evidence.')
          + '</p>')
        : '<p class="subtle">No grouped evidence was available for this endpoint in the current view.</p>';
      var compactChanges = (improvementItems || []).slice(0, 2).map(function (item: ContractImprovementItem) {
        return '<li>' + escapeHtml(item.change || "Clarify the contract for the next developer action.") + "</li>";
      }).join("");

      html += '<tr class="nested-endpoint-preview-row" data-family="' + escapeHtml(family.family) + '" data-endpoint-id="' + escapeHtml(endpoint.id) + '">'
        + '<td colspan="7" class="nested-endpoint-preview-cell">'
        + '<div class="nested-endpoint-preview"><div class="nested-endpoint-preview-grid">'
        + '<div class="nested-endpoint-preview-block"><p class="nested-endpoint-preview-label">Why this is hard</p><div class="nested-endpoint-preview-value">'
        + (findings.length ? severityBadge(severity) : "")
        + '<span class="nested-endpoint-preview-text" title="' + escapeHtml(topMsg) + '">' + escapeHtml(topMsg) + "</span>"
        + '</div></div>'
        + '<div class="nested-endpoint-preview-block"><p class="nested-endpoint-preview-label">Exact evidence</p>'
        + evidenceSummary
        + "</div>"
        + '<div class="nested-endpoint-preview-block"><p class="nested-endpoint-preview-label">What should change next</p>'
        + (compactChanges
            ? ('<ul class="preview-evidence-list preview-change-list">' + compactChanges + "</ul>")
            : '<p class="subtle">No concrete contract changes were derived for this endpoint yet.</p>')
        + "</div>"
        + "</div>"
        + "</div></td></tr>";
    }

    return html;
  }).join("");

  return '<tr class="family-expansion-row family-endpoint-table-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="'
    + escapeHtml(family.family)
    + '"><td colspan="'
    + String(familyTableColumnCountForActiveTab())
    + '" class="family-expansion-cell"><div class="family-endpoint-table-shell"><section class="family-endpoint-table-section" aria-label="'
    + escapeHtml("Endpoints in " + familyLabel + " family")
    + '"><div class="family-endpoint-table-header">'
    + headerRow
    + '<p class="eyebrow">' + escapeHtml(evidenceSectionTitleForActiveLens()) + "</p>"
    + '<p class="subtle">Endpoint rows stay attached to this family so the ownership and investigation flow stay together.</p>'
    + '</div><div class="family-endpoint-table-scroll" data-family-endpoint-table-scroll="1"><table class="nested-endpoint-table"><colgroup><col class="nested-col-path"><col class="nested-col-issue"><col class="nested-col-type"><col class="nested-col-severity"><col class="nested-col-instance"><col class="nested-col-actionhint"><col class="nested-col-actions"></colgroup><thead><tr>'
    + (state.activeTopTab === "workflow"
        ? '<th>Step</th><th>Main blocker</th><th>Problem type</th><th>Severity</th><th>Evidence</th><th>What should change</th><th class="nested-endpoint-actions-col">Details</th>'
        : state.activeTopTab === "shape"
        ? '<th>Endpoint</th><th>Main shape problem</th><th>Problem type</th><th>Severity</th><th>Evidence</th><th>What should change</th><th class="nested-endpoint-actions-col">Details</th>'
        : '<th>Endpoint</th><th>Lead issue</th><th>Type</th><th>Severity</th><th>Evidence</th><th>Suggested action</th><th class="nested-endpoint-actions-col">Actions</th>')
    + '</tr></thead><tbody>'
    + nestedRows
    + '</tbody></table></div><div class="family-endpoint-table-footer"><span class="subtle">End of endpoints in <code>'
    + escapeHtml(familyLabel)
    + "</code> family.</span>"
    + footerActions
    + "</div></section></div></td></tr>";
}
