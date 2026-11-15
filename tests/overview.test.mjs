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

test('mission clock: day 1 on the start date, before and after handled, bad input refused', async () => {
  const { missionDay } = await import('../js/overview.js');
  const now = new Date(2026, 10, 15, 13, 0);
  assert.deepEqual(missionDay('2026-11-15', 180, now), { phase: 'during', day: 1, length: 180, pct: 1 / 180 });
  assert.equal(missionDay('2026-10-07', 180, now).day, 40);
  assert.equal(missionDay('2026-11-20', 30, now).daysToGo, 5);
  assert.equal(missionDay('2026-01-01', 30, now).phase, 'after');
  assert.equal(missionDay('', 30, now), null);
  assert.equal(missionDay('2026-11-01', 0, now), null);
});

test('scenarios tell different stories on the body chart', async () => {
  const { makeDemoSessions, makeDemoExp, SCENARIOS } = await import('../js/demo.js');
  const status = (id) => {
    const all = [...makeDemoSessions(now, 42, id), ...makeDemoExp(now, id)];
    const original = all.find((s) => s.kind === 'baseline');
    const last = all.filter((s) => s.kind === 'followup').at(-1);
    return Object.fromEntries(buildRegions(all, { original, floors: { pulse: 8, resp: 3 }, latestChecklist: last.context.checklist }).map((r) => [r.id, r.status]));
  };
  assert.equal(SCENARIOS.length, 4);
  const steady = status('steady');
  assert.ok(Object.values(steady).every((s) => s !== 'review' && s !== 'urgent'), JSON.stringify(steady));
  assert.equal(status('gums').mouth, 'review');
  assert.equal(status('breath').lungs, 'urgent');
  assert.equal(status('shortsleep').head, 'review');
});
