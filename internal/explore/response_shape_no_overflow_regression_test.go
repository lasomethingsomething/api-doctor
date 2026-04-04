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

func TestResponseShapeFamilyTableDoesNotHorizontallyOverflowContainer(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-no-overflow-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeNoOverflowRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := responseShapeNoOverflowReport(string(out))
	if !report.ready {
		t.Fatalf("no-overflow regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape family table to fit within container (no horizontal overflow), got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeNoOverflowRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-no-overflow-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeNoOverflowHarness(),
		1,
	)
	return doc
}

func responseShapeNoOverflowHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-no-overflow-regression'); }

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

  function assertNoHorizontalOverflow(step, failures) {
    var surface = document.getElementById('familySurface');
    var table = document.querySelector('.family-table');
    if (!surface || !table) {
      failures.push({ kind: 'missing-nodes', step: step });
      return;
    }

    var tol = 1.5;
    var sw = surface.scrollWidth || 0;
    var cw = surface.clientWidth || 0;
    if (sw > cw + tol) {
      failures.push({ kind: 'surface-scrollwidth-overflow', step: step, scrollWidth: sw, clientWidth: cw });
    }

    var sRect = surface.getBoundingClientRect();
    var tRect = table.getBoundingClientRect();
    if (tRect.left < sRect.left - tol) {
      failures.push({ kind: 'table-left-outside-surface', step: step, tableLeft: tRect.left, surfaceLeft: sRect.left });
    }
    if (tRect.right > sRect.right + tol) {
      failures.push({ kind: 'table-right-outside-surface', step: step, tableRight: tRect.right, surfaceRight: sRect.right });
    }
  }

  function waitForUI() {
    if (!document.querySelector('.family-table') || !document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    click('button.quick-action[data-id="shape"]');
    window.setTimeout(function () {
      var failures = [];
      assertNoHorizontalOverflow('shape-family-table', failures);
      finish(failures);
    }, 240);
  }

  waitForUI();
})();
</script>
`
}

type responseShapeNoOverflow struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeNoOverflowReport(dom string) responseShapeNoOverflow {
	readyRe := regexp.MustCompile(`id="shape-no-overflow-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-no-overflow-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-no-overflow-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeNoOverflow{ready: ready, failures: failures, detail: detail}
}

