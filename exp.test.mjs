// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Experimental checks: each measurement on synthetic input with a known answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXP, CHECKS, irisInfo, jawFrame, summarizeJaw, eyePosition, gazeTarget, summarizeGaze, pupilFromCrop, summarizePupil,
  rednessIndex, pallorResult, patchMean, eyelidBoxes, motionEnergy, swallowEvents, tremorSpectrum, bestLag, ratioOfRatios, summarizeCirc,
  compareExp, compareLines, expForPacket, expCsv,
} from '../js/exp.js';

const W = 1000, H = 1000;
// A face in normalized coordinates with irises 11.7 mm wide at a chosen scale (px per mm).
function face({ pxPerMm = 4, gapMm = 2, chinMm = 0, irisShift = 0 } = {}) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (i, x, y) => { lm[i] = { x: x / W, y: y / H, z: 0 }; };
  set(10, 500, 300); set(168, 500, 400); set(1, 500, 470);
  set(33, 370, 400); set(133, 490, 400); set(362, 510, 400); set(263, 630, 400); // eyes 30 mm wide at 4 px per mm
  set(145, 430, 410); set(374, 570, 410);
  const r = (EXP.irisMm * pxPerMm) / 2;
  const iris = (c, cx, cy) => { set(c, cx, cy); set(c + 1, cx + r, cy); set(c + 2, cx, cy - r); set(c + 3, cx - r, cy); set(c + 4, cx, cy + r); };
  iris(468, 430 + irisShift, 400); iris(473, 570 + irisShift, 400);
  set(13, 500, 520); set(14, 500, 520 + gapMm * pxPerMm);
  set(152, 500 + chinMm * pxPerMm, 600 + gapMm * pxPerMm);
  return lm;
}

test('the menu lists the seven experimental checks', () => {
  assert.deepEqual(CHECKS.map((c) => c.id), ['jaw', 'gaze', 'pupil', 'pallor', 'neck', 'tremor', 'balance', 'point', 'circ']);
});

test('iris scale: 11.7 mm irises give the pixel scale back', () => {
  const info = irisInfo(face({ pxPerMm: 4 }), W, H);
  assert.ok(Math.abs(info.pxPerMm - 4) < 1e-9);
  assert.ok(info.right.cx < info.left.cx, 'the iris near landmarks 33 and 133 is the right eye');
  assert.equal(irisInfo(Array(468).fill({ x: 0, y: 0 }), W, H), null, 'older 468 point meshes have no iris and are refused');
});

test('jaw: lip gap in mm, opening count and chin swing', () => {
  const fr = jawFrame(face({ gapMm: 40, chinMm: 3 }), W, H);
  assert.ok(Math.abs(fr.gapMm - 40) < 0.01);
  assert.ok(Math.abs(fr.chinMm - 3) < 0.01);
  const frames = [];
  for (let i = 0; i < 300; i++) {
    const open = Math.max(0, Math.sin((2 * Math.PI * i) / 100)); // three openings
    frames.push(jawFrame(face({ gapMm: 2 + 40 * open, chinMm: 4 * open }), W, H));
  }
  const s = summarizeJaw(frames);
  assert.equal(s.ok, true);
  assert.equal(s.openings, 3);
  assert.ok(Math.abs(s.maxOpenMm - 42) < 0.5, `max ${s.maxOpenMm}`);
  assert.ok(Math.abs(s.deviationMm - 4) < 0.6, `deviation ${s.deviationMm}`);
  assert.equal(summarizeJaw(frames.slice(0, 10)).ok, false);
  assert.equal(summarizeJaw(Array.from({ length: 60 }, () => jawFrame(face({ gapMm: 2 }), W, H))).ok, false, 'a closed mouth is refused, not measured as 2 mm');
});

test('eye following: recovers a 200 ms delay and refuses eyes that do not follow', () => {
  const rest = eyePosition(face({ irisShift: 0 }), W, H), moved = eyePosition(face({ irisShift: 6 }), W, H);
  assert.ok(moved > rest, 'iris moving toward image right raises the position');
  const samples = [];
  for (let t = 0; t < 25000; t += 33) {
    const lagged = gazeTarget((t - 200) / 1000);
    samples.push({ t, eye: 0.5 - 0.12 * lagged + 0.002 * Math.sin(t / 37) });
  }
  const s = summarizeGaze(samples);
  assert.equal(s.ok, true);
  assert.ok(s.followCorr > 0.95, `corr ${s.followCorr}`);
  assert.ok(Math.abs(s.lagMs - 200) <= 25, `lag ${s.lagMs}`);
  assert.ok(Math.abs(s.eyeTravel - 0.12) < 0.01, `travel ${s.eyeTravel}`);
  assert.ok(s.holdJitterPct != null && s.holdJitterPct < 5);
  const noise = samples.map((x, i) => ({ t: x.t, eye: 0.5 + 0.05 * Math.sin(i * 1.7) }));
  assert.equal(summarizeGaze(noise).ok, false);
});

function eyeCrop(irisR, pupilR, irisL = 90, pupilL = 20, glint = false) {
  const w = 64, h = 64, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - 32, y - 32), i = (y * w + x) * 4;
    let L = d <= pupilR ? pupilL : d <= irisR ? irisL : 200;
    if (glint && Math.hypot(x - 30, y - 30) <= 1.5) L = 250;
    data[i] = data[i + 1] = data[i + 2] = L; data[i + 3] = 255;
  }
  return { data, w, h };
}

test('pupil: ratio from a drawn eye, glints counted as pupil, low contrast refused', () => {
  const a = eyeCrop(24, 10);
  const p = pupilFromCrop(a.data, a.w, a.h, 32, 32, 24);
  assert.ok(Math.abs(p.ratio - 10 / 24) < 0.03, `ratio ${p.ratio}`);
  assert.ok(p.contrast > 0.2);
  const g = eyeCrop(24, 10, 90, 20, true);
  assert.ok(Math.abs(pupilFromCrop(g.data, g.w, g.h, 32, 32, 24).ratio - 10 / 24) < 0.03, 'a screen reflection does not shrink the pupil');
  // Flash protocol: 3 s dark at ratio 0.5, then narrowing to 0.3.
  const samples = [];
  for (let t = 0; t < 8000; t += 33) {
    const ratio = t < 3000 ? 0.5 : t < 3300 ? 0.5 - (0.2 * (t - 3000)) / 300 : t < 5000 ? 0.3 : 0.3 + Math.min(0.2, (0.2 * (t - 5000)) / 2000);
    samples.push({ t, right: { ratio, contrast: 0.3 }, left: { ratio: ratio * 1.1, contrast: 0.3 } });
  }
  const s = summarizePupil(samples);
  assert.equal(s.ok, true);
  assert.ok(Math.abs(s.right.constrictionPct - 40) < 2, `right ${s.right.constrictionPct}`);
  assert.ok(s.right.latencyMs >= 100 && s.right.latencyMs <= 250, `latency ${s.right.latencyMs}`);
  assert.ok(Math.abs(s.asymmetryPct - 9.5) < 1, `asym ${s.asymmetryPct}`);
  const flat = samples.map((x) => ({ ...x, right: { ratio: 0.5, contrast: 0.02 }, left: { ratio: 0.5, contrast: 0.03 } }));
  const f = summarizePupil(flat);
  assert.equal(f.ok, false);
  assert.match(f.reason, /dark irises/);
});

test('inner eyelid colour: redness relative to the white of the eye', () => {
  assert.ok(Math.abs(rednessIndex({ r: 200, g: 100 }) - 100 * Math.log10(2)) < 1e-9);
  const red = pallorResult({ r: 180, g: 90, b: 90 }, { r: 200, g: 190, b: 185 });
  const pale = pallorResult({ r: 180, g: 140, b: 130 }, { r: 200, g: 190, b: 185 });
  assert.ok(red.ok && pale.ok && red.relEi > pale.relEi + 10);
  assert.equal(pallorResult(null, { r: 1, g: 1 }).ok, false);
  const w = 10, h = 10, data = new Uint8ClampedArray(w * h * 4).fill(120);
  assert.equal(Math.round(patchMean(data, w, h, { x: 0, y: 0, w: 5, h: 5 }).r), 120);
  const boxes = eyelidBoxes(face(), W, H, 'right');
  assert.ok(boxes.conj.y > 410, 'the eyelid box sits below the lower lid');
  assert.ok(boxes.sclera.x >= 370 && boxes.sclera.x + boxes.sclera.w <= 430 - 23.4, 'the white box sits between iris edge and outer corner');
});

test('neck: swallow bursts are found and quiet frames are not', () => {
  assert.equal(motionEnergy(Float64Array.from([1, 2, 3]), Float64Array.from([2, 2, 5])), 1);
  const series = [];
  for (let t = 0; t < 12000; t += 33) series.push({ t, e: 1 + 0.2 * Math.sin(t / 50) + (Math.abs(t - 4000) < 150 || Math.abs(t - 9000) < 150 ? 8 : 0) });
  const ev = swallowEvents(series);
  assert.equal(ev.length, 2);
  assert.ok(Math.abs(ev[0].t - 4000) < 200 && Math.abs(ev[1].t - 9000) < 200);
  assert.equal(swallowEvents(series.map((s) => ({ t: s.t, e: 1 + 0.2 * Math.sin(s.t / 50) }))).length, 0);
});

test('hand steadiness: finds a 6 Hz shake in camera and motion sensor rates, refuses a slow camera', () => {
  for (const fs of [30, 60]) {
    const times = [], x = [], y = [];
    for (let i = 0; i < 15 * fs; i++) { const t = (i * 1000) / fs + (i % 3); times.push(t); x.push(0.8 * Math.sin(2 * Math.PI * 6 * t / 1000) + 0.3 * Math.sin(t / 900)); y.push(0.4 * Math.sin(2 * Math.PI * 6 * t / 1000 + 1)); }
    const s = tremorSpectrum(times, [x, y], fs);
    assert.equal(s.ok, true);
    assert.ok(Math.abs(s.peakHz - 6) <= 0.2, `peak ${s.peakHz} at ${fs}`);
    assert.ok(s.share > 0.8, `share ${s.share}`);
  }
  const slow = Array.from({ length: 150 }, (_, i) => i * 100);
  assert.equal(tremorSpectrum(slow, [slow.map(() => 0)], 30).ok, false);
});

function pulseWave(t, f, delayMs = 0) { const ph = 2 * Math.PI * f * (t - delayMs) / 1000; return Math.sin(ph) + 0.3 * Math.sin(2 * ph); }
test('pulse timing: recovers an 80 ms palm delay at 30 frames per second; colour ratio follows the channel sizes', () => {
  const fs = 30, n = fs * 20;
  const a = new Float64Array(n), b = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = (i * 1000) / fs; a[i] = pulseWave(t, 1.2); b[i] = pulseWave(t, 1.2, 80); }
  const L = bestLag(a, b, -5, 9);
  assert.ok(Math.abs((L.lag * 1000) / fs - 80) < 10, `lag ${(L.lag * 1000) / fs}`);
  const r = Float64Array.from(a, (v) => 100 + 0.5 * v), bl = Float64Array.from(a, (v) => 80 + 0.2 * v);
  assert.ok(Math.abs(ratioOfRatios(r, bl, fs) - (0.5 / 100) / (0.2 / 80)) < 0.05);
  const samples = [];
  for (let i = 0; i < 30 * fs; i++) {
    const t = (i * 1000) / fs + (i % 2);
    const pf = pulseWave(t, 1.2), pp = pulseWave(t, 1.2, 80);
    samples.push({ t, ok: true, face: { r: 150 + 0.3 * pf, g: 110 + 1.0 * pf, b: 90 + 0.4 * pf }, palm: { r: 170 + 0.3 * pp, g: 120 + 1.0 * pp, b: 100 + 0.4 * pp } });
  }
  const s = summarizeCirc(samples);
  assert.equal(s.ok, true, s.reason);
  assert.ok(Math.abs(s.pttMs - 80) <= 15, `ptt ${s.pttMs}`);
  assert.equal(s.bpm, 72);
  assert.ok(s.rorFace > 0);
  assert.equal(summarizeCirc(samples.slice(0, 100)).ok, false);
});

test('comparison: first check is the reference, bands decide "different", never units of mmHg or %', () => {
  const ref = { ok: true, pttMs: 60, rorFace: 1.0 }, same = { ok: true, pttMs: 70, rorFace: 1.05 }, diff = { ok: true, pttMs: 100, rorFace: 1.3 };
  assert.equal(compareExp('circ', ref, null).verdict, 'reference');
  assert.equal(compareExp('circ', same, ref).verdict, 'same');
  const d = compareExp('circ', diff, ref);
  assert.equal(d.verdict, 'different');
  assert.deepEqual(d.rows.map((r) => r.outside), [true, true]);
  const lines = compareLines(d).join(' ');
  assert.doesNotMatch(lines, /mmHg|SpO2|saturation/);
  assert.equal(compareExp('pupil', { ok: true, right: { constrictionPct: 30 }, left: null, asymmetryPct: null }, { ok: true, right: { constrictionPct: 45 } }).rows[0].outside, true);
});

test('packet and CSV: latest check per kind within 14 days, photos only when asked', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const rec = (d, check, exp) => ({ id: d + check, kind: 'exp', createdAt: d, exp: { check, ok: true, ...exp } });
  const records = [
    rec('2026-11-01T10:00:00Z', 'jaw', { maxOpenMm: 45, deviationMm: 0.5 }),
    rec('2026-11-14T10:00:00Z', 'jaw', { maxOpenMm: 35, deviationMm: 1 }),
    rec('2026-10-01T10:00:00Z', 'gaze', { followCorr: 0.9, lagMs: 150 }),
    rec('2026-11-14T11:00:00Z', 'neck', { swallows: 2, images: { before: 'data:image/jpeg;base64,AAAA' } }),
    { id: 'x', kind: 'exp', createdAt: '2026-11-14T12:00:00Z', exp: { check: 'pupil', ok: false, reason: 'too alike' } },
  ];
  const p = expForPacket(records, { now });
  assert.deepEqual(p.map((x) => x.check), ['jaw', 'neck'], 'old gaze and failed pupil checks are left out');
  assert.equal(p[0].verdict, 'different');
  assert.deepEqual(p[0].differs, ['Mouth opening (lips)']);
  assert.equal(p[1].images, undefined);
  assert.ok(expForPacket(records, { now, includeImages: true })[1].images.before);
  const csv = expCsv(records);
  assert.match(csv, /"jaw","yes","maxOpenMm","35","45","yes"/);
  assert.match(csv, /"pupil","no","reason","too alike"/);
});

test('standing balance: sway from the phone motion sensor (v2.6)', async () => {
  const { swayStats, summarizeBalance, compareExp, METRICS, EXP: E } = await import('../js/exp.js');
  const { frText } = await import('../js/i18n-fr.js');
  const { ewmaChart, EWMA: W } = await import('../js/overview.js');
  const fs = 60, n = fs * 30, t = Array.from({ length: n }, (_, i) => (i * 1000) / fs);
  const wave = (amp, f, g = 0) => t.map((x) => g + amp * Math.sin((2 * Math.PI * f * x) / 1000));
  // 0.02 m/s2 at 0.5 Hz on one axis is 0.02 / sqrt(2) / 9.80665 = 1.44 thousandths of g; gravity on z must not count.
  const a = swayStats(t, [wave(0.02, 0.5), wave(0, 1), wave(0, 1, 9.81)]);
  assert.equal(a.ok, true); assert.equal(a.rmsMg, 1.4); assert.equal(a.fsReal, 60);
  const b = swayStats(t, [wave(0.04, 0.5), wave(0, 1), wave(0, 1, 9.81)]);
  assert.equal(b.rmsMg, 2.9, 'twice the movement, twice the sway');
  assert.equal(swayStats(t, [wave(0.02, 0.5), wave(0.05, 20), wave(0, 1, 9.81)]).rmsMg, 1.4, 'a small 20 Hz tremble is outside the sway band');
  assert.equal(swayStats(t.slice(0, 600), [wave(0.02, 0.5).slice(0, 600)]).ok, false, 'a recording that stops early gives no number');
  const slow = Array.from({ length: 300 }, (_, i) => i * 100);
  assert.match(swayStats(slow, [slow.map(() => 0)]).reason, /Only 10 motion readings per second/);
  const res = summarizeBalance(a, b);
  assert.deepEqual([res.ok, res.open.rmsMg, res.closed.rmsMg, res.ratio], [true, 1.4, 2.9, 2.07]);
  const openOnly = summarizeBalance(a, null);
  assert.equal(openOnly.closed, null); assert.equal(openOnly.ratio, null); assert.match(openOnly.note, /skipped/);
  assert.equal(summarizeBalance({ ok: false, reason: 'x' }, b).ok, false);
  assert.equal(E.balance.bandPct, 50);
  const cmp = compareExp('balance', { ok: true, open: { rmsMg: 3 }, closed: { rmsMg: 4 }, ratio: 1.33 }, { ok: true, open: { rmsMg: 1.5 }, closed: { rmsMg: 3 }, ratio: 2 });
  assert.deepEqual(cmp.rows.map((r) => r.outside), [true, false, true]);
  for (const m of METRICS.balance) assert.notEqual(frText(m.label), m.label, `French for ${m.label}`);
  for (const en of ['Standing balance', 'Eyes closed. Stand still until the three beeps.', 'Largest single movement: eyes open 2.1 mg, eyes closed 3.4 mg.  Most people sway more with eyes closed. Compare only with your own earlier checks done the same way: shoes off, same floor, phone in the same place.',
    'Largest single movement: eyes open 2.1 mg. Eyes closed part skipped. Most people sway more with eyes closed. Compare only with your own earlier checks done the same way: shoes off, same floor, phone in the same place.']) assert.notEqual(frText(en), en, `French for ${en}`);
  // Early warning on whole number readings: one changed digit after a flat run is not a signal, a real drop is.
  const D = 86400000, flat = [98, 98, 98, 98, 98, 98, 98, 98, 98, 98].map((v, i) => ({ t: i * D, v, q: 'high' })), P = { ...W, MIN_SD: 0.5 };
  assert.equal(ewmaChart(flat.concat([{ t: 10 * D, v: 97, q: 'high' }]), P).signal, false);
  assert.equal(ewmaChart(flat.concat([{ t: 10 * D, v: 93, q: 'high' }]), P).signal, true);
  assert.equal(ewmaChart(flat.concat([{ t: 10 * D, v: 97, q: 'high' }])), null, 'without the floor a flat run has no spread and gives no verdict');
});

test('touchscreen pointing: plan, placement and summary (v2.7)', async () => {
  const { pointingPlan, placeTarget, summarizePointing, compareExp, METRICS, EXP: E } = await import('../js/exp.js');
  const { frText } = await import('../js/i18n-fr.js');
  const P = pointingPlan(5);
  assert.equal(P.sizes.length, 27); assert.deepEqual(P.sizes.slice(0, 3), [56, 56, 56]);
  assert.equal(P.sizes.slice(3).filter((w) => w === 28).length, 12);
  assert.deepEqual(pointingPlan(5).sizes, P.sizes, 'same seed, same order');
  let prev = null; const pts = [];
  for (const w of P.sizes) { const p = placeTarget(400, 700, w, prev, P.rnd); assert.ok(p.x >= w / 2 && p.x <= 400 - w / 2 && p.y >= w / 2 && p.y <= 700 - w / 2); if (prev) assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) >= E.point.minGapPx); pts.push(p); prev = p; }
  // Big targets: 500 ms, 6 px off (hit). Small: 650 ms, 16 px off (miss: radius 14).
  const tr = P.sizes.map((w, i) => ({ w, d: 200, ms: w === 56 ? 500 : 650, dx: w === 56 ? 6 : 16, dy: 0, practice: i < 3 }));
  const r = summarizePointing(tr);
  assert.deepEqual([r.ok, r.n, r.medianMs, r.missPct, r.big.missPct, r.small.missPct, r.big.medianMs, r.small.medianMs, r.timeouts], [true, 24, 575, 50, 0, 100, 500, 650, 0]);
  // throughput: mean of log2(200/56+1)/0.5 = 4.39 and log2(200/28+1)/0.65 = 4.66
  assert.equal(r.throughput, 4.52);
  assert.equal(summarizePointing(tr.slice(0, 8)).ok, false, 'practice only: no result');
  const slow = summarizePointing(tr.map((t, i) => (i % 2 ? { ...t, ms: null } : t)));
  assert.equal(slow.ok, false); assert.match(slow.reason, /^\d+ of 24 targets were not tapped in time/);
  const few = summarizePointing(tr.map((t, i) => (i === 5 ? { ...t, ms: null } : t)));
  assert.equal(few.ok, true); assert.equal(few.timeouts, 1);
  const cmp = compareExp('point', { ok: true, medianMs: 700, missPct: 20, throughput: 3.5, small: { missPct: 40 } }, { ok: true, medianMs: 550, missPct: 10, throughput: 4.5, small: { missPct: 20 } });
  assert.deepEqual(cmp.rows.map((x) => x.outside), [true, false, true, true]);
  for (const m of METRICS.point) assert.notEqual(frText(m.label), m.label, `French for ${m.label}`);
  for (const en of ['Touchscreen pointing', '3 of 24', 'Practice: tap the yellow circle.', slow.reason,
    'Big targets: 500 ms, 0% missed. Small targets: 650 ms, 100% missed. Not tapped in time: 0. Compare only with your own earlier checks on the same phone, same hand and same posture: screen size and grip change the numbers.']) assert.notEqual(frText(en), en, `French for ${en}`);
});

test('camera oxygen saturation: personal calibration only shown when it beats guessing the average (v2.8)', async () => {
  const { spo2Calibration, spo2Estimate, spo2Line, SPO2_CAL } = await import('../js/exp.js');
  const { frText } = await import('../js/i18n-fr.js');
  const P = (a) => a.map(([ror, spo2]) => ({ ror, spo2 }));
  assert.deepEqual([SPO2_CAL.MIN_PAIRS, SPO2_CAL.SPAN], [5, 4]);
  const few = spo2Calibration(P([[0.6, 97], [0.62, 98]]));
  assert.equal(few.ok, false); assert.match(spo2Line(few), /2 of 5 paired readings so far/);
  // Healthy person at home: readings 97 to 98 only. Must not show a number however good the fit looks.
  const flat = spo2Calibration(P([[0.62, 97], [0.64, 98], [0.61, 97], [0.66, 98], [0.63, 97], [0.65, 98]]));
  assert.equal(flat.ok, false); assert.match(flat.reason, /only span 97% to 98%/); assert.equal(spo2Estimate(flat, 0.63), null);
  // Wide range but the camera carries no information: no better than the average.
  const noise = spo2Calibration(P([[0.70, 98], [0.60, 96], [0.66, 94], [0.61, 92], [0.71, 97], [0.64, 93], [0.69, 95]]));
  assert.equal(noise.ok, false); assert.match(noise.reason, /no better than guessing your average/);
  // Wide range and a real relationship: shown, with its own error, never below 1 point, and a low value says use the oximeter.
  const good = spo2Calibration(P([[0.60, 98], [0.66, 96], [0.72, 94], [0.78, 92], [0.63, 97], [0.75, 93], [0.69, 95]]));
  assert.equal(good.ok, true); assert.ok(good.lineErr < good.meanErr);
  const e = spo2Estimate(good, 0.70);
  assert.deepEqual([e.value, e.err, e.outside], [95, 1, false]);
  assert.match(spo2Line(good, e), /about 95%, give or take 1 points .* Never use it instead of an oximeter: it is not tested below 92%/);
  const low = spo2Estimate(good, 0.95);
  assert.equal(low.outside, true); assert.match(spo2Line(good, low), /outside the range it was calibrated on.*measure now with your oximeter/);
  assert.ok(spo2Estimate(good, 0.2).value <= 100, 'never above 100');
  assert.equal(spo2Calibration(P([[0.6, 120], [0.6, 40]])).n, 0, 'impossible readings are ignored');
  for (const x of [spo2Line(few), spo2Line(flat), spo2Line(noise), spo2Line(good), spo2Line(good, e), spo2Line(good, low)]) {
    const fr = frText(x); assert.ok(fr !== x && !/Never use|paired readings|only span|give or take|no better/.test(fr), `French for ${x} -> ${fr}`);
  }
});

