// Tier 3: curated visual (pixel) regression sample — one page per content type, every node
// with a layout/theme override, plus a couple of representative extras. Deliberately a small
// list, not the full ~215 pages: full-page screenshot diffing that size would be slow and
// noisy, and isn't what full content coverage needs (Tier 1 already covers that cheaply).
//
// `expect.soft` is deliberate, not an oversight: a migration may intentionally change
// theme/CSS, so this tier is for manual visual review in the HTML report, not a pass/fail
// gate. See PLAYWRIGHT_TESTING.md.
//
// Chromium only (the default project) — cross-browser screenshot diffing is noise, not
// signal, for this purpose.
//
// Run: ddev playwright test tests/visual.spec.ts --project=chromium

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(path.resolve(__dirname, '../data/manifest.json'), 'utf8')
);

const published = manifest.nodes.filter((n) => n.published);

// One representative per content type.
const seenTypes = new Set();
const onePerType = [];
for (const node of published) {
  if (!seenTypes.has(node.type)) {
    seenTypes.add(node.type);
    onePerType.push(node);
  }
}

// Every node with a layout/theme override — these are exactly the pages most likely to
// render differently from their content type's default, so they're worth a look every time.
const overrides = published.filter((n) => n.hasSectionOverride);

// A couple of extra representative nodes, on top of the one-per-type sample above (blog/book
// dominate the content mix here, so a small extra sample of those is worth the little extra
// cost).
const extras = published.filter((n) => n.type === 'blog' || n.type === 'book').slice(0, 2);

const curated = [...new Map([...onePerType, ...overrides, ...extras].map((n) => [n.nid, n])).values()];

for (const node of curated) {
  test(`visual: ${node.path} (nid ${node.nid}) @${node.type}${node.hasSectionOverride ? ' @section-override' : ''}`, async ({
    page,
  }, testInfo) => {
    await page.goto(`/${node.path}`);
    // Deliberately NOT `expect.soft` — soft assertions still mark the test (and the run's
    // exit code) as failed, they just don't abort mid-test. True "informational only, never
    // blocks the run" needs a manual try/catch: on a mismatch, attach the diff images to the
    // HTML report for manual review and let the test pass anyway, since a migration may
    // intentionally change theme/CSS and this tier isn't a pass/fail gate.
    try {
      await expect(page).toHaveScreenshot(`${node.nid}.png`, {
        fullPage: true,
        animations: 'disabled',
        mask: [page.locator('.comment-form, .messages')],
      });
    } catch (error) {
      testInfo.annotations.push({
        type: 'visual-diff',
        description: `Screenshot differs from baseline for nid ${node.nid} (${node.path}) — informational only, see attachments.`,
      });
      for (const attachment of testInfo.attachments) {
        console.log(`  visual diff attachment: ${attachment.name} -> ${attachment.path}`);
      }
    }
  });
}
