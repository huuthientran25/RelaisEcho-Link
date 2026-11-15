import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizePvt, comparePvt, randomIsi, PVT_CONFIG } from '../js/pvt.js';
import { STRINGS, pick } from '../js/i18n.js';

test('PVT summary counts lapses, timeouts and false starts', () => {
  const trials = [{ rt: 250 }, { rt: 300 }, { rt: 400 }, { rt: null }, { early: true }, { rt: 80 }, { rt: 260 }];
  const s = summarizePvt(trials);
  assert.equal(s.stimuli, 6);
  assert.equal(s.valid, 4);           // 250, 300, 400, 260
  assert.equal(s.medianMs, 280);
  assert.equal(s.lapses, 2);          // 400 and the timeout
  assert.equal(s.falseStarts, 2);     // the early press and the 80 ms response
  assert.equal(s.errors, 4);
  assert.ok(s.meanSpeed > 2 && s.meanSpeed < 4.5);
});

test('PVT comparison uses the modeled 10 percent band', () => {
  assert.equal(comparePvt({ medianMs: 270, lapses: 1 }, { medianMs: 260, lapses: 0 }).verdict, 'similar');
  assert.equal(comparePvt({ medianMs: 300, lapses: 3 }, { medianMs: 260, lapses: 0 }).verdict, 'slower');
  assert.equal(comparePvt({ medianMs: 220, lapses: 0 }, { medianMs: 260, lapses: 0 }).verdict, 'faster');
  assert.equal(comparePvt({ medianMs: null }, { medianMs: 260 }), null);
});

test('random wait stays inside 1 to 4 seconds', () => {
  assert.equal(randomIsi(PVT_CONFIG, () => 0), 1000);
  assert.equal(randomIsi(PVT_CONFIG, () => 1), 4000);
});

test('every translatable element has a French draft, and no French key is orphaned', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 25);
  for (const k of keys) assert.ok(STRINGS.fr[k], `missing French for ${k}`);
  for (const k of Object.keys(STRINGS.fr)) assert.ok(keys.includes(k), `French key not on page: ${k}`);
});

test('Inuktitut falls back to English until a certified translation exists', () => {
  assert.equal(pick('iu', 'home.h1', 'English text'), 'English text');
  assert.equal(pick('fr', 'home.h1', 'x'), STRINGS.fr['home.h1']);
});
