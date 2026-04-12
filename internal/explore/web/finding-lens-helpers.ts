declare var state: ExplorerState;

function consistencyFindingsForDetail(findings: ExplorerFinding[]): ExplorerFinding[] {
  var consistencyCodes: StringMap<boolean> = {
    "detail-path-parameter-name-drift": true,
    "endpoint-path-style-drift": true,
    "sibling-path-shape-drift": true,
    "inconsistent-response-shape": true,
    "inconsistent-response-shape-family": true,
    "inconsistent-response-shapes": true,
    "inconsistent-response-shapes-family": true
  };
  return (findings || []).filter(function (finding: ExplorerFinding) {
    return !!consistencyCodes[finding.code || ""];
  });
}

function isConsistencyDriftFinding(finding: ExplorerFinding): boolean {
  if (!finding) return false;
  var code = finding.code || "";
  return code === "detail-path-parameter-name-drift"
    || code === "endpoint-path-style-drift"
    || code === "sibling-path-shape-drift"
    || code === "inconsistent-response-shape"
    || code === "inconsistent-response-shape-family"
    || code === "inconsistent-response-shapes"
    || code === "inconsistent-response-shapes-family"
    || (finding.burdenFocus || "") === "consistency";
}

function isSpecRuleFinding(finding: ExplorerFinding): boolean {
  if (!finding) return false;
  return finding.evidenceType === "spec-rule" || (finding.category || "") === "spec-rule";
}

function isWorkflowContinuityFinding(finding: ExplorerFinding): boolean {
  if (!finding) return false;
  if (isSpecRuleFinding(finding)) return false;
  if ((finding.burdenFocus || "") === "workflow-burden") return true;
  var code = finding.code || "";
  if (code === "prerequisite-task-burden") return true;
  if (code === "weak-list-detail-linkage") return true;
  if (code === "weak-follow-up-linkage") return true;
  if (code === "weak-action-follow-up-linkage") return true;
  if (code === "weak-accepted-tracking-linkage") return true;
  if (code === "weak-outcome-next-action-guidance") return true;
  var msg = (finding.message || "").toLowerCase();
  if (/token|bearer|authorization|api[-\s]?key|auth|header|context transfer|handoff/.test(msg)) return true;
  return false;
}

function isResponseShapeFinding(finding: ExplorerFinding): boolean {
  if (!finding) return false;
  if (isSpecRuleFinding(finding)) return false;
  var code = finding.code || "";
  return code === "deeply-nested-response-structure"
    || code === "duplicated-state-response"
    || code === "incidental-internal-field-exposure"
    || code === "snapshot-heavy-response"
    || code === "contract-shape-workflow-guidance-burden"
    || code === "weak-outcome-next-action-guidance";
}

function isShapeScopedFinding(finding: ExplorerFinding): boolean {
  if (!finding) return false;
  if (finding.evidenceType === "spec-rule") return false;
  if ((finding.burdenFocus || "") === "contract-shape") return true;

  var code = finding.code || "";
  return code === "contract-shape-workflow-guidance-burden"
    || code === "snapshot-heavy-response"
    || code === "deeply-nested-response-structure"
    || code === "duplicated-state-response"
    || code === "incidental-internal-field-exposure"
    || code === "prerequisite-task-burden"
    || code === "weak-outcome-next-action-guidance"
    || code === "weak-follow-up-linkage"
    || code === "weak-action-follow-up-linkage"
    || code === "weak-accepted-tracking-linkage"
    || code === "generic-object-response"
    || code === "weak-array-items-schema";
}

function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[] {
  var out = findings || [];

  if (state.activeTopTab === "spec-rule") {
    out = out.filter(function (finding: ExplorerFinding) {
      return isSpecRuleFinding(finding) || isConsistencyDriftFinding(finding);
    });
  }

  if (state.activeTopTab === "workflow") {
    out = out.filter(isWorkflowContinuityFinding);
  }

  if (state.activeTopTab === "shape") {
    out = out.filter(isResponseShapeFinding);
  }

  if (state.filters.category && state.filters.category !== "all") {
    if (state.filters.category === "spec-rule") {
      out = out.filter(function (finding: ExplorerFinding) {
        if (state.activeTopTab === "spec-rule") {
          return isSpecRuleFinding(finding) || isConsistencyDriftFinding(finding);
        }
        return isSpecRuleFinding(finding);
      });
    } else {
      out = out.filter(function (finding: ExplorerFinding) {
        if (!finding) return false;
        return (finding.category || "") === state.filters.category;
      });
    }
  }

  return out;
}
