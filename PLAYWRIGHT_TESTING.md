# Pre-migration test strategy

How this site's behavior is frozen before a migration, and checked afterward, so that **any**
migration target (a static export, a Drupal 11 rebuild, another CMS) is judged by the same suite
against the same baseline.

For the whole strategy in plain language, read the kit's `test/playwright/kit/docs/how-it-works.md` first.
The static-HTML path builds on Karen Stevenson's Lullabot series on retiring Drupal sites; see
`test/playwright/kit/docs/retirement-approach.md` for the credit, links and how we apply it.

This project (a Backdrop CMS site) is the rehearsal for a harder real target, hobobiker.com, a
much older Drupal 6 site that goes through two migration paths in a public three-part series
("Hobobiker Rides Again"). The reusable parts live in
[site-migration-kit](https://github.com/rfay/site-migration-kit), vendored here as plain files in
`test/playwright/kit/`. This document covers the strategy as applied to this site. The kit's own
documentation, `test/playwright/kit/docs/semantic-tier.md`, covers the semantic tier in depth.

## The idea

1. **Freeze what the site does today** into plain files committed to git (the *baseline*), not into
   Playwright's snapshot store. Playwright's `--update-snapshots` can silently overwrite a reference
   that a second migration also needs. Files on disk, tagged in git, cannot.
2. **Judge a target by whether anything is missing,** never by whether the markup matches. A new
   platform has different markup, class names and URLs on every page, so markup comparison fails
   everything and tells you nothing. The question is: does a visitor still see everything they saw?
3. **Reproduce the site, don't repair it.** A link that is broken today must still be broken the
   same way; an unpublished page must still return 403. Fixing things belongs after the migration, and
   what we found is logged in `DISCOVERIES.md`.

## What Playwright is for

Most of what this suite checks needs no browser. It fetches pages as text and parses them with
cheerio (a Node library that gives jQuery-style queries over an HTML string), and checks 244 pages in
about three seconds. Playwright earns its place for the things that need a real browser, and as the
runner for everything else.

| Need | Why Playwright | Status |
|---|---|---|
| **Text a visitor can actually read.** Text can be in the HTML yet hidden by CSS, or exist only after a script runs (hobobiker's `document.write()` email obfuscation on node 3804, lightbox galleries, anything the old theme builds in the browser). A text fetch sees only the HTML, so it cannot tell. | A real browser runs the scripts and `innerText` returns only what is visible | **Built** (`visible:` tier, opt-in: 244 pages in about 11 seconds). Not yet tried against script-built content, since this site has little. |
| **Embeds that render as nothing.** Dead Flash `<object>` tags and dead script widgets look fine in the HTML and show a blank box in a browser. | Render the page; check for a visible, non-empty element | Not built yet |
| **Failures a visitor can see.** Failed image or script requests, JavaScript exceptions, console errors. | `page.on('console')` and `page.on('requestfailed')` | Not built yet |
| **How it looks.** A curated sample of pages as screenshots, for a human to review. A migration may intentionally change the theme, so this is informational, never a pass/fail gate. | `toHaveScreenshot`, full-page, masked dynamic regions | Built (6 pages) |
| **One runner for everything.** HTTP checks and browser checks share tags, subsets (`--grep`), parallelism, sharding, and an HTML report with traces and screenshots for diagnosing a failure. | The same tool for both kinds of check, pointed at any URL through `TEST_BASE_URL` | Built |
| **HTTP-level checks without a browser.** Status codes, access control, file hashes. | The `request` fixture: no browser launch, so these run in seconds | Built |

Where Playwright is the wrong tool: diffing whole-page screenshots *across* different themes (noise,
not signal), and comparing text or links (a plain fetch is faster and easier to reason about).

## The tiers

All tiers run against `TEST_BASE_URL` (default: the development site, `https://randyfay.ddev.site`).
Select a tier by test-title prefix with `--grep`.

| Tier | Prefix | What it checks | Needs a browser |
|---|---|---|---|
| Semantic | `semantic:` | Every baseline page's title, content lines, images (and that they load), links, menus; every discovered route (home, listings, taxonomy); every baseline asset resolves. Nothing may be missing; extras are fine. Optional strictness in `migration.config.mjs` (`strict: { order, alt }`, both on here) also requires the same line order and unchanged image alt text. Deliberate differences live in `expected-differences.json`. | No |
| Visible text | `visible:` | In a real browser, every baseline content line is visible to a visitor (catches text hidden by CSS and content scripts add or remove). Opt-in; compared case-insensitively because the browser applies CSS capitalization | Yes |
| Access | `access:` | Unpublished nodes still answer 403 to anonymous visitors (40 checks: 20 nodes, each alias) | No |
| Assets | `asset:` | Every captured file still has the same size and SHA-256 (26 files) | No |
| Visual | `visual:` | Screenshots of 6 curated pages (one per content type, plus nodes with layout overrides). Informational: a mismatch is attached to the report, not failed | Yes |

Two scripts sit beside the tiers and are not tests (run from `test/playwright`, with the development
site up):

- `node kit/scripts/additions-report.mjs --target <url>` lists what a target shows that the baseline
  never recorded, such as a leaked template code or stray text. It subtracts the source page's own
  surroundings, so dev against itself reports nothing. Informational only.
- `node kit/scripts/check-source-drift.mjs` re-reads the original site and reports whether anything
  (including additions and reordering) changed since the baseline was frozen. Exit code 1 means it did.
  Run it before a migration starts, so a failure can be blamed on the target and not on a moved source.

The semantic tier is the one that judges a migration. See the kit's `docs/semantic-tier.md` for how
it works and what building it taught us.

## The baseline

### What the database is for

The database is the only reliable list of what exists: this site has no sitemap. The content listing
comes from `ddev mysql` (`scripts/generate-manifest.mjs` writes `data/manifest.json`). Two traps:

- **Use the current revision only.** `node.vid` points at a node's current revision. Join
  `ON node.vid = node_revision.vid`; never match `node_revision` by `nid` alone, which fans out across
  every historical revision. Sanity check, expecting exactly 126 (106 published, 20 unpublished):
  `ddev mysql -e "SELECT COUNT(*) FROM node n JOIN node_revision nr ON n.vid=nr.vid"`
- **Do not filter out unpublished nodes.** Keep all 126, each flagged published or not. Anonymous
  requests to an unpublished node return **403**, not its content, so those nodes get an access check
  instead of a content check. That catches a private page becoming public (or the reverse).

The database does not list everything a visitor navigates. The home page, `/blog`, `/blogs/rfay` and
26 `topics/*` pages are not nodes; the semantic export finds them by following links and menus.

### Freezing it

Run once, with the development site up, from `test/playwright`:

```bash
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"   # host-side node trusting DDEV's certificate
node scripts/generate-manifest.mjs                # database -> data/manifest.json
node scripts/export-baseline.mjs                  # assets and unpublished-node status
node kit/scripts/export-semantic-baseline.mjs     # page content, routes, links, menus
```

Commit `baseline/` and **git-tag the commit** (for example `pre-migration-baseline`). Treat it as
read-only once a migration starts, and never let a migration pipeline regenerate it. The visual
screenshots (`tests/visual.spec.ts-snapshots/`) are Playwright's own snapshot store, and the one place
`--update-snapshots` could overwrite the reference. Never run it against a migration target.

## Running

```bash
ddev playwright test                                  # everything, against the development site
ddev playwright test --grep "semantic:"               # one tier
ddev playwright test --grep "semantic:.*@smoke"       # one page per content type
ddev playwright test --grep "semantic:.*@route"       # listing, taxonomy and home routes
ddev playwright test --grep "visible:"                # the in-browser visible-text tier (opt-in)
ddev playwright test --grep "semantic:.*@blog"        # one content type
ddev playwright test --grep "semantic:.*@section-override"
ddev playwright test --shard=1/4                      # split a large run across workers
```

Tests that the kit registers are attributed to the kit file, so select them by title (`--grep`), not by
spec-file path.

### Against a migration target

```bash
ddev exec -d /var/www/html/test/playwright \
  'TEST_BASE_URL=https://migration-a.example.com npx playwright test --grep "semantic:|access:|asset:|visible:"'
```

- **Set the variable inside the container.** `TEST_BASE_URL=... ddev playwright ...` on the host is not
  forwarded and silently tests the development site again.
- **Use the four tiers above, not the whole suite.** `visual:` compares screenshots against the
  original theme and is informational; run it separately when you want to look at a target.
- **For a static export on disk,** let the kit serve it for the length of one run. It starts the server,
  sets `TEST_BASE_URL`, runs your command, stops the server and returns the command's exit code:
  ```bash
  ddev exec -d /var/www/html/test/playwright \
    'node kit/scripts/serve-static.mjs --dir /tmp/site-static --run "npx playwright test --grep \"semantic:|access:|asset:\""'
  ```
  `kit/scripts/mirror-static.mjs --out /tmp/site-static` builds a `wget` mirror of the development
  site to try this on.
- **Give every target run a negative control.** Delete a paragraph, an image and a linked file from the
  target and confirm the suite names each one. A result that is identical to the self-check, or
  suspiciously fast, deserves suspicion.

## Verified on this site

- The semantic tier passes 246 of 246 against the development site, and 246 of 246 against a fresh `wget`
  static mirror of it (`kit/scripts/mirror-static.mjs` and `serve-static.mjs`).
- Deleting a paragraph, a linked PDF and an image from the mirror is each reported, by name.
- Each later addition has its own negative control on a deliberately broken mirror: a CSS-hidden
  paragraph is caught only by the visible-text tier; two swapped paragraphs and a changed alt text are
  caught only by the strict options; a leaked-macro line appears only in the additions report; and a
  tampered baseline copy is flagged page by page by the drift check, which returns exit code 1.
- The full suite is 562 tests, all passing in about 13 seconds (246 semantic, 244 visible, 40 access,
  26 asset, 6 visual). The semantic export takes about 25 seconds; the semantic suite about 3.

## Where things are

| Path | Purpose |
|---|---|
| `test/playwright/kit/` | vendored site-migration-kit; do not edit here (see `KIT_VERSION`) |
| `test/playwright/migration.config.mjs` | the site-specific part: selectors, content listing, route exclusions |
| `test/playwright/expected-differences.json` | reviewed, deliberate differences; empty means "reproduce everything" |
| `test/playwright/data/manifest.json` | database snapshot: nodes, aliases, files |
| `test/playwright/baseline/semantic/` | the frozen page records and index |
| `test/playwright/baseline/assets/`, `baseline/manifest.json` | asset bytes and hashes; unpublished-node statuses |
| `test/playwright/tests/` | `semantic.spec.ts`, `regression-access.spec.ts`, `regression-assets.spec.ts`, `visual.spec.ts` |
| `DISCOVERIES.md` | inconsistencies found; none were fixed |
