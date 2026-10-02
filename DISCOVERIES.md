# Discoveries

Inconsistencies found in this site while building the pre-migration baseline. The goal is to
reproduce the site as it is, not to fix it, so none of these were changed. Each is here so a
human can triage it later: load-bearing quirk, fix after the migration, or dead weight. Full lists
are in `test/playwright/baseline/semantic/index.json` (`brokenOrRestrictedLinks`, `missingAssets`).

## Broken or restricted on the source (the baseline expects them to stay that way)

| What | Status | Where it is linked from |
|---|---|---|
| `/contact` | 403 for anonymous visitors | 6 pages (e.g. node/23) |
| `/ahah_demo/simple_form` | 404 | node/51 |
| Malformed hrefs `node/>http://sf2010.drupal.org/...` and `content/>http://...` | 404 | node/56: a stray `>` inside the href in stored content |
| Unpublished nodes (20) | 403 for anonymous visitors | the access tier asserts this stays 403 |

## Files the database lists that the server cannot serve (7 of 33)

`/sites/default/files/`: `karmic_0.list`, `karmic_1.list`, `php_0.`, `php_1.`,
`demo_role_content_feature-6.x-1.0.tar_.gz`, `RandyFayResume1-2010_0.pdf`, `RandyFayResume2012.pdf`.
Links to some of these remain in published content (404 on the source today).

## Other

- Some old node bodies contain hardcoded absolute `http://randyfay.com/...` URLs from a pre-clean-URL
  editor. Left as is. They are treated as external links by the suite and preserved exactly.
- Production keeps two independently drifted copies of its public files (`docroot/files` and
  `docroot/sites/default/files`); the development copy uses a symlink instead (see HANDOFF.md).
- Backdrop's Color module regenerates per-theme file-path hashes on cache clear, so `config/active`
  can show as modified with no edit. Not a content change.
- Pages that are not content nodes but are part of navigation (home, `/blog`, `/blogs/rfay`, 26
  `topics/*` listings) are absent from the node table. The baseline discovers them from links and
  menus (29 routes); any migration plan built only from the node table would lose them.
- The only way to see comments on this site as an anonymous visitor is as inline reply links inside
  the node article (e.g. node 89 renders 50 "Log in to post comments" links).
