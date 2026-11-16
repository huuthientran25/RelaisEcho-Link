// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Signal processing helpers. Pure functions, no DOM, so they run in Node tests too.
// All filters are written here (no third party DSP code).

export function mean(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return a.length ? s / a.length : 0;
}

export function std(a) {
  const m = mean(a);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2;
  return a.length > 1 ? Math.sqrt(s / (a.length - 1)) : 0;
}

export function median(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(a, q) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// Linear interpolation of irregular samples onto a uniform grid.
// times in ms, returns { t: ms[], v: number[] } at sampling rate fs (Hz).
export function resampleUniform(times, values, fs, tStart = times[0], tEnd = times[times.length - 1]) {
  const step = 1000 / fs;
  const n = Math.max(0, Math.floor((tEnd - tStart) / step) + 1);
  const t = new Array(n), v = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const ti = tStart + i * step;
    t[i] = ti;
    while (j < times.length - 2 && times[j + 1] < ti) j++;
    const t0 = times[j], t1 = times[Math.min(j + 1, times.length - 1)];
    const v0 = values[j], v1 = values[Math.min(j + 1, values.length - 1)];
    const w = t1 > t0 ? Math.min(1, Math.max(0, (ti - t0) / (t1 - t0))) : 0;
    v[i] = v0 + (v1 - v0) * w;
  }
  return { t, v };
}

// RBJ audio cookbook biquads, Q = 1/sqrt(2) (Butterworth).
function biquad(type, f0, fs) {
  const w0 = (2 * Math.PI * f0) / fs;
  const cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  let b0, b1, b2;
  if (type === 'low') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
  else { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function applyBiquad(x, c) {
  const [b0, b1, b2, a1, a2] = c;
  const y = new Float64Array(x.length);
  let x1 = x[0], x2 = x[0], y1 = 0, y2 = 0;
  // Start from steady state on the first sample to limit the edge transient.
  const dc = (b0 + b1 + b2) / (1 + a1 + a2);
  y1 = y2 = x[0] * dc;
  for (let i = 0; i < x.length; i++) {
    const yi = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = yi; y[i] = yi;
  }
  return y;
}

function filtfilt(x, c) {
  const f = applyBiquad(x, c);
  f.reverse();
  const b = applyBiquad(f, c);
  return b.reverse();
}

// Zero phase band pass: high pass at lo, low pass at hi, each run forward and backward.
export function bandpass(x, fs, lo, hi) {
  const m = mean(x);
  let y = Float64Array.from(x, (v) => v - m);
  y = filtfilt(y, biquad('high', lo, fs));
  y = filtfilt(y, biquad('low', hi, fs));
  return y;
}

export function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// In place iterative radix 2 FFT.
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

// Hann windowed power spectrum, zero padded to nfft.
export function powerSpectrum(x, fs, nfft = nextPow2(Math.max(x.length, 1024))) {
  const re = new Float64Array(nfft), im = new Float64Array(nfft);
  const n = x.length;
  for (let i = 0; i < n; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  const half = nfft / 2;
  const freqs = new Float64Array(half), power = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    freqs[k] = (k * fs) / nfft;
    power[k] = re[k] * re[k] + im[k] * im[k];
  }
  return { freqs, power, df: fs / nfft };
}

// Highest peak inside [lo, hi] Hz with parabolic interpolation, plus an SNR in dB:
// power within +-halfWidth of the peak and of its first harmonic, over the rest of the band.
export function spectralPeak(spec, lo, hi, halfWidth = 0.1, includeHarmonic = true) {
  const { freqs, power, df } = spec;
  let kBest = -1, pBest = -Infinity;
  for (let k = 1; k < freqs.length - 1; k++) {
    if (freqs[k] < lo || freqs[k] > hi) continue;
    if (power[k] > pBest) { pBest = power[k]; kBest = k; }
  }
  if (kBest < 0) return { freq: NaN, snrDb: -Infinity };
  const a = power[kBest - 1], b = power[kBest], c = power[kBest + 1];
  const denom = a - 2 * b + c;
  const delta = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  const freq = freqs[kBest] + Math.max(-0.5, Math.min(0.5, delta)) * df;
  let sig = 0, noise = 0;
  for (let k = 0; k < freqs.length; k++) {
    const f = freqs[k];
    if (f < lo || f > hi) continue;
    const inPeak = Math.abs(f - freq) <= halfWidth || (includeHarmonic && Math.abs(f - 2 * freq) <= halfWidth);
    if (inPeak) sig += power[k]; else noise += power[k];
  }
  const snrDb = 10 * Math.log10((sig + 1e-12) / (noise + 1e-12));
  return { freq, snrDb };
}

// Count rising zero crossings of a zero mean signal, as a time domain cross check of rate.
export function risingZeroCrossings(x) {
  let c = 0;
  for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) c++;
  return c;
}
