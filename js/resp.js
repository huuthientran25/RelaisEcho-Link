// Breathing rate from vertical movement of the upper torso.
// Each frame gives a row profile (mean brightness of each row in a box under the chin).
// Breathing lifts the shoulders and chest, which shifts horizontal edges up and down,
// so we track the frame to frame vertical shift of that profile.

import { CONFIG } from './config.js';
import { mean, std, resampleUniform, bandpass, powerSpectrum, spectralPeak, risingZeroCrossings } from './dsp.js';

function normalize(p) {
  const m = mean(p), s = std(p) || 1;
  return Float64Array.from(p, (v) => (v - m) / s);
}

// Vertical shift (in rows, sub row precision) that best maps profile a onto profile b.
export function profileShift(a, b, maxLag = CONFIG.resp.maxLagRows) {
  const na = normalize(a), nb = normalize(b);
  const n = na.length;
  const scores = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let s = 0, c = 0;
    for (let i = maxLag; i < n - maxLag; i++) { s += na[i] * nb[i + lag]; c++; }
    scores.push(c ? s / c : -Infinity);
  }
  let k = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[k]) k = i;
  // Integer lag from correlation, then sub row refinement by 1D gradient matching
  // (b(x) = a(x - s); linearize around the current estimate and iterate).
  let s = k - maxLag;
  const interp = (arr, x) => {
    const i = Math.floor(x), f = x - i;
    if (i < 0 || i + 1 >= arr.length) return NaN;
    return arr[i] * (1 - f) + arr[i + 1] * f;
  };
  for (let iter = 0; iter < 4; iter++) {
    let num = 0, den = 0;
    for (let i = maxLag + 1; i < n - maxLag - 1; i++) {
      const bs = interp(nb, i + s);
      if (!Number.isFinite(bs)) continue;
      const grad = (na[i + 1] - na[i - 1]) / 2;
      num += (bs - na[i]) * grad;
      den += grad * grad;
    }
    if (den <= 0) break;
    const r = Math.max(-0.5, Math.min(0.5, -num / den));
    s += r;
    if (Math.abs(r) < 0.01) break;
  }
  return { shift: s, score: scores[k] };
}

// Stateful tracker: feed one profile per frame, get cumulative vertical position.
export class TorsoTracker {
  constructor() { this.prev = null; this.y = 0; }
  reset() { this.prev = null; this.y = 0; }
  push(profile) {
    if (this.prev && this.prev.length === profile.length) {
      const { shift, score } = profileShift(this.prev, profile);
      if (score > 0.5) this.y += shift; // ignore frames where the scene changed too much
    }
    this.prev = profile;
    return this.y;
  }
}

// samples: [{ t (ms), y (rows), ok }]
export function estimateResp(samples, cfg = CONFIG.resp) {
  const res = { rpm: null, quality: 'none', reason: '', snrDb: null, countRpm: null, seconds: 0, signal: null };
  const ok = samples.filter((s) => s.ok && Number.isFinite(s.y));
  if (ok.length < 10) { res.reason = 'This channel was not tracked.'; return res; }
  const seconds = (ok[ok.length - 1].t - ok[0].t) / 1000;
  res.seconds = seconds;
  if (seconds < cfg.minSeconds) { res.reason = `Only ${Math.round(seconds)} usable seconds; need ${cfg.minSeconds}.`; return res; }
  const { v } = resampleUniform(ok.map((s) => s.t), ok.map((s) => s.y), cfg.fs);
  const f = bandpass(v, cfg.fs, cfg.loHz, cfg.hiHz);
  const spec = powerSpectrum(f, cfg.fs, 2048);
  const { freq, snrDb } = spectralPeak(spec, cfg.loHz, cfg.hiHz, 0.03, false);
  res.snrDb = snrDb;
  res.signal = f;
  res.countRpm = (risingZeroCrossings(f) / seconds) * 60;
  if (!Number.isFinite(freq) || snrDb < cfg.minSnrDb) { res.reason = 'Breathing movement too small or irregular to measure.'; res.quality = 'none'; return res; }
  // A peak stuck at the edge of the allowed band is usually slow drift or noise, not breathing.
  const edge = cfg.edgeMarginBpm ?? 1.5;
  if (freq * 60 <= cfg.loHz * 60 + edge || freq * 60 >= cfg.hiHz * 60 - edge) {
    res.reason = 'Strongest movement sat at the edge of the breathing range, so it was ignored as drift or noise.';
    res.quality = 'none';
    return res;
  }
  res.rpm = Math.round(freq * 60);
  const disagree = Math.abs(res.countRpm - freq * 60);
  if (snrDb >= 3 && disagree <= cfg.maxCountDisagreement / 2 && seconds >= 28) res.quality = 'high';
  else if (disagree <= cfg.maxCountDisagreement) res.quality = 'medium';
  else { res.quality = 'low'; res.reason = 'Spectral and cycle count estimates disagree; treat as unreliable.'; }
  return res;
}

// Several independent channels (neck band, upper torso, head bob, head tilt). Each is analysed on
// its own; the one with the best quality and signal to noise wins, and the others are reported so
// agreement or disagreement stays visible. channels: { name: samples[] }
const RANK = { high: 3, medium: 2, low: 1, none: 0 };
export function estimateRespMulti(channels, cfg = CONFIG.resp) {
  const all = Object.entries(channels).map(([name, samples]) => ({ name, ...estimateResp(samples, cfg) }));
  const summary = all.map((c) => ({
    name: c.name, rpm: c.rpm, quality: c.quality,
    snrDb: c.snrDb == null ? null : Math.round(c.snrDb * 10) / 10, seconds: Math.round(c.seconds),
  }));
  if (!all.length) return { rpm: null, quality: 'none', reason: 'No breathing channel was recorded.', snrDb: null, countRpm: null, seconds: 0, channel: null, channels: [], agreeing: 0 };
  const sorted = [...all].sort((a, b) => RANK[b.quality] - RANK[a.quality] || (b.snrDb ?? -99) - (a.snrDb ?? -99) || b.seconds - a.seconds);
  const best = sorted[0];
  const res = { ...best, channel: best.rpm != null ? best.name : null, channels: summary, agreeing: 0 };
  delete res.name;
  delete res.signal;
  if (best.rpm == null) {
    const tracked = all.some((c) => c.seconds > 0);
    res.reason = tracked
      ? 'Breathing movement too small or irregular to measure on any channel.'
      : 'No breathing channel was tracked. Sit back a little so your neck and shoulders are in view.';
    return res;
  }
  res.agreeing = sorted.slice(1).filter((c) => c.rpm != null && c.quality !== 'none' && Math.abs(c.rpm - best.rpm) <= 2).length;
  return res;
}
