// Tier 4: access-control parity check for unpublished nodes. This is deliberately a
// separate check from the semantic tier, not a variant of it: it verifies that
// anonymous access to unpublished content is still denied after migration, which a
// content-diff alone would never catch (a node flipping from 403 to 200, or vice versa, is
// an access-control regression, not a content regression). See PLAYWRIGHT_TESTING.md.
//
// Run everything:  ddev playwright test tests/regression-access.spec.ts
// Run this tier's smoke sample: ddev playwright test --grep @draft

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = path.resolve(__dirname, '../baseline');
const baseline = JSON.parse(readFileSync(path.join(BASELINE_DIR, 'manifest.json'), 'utf8'));

for (const entry of baseline.unpublished) {
  test(`access: ${entry.path} (nid ${entry.nid}) stays ${entry.expectedAnonymousStatus} @draft`, async ({
    request,
  }) => {
    const res = await request.get(entry.path);
    expect(res.status(), `expected ${entry.path} to stay ${entry.expectedAnonymousStatus}`).toBe(
      entry.expectedAnonymousStatus
    );
  });
}
