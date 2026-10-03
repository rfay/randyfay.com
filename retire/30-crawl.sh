#!/usr/bin/env bash
# Crawl the PREPARED copy into the static project's docroot (a subdirectory). The page list comes
# from the frozen baseline, so pages the baseline knows about are the ones exported. The mirror
# script refuses to empty a directory that looks like a project root.
source "$(dirname "$0")/lib.sh"
guard_prep
cd "$ORIGINAL/test/playwright"
mkdir -p "$STATIC_PUBLIC"
# Keep the full output so a failure shows its real error, not just the last line.
out=$(NODE_EXTRA_CA_CERTS="$CA" node kit/scripts/mirror-static.mjs --root . --from "$PREP_URL" --out "$STATIC_PUBLIC" --ca "$CA" 2>&1) || { echo "$out" | tail -25 >&2; exit 1; }
echo "$out" | tail -1
echo "crawl: $(find "$STATIC_PUBLIC" -name '*.html' | wc -l) HTML page(s) and $(find "$STATIC_PUBLIC" -type f ! -name '*.html' | wc -l) other file(s) in $STATIC_PUBLIC"
