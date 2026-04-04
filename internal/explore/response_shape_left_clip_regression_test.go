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

func TestResponseShapeFamilyTableDoesNotLeftClipFamilyColumn(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-left-clip-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeLeftClipRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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
		"--window-size=1024,2200",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := responseShapeLeftClipReport(string(out))
	if !report.ready {
		t.Fatalf("left-clip regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape family table to keep FAMILY column fully visible, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeLeftClipRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-left-clip-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeLeftClipHarness(),
		1,
	)
	return doc
}

func responseShapeLeftClipHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-left-clip-regression'); }

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

  function assertFamilyColumnVisible(step, failures) {
    var surface = document.getElementById('familySurface');
    if (!surface) {
      failures.push({ kind: 'missing-surface', step: step });
      return;
    }
    var firstCell = document.querySelector('tr.family-row[data-family-row="true"] td.family-col-name');
    var strong = firstCell ? firstCell.querySelector('strong') : null;
    if (!firstCell || !strong) {
      failures.push({ kind: 'missing-first-cell', step: step });
      return;
    }

    var sRect = surface.getBoundingClientRect();
    var cRect = firstCell.getBoundingClientRect();
    var tRect = strong.getBoundingClientRect();

    // Allow a small tolerance for borders/subpixel layout.
    var tol = 0.75;
    if (surface.scrollLeft > 0) {
      failures.push({ kind: 'surface-scroll-left', step: step, scrollLeft: surface.scrollLeft });
    }
    if (cRect.left < sRect.left - tol) {
      failures.push({ kind: 'cell-left-clipped', step: step, cellLeft: cRect.left, surfaceLeft: sRect.left });
    }
    if (tRect.left < sRect.left - tol) {
      failures.push({ kind: 'text-left-clipped', step: step, textLeft: tRect.left, surfaceLeft: sRect.left });
    }
  }

  function waitForUI() {
    if (!document.querySelector('.family-table') || !document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    var surface = document.getElementById('familySurface');
    if (!surface) return window.setTimeout(waitForUI, 50);

    // First, force the family surface to a non-zero scroll position as if the user
    // previously scrolled a wider table in another tab.
    click('button.quick-action[data-id="spec-rule"]');
    window.setTimeout(function () {
      surface.scrollLeft = 260;
      // Now switch to Response Shape and verify the surface resets so the first column
      // is not left-clipped.
      click('button.quick-action[data-id="shape"]');
      window.setTimeout(function () {
        var failures = [];
        assertFamilyColumnVisible('shape-after-tab-switch', failures);
        finish(failures);
      }, 220);
    }, 220);
  }

  waitForUI();
})();
</script>
`
}

type responseShapeLeftClip struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeLeftClipReport(dom string) responseShapeLeftClip {
	readyRe := regexp.MustCompile(`id="shape-left-clip-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-left-clip-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-left-clip-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeLeftClip{ready: ready, failures: failures, detail: detail}
}

