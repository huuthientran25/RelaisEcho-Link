// Automatic dental photo comparison against the baseline. EXPERIMENTAL, no diagnosis.
// Both photos were already levelled and scaled by the mouth corners at capture, so the same
// pixel roughly shows the same place. Inside the mouth outline, pixels are sorted into
// "tooth-like" (light, low colour) and "gum-like" (reddish), and their average colour is
// compared in CIELAB, where a* is red-green and b* is yellow-blue.
// Colour depends heavily on light, so a lighting check comes first: if overall brightness
// differs too much, the colour comparison is withheld rather than guessed.

export const DENTAL_CMP = {
  maxLightingDeltaL: 8,      // MODELED: mean lightness difference (L*, 0 to 100) beyond which colours are not compared
  minToothFrac: 0.03,        // need at least 3% tooth-like pixels in the mouth region
  minGumFrac: 0.01,
  toothYellowFlag: 4,        // MODELED: change in tooth b* worth a look
  toothLightFlag: 6,         // MODELED: change in tooth L*
  gumRedFlag: 5,             // MODELED: change in gum a*
  areaFlagPct: 25,           // MODELED: relative change in visible tooth area (often just lip position)
  changeDeltaE: 15,          // MODELED: per pixel colour difference shown on the change map
};

// sRGB (0 to 255) to CIELAB, D65.
export function rgbToLab(r, g, b) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export const classify = ([L, a, b]) => {
  if (L >= 55 && Math.hypot(a, b) <= 30 && a < 14) return 'tooth';
  if (a >= 18 && L >= 25 && L <= 75) return 'gum';
  return 'other';
};

// Point in polygon (pts in 0 to 1 coordinates).
function inside(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Region mask: inside the lip outline if known, else a central ellipse around the mouth.
export function mouthMask(w, h, lips) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w, v = (y + 0.5) / h;
      const ok = lips && lips.length >= 6 ? inside(u, v, lips) : ((u - 0.5) / 0.31) ** 2 + ((v - 0.5) / 0.16) ** 2 <= 1;
      m[y * w + x] = ok ? 1 : 0;
    }
  }
  return m;
}

// data: RGBA Uint8ClampedArray of size w*h*4.
export function analyzeMouth(data, w, h, mask) {
  const acc = { n: 0, L: 0, tooth: { n: 0, L: 0, a: 0, b: 0 }, gum: { n: 0, L: 0, a: 0, b: 0 } };
  const lab = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const p = rgbToLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    lab[i * 3] = p[0]; lab[i * 3 + 1] = p[1]; lab[i * 3 + 2] = p[2];
    if (!mask[i]) continue;
    acc.n += 1; acc.L += p[0];
    const k = classify(p);
    if (k !== 'other') { const t = acc[k]; t.n += 1; t.L += p[0]; t.a += p[1]; t.b += p[2]; }
  }
  const avg = (t) => (t.n ? { frac: t.n / Math.max(1, acc.n), L: t.L / t.n, a: t.a / t.n, b: t.b / t.n } : { frac: 0, L: null, a: null, b: null });
  return { n: acc.n, meanL: acc.n ? acc.L / acc.n : null, tooth: avg(acc.tooth), gum: avg(acc.gum), lab };
}

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

export function compareMouth(today, base, cfg = DENTAL_CMP) {
  const out = { comparable: true, notes: [], lightingDelta: r1(today.meanL - base.meanL), flags: [] };
  if (Math.abs(today.meanL - base.meanL) > cfg.maxLightingDeltaL) {
    out.comparable = false;
    out.notes.push(`Lighting differs from the baseline (brightness ${today.meanL > base.meanL ? 'higher' : 'lower'} by ${Math.abs(out.lightingDelta)}), so colours are not compared. Retake in the same light.`);
  }
  if (today.tooth.frac < cfg.minToothFrac || base.tooth.frac < cfg.minToothFrac) {
    out.comparable = false;
    out.notes.push('Too few teeth visible in one of the photos to compare colour.');
  }
  const t = today.tooth, b = base.tooth;
  out.toothAreaChangePct = b.frac ? Math.round(((t.frac - b.frac) / b.frac) * 100) : null;
  if (out.toothAreaChangePct != null && Math.abs(out.toothAreaChangePct) >= cfg.areaFlagPct) {
    out.notes.push(`Visible tooth area ${out.toothAreaChangePct > 0 ? 'larger' : 'smaller'} by ${Math.abs(out.toothAreaChangePct)}%. Often this is just how wide the lips were opened.`);
  }
  if (out.comparable) {
    out.toothYellowDelta = r1(t.b - b.b);
    out.toothLightDelta = r1(t.L - b.L);
    if (Math.abs(out.toothYellowDelta) >= cfg.toothYellowFlag) out.flags.push(`Teeth look ${out.toothYellowDelta > 0 ? 'more yellow' : 'less yellow'} than at baseline (b* ${out.toothYellowDelta > 0 ? '+' : ''}${out.toothYellowDelta}).`);
    if (Math.abs(out.toothLightDelta) >= cfg.toothLightFlag) out.flags.push(`Teeth look ${out.toothLightDelta > 0 ? 'lighter' : 'darker'} than at baseline (L* ${out.toothLightDelta > 0 ? '+' : ''}${out.toothLightDelta}).`);
    if (today.gum.frac >= cfg.minGumFrac && base.gum.frac >= cfg.minGumFrac) {
      out.gumRedDelta = r1(today.gum.a - base.gum.a);
      if (Math.abs(out.gumRedDelta) >= cfg.gumRedFlag) out.flags.push(`Gums look ${out.gumRedDelta > 0 ? 'redder' : 'less red'} than at baseline (a* ${out.gumRedDelta > 0 ? '+' : ''}${out.gumRedDelta}).`);
    } else out.notes.push('Too little gum visible to compare gum colour.');
  }
  return out;
}

// Change map: share of mouth pixels whose colour moved more than changeDeltaE, and the mask to draw.
export function changeMap(labA, labB, mask, cfg = DENTAL_CMP) {
  const n = mask.length;
  const map = new Uint8Array(n);
  let changed = 0, total = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    total += 1;
    const d = Math.hypot(labA[i * 3] - labB[i * 3], labA[i * 3 + 1] - labB[i * 3 + 1], labA[i * 3 + 2] - labB[i * 3 + 2]);
    if (d > cfg.changeDeltaE) { map[i] = 1; changed += 1; }
  }
  return { map, changedPct: total ? Math.round((1000 * changed) / total) / 10 : 0 };
}
