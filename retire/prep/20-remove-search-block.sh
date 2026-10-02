#!/usr/bin/env bash
# The search block is a form that cannot work on a static site. Remove it from every layout.
source "$(dirname "$0")/../lib.sh"
guard_prep
cd "$PREP"
removed=0; files=0
for f in config/active/layout.layout.*.json; do
  n=$(jq '[.content | to_entries[] | select(.value.data.module? == "search")] | length' "$f")
  [ "$n" -gt 0 ] || continue
  jq --indent 4 '
    ([.content | to_entries[] | select(.value.data.module? == "search") | .key]) as $ids
    | .content |= with_entries(select(.key as $k | ($ids | index($k)) | not))
    | .positions |= map_values(map(select(. as $u | ($ids | index($u)) | not)))
  ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  removed=$((removed + n)); files=$((files + 1))
done
ddev bee cc all >/dev/null
echo "remove-search-block: removed $removed block(s) from $files layout(s)"
