// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Keeps the offline cache honest. Run after any change:  node scripts/stamp_sw.mjs  (or: npm run stamp)
// 1. Writes the version from package.json into the page footer.
// 2. Rebuilds the list of files the service worker saves for offline use from what is really in the repo.
// 3. Names the cache after the version plus a fingerprint of those files, so every deploy replaces
//    the old cache as a whole and browsers never mix old and new files.
// `npm test` fails when sw.js or the footer are out of date, so a stale deploy cannot slip through.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SHELL_DIRS = ['audio', 'css', 'data', 'fonts', 'icons', 'js', 'vendor'];
const SHELL_FILES = ['index.html', 'manifest.webmanifest'];
const skip = (p) => p.endsWith('.txt') || p.endsWith('.md'); // licence texts are not needed at run time

export const version = () => JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
export const shortVersion = () => `v${version().split('.').slice(0, 2).join('.')}`;

export function shellFiles() {
  const out = [...SHELL_FILES];
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir)).sort()) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (!skip(rel)) out.push(rel);
    }
  };
  SHELL_DIRS.forEach(walk);
  return out;
}

export function renderIndex(html) {
  return html.replace(/<span id="appVersion">[^<]*<\/span>/, `<span id="appVersion">${shortVersion()}</span>`);
}

// Fingerprint of the files as they will be served (index.html with the current version in it).
export function fingerprint(files = shellFiles()) {
  const h = createHash('sha256');
  for (const f of files) {
    h.update(f);
    h.update(f === 'index.html' ? renderIndex(readFileSync(join(root, f), 'utf8')) : readFileSync(join(root, f)));
  }
  return h.digest('hex').slice(0, 10);
}

export function renderSw(src, files = shellFiles()) {
  const list = ["'./'", ...files.map((f) => `'${f}'`)].join(',\n  ');
  return src
    .replace(/const CACHE = '[^']*';/, `const CACHE = 'relaisecho-${version()}-${fingerprint(files)}';`)
    .replace(/const SHELL = \[[\s\S]*?\n\];/, `const SHELL = [\n  ${list},\n];`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const idx = join(root, 'index.html'), sw = join(root, 'sw.js');
  writeFileSync(idx, renderIndex(readFileSync(idx, 'utf8')));
  writeFileSync(sw, renderSw(readFileSync(sw, 'utf8')));
  console.log(`stamped ${shortVersion()}: ${shellFiles().length} offline files, ${readFileSync(sw, 'utf8').match(/const CACHE = '([^']*)'/)[1]}`);
}
