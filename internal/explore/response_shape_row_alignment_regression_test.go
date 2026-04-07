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

func TestResponseShapeFamilyRowTopAlignmentIsConsistentAcrossColumns(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-row-alignment-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeRowAlignmentRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := responseShapeRowAlignmentReport(string(out))
	if !report.ready {
		t.Fatalf("row alignment regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape row contents to align to a consistent top baseline region, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeRowAlignmentRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-row-alignment-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeRowAlignmentHarness(),
		1,
	)
	return doc
}

func responseShapeRowAlignmentHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-row-alignment-regression'); }
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

  function topOf(selector, root) {
    var el = (root || document).querySelector(selector);
    if (!el) return null;
    return el.getBoundingClientRect().top;
  }

  function assertAligned(step, failures) {
    var row = document.querySelector('tr.family-row[data-family-row="true"]');
    if (!row) {
      failures.push({ kind: 'missing-row', step: step });
      return;
    }

	    var targets = [
	      { key: 'family', sel: 'td.family-col-name button.family-name-toggle strong' },
	      { key: 'mix', sel: 'td.family-col-priority .pressure-mix-inline' },
	      { key: 'endpoints', sel: 'td.family-col-endpoints button.endpoints-expand' },
	      { key: 'signals', sel: 'td.family-col-top-signal .family-signal-cell' },
	      { key: 'risk', sel: 'td.family-col-primary-risk .family-table-clamp-risk' },
	      { key: 'caller', sel: 'td.family-col-caller-burden .caller-burden-cell' }
	    ];

    var tops = [];
    for (var i = 0; i < targets.length; i++) {
      var t = topOf(targets[i].sel, row);
      if (t === null) {
        failures.push({ kind: 'missing-target', step: step, key: targets[i].key, selector: targets[i].sel });
        return;
      }
      tops.push({ key: targets[i].key, top: t });
    }

    var min = tops[0].top;
    var max = tops[0].top;
    for (var j = 1; j < tops.length; j++) {
      min = Math.min(min, tops[j].top);
      max = Math.max(max, tops[j].top);
    }

    // Tolerance for font metrics and subpixel rounding.
    var tol = 4.0;
    if ((max - min) > tol) {
      failures.push({ kind: 'misaligned', step: step, span: (max - min).toFixed(2), tops: tops });
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
        assertAligned('shape-row', failures);
        finish(failures);
      }, 220);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeRowAlignment struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeRowAlignmentReport(dom string) responseShapeRowAlignment {
	readyRe := regexp.MustCompile(`id="shape-row-alignment-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-row-alignment-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-row-alignment-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeRowAlignment{ready: ready, failures: failures, detail: detail}
}
