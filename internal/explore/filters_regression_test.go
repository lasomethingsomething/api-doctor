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

func TestCategoryAndFamilyPressureFiltersAcrossTopTabs(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "filters-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineFiltersRegressionDocument(t, filtersRegressionPayload())), 0o600); err != nil {
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
		"--window-size=1680,2400",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := filtersRegressionReport(string(out))
	if !report.ready {
		t.Fatalf("filters regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected category/family pressure filters to work across top tabs, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineFiltersRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="filters-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+filtersRegressionHarness(),
		1,
	)
	return doc
}

func filtersRegressionHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('filters-regression'); }

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

  // Guardrails against "vague anchor jumps": we should not mutate location hash,
  // and any scrollIntoView should only target the inspector header (and only when needed).
  var scrollIntoViewCalls = [];
  (function instrumentScrollIntoView() {
    if (!window.Element || !window.Element.prototype) return;
    var orig = window.Element.prototype.scrollIntoView;
    window.Element.prototype.scrollIntoView = function (opts) {
      scrollIntoViewCalls.push({
        tag: this && this.tagName ? this.tagName : '',
        id: this && this.id ? this.id : '',
        className: this && this.className ? String(this.className) : ''
      });
      // Avoid actual scrolling in regression harness (keeps bounding boxes stable).
      // If we ever need to re-enable, call: if (orig) return orig.call(this, opts);
    };
  })();

  function assertNoHash(tab, step, failures) {
    var hash = String(window.location && window.location.hash ? window.location.hash : '');
    if (hash && hash !== '#') {
      failures.push({ kind: 'unexpected-hash-navigation', tab: tab, step: step, got: hash });
    }
  }

  function assertScrollTargetsAllowed(tab, step, failures) {
    var bad = scrollIntoViewCalls.filter(function (c) {
      var cls = (c.className || '');
      // Allowed:
      // - scroll to the inspector header only
      // - scroll to the family insight panel when "Show insight" is clicked
      return !(
        cls.indexOf('inspector-workspace-head') !== -1 ||
        cls.indexOf('section-heading') !== -1 ||
        cls.indexOf('family-row-insight') !== -1
      );
    });
    if (bad.length) {
      failures.push({ kind: 'unexpected-scroll-into-view', tab: tab, step: step, got: bad.slice(0, 3) });
    }
  }

  function setSelect(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function familyNames() {
    return Array.prototype.map.call(
      document.querySelectorAll('tr.family-row[data-family-row="true"]'),
      function (tr) { return tr.getAttribute('data-family') || ''; }
    ).filter(Boolean);
  }

  function assertFamilies(expected, tab, step, failures) {
    var got = familyNames().slice().sort();
    var exp = expected.slice().sort();
    if (JSON.stringify(got) !== JSON.stringify(exp)) {
      failures.push({ kind: 'family-rows', tab: tab, step: step, expected: exp, got: got });
    }
  }

  function expandFamily(family) {
    click('button.endpoints-expand[data-expand-endpoints="' + family + '"]');
  }

  function nestedEndpointCount(family) {
    return document.querySelectorAll('tr.nested-endpoint-row[data-family="' + family + '"]').length;
  }

  function assertNestedCount(expected, family, tab, step, failures) {
    var got = nestedEndpointCount(family);
    if (got !== expected) {
      failures.push({ kind: 'nested-endpoints', tab: tab, step: step, family: family, expected: expected, got: got });
    }
  }

  function assertNestedHeaders(tab, family, step, failures) {
    var table = document.querySelector('tr.family-endpoint-table-row[data-family="' + family + '"] table.nested-endpoint-table');
    if (!table) {
      failures.push({ kind: 'nested-table-missing', tab: tab, step: step, family: family });
      return;
    }
    var got = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) {
      return (th.textContent || '').trim();
    }).filter(Boolean);
    var expected = ['Path', 'Method', 'Primary issue', 'Severity', 'Instance count', 'Actions'];
    if (JSON.stringify(got) !== JSON.stringify(expected)) {
      failures.push({ kind: 'nested-headers', tab: tab, step: step, family: family, expected: expected, got: got });
    }
  }

  function assertScopeIncludes(needle, tab, step, failures) {
    var bar = document.getElementById('lensControlHint');
    var text = bar ? (bar.textContent || '') : '';
    if (text.toLowerCase().indexOf(String(needle || '').toLowerCase()) === -1) {
      failures.push({ kind: 'filter-summary', tab: tab, step: step, expected_includes: needle, got: text });
    }
  }

  function assertScopeExcludes(needle, tab, step, failures) {
    var bar = document.getElementById('lensControlHint');
    var text = bar ? (bar.textContent || '') : '';
    if (text.toLowerCase().indexOf(String(needle || '').toLowerCase()) !== -1) {
      failures.push({ kind: 'filter-summary-unexpected', tab: tab, step: step, unexpected_includes: needle, got: text });
    }
  }

  function inspectEndpoint(endpointId) {
    click('button.endpoint-inspect-action[data-focus-endpoint="' + endpointId + '"]');
  }

  function assertInspectorEndpointIncludes(needle, tab, step, failures) {
    var code = document.querySelector('.inspector-endpoint-code');
    var text = code ? (code.textContent || '') : '';
    if (text.indexOf(needle) === -1) {
      failures.push({ kind: 'inspector-endpoint', tab: tab, step: step, expected_includes: needle, got: text });
    }
  }

  function runOneTab(tabId) {
    return new Promise(function (resolve) {
      var failures = [];
      click('button.quick-action[data-id="' + tabId + '"]');
      window.setTimeout(function () {
        assertNoHash(tabId, 'post-tab-select', failures);

        // 0) Expansion behavior should be single-open: expanding a new family collapses the previous family's expansions.
        setSelect('categoryFilter', 'all');
        setSelect('familyPriorityFilter', 'all');

        window.setTimeout(function () {
          expandFamily('/tax-provider');

          window.setTimeout(function () {
            assertNoHash(tabId, 'after-expand-tax-provider', failures);
            assertNestedCount(3, '/tax-provider', tabId, 'multi-expand-expand-tax-provider', failures);
            click('button[data-insight-toggle="/tax-provider"]');

            window.setTimeout(function () {
              assertNoHash(tabId, 'after-open-insight-tax-provider', failures);
              if (!document.querySelector('tr.family-inline-insight-row[data-family="/tax-provider"]')) {
                failures.push({ kind: 'family-insight-not-open', tab: tabId, family: '/tax-provider' });
              }

              expandFamily('/order');

              window.setTimeout(function () {
                assertNoHash(tabId, 'after-expand-order', failures);
                if (document.querySelector('tr.family-endpoint-table-row[data-family="/tax-provider"]')) {
                  failures.push({ kind: 'previous-family-endpoints-not-collapsed', tab: tabId, family: '/tax-provider' });
                }
                if (document.querySelector('tr.family-inline-insight-row[data-family="/tax-provider"]')) {
                  failures.push({ kind: 'previous-family-insight-not-collapsed', tab: tabId, family: '/tax-provider' });
                }
                assertNestedCount(1, '/order', tabId, 'multi-expand-expand-order', failures);

                // Continue with the narrower filter assertions below.
                if (tabId === 'workflow') {
                  setSelect('categoryFilter', 'all');
                } else {
                  setSelect('categoryFilter', 'spec-rule');
                }
                setSelect('familyPriorityFilter', 'high');

                window.setTimeout(function () {
                  assertNoHash(tabId, 'after-filter-spec-rule+high', failures);
                  assertFamilies(['/tax-provider'], tabId, 'spec-rule+high', failures);
                  expandFamily('/tax-provider');

                  window.setTimeout(function () {
                    assertNoHash(tabId, 'after-expand-tax-provider-2', failures);
                    assertNestedCount(3, '/tax-provider', tabId, 'expand-tax-provider', failures);
                    assertNestedHeaders(tabId, '/tax-provider', 'headers-tax-provider', failures);
                    inspectEndpoint('tax-1');

                    window.setTimeout(function () {
                      assertNoHash(tabId, 'after-inspect-tax-1', failures);
                      assertScrollTargetsAllowed(tabId, 'after-inspect-tax-1', failures);
                      assertInspectorEndpointIncludes('/tax-provider', tabId, 'inspect-tax-1', failures);
                      assertScopeExcludes('Burden', tabId, 'scope-no-burden', failures);
                      assertScopeIncludes('Category', tabId, 'scope-has-category', failures);
                      if (tabId === 'spec-rule') {
                        assertScopeIncludes('spec rule', tabId, 'scope-category-spec-rule', failures);
                      } else {
                        assertScopeIncludes('all', tabId, 'scope-category-all', failures);
                      }

                      // 2) Same lens, pressure = medium => only /order
                      setSelect('familyPriorityFilter', 'medium');

                      window.setTimeout(function () {
                        assertFamilies(['/order'], tabId, 'spec-rule+medium', failures);
                        expandFamily('/order');

                        window.setTimeout(function () {
                          assertNestedCount(1, '/order', tabId, 'expand-order', failures);
                          assertNestedHeaders(tabId, '/order', 'headers-order', failures);

                          // 3) Shape lens, pressure = low => only /customer-wishlist
                          setSelect('categoryFilter', 'all');
                          setSelect('familyPriorityFilter', 'low');

                          window.setTimeout(function () {
                            // Contract Issues and Workflow Guidance are intentionally scoped:
                            // - Contract Issues: spec-rule violations + consistency drift only.
                            // - Workflow Guidance: call chains + continuity burden only.
                            // Shape burden families should not surface in those tabs.
                            if (tabId === 'spec-rule' || tabId === 'workflow') {
                              assertFamilies([], tabId, 'shape+low', failures);
                              resolve(failures);
                              return;
                            }

                            assertFamilies(['/customer-wishlist'], tabId, 'shape+low', failures);
                            expandFamily('/customer-wishlist');

                            window.setTimeout(function () {
                              assertNestedCount(2, '/customer-wishlist', tabId, 'expand-wishlist', failures);
                              assertNestedHeaders(tabId, '/customer-wishlist', 'headers-wishlist', failures);
                              assertScopeExcludes('Burden', tabId, 'scope-no-burden-2', failures);
                              assertScopeIncludes('Family pressure', tabId, 'scope-pressure', failures);
                              assertScopeIncludes('low', tabId, 'scope-low', failures);
                              resolve(failures);
                            }, 120);
                          }, 120);
                        }, 120);
                      }, 120);
                    }, 140);
                  }, 140);
                }, 120);
              }, 160);
            }, 160);
          }, 160);
        }, 160);
      }, 120);
    });
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]') || !document.getElementById('categoryFilter')) {
      return window.setTimeout(waitForUI, 50);
    }

    var failures = [];
    runOneTab('spec-rule')
      .then(function (f) { failures = failures.concat(f); return runOneTab('workflow'); })
      .then(function (f) { failures = failures.concat(f); return runOneTab('shape'); })
      .then(function (f) { failures = failures.concat(f); finish(failures); });
  }

  waitForUI();
})();
</script>
`
}

type filtersReport struct {
	ready    bool
	failures int
	detail   string
}

func filtersRegressionReport(dom string) filtersReport {
	readyRe := regexp.MustCompile(`id="filters-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="filters-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="filters-regression"[^>]*>([^<]*)</div>`)

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

	return filtersReport{ready: ready, failures: failures, detail: detail}
}

func filtersRegressionPayload() *Payload {
	now := "2026-04-04T00:00:00Z"

	endpoints := []EndpointRow{
		{
			ID:             "tax-1",
			Method:         "GET",
			Path:           "/tax-provider",
			Family:         "/tax-provider",
			Findings:       3,
			Priority:       "high",
			SeverityCounts: map[string]int{"warning": 1, "info": 2},
			CategoryCounts: map[string]int{"spec-rule": 1, "workflow-burden": 1, "contract-shape": 1},
			BurdenFocuses:  []string{"workflow-burden", "contract-shape"},
		},
		{
			ID:             "tax-2",
			Method:         "POST",
			Path:           "/tax-provider",
			Family:         "/tax-provider",
			Findings:       3,
			Priority:       "high",
			SeverityCounts: map[string]int{"warning": 1, "info": 2},
			CategoryCounts: map[string]int{"spec-rule": 1, "workflow-burden": 1, "contract-shape": 1},
			BurdenFocuses:  []string{"workflow-burden", "contract-shape"},
		},
		{
			ID:             "tax-3",
			Method:         "PATCH",
			Path:           "/tax-provider/{id}",
			Family:         "/tax-provider",
			Findings:       3,
			Priority:       "high",
			SeverityCounts: map[string]int{"warning": 1, "info": 2},
			CategoryCounts: map[string]int{"spec-rule": 1, "workflow-burden": 1, "contract-shape": 1},
			BurdenFocuses:  []string{"workflow-burden", "contract-shape"},
		},
		{
			ID:             "order-1",
			Method:         "POST",
			Path:           "/order",
			Family:         "/order",
			Findings:       3,
			Priority:       "high", // high>0 but <3 in-family => medium pressure
			SeverityCounts: map[string]int{"warning": 1, "info": 2},
			CategoryCounts: map[string]int{"spec-rule": 1, "workflow-burden": 1, "contract-shape": 1},
			BurdenFocuses:  []string{"workflow-burden", "contract-shape"},
		},
		{
			ID:             "wish-1",
			Method:         "GET",
			Path:           "/customer-wishlist",
			Family:         "/customer-wishlist",
			Findings:       1,
			Priority:       "low",
			SeverityCounts: map[string]int{"info": 1},
			CategoryCounts: map[string]int{"contract-shape": 1},
			BurdenFocuses:  []string{"contract-shape"},
		},
		{
			ID:             "wish-2",
			Method:         "POST",
			Path:           "/customer-wishlist",
			Family:         "/customer-wishlist",
			Findings:       1,
			Priority:       "low",
			SeverityCounts: map[string]int{"info": 1},
			CategoryCounts: map[string]int{"contract-shape": 1},
			BurdenFocuses:  []string{"contract-shape"},
		},
	}

	details := map[string]EndpointDetail{
		"tax-1": {Endpoint: endpoints[0], Findings: regressionFindings()},
		"tax-2": {Endpoint: endpoints[1], Findings: regressionFindings()},
		"tax-3": {Endpoint: endpoints[2], Findings: regressionFindings()},
		"order-1": {
			Endpoint: endpoints[3],
			Findings: regressionFindings(),
		},
		"wish-1": {Endpoint: endpoints[4], Findings: []FindingDetail{shapeFinding("wish-1")}},
		"wish-2": {Endpoint: endpoints[5], Findings: []FindingDetail{shapeFinding("wish-2")}},
	}

	return &Payload{
		Run:             RunContext{SpecPath: "spec.json", GeneratedAt: now},
		Summary:         Summary{TotalFindings: 14, EndpointsAnalyzed: len(endpoints), WorkflowsInferred: 1, ChainsInferred: 1, EndpointsWithIssue: 6},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows: WorkflowSection{
			FamilyCounts: map[string]int{"/tax-provider": 3, "/order": 1, "/customer-wishlist": 2},
			Chains: []ChainEntry{
				{
					ID:          "chain-1",
					Kind:        "list-detail",
					EndpointIDs:  []string{"tax-1", "order-1"},
					Summary:     "Regression chain: tax -> order",
					Reason:      "Inferred chain for filters regression harness",
					Score:       "high",
				},
			},
		},
		GraphSeed: GraphSeed{},
	}
}

func regressionFindings() []FindingDetail {
	return []FindingDetail{
		{
			Code:           "OAS-RESPONSE-DESCRIPTION-REQUIRED",
			Severity:       "warning",
			Category:       "spec-rule",
			BurdenFocus:    "",
			Message:        `Response Object is missing the required "description" field`,
			Impact:         "Clients cannot interpret error conditions from the contract alone.",
			EvidenceType:   "spec-rule",
			SpecRuleID:     "OAS-RESPONSE-DESCRIPTION-REQUIRED",
			NormativeLevel: "REQUIRED",
			SpecSource:     "OpenAPI 3.0",
			SpecLocation:   "responses.400.description",
		},
		{
			Code:        "weak-outcome-next-action-guidance",
			Severity:    "info",
			Category:    "workflow-burden",
			BurdenFocus: "workflow-burden",
			Message:     "Outcome is not clearly exposed; caller cannot infer the next valid action from the response.",
			Impact:      "Clients stall after success and must read docs to continue the workflow safely.",
		},
		{
			Code:        "snapshot-heavy-response",
			Severity:    "info",
			Category:    "contract-shape",
			BurdenFocus: "contract-shape",
			Message:     "Response is snapshot-heavy; task outcome and next action are hard to locate.",
			Impact:      "Clients do extra parsing and still miss the main result and next step.",
		},
	}
}

func shapeFinding(id string) FindingDetail {
	return FindingDetail{
		Code:        "deeply-nested-response-structure",
		Severity:    "info",
		Category:    "contract-shape",
		BurdenFocus: "contract-shape",
		Message:     "Response structure appears deeply nested; clients must traverse layers to find the primary outcome.",
		Impact:      "Parsing and model generation are more complex than needed for the task.",
		Operation:   id,
	}
}
