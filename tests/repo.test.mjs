// Repository checks: deploy safety and GitHub web upload limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSw, renderIndex, shellFiles, shortVersion } from '../scripts/stamp_sw.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const all = [];
(function walk(dir) {
  for (const name of readdirSync(join(root, dir))) {
    if (name === 'node_modules' || name === '.git') continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(root, rel)).isDirectory()) walk(rel); else all.push(rel);
  }
})('');

test('service worker and footer are stamped for the current files (run: npm run stamp)', () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  assert.equal(renderSw(sw), sw, 'sw.js is stale: run npm run stamp');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.equal(renderIndex(html), html, 'index.html footer version is stale: run npm run stamp');
  assert.ok(html.includes(`<span id="appVersion">${shortVersion()}</span>`));
});

test('every module the page can load is in the offline list', () => {
  const shell = new Set(shellFiles());
  for (const f of all.filter((x) => /^(js|css|data|icons|vendor)\//.test(x) || /^fonts\/.*\.woff2$/.test(x))) assert.ok(shell.has(f), `${f} missing from offline list`);
  // Imports in main.js resolve to files that exist.
  const main = readFileSync(join(root, 'js/main.js'), 'utf8');
  for (const m of main.matchAll(/from '\.\/([a-z]+\.js)'/g)) assert.ok(shell.has(`js/${m[1]}`), `js/${m[1]} imported but missing`);
});

test('fits GitHub web upload limits: at most 100 files per upload, 25 MiB per file', () => {
  assert.ok(all.length <= 100, `${all.length} files: over the 100 file limit for one drag and drop`);
  for (const f of all) assert.ok(statSync(join(root, f)).size <= 25 * 1024 * 1024, `${f} is over 25 MiB`);
});

test('no personal exports or secrets in the repo', () => {
  for (const f of all) {
    assert.ok(!/all-checkups|relaisecho-packet|relaisecho-reply|\.env$/i.test(f), `${f} looks like personal data`);
  }
});
