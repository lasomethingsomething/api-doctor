package command

import "testing"

func TestShouldFailAnalyze_DefaultMode(t *testing.T) {
	if shouldFailAnalyze(2057, false) {
		t.Fatalf("default analyze mode should not fail on error-severity findings")
	}
	if shouldFailAnalyze(0, false) {
		t.Fatalf("default analyze mode should not fail when there are no error-severity findings")
	}
}

func TestShouldFailAnalyze_StrictMode(t *testing.T) {
	if !shouldFailAnalyze(1, true) {
		t.Fatalf("strict analyze mode should fail when error-severity findings exist")
	}
	if shouldFailAnalyze(0, true) {
		t.Fatalf("strict analyze mode should not fail when error-severity findings do not exist")
	}
}
