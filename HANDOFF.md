# Handoff: Playwright + ddev-playwright investigation

Context: working through the [Lullabot/ddev-playwright](https://github.com/Lullabot/ddev-playwright)
"Getting Started" workflow on this Backdrop CMS project, inside a Coder-hosted sandbox where
`*.ddev.site` URLs are not directly reachable from the browser — everything has to go through a
`coder.ddev.com` reverse-proxy translation layer (see the [ddev/coder-ddev](https://github.com/ddev/coder-ddev)
section below). Basic `ddev playwright test` works. `show-report` runs and is reachable *from
inside the sandbox*, but is **not currently reachable from an actual browser** in this environment
— see item 0.

## Strategies for a "real" test setup and migration

This randyfay.com work is explicitly a rehearsal — the actual target is a public 3-part
series migrating hobobiker.com (a much older, messier Drupal 6 site) two different ways
(static HTML, and Drupal 11), both checked against one shared pre-migration test suite (see
`PLAYWRIGHT_TESTING.md`). Everything below is a lesson pulled from lived experience on this
smaller site, written to generalize to that harder one.

1. **Expect many inconsistencies on an old site. Fixing them is out of scope.** The goal of
   this whole exercise is to *reproduce* the site as it actually is — including its bugs,
   drift, and historical cruft — not to repair it along the way. Concrete examples found on
   this project alone: unpublished nodes return `403` for anonymous users (the test suite
   asserts that stays `403`, not that it becomes something "more correct"); some old node
   bodies have hardcoded absolute `http://randyfay.com/...` image URLs baked in from a
   pre-clean-URLs-era editor (left as-is — that's real historical content, not a bug to
   fix); 7 of 33 `file_managed` rows point at files that no longer exist anywhere, even on
   the source server (the baseline just covers the 26 that are real, not all 33); production
   itself keeps two independent, physically duplicated copies of its public files
   (`docroot/files` and `docroot/sites/default/files`), genuinely drifted apart over the
   site's history. None of these are things a migration-testing effort should "clean up" as
   a side effect — the moment the test suite (or the migration) starts correcting things it
   finds, it stops measuring fidelity and starts measuring an idealized site nobody asked
   for. On an older, messier site like hobobiker.com, expect more of this, not less.

2. **But keep a running log of what you find.** "Out of scope to fix" is not "not worth
   noting." Every inconsistency found is real information for whoever eventually decides
   what to actually do about it — this file is exactly that log for randyfay.com. For a real
   migration effort, that log should be an explicit, first-class artifact from day one (not
   retrofitted like this one), since a human will want to triage it later: which
   inconsistencies are worth fixing post-migration, which are load-bearing quirks that must
   be preserved, and which are simply dead weight safe to drop.

3. **Distinguish three different kinds of "fixing" — only one of them is ever appropriate
   mid-investigation.** This came up directly in this session and is worth naming clearly:
   - *Fixing the local dev/test environment to accurately reflect the real source* —
     appropriate, and often necessary to even get a working baseline (e.g. the
     `docroot/sites/default/files` symlink here, or the `randyfay.com` DDEV pull provider
     already being correct once tested for real).
   - *Fixing the actual site's content or configuration* — out of scope, per point 1. Not
     even a real option here (this is read-only investigation of someone else's production
     data), but worth naming so it's never even considered as a quick fix for a test
     failure.
   - *Fixing the test tooling itself* — always fine, and often the real bug: the
     `node`/`node_revision` join caveat, the `coder-routes` service/port collision, the
     asset SHA-256 baseline approach instead of trusting a stale DB `filesize` column — all
     tooling problems, not site problems, and fixing them doesn't compromise fidelity.

4. **Verify against the authoritative source before "fixing" a discrepancy — don't guess.**
   The clearest cautionary tale from this session: dev's `docroot/sites/default/files` was
   empty of real content, so it was tempting to conclude DDEV's `upload_dirs` default must
   be wrong and "fix" it — without first checking what production actually does. Production
   turned out to already match DDEV's default (`docroot/files`) exactly; the real gap was a
   missing symlink, and the `upload_dirs` change was a mistake that had to be reverted. A
   discrepancy between what you find in a dev environment and what you expect is *evidence
   that you don't yet understand the real system* — not license to bring dev in line with
   your assumption. Go check the actual source (prod database, prod admin UI, prod
   filesystem, whatever's available) before changing anything.

5. **The test baseline's job is fidelity to current reality, not correctness.** Concretely:
   a content-diff test should fail the instant the migrated site's output changes from what
   the source produces *right now* — whether or not that current output is "right." If the
   source has a broken image link, the correct baseline expectation is "this image link is
   still broken the same way," not "this image link now works." This is what makes the same
   suite reusable across two different migration targets (per `PLAYWRIGHT_TESTING.md`): it's
   measuring "did anything change relative to the source," which is a well-defined question,
   rather than "is the output good," which isn't one a test suite can safely answer for
   someone else's 15-year-old content.

## TODOs for ddev/coder-ddev (https://github.com/ddev/coder-ddev — likely the real root cause)

0. **Extra `web_extra_exposed_ports` on the same service collide in the Coder route generator —
   the playwright report route is silently dropped.**
   `~/.ddev/commands/host/coder-routes` (sourced from `~/workspace/coder-ddev/image/scripts/...`)
   regenerates Traefik routes for the `coder.ddev.com` proxy on every `ddev start`. For any port
   that isn't a recognized primary app (web:80, web:8025/mailpit, xhgui, adminer), it falls into a
   generic branch that computes the Coder route's map key (`ROUTER_NAME`) from the docker-compose
   **service name only**: `slug="$svc_name"`. Both `playwright` (container port 9323) and `kasmvnc`
   (container port 8444) are `web_extra_exposed_ports` on the same `web` service, so they both
   reduce to `svc_name="web"` and produce the *identical* `ROUTER_NAME` (`randyfay-coder-web`).
   Whichever is processed last silently overwrites the other's route in the generated YAML map.
   - Confirmed via the merged Traefik config
     (`~/.ddev/traefik/config/randyfay_merged.yaml`): routers are processed in the order
     `randyfay-web-9323-http` (playwright) then `randyfay-web-8444-http` (kasmvnc) — matching
     `config.playwright.yml`'s list order (playwright entry before kasmvnc entry) — and kasmvnc's
     route wins.
   - Confirmed via `ddev launch` (which lists exactly the Coder-translated URLs): only 4 entries
     print — `Web`, `xhgui-randyfay`, `mailpit-randyfay`, and `web` (→ `8443--...` = kasmvnc). There
     is no entry at all for the playwright port. It isn't a display gap; the route genuinely does
     not exist in `~/.ddev/traefik/custom-global-config/coder-routes-randyfay.yaml`.
   - This means `https://randyfay.ddev.site:9324` (what `ddev describe`/`ddev playwright
     show-report` point you at) only resolves when tested *from inside this sandbox* (e.g. my own
     `curl` calls in this session) — it has no route through the actual `coder.ddev.com` proxy an
     external browser uses. My earlier "HTTP 200, confirmed real report content" claim only proves
     in-sandbox reachability, not browser reachability — that was a mistake on my part, caught by
     the user asking whether the `ddev launch` URLs actually work.
   - Fix: in the generic/dynamic branch, key the slug on service **and port**, e.g.
     `slug="${svc_name}-${port}"`, so distinct `web_extra_exposed_ports` entries never collide. The
     generated URL already disambiguates by `ext_port` — only the router map key doesn't.
   - **Applied as a live workaround** (2026-09-19): patched `slug="$svc_name"` to
     `slug="${svc_name}-${port}"` in `/home/coder/.ddev/commands/host/coder-routes` (the installed
     copy under `~/.ddev/`, not the `~/workspace/coder-ddev` source checkout — this only fixes the
     running sandbox, not the upstream repo) and re-ran `ddev coder-routes`. Confirmed both routes
     now coexist: `ddev launch` lists `web-9323` (→ `https://8323--main--remotework--rfay.coder.ddev.com`)
     and `web-8444` separately, and the generated
     `~/.ddev/traefik/custom-global-config/coder-routes-randyfay.yaml` has distinct router entries
     `randyfay-coder-web-9323` and `randyfay-coder-web-8444`. `curl`ing the new playwright URL hits
     Coder's own login redirect (expected — no browser session in `curl`), which confirms the proxy
     route now exists; still needs a real logged-in browser to confirm the report itself renders.
   - **Fixed properly**: applied the same `slug="${svc_name}-${port}"` fix directly in
     `~/workspace/coder-ddev` (source checkout, `image/scripts/.ddev/commands/host/coder-routes`),
     committed as `227d287` on branch `20260919_mult_urls`, pushed, and opened as
     [ddev/coder-ddev#201](https://github.com/ddev/coder-ddev/pull/201) (2026-09-20). Once merged,
     new sandboxes get the fix automatically instead of needing the live
     `~/.ddev/commands/host/coder-routes` copy patched by hand each time.

1. **`docker-compose.coder-describe.yaml` only ever covered the primary `web` service — other real
   services (xhgui, adminer, custom add-ons) showed the raw unreachable `*.ddev.site` URL in `ddev
   describe` even when `coder-routes` had already built a working Coder route for them.**
   Confirmed on this project: `ddev describe`'s `xhgui` row showed `https://randyfay.ddev.site:8142`
   (unreachable through Coder) even though `coder-routes` computes a working
   `https://xhgui-randyfay--remotework--rfay.coder.ddev.com` for it — `coder-setup`'s
   `docker-compose.coder-describe.yaml` generator only ever wrote an `x-ddev.describe-url-port`
   override for `web`, never for anything else, and there was no generic mechanism for "any add-on
   or custom service that ends up exposing another port via the router" (the user's framing).
   - **Fixed** in the same commit and PR (`227d287`, [ddev/coder-ddev#201](https://github.com/ddev/coder-ddev/pull/201)):
     moved this generation out of the one-time `coder-setup` and into `coder-routes` itself, which
     already discovers every real service dynamically from the merged Traefik config while building
     routes. It now writes a `describe-url-port` override for the primary `web`+Mailpit block plus
     **every other real compose service it finds** — no hardcoded service names, so it covers xhgui,
     adminer, or any future/custom add-on automatically. `coder-setup` keeps only a minimal bootstrap
     for the primary web+Mailpit URLs (the only ones computable before the project has ever started).
   - **Hard limit, can't be fixed from `coder-ddev` at all**: this only works for real docker-compose
     services. `web_extra_exposed_ports` rows (ddev-playwright's `playwright` row, a VNC add-on's
     `kasmvnc` row) are NOT separate services — verified directly against `ddev/ddev` source
     (`cmd/ddev/cmd/describe.go`'s `WebExtraExposedPorts` stanza always builds that row's URL itself
     from `https://<project-hostname>:<https_port>` and never reads `describe-url-port`; DDEV's
     `x-ddev` extension is only ever looked up per real compose service name in
     `pkg/ddevapp/ddevapp.go`). Those rows will keep showing the raw, Coder-unreachable URL until
     `ddev/ddev` itself adds support for overriding them — see the `ddev/ddev` section below.
   - **Timing note discovered while testing**: `ddev describe` only reflects `x-ddev` data from the
     compose config built during the *last* `ddev start`/`ddev restart`, not fresh on every
     invocation — confirmed empirically (a newly-discovered service's override didn't show up until
     one `ddev restart` after `coder-routes` first wrote it). So a service coder-routes discovers
     during a given start's post-start hook only shows its Coder URL starting from the *next* start.
   - **Validated live**: after copying the fixed script into `~/.ddev/commands/host/coder-routes`
     and running `ddev restart`, `ddev describe`'s `xhgui` row now additionally shows
     `https://xhgui-randyfay--remotework--rfay.coder.ddev.com` alongside the raw URL, while
     `playwright`/`kasmvnc` rows are unchanged (expected, per the hard limit above).

## TODO for ddev/ddev (upstream feature request — blocks a full fix of item 1 above)

1. **`web_extra_exposed_ports` rows in `ddev describe`/`ddev launch` have no way to override their
   URL**, unlike every real compose service (which can set `x-ddev.describe-url-port` in a compose
   fragment). Verified against source: `cmd/ddev/cmd/describe.go`'s `WebExtraExposedPorts` stanza
   unconditionally computes `https://<project-hostname>:<https_port>` and never looks at any
   extension data; `pkg/ddevapp/ddevapp.go`'s `GetXDdevExtension` is only ever called per real
   compose service name, and these ports aren't services. Any add-on using
   `web_extra_exposed_ports` (ddev-playwright's `playwright`, a VNC add-on's `kasmvnc`, etc.) is
   permanently stuck showing a URL that's wrong in any environment where the project hostname isn't
   directly reachable — Coder sandboxes here, but likely also Gitpod/Codespaces-style setups.
   Feature request: let `web_extra_exposed_ports` entries opt into (or the project override) a
   custom describe URL, e.g. via a matching `x-ddev` key keyed by the port's `name`.

## TODOs for Lullabot/ddev-playwright (upstream issues/PRs to file)

1. **`web/playwright` command assumes `ddev exec` lands in `/var/www/html`.**
   `.ddev/commands/web/playwright` does `cd "${PLAYWRIGHT_TEST_DIR:-test/playwright}" || exit 1` —
   a bare relative path. `ddev exec`'s cwd is the service's `working_dir`, which DDEV derives from
   `docroot` for some project types (e.g. Backdrop uses `docroot`) and can also be explicitly
   overridden via `working_dir.web` in `config.yaml`. On this project that cwd is
   `/var/www/html/docroot`, not `/var/www/html`, so the relative `cd` resolves to the wrong place.
   - Fix: anchor explicitly — `cd "/var/www/html/${PLAYWRIGHT_TEST_DIR:-test/playwright}"`. The
     container mount point `/var/www/html` is constant regardless of `docroot`/`working_dir`.
   - Note the inconsistency: `install-playwright` (host command) already tells users to run
     `ddev exec -d "/var/www/html/$PLAYWRIGHT_TEST_DIR" ...` — i.e. it already assumes
     `PLAYWRIGHT_TEST_DIR` is relative to `/var/www/html`. Only `web/playwright` got this wrong.

2. **`PLAYWRIGHT_TEST_DIR` has two disconnected sources of truth: `.ddev/.env` vs `.ddev/.env.web`.**
   - The pre-start hook in `config.playwright.yml` (host-side, bakes the value into
     `Dockerfile.playwright` for the browser-cache layer) sources it only from `.ddev/.env`.
   - The `web_environment` default (`PLAYWRIGHT_TEST_DIR=${PLAYWRIGHT_TEST_DIR:-test/playwright}`)
     is docker-compose variable substitution, which also only reads `.ddev/.env` on the host — not
     `.ddev/.env.web`.
   - `.ddev/.env.web` *does* successfully inject a runtime env var directly into the web container
     (bypassing compose substitution). Setting an absolute path there appeared to fix the `cd` in
     item 1, but it never reaches the pre-start hook, so the Dockerfile-baked install path and the
     runtime path can silently diverge. It only "worked" here because the fallback default
     (`test/playwright`) happened to match the real location.
   - Fix: pick one variable and one place. Simplest: document/enforce that `PLAYWRIGHT_TEST_DIR`
     must be set in `.ddev/.env` as a path relative to `/var/www/html` (not `.env.web`, not
     absolute), since it's consumed by both the build-time hook and the compose substitution.
     Combined with fix #1, `.env.web` wouldn't need to be involved at all.

3. **Silent failure mode when the test dir isn't found.**
   `cd ... || exit 1` in `web/playwright` gives zero diagnostic output. This is exactly what
   produced the "can't find the report" symptom — the real failure was several steps upstream with
   no clue given. Add `echo "..." >&2` before exiting with the path it tried and why.

4. **`ddev playwright show-report` is unreachable out of the box — defaults to `localhost` bind.**
   Verified via `npx playwright show-report --help`: `--host <host>` defaults to `"localhost"`.
   Docker's port publishing (and DDEV's router on top of it) forwards to the container's network
   interface, not its loopback, so a server bound to `127.0.0.1` inside the container cannot be
   reached through the exposed port no matter how it's mapped. Reproduced both ways, testing from
   *inside* this sandbox (see the caveat in TODO item 0 above — this does NOT by itself prove
   reachability from an actual external browser in a Coder-proxied environment, only that the
   loopback bind is broken independent of that):
   - `ddev playwright show-report` (no flags) → logs `Serving HTML report at http://localhost:9323`
     → `curl https://<project>.ddev.site:9324/` → `HTTP 502` (unreachable).
   - `ddev playwright show-report --host=0.0.0.0` → logs `...http://0.0.0.0:9323` →
     `curl https://<project>.ddev.site:9324/` → `HTTP 200` with real report content.
   This is a real, independent bug regardless of the Coder-routing issue in item 0 — even on a
   plain local DDEV install (no Coder sandbox), the default `show-report` invocation would be
   unreachable from the host browser. Fix: have the `playwright` wrapper command default
   `show-report` to `--host=0.0.0.0` (or otherwise force a non-loopback bind) when running inside
   DDEV, and print the real DDEV-routed URL (`https://<project>.ddev.site:9324` per
   `web_extra_exposed_ports` in `config.playwright.yml`) instead of relaying Playwright's own
   `localhost`/`0.0.0.0` log line.

5. **Orphaned `show-report` server causes a cryptic `EADDRINUSE` crash on retry.**
   If the client-side `ddev exec`/`ddev playwright show-report` invocation is interrupted (e.g. a
   host-side timeout, terminal killed) without the SIGINT/SIGTERM reaching the node process inside
   the container, the report server is left bound to 9323. The next `show-report` invocation then
   crashes with a raw Node stack trace (`EADDRINUSE: address already in use 0.0.0.0:9323`) instead
   of a friendly message. Consider checking/reporting port-in-use before starting, or ensuring
   proper signal forwarding so Ctrl-C actually stops the previous server.

6. **Getting-started docs don't mention any of the above.**
   Once 1–2 are fixed upstream, the README's "Getting Started" section should explicitly state
   that `PLAYWRIGHT_TEST_DIR` (if overridden) goes in `.ddev/.env`, and should not need to mention
   `.env.web` at all. Until fixed, it's worth a doc callout warning about non-`/var/www/html`
   working dirs (Backdrop, custom `working_dir`, etc.).

## TODOs for this repo (randyfay / Backdrop project)

1. **Add `.ddev/.env` with `PLAYWRIGHT_TEST_DIR=test/playwright`** (relative path) so the
   pre-start hook and compose substitution have an explicit, correct value instead of relying on
   the default coincidentally matching reality.
2. **Re-evaluate `.ddev/.env.web`** — once upstream fix #1 lands (or as a local workaround),
   `.env.web`'s `PLAYWRIGHT_TEST_DIR=/var/www/html/test/playwright` may no longer be needed. Keep
   it for now (it's what makes `ddev playwright test`/`show-report` work today) but revisit so we
   don't have two files setting the "same" variable long-term.
3. **Decide whether to commit `test/playwright/node_modules` and `playwright-report/`.** These are
   currently untracked (`test/` shows as `??` in git status) — likely want a `.gitignore` for
   `test/playwright/node_modules`, `test/playwright/test-results`, and
   `test/playwright/playwright-report` while keeping `tests/`, `package.json`,
   `playwright.config.ts` tracked.
4. **Commit or discard the other untracked `.ddev/` additions** currently in git status
   (`.ddev/commands/host/`, `.ddev/config.playwright.yml`, `.ddev/web-build/*`,
   `.ddev/web-entrypoint.d/`, `.ddev/addon-metadata/ddev-playwright/`) — these are the
   `ddev-playwright` addon's own generated files from `ddev get Lullabot/ddev-playwright` and
   should be committed so the addon is reproducible for other contributors.
5. Investigate the unrelated `M package.json` change showing in git status — confirm it's
   intentional before committing alongside the above.

## Environment setup: file assets, `ddev pull`, and `.probo.yaml` (2026-09-20)

This section has nothing to do with Playwright/DDEV-routing — it's a separate environment-setup
finding from building the pre-migration Playwright baseline (see `PLAYWRIGHT_TESTING.md`), kept
here so a future agent doesn't have to rediscover it.

1. **`.probo.yaml` removed.** It configured Probo.CI (an ephemeral-preview-environment service)
   from years ago and is no longer relevant to this project — removed rather than left as stale
   config that could mislead a future agent into thinking it's an active integration.

2. **`ddev pull randyfay.com` is a real, working custom provider** —
   `.ddev/providers/randyfay.com.yaml`, rsync-based over SSH against
   `rfay@ddevprod.thefays.us`. It was run successfully in the past (evidence: 14MB of real
   content assets — images, PDFs — were already sitting in `.ddev/.downloads/files/`, matching
   `file_managed` DB rows that otherwise 404'd). **It cannot be re-run right now in this
   session** — the SSH key needed for it was intentionally removed. Don't waste time trying it;
   if file assets are needed and the ones already on disk (see next point) aren't sufficient,
   ask the user to restore SSH access first.

3. **Public files needed a symlink, not `upload_dirs` — first attempt at this was wrong, corrected
   below.** An earlier pass through this problem added `upload_dirs: "sites/default/files"` to
   `.ddev/config.yaml` and physically copied files into `docroot/sites/default/files/`. **That was
   a mistake, caught by the user**: `upload_dirs` must be an array per
   [the DDEV docs](https://docs.ddev.com/en/stable/users/configuration/config/#upload_dirs) (a bare
   string is wrong syntax), and more importantly, production's own `$DDEV_FILES_DIRS` is
   `docroot/files` — confirmed directly by the user running `ddev exec 'echo $DDEV_FILES_DIRS'`
   against production. So `docroot/files` isn't a wrong DDEV guess to override; it's the actual,
   intentional, "for historical reasons" convention. **The `upload_dirs` line was reverted, and
   `.ddev/config.yaml` now has no `upload_dirs` override at all** — DDEV's own default for a
   "backdrop" project type already resolves to `docroot/files`, matching production exactly.
   - What actually needed fixing: Backdrop's `file_public_path` config
     (`config/active/system.core.json`: `"sites/default/files"`, **confirmed directly against
     production's own admin UI at Configuration → Media → File system** — "Public file system
     path" literally shows `sites/default/files`) means every URL Backdrop itself generates for
     public files (CSS/JS aggregates, and any field/file reference using Backdrop's normal
     `file_create_url()`) points at `sites/default/files`, regardless of where DDEV's
     `upload_dirs` convention says the *real* files live.
   - **Confirmed ground truth (not a guess)**: production does **not** use a symlink here — the
     user checked directly and confirmed production has **two independent, physically duplicated
     copies** of the files, one under `docroot/files` and one under `docroot/sites/default/files`,
     genuinely drifted apart over the site's history rather than kept in sync by any mechanism.
     This is exactly the kind of "historical mess" an old (D6-era-and-earlier-origin) site
     accumulates — per the user, there are more instances of this kind of thing in this codebase,
     not just this one.
   - **Fix chosen here does NOT replicate that duplication on purpose**: `rm -rf
     docroot/sites/default/files && ln -s ../../files docroot/sites/default/files`. One real files
     directory (`docroot/files`, matching prod and DDEV's default `upload_dirs`), reachable both
     ways via a symlink. This gets the same practical outcome as prod's two-copy setup (both paths
     resolve, so anything hardcoded to a bare `/files/...` reference still works) without carrying
     prod's drift risk into this environment — a deliberate improvement, not an attempt to exactly
     mirror production's messy structure. Verified: `/files/bav1.png` and
     `/sites/default/files/bav1.png` both resolve to the identical file (200), and CSS aggregation
     still works. `docroot/sites/default/` had nothing else in it, so this was a safe, lossless
     replacement — no `.ddev/config.yaml` changes needed at all.
   - **Separately noticed while investigating, not related to any of the above**: some old node
     body content (e.g. nid 91, "Rebase Workflow") has `<img>` tags with **hardcoded absolute
     `http://randyfay.com/...` URLs** baked directly into the stored HTML, from whatever old
     WYSIWYG editor inserted them years ago — not generated dynamically via `file_public_path` at
     all. These bypass this entire files/symlink discussion; they'll always try to load from the
     real production domain regardless of local environment setup. This is real historical content,
     not a bug to fix, and the Playwright content-diff baseline (`PLAYWRIGHT_TESTING.md`) treats it
     as-is — just don't mistake a `randyfay.com` URL appearing in fetched HTML for evidence that
     something else is misconfigured.
   - This directly resolves the "Known gap" noted in `PLAYWRIGHT_TESTING.md` (asset regression
     tier had zero real assets to check) — re-run `node test/playwright/scripts/export-baseline.mjs`
     after this fix to pick up the real 33-asset inventory. Verified: full Playwright suite passes
     (287 tests) with 26 of 33 real assets covered (7 are genuinely gone even on the source server —
     old superseded resume PDFs, legacy junk files).

4. **Mutagen was on globally and shouldn't have been — now off.** Mutagen exists to work around
   slow bind-mount I/O on Docker Desktop (macOS/Windows); it's not needed and isn't the
   recommended default on native Linux Docker, which this Coder workspace runs. It had been
   turned on in the *global* DDEV config (`ddev config global`, not this project's own
   `config.yaml`) — almost certainly leftover from unrelated experimentation on this shared
   workspace at some point, not something this project intentionally opted into. The user has
   turned it off (`ddev config global` now shows `performance-mode=none`; confirmed
   `randyfay`'s own `ddev describe` reflects `Perf mode: none` too). Re-verified after the
   switch: the site and Playwright smoke tests still pass — no regression from moving off
   Mutagen. If you see "Perf mode: mutagen" mentioned anywhere
   earlier in this file or in old command output pasted into a conversation, it's now stale —
   don't treat it as this environment's current or intended state, and don't re-enable it.

5. **A container rebuild / Coder session restart wiped the live `coder-routes` patch again, and
   caused a transient bogus DB read — both self-explanatory once you know to expect them.**
   - After the user restarted the Coder session (containers got recreated from scratch:
     `ddev-router`, `ddev-randyfay-web`, `ddev-randyfay-db` all showed `Created` then briefly got
     stuck not-running), a `ddev mysql` query run mid-rebuild returned nonsense (142 nodes, 0
     published — impossible, don't trust output like this without a sanity re-check). A plain
     `ddev restart` afterward fixed it cleanly; re-querying gave the correct 126/106-published
     numbers again. If a query ever returns a node/status count that doesn't match the known
     inventory in this file, suspect a mid-rebuild race before suspecting real data loss — rerun
     the query once containers show `Up (healthy)` in `docker ps`.
   - Separately: the live fix at `~/.ddev/commands/host/coder-routes` (item 0's route-collision
     fix, now merged as [ddev/coder-ddev#201](https://github.com/ddev/coder-ddev/pull/201)) reverted
     back to the buggy unpatched version after this same container rebuild — confirmed by
     `ddev coder-routes` printing collided `web`/`web` slugs again instead of `web-9323`/`web-8444`.
     This is exactly the risk flagged when that live patch was first applied: it only lives in
     `~/.ddev/` (outside this project), and container/session rebuilds can reprovision it from the
     original (unpatched, pre-PR-201) image. Reapplying is a one-line fix — copy the corrected
     script from the local `coder-ddev` checkout back over the live copy and rerun `ddev
     coder-routes`:
     ```
     cp ~/workspace/coder-ddev/image/scripts/.ddev/commands/host/coder-routes ~/.ddev/commands/host/coder-routes
     cd ~/workspace/randyfay && ddev coder-routes
     ```
     Once PR #201 merges and this Coder workspace's image is rebuilt from it, this manual step
     becomes unnecessary — until then, expect to redo it after any Coder session restart.
