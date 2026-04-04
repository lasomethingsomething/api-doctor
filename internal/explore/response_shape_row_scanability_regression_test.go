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

func TestResponseShapeFamilyTableShowsSixRowsWithoutCrowding(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-row-scanability-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeRowScanabilityRegressionDocument(t, responseShapeRowScanabilityPayload())), 0o600); err != nil {
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
		"--window-size=1280,980",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := responseShapeRowScanabilityReport(string(out))
	if !report.ready {
		t.Fatalf("row-scanability regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape to show at least 6 readable rows without crowding, got %d failures\n%s", report.failures, report.detail)
	}
}

func responseShapeRowScanabilityPayload() *Payload {
	now := "2026-04-04T00:00:00Z"
	endpoints := make([]EndpointRow, 0, 9)
	details := make(map[string]EndpointDetail, 9)

	for i := 1; i <= 9; i++ {
		family := "/shape-scan-" + strconv.Itoa(i)
		id := "scan-" + strconv.Itoa(i)
		row := EndpointRow{
			ID:             id,
			Method:         "GET",
			Path:           "/shape-scan/" + id,
			Family:         family,
			Findings:       2,
			Priority:       "medium",
			SeverityCounts: map[string]int{"info": 2},
			CategoryCounts: map[string]int{"contract-shape": 2},
			BurdenFocuses:  []string{"contract-shape"},
		}
		endpoints = append(endpoints, row)
		details[id] = EndpointDetail{
			Endpoint: row,
			Findings: []FindingDetail{
				{
					Code:        "snapshot-heavy-response",
					Severity:    "info",
					Category:    "contract-shape",
					BurdenFocus: "contract-shape",
					Message:     "Response is snapshot-heavy; outcome framing is easy to miss.",
					Impact:      "Clients scan many fields to find the result.",
				},
				{
					Code:        "deeply-nested-response-structure",
					Severity:    "info",
					Category:    "contract-shape",
					BurdenFocus: "contract-shape",
					Message:     "Response structure appears deeply nested.",
					Impact:      "Clients traverse layers to find primary fields.",
				},
			},
		}
	}

	return &Payload{
		Run:             RunContext{SpecPath: "spec.json", GeneratedAt: now},
		Summary:         Summary{TotalFindings: len(endpoints) * 2, EndpointsAnalyzed: len(endpoints), EndpointsWithIssue: len(endpoints)},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows:       WorkflowSection{},
		GraphSeed:       GraphSeed{},
	}
}

func inlineResponseShapeRowScanabilityRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-row-scanability-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeRowScanabilityHarness(),
		1,
	)
	return doc
}

func responseShapeRowScanabilityHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-row-scanability-regression'); }
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

  function assertSixRows(step, failures) {
    var section = document.getElementById('familySurfaceSection');
    if (section && section.scrollIntoView) section.scrollIntoView({ block: 'start' });

    var rows = document.querySelectorAll('tr.family-row[data-family-row="true"]');
    if (!rows || rows.length < 6) {
      failures.push({ kind: 'not-enough-rows', step: step, got: (rows ? rows.length : 0) });
      return;
    }

    var first = rows[0].getBoundingClientRect();
    var sixth = rows[5].getBoundingClientRect();

    // Ensure rows have enough separation (not cramped) but also fit 6 on screen.
    var span = sixth.bottom - first.top;
    if (span > 620) {
      failures.push({ kind: 'too-tall-to-scan', step: step, span: span.toFixed(1) });
      return;
    }

    for (var i = 0; i < 6; i++) {
      var r = rows[i].getBoundingClientRect();
      var h = r.height;
      if (h < 46) {
        failures.push({ kind: 'row-too-short', step: step, index: i, height: h.toFixed(1) });
        return;
      }
      if (h > 140) {
        failures.push({ kind: 'row-too-tall', step: step, index: i, height: h.toFixed(1) });
        return;
      }
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    click('button.quick-action[data-id="shape"]');
    (function waitForTable() {
      if (!document.querySelector('.family-table')) {
        return window.setTimeout(waitForTable, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        assertSixRows('shape', failures);
        finish(failures);
      }, 260);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeRowScanability struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeRowScanabilityReport(dom string) responseShapeRowScanability {
	readyRe := regexp.MustCompile(`id="shape-row-scanability-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-row-scanability-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-row-scanability-regression"[^>]*>([^<]*)</div>`)

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
		detail = m[1]
	}

	return responseShapeRowScanability{ready: ready, failures: failures, detail: detail}
}

