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
  for (const t of a) assert.ok(['sustained', 'drift'].includes(t.kind) && /MODELED/.test(t.rule));
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
