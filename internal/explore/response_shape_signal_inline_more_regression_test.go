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

func TestResponseShapeSignalInlineMoreRenders1Or2HiddenSignalsInline(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-signal-inline-more-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeSignalInlineMoreRegressionDocument(t, responseShapeSignalInlineMorePayload())), 0o600); err != nil {
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

	report := responseShapeSignalInlineMoreReport(string(out))
	if !report.ready {
		t.Fatalf("inline-more regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape to inline-render 1–2 hidden signals and only toggle at 3+ hidden, got %d failures\n%s", report.failures, report.detail)
	}
}

func responseShapeSignalInlineMorePayload() *Payload {
	now := "2026-04-04T00:00:00Z"

	f2 := "/shape-inline-2"
	f3 := "/shape-inline-3"
	f4 := "/shape-inline-4"
	f5 := "/shape-inline-5"

	baseRow := func(id, family string) EndpointRow {
		return EndpointRow{
			ID:             id,
			Method:         "GET",
			Path:           "/shape-inline/" + id,
			Family:         family,
			Findings:       5,
			Priority:       "high",
			SeverityCounts: map[string]int{"info": 5},
			CategoryCounts: map[string]int{"contract-shape": 5},
			BurdenFocuses:  []string{"contract-shape"},
		}
	}

	snapshot := FindingDetail{
		Code:        "snapshot-heavy-response",
		Severity:    "info",
		Category:    "contract-shape",
		BurdenFocus: "contract-shape",
		Message:     "Response is snapshot-heavy; outcome framing is easy to miss.",
		Impact:      "Clients parse too much state to find the result.",
	}
	internal := FindingDetail{
		Code:        "incidental-internal-field-exposure",
		Severity:    "info",
		Category:    "contract-shape",
		BurdenFocus: "contract-shape",
		Message:     "Internal fields dominate the response shape.",
		Impact:      "Clients couple to incidental storage state.",
	}
	nesting := FindingDetail{
		Code:        "deeply-nested-response-structure",
		Severity:    "info",
		Category:    "contract-shape",
		BurdenFocus: "contract-shape",
		Message:     "Deep nesting makes the primary outcome hard to locate.",
		Impact:      "Clients take on deep traversal logic.",
	}
	nextAction := FindingDetail{
		Code:        "weak-outcome-next-action-guidance",
		Severity:    "info",
		Category:    "contract-shape",
		BurdenFocus: "contract-shape",
		Message:     "Next action is weakly exposed in the response.",
		Impact:      "Clients stall after success.",
	}

	// Total shape signals per family (unique labels after bumping):
	// f2: snapshot => 2 signals (hidden 0)
	// f3: snapshot + internal => 3 signals (hidden 1)
	// f4: snapshot + internal + nesting => 4 signals (hidden 2)
	// f5: snapshot + internal + nesting + nextAction => 5 signals (hidden 3)
	endpoints := []EndpointRow{
		baseRow("s2", f2),
		baseRow("s3", f3),
		baseRow("s4", f4),
		baseRow("s5", f5),
	}

	details := map[string]EndpointDetail{
		"s2": {Endpoint: endpoints[0], Findings: []FindingDetail{snapshot}},
		"s3": {Endpoint: endpoints[1], Findings: []FindingDetail{snapshot, internal}},
		"s4": {Endpoint: endpoints[2], Findings: []FindingDetail{snapshot, internal, nesting}},
		"s5": {Endpoint: endpoints[3], Findings: []FindingDetail{snapshot, internal, nesting, nextAction}},
	}

	return &Payload{
		Run:             RunContext{SpecPath: "spec.json", GeneratedAt: now},
		Summary:         Summary{TotalFindings: 20, EndpointsAnalyzed: len(endpoints), EndpointsWithIssue: len(endpoints)},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows:       WorkflowSection{},
		GraphSeed:       GraphSeed{},
	}
}

func inlineResponseShapeSignalInlineMoreRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-inline-more-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeSignalInlineMoreHarness(),
		1,
	)
	return doc
}

func responseShapeSignalInlineMoreHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-inline-more-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', step: 'watchdog', hasTable: !!document.querySelector('.family-table'), hasShapeButton: !!document.querySelector('button.quick-action[data-id="shape"]') }]);
  }, 4000);

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

  function assertFamilySignals(family, expectedChips, expectToggle, failures) {
    var row = document.querySelector('tr.family-row[data-family="' + family + '"][data-family-row="true"]');
    if (!row) {
      failures.push({ kind: 'missing-family-row', family: family });
      return;
    }
    var cell = row.querySelector('td.family-col-top-signal');
    if (!cell) {
      failures.push({ kind: 'missing-signal-cell', family: family });
      return;
    }

    var chips = cell.querySelectorAll('.family-signal-chips .family-signal-chip');
    var toggle = cell.querySelector('button.family-signal-expand[data-expand-signals]');

    if ((chips ? chips.length : 0) !== expectedChips) {
      failures.push({ kind: 'chip-count-mismatch', family: family, expected: expectedChips, got: (chips ? chips.length : 0) });
    }
    if (!!toggle !== !!expectToggle) {
      failures.push({ kind: 'toggle-presence-mismatch', family: family, expectedToggle: !!expectToggle, gotToggle: !!toggle });
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    click('button.quick-action[data-id="shape"]');
    (function waitForShapeTable() {
      if (!document.querySelector('.family-table')) {
        return window.setTimeout(waitForShapeTable, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        try {
          // Hidden signal counts: 0, 1, 2 should inline-render (no toggle). 3+ should toggle.
          assertFamilySignals('/shape-inline-2', 2, false, failures);
          assertFamilySignals('/shape-inline-3', 3, false, failures);
          assertFamilySignals('/shape-inline-4', 4, false, failures);
          assertFamilySignals('/shape-inline-5', 2, true, failures);
        } catch (e) {
          failures.push({ kind: 'exception', message: (e && e.message) ? e.message : String(e) });
        }
        finish(failures);
      }, 140);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeSignalInlineMore struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeSignalInlineMoreReport(dom string) responseShapeSignalInlineMore {
	readyRe := regexp.MustCompile(`id="shape-inline-more-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-inline-more-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-inline-more-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeSignalInlineMore{ready: ready, failures: failures, detail: detail}
}
