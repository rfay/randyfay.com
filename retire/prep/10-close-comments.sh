#!/usr/bin/env bash
# A retired site cannot take new comments. Make every still-open comment thread read-only
# ("closed"), which keeps all existing comment text and removes the posting UI.
# Karen Stevenson's series suggests disabling comments entirely; closing them keeps the content.
source "$(dirname "$0")/../lib.sh"
guard_prep
cd "$PREP"
# `ddev bee eval` hands its arguments to bash unquoted, which mangles PHP. A script file does not.
task=".retire-task.php"
cat > "$task" <<'PHP'
<?php
// node.comment: 0 hidden, 1 closed (read-only), 2 open
echo db_update('node')->fields(array('comment' => 1))->condition('comment', 2)->execute();
PHP
n=$(ddev bee php-script "/var/www/html/$task" | tail -1)
rm -f "$task"
ddev bee cc all >/dev/null
echo "close-comments: closed comments on $n node(s)"
