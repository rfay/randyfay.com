# Agent instructions: disposable migration copy

This is a **disposable local copy** of randyfay.com (Backdrop CMS 1.35), used as the practice
site for the migration-testing method in
[rfay/site-migration-kit](https://github.com/rfay/site-migration-kit). Nothing here is
production.

## What this environment is

- Local development site: https://randyfay.ddev.site. In this Coder workspace the same site is also served
  through `*.coder.ddev.com` URLs (see `ddev launch`). Both point at this local copy.
- The database and files were pulled from production earlier and now live locally. Restoring:
  `ddev import-db` restores the database, `ddev import-files` restores files, and a human-run
  `ddev pull randyfay.com` plus a `git reset` is a full and complete restore. You may run the
  import commands against a local snapshot; do not run `ddev pull` yourself (see below).
- Destructive changes to the **local database and local files** are fine: bulk `UPDATE`s,
  deleting content, rewriting bodies. Work directly. Prefer scripts over one-off edits.

## What is NOT disposable

- **Production** (`ddevprod.thefays.us`, randyfay.com): never connect to it or write to it.
  `.ddev/providers/randyfay.com.yaml` supports `ddev pull` over SSH (its push section was
  removed on purpose, so there is no way to write to production through DDEV). **Never run
  `ddev pull`, `ddev push`, `rsync`, `scp` or `ssh` to a remote host.** The human runs
  `ddev auth ssh` and `ddev pull` themselves; do not attempt interactive SSH authentication.
- The frozen baseline and its git tag, once created, are read-only.

## Ground rules

- We are reproducing the site, not fixing it. Record inconsistencies in `HANDOFF.md`
  and `DISCOVERIES.md` instead of repairing them. Read the "Strategies"
  section of `HANDOFF.md` first.
- The test strategy is in `PLAYWRIGHT_TESTING.md`. Current-revision node queries must join
  `node_revision` on `node.vid = node_revision.vid`.
- Unpublished nodes must keep returning 403 to anonymous users; do not "fix" that.

## Sibling projects and the retirement pipeline

Two more DDEV projects sit next to this one on this workspace. They are for the static-HTML rehearsal and are
disposable; this project is still the reference and the pipeline never modifies it.

- `~/workspace/randyfay-prep`: a copy that is rebuilt from a pristine database dump on every run, then changed
  by scripts. **Destructive changes are allowed here and only here.** Every destructive script refuses to run
  unless the project's name contains `prep`.
- `~/workspace/randyfay-static`: the crawled HTML (`public/`) served as a static site. Not a git repository.
- `retire/run.sh` runs the whole pipeline (restore, prepare, crawl, rewrite, verify). All three projects must be
  running; the script checks first. `retire/00-snapshot-pristine.sh` takes the pristine dump (kept outside every
  repository). See `HANDOFF.md`, "Retirement rehearsal".
- Tests are run **inside** this project's container; a host-side `TEST_BASE_URL=...` is not forwarded. Name the
  kind of target with `MIGRATION_TARGET` (for example `static`).
- **A workspace restart stops every DDEV project.** Start each one you need (`ddev start` in its directory); the
  pipeline checks and says which is down.
- **`randyfay-d11` is coming** (a Drupal 11 target, set up by the user). It is not built yet. When it is, run the
  same suite against it with `MIGRATION_TARGET=drupal11`, so the static-only decisions do not apply to it.
- **Never make a request to `randyfay.com`.** The test suite resolves references to that domain against the
  target being tested. Do not add anything that fetches it.
