#!/usr/bin/env bash
# Take the pristine database dump from the ORIGINAL (read-only on the original). Run once, and again
# only if the original is deliberately re-seeded. Every later run restores PREP from this file.
source "$(dirname "$0")/lib.sh"
mkdir -p "$PRISTINE_DIR"
(cd "$ORIGINAL" && ddev export-db --file="$PRISTINE_DB" --gzip >/dev/null)
echo "Pristine snapshot: $PRISTINE_DB ($(du -h "$PRISTINE_DB" | cut -f1))"
