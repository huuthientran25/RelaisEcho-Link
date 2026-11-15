// Camera pulse estimate with the POS method (plane orthogonal to skin).
// Method: Wang, den Brinker, Stuijk, de Haan, "Algorithmic Principles of Remote PPG",
// IEEE Trans Biomed Eng 2017. Implementation written for this project (Apache 2.0).

import { CONFIG } from './config.js';
import { mean, std, median, quantile, resampleUniform, bandpass, powerSpectrum, spectralPeak } from './dsp.js';

// r, g, b: uniformly sampled channel means. Returns the POS pulse signal.
export function pos(r, g, b, fs) {
  const n = r.length;
  const l = Math.max(2, Math.round(1.6 * fs));
  const h = new Float64Array(n);
  if (n < l) return h;
  const s1 = new Float64Array(l), s2 = new Float64Array(l);
  for (let start = 0; start + l <= n; start++) {
    let mr = 0, mg = 0, mb = 0;
    for (let i = 0; i < l; i++) { mr += r[start + i]; mg += g[start + i]; mb += b[start + i]; }
    mr /= l; mg /= l; mb /= l;
    if (mr <= 0 || mg <= 0 || mb <= 0) continue;
    for (let i = 0; i < l; i++) {
      const cr = r[start + i] / mr, cg = g[start + i] / mg, cb = b[start + i] / mb;
      s1[i] = cg - cb;
      s2[i] = cg + cb - 2 * cr;
    }
    const sd2 = std(s2);
    const alpha = sd2 > 0 ? std(s1) / sd2 : 0;
    let hm = 0;
    const hw = new Float64Array(l);
    for (let i = 0; i < l; i++) { hw[i] = s1[i] + alpha * s2[i]; hm += hw[i]; }
    hm /= l;
    for (let i = 0; i < l; i++) h[start + i] += hw[i] - hm;
  }
  return h;
}

// One window of samples [{t, r, g, b}] -> { bpm, snrDb, signal }
export function estimateWindow(samples, cfg = CONFIG.pulse) {
  const t = samples.map((s) => s.t);
  const { v: r } = resampleUniform(t, samples.map((s) => s.r), cfg.fs);
  const { v: g } = resampleUniform(t, samples.map((s) => s.g), cfg.fs);
  const { v: b } = resampleUniform(t, samples.map((s) => s.b), cfg.fs);
  const h = pos(r, g, b, cfg.fs);
  const f = bandpass(h, cfg.fs, cfg.loHz, cfg.hiHz);
  const spec = powerSpectrum(f, cfg.fs, 2048);
  const { freq, snrDb } = spectralPeak(spec, cfg.loHz, cfg.hiHz, 0.1, true);
  return { bpm: freq * 60, snrDb, signal: f };
}

// Full recording: sliding windows, each kept only if usable and clean enough.
// samples: [{ t (ms), r, g, b, ok (bool) }]
export function estimatePulse(samples, cfg = CONFIG.pulse) {
  const result = { bpm: null, quality: 'none', reason: '', windows: [], accepted: 0, total: 0, snrMedian: null, spreadBpm: null };
  if (samples.length < 10) { result.reason = 'Not enough frames.'; return result; }
  const t0 = samples[0].t, tEnd = samples[samples.length - 1].t;
  const winMs = cfg.windowSec * 1000, stepMs = cfg.stepSec * 1000;
  let lo = 0;
  for (let ws = t0; ws + winMs <= tEnd + 1; ws += stepMs) {
    while (lo < samples.length && samples[lo].t < ws) lo++;
    let hi = lo;
    while (hi < samples.length && samples[hi].t < ws + winMs) hi++;
    const win = samples.slice(lo, hi);
    result.total++;
    const okFrac = win.length ? win.filter((s) => s.ok).length / win.length : 0;
    if (okFrac < cfg.minUsableFracInWindow || win.length < cfg.windowSec * 8) {
      result.windows.push({ start: ws, accepted: false, why: 'capture quality' });
      continue;
    }
    const est = estimateWindow(win.filter((s) => s.ok), cfg);
    const accepted = Number.isFinite(est.bpm) && est.snrDb >= cfg.minWindowSnrDb;
    result.windows.push({ start: ws, accepted, bpm: est.bpm, snrDb: est.snrDb, why: accepted ? '' : 'weak signal' });
  }
  const good = result.windows.filter((w) => w.accepted);
  result.accepted = good.length;
  if (!good.length) {
    result.reason = result.total ? 'No clean 10 second window. Try steadier light and less movement.' : 'Recording shorter than one window.';
    return result;
  }
  const bpms = good.map((w) => w.bpm);
  result.bpm = Math.round(median(bpms));
  result.snrMedian = median(good.map((w) => w.snrDb));
  result.spreadBpm = quantile(bpms, 0.75) - quantile(bpms, 0.25);
  const frac = good.length / result.total;
  if (frac >= 0.7 && result.snrMedian >= 3 && result.spreadBpm <= cfg.maxSpreadBpm / 2) result.quality = 'high';
  else if (frac >= 0.4 && result.spreadBpm <= cfg.maxSpreadBpm) result.quality = 'medium';
  else { result.quality = 'low'; result.reason = 'Window estimates disagree. Treat as unreliable and retake.'; }
  return result;
}

// Short live readout on the most recent window, for the on screen preview only.
export function livePulse(samples, cfg = CONFIG.pulse) {
  if (!samples.length) return null;
  const tEnd = samples[samples.length - 1].t;
  const win = samples.filter((s) => s.t >= tEnd - cfg.windowSec * 1000);
  if (win.length < cfg.windowSec * 8 || tEnd - win[0].t < cfg.windowSec * 900) return null;
  const okFrac = win.filter((s) => s.ok).length / win.length;
  if (okFrac < cfg.minUsableFracInWindow) return null;
  const est = estimateWindow(win.filter((s) => s.ok), cfg);
  return est.snrDb >= cfg.minWindowSnrDb ? est : { ...est, weak: true };
}

export { mean };
