// Tier 2: asset parity check (images, PDFs, etc.) against the frozen baseline's recorded
// SHA-256 + size. No browser needed — APIRequestContext only. See PLAYWRIGHT_TESTING.md.
//
// NOTE: as of the baseline currently checked in, this tier has nothing to actually verify
// on this project — the live DDEV site's sites/default/files/ only contains
// generated color/css/js, not the real uploaded content assets (those live in a separate
// files.tgz referenced by .probo.yaml that hasn't been imported into this environment). The
// export-baseline.mjs script logs a WARNING and skips any 404 rather than failing, so
// baseline.assets is currently empty and this file legitimately runs zero tests. Once the
// real files are imported (`ddev import-files` or equivalent) and the baseline is
// re-frozen, this tier starts covering the real 33-asset inventory.
//
// Run: ddev playwright test tests/regression-assets.spec.ts

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = path.resolve(__dirname, '../baseline');
const baseline = JSON.parse(readFileSync(path.join(BASELINE_DIR, 'manifest.json'), 'utf8'));

for (const asset of baseline.assets) {
  test(`asset: ${asset.url} @assets`, async ({ request }) => {
    const res = await request.get(asset.url);
    expect(res.status(), `expected 200 for ${asset.url}`).toBe(200);

    const buf = await res.body();
    expect(buf.length, `size mismatch for ${asset.url}`).toBe(asset.size);

    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    expect(sha256, `content hash mismatch for ${asset.url}`).toBe(asset.sha256);
  });
}
