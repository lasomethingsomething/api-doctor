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

func TestResponseShapeFamilyTableKeepsLastColumnReadable(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-last-col-visible-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeLastColumnVisibleRegressionDocument(t, responseShapeSignalInlineMorePayload())), 0o600); err != nil {
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

	report := responseShapeLastColVisibleReport(string(out))
	if !report.ready {
		t.Fatalf("last-column visibility regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape to keep the last column visible and readable, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeLastColumnVisibleRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-last-col-visible-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeLastColVisibleHarness(),
		1,
	)
	return doc
}

func responseShapeLastColVisibleHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-last-col-visible-regression'); }

  function finish(failures) {
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

  function assertLastColumnVisible(step, failures) {
    var surface = document.getElementById('familySurface');
    var table = document.querySelector('.family-table');
    var th = document.querySelector('.family-table thead th.family-col-next-click');
    var td = document.querySelector('tr.family-row[data-family-row="true"] td.family-col-next-click');
    var copy = td ? td.querySelector('.family-next-click-copy') : null;

    if (!surface || !table || !th || !td || !copy) {
      failures.push({
        kind: 'missing-nodes',
        step: step,
        hasSurface: !!surface,
        hasTable: !!table,
        hasTh: !!th,
        hasTd: !!td,
        hasCopy: !!copy
      });
      return;
    }

    var tol = 1.5;
    var sRect = surface.getBoundingClientRect();
    var thRect = th.getBoundingClientRect();
    var tdRect = td.getBoundingClientRect();

    if (surface.scrollLeft > 0) {
      failures.push({ kind: 'surface-scroll-left', step: step, scrollLeft: surface.scrollLeft });
    }

    if (thRect.right > sRect.right + tol || tdRect.right > sRect.right + tol) {
      failures.push({
        kind: 'last-col-outside-surface',
        step: step,
        surfaceRight: sRect.right,
        headerRight: thRect.right,
        cellRight: tdRect.right
      });
    }

    // Prevent the last column from turning into a microscopic sliver.
    var minWidth = 180;
    if (thRect.width < minWidth) {
      failures.push({ kind: 'header-too-narrow', step: step, width: thRect.width, minWidth: minWidth });
    }
    if (tdRect.width < minWidth) {
      failures.push({ kind: 'cell-too-narrow', step: step, width: tdRect.width, minWidth: minWidth });
    }

    // Ensure the copy wraps within the cell and does not horizontally clip.
    var sw = td.scrollWidth || 0;
    var cw = td.clientWidth || 0;
    if (sw > cw + tol) {
      failures.push({ kind: 'cell-horizontal-overflow', step: step, scrollWidth: sw, clientWidth: cw });
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    click('button.quick-action[data-id="shape"]');
    (function waitForShapeTable() {
      if (!document.body.classList.contains('lens-shape') || !document.querySelector('tr.family-row[data-family-row="true"]')) {
        return window.setTimeout(waitForShapeTable, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        assertLastColumnVisible('shape-last-col', failures);
        finish(failures);
      }, 220);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeLastColVisible struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeLastColVisibleReport(dom string) responseShapeLastColVisible {
	readyRe := regexp.MustCompile(`id="shape-last-col-visible-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-last-col-visible-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-last-col-visible-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeLastColVisible{ready: ready, failures: failures, detail: detail}
}

