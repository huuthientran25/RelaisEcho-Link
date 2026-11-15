import { test } from 'node:test';
import assert from 'node:assert/strict';
import { steadyBedtimeS, sAfterSleep, sAfterWake, sleepPressure, issMissionDose, consistency, TWO_PROCESS } from '../js/board.js';

const H = 3600e3;

test('process S stays between 0 and 1 and moves the right way', () => {
  const s = steadyBedtimeS(8);
  assert.ok(s > 0 && s < 1);
  assert.ok(sAfterSleep(s, 4) < s);
  assert.ok(sAfterWake(0.2, 4) > 0.2);
  assert.ok(steadyBedtimeS(6) > steadyBedtimeS(8), 'shorter usual sleep leaves more pressure at bedtime');
});

test('steady state matches the closed form of the published time constants', () => {
  const d = 8, a = Math.exp(-d / TWO_PROCESS.tauDecayH), b = Math.exp(-(24 - d) / TWO_PROCESS.tauRiseH);
  const sBed = steadyBedtimeS(d);
  const sWake = sBed * a;
  assert.ok(Math.abs(1 - (1 - sWake) * b - sBed) < 1e-12);
});

test('short sleep leaves higher pressure at the same clock time', () => {
  const bed = new Date('2026-11-14T23:00'), now = new Date('2026-11-15T19:00');
  const full = sleepPressure({ sleepStart: bed, sleepEnd: new Date('2026-11-15T07:00'), now, usualSleepH: 8 });
  const short = sleepPressure({ sleepStart: bed, sleepEnd: new Date('2026-11-15T03:00'), now, usualSleepH: 8 });
  assert.ok(short.s > full.s);
  assert.ok(full.curve.length > 10);
});

test('sleep pressure rejects impossible times', () => {
  const t = new Date('2026-11-15T07:00');
  assert.equal(sleepPressure({ sleepStart: t, sleepEnd: new Date(+t - H), now: t }), null);
  assert.equal(sleepPressure({ sleepStart: t, sleepEnd: new Date(+t + 20 * H), now: new Date(+t + 21 * H) }), null);
});

test('radiation range uses published ISS daily doses and the 600 mSv limit', () => {
  const d = issMissionDose(180);
  assert.equal(Math.round(d.low), 72);
  assert.equal(Math.round(d.high), 153);
  assert.ok(Math.abs(d.fracHigh - 153 / 600) < 1e-9);
  assert.equal(issMissionDose(-5).low, 0);
});

test('consistency counts days and time of day gap to the baseline', () => {
  const now = new Date('2026-11-15T10:00');
  const sessions = [
    { createdAt: '2026-11-13T09:00:00', kind: 'baseline', complete: true },
    { createdAt: '2026-11-14T09:30:00', kind: 'followup', complete: true },
    { createdAt: '2026-11-14T21:00:00', kind: 'followup', complete: true },
    { createdAt: '2026-11-01T09:00:00', kind: 'followup', complete: false },
  ];
  const c = consistency(sessions, now);
  assert.equal(c.total, 3);
  assert.equal(c.daysThisWeek, 2);
  assert.equal(c.timeGapMin, 60);
});
