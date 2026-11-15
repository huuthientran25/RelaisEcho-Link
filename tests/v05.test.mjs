import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { changeVsBaseline, NOISE } from '../js/change.js';
import { summarizeCrew, rangeDisagreements } from '../js/crew.js';
import { qrSvg, QR_MAX_BYTES } from '../js/qr.js';

test('change vs baseline respects the noise band', () => {
  assert.equal(changeVsBaseline(75, 70, NOISE.pulseBpm).kind, 'noise');
  assert.equal(changeVsBaseline(80, 70, NOISE.pulseBpm).kind, 'up');
  assert.equal(changeVsBaseline(10, 15, NOISE.breathsPerMin).kind, 'down');
  assert.equal(changeVsBaseline(null, 15, 3).kind, 'none');
});

const data = JSON.parse(readFileSync(new URL('../data/osd575-cmp.json', import.meta.url)));

test('OSD-575 file has 4 crew, 7 timepoints and lab ranges', () => {
  assert.deepEqual(data.crew, ['C001', 'C002', 'C003', 'C004']);
  assert.equal(data.timepoints.length, 7);
  for (const a of data.analytes) {
    assert.ok(a.rangeMin < a.rangeMax, a.name);
    for (const c of data.crew) assert.equal(a.series[c].length, 7);
  }
  assert.ok(!data.analytes.some((a) => /egfr/i.test(a.key)), 'race based eGFR excluded');
});

test('crew summary matches the published values for potassium', () => {
  const k = data.analytes.find((a) => a.key === 'potassium');
  const s = summarizeCrew(k, data.timepoints).C003;   // pre 3.7, 3.5, 3.3; day after landing 3.0
  assert.equal(s.r1, 3.0);
  assert.equal(s.preMin, 3.3);
  assert.equal(s.inLab, false);
  assert.equal(s.inOwn, false);
  const r = rangeDisagreements(data);
  assert.equal(r.r1Total, 60);
  assert.equal(r.preTotal, 180);
});

test('QR encodes UTF-8 text and refuses oversized text', () => {
  const q = qrSvg('RelaisÉcho Link · pulse 72 bpm');
  assert.ok(q.ok && q.svg.startsWith('<svg') && q.modules >= 21);
  assert.equal(qrSvg('x'.repeat(QR_MAX_BYTES + 1)).ok, false);
});
