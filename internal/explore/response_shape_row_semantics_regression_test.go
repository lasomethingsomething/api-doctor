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

func TestResponseShapeRowUsesDistinctChipAndBadgeSemantics(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-row-semantics-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeRowSemanticsRegressionDocument(t, responseShapeSignalInlineMorePayload())), 0o600); err != nil {
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

	report := responseShapeRowSemanticsReport(string(out))
	if !report.ready {
		t.Fatalf("row-semantics regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape to use distinct badge/chip semantics per element type, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeRowSemanticsRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-row-semantics-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeRowSemanticsHarness(),
		1,
	)
	return doc
}

func responseShapeRowSemanticsHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-row-semantics-regression'); }
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

  function parseRGB(color) {
    var m = String(color || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var parts = m[1].split(',').map(function (p) { return parseFloat(p.trim()); });
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: (parts.length > 3 ? parts[3] : 1) };
  }

  function colorDistance(c1, c2) {
    var dr = (c1.r - c2.r);
    var dg = (c1.g - c2.g);
    var db = (c1.b - c2.b);
    return Math.sqrt(dr*dr + dg*dg + db*db);
  }

  function assertDistinct(step, failures, colors) {
    var minDist = 26;
    var pairs = [
      ['endpointsBg', 'signalBg'],
      ['severityBg', 'signalBg'],
      ['pressureMixBg', 'signalBg'],
      ['endpointsBg', 'severityBg']
    ];
    pairs.forEach(function (pair) {
      var a = colors[pair[0]];
      var b = colors[pair[1]];
      if (!a || !b) return;
      var dist = colorDistance(a, b);
      if (dist < minDist) {
        failures.push({ kind: 'colors-too-similar', step: step, a: pair[0], b: pair[1], distance: dist.toFixed(1), colors: colors });
      }
    });
  }

  function assertBlueish(label, rgb, failures, step) {
    if (!rgb) return;
    // For action/info surfaces, avoid warm-tint dominance (B should be at least as strong as R).
    if (rgb.b + 2 < rgb.r) {
      failures.push({ kind: 'expected-blueish', step: step, label: label, rgb: rgb });
    }
  }

  function collectAndAssert(step, failures) {
    var firstRow = document.querySelector('tr.family-row[data-family-row="true"]');
    if (!firstRow) {
      failures.push({ kind: 'missing-first-row', step: step });
      return;
    }
    var endpointsBtn = firstRow.querySelector('td.family-col-endpoints .endpoints-expand');
    var signalChip = firstRow.querySelector('td.family-col-top-signal .family-signal-chip');
    var mixHigh = firstRow.querySelector('td.family-col-priority .pressure-mix-chip.mix-high');

    if (!endpointsBtn || !signalChip || !mixHigh) {
      failures.push({
        kind: 'missing-row-elements',
        step: step,
        hasEndpoints: !!endpointsBtn,
        hasSignal: !!signalChip,
        hasMixHigh: !!mixHigh
      });
      return;
    }

    var colors = {};
    colors.endpointsBg = parseRGB(window.getComputedStyle(endpointsBtn).backgroundColor);
    colors.signalBg = parseRGB(window.getComputedStyle(signalChip).backgroundColor);
    colors.pressureMixBg = parseRGB(window.getComputedStyle(mixHigh).backgroundColor);

    assertBlueish('endpointsBg', colors.endpointsBg, failures, step);
    assertDistinct(step, failures, colors);
  }

  function collectSeverityAndAssert(step, failures) {
    var badge = document.querySelector('.nested-endpoint-table .severity-badge.severity-info');
    if (!badge) {
      failures.push({ kind: 'missing-severity-badge', step: step });
      return;
    }
    var firstRow = document.querySelector('tr.family-row[data-family-row="true"]');
    var signalChip = firstRow ? firstRow.querySelector('td.family-col-top-signal .family-signal-chip') : null;
    var endpointsBtn = firstRow ? firstRow.querySelector('td.family-col-endpoints .endpoints-expand') : null;
    var mixHigh = firstRow ? firstRow.querySelector('td.family-col-priority .pressure-mix-chip.mix-high') : null;

    var colors = {};
    colors.severityBg = parseRGB(window.getComputedStyle(badge).backgroundColor);
    colors.signalBg = signalChip ? parseRGB(window.getComputedStyle(signalChip).backgroundColor) : null;
    colors.endpointsBg = endpointsBtn ? parseRGB(window.getComputedStyle(endpointsBtn).backgroundColor) : null;
    colors.pressureMixBg = mixHigh ? parseRGB(window.getComputedStyle(mixHigh).backgroundColor) : null;

    assertBlueish('severityBg', colors.severityBg, failures, step);
    assertDistinct(step, failures, colors);
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    click('button.quick-action[data-id="shape"]');

    (function waitForTable() {
      if (!document.querySelector('.family-table') || !document.querySelector('tr.family-row[data-family-row="true"]')) {
        return window.setTimeout(waitForTable, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        collectAndAssert('shape-row-colors', failures);

        // Expand first family to expose nested endpoint severity badge.
        var btn = document.querySelector('tr.family-row[data-family-row="true"] td.family-col-endpoints .endpoints-expand');
        if (btn) btn.click();
        (function waitForNested() {
          if (!document.querySelector('.nested-endpoint-table .severity-badge.severity-info')) {
            return window.setTimeout(waitForNested, 50);
          }
          window.setTimeout(function () {
            collectSeverityAndAssert('shape-severity-colors', failures);
            finish(failures);
          }, 120);
        })();
      }, 200);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeRowSemantics struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeRowSemanticsReport(dom string) responseShapeRowSemantics {
	readyRe := regexp.MustCompile(`id="shape-row-semantics-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-row-semantics-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-row-semantics-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeRowSemantics{ready: ready, failures: failures, detail: detail}
}

