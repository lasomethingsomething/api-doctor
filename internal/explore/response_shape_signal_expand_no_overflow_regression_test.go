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

func TestResponseShapeSignalExpandDoesNotCreateHorizontalOverflow(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-signal-expand-no-overflow-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeSignalExpandNoOverflowRegressionDocument(t, responseShapeSignalInlineMorePayload())), 0o600); err != nil {
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

	report := responseShapeSignalExpandNoOverflowReport(string(out))
	if !report.ready {
		t.Fatalf("signal-expand no-overflow regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected expanding hidden shape signals to not create horizontal overflow, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeSignalExpandNoOverflowRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-signal-expand-no-overflow-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeSignalExpandNoOverflowHarness(),
		1,
	)
	return doc
}

func responseShapeSignalExpandNoOverflowHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-signal-expand-no-overflow-regression'); }
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

  function snapshot(surface, table) {
    // Re-query nodes for every snapshot so UI re-renders (e.g., via render())
    // don't produce disconnected-node rects (0,0,0,0) and false positives.
    surface = document.getElementById('familySurface');
    table = document.querySelector('.family-table');
    if (!surface || !table) {
      return {
        missing: true,
        scrollWidth: 0,
        clientWidth: 0,
        tableLeft: 0,
        tableRight: 0,
        surfaceLeft: 0,
        surfaceRight: 0
      };
    }
    var sRect = surface.getBoundingClientRect();
    var tRect = table.getBoundingClientRect();
    return {
      missing: false,
      scrollWidth: surface.scrollWidth || 0,
      clientWidth: surface.clientWidth || 0,
      tableLeft: tRect.left,
      tableRight: tRect.right,
      surfaceLeft: sRect.left,
      surfaceRight: sRect.right
    };
  }

  function assertNoOverflow(step, before, after, failures) {
    var tol = 1.5;
    if (after.missing) {
      failures.push({ kind: 'missing-nodes', step: step, before: before, after: after });
      return;
    }
    if (after.scrollWidth > after.clientWidth + tol) {
      failures.push({ kind: 'surface-scrollwidth-overflow', step: step, before: before, after: after });
      return;
    }
    if (after.scrollWidth > before.scrollWidth + tol) {
      failures.push({ kind: 'scrollwidth-increased', step: step, before: before, after: after });
      return;
    }
    if (after.tableLeft < after.surfaceLeft - tol || after.tableRight > after.surfaceRight + tol) {
      failures.push({ kind: 'table-outside-surface', step: step, before: before, after: after });
      return;
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    click('button.quick-action[data-id="shape"]');
    (function waitForTable() {
      var surface = document.getElementById('familySurface');
      var table = document.querySelector('.family-table');
      if (!surface || !table) {
        return window.setTimeout(waitForTable, 50);
      }

      window.setTimeout(function () {
        var failures = [];
        var before = snapshot(surface, table);
        // Expand the known 5-signal family (from responseShapeSignalInlineMorePayload).
        click('button.family-signal-expand[data-expand-signals="/shape-inline-5"]');
        window.setTimeout(function () {
          var after = snapshot(surface, table);
          assertNoOverflow('expand-signals', before, after, failures);
          finish(failures);
        }, 220);
      }, 240);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeSignalExpandNoOverflow struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeSignalExpandNoOverflowReport(dom string) responseShapeSignalExpandNoOverflow {
	readyRe := regexp.MustCompile(`id="shape-signal-expand-no-overflow-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-signal-expand-no-overflow-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-signal-expand-no-overflow-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeSignalExpandNoOverflow{ready: ready, failures: failures, detail: detail}
}
