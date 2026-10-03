#!/usr/bin/env bash
# Check the static copy against the frozen baseline from the ORIGINAL, with the static-target
# decisions in expected-differences.json applied (MIGRATION_TARGET=static).
#
#   ./40-verify.sh                 test the static project's own URL (needs its docroot set to public/)
#   LOCAL_SERVE=1 ./40-verify.sh   no static project needed: copy the crawl into the original's
#                                  container and serve it there for the length of the run
source "$(dirname "$0")/lib.sh"
GREP='semantic:|visible:|access:|asset:|static:'
cd "$ORIGINAL"
if [ "${LOCAL_SERVE:-0}" = 1 ]; then
  ddev exec 'rm -rf /tmp/site-static-prep && mkdir -p /tmp/site-static-prep'
  docker cp "$STATIC_PUBLIC/." ddev-randyfay-web:/tmp/site-static-prep/
  ddev exec -d /var/www/html/test/playwright "MIGRATION_TARGET=static node kit/scripts/serve-static.mjs --dir /tmp/site-static-prep --run 'npx playwright test --grep \"$GREP\" --reporter=line'"
else
  ddev exec -d /var/www/html/test/playwright "MIGRATION_TARGET=static TEST_BASE_URL=$STATIC_URL npx playwright test --grep '$GREP' --reporter=line"
fi
