#!/usr/bin/env node
// Freezes the current live site into test/playwright/baseline/: normalized HTML for every
// published node's canonical path + every alias, plus asset bytes + hashes. This is the
// durable "before" reference the regression tests diff against — see PLAYWRIGHT_TESTING.md.
//
// Run manually, on demand: `node test/playwright/scripts/export-baseline.mjs`
// Never run at test time. Re-run only when you deliberately want to re-freeze the baseline
// (e.g. real content changed before either migration attempt starts) — once a migration is
// underway, treat a committed, tagged baseline/ as immutable.
//
// Unpublished nodes are NOT fetched for content here (anonymous access returns a 403 page,
// not the node) — only their expected access-denied status is recorded, for every alias.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizeHtml } from '../lib/normalize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, '../data/manifest.json');
const BASELINE_DIR = path.resolve(__dirname, '../baseline');
const PAGES_DIR = path.join(BASELINE_DIR, 'pages');
const ASSETS_DIR = path.join(BASELINE_DIR, 'assets');

const BASE_URL = (process.env.BASELINE_BASE_URL ?? 'https://randyfay.ddev.site').replace(/\/$/, '');

const manifest = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(MANIFEST_PATH, 'utf8')));

mkdirSync(PAGES_DIR, { recursive: true });
mkdirSync(ASSETS_DIR, { recursive: true });

function safeFileName(urlPath) {
  return urlPath.replace(/^\/+/, '').replace(/\//g, '__').replace(/[^a-zA-Z0-9_.-]/g, '_') + '.html';
}

async function fetchStatus(urlPath) {
  const res = await fetch(`${BASE_URL}/${urlPath}`, { redirect: 'manual' });
  return res.status;
}

const pages = [];
const unpublished = [];
let pageCount = 0;
let unpublishedCheckCount = 0;

for (const node of manifest.nodes) {
  if (node.published) {
    for (const alias of node.aliases) {
      const res = await fetch(`${BASE_URL}/${alias}`, { redirect: 'manual' });
      if (res.status !== 200) {
        console.warn(`  WARNING: ${alias} (nid ${node.nid}) returned ${res.status}, expected 200 — skipping.`);
        continue;
      }
      const html = await res.text();
      const normalized = normalizeHtml(html, BASE_URL);
      const file = safeFileName(alias);
      writeFileSync(path.join(PAGES_DIR, file), normalized);
      pages.push({ path: alias, nid: node.nid, file: `pages/${file}` });
      pageCount++;
    }
  } else {
    for (const alias of node.aliases) {
      const status = await fetchStatus(alias);
      if (status !== 403) {
        console.warn(`  WARNING: unpublished ${alias} (nid ${node.nid}) returned ${status}, expected 403.`);
      }
      unpublished.push({ path: alias, nid: node.nid, expectedAnonymousStatus: status });
      unpublishedCheckCount++;
    }
  }
}
console.log(`Fetched ${pageCount} published page(s), checked ${unpublishedCheckCount} unpublished alias(es).`);

const assets = [];
for (const file of manifest.files) {
  const res = await fetch(`${BASE_URL}${file.url}`);
  if (res.status !== 200) {
    console.warn(`  WARNING: asset ${file.url} returned ${res.status} — skipping.`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const relPath = file.url.replace(/^\/sites\/default\/files\//, '');
  const destPath = path.join(ASSETS_DIR, relPath);
  mkdirSync(path.dirname(destPath), { recursive: true });
  writeFileSync(destPath, buf);
  assets.push({
    url: file.url,
    fid: file.fid,
    mime: file.mime,
    sha256,
    size: buf.length,
    file: `assets/${relPath}`,
  });
}
console.log(`Fetched ${assets.length} asset(s).`);

const baselineManifest = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  pages,
  unpublished,
  assets,
};
writeFileSync(path.join(BASELINE_DIR, 'manifest.json'), JSON.stringify(baselineManifest, null, 2) + '\n');
console.log(`\nWrote ${path.join(BASELINE_DIR, 'manifest.json')}`);
console.log('Baseline frozen. Commit test/playwright/baseline/ and git-tag this commit before starting either migration.');
