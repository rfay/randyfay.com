// Tier 1: full-content parity check for every published node's canonical path + every
// alias, against the frozen baseline in test/playwright/baseline/. See
// PLAYWRIGHT_TESTING.md for the full strategy this is built from.
//
// Uses Playwright's APIRequestContext (the `request` fixture) rather than a real browser
// page — this is a plain HTTP + text comparison, so there's no need to render anything.
//
// Run everything:      ddev playwright test tests/regression-content.spec.ts
// Run one type:         ddev playwright test --grep @blog
// Run one smoke sample: ddev playwright test --grep @smoke
// Run a slice:          ddev playwright test tests/regression-content.spec.ts --shard=1/4
// Point at a migration target instead of the live site:
//   TEST_BASE_URL=https://migration-a.example.com ddev playwright test tests/regression-content.spec.ts

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeHtml } from '../lib/normalize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = path.resolve(__dirname, '../baseline');

const baseline = JSON.parse(readFileSync(path.join(BASELINE_DIR, 'manifest.json'), 'utf8'));

// One representative node per content type gets tagged @smoke, so `--grep @smoke` gives a
// fast sanity check without running the full ~215-page suite.
const smokeNids = new Set();
const manifestNodes = JSON.parse(
  readFileSync(path.resolve(__dirname, '../data/manifest.json'), 'utf8')
).nodes;
const seenTypes = new Set();
for (const node of manifestNodes) {
  if (node.published && !seenTypes.has(node.type)) {
    smokeNids.add(node.nid);
    seenTypes.add(node.type);
  }
}
const nodeByNid = new Map(manifestNodes.map((n) => [n.nid, n]));

for (const page of baseline.pages) {
  const node = nodeByNid.get(page.nid);
  const tags = [`@${node.type}`];
  if (smokeNids.has(page.nid)) tags.push('@smoke');
  if (node.hasSectionOverride) tags.push('@section-override');

  test(`content: ${page.path} (nid ${page.nid}) ${tags.join(' ')}`, async ({ request, baseURL }) => {
    const res = await request.get(page.path);
    expect(res.status(), `expected 200 for ${page.path}`).toBe(200);

    const actualHtml = await res.text();
    const expectedHtml = readFileSync(path.join(BASELINE_DIR, page.file), 'utf8');

    // Both sides are normalized with the SAME function, but against their own baseURL —
    // that's what makes this comparison valid across two different hostnames (the live
    // site vs. a migration target).
    const actualNormalized = normalizeHtml(actualHtml, baseURL);

    expect(actualNormalized).toBe(expectedHtml);
  });
}
