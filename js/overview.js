// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// One screen overview: a body chart whose regions open a trend graph. Pure functions only; the screen is
// drawn in main.js. A region's status is a reading order ("look here"), never a score or a diagnosis:
// "review" means something there sits outside its band against the person's own first value.

export const METRIC_DEFS = {
  pulse: { label: 'Pulse', unit: 'bpm', src: 'checkup', get: (s) => s.pulse?.bpm, q: (s) => s.pulse?.quality },
  resp: { label: 'Breathing', unit: 'per minute', src: 'checkup', get: (s) => s.resp?.rpm, q: (s) => s.resp?.quality },
  alert: { label: 'Reaction time, median', unit: 'ms', src: 'alertness', get: (s) => s.alertness?.medianMs, bandPct: 10 },
  eyegrid: { label: 'Eye grid squares marked', unit: 'squares', src: 'vision', get: (s) => (s.vision ? (s.vision.right || []).length + (s.vision.left || []).length : null), band: 0 },
  acuityR: { label: 'Eye chart, right eye (lower is better)', unit: 'logMAR', src: 'acuity', get: (s) => s.acuity?.right?.logmar, band: 0.2 },
  acuityL: { label: 'Eye chart, left eye (lower is better)', unit: 'logMAR', src: 'acuity', get: (s) => s.acuity?.left?.logmar, band: 0.2 },
  lidR: { label: 'Eye opening, right eye', unit: 'mm', src: 'checkup', get: (s) => s.eyelid?.right, band: 1.0 },
  lidL: { label: 'Eye opening, left eye', unit: 'mm', src: 'checkup', get: (s) => s.eyelid?.left, band: 1.0 },
  gaze: { label: 'Eye following, match', unit: '0 to 1', src: 'exp:gaze', get: (s) => s.exp?.followCorr, band: 0.15 },
  pupil: { label: 'Right pupil narrowing', unit: '%', src: 'exp:pupil', get: (s) => s.exp?.right?.constrictionPct, band: 10 },
  pallor: { label: 'Inner eyelid redness index', unit: 'index', src: 'exp:pallor', get: (s) => s.exp?.relEi, band: 3 },
  jaw: { label: 'Mouth opening (lips)', unit: 'mm', src: 'exp:jaw', get: (s) => s.exp?.maxOpenMm, band: 5 },
  gum: { label: 'Gum redness change, front photo', unit: 'a* units', src: 'checkup', get: (s) => s.dental?.front?.auto?.gumRedDelta, band: 6 },
  tremor: { label: 'Right hand rhythmic share', unit: '0 to 1', src: 'exp:tremor', get: (s) => s.exp?.right?.share, band: 0.15 },
  ptt: { label: 'Pulse timing index, palm after face', unit: 'ms', src: 'exp:circ', get: (s) => s.exp?.pttMs, band: 25 },
  ror: { label: 'Colour pulse ratio index', unit: 'index', src: 'exp:circ', get: (s) => s.exp?.rorFace, bandPct: 10 },
  // Derived: heartbeats per breath, from the same checkup's pulse and breathing. Own first value only; no population claim.
  hpb: { label: 'Heartbeats per breath', unit: 'ratio', src: 'checkup', get: (s) => (s.pulse?.bpm && s.resp?.rpm ? Math.round((s.pulse.bpm / s.resp.rpm) * 10) / 10 : null),
    q: (s) => ([s.pulse?.quality, s.resp?.quality].includes('low') ? 'low' : s.pulse?.quality), bandPct: 20 },
};

// Earth reference ranges for resting adults, for context next to the person's own baseline.
// Pulse: American Heart Association (60 to 100 bpm). Breathing: clinical nursing references (12 to 20 per minute,
// OpenStax Clinical Nursing Skills 15.6). Population ranges, not targets: fit people often sit below 60.
export const EARTH_RANGES = {
  pulse: { low: 60, high: 100, unit: 'bpm', source: 'American Heart Association' },
  resp: { low: 12, high: 20, unit: 'per minute', source: 'clinical nursing references' },
};
export function earthLine(id, v) {
  const r = EARTH_RANGES[id];
  if (!r || !Number.isFinite(v)) return '';
  const where = v < r.low ? 'below' : v > r.high ? 'above' : 'inside';
  return `Earth adult resting range ${r.low} to ${r.high} ${r.unit} (${r.source}): the latest value is ${where} it. Your own baseline matters more than this range.`;
}

// The person's own spread: mean, standard deviation and coefficient of variation of their earlier good quality
// values, the latest value as standard deviations from their own mean (z), and how many earlier values it exceeds.
// Needs at least STATS_MIN earlier values; with few values the standard deviation itself is uncertain.
export const STATS_MIN = 5;
export function personalStats(points) {
  const good = (points || []).filter((p) => p.q !== 'low' && Number.isFinite(p.v));
  if (good.length < STATS_MIN + 1) return null;
  const last = good[good.length - 1], prev = good.slice(0, -1);
  const n = prev.length, mean = prev.reduce((a, p) => a + p.v, 0) / n;
  const sd = Math.sqrt(prev.reduce((a, p) => a + (p.v - mean) ** 2, 0) / (n - 1));
  const r2 = (x) => Math.round(x * 100) / 100;
  const above = prev.filter((p) => p.v < last.v).length, below = prev.filter((p) => p.v > last.v).length;
  return { n, mean: r2(mean), sd: r2(sd), cv: mean ? Math.round((sd / Math.abs(mean)) * 1000) / 10 : null, latest: last.v, z: sd > 0 ? Math.round(((last.v - mean) / sd) * 10) / 10 : null, above, below };
}
export function statsLine(st, unit = '') {
  if (!st) return '';
  const u = unit && !['index', '0 to 1', 'ratio'].includes(unit) ? ` ${unit}` : '';
  const z = st.z == null ? 'no spread yet' : `${st.z > 0 ? '+' : ''}${st.z} standard deviations from your own mean`;
  const rank = st.above === st.n ? `higher than all ${st.n} earlier values` : st.below === st.n ? `lower than all ${st.n} earlier values` : `higher than ${st.above} of ${st.n} earlier values`;
  return `Your own spread: mean ${Math.round(st.mean * 10) / 10}${u}, standard deviation ${st.sd}${u} (variation ${st.cv}%), from ${st.n} earlier good quality values. The latest is ${z}, ${rank}.`;
}

export const REGIONS = [
  { id: 'head', label: 'Sleep and alertness', short: 'Sleep', metrics: ['alert'], dot: [150, 28], side: 'left', y: 2 },
  { id: 'eyes', label: 'Eyes', short: 'Eyes', metrics: ['eyegrid', 'acuityR', 'acuityL', 'lidR', 'lidL', 'gaze', 'pupil', 'pallor'], dot: [161, 48], side: 'right', y: 6 },
  { id: 'mouth', label: 'Mouth and jaw', short: 'Mouth and jaw', metrics: ['jaw', 'gum'], dot: [150, 74], side: 'left', y: 15 },
  { id: 'neck', label: 'Neck', short: 'Neck', metrics: [], dot: [150, 97], side: 'right', y: 19 },
  { id: 'heart', label: 'Heart and circulation', short: 'Heart', metrics: ['pulse', 'hpb', 'ptt', 'ror'], dot: [164, 150], side: 'left', y: 31 },
  { id: 'lungs', label: 'Breathing', short: 'Breathing', metrics: ['resp'], dot: [135, 172], side: 'right', y: 36 },
  { id: 'hands', label: 'Hands', short: 'Hands', metrics: ['tremor'], dot: [226, 304], side: 'right', y: 62 },
];

const byDate = (a, b) => a.createdAt.localeCompare(b.createdAt);
const isCheckup = (s) => (s.kind === 'baseline' || s.kind === 'followup') && (s.pulse || s.resp || s.dental);

// Points for one metric: [{ t (ms), v, q }] oldest first.
export function seriesFor(metricId, sessions) {
  const m = METRIC_DEFS[metricId];
  if (!m) return [];
  let list = (sessions || []).slice().sort(byDate);
  if (m.src === 'checkup') list = list.filter(isCheckup);
  else if (m.src === 'alertness') list = list.filter((s) => s.kind === 'alertness');
  else if (m.src === 'vision') list = list.filter((s) => s.kind === 'vision');
  else if (m.src === 'acuity') list = list.filter((s) => s.kind === 'acuity');
  else if (m.src.startsWith('exp:')) { const id = m.src.slice(4); list = list.filter((s) => s.kind === 'exp' && s.exp?.check === id && s.exp.ok); }
  return list.map((s) => ({ t: +new Date(s.createdAt), v: m.get(s), q: m.q ? m.q(s) : null })).filter((p) => Number.isFinite(p.v));
}

// Reference value and band for a metric: the person's own first value (or the original baseline for pulse
// and breathing, with the noise band the app already uses).
export function referenceFor(metricId, points, { original = null, floors = {} } = {}) {
  const m = METRIC_DEFS[metricId];
  if (!m || !points.length) return null;
  if (metricId === 'pulse' || metricId === 'resp') {
    const base = original ? m.get(original) : null;
    return base == null ? null : { base, band: floors[metricId] ?? null, label: 'original baseline' };
  }
  if (metricId === 'gum') return { base: 0, band: m.band, label: 'no change' };
  const base = points[0].v;
  return { base, band: m.bandPct != null ? Math.abs(base) * (m.bandPct / 100) : m.band, label: 'your first value' };
}

const outside = (v, ref) => ref && ref.band != null && Math.abs(v - ref.base) > ref.band + 1e-9;

// One blip or a real shift? (MODELED rules, design choices, not validated.)
// - sustained: the last SUSTAIN_RUN good quality values all sit outside the band on the same side.
// - single: the latest value is outside, but the run is shorter than that (often light, distance or a bad day).
// - drift: still inside the band, but the last DRIFT_MIN values move the same way and the fitted line
//   would cross the band edge within about two weeks at that pace.
// - steady: none of these. Low quality captures are skipped, never counted.
export const TREND = { SUSTAIN_RUN: 3, DRIFT_MIN: 4, DRIFT_HORIZON_DAYS: 14, WINDOW_DAYS: 21 };
const DAY = 86400000;
export function trendFor(points, ref) {
  const good = (points || []).filter((p) => p.q !== 'low' && Number.isFinite(p.v));
  if (!ref || ref.band == null || !good.length) return { kind: 'none' };
  const sideOf = (v) => (v > ref.base + ref.band + 1e-9 ? 'above' : v < ref.base - ref.band - 1e-9 ? 'below' : null);
  const lastSide = sideOf(good[good.length - 1].v);
  if (lastSide) {
    let run = 0;
    for (let i = good.length - 1; i >= 0 && sideOf(good[i].v) === lastSide; i -= 1) run += 1;
    return { kind: run >= TREND.SUSTAIN_RUN ? 'sustained' : 'single', side: lastSide, run };
  }
  const t1 = good[good.length - 1].t;
  const recent = good.filter((p) => p.t >= t1 - TREND.WINDOW_DAYS * DAY).slice(-6);
  if (recent.length >= TREND.DRIFT_MIN && ref.band > 0) {
    const tail = recent.slice(-TREND.DRIFT_MIN);
    const steps = tail.slice(1).map((p, i) => Math.sign(p.v - tail[i].v));
    const dir = steps.every((d) => d > 0) ? 1 : steps.every((d) => d < 0) ? -1 : 0;
    if (dir) {
      const n = recent.length, mt = recent.reduce((a, p) => a + p.t, 0) / n, mv = recent.reduce((a, p) => a + p.v, 0) / n;
      const sxx = recent.reduce((a, p) => a + (p.t - mt) ** 2, 0);
      const slopePerDay = sxx > 0 ? (recent.reduce((a, p) => a + (p.t - mt) * (p.v - mv), 0) / sxx) * DAY : 0;
      const edge = ref.base + dir * ref.band, last = good[good.length - 1].v;
      const daysToEdge = slopePerDay * dir > 0 ? (edge - last) / slopePerDay : Infinity;
      if (Math.sign(slopePerDay) === dir && daysToEdge <= TREND.DRIFT_HORIZON_DAYS) {
        return { kind: 'drift', side: dir > 0 ? 'above' : 'below', perWeek: Math.round(slopePerDay * 7 * 10) / 10, daysToEdge: Math.max(0, Math.round(daysToEdge)) };
      }
    }
  }
  return { kind: 'steady' };
}

// Sustained changes and drifts for the review packet: only measures that are not steady, only data up to `upTo`.
export function trendsForPacket(sessions, { original = null, floors = {}, upTo = null } = {}) {
  const cut = upTo ? +new Date(upTo) : Infinity;
  const list = (sessions || []).filter((x) => +new Date(x.createdAt) <= cut);
  const out = [];
  for (const id of Object.keys(METRIC_DEFS)) {
    const pts = seriesFor(id, list);
    if (pts.length < 2 && id !== 'pulse' && id !== 'resp') continue;
    const ref = referenceFor(id, pts, { original, floors });
    const tr = trendFor(pts, ref);
    if (tr.kind !== 'sustained' && tr.kind !== 'drift') continue;
    out.push({ measure: METRIC_DEFS[id].label, unit: METRIC_DEFS[id].unit, kind: tr.kind, side: tr.side, run: tr.run ?? null,
      per_week: tr.perWeek ?? null, days_to_band_edge: tr.daysToEdge ?? null, experimental: METRIC_DEFS[id].src.startsWith('exp:'),
      rule: 'MODELED: sustained = 3 good quality values in a row outside the band; drift = 4 values moving one way, reaching the band edge within 14 days' });
  }
  return out;
}

// One line about the trend, for the chart note and the reasons list.
export function trendLine(tr, unit = '') {
  const u = unit && !['index', '0 to 1'].includes(unit) ? ` ${unit}` : '';
  if (tr.kind === 'sustained') return `${tr.side === 'above' ? 'Above' : 'Below'} the band ${tr.run} times in a row: a sustained change, worth a recheck and a note to the reviewer.`;
  if (tr.kind === 'single') return tr.run === 1 ? `Only the latest value is outside the band. One value can be light, distance or a bad day: repeat the check before reading much into it.` : `${tr.side === 'above' ? 'Above' : 'Below'} the band ${tr.run} times in a row. One more outside would count as sustained.`;
  if (tr.kind === 'drift') return `Still inside the band, but moving ${tr.side === 'above' ? 'up' : 'down'} about ${Math.abs(tr.perWeek)}${u} a week; at that pace it reaches the band edge ${tr.daysToEdge < 1 ? 'within a day' : `in about ${tr.daysToEdge} day${tr.daysToEdge === 1 ? '' : 's'}`}.`;
  return '';
}

// Region status from facts already computed by the app. Returns [{ ...region, status, reasons }].
export function buildRegions(sessions, { original = null, floors = {}, sleepHours = null, latestChecklist = [] } = {}) {
  const ticks = new Set(latestChecklist || []);
  return REGIONS.map((r) => {
    const reasons = [], notes = [];
    let any = false;
    for (const id of r.metrics) {
      const pts = seriesFor(id, sessions);
      if (!pts.length) continue;
      any = true;
      const ref = referenceFor(id, pts, { original, floors });
      const last = pts[pts.length - 1];
      if (pts.length > 1 || id === 'pulse' || id === 'resp' || id === 'gum') {
        const u = ['index', '0 to 1'].includes(METRIC_DEFS[id].unit) ? '' : ` ${METRIC_DEFS[id].unit}`;
        const tr = trendFor(pts, ref);
        if (outside(last.v, ref)) reasons.push(`${METRIC_DEFS[id].label} ${last.v}${u} (${ref.label === 'original baseline' ? 'baseline' : ref.label === 'no change' ? 'expected' : 'first'} ${Math.round(ref.base * 100) / 100})${tr.kind === 'sustained' ? `, ${tr.run} in a row` : ''}`);
        else if (tr.kind === 'drift') notes.push(`${METRIC_DEFS[id].label} drifting ${tr.side === 'above' ? 'up' : 'down'}, still inside the band`);
      }
    }
    if (r.id === 'neck' && (sessions || []).some((s) => s.kind === 'exp' && s.exp?.check === 'neck' && s.exp.ok)) any = true;
    if (r.id === 'head' && sleepHours != null) { any = true; if (sleepHours < 6) reasons.push(`Sleep last night ${sleepHours} h, under 6 h`); }
    if (r.id === 'heart' && ticks.has('chest')) reasons.unshift('Chest pain or pressure ticked');
    if (r.id === 'lungs' && ticks.has('breath')) reasons.unshift('Shortness of breath ticked');
    if (r.id === 'mouth' && ticks.has('mouth')) reasons.push('Tooth or gum pain ticked');
    if (r.id === 'head' && (ticks.has('headache') || ticks.has('sleep'))) reasons.push('Headache or poor sleep ticked');
    const urgent = (r.id === 'heart' && ticks.has('chest')) || (r.id === 'lungs' && ticks.has('breath'));
    const status = urgent ? 'urgent' : reasons.length ? 'review' : any ? 'logged' : 'none';
    return { ...r, status, reasons, notes };
  });
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtD = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };

// Line chart as an SVG string. ref = { base, band, label } or null.
export function lineChart(points, { unit = '', ref = null, title = '', w = 640, h = 230 } = {}) {
  if (!points.length) return '';
  const L = 52, R = 14, T = 16, B = 34;
  const vals = points.map((p) => p.v).concat(ref ? [ref.base - (ref.band || 0), ref.base + (ref.band || 0)] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
  lo -= pad; hi += pad;
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const x = (t) => (points.length === 1 ? (L + w - R) / 2 : L + ((t - t0) / Math.max(1, t1 - t0)) * (w - L - R));
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (h - T - B);
  const nice = (v) => (Math.abs(hi - lo) < 3 ? Math.round(v * 100) / 100 : Math.round(v));
  let g = '';
  for (let k = 0; k <= 2; k++) { const v = lo + ((hi - lo) * k) / 2; g += `<line x1="${L}" x2="${w - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/><text x="${L - 8}" y="${(y(v) + 5).toFixed(1)}" class="ax" text-anchor="end">${nice(v)}</text>`; }
  if (ref) {
    if (ref.band) g += `<rect x="${L}" y="${y(ref.base + ref.band).toFixed(1)}" width="${w - L - R}" height="${Math.max(1, y(ref.base - ref.band) - y(ref.base + ref.band)).toFixed(1)}" class="band"/>`;
    g += `<line x1="${L}" x2="${w - R}" y1="${y(ref.base).toFixed(1)}" y2="${y(ref.base).toFixed(1)}" class="baseline"/>`;
  }
  const line = points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const dots = points.map((p) => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="5.5" class="${p.q === 'low' ? 'lowq' : outside(p.v, ref) ? 'now' : 'dotpt'}"><title>${fmtD(p.t)}: ${p.v} ${esc(unit)}</title></circle>`).join('');
  const xs = points.length > 1 ? `<text x="${L}" y="${h - 8}" class="ax">${fmtD(t0)}</text><text x="${w - R}" y="${h - 8}" class="ax" text-anchor="end">${fmtD(t1)}</text>` : `<text x="${x(t0).toFixed(1)}" y="${h - 8}" class="ax" text-anchor="middle">${fmtD(t0)}</text>`;
  return `<svg class="spark ov-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}: ${points.length} value${points.length === 1 ? '' : 's'}${ref ? `, shaded band around ${esc(ref.label)}` : ''}">${g}${points.length > 1 ? `<polyline points="${line}" class="line"/>` : ''}${dots}${xs}</svg>`;
}

// The body outline: a plain, generic figure drawn for this app.
export const BODY_SVG = `<svg viewBox="0 0 300 460" class="ov-body-fig" aria-hidden="true" focusable="false">
  <path class="ov-skin" d="M138 84 h24 v24 h-24z"/>
  <path class="ov-skin" d="M136 104 C120 108 100 110 92 124 C84 138 80 170 76 210 L70 268 C68 286 66 300 66 312 C66 326 82 326 82 314 L86 270 L94 214 L100 176 L104 240 L106 300 L112 380 L116 440 C116 454 140 454 140 442 L146 356 L150 318 L154 356 L160 442 C160 454 184 454 184 440 L188 380 L194 300 L196 240 L200 176 L206 214 L214 270 L218 314 C218 326 234 326 234 312 C234 300 232 286 230 268 L224 210 C220 170 216 138 208 124 C200 110 180 108 164 104 Z"/>
  <ellipse cx="150" cy="54" rx="29" ry="35" class="ov-skin"/>
</svg>`;

// Mission clock: day N of M from a start date (local calendar days, day 1 = start date).
export function missionDay(startIso, lengthDays, now = new Date()) {
  const len = Math.round(Number(lengthDays));
  if (!startIso || !(len >= 1 && len <= 2000)) return null;
  const s = new Date(`${startIso}T00:00:00`);
  if (Number.isNaN(+s)) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = Math.round((today - s) / 86400000) + 1;
  if (day < 1) return { phase: 'before', day, length: len, daysToGo: 1 - day, pct: 0 };
  if (day > len) return { phase: 'after', day, length: len, daysSince: day - len, pct: 1 };
  return { phase: 'during', day, length: len, pct: day / len };
}

// Bland and Altman plot as an SVG string: difference (app minus reference) against the mean of the two.
export function blandAltmanSvg(ba, { unit = '', title = '', w = 520, h = 220 } = {}) {
  if (!ba || ba.n < 2) return '';
  const L = 52, R = 70, T = 14, B = 36;
  const xs = ba.points.map((p) => p.mean), ys = ba.points.map((p) => p.diff).concat([ba.low, ba.high, 0]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x1 - x0 < 1) { x0 -= 1; x1 += 1; } const xp = (x1 - x0) * 0.08; x0 -= xp; x1 += xp;
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * 0.15 || 1; y0 -= pad; y1 += pad;
  const X = (v) => L + ((v - x0) / (x1 - x0)) * (w - L - R), Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (h - T - B);
  const line = (v, cls, label) => `<line class="${cls}" x1="${L}" x2="${w - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ba-lab" x="${w - R + 4}" y="${(Y(v) + 4).toFixed(1)}">${label}</text>`;
  return `<svg class="ba-plot" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}: ${ba.n} pairs, bias ${ba.bias} ${esc(unit)}, limits of agreement ${ba.low} to ${ba.high} ${esc(unit)}">
    <line class="ba-axis" x1="${L}" x2="${L}" y1="${T}" y2="${h - B}"/><line class="ba-axis" x1="${L}" x2="${w - R}" y1="${h - B}" y2="${h - B}"/>
    ${line(0, 'ba-zero', Math.abs(Y(0) - Y(ba.bias)) < 14 ? '' : '0')}${line(ba.bias, 'ba-bias', `bias ${ba.bias}`)}${line(ba.high, 'ba-loa', `+${ba.high}`.replace('+-', '-'))}${line(ba.low, 'ba-loa', `${ba.low}`)}
    ${ba.points.map((p) => `<circle class="ba-pt" cx="${X(p.mean).toFixed(1)}" cy="${Y(p.diff).toFixed(1)}" r="4.5"/>`).join('')}
    <text class="ba-ax" x="${(L + w - R) / 2}" y="${h - 8}" text-anchor="middle">mean of app and reference (${esc(unit)})</text>
    <text class="ba-ax" x="${L}" y="${h - B + 14}" text-anchor="start">${Math.round(x0)}</text><text class="ba-ax" x="${w - R}" y="${h - B + 14}" text-anchor="end">${Math.round(x1)}</text>
    <text class="ba-ax" x="12" y="${(T + h - B) / 2}" text-anchor="middle" transform="rotate(-90 12 ${(T + h - B) / 2})">app minus reference</text>
    <text class="ba-ax" x="${L - 6}" y="${(Y(y1) + 10).toFixed(1)}" text-anchor="end">${Math.round(y1)}</text><text class="ba-ax" x="${L - 6}" y="${Y(y0).toFixed(1)}" text-anchor="end">${Math.round(y0)}</text>
  </svg>`;
}

// Body measures for context. BMI = weight (kg) / height (m) squared; adult categories from WHO
// (under 18.5, 18.5 to 24.9, 25 to 29.9, 30 and over). A population screening number, not a diagnosis.
// US adult averages, ages 20 and over: CDC FastStats, NHANES August 2021 to August 2023
// (men 68.9 in, 199.0 lb; women 63.5 in, 171.8 lb), converted to cm and kg.
export const EARTH_AVG = {
  male: { heightCm: 175.0, weightKg: 90.3 },
  female: { heightCm: 161.3, weightKg: 77.9 },
};
export function bmi(heightCm, weightKg) {
  const h = +heightCm / 100, w = +weightKg;
  if (!(h > 0.5 && h < 2.6 && w > 20 && w < 400)) return null;
  const v = Math.round((w / (h * h)) * 10) / 10;
  const cat = v < 18.5 ? 'underweight' : v < 25 ? 'healthy weight range' : v < 30 ? 'overweight' : 'obesity';
  return { value: v, category: cat };
}
