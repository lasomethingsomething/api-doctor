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

func TestFamilyInsightTogglesFromFamilyCellAndNoRecommendedColumn(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "family-insight-toggle-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineFamilyInsightToggleRegressionDocument(t, familyInsightTogglePayload())), 0o600); err != nil {
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
		"--virtual-time-budget=9000",
		"--window-size=1280,620",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := familyInsightToggleReport(string(out))
	if !report.ready {
		t.Fatalf("family insight toggle regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected family insight to toggle from the Family cell without table reflow/scroll jumps, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineFamilyInsightToggleRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="family-insight-toggle-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+familyInsightToggleHarness(),
		1,
	)
	return doc
}

func familyInsightToggleHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('family-insight-toggle-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', hasTable: !!document.querySelector('.family-table') }]);
  }, 6500);

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

  function assertNoRecommendedColumn(step, failures) {
    var headers = Array.prototype.map.call(document.querySelectorAll('.family-table thead th'), function (th) {
      return (th.textContent || '').trim().toLowerCase();
    });
    var hasRecommended = headers.some(function (t) { return t.indexOf('recommended next click') !== -1; });
    if (hasRecommended) failures.push({ kind: 'recommended-column-still-present', step: step, headers: headers });

    var anyCell = document.querySelector('.family-table td.family-col-next-click');
    if (anyCell) failures.push({ kind: 'recommended-cell-still-present', step: step });
  }

  function assertInsightToggles(step, failures, done) {
    var firstRow = document.querySelector('tr.family-row[data-family-row="true"]');
    if (!firstRow) {
      failures.push({ kind: 'missing-first-row', step: step });
      return done();
    }
    var family = firstRow.getAttribute('data-family') || '';
    var btn = firstRow.querySelector('td.family-col-name button.family-name-toggle[data-insight-toggle]');
    if (!btn) {
      failures.push({ kind: 'missing-family-toggle', step: step });
      return done();
    }

    window.scrollTo(0, 420);
    var before = window.scrollY || 0;
    btn.click();

    window.setTimeout(function () {
      var after = window.scrollY || 0;
      if (Math.abs(after - before) > 1) {
        failures.push({ kind: 'scroll-jump', step: step, before: before, after: after });
      }

      var insightRow = document.querySelector('tr.family-inline-insight-row[data-family="' + family + '"]');
      if (!insightRow) {
        failures.push({ kind: 'missing-insight-row', step: step, family: family });
        return done();
      }
      var prev = insightRow.previousElementSibling;
      if (!prev || !prev.matches('tr.family-row[data-family="' + family + '"]')) {
        failures.push({ kind: 'insight-not-directly-below-row', step: step, family: family });
      }

      btn.click();
      window.setTimeout(function () {
        var closed = document.querySelector('tr.family-inline-insight-row[data-family="' + family + '"]');
        if (closed) failures.push({ kind: 'insight-did-not-close', step: step, family: family });
        done();
      }, 180);
    }, 180);
  }

  function runTab(tabId, failures, done) {
    click('button.quick-action[data-id="' + tabId + '"]');
    (function waitForTable() {
      if (!document.body.classList.contains(tabId === 'spec-rule' ? 'lens-spec-rule' : (tabId === 'workflow' ? 'lens-workflow' : 'lens-shape'))
        || !document.querySelector('.family-table')
        || !document.querySelector('tr.family-row[data-family-row="true"]')) {
        return window.setTimeout(waitForTable, 50);
      }
      window.setTimeout(function () {
        assertNoRecommendedColumn(tabId, failures);
        assertInsightToggles(tabId + '-toggle', failures, done);
      }, 200);
    })();
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]')
      || !document.querySelector('button.quick-action[data-id="workflow"]')
      || !document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    var failures = [];
    runTab('spec-rule', failures, function () {
      runTab('workflow', failures, function () {
        runTab('shape', failures, function () {
          finish(failures);
        });
      });
    });
  }

  waitForUI();
})();
</script>
`
}

type familyInsightToggle struct {
	ready    bool
	failures int
	detail   string
}

func familyInsightToggleReport(dom string) familyInsightToggle {
	readyRe := regexp.MustCompile(`id="family-insight-toggle-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="family-insight-toggle-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="family-insight-toggle-regression"[^>]*>([^<]*)</div>`)

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

	return familyInsightToggle{ready: ready, failures: failures, detail: detail}
}

func familyInsightTogglePayload() *Payload {
	now := "2026-04-05T00:00:00Z"

	var endpoints []EndpointRow
	details := map[string]EndpointDetail{}
	for i := 0; i < 28; i++ {
		family := "/family-" + strconv.Itoa(i) + "/resource"
		path := family + "/" + strings.Repeat("segment-", 3) + strconv.Itoa(i)
		id := "ep-" + strconv.Itoa(i)
		row := EndpointRow{
			ID:             id,
			Method:         "GET",
			Path:           path,
			Family:         family,
			Findings:       3,
			Priority:       "medium",
			SeverityCounts: map[string]int{"info": 3},
			CategoryCounts: map[string]int{"spec-rule": 1, "workflow-burden": 1, "contract-shape": 1},
			BurdenFocuses:  []string{"workflow-burden", "contract-shape"},
		}
		endpoints = append(endpoints, row)
		details[id] = EndpointDetail{
			Endpoint: row,
			Findings: []FindingDetail{
				{
					Code:         "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					Severity:     "info",
					Category:     "spec-rule",
					Message:      "Response Object is missing the required \"description\" field",
					Impact:       "Clients cannot interpret error conditions from the contract alone.",
					EvidenceType: "spec-rule",
					SpecRuleID:   "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					SpecSource:   "OpenAPI 3.0",
					SpecLocation: "paths." + path + ".responses.400.description",
				},
				{
					Code:        "weak-outcome-next-action-guidance",
					Severity:    "info",
					Category:    "workflow-burden",
					BurdenFocus: "workflow-burden",
					Message:     "Outcome is not clearly exposed; caller cannot infer the next valid action from the response.",
					Impact:      "Clients stall after success and must read docs to continue the workflow safely.",
				},
				{
					Code:        "snapshot-heavy-response",
					Severity:    "info",
					Category:    "contract-shape",
					BurdenFocus: "contract-shape",
					Message:     "Response is snapshot-heavy; task outcome and next action are hard to locate.",
					Impact:      "Clients do extra parsing and still miss the main result and next step.",
				},
			},
		}
	}

	return &Payload{
		Run:             RunContext{SpecPath: "spec.json", GeneratedAt: now},
		Summary:         Summary{TotalFindings: len(endpoints) * 3, EndpointsAnalyzed: len(endpoints), EndpointsWithIssue: len(endpoints)},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows:       WorkflowSection{FamilyCounts: map[string]int{}},
		GraphSeed:       GraphSeed{},
	}
}
