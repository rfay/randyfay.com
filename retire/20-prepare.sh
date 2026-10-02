#!/usr/bin/env bash
# Run every preparation script, in order. Each prints a count of what it changed.
source "$(dirname "$0")/lib.sh"
guard_prep
for s in "$(dirname "$0")"/prep/[0-9]*.sh; do bash "$s"; done
