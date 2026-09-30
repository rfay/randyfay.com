#!/usr/bin/env node
// Generates test/playwright/data/manifest.json: the canonical list of node paths,
// aliases, and file assets this site's Playwright suite is built around.
//
// Run manually, on demand, from the repo root: `node test/playwright/scripts/generate-manifest.mjs`
// Never run at test time — the manifest is a frozen snapshot of "what content exists",
// checked in alongside the baseline it drives.
//
// Uses `ddev mysql` (not a DB client library) so this has no runtime dependency beyond
// what the project already requires to inspect its own database.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.resolve(__dirname, '../data/manifest.json');

// Runs a SQL query via `ddev mysql -e` and parses its tab-separated output (header row +
// one row per record) into an array of objects. `ddev mysql` must be run with the project
// root as cwd to find the right project.
function query(sql) {
  const raw = execFileSync('ddev', ['mysql', '-e', sql], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trimEnd();
  const lines = raw.split('\n');
  const headers = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
  });
}

console.log('Querying nodes (current revision only, via node.vid = node_revision.vid join)...');
// No status filter here on purpose: unpublished nodes must stay in the manifest so the
// suite can verify they *stay* inaccessible after migration, not just be silently dropped.
const nodeRows = query(
  `SELECT n.nid, n.type, n.status, nr.title
   FROM node n JOIN node_revision nr ON n.vid = nr.vid
   ORDER BY n.nid`
);
console.log(`  ${nodeRows.length} nodes found.`);

console.log('Querying URL aliases...');
const aliasRows = query(
  `SELECT source, alias FROM url_alias WHERE source LIKE 'node/%' ORDER BY alias`
);
const aliasesByNid = new Map();
for (const { source, alias } of aliasRows) {
  const nid = source.replace(/^node\//, '');
  if (!aliasesByNid.has(nid)) aliasesByNid.set(nid, []);
  aliasesByNid.get(nid).push(alias);
}
console.log(`  ${aliasRows.length} aliases found, covering ${aliasesByNid.size} nodes.`);

console.log('Querying per-node theme/layout overrides (sections_nodes)...');
let overrideNids = new Set();
try {
  const overrideRows = query('SELECT nid FROM sections_nodes');
  overrideNids = new Set(overrideRows.map((r) => r.nid));
} catch (e) {
  console.warn('  sections_nodes not found or empty — treating as no overrides.', e.message);
}
console.log(`  ${overrideNids.size} node(s) with a layout/theme override.`);

console.log('Querying file assets (file_managed)...');
const fileRows = query(
  `SELECT fid, filename, uri, filemime FROM file_managed ORDER BY fid`
);
// file_public_path is 'sites/default/files' for this project (see settings) — public://
// URIs map directly to that. filemime is trusted; filesize in file_managed is stale/zero
// for legacy rows on this site, so it is deliberately NOT used here — the baseline export
// step computes real size/hash from the actual fetched bytes instead.
const files = fileRows
  .filter((f) => f.uri.startsWith('public://'))
  .map((f) => ({
    fid: f.fid,
    filename: f.filename,
    uri: f.uri,
    url: '/sites/default/files/' + f.uri.slice('public://'.length),
    mime: f.filemime,
  }));
console.log(`  ${files.length} public file asset(s) found.`);

const nodes = nodeRows.map((n) => {
  const aliases = aliasesByNid.get(n.nid) ?? [];
  const canonical = 'node/' + n.nid;
  return {
    nid: n.nid,
    type: n.type,
    title: n.title,
    published: n.status === '1',
    path: aliases[0] ?? canonical,
    // Always includes the canonical node/N path alongside any real aliases, since both
    // must keep working after migration.
    aliases: [...new Set([canonical, ...aliases])],
    hasSectionOverride: overrideNids.has(n.nid),
  };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  nodes,
  files,
};

writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2) + '\n');

const publishedCount = nodes.filter((n) => n.published).length;
console.log(`\nWrote ${OUTPUT}`);
console.log(
  `  ${nodes.length} nodes total (${publishedCount} published, ${nodes.length - publishedCount} unpublished), ${files.length} files.`
);
