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

func TestResponseShapeContextPanelCopyStaysConcise(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-context-panel-copy-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeContextPanelCopyRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := responseShapeContextPanelCopyReport(string(out))
	if !report.ready {
		t.Fatalf("context-panel copy regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape context panel copy to remain concise and purpose-first, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeContextPanelCopyRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-context-panel-copy-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeContextPanelCopyHarness(),
		1,
	)
	return doc
}

func responseShapeContextPanelCopyHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-context-panel-copy-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', hasPanel: !!document.querySelector('.family-context-block') }]);
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

  function assertConcise(step, failures) {
    var panel = document.querySelector('.family-context-block');
    if (!panel) {
      failures.push({ kind: 'missing-panel', step: step });
      return;
    }

    var lines = panel.querySelectorAll('p.context-summary.context-summary-shape');
    if (!lines || lines.length !== 2) {
      failures.push({ kind: 'wrong-line-count', step: step, expected: 2, got: (lines ? lines.length : 0) });
      return;
    }

    for (var i = 0; i < lines.length; i++) {
      var text = (lines[i].textContent || '').trim();
      if (text.length > 140) {
        failures.push({ kind: 'line-too-long', step: step, index: i, length: text.length, text: text });
        return;
      }
      if (/search:|category:|burden:|family pressure:/i.test(text)) {
        failures.push({ kind: 'mentions-filters', step: step, index: i, text: text });
        return;
      }
    }

    var t0 = (lines[0].textContent || '').toLowerCase();
    var t1 = (lines[1].textContent || '').toLowerCase();
    if (t0.indexOf('ranks') === -1 || t0.indexOf('shape') === -1 || t0.indexOf('signals') === -1) {
      failures.push({ kind: 'missing-purpose', step: step, line: 0, text: lines[0].textContent });
      return;
    }
    if (t1.indexOf('expand') === -1 || t1.indexOf('endpoints') === -1 || t1.indexOf('evidence') === -1) {
      failures.push({ kind: 'missing-action', step: step, line: 1, text: lines[1].textContent });
      return;
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    click('button.quick-action[data-id="shape"]');
    (function waitForPanel() {
      if (!document.querySelector('.family-context-block')) {
        return window.setTimeout(waitForPanel, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        assertConcise('shape-context-copy', failures);
        finish(failures);
      }, 220);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeContextPanelCopy struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeContextPanelCopyReport(dom string) responseShapeContextPanelCopy {
	readyRe := regexp.MustCompile(`id="shape-context-panel-copy-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-context-panel-copy-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-context-panel-copy-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeContextPanelCopy{ready: ready, failures: failures, detail: detail}
}

