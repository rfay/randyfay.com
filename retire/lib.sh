# Shared settings for the retirement pipeline. Sourced by the other scripts.
#
# Three sibling DDEV projects (see test/playwright/kit/docs/retirement-approach.md):
#   ORIGINAL  randyfay          the reference; this pipeline never modifies it
#   PREP      randyfay-prep     rebuilt from a pristine restore, then prepared by scripts
#   STATIC    randyfay-static   the crawled HTML of PREP, served as a static site
set -euo pipefail

ORIGINAL="${ORIGINAL:-$HOME/workspace/randyfay}"
PREP="${PREP:-$HOME/workspace/randyfay-prep}"
STATIC="${STATIC:-$HOME/workspace/randyfay-static}"
STATIC_PUBLIC="${STATIC_PUBLIC:-$STATIC/public}"          # the static project's docroot (a subdirectory)
PRISTINE_DIR="${PRISTINE_DIR:-$HOME/workspace/randyfay-artifacts}"   # outside every repository
PRISTINE_DB="$PRISTINE_DIR/randyfay-pristine.sql.gz"
PREP_URL="${PREP_URL:-https://randyfay-prep.ddev.site}"
STATIC_URL="${STATIC_URL:-https://randyfay-static.ddev.site}"
CA="$(mkcert -CAROOT 2>/dev/null)/rootCA.pem"

# Safety: every destructive step below acts on $PREP only. Refuse to run if it is pointed at the
# original, or at anything that is not a DDEV project named like a prep copy.
guard_prep() {
  [ "$(cd "$PREP" && pwd)" != "$(cd "$ORIGINAL" && pwd)" ] || { echo "Refusing: PREP is the original project." >&2; exit 2; }
  case "$(basename "$PREP")" in *prep*) ;; *) echo "Refusing: '$PREP' does not look like a prep copy (name must contain 'prep')." >&2; exit 2;; esac
}

# Fail fast and clearly if a project is not running. Without this, a stopped static project makes every
# test fail to connect and the run takes minutes to report hundreds of failures.
require_running() {
  local d status
  for d in "$@"; do
    status=$(cd "$d" && ddev describe -j 2>/dev/null | jq -r '.raw.status // "unknown"')
    [ "$status" = running ] || {
      echo "Project $(basename "$d") is '$status', not running. Start it with: (cd $d && ddev start)" >&2
      exit 1
    }
  done
}
