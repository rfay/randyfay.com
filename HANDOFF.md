# Handoff: Playwright + ddev-playwright investigation

Context: working through the [Lullabot/ddev-playwright](https://github.com/Lullabot/ddev-playwright)
"Getting Started" workflow on this Backdrop CMS project, inside a Coder-hosted sandbox where
`*.ddev.site` URLs are not directly reachable from the browser — everything has to go through a
`coder.ddev.com` reverse-proxy translation layer (see the [ddev/coder-ddev](https://github.com/ddev/coder-ddev)
section below). Basic `ddev playwright test` works. `show-report` runs and is reachable *from
inside the sandbox*, but is **not currently reachable from an actual browser** in this environment
— see item 0.

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
