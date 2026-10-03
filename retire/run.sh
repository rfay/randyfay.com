#!/usr/bin/env bash
# The whole retirement pipeline, from a pristine restore:
#   restore PREP -> prepare PREP (scripts) -> crawl PREP into STATIC -> verify STATIC against the baseline
# Run 00-snapshot-pristine.sh once first. Pass LOCAL_SERVE=1 to verify before the static project is set up.
cd "$(dirname "$0")"
./10-restore-prep.sh
./20-prepare.sh
./30-crawl.sh
./35-rewrite.sh
./40-verify.sh
