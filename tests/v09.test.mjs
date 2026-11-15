import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { benchError, noiseFloor, MIN_BENCH_PAIRS } from '../js/change.js';
import { todaySteps } from '../js/board.js';
import { aboveOwnAfterFlight, summarizeCrew, compact } from '../js/crew.js';

test('bench error and the switch from published to own noise band', () => {
  const mk = (est, ref) => ({ pulse: { bpm: est }, resp: { rpm: null }, reference: { pulseBpm: ref } });
  const few = [mk(70, 72), mk(80, 77)];
  assert.equal(benchError(few).pulse.n, 2);
  assert.equal(noiseFloor(benchError(few), 'pulse').source, 'published figures');
  const many = [mk(70, 72), mk(80, 77), mk(65, 66), mk(90, 92), mk(75, 75)];
  const b = benchError(many);
  assert.equal(b.pulse.n, MIN_BENCH_PAIRS);
  assert.equal(b.pulse.mae, 1.6);           // 2, 3, 1, 2, 0
  assert.equal(b.pulse.bias, -0.4);
  assert.deepEqual(noiseFloor(b, 'pulse'), { value: 3, source: 'your bench test (5 pairs)' });
  assert.equal(noiseFloor(b, 'resp').source, 'published figures');
});

test('today steps: baseline first, then checkup and alertness, short sleep prompts the test', () => {
  const now = new Date('2026-11-15T14:00');
  assert.equal(todaySteps({ sessions: [], alertTests: [], sleep: null, now }).steps[0].key, 'baseline');
  const base = { kind: 'baseline', complete: true, createdAt: '2026-11-13T09:00:00' };
  const t = todaySteps({ sessions: [base], alertTests: [], sleep: { sleptH: 5, band: 'within', asleepNow: false }, now });
  assert.equal(t.steps.find((s) => s.key === 'checkup').done, false);
  assert.match(t.steps.find((s) => s.key === 'alert').text, /Under 6 hours/);
  const done = todaySteps({ sessions: [base, { kind: 'followup', complete: true, createdAt: '2026-11-15T09:10:00' }],
    alertTests: [{ createdAt: '2026-11-15T09:20:00' }], sleep: { sleptH: 8, band: 'below', asleepNow: false }, now });
  assert.equal(done.allDone, true);
});

test('inflammation markers have no lab range and are compared with own pre-flight values', () => {
  const data = JSON.parse(readFileSync(new URL('../data/osd575-cmp.json', import.meta.url)));
  const il6 = data.analytes.find((a) => a.key === 'il_6');
  assert.equal(il6.rangeMin, null);
  const s = summarizeCrew(il6, data.timepoints).C001;   // pre 2.87, 2.58, 5.94 (L-92, L-44, L-3), R+1 6.86
  assert.equal(s.inLab, null);
  assert.equal(s.r1, 6.86);
  assert.ok(s.r1 > s.preMax);
  const r = aboveOwnAfterFlight(data);
  assert.equal(r.total, 48);
  assert.equal(compact(18385000), '18M');
});
