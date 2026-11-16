// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Unit tests: French interface table and patterns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEXT_FR, PATTERNS_FR, frText } from '../js/i18n-fr.js';

test('French table: no empty entries, no key written twice', () => {
  for (const [en, fr] of Object.entries(TEXT_FR)) assert.ok(typeof fr === 'string' && fr.trim(), `empty French for "${en}"`);
  const src = readFileSync(new URL('../js/i18n-fr.js', import.meta.url), 'utf8');
  const start = src.indexOf('export const TEXT_FR = {'), end = src.indexOf('\n};', start);
  const keys = [...src.slice(start, end).matchAll(/^\s{2}(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z]+)):/gm)].map((m) => m[1] ?? m[2] ?? m[3]);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dup, [], `keys written twice: ${dup.join(', ')}`);
  assert.ok(keys.length > 500, `only ${keys.length} entries`);
});

test('French keeps numbers, dates and units, and leaves unknown text alone', () => {
  assert.equal(frText('Step 3 of 5 · Results'), 'Étape 3 sur 5 · Résultats');
  assert.equal(frText('12 of 30 usable seconds'), '12 sur 30 secondes utilisables');
  assert.match(frText(': Reaction time, median 299 ms (first 256); Headache or poor sleep ticked'), /Temps de réaction, médiane 299 ms \(premier 256\); Mal de tête/);
  assert.match(frText('Pulse 72 (high) · Breathing 15 (high) · dental 0/3 · ticked: Headache, Slept badly'), /^Pouls 72 \(haute\) · Respiration 15 \(haute\) · dentaire 0\/3 · coché : Mal de tête, Mal dormi$/);
  assert.equal(frText('Jaw opening: 2026-11-14 09:15 ·'), 'Ouverture de la mâchoire : 2026-11-14 09:15 ·');
  assert.equal(frText('Right 20/21 · Left 20/25'), 'Droit 20/21 · Gauche 20/25');
  assert.equal(frText('Some sentence nobody translated.'), null);
  assert.equal(frText(': an unknown reason'), null);
});

test('every French pattern produces text when it matches', () => {
  for (const [re] of PATTERNS_FR) assert.ok(re instanceof RegExp);
  const samples = ['5 values · line: your first value, shaded band ±25.6. Red dots sit outside the band; hollow dots were low quality captures.',
    '4 lapses · 2 false starts · 2026-11-14 09:15', 'shortest 5 min 38 s · Feb 2027', 'Line 2 of 11 · letter 1 of 5', '-18.1 (beyond the band)',
    'Quality: high · 11 of 11 windows accepted', '3 eye chart checks', '1 reaction test'];
  for (const s of samples) { const fr = frText(s); assert.ok(fr && fr !== s && !/undefined|null/.test(fr), `${s} -> ${fr}`); }
});

test('every Evidence card has a complete French version that keeps its numbers', async () => {
  const { EVIDENCE } = await import('../js/evidence.js');
  const { EVIDENCE_FR } = await import('../js/evidence-fr.js');
  assert.deepEqual(Object.keys(EVIDENCE_FR).sort(), Object.keys(EVIDENCE).sort());
  const nums = (s) => (s.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(',', '.')).sort();
  for (const k of Object.keys(EVIDENCE)) {
    for (const f of ['title', 'method', 'source', 'limits']) {
      assert.ok(EVIDENCE_FR[k][f] && EVIDENCE_FR[k][f].trim(), `${k}.${f} missing`);
      if (f !== 'title') assert.deepEqual(nums(EVIDENCE_FR[k][f]), nums(EVIDENCE[k][f]), `${k}.${f}: numbers differ`);
    }
  }
});
