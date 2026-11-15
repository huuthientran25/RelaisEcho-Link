// Alertness check: a brief psychomotor vigilance test (PVT) in the style of the 3 minute PVT-B used with astronauts.
// EXPERIMENTAL. Browser and screen latency add an unknown delay (often tens of ms), so results are only
// compared with earlier tests on the same device, never with published norms.

export const PVT_CONFIG = {
  durationSec: 180,      // PVT-B length (Basner, Mollicone and Dinges 2011, Acta Astronautica)
  isiMinMs: 1000,        // random wait between stimuli, PVT-B uses 1 to 4 s
  isiMaxMs: 4000,
  lapseMs: 355,          // PVT-B lapse threshold
  falseStartMs: 100,     // responses faster than this are anticipations
  timeoutMs: 10000,      // no response by then: counted as a lapse and the test moves on
  feedbackMs: 800,       // reaction time shown after each response
  changePct: 10,         // MODELED: median change smaller than this is called "similar"
};

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// trials: [{ rt: ms or null for timeout, early: true for a press with no stimulus }]
export function summarizePvt(trials, cfg = PVT_CONFIG) {
  const stim = trials.filter((t) => !t.early);
  const falseStarts = trials.filter((t) => t.early).length + stim.filter((t) => t.rt != null && t.rt < cfg.falseStartMs).length;
  const valid = stim.filter((t) => t.rt != null && t.rt >= cfg.falseStartMs).map((t) => t.rt);
  const timeouts = stim.filter((t) => t.rt == null).length;
  const lapses = valid.filter((rt) => rt >= cfg.lapseMs).length + timeouts;
  const sorted = [...valid].sort((a, b) => a - b);
  const k = Math.max(1, Math.round(sorted.length * 0.1));
  const meanSpeed = valid.length ? valid.reduce((s, rt) => s + 1000 / rt, 0) / valid.length : null;
  return {
    stimuli: stim.length,
    valid: valid.length,
    medianMs: valid.length ? Math.round(median(valid)) : null,
    meanSpeed: meanSpeed == null ? null : Math.round(meanSpeed * 100) / 100,  // responses per second, higher is faster
    fastest10Ms: sorted.length ? Math.round(sorted.slice(0, k).reduce((s, v) => s + v, 0) / k) : null,
    slowest10Ms: sorted.length ? Math.round(sorted.slice(-k).reduce((s, v) => s + v, 0) / k) : null,
    lapses,
    falseStarts,
    timeouts,
    errors: lapses + falseStarts,   // PVT-B performance score counts both (Basner 2011)
  };
}

// Compare with the user's own first full length test on this device.
export function comparePvt(now, ref, cfg = PVT_CONFIG) {
  if (!now || !ref || now.medianMs == null || ref.medianMs == null) return null;
  const pct = ((now.medianMs - ref.medianMs) / ref.medianMs) * 100;
  const verdict = Math.abs(pct) < cfg.changePct ? 'similar' : pct > 0 ? 'slower' : 'faster';
  return { pct: Math.round(pct), verdict, lapseDiff: now.lapses - ref.lapses };
}

export const randomIsi = (cfg = PVT_CONFIG, rnd = Math.random) => cfg.isiMinMs + rnd() * (cfg.isiMaxMs - cfg.isiMinMs);
