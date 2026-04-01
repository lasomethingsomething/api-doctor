package main

import (
	"os"

	"github.com/lasomethingsomething/api-doctor/cmd/api-doctor/command"
)

func main() {
	if err := command.Execute(); err != nil {
		os.Exit(1)
	}
}
