// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Eye chart: sizes, screen limit, the run and ETDRS style scoring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACUITY, optoMm, snellen, floorLogmar, lineList, lineDirs, AcuityRun, compareAcuity, acuityForPacket } from '../js/acuity.js';

test('letter size: 20/20 E is about 8.7 mm tall at 6 m, ten times larger at logMAR 1', () => {
  assert.ok(Math.abs(optoMm(0, 6000) - 8.73) < 0.01);
  assert.ok(Math.abs(optoMm(1, 6000) / optoMm(0, 6000) - 10) < 1e-3);
  assert.equal(snellen(0), '20/20'); assert.equal(snellen(1), '20/200'); assert.equal(snellen(0.3), '20/40');
});

test('screen limit: a 96 dpi screen reaches 20/20 at 1 m but only logMAR 0.4 at 40 cm', () => {
  const ppm = 96 / 25.4;
  assert.equal(floorLogmar(ppm, 1000), 0);
  assert.equal(floorLogmar(ppm, 400), 0.4);
  assert.equal(floorLogmar(ppm, 2000), -0.3);
  assert.equal(floorLogmar(ppm * 2, 3000), -0.3);
  assert.deepEqual(lineList(0.7), [1, 0.9, 0.8, 0.7]);
});

test('each line shows every direction', () => {
  for (let k = 0; k < 20; k++) assert.deepEqual([...new Set(lineDirs())].sort(), ['down', 'left', 'right', 'up']);
});

const reader = (limit) => (run) => { while (!run.done) run.answer(run.logmar >= limit - 1e-9 ? run.target : 'nope'); return run.score(); };

test('a reader who sees down to logMAR 0.2 scores 0.2 (20/32)', () => {
  const s = reader(0.2)(new AcuityRun(-0.3));
  assert.equal(s.logmar, 0.2); assert.equal(s.snellen, '20/32'); assert.equal(s.atScreenLimit, false);
});

test('a weak eye: start line failed, the run steps up and scores the larger line', () => {
  const s = reader(0.8)(new AcuityRun(-0.3));
  assert.equal(s.logmar, 0.8);
});

test('partial lines score per letter, and a screen limit is reported', () => {
  const run = new AcuityRun(-0.3);
  while (!run.done) { const l = run.logmar; run.answer(l >= 0.3 || (Math.abs(l - 0.2) < 1e-9 && run.pos < 3) ? run.target : 'nope'); }
  assert.equal(run.score().logmar, 0.24); // 0.3 line read, 3 of 5 at 0.2, 0 at 0.1
  const lim = reader(-0.3)(new AcuityRun(0.1));
  assert.equal(lim.atScreenLimit, true); assert.equal(lim.logmar, 0.1);
});

test('compare: two lines worse is flagged, one line is not', () => {
  assert.equal(compareAcuity({ logmar: 0.3 }, { logmar: 0.1 }).verdict, 'worse');
  assert.equal(compareAcuity({ logmar: 0.2 }, { logmar: 0.1 }).verdict, 'same');
  assert.equal(compareAcuity({ logmar: 0.1 }, null).verdict, 'reference');
  const p = acuityForPacket({ createdAt: '2026-11-15T12:00:00Z', acuity: { distanceMm: 2000, calibrated: true, right: { logmar: 0.3, snellen: '20/40' }, left: { logmar: 0.1, snellen: '20/25' } } },
    { createdAt: '2026-11-01T12:00:00Z', acuity: { right: { logmar: 0.1 }, left: { logmar: 0.1 } } });
  assert.equal(p.right_eye.vs_first, 'worse'); assert.equal(p.left_eye.vs_first, 'same'); assert.equal(p.distance_m, 2);
  assert.ok(ACUITY.bandLogmar === 0.2);
});
