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
  editor. Left as is; the full inventory is in the generated section at the end of this file.
- Production keeps two independently drifted copies of its public files (`docroot/files` and
  `docroot/sites/default/files`); the development copy uses a symlink instead (see HANDOFF.md).
- Backdrop's Color module regenerates per-theme file-path hashes on cache clear, so `config/active`
  can show as modified with no edit. Not a content change.
- Pages that are not content nodes but are part of navigation (home, `/blog`, `/blogs/rfay`, 26
  `topics/*` listings) are absent from the node table. The baseline discovers them from links and
  menus (29 routes); any migration plan built only from the node table would lose them.
- The only way to see comments on this site as an anonymous visitor is as inline reply links inside
  the node article (e.g. node 89 renders 50 "Log in to post comments" links).
- **Paginated pages are content the first baseline missed.** `blog?page=1`, `topics/planet-drupal?page=1` to
  `6`, `node?page=1`, `blogs/rfay?page=1`, and the second page of two long comment threads
  (`content/rebase-workflow-git`, `content/avoiding-git-disasters-gory-story`, which have 51 and 55 comments on a
  50-per-page thread) all exist on the original. The first baseline skipped every link with a query string,
  so none of them were captured, and a static copy built from it silently lacked 20 pages and some comments.
  They are now discovered (20 pages). On the static copy a page number that does not exist (`blog?page=9`)
  falls back to page 0, where the original shows an empty list.
- **A crawl is not self-contained.** See `test/playwright/kit/docs/static-self-containment.md`: 4,084
  references on 242 of 244 pages still pointed at the crawled site, and no content check noticed.
- **The original has links of its own that are dead or restricted** beyond the ones listed above: for example
  `admin/content` (403) is linked from two listing pages. The baseline records every such reference per page,
  and the static copy keeps them as they were.

## Generated: references to the site's own domain

<!-- Generated. Regenerate with: node test/playwright/kit/scripts/own-domain-report.mjs --root test/playwright -->

### Hardcoded references to the site's own domain (randyfay.com)

Generated from `baseline/semantic/index.json` (frozen 2026-10-03T15:28:11.415Z) by `kit/scripts/own-domain-report.mjs`.
41 distinct link target(s) and 7 distinct image source(s), on 91 page(s).
Preserved exactly as written: they are explicit choices of the original, so the static self-containment
tier allows them. After a retirement each one depends on that domain still being served.

**Images (7): the archive shows a broken picture here if the domain goes away.**

- `http://randyfay.com/files/translatable_regions_screenshot.png` (7 pages: blog?page=1, blogs/rfay?page=1, content/translatable-regions-module-user-contributed-content-many-languages, ...)
- `http://randyfay.com/sites/default/files/rfay_dell_gazelle_Selection_002.png` (2 pages: content/rebase-workflow-git, node/91)
- `http://randyfay.com/sites/default/files/rfay_dell_gazelle_Selection_003.png` (2 pages: content/rebase-workflow-git, node/91)
- `http://randyfay.com/sites/default/files/rfay_dell_gazelle_Selection_004.png` (2 pages: content/rebase-workflow-git, node/91)
- `http://randyfay.com/sites/default/files/rfay_dell_gazelle_Selection_005.png` (2 pages: content/rebase-workflow-git, node/91)
- `http://randyfay.com/sites/default/files/rfay_dell_gazelle_Selection_006.png` (2 pages: content/rebase-workflow-git, node/91)
- `http://randyfay.com/sites/default/files/rfay_dell_gazelle_Selection_007.png` (2 pages: content/rebase-workflow-git, node/91)

**Links (41):**

- `http://randyfay.com/ahah` (8 pages: blog?page=1, blogs/rfay?page=1, content/form-api-changes-drupal-7-part-2-ajaxahah-changes, ...)
- `http://randyfay.com/ajax` (9 pages: ahah/drupal7, content/form-api-changes-drupal-7-part-2-ajaxahah-changes, node/30, ...)
- `http://randyfay.com/comment/1093#comment-1093` (9 pages: blog?page=1, blogs/rfay?page=1, content/rebase-workflow-git, ...)
- `http://randyfay.com/comment/1990#comment-1990` (6 pages: blog?page=1, blogs/rfay?page=1, content/resetting-drupal-passwords-drupal-7-drush-or-without, ...)
- `http://randyfay.com/comment/672#comment-672` (3 pages: content/content-translation-field-translation-drupal-7-first-steps, node/88, topics/planet-drupal?page=3)
- `http://randyfay.com/comment/864#comment-864` (2 pages: content/content-translation-field-translation-drupal-7-first-steps, node/88)
- `http://randyfay.com/content/cygwin-quickstart-drupal-users` (2 pages: content/remote-drupalphp-debugging-xdebug-and-phpstorm, node/130)
- `http://randyfay.com/content/drupals-governance` (8 pages: (home), blog, blogs/rfay, ...)
- `http://randyfay.com/content/future-drupal-governance-resources-and-next-steps` (8 pages: (home), blog, blogs/rfay, ...)
- `http://randyfay.com/content/my-new-development-computer-amazon-ec2-instance` (4 pages: content/tunneling-http-debug-or-develop-external-webservice-call, node/129, topics/debugging, ...)
- `http://randyfay.com/files/e_notice.patch` (2 pages: content/if-you-edit-php-code-please-work-enotice-turned, node/76)
- `http://randyfay.com/files/php` (2 pages: content/php-52-ubuntu-1004-lucid-lynx-seems-work-1204-too, node/63)
- `http://randyfay.com/files/php_0` (2 pages: content/php-52-ubuntu-1004-lucid-lynx-seems-work-1204-too, node/63)
- `http://randyfay.com/node/103` (9 pages: blog?page=1, blogs/rfay?page=1, content/rebase-workflow-git, ...)
- `http://randyfay.com/node/107` (10 pages: (home), blog, blogs/rfay, ...)
- `http://randyfay.com/node/109` (11 pages: (home), blog, blogs/rfay, ...)
- `http://randyfay.com/node/118` (10 pages: (home), blog, blogs/rfay, ...)
- `http://randyfay.com/node/119` (7 pages: blog?page=1, blogs/rfay?page=1, content/reference-cache-repositories-speed-clones-git-clone-reference, ...)
- `http://randyfay.com/node/120` (11 pages: (home), blog, blogs/rfay, ...)
- `http://randyfay.com/node/130` (4 pages: content/remote-drupalphp-debugging-xdebug-and-phpstorm, node/130, topics/debugging, ...)
- `http://randyfay.com/node/58` (7 pages: blog?page=1, blogs/rfay?page=1, content/drupalcon-drupal-7-ajax-and-javascript, ...)
- `http://randyfay.com/node/66` (8 pages: blog?page=1, blogs/rfay?page=1, content/form-api-changes-drupal-7-part-2-ajaxahah-changes, ...)
- `http://randyfay.com/node/74` (5 pages: content/form-api-changes-drupal-7-part-1-formstate-changes, node/66, topics/drupal?page=4, ...)
- `http://randyfay.com/node/76#comment-192` (2 pages: content/if-you-edit-php-code-please-work-enotice-turned, node/76)
- `http://randyfay.com/node/89` (9 pages: content/rebase-workflow-git, content/rebase-workflow-git?page=1, content/simpler-rebasing-avoiding-unintentional-merge-commits, ...)
- `http://randyfay.com/node/91` (2 pages: content/simpler-rebasing-avoiding-unintentional-merge-commits, node/103)
- `http://randyfay.com/node/93` (8 pages: (home), blog, blogs/rfay, ...)
- `http://randyfay.com/node/99` (6 pages: blog?page=1, blogs/rfay?page=1, content/want-help-drupal-testing-infrastructure-provide-testbot, ...)
- `http://randyfay.com/node/99for` (2 pages: content/want-help-drupal-testing-infrastructure-provide-testbot, node/75)
- `http://randyfay.com/sites/default/files/catchall` (3 pages: content/quick-guide-wildcard-apache-vhosts, node/71, topics/planet-drupal?page=2)
- `http://randyfay.com/sites/default/files/e_notice.patch` (4 pages: content/if-you-edit-php-code-please-work-enotice-turned, node/76, topics/best-practices, ...)
- `http://randyfay.com/sites/default/files/RandyFayResume2012.pdf` (4 pages: node/19, portfolio, topics/drupal, ...)
- `http://randyfay.com/taxonomy/term/26` (9 pages: (home), blog, blogs/rfay, ...)
- `http://randyfay.com/taxonomy/term/27` (3 pages: content/drupal-community-conflict-resolution-and-twitter, node/112, topics/planet-drupal?page=5)
- `http://randyfay.com/topics/burnout` (7 pages: (home), blog, blogs/rfay, ...)
- `http://randyfay.com/topics/governance` (12 pages: (home), blog, blogs/rfay, ...)
- `http://www.randyfay.com/comment/1028#comment-1028` (7 pages: blog?page=1, blogs/rfay?page=1, content/reference-cache-repositories-speed-clones-git-clone-reference, ...)
- `http://www.randyfay.com/content/simpler-rebasing-avoiding-unintentional-merge-commits` (2 pages: content/rebase-workflow-git, node/91)
- `http://www.randyfay.com/files/rfay.pub` (5 pages: blog?page=2, blogs/rfay?page=2, content/where-find-me, ...)
- `https://randyfay.com/node/130` (4 pages: content/remote-command-line-debugging-phpstorm-phpdrupal-including-drush, node/131, topics/debugging, ...)
- `https://randyfay.com/sites/default/files/Randy%20Fay%20Resume%202016.pdf` (2 pages: node/133, resume)
