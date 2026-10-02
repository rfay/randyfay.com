#!/usr/bin/env node
// Freezes the parts of the baseline that are not page content: the bytes and SHA-256 of every
// asset, and the expected anonymous status of every unpublished node. Page content is frozen
// separately by kit/scripts/export-semantic-baseline.mjs. See PLAYWRIGHT_TESTING.md.
//
//   node scripts/export-baseline.mjs     (from test/playwright, with the development site up)
//
// Run on demand, never at test time. Re-run only when you deliberately want to re-freeze; once a
// migration is underway, treat a committed, tagged baseline/ as immutable.
//
// Unpublished nodes are NOT fetched for content (anonymous access returns a 403 page, not the
// node). Only the status each alias returns today is recorded.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, '../data/manifest.json');
const BASELINE_DIR = path.resolve(__dirname, '../baseline');
const ASSETS_DIR = path.join(BASELINE_DIR, 'assets');

const BASE_URL = (process.env.BASELINE_BASE_URL ?? 'https://randyfay.ddev.site').replace(/\/$/, '');

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
mkdirSync(ASSETS_DIR, { recursive: true });

const unpublished = [];
for (const node of manifest.nodes) {
  if (node.published) continue;
  for (const alias of node.aliases) {
    const status = (await fetch(`${BASE_URL}/${alias}`, { redirect: 'manual' })).status;
    if (status !== 403) {
      console.warn(`  WARNING: unpublished ${alias} (nid ${node.nid}) returned ${status}, expected 403.`);
    }
    unpublished.push({ path: alias, nid: node.nid, expectedAnonymousStatus: status });
  }
}
console.log(`Checked ${unpublished.length} unpublished alias(es).`);

const assets = [];
for (const file of manifest.files) {
  const res = await fetch(`${BASE_URL}${file.url}`);
  if (res.status !== 200) {
    console.warn(`  WARNING: asset ${file.url} returned ${res.status}; not in the baseline.`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const relPath = file.url.replace(/^\/sites\/default\/files\//, '');
  const destPath = path.join(ASSETS_DIR, relPath);
  mkdirSync(path.dirname(destPath), { recursive: true });
  writeFileSync(destPath, buf);
  assets.push({
    url: file.url,
    fid: file.fid,
    mime: file.mime,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    size: buf.length,
    file: `assets/${relPath}`,
  });
}
console.log(`Fetched ${assets.length} asset(s).`);

writeFileSync(
  path.join(BASELINE_DIR, 'manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL, unpublished, assets }, null, 2) + '\n'
);
console.log(`Wrote ${path.join(BASELINE_DIR, 'manifest.json')}`);
