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

func TestResponseShapeSignalChipsMeetContrastThreshold(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-chip-contrast-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeChipContrastRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := responseShapeChipContrastReport(string(out))
	if !report.ready {
		t.Fatalf("chip-contrast regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape signal chips to meet contrast/legibility thresholds, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeChipContrastRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-chip-contrast-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeChipContrastHarness(),
		1,
	)
	return doc
}

func responseShapeChipContrastHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-chip-contrast-regression'); }
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

  function click(selector) {
    var el = document.querySelector(selector);
    if (el) el.click();
  }

  function parseRGB(color) {
    var m = String(color || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var parts = m[1].split(',').map(function (p) { return parseFloat(p.trim()); });
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: (parts.length > 3 ? parts[3] : 1) };
  }

  function srgbToLinear(v) {
    var x = v / 255;
    return x <= 0.04045 ? (x / 12.92) : Math.pow((x + 0.055) / 1.055, 2.4);
  }

  function relLum(rgb) {
    var r = srgbToLinear(rgb.r);
    var g = srgbToLinear(rgb.g);
    var b = srgbToLinear(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(c1, c2) {
    var L1 = relLum(c1);
    var L2 = relLum(c2);
    var hi = Math.max(L1, L2);
    var lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function colorDistance(c1, c2) {
    var dr = (c1.r - c2.r);
    var dg = (c1.g - c2.g);
    var db = (c1.b - c2.b);
    return Math.sqrt(dr*dr + dg*dg + db*db);
  }

  function assertChipContrast(step, failures) {
    var firstCell = document.querySelector('tr.family-row[data-family-row="true"] td.family-col-top-signal');
    if (!firstCell) {
      failures.push({ kind: 'missing-cell', step: step });
      return;
    }

    var chips = firstCell.querySelectorAll('.family-signal-chips .family-signal-chip');
    if (!chips || !chips.length) {
      failures.push({ kind: 'missing-chips', step: step });
      return;
    }

    var sample = Math.min(3, chips.length);
    for (var i = 0; i < sample; i++) {
      var chip = chips[i];
      var cs = window.getComputedStyle(chip);
      var fg = parseRGB(cs.color);
      var bg = parseRGB(cs.backgroundColor);
      var border = parseRGB(cs.borderTopColor);
      var opacity = parseFloat(cs.opacity || '1');
      var weight = parseInt(cs.fontWeight || '400', 10);

      if (!fg || !bg || !border) {
        failures.push({ kind: 'missing-colors', step: step, index: i });
        continue;
      }

      // Require strong readability for chip labels at small sizes.
      var ratio = contrastRatio(fg, bg);
      if (ratio < 4.5) {
        failures.push({ kind: 'low-contrast', step: step, index: i, ratio: ratio.toFixed(2), color: cs.color, background: cs.backgroundColor });
      }

      // Ensure border is visible as a chip boundary (not same-as-background).
      var dist = colorDistance(border, bg);
      if (dist < 18) {
        failures.push({ kind: 'border-too-subtle', step: step, index: i, distance: dist.toFixed(1), border: cs.borderTopColor, background: cs.backgroundColor });
      }

      if (opacity < 0.95) {
        failures.push({ kind: 'chip-too-faded', step: step, index: i, opacity: opacity });
      }

      if (weight < 650) {
        failures.push({ kind: 'font-weight-too-light', step: step, index: i, fontWeight: cs.fontWeight });
      }
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    click('button.quick-action[data-id="shape"]');
    (function waitForShapeTable() {
      if (!document.querySelector('.family-table')) {
        return window.setTimeout(waitForShapeTable, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        assertChipContrast('shape-chips', failures);
        finish(failures);
      }, 180);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeChipContrast struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeChipContrastReport(dom string) responseShapeChipContrast {
	readyRe := regexp.MustCompile(`id="shape-chip-contrast-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-chip-contrast-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-chip-contrast-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeChipContrast{ready: ready, failures: failures, detail: detail}
}

