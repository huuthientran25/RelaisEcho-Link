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

// Once there are at least 5 reference pairs, the band becomes twice your own mean error (MODELED rule),
// never narrower than 2. Until then the published placeholder is used.
export const MIN_BENCH_PAIRS = 5;
export function noiseFloor(bench, kind) {
  const b = kind === 'pulse' ? bench.pulse : bench.resp;
  const fallback = kind === 'pulse' ? NOISE.pulseBpm : NOISE.breathsPerMin;
  if (!b || b.n < MIN_BENCH_PAIRS || b.mae == null) return { value: fallback, source: 'published figures' };
  return { value: Math.max(2, Math.round(2 * b.mae)), source: `your bench test (${b.n} pairs)` };
}
