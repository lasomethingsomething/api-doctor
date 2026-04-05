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

func TestResponseShapeRiskSummaryClampsToTwoLines(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-risk-lineclamp-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeRiskLineclampRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := responseShapeRiskLineclampReport(string(out))
	if !report.ready {
		t.Fatalf("risk lineclamp regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape risk summaries to be 2 lines max and not duplicate effect phrasing, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeRiskLineclampRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-risk-lineclamp-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeRiskLineclampHarness(),
		1,
	)
	return doc
}

func responseShapeRiskLineclampHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-risk-lineclamp-regression'); }
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

  function lineCount(el) {
    if (!el) return 0;
    var cs = window.getComputedStyle(el);
    var lh = parseFloat(cs.lineHeight || '0');
    if (!lh || lh <= 0) return 0;
    return Math.round((el.getBoundingClientRect().height / lh) * 10) / 10;
  }

	  function assertRiskClamped(step, failures) {
	    var cells = document.querySelectorAll('tr.family-row[data-family-row="true"] td.family-col-primary-risk .family-table-clamp-risk');
	    if (!cells || !cells.length) {
	      failures.push({ kind: 'missing-risk-cells', step: step, count: (cells ? cells.length : 0) });
	      return;
	    }
	    for (var i = 0; i < cells.length; i++) {
	      var el = cells[i];
	      var text = (el.textContent || '').trim();
	      // Risk column should be concise and risk-focused; avoid copying the "developer experience"
	      // phrasing that belongs in Client effect.
	      if (text.indexOf('Developers') !== -1 || text.indexOf('developers') !== -1) {
	        failures.push({ kind: 'risk-mentions-developer-effect', step: step, index: i, text: text });
	        return;
	      }
	      var lc = lineCount(el);
	      if (lc > 2.2) {
	        failures.push({ kind: 'too-many-lines', step: step, index: i, lines: lc, text: text });
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
        assertRiskClamped('shape-risk', failures);
        finish(failures);
      }, 220);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeRiskLineclamp struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeRiskLineclampReport(dom string) responseShapeRiskLineclamp {
	readyRe := regexp.MustCompile(`id="shape-risk-lineclamp-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-risk-lineclamp-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-risk-lineclamp-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeRiskLineclamp{ready: ready, failures: failures, detail: detail}
}
