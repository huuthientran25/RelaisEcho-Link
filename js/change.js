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
  if (abs < floor) return { kind: 'noise', diff: d, text: `Within measurement noise (±${floor}).` };
  return { kind: d > 0 ? 'up' : 'down', diff: d, text: `${d > 0 ? 'Higher' : 'Lower'} by ${Math.round(abs)}, more than the ±${floor} measurement noise. Worth a recheck at a similar time of day.` };
}
