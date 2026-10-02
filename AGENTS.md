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
  (and `DISCOVERIES.md` once it exists) instead of repairing them. Read the "Strategies"
  section of `HANDOFF.md` first.
- The test strategy is in `PLAYWRIGHT_TESTING.md`. Current-revision node queries must join
  `node_revision` on `node.vid = node_revision.vid`.
- Unpublished nodes must keep returning 403 to anonymous users; do not "fix" that.
