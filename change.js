// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Is today's value different from the baseline by more than the method's own noise?
// Noise floors are MODELED from published error figures, not from this code's own validation:
// pulse 8 bpm (POS at rest on a light skin dataset: MAE 3.8, RMSE 7.6 bpm, UBFC-Phys),
// breathing 3 per minute (motion based breathing: MAE about 1.3 chest and 2.0 head, IEEE EMBC 2022).
// Replace them with your own bench test error once you have it.
export const NOISE = { pulseBpm: 8, breathsPerMin: 3 };

export function changeVsBaseline(today, base, floor) {
  if (today == null || base == null) return { kind: 'none', text: 'Not comparable: one of the two values is missing.' };
  const d = today - base;
  const abs = Math.abs(d);
  // On the edge of the band still counts as noise: estimates are whole numbers, so a change must clear the band.
  if (abs <= floor) return { kind: 'noise', diff: d, text: `Within measurement noise (±${floor}).` };
  return { kind: d > 0 ? 'up' : 'down', diff: d, text: `${d > 0 ? 'Higher' : 'Lower'} by ${Math.round(abs)}, more than the ±${floor} measurement noise. Worth a recheck at a similar time of day.` };
}

// Your own bench test: error of the app against a reference device, from checkups where a reference was entered.
export function benchError(sessions) {
  const stat = (pairs) => {
    if (!pairs.length) return { n: 0, mae: null, bias: null };
    const err = pairs.map(([est, ref]) => est - ref);
    const mae = err.reduce((s, e) => s + Math.abs(e), 0) / err.length;
    const bias = err.reduce((s, e) => s + e, 0) / err.length;
    return { n: err.length, mae: Math.round(mae * 10) / 10, bias: Math.round(bias * 10) / 10 };
  };
  const p = [], r = [];
  for (const s of sessions) {
    if (!s.reference) continue;
    if (s.pulse?.bpm != null && Number.isFinite(+s.reference.pulseBpm) && s.reference.pulseBpm !== '' && s.reference.pulseBpm != null) p.push([s.pulse.bpm, +s.reference.pulseBpm]);
    if (s.resp?.rpm != null && Number.isFinite(+s.reference.breathsPerMin) && s.reference.breathsPerMin !== '' && s.reference.breathsPerMin != null) r.push([s.resp.rpm, +s.reference.breathsPerMin]);
  }
  return { pulse: stat(p), resp: stat(r) };
}

// Pairs of (app estimate, reference) from the bench test entries, for the agreement plot.
export function benchPairs(sessions, kind) {
  const out = [];
  for (const s of sessions || []) {
    if (!s.reference) continue;
    const est = kind === 'pulse' ? s.pulse?.bpm : s.resp?.rpm;
    const ref = kind === 'pulse' ? s.reference.pulseBpm : s.reference.breathsPerMin;
    if (est != null && ref !== '' && ref != null && Number.isFinite(+ref)) out.push([+est, +ref]);
  }
  return out;
}

// Agreement between the app and a reference device (Bland and Altman, Lancet 1986): the mean difference
// (bias) and the limits of agreement, bias ± 1.96 standard deviations of the differences.
// With few pairs these limits are themselves uncertain; the caller says so.
export function blandAltman(pairs) {
  const n = pairs.length;
  if (n < 2) return { n, bias: null, sd: null, low: null, high: null, points: [] };
  const points = pairs.map(([a, b]) => ({ mean: (a + b) / 2, diff: a - b }));
  const bias = points.reduce((s, p) => s + p.diff, 0) / n;
  const sd = Math.sqrt(points.reduce((s, p) => s + (p.diff - bias) ** 2, 0) / (n - 1));
  const r1 = (x) => Math.round(x * 10) / 10;
  return { n, bias: r1(bias), sd: r1(sd), low: r1(bias - 1.96 * sd), high: r1(bias + 1.96 * sd), points };
}

// Validation study planning (v2.8). The standard error of a 95% limit of agreement is about sqrt(3 s^2 / n), where
// s is the standard deviation of the differences (Bland, "How can I decide the sample size for a study of agreement
// between two methods of measurement?", after Bland and Altman 1986). So the limits are known to within
// +/- 1.96 * sqrt(3 / n) * s, and n = 3 * (1.96 * s / w)^2 pairs pin them to within +/- w. Bland usually recommends
// 100 pairs, which gives about +/- 0.34 s.
export function loaPrecision(n, sd) { return n >= 2 && sd > 0 ? Math.round(1.96 * Math.sqrt(3 / n) * sd * 10) / 10 : null; }
export function pairsNeeded(sd, halfWidth) { return sd > 0 && halfWidth > 0 ? Math.ceil(3 * ((1.96 * sd) / halfWidth) ** 2) : null; }

// Once there are at least 5 reference pairs, the band becomes twice your own mean error (MODELED rule),
// never narrower than 2. Until then the published placeholder is used.
export const MIN_BENCH_PAIRS = 5;
export function noiseFloor(bench, kind) {
  const b = kind === 'pulse' ? bench.pulse : bench.resp;
  const fallback = kind === 'pulse' ? NOISE.pulseBpm : NOISE.breathsPerMin;
  if (!b || b.n < MIN_BENCH_PAIRS || b.mae == null) return { value: fallback, source: 'published figures' };
  return { value: Math.max(2, Math.round(2 * b.mae)), source: `your bench test (${b.n} pairs)` };
}

// Bench test report (v2.2): everything a small comparison study needs on one page, failures included.
// Conditions are the comma separated tags typed or tapped on the results screen ("window light, head movement").
export const BENCH_CONDITIONS = ['window light', 'dim light', 'lamp light', 'head movement', 'glasses', 'darker skin tone', 'lighter skin tone'];
const tagsOf = (s) => String(s || '').toLowerCase().split(/[,;]/).map((x) => x.trim()).filter(Boolean);
export function benchReport(sessions) {
  const withRef = (sessions || []).filter((s) => s.reference && (s.reference.pulseBpm != null && s.reference.pulseBpm !== '' || s.reference.breathsPerMin != null && s.reference.breathsPerMin !== ''));
  const one = (kind) => {
    const refOf = (s) => (kind === 'pulse' ? s.reference.pulseBpm : s.reference.breathsPerMin);
    const estOf = (s) => (kind === 'pulse' ? s.pulse?.bpm : s.resp?.rpm);
    const qOf = (s) => (kind === 'pulse' ? s.pulse?.quality : s.resp?.quality);
    const rows = withRef.filter((s) => refOf(s) !== '' && refOf(s) != null && Number.isFinite(+refOf(s)));
    const ok = rows.filter((s) => estOf(s) != null);
    const pairs = ok.map((s) => [estOf(s), +refOf(s)]);
    const ba = blandAltman(pairs);
    const mae = pairs.length ? Math.round((pairs.reduce((a, [e, r]) => a + Math.abs(e - r), 0) / pairs.length) * 10) / 10 : null;
    const byTag = new Map();
    for (const s of ok) for (const t of tagsOf(s.reference.conditions)) { const a = byTag.get(t) || []; a.push(Math.abs(estOf(s) - +refOf(s))); byTag.set(t, a); }
    const byCondition = [...byTag].map(([condition, errs]) => ({ condition, n: errs.length, mae: Math.round((errs.reduce((a, b) => a + b, 0) / errs.length) * 10) / 10 }))
      .sort((a, b) => b.n - a.n || a.condition.localeCompare(b.condition));
    return { attempts: rows.length, n: pairs.length, failed: rows.length - pairs.length, lowQuality: ok.filter((s) => qOf(s) === 'low').length, mae, ba, byCondition };
  };
  const parts = new Set(withRef.map((s) => String(s.reference.participant || '').trim()).filter(Boolean));
  const devices = [...new Set(withRef.map((s) => String(s.reference.device || '').trim()).filter(Boolean))];
  const dates = withRef.map((s) => s.createdAt).filter(Boolean).sort();
  return { pulse: one('pulse'), resp: one('resp'), participants: parts.size, devices, from: dates[0] || null, to: dates.at(-1) || null, checkups: withRef.length };
}
// Participant codes only, never names: one to three letters then one to three digits (P01, A7, ABC123).
export const isParticipantCode = (v) => v === '' || /^[A-Za-z]{1,3}\d{1,3}$/.test(String(v).trim());
