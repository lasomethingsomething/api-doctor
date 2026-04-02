package command

import "testing"

func TestValidateExploreDiffInputs(t *testing.T) {
	tests := []struct {
		name    string
		base    string
		head    string
		wantErr bool
	}{
		{name: "none", base: "", head: "", wantErr: false},
		{name: "both", base: "old.json", head: "new.json", wantErr: false},
		{name: "missing head", base: "old.json", head: "", wantErr: true},
		{name: "missing base", base: "", head: "new.json", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateExploreDiffInputs(tt.base, tt.head)
			if tt.wantErr && err == nil {
				t.Fatalf("expected error")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
		})
	}
}

func TestRootIncludesExploreCommand(t *testing.T) {
	found := false
	for _, c := range rootCmd.Commands() {
		if c.Name() == "explore" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("explore command not registered in root")
	}
}
