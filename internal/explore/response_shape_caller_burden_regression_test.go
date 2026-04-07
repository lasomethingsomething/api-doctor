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

func TestResponseShapeCallerBurdenRendersSingleAndMultiReasonRows(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-caller-burden-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeCallerBurdenRegressionDocument(t, responseShapeCallerBurdenPayload())), 0o600); err != nil {
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
		"--window-size=1280,2200",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := responseShapeCallerBurdenReport(string(out))
	if !report.ready {
		t.Fatalf("caller-burden regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Caller burden to avoid filler chips and render single/multi reasons correctly, got %d failures\n%s", report.failures, report.detail)
	}
}

func responseShapeCallerBurdenPayload() *Payload {
	now := "2026-04-04T00:00:00Z"

	f1 := "/caller-burden-1"
	f2 := "/caller-burden-2"
	f3 := "/caller-burden-3"

	baseRow := func(id, family string) EndpointRow {
		return EndpointRow{
			ID:             id,
			Method:         "GET",
			Path:           "/caller-burden/" + id,
			Family:         family,
			Findings:       3,
			Priority:       "high",
			SeverityCounts: map[string]int{"info": 3},
			CategoryCounts: map[string]int{"contract-shape": 3},
			BurdenFocuses:  []string{"contract-shape"},
		}
	}

	// 1 reason (deep nesting only)
	nesting := FindingDetail{
		Code:        "deeply-nested-response-structure",
		Severity:    "info",
		Category:    "contract-shape",
		BurdenFocus: "contract-shape",
		Message:     "Deep nesting makes the primary fields hard to locate.",
		Impact:      "Clients traverse deeply nested objects.",
	}

	// 2 reasons (nesting + duplicated state)
	internal := FindingDetail{
		Code:        "incidental-internal-field-exposure",
		Severity:    "info",
		Category:    "contract-shape",
		BurdenFocus: "contract-shape",
		Message:     "Internal fields dominate the response.",
		Impact:      "Clients couple to internal identifiers.",
	}

	// duplicated-state-response intentionally yields multiple shape signals (duplicated state + source-of-truth ambiguity).
	dup := FindingDetail{
		Code:        "duplicated-state-response",
		Severity:    "info",
		Category:    "contract-shape",
		BurdenFocus: "contract-shape",
		Message:     "Duplicated state appears likely across fields.",
		Impact:      "Clients reconcile redundant fields.",
	}

	endpoints := []EndpointRow{
		baseRow("c1", f1),
		baseRow("c2", f2),
		baseRow("c3", f3),
	}

	details := map[string]EndpointDetail{
		"c1": {Endpoint: endpoints[0], Findings: []FindingDetail{nesting}},
		"c2": {Endpoint: endpoints[1], Findings: []FindingDetail{nesting, internal}},
		"c3": {Endpoint: endpoints[2], Findings: []FindingDetail{nesting, dup, internal}},
	}

	return &Payload{
		Run:             RunContext{SpecPath: "spec.json", GeneratedAt: now},
		Summary:         Summary{TotalFindings: 9, EndpointsAnalyzed: len(endpoints), EndpointsWithIssue: len(endpoints)},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows:       WorkflowSection{},
		GraphSeed:       GraphSeed{},
	}
}

func inlineResponseShapeCallerBurdenRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-caller-burden-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeCallerBurdenHarness(),
		1,
	)
	return doc
}

func responseShapeCallerBurdenHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-caller-burden-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', hasTable: !!document.querySelector('.family-table') }]);
  }, 5000);

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

  function assertHeader(step, failures) {
    var headers = Array.prototype.slice.call(document.querySelectorAll('.family-table thead th'));
    if (!headers.length) {
      failures.push({ kind: 'missing-header-row', step: step });
      return;
    }
    if (document.querySelectorAll('.family-table thead').length !== 1) {
      failures.push({ kind: 'header-rendered-more-than-once', step: step, count: document.querySelectorAll('.family-table thead').length });
    }
    var callerHeaders = headers.filter(function (th) {
      return ((th.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase().indexOf('CALLER BURDEN') !== -1);
    });
    if (callerHeaders.length !== 1) {
      failures.push({ kind: 'caller-burden-header-count', step: step, count: callerHeaders.length, texts: headers.map(function (th) { return (th.textContent || '').trim(); }) });
      return;
    }
    if (!callerHeaders[0].classList.contains('family-col-caller-burden')) {
      failures.push({ kind: 'wrong-caller-burden-header-class', step: step, className: callerHeaders[0].className || '' });
    }
  }

  function assertCallerBurden(family, expectedChips, expectedMoreText, failures) {
    var row = document.querySelector('tr.family-row[data-family="' + family + '"][data-family-row="true"]');
    if (!row) {
      failures.push({ kind: 'missing-family-row', family: family });
      return;
    }
    var cell = row.querySelector('td.family-col-caller-burden');
    if (!cell) {
      failures.push({ kind: 'missing-caller-burden-cell', family: family });
      return;
    }
    var chips = cell.querySelectorAll('.caller-burden-cell .caller-burden-chip');
    var text = (cell.textContent || '').trim();
    if ((chips ? chips.length : 0) !== expectedChips) {
      failures.push({ kind: 'chip-count-mismatch', family: family, expected: expectedChips, got: (chips ? chips.length : 0), text: text });
    }
    if (/\(\+1\)/.test(text)) {
      failures.push({ kind: 'unexpected-plus-one-suffix', family: family, text: text });
    }
    if (expectedMoreText) {
      if (text.indexOf(expectedMoreText) === -1) {
        failures.push({ kind: 'missing-more-label', family: family, expected: expectedMoreText, text: text });
      }
    } else if (/\+\d+\s+more/.test(text)) {
      failures.push({ kind: 'unexpected-more-label', family: family, text: text });
    }
  }

  function assertCallerBurdenSurface(step, failures) {
    assertHeader(step + '-header', failures);
    assertCallerBurden('/caller-burden-1', 1, '', failures);
    assertCallerBurden('/caller-burden-2', 2, '', failures);
    assertCallerBurden('/caller-burden-3', 2, '+3 more', failures);
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    click('button.quick-action[data-id="shape"]');
    (function waitForShapeTable() {
      if (!document.querySelector('.family-table') || !document.body.classList.contains('lens-shape')) {
        return window.setTimeout(waitForShapeTable, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        assertCallerBurdenSurface('initial-shape', failures);

        click('tr.family-row[data-family-row="true"] td.family-col-endpoints button.endpoints-expand');
        window.setTimeout(function () {
          assertCallerBurdenSurface('after-expand', failures);

          click('button.quick-action[data-id="workflow"]');
          (function waitForWorkflow() {
            if (!document.body.classList.contains('lens-workflow')) {
              return window.setTimeout(waitForWorkflow, 50);
            }
            click('button.quick-action[data-id="shape"]');
            (function waitForShapeReturn() {
              if (!document.body.classList.contains('lens-shape') || !document.querySelector('.family-table')) {
                return window.setTimeout(waitForShapeReturn, 50);
              }
              window.setTimeout(function () {
                assertCallerBurdenSurface('after-tab-switch', failures);
                finish(failures);
              }, 180);
            })();
          })();
        }, 180);
      }, 180);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeCallerBurden struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeCallerBurdenReport(dom string) responseShapeCallerBurden {
	readyRe := regexp.MustCompile(`id="shape-caller-burden-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-caller-burden-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-caller-burden-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeCallerBurden{ready: ready, failures: failures, detail: detail}
}
