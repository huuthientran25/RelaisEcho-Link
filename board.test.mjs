// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Unit tests (Node's built in runner): npm test
// Each block below keeps its own imports and helpers, so names cannot collide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ---------- Mission board models ----------
{
  const { steadyBedtimeS, sAfterSleep, sAfterWake, sleepPressure, issMissionDose, consistency, TWO_PROCESS } = await import('../js/board.js');

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
}

// ---------- Bench error, today checklist, inflammation markers ----------
{
  const { benchError, noiseFloor, MIN_BENCH_PAIRS } = await import('../js/change.js');
  const { todaySteps } = await import('../js/board.js');
  const { aboveOwnAfterFlight, summarizeCrew, compact } = await import('../js/crew.js');

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
}

// ---------- Alertness test and interface languages ----------
{
  const { summarizePvt, comparePvt, randomIsi, PVT_CONFIG } = await import('../js/pvt.js');
  const { STRINGS, pick } = await import('../js/i18n.js');

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
}
