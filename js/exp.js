// Experimental camera checks: jaw opening, eye following, pupil light response, inner eyelid colour,
// neck (thyroid area) swallow photos, hand steadiness, and pulse timing plus colour ratio.
// EXPERIMENTAL. None of these is validated. Each result is compared only with the same person's first
// result of the same check on the same kind of device. No result is a diagnosis, and the blood
// pressure and oxygen items are unitless indexes, never mmHg or %.
// Pure functions only (unit tested in tests/exp.test.mjs); the screens are in js/expui.js.

import { mean, std, median, quantile, resampleUniform, bandpass, powerSpectrum, spectralPeak } from './dsp.js';
import { pos } from './pulse.js';

export const EXP = {
  irisMm: 11.7,                       // typical adult visible iris width (published devices give about 11.8 to 12.4 mm)
  jaw: { minFrames: 30, bandMm: 5, devBandMm: 3 },
  gaze: { freqHz: 0.25, pursuitSec: 20, holdSec: 5, warmupSec: 2, fs: 30, maxLagMs: 600, corrBand: 0.15, lagBandMs: 120, minCorr: 0.3 },
  pupil: { darkSec: 3, lightSec: 2, afterSec: 3, minContrast: 0.08, minResponsePct: 3, bandPct: 10, asymBandPct: 15 },
  pallor: { bandEi: 3 },
  neck: { seconds: 12, minPitchFrac: 0.5 },
  tremor: { seconds: 15, loHz: 3, hiHz: 12, minFps: 20, camFs: 30, motionFs: 60, freqBandHz: 1.5, shareBand: 0.15 },
  circ: { seconds: 30, fs: 30, windowSec: 10, stepSec: 2, lagMinMs: -150, lagMaxMs: 300, minCorr: 0.5, minSnrDb: -1, maxBpmGap: 6, pttBandMs: 25, rorBandPct: 10 },
};

// The menu. bp and spo2 come from one capture (circ): the face and an open palm side by side.
export const CHECKS = [
  { id: 'jaw', title: 'Jaw opening', time: 'about 30 seconds', line: 'Open and close your mouth wide three times. Measures lip opening in mm and whether the chin swings to one side.' },
  { id: 'gaze', title: 'Eye following', time: 'about 30 seconds', line: 'Follow a moving dot with your eyes only, then hold still on it. Measures how closely and how late the eyes follow.' },
  { id: 'pupil', title: 'Pupil light response', time: 'about 10 seconds', line: 'The screen goes dark, flashes white, then dark again. Measures how much the pupils narrow, and left against right.' },
  { id: 'pallor', title: 'Inner eyelid colour', time: 'about 20 seconds', line: 'Pull down one lower eyelid and look up. Measures how red the inner eyelid is compared with the white of the eye.' },
  { id: 'neck', title: 'Neck check (thyroid area)', time: 'about 20 seconds', line: 'Tip your head back and swallow a sip of water. Saves matched neck photos before and during the swallow for a reviewer.' },
  { id: 'tremor', title: 'Hand steadiness', time: 'about 40 seconds', line: 'Hold your arm out, one hand at a time. Measures the speed and share of any rhythmic shake, with the phone motion sensor or the camera.' },
  { id: 'circ', title: 'Pulse timing and colour ratio', time: 'about 40 seconds', line: 'Hold an open palm beside your cheek. Gives a blood pressure related timing index and an oxygen related colour index, each only against your own first check.' },
];
export const checkTitle = (id) => (CHECKS.find((c) => c.id === id) || { title: id }).title;

const P = (lm, i, W, H) => ({ x: lm[i].x * W, y: lm[i].y * H });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);

/* ---------- scale from the iris ---------- */
// MediaPipe Face Landmarker (478 points): 468 to 472 and 473 to 477 are the two irises (centre first,
// then four points on the edge). Each group is matched to the eye whose corners it sits between.
const EYES = { right: { outer: 33, inner: 133 }, left: { inner: 362, outer: 263 } };
export function irisInfo(lm, W, H) {
  if (!lm || lm.length < 478) return null;
  const groups = [468, 473].map((c) => {
    const ctr = P(lm, c, W, H);
    const h = dist(P(lm, c + 1, W, H), P(lm, c + 3, W, H)), v = dist(P(lm, c + 2, W, H), P(lm, c + 4, W, H));
    return { cx: ctr.x, cy: ctr.y, r: (h || v) / 2, hPx: h, vPx: v };
  });
  const mid = (e) => { const a = P(lm, e.outer, W, H), b = P(lm, e.inner, W, H); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  const mR = mid(EYES.right);
  const gd = (g) => Math.hypot(g.cx - mR.x, g.cy - mR.y);
  const firstIsRight = gd(groups[0]) <= gd(groups[1]);
  const right = firstIsRight ? groups[0] : groups[1], left = firstIsRight ? groups[1] : groups[0];
  const widths = [right.hPx, left.hPx].filter((x) => x > 2);
  const pxPerMm = widths.length ? mean(widths) / EXP.irisMm : null;
  return { right, left, pxPerMm };
}

/* ---------- jaw ---------- */
// Inner lip gap (13 to 14) in mm, and the chin's sideways distance from the face midline (forehead top 10
// through the bridge of the nose 168) in mm. Positive is toward image right.
export function jawFrame(lm, W, H) {
  const iris = irisInfo(lm, W, H);
  if (!iris || !iris.pxPerMm) return null;
  const gap = dist(P(lm, 13, W, H), P(lm, 14, W, H));
  const a = P(lm, 10, W, H), b = P(lm, 168, W, H), c = P(lm, 152, W, H);
  const len = dist(a, b);
  if (!(len > 1)) return null;
  const side = ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / len;
  return { gapMm: gap / iris.pxPerMm, chinMm: -side / iris.pxPerMm };
}

export function summarizeJaw(frames, cfg = EXP.jaw) {
  const f = frames.filter((x) => x && Number.isFinite(x.gapMm));
  if (f.length < cfg.minFrames) return { ok: false, reason: 'Face not tracked long enough. Keep your whole face in the frame.' };
  const gaps = f.map((x) => x.gapMm);
  const maxOpen = quantile(gaps, 0.97);
  if (!(maxOpen > 8)) return { ok: false, reason: 'The mouth did not open far enough to measure. Open as wide as is comfortable.' };
  // Levels between the closed gap (5th percentile) and the widest opening, so lips that never fully touch still count.
  const minGap = quantile(gaps, 0.05), lvl = (k) => minGap + k * (maxOpen - minGap);
  let openings = 0, armed = true;
  for (const g of gaps) {
    if (armed && g > lvl(0.6)) { openings += 1; armed = false; } else if (!armed && g < lvl(0.3)) armed = true;
  }
  const closed = f.filter((x) => x.gapMm < lvl(0.25)).map((x) => x.chinMm);
  const open = f.filter((x) => x.gapMm > lvl(0.8)).map((x) => x.chinMm);
  const deviation = closed.length >= 3 && open.length >= 3 ? median(open) - median(closed) : null;
  return { ok: true, maxOpenMm: r1(maxOpen), deviationMm: r1(deviation), openings, frames: f.length,
    quality: openings >= 2 ? 'ok' : 'low', reason: openings >= 2 ? '' : 'Fewer than two openings were seen; repeat for a steadier result.' };
}

/* ---------- eye following ---------- */
// Where each iris sits along its eye, 0 at one corner and 1 at the other, both measured left to right in
// the image so the two eyes agree. Averaged. Moves when the eyes turn; head shifts mostly cancel.
export function eyePosition(lm, W = 1, H = 1) {
  const iris = irisInfo(lm, W, H);
  if (!iris) return null;
  const along = (c, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; return d2 > 0 ? ((c.x - a.x) * dx + (c.y - a.y) * dy) / d2 : null; };
  const rt = along({ x: iris.right.cx, y: iris.right.cy }, P(lm, EYES.right.outer, W, H), P(lm, EYES.right.inner, W, H));
  const lt = along({ x: iris.left.cx, y: iris.left.cy }, P(lm, EYES.left.inner, W, H), P(lm, EYES.left.outer, W, H));
  if (rt == null || lt == null) return null;
  return (rt + lt) / 2;
}

// Dot position on screen at time s (seconds from start), as a fraction of the travel, -1 to 1.
export const gazeTarget = (s, cfg = EXP.gaze) => (s < cfg.pursuitSec ? Math.sin(2 * Math.PI * cfg.freqHz * s) : 0);

function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

// samples: [{ t (ms from start), eye (eyePosition or null) }]. Looking toward the person's own right
// moves the irises toward image left, so the eye signal is compared with the target sign flipped.
export function summarizeGaze(samples, cfg = EXP.gaze) {
  const pur = samples.filter((s) => s.eye != null && s.t >= cfg.warmupSec * 1000 && s.t < cfg.pursuitSec * 1000);
  if (pur.length < cfg.fs * 6) return { ok: false, reason: 'Eyes not tracked long enough. Keep your face in the frame and your head still.' };
  const { v: eye } = resampleUniform(pur.map((s) => s.t), pur.map((s) => -s.eye), cfg.fs);
  const t0 = pur[0].t;
  const tgt = Float64Array.from(eye, (_, i) => gazeTarget((t0 + (i * 1000) / cfg.fs) / 1000, cfg));
  const maxLag = Math.round((cfg.maxLagMs / 1000) * cfg.fs);
  const scores = [];
  for (let L = 0; L <= maxLag; L++) scores.push(corr(tgt.subarray(0, tgt.length - L), eye.subarray(L)));
  let k = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[k]) k = i;
  let lagS = k;
  if (k > 0 && k < scores.length - 1) {
    const a = scores[k - 1], b = scores[k], c = scores[k + 1], den = a - 2 * b + c;
    if (den < 0) lagS = k + (0.5 * (a - c)) / den;
  }
  const best = scores[k];
  const e = eye.subarray(k), tt = tgt.subarray(0, tgt.length - k);
  // Least squares eye = slope * target + c; the slope is the eye travel in eye widths per unit of dot travel.
  const mt = mean(tt), me = mean(e);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < e.length; i++) { sxy += (tt[i] - mt) * (e[i] - me); sxx += (tt[i] - mt) ** 2; }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const resid = Float64Array.from(e, (x, i) => x - (me + slope * (tt[i] - mt)));
  // Catch up jumps: frames whose eye speed is far above the typical speed, at least 150 ms apart.
  const vel = []; for (let i = 1; i < eye.length; i++) vel.push(Math.abs(eye[i] - eye[i - 1]) * cfg.fs);
  const vmed = median(vel) || 1e-6;
  let jumps = 0, last = -1e9;
  for (let i = 0; i < vel.length; i++) if (vel[i] > Math.max(5 * vmed, 4 * Math.abs(slope) * 2 * Math.PI * cfg.freqHz) && i - last > 0.15 * cfg.fs) { jumps += 1; last = i; }
  const hold = samples.filter((s) => s.eye != null && s.t >= cfg.pursuitSec * 1000 + 500);
  const holdJitter = hold.length >= 10 && Math.abs(slope) > 1e-4 ? std(hold.map((s) => s.eye)) / Math.abs(slope) : null;
  const pursuitSec = (pur[pur.length - 1].t - pur[0].t) / 1000;
  const ok = best >= cfg.minCorr;
  return { ok, followCorr: r2(best), lagMs: Math.round((lagS * 1000) / cfg.fs), eyeTravel: r3(Math.abs(slope)), smoothnessPct: Math.round(100 * (1 - Math.min(1, std(resid) / (std(e) || 1)))),
    jumpsPer10s: r1((10 * jumps) / Math.max(1, pursuitSec)), holdJitterPct: holdJitter == null ? null : r1(100 * holdJitter), frames: pur.length,
    reason: ok ? '' : 'The eyes did not follow the dot clearly. Keep your head still, the screen at arm\'s length, and look only at the dot.' };
}

/* ---------- pupil ---------- */
function otsu(values) {
  const hist = new Array(256).fill(0);
  for (const v of values) hist[Math.max(0, Math.min(255, Math.round(v)))] += 1;
  const n = values.length;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = n - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thr = i; }
  }
  return thr;
}

// data: RGBA pixels of a crop; the iris circle is (cx, cy, r) in crop pixels. The pupil is the dark
// region connected to the darkest spot near the centre (so lashes at the edge are not counted). Corneal
// glints from the screen sit on the pupil, so very bright pixels near the centre count as pupil.
// Returns ratio = pupil width / iris width, and the brightness contrast between pupil and iris.
export function pupilFromCrop(data, w, h, cx, cy, r) {
  if (!(r >= 4)) return null;
  const L = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  const inside = [], vals = [];
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= 0.85 * r) { inside.push(y * w + x); if (L[y * w + x] < 235) vals.push(L[y * w + x]); }
    }
  }
  if (vals.length < 20) return null;
  const thr = otsu(vals);
  const dark = new Uint8Array(w * h);
  for (const i of inside) { const d = Math.hypot((i % w) - cx, Math.floor(i / w) - cy); dark[i] = L[i] <= thr || (L[i] >= 235 && d <= 0.5 * r) ? 1 : 0; }
  let seed = -1, seedL = Infinity;
  for (const i of inside) { const d = Math.hypot((i % w) - cx, Math.floor(i / w) - cy); if (d <= 0.35 * r && dark[i] && L[i] < seedL) { seedL = L[i]; seed = i; } }
  if (seed < 0) return { ratio: null, contrast: 0 };
  const seen = new Uint8Array(w * h), stack = [seed]; seen[seed] = 1;
  let area = 0, sumDark = 0, nDark = 0;
  while (stack.length) {
    const i = stack.pop(); area += 1;
    if (L[i] < 235) { sumDark += L[i]; nDark += 1; }
    const x = i % w, y = (i - x) / w;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!seen[j] && dark[j]) { seen[j] = 1; stack.push(j); }
    }
  }
  let sumIris = 0, nIris = 0;
  for (const i of inside) if (!seen[i] && L[i] < 235) { sumIris += L[i]; nIris += 1; }
  const contrast = nDark && nIris ? (sumIris / nIris - sumDark / nDark) / 255 : 0;
  let disk = 0;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x - cx, y - cy) <= r) disk += 1;
  return { ratio: Math.sqrt(area / disk), contrast };
}

// samples: [{ t (ms from start), right: {ratio, contrast} | null, left: ... }]; the flash starts at
// darkSec and lasts lightSec.
export function summarizePupil(samples, cfg = EXP.pupil) {
  const on = cfg.darkSec * 1000, off = on + cfg.lightSec * 1000;
  const eye = (side) => {
    const s = samples.filter((x) => x[side] && Number.isFinite(x[side].ratio));
    const base = s.filter((x) => x.t >= on - 1500 && x.t < on).map((x) => x[side].ratio);
    const resp = s.filter((x) => x.t >= on && x.t < off + 1000).map((x) => x[side].ratio);
    const contrast = median(s.map((x) => x[side].contrast));
    if (base.length < 5 || resp.length < 5) return { ok: false, contrast };
    const b = median(base), m = quantile(resp, 0.1);
    const pct = b > 0 ? (100 * (b - m)) / b : 0;
    const half = b - 0.5 * (b - m);
    const hit = s.find((x) => x.t >= on && x[side].ratio <= half);
    return { ok: true, base: b, constrictionPct: pct, latencyMs: hit ? Math.round(hit.t - on) : null, contrast, frames: s.length };
  };
  const R = eye('right'), Lf = eye('left');
  const contrasts = [R.contrast, Lf.contrast].filter(Number.isFinite);
  if (contrasts.length && Math.max(...contrasts) < cfg.minContrast) return { ok: false, reason: 'The pupils and the coloured part of the eyes looked too alike to separate. This is common with dark irises in visible light; a phone or webcam cannot see the pupil the way an infrared pupillometer does.' };
  if (!R.ok && !Lf.ok) return { ok: false, reason: 'The eyes were not tracked during the flash. Keep your face close to the camera and your eyes open.' };
  const out = (e) => (e.ok ? { constrictionPct: r1(e.constrictionPct), latencyMs: e.latencyMs, restRatio: r3(e.base) } : null);
  const asym = R.ok && Lf.ok ? (100 * Math.abs(R.base - Lf.base)) / ((R.base + Lf.base) / 2) : null;
  const best = Math.max(R.ok ? R.constrictionPct : -1, Lf.ok ? Lf.constrictionPct : -1);
  const ok = best >= cfg.minResponsePct;
  return { ok, right: out(R), left: out(Lf), asymmetryPct: r1(asym),
    reason: ok ? '' : 'No clear narrowing was seen. The room may be too bright, or the camera changed its exposure during the flash. Try in a dimmer room with the screen at full brightness.' };
}

/* ---------- inner eyelid colour ---------- */
// Erythema (redness) index 100 x log10(R / G), as used for conjunctiva photos (Collings et al. 2016).
// Here it is taken relative to the white of the same eye in the same photo, as a rough white balance.
export const rednessIndex = (rgb) => (rgb && rgb.r > 0 && rgb.g > 0 ? 100 * Math.log10(rgb.r / rgb.g) : null);
export function patchMean(data, w, h, box) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(h, Math.ceil(box.y + box.h)); y++) {
    for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(w, Math.ceil(box.x + box.w)); x++) {
      const i = (y * w + x) * 4, R = data[i], G = data[i + 1], B = data[i + 2];
      if (R >= 250 || G >= 250 || B >= 250 || R + G + B < 60) continue;
      r += R; g += G; b += B; n += 1;
    }
  }
  return n ? { r: r / n, g: g / n, b: b / n, n } : null;
}
// Boxes in full frame pixels for one eye: the inner lower lid strip and the white beside the iris.
export function eyelidBoxes(lm, W, H, side) {
  const iris = irisInfo(lm, W, H);
  if (!iris) return null;
  const e = EYES[side], ir = iris[side];
  const a = P(lm, e.outer, W, H), b = P(lm, e.inner, W, H), lid = P(lm, side === 'right' ? 145 : 374, W, H);
  const ew = dist(a, b);
  if (!(ew > 8)) return null;
  const conj = { x: lid.x - 0.3 * ew, y: lid.y + 0.04 * ew, w: 0.6 * ew, h: 0.2 * ew };
  const towardOuter = Math.sign(a.x - ir.cx) || 1;
  const sx0 = ir.cx + towardOuter * 1.15 * ir.r, sx1 = a.x - towardOuter * 0.08 * ew;
  const sclera = { x: Math.min(sx0, sx1), y: ir.cy - 0.3 * ir.r, w: Math.max(2, Math.abs(sx1 - sx0)), h: 0.6 * ir.r };
  return { conj, sclera, eyeWidth: ew };
}
export function pallorResult(conj, sclera) {
  const ci = rednessIndex(conj), si = rednessIndex(sclera);
  if (ci == null || si == null) return { ok: false, reason: 'The inner eyelid or the white of the eye was not visible. Pull the lid down a little further and look up.' };
  return { ok: true, eyelidEi: r1(ci), whiteEi: r1(si), relEi: r1(ci - si) };
}

/* ---------- neck ---------- */
// Mean absolute change between two grey frames (same size), 0 to 255.
export function motionEnergy(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return 0;
  let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}
export function grayOf(data, w, h, box, step = 2) {
  const out = [];
  for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(h, Math.floor(box.y + box.h)); y += step) {
    for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(w, Math.floor(box.x + box.w)); x += step) {
      const i = (y * w + x) * 4; out.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
  }
  return Float64Array.from(out);
}
// Swallows: bursts of neck motion well above the quiet level, at least 1.5 s apart.
export function swallowEvents(series, minGapMs = 1500) {
  const e = series.map((s) => s.e);
  if (e.length < 10) return [];
  const med = median(e), mad = median(e.map((x) => Math.abs(x - med))) || 0.1;
  const thr = Math.max(med + 5 * mad, med + 1.5);
  const events = [];
  for (let i = 1; i < series.length - 1; i++) {
    const s = series[i];
    if (s.e > thr && s.e >= series[i - 1].e && s.e >= series[i + 1].e && (!events.length || s.t - events[events.length - 1].t >= minGapMs)) events.push({ t: s.t, e: s.e });
  }
  return events;
}

/* ---------- hand steadiness ---------- */
// Horizontal and vertical shift of a box between frames, from column and row brightness profiles.
export function columnProfile(data, w, h, box, cols = 64) {
  const x0 = Math.max(0, Math.floor(box.x)), x1 = Math.min(w, Math.floor(box.x + box.w));
  const y0 = Math.max(0, Math.floor(box.y)), y1 = Math.min(h, Math.floor(box.y + box.h));
  if (x1 - x0 < 12 || y1 - y0 < 12) return null;
  const raw = new Float64Array(x1 - x0);
  const step = Math.max(1, Math.floor((y1 - y0) / 60));
  for (let x = x0; x < x1; x++) { let s = 0, c = 0; for (let y = y0; y < y1; y += step) { const i = (y * w + x) * 4; s += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; c += 1; } raw[x - x0] = s / c; }
  const out = new Float64Array(cols), n = raw.length;
  for (let k = 0; k < cols; k++) { const p = (k * (n - 1)) / (cols - 1), i = Math.floor(p), f = p - i; out[k] = raw[i] * (1 - f) + raw[Math.min(n - 1, i + 1)] * f; }
  return out;
}

// channels: arrays of values sampled at times (ms). Power spectra are summed over channels (as in
// consumer accelerometer tremor studies). Returns the peak frequency in 3 to 12 Hz, the share of
// 1 Hz to (Nyquist - 1) power that sits in 3 to 12 Hz, and the RMS of the 3 to 12 Hz band.
export function tremorSpectrum(times, channels, fs, cfg = EXP.tremor) {
  if (!times || times.length < fs * 4) return { ok: false, reason: 'Recording too short.' };
  const dur = (times[times.length - 1] - times[0]) / 1000;
  const realFs = (times.length - 1) / Math.max(dur, 1e-6);
  if (realFs < cfg.minFps) return { ok: false, reason: `Only ${Math.round(realFs)} samples per second arrived; at least ${cfg.minFps} are needed to see a 3 to 12 Hz shake.` };
  const hiAll = Math.min(15, fs / 2 - 1);
  let spec = null, rmsSq = 0;
  for (const ch of channels) {
    const { v } = resampleUniform(times, ch, fs);
    const m = mean(v);
    const x = Float64Array.from(v, (y) => y - m);
    const wide = bandpass(x, fs, 1, hiAll);
    const band = bandpass(x, fs, cfg.loHz, Math.min(cfg.hiHz, hiAll));
    rmsSq += mean(Array.from(band, (y) => y * y));
    const s = powerSpectrum(wide, fs, 4096);
    if (!spec) spec = { freqs: s.freqs, power: Float64Array.from(s.power) };
    else for (let i = 0; i < spec.power.length; i++) spec.power[i] += s.power[i];
  }
  let tot = 0, inBand = 0, pk = -1, pkF = null;
  for (let i = 0; i < spec.freqs.length; i++) {
    const f = spec.freqs[i];
    if (f < 1 || f > hiAll) continue;
    tot += spec.power[i];
    if (f >= cfg.loHz && f <= cfg.hiHz) { inBand += spec.power[i]; if (spec.power[i] > pk) { pk = spec.power[i]; pkF = f; } }
  }
  return { ok: true, peakHz: r1(pkF), share: tot > 0 ? r2(inBand / tot) : 0, rms: Math.sqrt(rmsSq), fsReal: Math.round(realFs) };
}

/* ---------- pulse timing and colour ratio ---------- */
// Normalized cross correlation of b against a for lags lo..hi samples (b later = positive lag).
export function bestLag(a, b, lo, hi) {
  let best = -2, k = 0;
  const scores = [];
  for (let L = lo; L <= hi; L++) {
    const n = a.length - Math.abs(L);
    if (n < 10) { scores.push(-2); continue; }
    const xa = L >= 0 ? a.subarray(0, n) : a.subarray(-L, -L + n);
    const xb = L >= 0 ? b.subarray(L, L + n) : b.subarray(0, n);
    const c = corr(xa, xb);
    scores.push(c);
    if (c > best) { best = c; k = L; }
  }
  const i = k - lo;
  let frac = 0;
  if (i > 0 && i < scores.length - 1) { const p = scores[i - 1], q = scores[i], s = scores[i + 1], den = p - 2 * q + s; if (den < 0) frac = (0.5 * (p - s)) / den; }
  return { lag: k + frac, corr: best };
}

// Ratio of ratios: (pulse size / mean) in red over the same in blue. Pulse oximeters use red and infrared;
// an ordinary camera has neither a narrow red nor any infrared channel, so this is only a colour index.
export function ratioOfRatios(r, b, fs, lo = 0.7, hi = 3.0) {
  const ar = std(bandpass(Float64Array.from(r), fs, lo, hi)), ab = std(bandpass(Float64Array.from(b), fs, lo, hi));
  const dr = mean(r), db = mean(b);
  return ab > 0 && dr > 0 && db > 0 ? (ar / dr) / (ab / db) : null;
}

// samples: [{ t (ms), face: {r,g,b}, palm: {r,g,b}, ok }]. Positive timing = the palm pulse arrives later.
export function summarizeCirc(samples, cfg = EXP.circ) {
  const good = samples.filter((s) => s.ok && s.face && s.palm && s.face.r > 0 && s.palm.r > 0);
  if (good.length < cfg.fs * cfg.windowSec) return { ok: false, reason: 'Not enough steady frames with both the face and the palm in place.' };
  const t = good.map((s) => s.t);
  const ch = (k, c) => resampleUniform(t, good.map((s) => s[k][c]), cfg.fs).v;
  const F = { r: ch('face', 'r'), g: ch('face', 'g'), b: ch('face', 'b') }, Pm = { r: ch('palm', 'r'), g: ch('palm', 'g'), b: ch('palm', 'b') };
  const fs = cfg.fs, n = Math.min(F.r.length, Pm.r.length);
  const pf = bandpass(pos(F.r, F.g, F.b, fs), fs, 0.7, 3.0), pp = bandpass(pos(Pm.r, Pm.g, Pm.b, fs), fs, 0.7, 3.0);
  const W = cfg.windowSec * fs, S = cfg.stepSec * fs;
  const lo = Math.floor((cfg.lagMinMs / 1000) * fs), hi = Math.ceil((cfg.lagMaxMs / 1000) * fs);
  const lags = [], rorF = [], rorP = [], bpms = [];
  let total = 0;
  for (let s0 = 0; s0 + W <= n; s0 += S) {
    total += 1;
    const a = pf.subarray(s0, s0 + W), b = pp.subarray(s0, s0 + W);
    const sa = spectralPeak(powerSpectrum(a, fs, 2048), 0.7, 3.0, 0.1, true), sb = spectralPeak(powerSpectrum(b, fs, 2048), 0.7, 3.0, 0.1, true);
    if (!(sa.snrDb >= cfg.minSnrDb && sb.snrDb >= cfg.minSnrDb) || Math.abs(sa.freq - sb.freq) * 60 > cfg.maxBpmGap) continue;
    const L = bestLag(a, b, lo, hi);
    if (L.corr < cfg.minCorr) continue;
    lags.push((L.lag * 1000) / fs);
    bpms.push(sa.freq * 60);
    const rf = ratioOfRatios(F.r.subarray(s0, s0 + W), F.b.subarray(s0, s0 + W), fs), rp = ratioOfRatios(Pm.r.subarray(s0, s0 + W), Pm.b.subarray(s0, s0 + W), fs);
    if (rf != null) rorF.push(rf);
    if (rp != null) rorP.push(rp);
  }
  if (!lags.length) return { ok: false, windows: `0 of ${total}`, reason: 'The face and palm pulses did not line up in any 10 second window. Hold the palm flat and still, at cheek height, in steady light.' };
  return { ok: true, pttMs: Math.round(median(lags)), pttSpreadMs: Math.round(quantile(lags, 0.75) - quantile(lags, 0.25)), bpm: Math.round(median(bpms)),
    rorFace: r3(rorF.length ? median(rorF) : null), rorPalm: r3(rorP.length ? median(rorP) : null), windows: `${lags.length} of ${total}`,
    quality: lags.length / total >= 0.5 ? 'ok' : 'low', reason: lags.length / total >= 0.5 ? '' : 'Fewer than half the windows lined up; read this result loosely.' };
}

/* ---------- comparison with the person's own first check ---------- */
// Bands are MODELED design choices, not published limits. A value outside the band is "different from
// your first check", never "abnormal".
export const METRICS = {
  jaw: [{ key: 'maxOpenMm', label: 'Mouth opening (lips)', unit: 'mm', band: EXP.jaw.bandMm }, { key: 'deviationMm', label: 'Chin swing when open', unit: 'mm', band: EXP.jaw.devBandMm }],
  gaze: [{ key: 'followCorr', label: 'How closely the eyes followed (0 to 1)', unit: '', band: EXP.gaze.corrBand }, { key: 'lagMs', label: 'Eye delay behind the dot', unit: 'ms', band: EXP.gaze.lagBandMs }],
  pupil: [{ key: 'right.constrictionPct', label: 'Right pupil narrowing', unit: '%', band: EXP.pupil.bandPct }, { key: 'left.constrictionPct', label: 'Left pupil narrowing', unit: '%', band: EXP.pupil.bandPct }, { key: 'asymmetryPct', label: 'Right against left size difference', unit: '%', band: EXP.pupil.asymBandPct }],
  pallor: [{ key: 'relEi', label: 'Inner eyelid redness against the white of the eye', unit: 'index', band: EXP.pallor.bandEi }],
  neck: [{ key: 'swallows', label: 'Swallows seen', unit: '', band: null }],
  tremor: [{ key: 'right.peakHz', label: 'Right hand shake speed', unit: 'Hz', band: EXP.tremor.freqBandHz }, { key: 'right.share', label: 'Right hand rhythmic share (0 to 1)', unit: '', band: EXP.tremor.shareBand },
    { key: 'left.peakHz', label: 'Left hand shake speed', unit: 'Hz', band: EXP.tremor.freqBandHz }, { key: 'left.share', label: 'Left hand rhythmic share (0 to 1)', unit: '', band: EXP.tremor.shareBand }],
  circ: [{ key: 'pttMs', label: 'Pulse timing, palm after face (blood pressure index)', unit: 'ms', band: EXP.circ.pttBandMs }, { key: 'rorFace', label: 'Colour pulse ratio, face (oxygen index)', unit: '', bandPct: EXP.circ.rorBandPct }],
};
const getPath = (o, path) => path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);

export function compareExp(check, today, ref) {
  const rows = (METRICS[check] || []).map((m) => {
    const v = getPath(today, m.key), r = ref ? getPath(ref, m.key) : undefined;
    let outside = false, delta = null;
    if (Number.isFinite(v) && Number.isFinite(r)) {
      delta = v - r;
      if (m.band != null) outside = Math.abs(delta) > m.band;
      else if (m.bandPct != null) outside = Math.abs(r) > 0 && Math.abs(delta / r) * 100 > m.bandPct;
    }
    return { key: m.key, label: m.label, unit: m.unit, today: Number.isFinite(v) ? v : null, ref: Number.isFinite(r) ? r : null, delta: delta == null ? null : Math.round(delta * 100) / 100, outside };
  });
  const verdict = !ref ? 'reference' : rows.some((x) => x.outside) ? 'different' : rows.some((x) => x.delta != null) ? 'same' : 'none';
  return { verdict, rows };
}

const fmtV = (v, unit) => (v == null ? '-' : `${v}${unit && unit !== 'index' ? ` ${unit}` : ''}`);
export function compareLines(cmp) {
  return cmp.rows.filter((r) => r.today != null).map((r) => `${r.label}: ${fmtV(r.today, r.unit)}${r.ref != null ? ` (first check ${fmtV(r.ref, r.unit)}${r.outside ? ', different' : ''})` : ''}`);
}

// Packet section: the latest record of each check in the last 14 days, against that check's first record.
// Photos (neck) go in only when includeImages is true.
export function expForPacket(records, { now = new Date(), days = 14, includeImages = false } = {}) {
  const out = [];
  for (const c of CHECKS) {
    const list = records.filter((x) => x.kind === 'exp' && x.exp && x.exp.check === c.id && x.exp.ok).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!list.length) continue;
    const last = list[list.length - 1];
    if (now - new Date(last.createdAt) > days * 86400000) continue;
    const ref = list.length > 1 ? list[0] : null;
    const cmp = compareExp(c.id, last.exp, ref ? ref.exp : null);
    const entry = { check: c.id, title: c.title, date: last.createdAt, first_check: ref ? ref.createdAt : null, verdict: cmp.verdict,
      values: Object.fromEntries(cmp.rows.map((r) => [r.key, r.today])), differs: cmp.rows.filter((r) => r.outside).map((r) => r.label),
      method_note: last.exp.method || '', label: 'EXPERIMENTAL, compared only with this person\'s own first check; not a diagnosis' };
    if (c.id === 'circ') entry.label += '; the timing and colour indexes are not blood pressure or oxygen saturation';
    if (includeImages && last.exp.images) entry.images = last.exp.images;
    out.push(entry);
  }
  return out;
}

export function expCsv(records) {
  const head = ['date_utc', 'check', 'ok', 'metric', 'value', 'first_check_value', 'different_from_first'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [];
  for (const c of CHECKS) {
    const list = records.filter((x) => x.kind === 'exp' && x.exp && x.exp.check === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const ref = list.find((x) => x.exp.ok) || null;
    for (const rec of list) {
      const cmp = compareExp(c.id, rec.exp, ref && ref !== rec ? ref.exp : null);
      if (!rec.exp.ok) { rows.push([rec.createdAt, c.id, 'no', 'reason', rec.exp.reason || '', '', ''].map(q).join(',')); continue; }
      for (const r of cmp.rows) rows.push([rec.createdAt, c.id, 'yes', r.key, r.today, r.ref, r.outside ? 'yes' : ''].map(q).join(','));
    }
  }
  return [head.join(','), ...rows].join('\n') + '\n';
}
