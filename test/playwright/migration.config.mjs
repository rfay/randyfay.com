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
  discover: { exclude: ['^comment/', '^user/'] },

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

  expectedDifferences: 'expected-differences.json',
};
