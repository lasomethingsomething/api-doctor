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

func TestResponseShapeContextPanelBackgroundIsNeutral(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-context-panel-bg-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeContextPanelBGRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := responseShapeContextPanelBGReport(string(out))
	if !report.ready {
		t.Fatalf("context-panel background regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape context panel to use a neutral, non-error-ish background, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeContextPanelBGRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-context-panel-bg-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeContextPanelBGHarness(),
		1,
	)
	return doc
}

func responseShapeContextPanelBGHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-context-panel-bg-regression'); }
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

  function parseRGB(color) {
    var m = String(color || '').match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!m) return null;
    return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
  }

  function assertNeutralBG(step, failures) {
    var panel = document.querySelector('.family-context-block');
    if (!panel) {
      failures.push({ kind: 'missing-panel', step: step });
      return;
    }
    var cs = window.getComputedStyle(panel);
    var bg = parseRGB(cs.backgroundColor);
    if (!bg) {
      failures.push({ kind: 'unparsable-bg', step: step, backgroundColor: cs.backgroundColor });
      return;
    }
    var spread = Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b);
    if (spread > 10) {
      failures.push({ kind: 'bg-too_tinted', step: step, backgroundColor: cs.backgroundColor, spread: spread });
    }
    // Ensure it stays a light neutral, not an error-ish saturated tint.
    if (bg.r < 240 || bg.g < 240 || bg.b < 235) {
      failures.push({ kind: 'bg-too_dark', step: step, backgroundColor: cs.backgroundColor });
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
        assertNeutralBG('shape-context-panel', failures);
        finish(failures);
      }, 220);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeContextPanelBG struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeContextPanelBGReport(dom string) responseShapeContextPanelBG {
	readyRe := regexp.MustCompile(`id="shape-context-panel-bg-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-context-panel-bg-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-context-panel-bg-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeContextPanelBG{ready: ready, failures: failures, detail: detail}
}
