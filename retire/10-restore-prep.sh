#!/usr/bin/env bash
# Put PREP back to the pristine state: database from the snapshot, tracked configuration from git.
# Everything after this is a script, so a bad run costs one command, not a hand repair.
source "$(dirname "$0")/lib.sh"
guard_prep
[ -f "$PRISTINE_DB" ] || { echo "No pristine snapshot yet; run 00-snapshot-pristine.sh first." >&2; exit 1; }
cd "$PREP"
git checkout -q -- config/active
ddev import-db --file="$PRISTINE_DB" >/dev/null
ddev bee cc all >/dev/null
nodes=$(ddev mysql -N -e "select count(*) from node n join node_revision nr on n.vid=nr.vid")
echo "Restored $PREP: $nodes nodes (expect 126)"
