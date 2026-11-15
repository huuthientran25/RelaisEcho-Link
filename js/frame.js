// Pixel measurements on a downscaled copy of each video frame.
// Raw colour is kept on purpose: no white balance or normalization, because that can remove the pulse.

import { CONFIG } from './config.js';

// Mean R, G, B over pixel boxes, skipping very dark or blown out pixels.
export function roiMeanRGB(img, boxes) {
  const { data, width, height } = img;
  let r = 0, g = 0, b = 0, n = 0, clipped = 0, total = 0, luma = 0;
  for (const bx of boxes) {
    const x0 = Math.max(0, Math.floor(bx.x)), x1 = Math.min(width, Math.ceil(bx.x + bx.w));
    const y0 = Math.max(0, Math.floor(bx.y)), y1 = Math.min(height, Math.ceil(bx.y + bx.h));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        const R = data[i], G = data[i + 1], B = data[i + 2];
        const L = 0.299 * R + 0.587 * G + 0.114 * B;
        total++;
        luma += L;
        if (R >= 250 || G >= 250 || B >= 250) { clipped++; continue; }
        if (L < 25) continue;
        r += R; g += G; b += B; n++;
      }
    }
  }
  return {
    r: n ? r / n : 0, g: n ? g / n : 0, b: n ? b / n : 0, n,
    meanLuma: total ? luma / total : 0,
    clippedFrac: total ? clipped / total : 0,
  };
}

// Mean brightness of each row inside a box, resampled to a fixed number of rows.
export function rowProfile(img, box, rows = CONFIG.resp.profileRows) {
  const { data, width } = img;
  const x0 = Math.max(0, Math.floor(box.x)), x1 = Math.min(width, Math.floor(box.x + box.w));
  const h = Math.floor(box.h);
  if (h < 12 || x1 - x0 < 12) return null;
  const raw = new Float64Array(h);
  const step = Math.max(1, Math.floor((x1 - x0) / 80));
  for (let yy = 0; yy < h; yy++) {
    const y = Math.floor(box.y) + yy;
    let s = 0, c = 0;
    for (let x = x0; x < x1; x += step) {
      const i = (y * width + x) * 4;
      s += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      c++;
    }
    raw[yy] = c ? s / c : 0;
  }
  const out = new Float64Array(rows);
  for (let k = 0; k < rows; k++) {
    const pos = (k * (h - 1)) / (rows - 1);
    const i = Math.floor(pos), f = pos - i;
    out[k] = raw[i] * (1 - f) + raw[Math.min(h - 1, i + 1)] * f;
  }
  return out;
}

// Sharpness as variance of a 4 neighbour Laplacian on luma, plus glare and darkness shares.
export function sharpnessStats(img) {
  const { data, width, height } = img;
  const L = new Float32Array(width * height);
  let glare = 0, sum = 0;
  for (let i = 0, p = 0; p < L.length; i += 4, p++) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    L[p] = v; sum += v;
    if (v >= 250) glare++;
  }
  let m = 0, m2 = 0, n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const lap = L[p - 1] + L[p + 1] + L[p - width] + L[p + width] - 4 * L[p];
      m += lap; m2 += lap * lap; n++;
    }
  }
  const mean = n ? m / n : 0;
  return { sharpness: n ? m2 / n - mean * mean : 0, glareFrac: glare / L.length, meanLuma: sum / L.length };
}
