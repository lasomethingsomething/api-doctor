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

func TestEndpointLabelTogglesInlineDiagnosticsWithoutScrollJump(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "endpoint-label-toggle-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineEndpointLabelToggleRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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
		"--window-size=1280,1200",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := endpointLabelToggleReport(string(out))
	if !report.ready {
		t.Fatalf("endpoint label toggle regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected endpoint label to toggle inline diagnostics without scroll jump, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineEndpointLabelToggleRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="endpoint-label-toggle-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+endpointLabelToggleHarness(),
		1,
	)
	return doc
}

func endpointLabelToggleHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('endpoint-label-toggle-regression'); }
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

  function scrollStable(before, after) {
    return Math.abs((after || 0) - (before || 0)) <= 1;
  }

  function inlineRowPresent(endpointId) {
    return !!document.querySelector('tr.inline-inspector-row-nested[data-endpoint-id="' + endpointId + '"]');
  }

  function run() {
    var failures = [];
    click('button.quick-action[data-id="spec-rule"]');

    (function waitForTable() {
      var row = document.querySelector('tr.family-row[data-family-row="true"]');
      var btn = row ? row.querySelector('td.family-col-endpoints button.endpoints-expand') : null;
      if (!row || !btn) return window.setTimeout(waitForTable, 50);

      btn.click();
      window.setTimeout(function () {
        var endpointBtn = document.querySelector('button.nested-endpoint-path-toggle[data-focus-endpoint="long-1"]');
        if (!endpointBtn) {
          failures.push({ kind: 'missing-endpoint-label', selector: 'long-1' });
          return finish(failures);
        }

        window.scrollTo(0, 520);
        var before = window.scrollY || 0;
        endpointBtn.click();

        window.setTimeout(function () {
          var after = window.scrollY || 0;
          if (!scrollStable(before, after)) failures.push({ kind: 'scroll-jump-open', before: before, after: after });
          if (!inlineRowPresent('long-1')) failures.push({ kind: 'inline-row-not-open', endpoint: 'long-1' });

          var beforeClose = window.scrollY || 0;
          endpointBtn.click();
          window.setTimeout(function () {
            var afterClose = window.scrollY || 0;
            if (!scrollStable(beforeClose, afterClose)) failures.push({ kind: 'scroll-jump-close', before: beforeClose, after: afterClose });
            if (inlineRowPresent('long-1')) failures.push({ kind: 'inline-row-not-closed', endpoint: 'long-1' });
            finish(failures);
          }, 220);
        }, 260);
      }, 260);
    })();
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    run();
  }

  waitForUI();
})();
</script>
`
}

type endpointLabelToggleRegression struct {
	ready    bool
	failures int
	detail   string
}

func endpointLabelToggleReport(dom string) endpointLabelToggleRegression {
	readyRe := regexp.MustCompile(`id="endpoint-label-toggle-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="endpoint-label-toggle-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="endpoint-label-toggle-regression"[^>]*>([^<]*)</div>`)

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

	return endpointLabelToggleRegression{ready: ready, failures: failures, detail: detail}
}

