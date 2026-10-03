// Per-site configuration for site-migration-kit (the kit lives in ./kit, a git submodule).
// This is the only randyfay.com-specific file in the semantic tier.

import { readFileSync } from 'node:fs';
import path from 'node:path';

export default {
  siteName: 'randyfay.com',

  source: {
    baseUrl: process.env.BASELINE_BASE_URL ?? 'https://randyfay.ddev.site',
  },

  // Backdrop "Basis" theme markup on the original site.
  extract: {
    title: 'h1.page-title',
    content: ['main article.node'],
    // "Log in to post comments" and similar per-visitor links live in the node footer.
    ignore: ['footer.link-wrapper'],
    menus: { breadcrumb: 'nav.breadcrumb' },
    // Listing/taxonomy/home pages have no single article; capture the whole main region.
    routeContent: ['main'],
  },

  // Non-node routes (home, listings, taxonomy pages) are discovered from links and menus.
  // Comment permalinks (/comment/<id>) are anchors into pages already captured: skip them.
  // Pagination (?page=N) is real content: older posts in a listing, and the second page of a long
  // comment thread. Follow it. Any other query string (login redirects and the like) is dynamic.
  discover: { exclude: ['^comment/', '^user/'], queryParams: ['page'] },

  // Hosts that ARE this site. Old content hardcodes http://randyfay.com/... in places. The production
  // domain is this site, so those are internal links: the baseline records them as such, discovery follows
  // them, and an archive makes them relative. Inventory: DISCOVERIES.md (generated). A test run never
  // requests this domain; it resolves such references against the target.
  ownDomains: ['randyfay.com'],

  // Hosts a static copy must never refer to (the original's own host is always forbidden for a
  // target on another host). The prepared copy the crawl is taken from goes here.
  static: { forbiddenHosts: ['randyfay-prep.ddev.site'] },

  // The database is the truth about what exists: data/manifest.json is generated from
  // `ddev mysql` by scripts/generate-manifest.mjs (current-revision join, unpublished included).
  async listContent({ root }) {
    const manifest = JSON.parse(readFileSync(path.join(root, 'data', 'manifest.json'), 'utf8'));
    const firstOfType = new Set();
    const seen = new Set();
    for (const n of manifest.nodes) {
      if (n.published && !seen.has(n.type)) {
        seen.add(n.type);
        firstOfType.add(n.nid);
      }
    }
    return manifest.nodes.map((n) => ({
      id: n.nid,
      type: n.type,
      title: n.title,
      published: n.published,
      paths: n.aliases,
      tags: [
        ...(firstOfType.has(n.nid) ? ['smoke'] : []),
        ...(n.hasSectionOverride ? ['section-override'] : []),
      ],
    }));
  },

  async listAssets({ root }) {
    const manifest = JSON.parse(readFileSync(path.join(root, 'data', 'manifest.json'), 'utf8'));
    return manifest.files.map((f) => f.url);
  },

  // Strictness beyond "nothing is missing": lines must keep their order, and images keep their alt text.
  strict: { order: true, alt: true },

  expectedDifferences: 'expected-differences.json',
};
