package explore

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestFamilyExpansionStaysInNormalFlowAcrossTabs(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "family-expansion-layout-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineFamilyExpansionLayoutRegressionDocument(t, familyExpansionLayoutPayload())), 0o600); err != nil {
		t.Fatalf("write regression fixture: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	cmd := exec.CommandContext(
		ctx,
		chromePath,
		"--headless",
		"--disable-gpu",
		"--no-sandbox",
		"--hide-scrollbars",
		"--run-all-compositor-stages-before-draw",
		"--virtual-time-budget=10000",
		"--window-size=1680,3600",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := familyExpansionLayoutReport(string(out))
	if !report.ready {
		t.Fatalf("family expansion layout regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected family endpoint expansion to remain in normal flow across tabs, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineFamilyExpansionLayoutRegressionDocument(t *testing.T, payload *Payload) string {
	t.Helper()

	indexBytes, err := webFS.ReadFile("web/index.html")
	if err != nil {
		t.Fatalf("read explorer index: %v", err)
	}
	cssBytes, err := webFS.ReadFile("web/app.css")
	if err != nil {
		t.Fatalf("read explorer css: %v", err)
	}
	jsBytes, err := webFS.ReadFile("web/app.js")
	if err != nil {
		t.Fatalf("read explorer js: %v", err)
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal regression payload: %v", err)
	}

	doc := string(indexBytes)
	doc = strings.Replace(doc, `<link rel="stylesheet" href="/static/app.css">`, "<style>\n"+string(cssBytes)+"\n</style>", 1)
	doc = strings.Replace(
		doc,
		`<script src="/static/app.js"></script>`,
		`<script>
window.fetch = function (url) {
  if (url === "/api/payload") {
    return Promise.resolve({
      json: function () {
        return Promise.resolve(`+string(payloadJSON)+`);
      }
    });
  }
  return Promise.reject(new Error("unexpected fetch: " + url));
};
</script>
<div id="family-expansion-layout-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+familyExpansionLayoutHarness(),
		1,
	)
	return doc
}

func familyExpansionLayoutHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('family-expansion-layout-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', hasTable: !!document.querySelector('.family-table') }]);
  }, 6000);

  function finish(failures) {
    if (finished) return;
    finished = true;
    if (watchdog) window.clearTimeout(watchdog);
    var n = node();
    if (!n) return;
    n.setAttribute('data-ready', 'true');
    n.setAttribute('data-failures', String(failures.length));
    n.textContent = JSON.stringify(failures);
  }

  function click(selector) {
    var el = document.querySelector(selector);
    if (el) el.click();
  }

  function familyRow(family) {
    return document.querySelector('tr.family-row[data-family="' + family + '"][data-family-row="true"]');
  }

  function expansionRow(family) {
    return document.querySelector('tr.family-endpoint-table-row[data-family="' + family + '"]');
  }

  function nextFamilyRow(row) {
    var next = row ? row.nextElementSibling : null;
    while (next) {
      if (next.matches && next.matches('tr.family-row[data-family-row="true"]')) return next;
      next = next.nextElementSibling;
    }
    return null;
  }

  function switchTab(tabId, bodyClass, done) {
    if (document.body.classList.contains(bodyClass)) {
      return window.setTimeout(done, 140);
    }
    click('button.quick-action[data-id="' + tabId + '"]');
    window.setTimeout(function wait() {
      if (!document.body.classList.contains(bodyClass) || !familyRow('/aggregate')) {
        return window.setTimeout(wait, 40);
      }
      done();
    }, 160);
  }

  function assertExpansionInFlow(tabId, failures, done) {
    var row = familyRow('/aggregate');
    if (!row) {
      failures.push({ kind: 'missing-family-row', tab: tabId, family: '/aggregate' });
      return done();
    }
    var nextRow = nextFamilyRow(row);
    if (!nextRow) {
      failures.push({ kind: 'missing-next-family-row', tab: tabId, family: '/aggregate' });
      return done();
    }
    var initialNextTop = nextRow.getBoundingClientRect().top;
    var btn = row.querySelector('button.endpoints-expand[data-expand-endpoints="/aggregate"]');
    if (!btn) {
      failures.push({ kind: 'missing-expand-button', tab: tabId, family: '/aggregate' });
      return done();
    }

    btn.click();
    window.setTimeout(function () {
      var expansion = expansionRow('/aggregate');
      if (!expansion) {
        failures.push({ kind: 'missing-expansion-row', tab: tabId, family: '/aggregate' });
        return done();
      }
      if (row.nextElementSibling !== expansion) {
        failures.push({ kind: 'expansion-not-direct-child-row', tab: tabId, family: '/aggregate' });
      }

      var cell = expansion.querySelector('td.family-expansion-cell');
      var shell = expansion.querySelector('.family-endpoint-table-shell');
      var scroll = expansion.querySelector('.family-endpoint-table-scroll');
      var heading = expansion.querySelector('.family-endpoint-table-title');
      var footer = expansion.querySelector('.family-endpoint-table-footer');
      var hideBtn = expansion.querySelector('button.family-endpoint-toggle[data-expand-endpoints="/aggregate"]');
      var nestedRows = expansion.querySelectorAll('tr.nested-endpoint-row[data-family="/aggregate"]');
      if (!cell || !shell || !scroll || !heading || !footer || !hideBtn) {
        failures.push({
          kind: 'missing-expansion-structure',
          tab: tabId,
          cell: !!cell,
          shell: !!shell,
          scroll: !!scroll,
          heading: !!heading,
          footer: !!footer,
          hideBtn: !!hideBtn
        });
        return done();
      }
      if (nestedRows.length < 10) {
        failures.push({ kind: 'too-few-nested-rows', tab: tabId, expectedMin: 10, got: nestedRows.length });
      }

      var expansionRect = expansion.getBoundingClientRect();
      var shellRect = shell.getBoundingClientRect();
      var footerRect = footer.getBoundingClientRect();
      var nextRect = nextRow.getBoundingClientRect();
      var lastRowRect = nestedRows.length ? nestedRows[nestedRows.length - 1].getBoundingClientRect() : null;

      if (shellRect.bottom > expansionRect.bottom + 1) {
        failures.push({ kind: 'shell-overflows-expansion-row', tab: tabId, shellBottom: shellRect.bottom, expansionBottom: expansionRect.bottom });
      }
      if (footerRect.bottom > expansionRect.bottom + 1) {
        failures.push({ kind: 'footer-overflows-expansion-row', tab: tabId, footerBottom: footerRect.bottom, expansionBottom: expansionRect.bottom });
      }
      if (lastRowRect && lastRowRect.bottom > shellRect.bottom + 1) {
        failures.push({ kind: 'last-endpoint-row-clipped', tab: tabId, lastRowBottom: lastRowRect.bottom, shellBottom: shellRect.bottom });
      }
      if (nextRect.top < expansionRect.bottom - 1) {
        failures.push({ kind: 'next-family-row-overlaps-expansion', tab: tabId, nextTop: nextRect.top, expansionBottom: expansionRect.bottom });
      }
      if ((nextRect.top - initialNextTop) < 120) {
        failures.push({ kind: 'expansion-did-not-push-layout', tab: tabId, initialNextTop: initialNextTop, expandedNextTop: nextRect.top });
      }

      var probeX = Math.max(shellRect.left + 16, 8);
      var probeY = Math.max(Math.min(shellRect.bottom - 10, window.innerHeight - 10), 8);
      var probeTarget = document.elementFromPoint(probeX, probeY);
      if (!probeTarget || !expansion.contains(probeTarget)) {
        failures.push({
          kind: 'bleed-through-under-expansion',
          tab: tabId,
          probeTarget: probeTarget ? (probeTarget.id || probeTarget.className || probeTarget.tagName) : ''
        });
      }

      hideBtn.click();
      window.setTimeout(function () {
        if (expansionRow('/aggregate')) {
          failures.push({ kind: 'collapse-did-not-remove-expansion', tab: tabId, family: '/aggregate' });
        }
        var collapsedNextRect = nextRow.getBoundingClientRect();
        if (Math.abs(collapsedNextRect.top - initialNextTop) > 3) {
          failures.push({
            kind: 'collapse-did-not-restore-layout',
            tab: tabId,
            initialNextTop: initialNextTop,
            collapsedNextTop: collapsedNextRect.top
          });
        }
        done();
      }, 220);
    }, 260);
  }

  function runTabs(tabs, failures, done) {
    if (!tabs.length) return done();
    var current = tabs[0];
    switchTab(current.id, current.bodyClass, function () {
      assertExpansionInFlow(current.id, failures, function () {
        runTabs(tabs.slice(1), failures, done);
      });
    });
  }

  function waitForUI() {
    if (!familyRow('/aggregate') || !document.querySelector('button.quick-action[data-id="workflow"]') || !document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    var failures = [];
    runTabs([
      { id: 'spec-rule', bodyClass: 'lens-spec-rule' },
      { id: 'workflow', bodyClass: 'lens-workflow' },
      { id: 'shape', bodyClass: 'lens-shape' }
    ], failures, function () {
      finish(failures);
    });
  }

  waitForUI();
})();
</script>
`
}

type familyExpansionLayoutRegression struct {
	ready    bool
	failures int
	detail   string
}

func familyExpansionLayoutReport(dom string) familyExpansionLayoutRegression {
	readyRe := regexp.MustCompile(`id="family-expansion-layout-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="family-expansion-layout-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="family-expansion-layout-regression"[^>]*>([^<]*)</div>`)

	ready := false
	if m := readyRe.FindStringSubmatch(dom); len(m) == 2 {
		ready = m[1] == "true"
	}
	failures := -1
	if m := failRe.FindStringSubmatch(dom); len(m) == 2 {
		if n, err := strconv.Atoi(m[1]); err == nil {
			failures = n
		}
	}
	detail := ""
	if m := textRe.FindStringSubmatch(dom); len(m) == 2 {
		detail = strings.TrimSpace(m[1])
	}

	return familyExpansionLayoutRegression{ready: ready, failures: failures, detail: detail}
}

func familyExpansionLayoutPayload() *Payload {
	now := "2026-04-09T00:00:00Z"
	endpoints := []EndpointRow{}
	details := map[string]EndpointDetail{}

	makeFindings := func(idx int) []FindingDetail {
		return []FindingDetail{
			{
				Code:           "operation-summary-missing",
				Severity:       "warn",
				Category:       "spec-rule",
				BurdenFocus:    "contract-rule",
				Operation:      "get",
				Message:        "Operation summary is missing for this endpoint.",
				Impact:         "Documentation and generated client affordances are weaker than they should be.",
				EvidenceType:   "spec-rule",
				SpecRuleID:     "operation-summary-required",
				NormativeLevel: "should",
				SpecSource:     "openapi",
				SpecLocation:   "#/paths/~1aggregate~1resource-" + strconv.Itoa(idx) + "/get/summary",
			},
			{
				Code:        "weak-follow-up-linkage",
				Severity:    "warn",
				Category:    "workflow",
				BurdenFocus: "workflow-burden",
				Operation:   "get",
				Message:     "The response does not clearly expose the next required identifier or follow-up action.",
				Impact:      "Clients have to infer sequence state from surrounding context.",
			},
			{
				Code:        "deeply-nested-response-structure",
				Severity:    "warn",
				Category:    "response-shape",
				BurdenFocus: "contract-shape",
				Operation:   "get",
				Message:     "Deep nesting makes the workflow outcome and next useful field easy to miss.",
				Impact:      "Clients spend extra effort traversing storage-shaped payload structure.",
			},
		}
	}

	for i := 0; i < 12; i++ {
		id := "aggregate-" + strconv.Itoa(i)
		path := "/aggregate/resource-" + strconv.Itoa(i)
		row := EndpointRow{
			ID:       id,
			Method:   "get",
			Path:     path,
			Findings: 3,
			SeverityCounts: map[string]int{
				"warn": 3,
			},
			CategoryCounts: map[string]int{
				"spec-rule":      1,
				"workflow":       1,
				"response-shape": 1,
			},
			BurdenFocuses: []string{"workflow-burden", "contract-shape", "contract-rule"},
			Priority:      "medium",
			RiskSummary:   "Cross-resource utility responses hide next steps under deep nested snapshots.",
			Family:        "/aggregate",
		}
		endpoints = append(endpoints, row)
		details[id] = EndpointDetail{
			Endpoint: row,
			Findings: makeFindings(i),
			RelatedChains: []ChainEntry{
				{
					ID:          "chain-aggregate",
					Kind:        "list-detail-action",
					EndpointIDs: []string{"aggregate-0", "aggregate-1", "next-0"},
					Summary:     "list: browse aggregates -> detail: inspect aggregate -> action: continue workflow",
					Reason:      "Aggregate utility calls feed later workflow steps but hide required handoff fields.",
				},
			},
		}
	}

	for i := 0; i < 2; i++ {
		id := "next-" + strconv.Itoa(i)
		path := "/followup/resource-" + strconv.Itoa(i)
		row := EndpointRow{
			ID:       id,
			Method:   "post",
			Path:     path,
			Findings: 3,
			SeverityCounts: map[string]int{
				"warn": 3,
			},
			CategoryCounts: map[string]int{
				"spec-rule":      1,
				"workflow":       1,
				"response-shape": 1,
			},
			BurdenFocuses: []string{"workflow-burden", "contract-shape", "contract-rule"},
			Priority:      "low",
			RiskSummary:   "Follow-up endpoints depend on aggregate context.",
			Family:        "/followup",
		}
		endpoints = append(endpoints, row)
		details[id] = EndpointDetail{
			Endpoint: row,
			Findings: makeFindings(100 + i),
		}
	}

	return &Payload{
		Run: RunContext{
			SpecPath:    "fixtures/family-expansion-layout.yaml",
			GeneratedAt: now,
		},
		Summary: Summary{
			TotalFindings:      len(endpoints) * 3,
			SeverityCounts:     map[string]int{"warn": len(endpoints) * 3},
			EndpointsAnalyzed:  len(endpoints),
			WorkflowsInferred:  1,
			ChainsInferred:     1,
			EndpointsWithIssue: len(endpoints),
		},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows: WorkflowSection{
			FamilyCounts: map[string]int{
				"/aggregate": 12,
				"/followup":  2,
			},
			Chains: []ChainEntry{
				{
					ID:          "chain-aggregate",
					Kind:        "list-detail-action",
					EndpointIDs: []string{"aggregate-0", "aggregate-1", "next-0"},
					Summary:     "list: browse aggregates -> detail: inspect aggregate -> action: continue workflow",
					Reason:      "Aggregate utility calls feed later workflow steps but hide required handoff fields.",
				},
			},
		},
		GraphSeed: GraphSeed{},
	}
}
