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

func TestEndpointsExpandControlIsKeyboardFocusableButton(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "endpoints-expand-semantics-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineEndpointsExpandSemanticsRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := endpointsExpandSemanticsReport(string(out))
	if !report.ready {
		t.Fatalf("endpoints-expand semantics regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected endpoints expand control to be a focusable button, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineEndpointsExpandSemanticsRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="endpoints-expand-semantics-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+endpointsExpandSemanticsHarness(),
		1,
	)
	return doc
}

func endpointsExpandSemanticsHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('endpoints-expand-semantics-regression'); }
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

  function assertButtonFocusable(step, failures) {
    var btn = document.querySelector('tr.family-row[data-family-row="true"] button.endpoints-expand[data-expand-endpoints]');
    if (!btn) {
      failures.push({ kind: 'missing-button', step: step });
      return;
    }

    if (btn.tagName !== 'BUTTON') {
      failures.push({ kind: 'not-button-tag', step: step, tag: btn.tagName });
    }
    if ((btn.getAttribute('type') || '').toLowerCase() !== 'button') {
      failures.push({ kind: 'missing-type-button', step: step, type: btn.getAttribute('type') });
    }
    if (!btn.getAttribute('aria-label')) {
      failures.push({ kind: 'missing-aria-label', step: step });
    }
    if (btn.tabIndex < 0) {
      failures.push({ kind: 'not-tabbable', step: step, tabIndex: btn.tabIndex });
    }

    btn.focus();
    if (document.activeElement !== btn) {
      failures.push({ kind: 'not-focusable', step: step, active: (document.activeElement && document.activeElement.tagName) });
    }
  }

  function waitForUI() {
    if (!document.querySelector('.family-table')) {
      return window.setTimeout(waitForUI, 50);
    }
    window.setTimeout(function () {
      var failures = [];
      assertButtonFocusable('family-table', failures);
      finish(failures);
    }, 200);
  }

  waitForUI();
})();
</script>
`
}

type endpointsExpandSemantics struct {
	ready    bool
	failures int
	detail   string
}

func endpointsExpandSemanticsReport(dom string) endpointsExpandSemantics {
	readyRe := regexp.MustCompile(`id="endpoints-expand-semantics-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="endpoints-expand-semantics-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="endpoints-expand-semantics-regression"[^>]*>([^<]*)</div>`)

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

	return endpointsExpandSemantics{ready: ready, failures: failures, detail: detail}
}

