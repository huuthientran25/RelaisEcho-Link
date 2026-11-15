// Overview: region status, series and the chart, on invented records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, METRIC_DEFS, seriesFor, referenceFor, buildRegions, lineChart, BODY_SVG } from '../js/overview.js';
import { makeDemoSessions, makeDemoExp } from '../js/demo.js';

const now = new Date('2026-11-15T12:00:00Z');
const demo = [...makeDemoSessions(now), ...makeDemoExp(now)];

test('every region metric exists, every region sits on the figure', () => {
  for (const r of REGIONS) {
    for (const m of r.metrics) assert.ok(METRIC_DEFS[m], m);
    assert.ok(r.dot[0] > 40 && r.dot[0] < 260 && r.dot[1] > 0 && r.dot[1] < 460, r.id);
    assert.ok(r.y >= 0 && r.y <= 92);
  }
  assert.match(BODY_SVG, /^<svg viewBox="0 0 300 460"/);
});

test('series pick the right records, oldest first, and skip missing values', () => {
  const pulse = seriesFor('pulse', demo);
  assert.equal(pulse.length, 12);
  assert.ok(pulse.every((p, i) => i === 0 || p.t >= pulse[i - 1].t));
  assert.equal(seriesFor('jaw', demo).map((p) => p.v).join(), '44.5,37');
  assert.equal(seriesFor('alert', demo).length, 5);
  assert.equal(seriesFor('nope', demo).length, 0);
  assert.equal(seriesFor('pupil', [{ kind: 'exp', createdAt: '2026-11-01T00:00:00Z', exp: { check: 'pupil', ok: false } }]).length, 0, 'failed tries are not plotted');
});

test('reference: original baseline for pulse, first value otherwise, percentage bands scale', () => {
  const orig = demo.find((s) => s.kind === 'baseline');
  const ref = referenceFor('pulse', seriesFor('pulse', demo), { original: orig, floors: { pulse: 8 } });
  assert.deepEqual([ref.base, ref.band], [orig.pulse.bpm, 8]);
  assert.equal(referenceFor('jaw', seriesFor('jaw', demo)).base, 44.5);
  assert.ok(Math.abs(referenceFor('ror', seriesFor('ror', demo)).band - 0.0912) < 1e-9);
  assert.equal(referenceFor('pulse', seriesFor('pulse', demo), {}), null);
});

test('regions: demo data flags heart (pulse up, timing index) and mouth, not neck; ticks raise urgent', () => {
  const orig = demo.filter((s) => s.kind === 'baseline')[0];
  const regs = Object.fromEntries(buildRegions(demo, { original: orig, floors: { pulse: 8, resp: 3 } }).map((r) => [r.id, r]));
  assert.equal(regs.heart.status, 'review');
  assert.ok(regs.heart.reasons.some((x) => /Pulse timing/.test(x)));
  assert.equal(regs.mouth.status, 'review');
  assert.equal(regs.neck.status, 'none');
  assert.equal(regs.hands.status, 'logged');
  const tick = Object.fromEntries(buildRegions(demo, { original: orig, floors: { pulse: 8, resp: 3 }, latestChecklist: ['breath'], sleepHours: 4.5 }).map((r) => [r.id, r]));
  assert.equal(tick.lungs.status, 'urgent');
  assert.match(tick.head.reasons.join(), /4.5 h, under 6 h/);
  assert.ok(buildRegions([], {}).every((r) => r.status === 'none'));
});

test('chart: one dot per value, band drawn, out of band dots marked', () => {
  const pts = [{ t: 0, v: 60 }, { t: 86400000, v: 62 }, { t: 2 * 86400000, v: 80 }];
  const svg = lineChart(pts, { unit: 'bpm', ref: { base: 60, band: 8, label: 'original baseline' }, title: 'Pulse' });
  assert.equal((svg.match(/<circle /g) || []).length, 3);
  assert.equal((svg.match(/class="now"/g) || []).length, 1);
  assert.match(svg, /class="band"/);
  assert.match(svg, /aria-label="Pulse: 3 values, shaded band around original baseline"/);
  assert.equal(lineChart([], {}), '');
  assert.equal((lineChart([{ t: 5, v: 1 }], {}).match(/<circle /g) || []).length, 1);
});
