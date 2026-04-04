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

func TestResponseShapeSignalChipsDoNotClipDefaultLabels(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-chip-labels-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeChipLabelsRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := responseShapeChipLabelsReport(string(out))
	if !report.ready {
		t.Fatalf("chip-label regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape default signal chips to render full labels without clipping, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeChipLabelsRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-chip-labels-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeChipLabelsHarness(),
		1,
	)
	return doc
}

func responseShapeChipLabelsHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-chip-labels-regression'); }

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

  function assertChipLabelsNotClipped(step, failures) {
    var firstCell = document.querySelector('tr.family-row[data-family-row="true"] td.family-col-top-signal');
    if (!firstCell) {
      failures.push({ kind: 'missing-top-signal-cell', step: step });
      return;
    }

    var chips = firstCell.querySelectorAll('.family-signal-chips .family-signal-chip .family-signal-chip-label');
    if (!chips || !chips.length) {
      failures.push({ kind: 'missing-chips', step: step });
      return;
    }

    // Only validate the default-visible chips (first two).
    var limit = Math.min(2, chips.length);
    for (var i = 0; i < limit; i++) {
      var label = chips[i];
      var chip = label.closest('.family-signal-chip');
      if (!chip) continue;

      var tol = 1.0;
      var lh = label.scrollHeight || 0;
      var ch = label.clientHeight || 0;
      if (lh > ch + tol) {
        failures.push({ kind: 'label-vertically-clipped', step: step, index: i, scrollHeight: lh, clientHeight: ch, text: label.textContent });
      }

      var cs = window.getComputedStyle(label);
      if (cs && cs.textOverflow === 'ellipsis') {
        failures.push({ kind: 'label-uses-ellipsis', step: step, index: i, text: label.textContent });
      }

      // Ensure chip itself isn't constraining with a hidden overflow that would clip wrapped text.
      var chipStyle = window.getComputedStyle(chip);
      if (chipStyle && (chipStyle.overflowX === 'hidden' || chipStyle.overflowY === 'hidden')) {
        // Hidden overflow is allowed only if the label still isn't clipped; treat as a warning failure
        // to avoid regressions back to mid-word truncation.
        failures.push({ kind: 'chip-overflow-hidden', step: step, index: i, overflowX: chipStyle.overflowX, overflowY: chipStyle.overflowY });
      }
    }
  }

  function waitForUI() {
    if (!document.querySelector('.family-table') || !document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    click('button.quick-action[data-id="shape"]');
    window.setTimeout(function () {
      var failures = [];
      assertChipLabelsNotClipped('shape-default-chips', failures);
      finish(failures);
    }, 260);
  }

  waitForUI();
})();
</script>
`
}

type responseShapeChipLabels struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeChipLabelsReport(dom string) responseShapeChipLabels {
	readyRe := regexp.MustCompile(`id="shape-chip-labels-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-chip-labels-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-chip-labels-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeChipLabels{ready: ready, failures: failures, detail: detail}
}

