# Pre-Migration Playwright Baseline Strategy

**Status: implemented and verified on this project, not yet committed.** Everything
described below exists under `test/playwright/` and has been run end-to-end: manifest
generated (126 nodes, 33 file assets), baseline frozen (215 pages, 40 access checks, 26
assets), and the full suite passes (`287 passed`) as a self-check against its own baseline.
Subset execution (`--grep @smoke`, `--grep @section-override`, `--grep @assets`, etc.) was
verified, and a deliberately-introduced content change was confirmed to produce a clear,
correct failure (then reverted). Nothing has been committed or git-tagged yet; that's a
deliberate next step for you to decide on, not done automatically here.

### Asset tier: resolved

Initially this DDEV instance's `docroot/sites/default/files/` only contained generated
`color/css/js` — none of the real uploaded content assets referenced by `file_managed` (33
rows). See `HANDOFF.md`'s "Environment setup: file assets, `ddev pull`, and `.probo.yaml`"
section for the full story (including a first attempt at this fix that was wrong and got
corrected). Short version: the real files were already correctly pulled into `docroot/files`
by `ddev pull randyfay.com` (that *is* the right location — it matches production's own
`$DDEV_FILES_DIRS`, confirmed directly against prod; `.ddev/config.yaml` does **not** need an
`upload_dirs` override). What was actually missing was a symlink —
`docroot/sites/default/files -> ../../files` — since Backdrop's `file_public_path` config
means every URL Backdrop itself generates for public files points at `sites/default/files`
(confirmed directly against production's own admin UI). Production itself doesn't use a
symlink for this — confirmed it actually keeps two independent, physically duplicated copies
of the files in both locations, drifted apart over the site's long history. The symlink used
here is a deliberate improvement over replicating that duplication, not an attempt to match
prod's exact (messy) mechanism — same practical result, no drift risk. Of the 33 assets, 26
fetch successfully and are now in the frozen
baseline; the remaining 7 are genuinely missing even on the source server (old superseded
resume PDFs, legacy junk files) — confirmed real data decay, not a bug in the export script.

## Why this exists

This site is about to go through **more than one candidate migration**. (The Cloudflare
Worker/`wrangler` scaffolding elsewhere in this repo is an unrelated experiment — it has no
bearing on this strategy.) Before any migration proceeds, we want to know, concretely,
whether the migrated site's output and assets still match the current one — and we want
that comparison to work for **every** migration attempt, not just one before/after pair,
even if the original DDEV Backdrop instance's content or environment changes in between
attempts.

This project (randyfay.com on Backdrop CMS) is being used as the simpler rehearsal case for
this methodology before applying it to a harder, real target: hobobiker.com, a much older
and messier Drupal 6 site, which is the subject of a public 3-part working-session series
("Hobobiker Rides Again") that takes it down two migration paths — a static HTML archive and
a Drupal 11 rebuild — both checked against one shared test suite built first. The
static-export-as-durable-baseline design here is deliberately the same shape that scenario
needs.

## Why a static export, not just Playwright's built-in snapshot store

Playwright's `toMatchSnapshot`/`toHaveScreenshot` mechanism ties a baseline to one spec
file's identity, stored under `*-snapshots/` and updated via `--update-snapshots`. That's a
good fit for a single before/after cycle, but not for comparing **two independent migration
targets against the same original**: there's no way to safely run the suite against
migration A without risking someone later running `--update-snapshots` against it and
silently overwriting the reference migration B also needs.

Instead, the plan freezes the current site into a plain, explicitly-owned, committed
directory of files (`test/playwright/baseline/`) — normalized HTML text plus asset bytes and
hashes. That's just data on disk: safe to git-tag as the canonical reference point, safe to
diff against repeatedly and indefinitely, independent of how many migration attempts happen
or what the live Backdrop DB does afterward. Playwright's own screenshot diffing is still
used, but only for a small curated **visual** sample where its tooling is genuinely the
right fit (see Tier 3 below).

## Site inventory this strategy is built around

Gathered from the live DB (`ddev mysql`) and code exploration:

- **Content**: 106 published + 20 unpublished nodes. Types: blog 79/16, book 23/0, page 3/3,
  story 1/1. `url_alias` has 164 rows — several nodes have 2-3 aliases pointing at them.
  There is no `sitemap.xml` (404) and no xmlsitemap module, so **the database is the only
  source of a canonical path list** — it must be queried directly, there's nothing to crawl
  from a sitemap.
- **Assets**: `file_managed` has 33 rows — 20 PNG, 2 JPEG, 5 PDF, 5 legacy/junk
  `application/octet-stream`, 1 plain text — served as relative `/sites/default/files/...`
  URLs.
- **Layout risk**: this site has no `layout`/`block` tables; per-node rendering overrides
  live in `sections_data`/`sections_nodes` instead. Nodes with an override need explicit
  coverage since their output diverges from their content type's default template.
- **Existing scaffold**: `test/playwright/` (installed via the Lullabot/ddev-playwright DDEV
  addon) is currently just the stock starter — `playwright.config.ts` has `baseURL`
  commented out, and `tests/example.spec.ts` is the generic playwright.dev sample test.

### The one critical DB gotcha

`node.vid` points at a node's **current** revision. Any query joining to
`node_revision` must be `ON node.vid = node_revision.vid` — never just `WHERE nid = ...`
against `node_revision`, since a node can have many historical revisions and only the one
matching `node.vid` is current. Getting this wrong silently fans a manifest out across every
historical revision instead of just today's content.

Sanity check to run after any manifest-generation change:
```
ddev mysql -e "SELECT COUNT(*) FROM node n JOIN node_revision nr ON n.vid=nr.vid"
```
Expect exactly **126** (106 published + 20 unpublished). Any other number means the join
fanned out.

### Unpublished nodes need different treatment, not exclusion

The manifest query has **no `WHERE status = 1` filter** — it must capture all 126 nodes,
published and unpublished alike, each tagged with its `published` boolean. Filtering
unpublished nodes out of the manifest entirely would silently lose the ability to catch a
real migration bug: a node's published/unpublished status flipping during migration.

But unpublished nodes can't be treated like published ones for the content diff, either —
fetching one anonymously doesn't return its content, it returns an access-denied page.
Verified against the live site: `curl .../node/2` (an unpublished node) → **HTTP 403**, not
404, not 200. So:

- **Published nodes**: fetched, normalized, and diffed against frozen baseline content, as
  described below.
- **Unpublished nodes**: never fetched for content during the freeze step (there's nothing
  real to freeze — it would just be capturing a 403 page as if it were the node). Instead,
  the baseline records `expectedAnonymousStatus: 403` for each, and the regression test
  tier asserts the *status code* stays 403 on the migration target — catching either
  direction of drift: a private node becoming accidentally public, or (less likely but still
  worth catching) a published node becoming inaccessible.

## Architecture

### 1. Manifest generation — `test/playwright/scripts/generate-manifest.mjs`

A plain Node script (no new DB-client dependency — shells out to `ddev mysql`, the same tool
already used to inspect this database) that queries:

```sql
-- Current-revision node data only (the join described above)
SELECT n.nid, n.type, n.status, nr.title
FROM node n JOIN node_revision nr ON n.vid = nr.vid;

-- Aliases (many-to-one to node)
SELECT source, alias FROM url_alias WHERE source LIKE 'node/%';

-- Per-node layout overrides
SELECT DISTINCT nid FROM sections_nodes;

-- Assets
SELECT fid, filename, uri, filemime, filesize FROM file_managed;
```

and joins them into `test/playwright/data/manifest.json`:

```json
{
  "generatedAt": "2026-09-20T00:00:00Z",
  "nodes": [
    {
      "nid": 39,
      "type": "blog",
      "title": "...",
      "path": "blogs/jdoe",
      "aliases": ["blogs/jdoe", "content/old-title"],
      "published": true,
      "hasSectionOverride": false
    }
  ],
  "files": [
    { "fid": 12, "uri": "public://foo.png", "url": "/sites/default/files/foo.png",
      "mime": "image/png", "filesize": 48213 }
  ]
}
```

This is run manually, on demand — never at test-run time — so the frozen manifest stays
stable alongside the baseline it drives. Only `published: true` nodes feed the default test
subsets; unpublished nodes carry a `@draft` tag reserved for a possible future authenticated
check, out of scope for the first version.

### 2. Shared normalization — `test/playwright/lib/normalize.mjs`

One function, used by **both** the baseline-freezing script and the regression tests, so
both sides of every comparison get cleaned identically. Strips:
- CSRF/`form_build_id` tokens
- Cache-busting timestamps
- Session-dependent markup
- The Backdrop version footer

Using a single shared implementation (rather than two copies) is what keeps "expected" and
"actual" comparable — any drift between the two would show up as constant false-positive
diffs.

### 3. Freezing the baseline — `test/playwright/scripts/export-baseline.mjs`

Reads `data/manifest.json`; for every **published** node's canonical path and every alias,
and every asset, fetches it from the live Backdrop site (plain `fetch()` — Node 24 has this
built in, no new dependency), normalizes HTML via `lib/normalize.mjs`, and writes:

- `test/playwright/baseline/<url-safe-path>.html` — normalized page text, one per path.
- `test/playwright/baseline/assets/<...>` — the asset bytes themselves.
- `test/playwright/baseline/manifest.json` — a companion index of each asset's SHA-256 +
  size, so later runs hash the *target's* response without re-reading the baseline binaries
  every time. This same file also records, for every **unpublished** node, just
  `{ nid, path, expectedAnonymousStatus: 403 }` — no content fetch, since anonymous access to
  an unpublished node returns a 403 page, not the node.

**This is the one-time "freeze the base" operation.** Run it once, commit `baseline/`, and
**git-tag that commit** (e.g. `git tag pre-migration-baseline`). The tag is what makes the
reference point unambiguously recoverable no matter what either migration attempt does, or
what the live Backdrop DB looks like by the time you get around to attempt #2.

If real content changes before either migration starts (e.g. final edits), re-run this
script and re-freeze — but treat a frozen, tagged `baseline/` as immutable once either
migration is actually underway.

### 4. Tests — four tiers, all driven off the manifest

**Tier 1 — `tests/regression-content.spec.ts`** (full coverage, ~270 checks: every published
node's canonical path + every alias). `request.get(path)` via Playwright's
`APIRequestContext` — no browser, fast — against `process.env.TEST_BASE_URL` (defaults to
the live Backdrop site itself, so running with no override is a self-check: it should read
~100% match against the baseline just taken). Normalizes via the same shared function and
asserts equality against the frozen file in `baseline/`. Only loops over `published: true`
manifest entries — see Tier 4 for unpublished ones.

**Tier 4 — `tests/regression-access.spec.ts`** (full coverage, all 20 unpublished nodes).
`request.get(path)` for each, asserting the response status is still exactly the recorded
`expectedAnonymousStatus` (403). This is a distinct check from Tier 1, not a variant of it:
it's verifying access-control parity survived the migration, not content parity — a node
that flips from 403 to 200 (or vice versa) is exactly the kind of regression content-diffing
alone would never catch.

**Tier 2 — `tests/regression-assets.spec.ts`** (full coverage of whatever's in the frozen
baseline — 26 of 33 `file_managed` rows as of this writing; the other 7 are genuinely gone
even on the source server). Same
`APIRequestContext` approach — `request.get()` each asset URL, compare SHA-256 + size
against `baseline/manifest.json`. No browser needed; cheap enough to always run in full.

**Tier 3 — `tests/visual.spec.ts`** (curated sample only, ~15-20 pages: one per content
type, every node with `hasSectionOverride: true`, plus a couple of representative
blogs/books). Full `page.goto()` + `expect.soft(page).toHaveScreenshot(...)` —
**`expect.soft` is the deliberate choice here**: it records the pixel diff in the HTML
report but does not fail the run. A migration may intentionally change theme/CSS, so this
tier exists for manual visual review, not as a pass/fail gate. Chromium only — cross-browser
screenshot diffing is noise, not signal, for this purpose.

Every generated test gets a tag baked into its title during the loop (e.g.
`` `node ${nid} @${type} @smoke` ``, `@section-override` for override nodes).
Playwright's `--grep`/`--grep-invert` match on title text, so no separate tagging API is
needed.

### 5. Running subsets

```bash
# One page per content type — fast sanity check
ddev playwright test --grep @smoke

# Targeted subsets
ddev playwright test --grep @blog
ddev playwright test --grep @section-override

# A whole tier
ddev playwright test tests/regression-assets.spec.ts
ddev playwright test tests/visual.spec.ts --project=chromium

# Parallel split of the full content tier, if it's ever slow
ddev playwright test tests/regression-content.spec.ts --shard=1/4

# Point at a migration target instead of the default live site
TEST_BASE_URL=https://migration-a.example.com ddev playwright test --grep @smoke
TEST_BASE_URL=https://migration-b.example.com ddev playwright test
```

Both migration targets diff against the exact same `baseline/` files — that's what makes
this reusable across as many migration attempts as needed, not just one.

## Files this strategy introduces

| Path | Purpose |
|---|---|
| `test/playwright/playwright.config.ts` | modified: `baseURL` from `TEST_BASE_URL` env (default: live site), named projects |
| `test/playwright/scripts/generate-manifest.mjs` | DB → `data/manifest.json` |
| `test/playwright/lib/normalize.mjs` | shared HTML cleanup used by both the export script and the tests |
| `test/playwright/scripts/export-baseline.mjs` | freezes `baseline/` from the live site |
| `test/playwright/data/manifest.json` | generated, committed |
| `test/playwright/baseline/` | frozen HTML + assets + hash manifest — committed, git-tagged once frozen |
| `test/playwright/tests/regression-content.spec.ts` | Tier 1: full-content check (published nodes only) |
| `test/playwright/tests/regression-access.spec.ts` | Tier 4: access-control parity check (unpublished nodes stay 403) |
| `test/playwright/tests/regression-assets.spec.ts` | Tier 2: asset hash check |
| `test/playwright/tests/visual.spec.ts` | Tier 3: curated, informational screenshot diffs |
| `test/playwright/tests/example.spec.ts` | removed — stock starter, superseded by the above |
| `test/playwright/.gitignore` | ignore `test-results/`, `playwright-report/`; keep `baseline/` and `data/manifest.json` tracked |

## Verification plan (once implemented)

1. `ddev mysql -e "SELECT COUNT(*) FROM node n JOIN node_revision nr ON n.vid=nr.vid"` →
   expect 126, confirming the join doesn't fan out.
2. Run `generate-manifest.mjs`; spot-check `data/manifest.json` node/alias/asset counts
   against the inventory numbers above.
3. Run `export-baseline.mjs` once against the live DDEV site; confirm `baseline/` is
   populated (215 HTML pages + 26 assets, as verified); commit and tag it.
4. `ddev playwright test` (no env override) → should pass ~100% (self-check: live site vs.
   its own just-taken baseline).
5. `ddev playwright test --grep @smoke` → confirm it runs a handful of checks in seconds.
6. `ddev playwright show-report --host=0.0.0.0` → confirm a `visual.spec.ts` diff shows as
   non-blocking (soft) and a deliberately-introduced content change produces a clear text
   diff in `regression-content`.

Note on `ddev playwright show-report` reachability in this Coder sandbox: see `HANDOFF.md`
at the repo root — it needs `--host=0.0.0.0` and a specific Coder-proxied URL, unrelated to
this testing strategy itself.
