#!/usr/bin/env bash
# Make the crawled copy self-contained: rewrite every reference to the prepared site (comment
# permalinks, login links, feeds...) by the rules in rewrite-rules.json. Prints a count per decision.
# --strict makes any reference it cannot resolve a failure.
source "$(dirname "$0")/lib.sh"
guard_prep
cd "$ORIGINAL/test/playwright"
NODE_EXTRA_CA_CERTS="$CA" node kit/scripts/rewrite-static.mjs --dir "$STATIC_PUBLIC" --root . --rules "$ORIGINAL/retire/rewrite-rules.json" --strict
