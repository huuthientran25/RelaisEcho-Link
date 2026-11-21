// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
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

test('trend: one value outside is a blip, three in a row is sustained, a steady climb inside the band is drift', async () => {
  const { trendFor, trendLine, TREND } = await import('../js/overview.js');
  const ref = { base: 60, band: 5 };
  const d = (i) => Date.UTC(2026, 10, 1 + i);
  const pts = (vals, q = []) => vals.map((v, i) => ({ t: d(i), v, q: q[i] || 'high' }));
  assert.equal(trendFor(pts([60, 61, 59, 60]), ref).kind, 'steady');
  const one = trendFor(pts([60, 61, 59, 70]), ref);
  assert.deepEqual([one.kind, one.side, one.run], ['single', 'above', 1]);
  const three = trendFor(pts([60, 66, 67, 68]), ref);
  assert.deepEqual([three.kind, three.run], ['sustained', TREND.SUSTAIN_RUN]);
  // a low quality capture in the middle is skipped, not counted as a break or as a value
  assert.equal(trendFor(pts([60, 66, 50, 67, 68], [, , 'low']), ref).kind, 'sustained');
  // switching sides restarts the run
  assert.equal(trendFor(pts([66, 67, 50, 49]), ref).run, 2);
  const drift = trendFor(pts([57, 59, 61, 63]), ref);
  assert.equal(drift.kind, 'drift'); assert.equal(drift.side, 'above'); assert.ok(drift.perWeek > 10);
  // noisy, not monotonic: no drift
  assert.equal(trendFor(pts([57, 62, 59, 63]), ref).kind, 'steady');
  assert.equal(trendFor(pts([60]), null).kind, 'none');
  assert.match(trendLine(three, 'bpm'), /3 times in a row/);
  assert.match(trendLine(drift, 'bpm'), /bpm a week/);
  assert.equal(trendLine({ kind: 'steady' }), '');
});

test('trends for the packet: the short sleep sample shows the climb in pulse, nothing for a steady record', async () => {
  const { trendsForPacket } = await import('../js/overview.js');
  const { makeDemoSessions } = await import('../js/demo.js');
  const now = new Date(Date.UTC(2026, 10, 15, 12));
  const short = makeDemoSessions(now, 1, 'shortsleep');
  const steady = makeDemoSessions(now, 1, 'steady');
  const orig = (l) => l.filter((x) => x.kind === 'baseline')[0];
  const a = trendsForPacket(short, { original: orig(short), floors: { pulse: 3, resp: 2 } });
  const b = trendsForPacket(steady, { original: orig(steady), floors: { pulse: 3, resp: 2 } });
  assert.ok(Array.isArray(a) && Array.isArray(b));
  for (const t of a) assert.ok(['sustained', 'drift', 'early_warning'].includes(t.kind) && /MODELED/.test(t.rule), JSON.stringify(t));
  assert.ok(a.some((t) => t.measure === 'Pulse' && t.kind === 'sustained' && t.side === 'above'), 'the climb in pulse is still reported as sustained');
  assert.equal(b.length, 0, 'a steady record raises nothing, with or without device readings');
  assert.ok(!b.some((t) => t.kind === 'sustained' && !t.experimental), JSON.stringify(b));
  console.log('short sleep trends:', a.map((t) => `${t.measure} ${t.kind} ${t.side} ${t.run ?? t.per_week}`).join(' | ') || 'none');
});

test('160 character message: fits, puts urgent first, codes the vitals, and marks what was dropped', async () => {
  const { packetSms, SMS_MAX, SMS_LEGEND } = await import('../js/packet.js');
  const base = {
    checkup: { kind: 'followup', capturedAt: '2026-11-14T13:33:00.000Z' },
    results: { pulse_bpm: { value: 72, quality: 'high' }, breathing_per_min: { value: 15, quality: 'medium' } },
    comparison: { change_vs_original: { pulse: { kind: 'up', diff: 10 }, breathing: { kind: 'noise', diff: 1 } } },
    dental: [{ view: 'front', auto_compare: { flags: ['x'], gum_red_delta_a: 18.3, tooth_yellow_delta_b: 11.2 } }],
    alertness: { median_ms: 299 },
    trends: [{ measure: 'Pulse', kind: 'sustained', run: 3 }],
    self_report_checklist: ['Headache', 'Slept badly', 'Tooth or gum pain'], self_report_urgent: false, self_report: 'note',
    experimental_checks: [{ check: 'jaw', differs: ['x'] }],
  };
  const m = packetSms(base);
  assert.ok(m.length <= SMS_MAX, m);
  assert.match(m, /^RE FU 11-14 13:33 \| P72 \+10x3 \| R15~ ok \| SYM HA,SL,TG \| RT299 \| DENT gum\+18\.3,teeth\+11\.2 \| EXP JAW \| NOTE$/);
  const urgent = packetSms({ ...base, self_report_urgent: true, self_report_checklist: ['Chest pain', ...base.self_report_checklist] });
  assert.match(urgent, /^RE FU 11-14 13:33 \| URGENT CP \| P72/);
  const long = packetSms({ ...base, experimental_checks: ['jaw', 'gaze', 'pupil', 'pallor', 'tremor', 'circ', 'neck'].map((c) => ({ check: c, differs: ['x'] })), self_report_checklist: Object.keys({ Headache: 1, 'Stuffy nose or puffy face': 1, 'Blurry or changed vision': 1, 'Nausea or dizziness': 1, 'Back pain': 1, 'Slept badly': 1, 'Tooth or gum pain': 1, 'Feverish or chills': 1 }) });
  assert.ok(long.length <= SMS_MAX && /\+MORE$/.test(long), long);
  assert.match(SMS_LEGEND, /URGENT = chest pain/);
  assert.match(SMS_LEGEND, /HA headache/);
});

test('bench agreement: Bland and Altman bias and limits from known pairs', async () => {
  const { blandAltman, benchPairs } = await import('../js/change.js');
  const { blandAltmanSvg } = await import('../js/overview.js');
  // differences 2, 0, -2, 4 -> bias 1, sd sqrt(((1)^2+(1)^2+(3)^2+(3)^2)/3)=sqrt(20/3)=2.58
  const ba = blandAltman([[72, 70], [65, 65], [60, 62], [80, 76]]);
  assert.equal(ba.n, 4); assert.equal(ba.bias, 1); assert.equal(ba.sd, 2.6);
  assert.equal(ba.low, Math.round((1 - 1.96 * Math.sqrt(20 / 3)) * 10) / 10);
  assert.equal(ba.high, Math.round((1 + 1.96 * Math.sqrt(20 / 3)) * 10) / 10);
  assert.equal(blandAltman([[1, 1]]).bias, null);
  const pairs = benchPairs([{ pulse: { bpm: 70 }, reference: { pulseBpm: '68' } }, { pulse: { bpm: 70 }, reference: { pulseBpm: '' } }, { resp: { rpm: 14 }, reference: { breathsPerMin: 15 } }], 'pulse');
  assert.deepEqual(pairs, [[70, 68]]);
  assert.match(blandAltmanSvg(ba, { unit: 'bpm', title: 'Pulse' }), /4 pairs, bias 1 bpm/);
});

test('short message decodes back into plain lines', async () => {
  const { packetSms, decodeSms } = await import('../js/packet.js');
  const p = {
    checkup: { kind: 'followup', capturedAt: '2026-11-14T13:33:00.000Z' },
    results: { pulse_bpm: { value: 72, quality: 'high' }, breathing_per_min: { value: 15, quality: 'medium' } },
    comparison: { change_vs_original: { pulse: { kind: 'up', diff: 10 }, breathing: { kind: 'noise', diff: 1 } } },
    dental: [], trends: [{ measure: 'Pulse', kind: 'sustained', run: 3 }],
    self_report_checklist: ['Chest pain', 'Headache'], self_report_urgent: true, self_report: 'x', experimental_checks: [{ check: 'jaw', differs: ['x'] }],
  };
  const d = decodeSms(packetSms(p));
  assert.ok(d.ok);
  assert.deepEqual(d.lines, [
    'Follow up checkup, 11-14 13:33 UTC.',
    'URGENT: Chest pain ticked. Contact the person now.',
    'Pulse 72 bpm: +10 against the original baseline, beyond the band, outside the band 3 checks in a row.',
    "Breathing 15 per minute (low or medium quality capture): inside the person's own band.",
    'Symptoms ticked: Chest pain, Headache.',
    "Experimental checks that differ from the person's first: jaw.",
    'The person wrote a note: ask for the full packet.',
  ]);
  assert.equal(decodeSms('hello').ok, false);
  assert.match(decodeSms('RE BL 11-01 08:41 | P62 | R13 +MORE').lines.at(-1), /ask for the full packet/);
});

test('packet fingerprint: intact after a JSON round trip, changed after an edit, none on old packets', async () => {
  const { buildPacket, sealPacket, checkIntegrity, packetText } = await import('../js/packet.js');
  const sess = { id: 's1', kind: 'followup', createdAt: '2026-11-14T13:33:00.000Z', source: 'camera', pulse: { bpm: 72, quality: 'high' }, resp: { rpm: 15, quality: 'high' }, dental: {}, context: { symptoms: 'tired', checklist: ['sleep'] } };
  const built = await sealPacket(buildPacket(sess, { original: null, recent: [] }));
  assert.match(built.packet.integrity.fingerprint, /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
  const copy = JSON.parse(built.json);
  assert.equal((await checkIntegrity(copy)).state, 'intact');
  copy.results.pulse_bpm.value = 58;
  assert.equal((await checkIntegrity(copy)).state, 'changed');
  const old = JSON.parse(built.json); delete old.integrity;
  assert.equal((await checkIntegrity(old)).state, 'none');
  assert.match(packetText(built.packet), /Fingerprint: [0-9A-F-]{19}/);
});

test('derived metrics: own spread (z score), Earth ranges, BMI, heartbeats per breath', async () => {
  const { personalStats, statsLine, earthLine, bmi, EARTH_AVG, METRIC_DEFS, STATS_MIN } = await import('../js/overview.js');
  const pts = [60, 62, 61, 63, 59, 62, 72].map((v, i) => ({ t: i, v, q: 'high' }));
  const st = personalStats(pts);
  assert.equal(st.n, 6); assert.equal(st.mean, 61.17); assert.equal(st.sd, 1.47); assert.equal(st.z, 7.4); assert.equal(st.above, 6);
  assert.match(statsLine(st, 'bpm'), /\+7\.4 standard deviations from your own mean, higher than all 6 earlier values/);
  assert.equal(personalStats(pts.slice(0, STATS_MIN)), null, 'too few values');
  assert.equal(personalStats([...pts.slice(0, 6), { t: 9, v: 99, q: 'low' }]).latest, 62, 'low quality is skipped');
  assert.match(earthLine('pulse', 104), /above it/);
  assert.match(earthLine('resp', 15), /inside it/);
  assert.equal(earthLine('alert', 300), '');
  assert.deepEqual(bmi(175, 70), { value: 22.9, category: 'healthy weight range' });
  assert.equal(bmi(160, 47).category, 'underweight');
  assert.equal(bmi(EARTH_AVG.male.heightCm, EARTH_AVG.male.weightKg).value, 29.5);
  assert.equal(bmi(EARTH_AVG.female.heightCm, EARTH_AVG.female.weightKg).value, 29.9);
  assert.equal(bmi(0, 70), null);
  assert.equal(METRIC_DEFS.hpb.get({ pulse: { bpm: 72 }, resp: { rpm: 15 } }), 4.8);
  assert.equal(METRIC_DEFS.hpb.get({ pulse: { bpm: 72 } }), null);
});

test('early warning (EWMA) and forecast on the person\'s own values', async () => {
  const { ewmaChart, ewmaLine, forecastNext, forecastLine, simulateDetection, trendsForPacket } = await import('../js/overview.js');
  const D = 86400000;
  const steady = [70, 72, 71, 69, 70, 71, 72, 70, 71, 70, 69, 71].map((v, i) => ({ t: i * D, v, q: 'high' }));
  const e0 = ewmaChart(steady);
  assert.equal(e0.signal, false);
  assert.match(ewmaLine(e0, 'bpm'), /^Early warning: none/);
  const shifted = steady.slice(0, 8).concat([74, 75, 74, 76, 75].map((v, i) => ({ t: (8 + i) * D, v, q: 'high' })));
  const e1 = ewmaChart(shifted);
  assert.equal(e1.signal, true); assert.equal(e1.side, 'above');
  assert.equal(ewmaChart(steady.slice(0, 8)), null, 'needs more than the 8 baseline values');
  const line = [60, 61, 62, 63, 64, 65].map((v, i) => ({ t: i * D, v, q: 'high' }));
  const f = forecastNext(line);
  assert.ok(Math.abs(f.value - 66) < 1e-9); assert.equal(f.aheadDays, 1); assert.ok(f.hi - f.lo < 1e-6, 'perfect line, no spread');
  assert.match(forecastLine(f, 'bpm'), /Forecast for the next check \(in about 1 day\): 66 bpm/);
  assert.equal(forecastNext(line.slice(0, 3)), null);
  assert.equal(f.method, 'line');
  const flat = forecastNext(steady);
  assert.equal(flat.method, 'mean', 'guard: the average is used when a line has not predicted earlier values better');
  assert.match(forecastLine(flat, 'bpm'), /from the average of the last 6 good values \(a straight line has not predicted/);
  const few = forecastNext(steady.slice(0, 4));
  assert.equal(few.method, 'mean'); assert.match(forecastLine(few, 'bpm'), /too few values yet to trust a trend line/);
  const gap = forecastNext([60, 61, 62, 63, 64].map((v, i) => ({ t: i * D, v, q: 'high' })).concat([{ t: 400 * D, v: 65, q: 'high' }, { t: 800 * D, v: 66, q: 'high' }]));
  assert.ok(gap && Number.isFinite(gap.value));
  const { baselineReadiness, readinessLine } = await import('../js/overview.js');
  assert.deepEqual(baselineReadiness(steady.slice(0, 3)), { n: 3, need: 8, ready: false });
  assert.match(readinessLine(baselineReadiness(steady.slice(0, 7))), /7 of 8 good quality values.*1 more check and/);
  assert.equal(readinessLine(baselineReadiness(steady)), '');
  const sim = simulateDetection({ runs: 400 });
  assert.ok(sim.ewma.signalPct > sim.run3.signalPct, 'catches a 1.5 SD step more often than 3 in a row');
  const none = simulateDetection({ runs: 400, shift: 0 });
  assert.ok(none.ewma.signalPct < 20, 'false alarms stay modest');
  const sess = shifted.map((p, i) => ({ id: `s${i}`, kind: i ? 'followup' : 'baseline', createdAt: new Date(p.t + Date.UTC(2026, 10, 1)).toISOString(), pulse: { bpm: p.v, quality: 'high' }, resp: { rpm: 15, quality: 'high' }, dental: {} }));
  const tr = trendsForPacket(sess, { original: { ...sess[0], pulse: { bpm: 71 } }, floors: { pulse: 10, resp: 3 } });
  assert.ok(tr.some((x) => x.kind === 'early_warning' && x.measure === 'Pulse'), 'packet carries the early warning when no band rule fires');
});

test('early warning against the recent normal, and the monitoring simulation quoted in the evidence card (v2.5)', async () => {
  const fs = await import('node:fs');
  const { ewmaChart, ewmaLine, simulateMonitoring, simulateDetection, EWMA, EWMA_V21 } = await import('../js/overview.js');
  const D = 86400000;
  const mk = (a) => a.map((v, i) => ({ t: i * D, v, q: 'high' }));
  const low = [70, 72, 71, 69, 70, 71, 72, 70, 71, 70, 69, 71], high = low.map((v) => v + 10);
  // A lasting step up: the warning fires at the step, then clears once the new level is the recent normal.
  const atStep = ewmaChart(mk(low.concat(high.slice(0, 3))));
  assert.equal(atStep.signal, true); assert.equal(atStep.side, 'above'); assert.equal(atStep.baseN, 9);
  assert.match(ewmaLine(atStep, 'bpm'), /^Early warning: the smoothed trend of your latest checks sits above your own recent normal \(70\.7 bpm\)/);
  const settled = ewmaChart(mk(low.concat(high, high, high)));
  assert.equal(settled.signal, false, 'the new level has become the recent normal');
  assert.ok(Math.abs(settled.mu - 80.5) < 0.1); assert.equal(settled.baseN, 28); assert.ok(settled.firstSignalAt === 12 * D);
  assert.match(ewmaLine(settled, 'bpm'), /^Early warning: none\. Your latest checks stay within what your own recent spread explains \(recent normal 80\.5 bpm\)\.$/);
  // The rule used up to v2.4 keeps the first 8 values for ever, so the same person stays in warning.
  assert.equal(ewmaChart(mk(low.concat(high, high, high)), EWMA_V21).signal, true);
  assert.equal(ewmaChart(mk([5, 5, 5, 5, 5, 5, 5, 5, 6])), null, 'no spread in the recent normal: no verdict');
  assert.deepEqual([EWMA.L, EWMA.CAP, EWMA.HOLD, EWMA.BASE_N], [3.2, 28, 5, 8]);

  const daily = simulateMonitoring({});
  assert.deepEqual(daily.ewma, { falsePerYear: 0.97, peopleWithFalsePct: 63, caughtPct: 96, medianDelayDays: 3 });
  assert.equal(daily.run3.caughtPct, 36);
  assert.equal(simulateMonitoring({ sensorSd: 5 }).ewma.caughtPct, 42);
  assert.equal(simulateMonitoring({ sensorSd: 15 }).ewma.caughtPct, 6);
  const d3 = simulateMonitoring({ everyDays: 3 }).ewma, d7 = simulateMonitoring({ everyDays: 7 }).ewma;
  assert.deepEqual([d3.falsePerYear, d3.caughtPct, d7.falsePerYear, d7.caughtPct], [0.37, 26, 0.21, 6]);
  const old = simulateMonitoring({ rule: EWMA_V21 }), noisy = simulateMonitoring({ sensorSd: 5, rule: EWMA_V21 });
  assert.equal(old.ewma.falsePerYear, 5.93, 'the older rule cried wolf about six times as often');
  assert.deepEqual([old.ewma.caughtPct, noisy.ewma.caughtPct], [89, 45]);
  assert.deepEqual([noisy.run3.falsePerYear, noisy.run3.peopleWithFalsePct], [10.2, 82], 'the 3 in a row rule against one baseline checkup is fragile with a noisy sensor');
  assert.equal(simulateMonitoring({ seasonBpm: 2 }).ewma.falsePerYear, 1.02, 'a seasonal swing barely moves the revised rule');
  assert.equal(simulateMonitoring({ seasonBpm: 2, rule: EWMA_V21 }).ewma.falsePerYear, 8.26);
  const none = simulateDetection({ shift: 0 }), step = simulateDetection({}), drift = simulateDetection({ shift: 0, drift: 0.25 });
  assert.deepEqual([none.ewma.signalPct, none.run3.signalPct, step.ewma.signalPct, step.run3.signalPct, drift.ewma.signalPct, drift.run3.signalPct], [6.8, 9.3, 54.6, 32.9, 68.7, 39.1]);
  const card = fs.readFileSync(new URL('../js/evidence.js', import.meta.url), 'utf8');
  for (const quoted of ['0.97 times per person (63% of people', '0.37 times, weekly 0.21 times', 'gave 5.93 on the same test', 'caught in 96% of cases', '42% at 5 bpm and 6% at 15 bpm', 'every 3 days 26%, weekly 6%', 'fired in 6.8% of series', '54.6% against 32.9%', '68.7% against 39.1%']) assert.ok(card.includes(quoted), `evidence card quotes: ${quoted}`);
  const carte = fs.readFileSync(new URL('../js/evidence-fr.js', import.meta.url), 'utf8');
  for (const quoted of ['0,97 fois par personne (63 %', '0,37 fois; chaque semaine, 0,21 fois', 'donnait 5,93', '96 % des cas', '42 % à 5 bpm et 6 % à 15 bpm', '26 %; chaque semaine, 6 %', '6,8 % des séries', '54,6 % des séries contre 32,9 %', '68,7 % contre 39,1 %']) assert.ok(carte.includes(quoted), `carte: ${quoted}`);
});

test('illness early warning: fever, symptoms and own physiology combined (v2.8)', async () => {
  const fs = await import('node:fs');
  const { illnessWatch, illnessLine, ILLNESS } = await import('../js/overview.js');
  const { buildPacket, packetText, packetSms, decodeSms, SMS_LEGEND } = await import('../js/packet.js');
  const { standouts } = await import('../js/review.js');
  const { frText } = await import('../js/i18n-fr.js');
  const D = 86400000;
  const mk = (i, bpm, x = {}) => ({ id: `s${i}`, kind: i ? 'followup' : 'baseline', createdAt: new Date(Date.UTC(2026, 9, 1) + i * D).toISOString(), pulse: { bpm, quality: 'high' }, resp: { rpm: 14, quality: 'high' }, dental: {}, context: { checklist: x.sym || [] }, devices: x.dev });
  const base = [64, 66, 65, 63, 64, 65, 66, 64, 65, 63, 64, 66, 65, 64].map((v, i) => mk(i, v));
  assert.equal(illnessWatch([]), null);
  assert.equal(illnessWatch(base).level, 'none');
  assert.equal(illnessWatch([...base, mk(14, 65, { sym: ['headache'] })]).level, 'watch', 'symptoms alone: watch');
  assert.equal(illnessWatch([...base, mk(14, 65, { sym: ['back'] })]).level, 'none', 'back pain is not an illness symptom here');
  const up = illnessWatch([...base, mk(14, 80), mk(15, 82)]);
  assert.equal(up.level, 'watch'); assert.deepEqual(up.signals, ['pulse (camera) above your recent normal']);
  const both = illnessWatch([...base, mk(14, 80), mk(15, 82, { sym: ['congestion'] })]);
  assert.equal(both.level, 'possible'); assert.deepEqual(both.symptomWords, ['stuffy nose']);
  assert.equal(illnessWatch([...base, mk(14, 65, { dev: { tempC: 38.0 } })]).level, 'possible', '38.0 C is a fever (CDC)');
  assert.equal(illnessWatch([...base, mk(14, 65, { dev: { tempC: 37.9 } })]).level, 'none');
  assert.equal(ILLNESS.FEVER_C, 38);
  const early = illnessWatch(base.slice(0, 4));
  assert.equal(early.ready, false); assert.match(illnessLine(early), /needs 9 good checkups to know your normal; you have 4/);
  assert.match(illnessLine(both), /^Possible illness signs: symptoms: stuffy nose; pulse \(camera\) above your recent normal\. Rest, recheck within 12 hours/);
  assert.match(illnessLine(both), /not a diagnosis\.$/);
  // Into the packet, the short message and the reviewer's reading order.
  const sess = { ...base.at(-1), id: 'x', createdAt: '2026-10-17T12:00:00.000Z', context: { checklist: ['congestion'] } };
  const { packet } = buildPacket(sess, { original: null, recent: [] }, { illness: both });
  assert.equal(packet.illness_watch.level, 'possible'); assert.deepEqual(packet.illness_watch.symptoms, ['stuffy nose']); assert.match(packet.illness_watch.rule, /^MODELED/);
  assert.equal(buildPacket(sess, { original: null, recent: [] }, { illness: illnessWatch(base) }).packet.illness_watch, null, 'no warning, no field');
  assert.match(packetText(packet), /Illness early warning: possible illness signs \(stuffy nose; pulse \(camera\) above your recent normal\), modeled, not a diagnosis/);
  const sms = packetSms(packet); assert.match(sms, /\| ILL P/); assert.ok(sms.length <= 160);
  assert.ok(decodeSms(sms).lines.includes('Illness early warning: possible illness signs (modeled, not a diagnosis).'));
  assert.match(SMS_LEGEND, /ILL illness early warning P possible W watch/);
  assert.ok(standouts({ ...packet, dental: [] }).some((x) => x.level === 'change' && /^Possible illness signs \(modeled\)/.test(x.text)));
  for (const en of [illnessLine(both), illnessLine(up), illnessLine(early), illnessLine(illnessWatch(base)), packetText(packet).split('\n').find((l) => /^Illness early warning/.test(l)),
    standouts({ ...packet, dental: [] }).find((x) => /^Possible illness/.test(x.text)).text, 'Illness early warning: possible illness signs (modeled, not a diagnosis).', 'How this works and how often it is wrong']) {
    const fr = frText(en); assert.ok(fr && fr !== en && !/stuffy|above your|Rest,|symptoms:/.test(fr), `French for: ${en} -> ${fr}`);
  }
  const card = fs.readFileSync(new URL('../js/evidence.js', import.meta.url), 'utf8');
  for (const q of ['30,529 people', '54 tested positive', 'area under the curve of 0.80', '0.71 for symptoms alone', '38 °C (100.4 °F)']) assert.ok(card.includes(q), q);
});

test('validation kit: sample size, missed checks, and the numbers quoted in VALIDATION_PROTOCOL.md (v2.8)', async () => {
  const fs = await import('node:fs');
  const { loaPrecision, pairsNeeded } = await import('../js/change.js');
  const { simulateMonitoring } = await import('../js/overview.js');
  assert.equal(pairsNeeded(4.5, 2), 59); assert.equal(pairsNeeded(4.5, 1), 234);
  assert.equal(loaPrecision(100, 1), 0.3, 'Bland: 100 pairs give about +/- 0.34 s');
  assert.equal(loaPrecision(1, 4), null); assert.equal(pairsNeeded(0, 2), null);
  assert.ok(loaPrecision(pairsNeeded(4.5, 2), 4.5) <= 2);
  const full = simulateMonitoring({}), miss = simulateMonitoring({ missPct: 30 }), both = simulateMonitoring({ sensorSd: 5, missPct: 30 });
  assert.deepEqual([full.ewma.caughtPct, full.ewma.falsePerYear], [96, 0.97], 'missPct 0 leaves the v2.5 numbers unchanged');
  assert.deepEqual([miss.ewma.caughtPct, both.ewma.caughtPct], [78, 23]);
  const doc = fs.readFileSync(new URL('../VALIDATION_PROTOCOL.md', import.meta.url), 'utf8');
  for (const q of ['no claim of northern validation', 'about 59 pairs', 'about 234', '96% of cases, 78% if 30% of checks are missed, and 23%', 'machine translation for Inuktitut']) assert.ok(doc.includes(q), q);
});

test('mission day labels and return to baseline after landing (v2.10)', async () => {
  const { missionLabel, returnToBaseline, returnLine, lineChart } = await import('../js/overview.js');
  const { frText } = await import('../js/i18n-fr.js');
  const t = (iso) => +new Date(`${iso}T09:00:00`), mc = { start: '2026-10-10', length: 3 };
  assert.deepEqual(['2026-10-07', '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13', '2026-10-25'].map((d) => missionLabel(t(d), mc)), ['L-3', 'L-1', 'FD1', 'FD3', 'R+0', 'R+12']);
  assert.equal(missionLabel(t('2026-10-10'), null), ''); assert.equal(missionLabel(t('2026-10-10'), { start: 'x', length: 3 }), '');
  const pts = [['2026-09-20', 64], ['2026-09-27', 66], ['2026-10-03', 65], ['2026-10-08', 63], ['2026-10-13', 80], ['2026-10-15', 74], ['2026-10-20', 66], ['2026-10-24', 65]].map(([d, v]) => ({ t: t(d), v, q: 'high' }));
  assert.equal(returnToBaseline(pts.slice(0, 4), mc), null, 'no check after landing yet');
  assert.equal(returnToBaseline(pts.slice(2), mc), null, 'needs 3 pre-flight checks');
  const r0 = returnToBaseline(pts.slice(0, 5), mc), r1 = returnToBaseline(pts.slice(0, 7), mc), r2 = returnToBaseline(pts, mc);
  assert.deepEqual([r0.back, r0.insideNow, r0.latestDay], [false, false, 'R+0']);
  assert.deepEqual([r1.back, r1.insideNow], [false, true], 'one check inside is not yet back');
  assert.deepEqual([r2.back, r2.backAt, r2.latestDay], [true, 'R+7', 'R+11']);
  assert.equal(returnToBaseline(pts.map((p, i) => (i < 3 ? { ...p, q: 'low' } : p)), mc), null, 'low quality pre-flight checks do not count');
  assert.match(returnLine(r0, 'bpm'), /^Since landing \(R\+0\): still outside your pre-flight range \(latest 80 bpm; range 60 to 69 bpm, from 4 pre-flight checks\)\. For context/);
  assert.match(returnLine(r2, 'bpm'), /back inside your pre-flight range since R\+7/);
  for (const r of [r0, r1, r2]) { const en = returnLine(r, 'bpm'), fr = frText(en); assert.ok(fr && fr !== en && /Depuis l’atterrissage/.test(fr), `French for ${en}`); }
  const svg = lineChart(pts, { unit: 'bpm', dayLabel: (x) => missionLabel(x, mc) });
  assert.match(svg, />9\/20 L-20</); assert.match(svg, />10\/24 R\+11</);
});

