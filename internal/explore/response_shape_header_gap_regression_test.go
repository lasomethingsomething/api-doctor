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

func TestResponseShapeTableHasNoOversizedHeaderToFirstRowGap(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-header-gap-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeHeaderGapRegressionDocument(t, responseShapeSignalInlineMorePayload())), 0o600); err != nil {
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

	report := responseShapeHeaderGapReport(string(out))
	if !report.ready {
		t.Fatalf("header-gap regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape table to render first row directly under header, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeHeaderGapRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-header-gap-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeHeaderGapHarness(),
		1,
	)
	return doc
}

func responseShapeHeaderGapHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-header-gap-regression'); }

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

  function assertGapIsNormal(step, failures) {
    var table = document.querySelector('.family-table');
    var thead = table ? table.querySelector('thead') : null;
    var firstRow = table ? table.querySelector('tbody tr.family-row[data-family-row="true"]') : null;
    if (!table || !thead || !firstRow) {
      failures.push({ kind: 'missing-nodes', step: step, hasTable: !!table, hasThead: !!thead, hasFirstRow: !!firstRow });
      return;
    }

    var ths = table.querySelectorAll('thead th');
    var headRect = thead.getBoundingClientRect();
    if (ths && ths.length) {
      // Prefer the visible header cell geometry (sticky <th> can diverge from <thead> rect).
      var maxBottom = -1;
      var minTop = 1e9;
      for (var i = 0; i < ths.length; i++) {
        var r = ths[i].getBoundingClientRect();
        if (r.bottom > maxBottom) maxBottom = r.bottom;
        if (r.top < minTop) minTop = r.top;
      }
      headRect = { top: minTop, bottom: maxBottom, height: Math.max(0, maxBottom - minTop) };
    }
    var rowRect = firstRow.getBoundingClientRect();
    var gap = rowRect.top - headRect.bottom;

    // The first row should start immediately under the header; allow a small tolerance
    // for borders and subpixel rounding.
    var maxGap = 20;
    if (gap > maxGap) {
      var tbody = table.querySelector('tbody');
      var firstChild = tbody && tbody.children && tbody.children.length ? tbody.children[0] : null;
      var childRect = firstChild ? firstChild.getBoundingClientRect() : null;
      failures.push({
        kind: 'oversized-gap',
        step: step,
        gap: gap,
        headerBottom: headRect.bottom,
        firstRowTop: rowRect.top,
        headerHeight: headRect.height,
        firstChildTag: firstChild ? firstChild.tagName : null,
        firstChildClass: firstChild ? firstChild.className : null,
        firstChildHeight: childRect ? childRect.height : null
      });
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    click('button.quick-action[data-id="shape"]');

    (function waitForTable() {
      if (!document.querySelector('.family-table tbody tr.family-row[data-family-row="true"]')) {
        return window.setTimeout(waitForTable, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        assertGapIsNormal('shape-initial', failures);
        finish(failures);
      }, 220);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeHeaderGap struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeHeaderGapReport(dom string) responseShapeHeaderGap {
	readyRe := regexp.MustCompile(`id="shape-header-gap-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-header-gap-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-header-gap-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeHeaderGap{ready: ready, failures: failures, detail: detail}
}
