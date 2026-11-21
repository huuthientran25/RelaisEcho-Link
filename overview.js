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
  sway: { label: 'Standing sway, eyes open', unit: 'mg', src: 'exp:balance', get: (s) => s.exp?.open?.rmsMg, bandPct: 50 },
  point: { label: 'Touchscreen pointing, time to tap', unit: 'ms', src: 'exp:point', get: (s) => s.exp?.medianMs, bandPct: 20 },
  tremor: { label: 'Right hand rhythmic share', unit: '0 to 1', src: 'exp:tremor', get: (s) => s.exp?.right?.share, band: 0.15 },
  ptt: { label: 'Pulse timing index, palm after face', unit: 'ms', src: 'exp:circ', get: (s) => s.exp?.pttMs, band: 25 },
  ror: { label: 'Colour pulse ratio index', unit: 'index', src: 'exp:circ', get: (s) => s.exp?.rorFace, bandPct: 10 },
  // Derived: heartbeats per breath, from the same checkup's pulse and breathing. Own first value only; no population claim.
  hpb: { label: 'Heartbeats per breath', unit: 'ratio', src: 'checkup', get: (s) => (s.pulse?.bpm && s.resp?.rpm ? Math.round((s.pulse.bpm / s.resp.rpm) * 10) / 10 : null),
    q: (s) => ([s.pulse?.quality, s.resp?.quality].includes('low') ? 'low' : s.pulse?.quality), bandPct: 20 },
  // Typed in from the person's own devices (v2.5), charted against their own first reading. The bands are design
  // choices for the reading order, not clinical thresholds.
  spo2: { label: 'Oxygen saturation, fingertip oximeter', unit: '%', src: 'device', get: (s) => s.devices?.spo2, band: 3, max: 100, res: 1 },
  devPulse: { label: 'Pulse, own device', unit: 'bpm', src: 'device', get: (s) => s.devices?.pulse, band: 8, res: 1 },
  temp: { label: 'Temperature, thermometer', unit: '°C', src: 'device', get: (s) => s.devices?.tempC, band: 0.6, res: 0.1 },
  bpSys: { label: 'Blood pressure, upper number', unit: 'mmHg', src: 'device', get: (s) => s.devices?.sys, band: 15, res: 1 },
  bpDia: { label: 'Blood pressure, lower number', unit: 'mmHg', src: 'device', get: (s) => s.devices?.dia, band: 10, res: 1 },
};

// Readings typed in from the person's own devices: fingertip oximeter, thermometer, blood pressure cuff.
// The app stores them, charts them and passes them on as typed. It does not measure or judge them; the limits
// here only reject typing slips (values such a device cannot show).
export const DEVICE_FIELDS = [
  { key: 'spo2', metric: 'spo2', min: 50, max: 100, dp: 0 },
  { key: 'pulse', metric: 'devPulse', min: 25, max: 240, dp: 0 },
  { key: 'tempC', metric: 'temp', min: 30, max: 43, dp: 1 },
  { key: 'sys', metric: 'bpSys', min: 50, max: 260, dp: 0 },
  { key: 'dia', metric: 'bpDia', min: 30, max: 160, dp: 0 },
];
export function cleanDevices(raw) {
  const out = {};
  for (const f of DEVICE_FIELDS) {
    const x = raw?.[f.key];
    if (x === '' || x == null) continue;
    const v = Number(x);
    if (Number.isFinite(v) && v >= f.min && v <= f.max) out[f.key] = +v.toFixed(f.dp);
  }
  // Blood pressure needs both numbers, upper above lower.
  if ((out.sys == null) !== (out.dia == null) || (out.sys != null && out.sys <= out.dia)) { delete out.sys; delete out.dia; }
  return Object.keys(out).length ? out : null;
}
// Context next to a device reading. Sources: US FDA, Pulse Oximeter Basics (95% to 100% for most healthy people;
// accuracy and tips); Hypertension Canada (home readings averaging 135/85 mmHg or higher are considered high).
export function deviceLine(id, v) {
  if (!Number.isFinite(v)) return '';
  if (id === 'spo2') return `Most healthy people read 95% to 100% on a fingertip oximeter (FDA). ${v < 95 ? 'The latest reading is below that: warm your hand, sit still and recheck. Contact a health worker if it stays low or you feel unwell.' : 'The latest reading is inside that.'} Cold fingers, movement, nail polish and darker skin can make a reading less accurate.`;
  if (id === 'bpSys' || id === 'bpDia') return 'Hypertension Canada counts home readings that average 135 over 85 or higher as high. One reading is not a diagnosis.';
  return '';
}

// Earth reference ranges for resting adults, for context next to the person's own baseline.
// Pulse: American Heart Association (60 to 100 bpm). Breathing: clinical nursing references (12 to 20 per minute,
// OpenStax Clinical Nursing Skills 15.6). Population ranges, not targets: fit people often sit below 60.
export const EARTH_RANGES = {
  pulse: { low: 60, high: 100, unit: 'bpm', source: 'American Heart Association' },
  devPulse: { low: 60, high: 100, unit: 'bpm', source: 'American Heart Association' },
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
  { id: 'head', label: 'Sleep and alertness', short: 'Sleep', metrics: ['alert', 'sway', 'temp'], dot: [150, 28], side: 'left', y: 2 },
  { id: 'eyes', label: 'Eyes', short: 'Eyes', metrics: ['eyegrid', 'acuityR', 'acuityL', 'lidR', 'lidL', 'gaze', 'pupil', 'pallor'], dot: [161, 48], side: 'right', y: 6 },
  { id: 'mouth', label: 'Mouth and jaw', short: 'Mouth and jaw', metrics: ['jaw', 'gum'], dot: [150, 74], side: 'left', y: 15 },
  { id: 'neck', label: 'Neck', short: 'Neck', metrics: [], dot: [150, 97], side: 'right', y: 19 },
  { id: 'heart', label: 'Heart and circulation', short: 'Heart', metrics: ['pulse', 'hpb', 'devPulse', 'bpSys', 'bpDia', 'ptt', 'ror'], dot: [164, 150], side: 'left', y: 31 },
  { id: 'lungs', label: 'Breathing', short: 'Breathing', metrics: ['resp', 'spo2'], dot: [135, 172], side: 'right', y: 36 },
  { id: 'hands', label: 'Hands', short: 'Hands', metrics: ['tremor', 'point'], dot: [226, 304], side: 'right', y: 62 },
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
    if (tr.kind !== 'sustained' && tr.kind !== 'drift') {
      const ew = ewmaChart(pts, METRIC_DEFS[id].res ? { ...EWMA, MIN_SD: METRIC_DEFS[id].res / 2 } : EWMA);
      if (ew?.signal) out.push({ measure: METRIC_DEFS[id].label, unit: METRIC_DEFS[id].unit, kind: 'early_warning', side: ew.side, run: null, per_week: null, days_to_band_edge: null,
        experimental: METRIC_DEFS[id].src.startsWith('exp:'), rule: 'MODELED: EWMA early warning (lambda 0.2, 3.2 standard errors) against the person\'s own recent normal (up to 28 good values before the latest 5 checks)' });
      continue;
    }
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
const fmtDate = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
const fmtD = fmtDate;

// Line chart as an SVG string. ref = { base, band, label } or null.
export function lineChart(points, { unit = '', ref = null, title = '', w = 640, h = 230, forecast = null, ceil = null, dayLabel = null } = {}) {
  const fmtD = dayLabel ? (t) => `${fmtDate(t)} ${dayLabel(t)}` : fmtDate;
  if (!points.length) return '';
  const L = 52, R = forecast ? 44 : 14, T = 16, B = 34;
  const vals = points.map((p) => p.v).concat(ref ? [ref.base - (ref.band || 0), ref.base + (ref.band || 0)] : []).concat(forecast ? [forecast.lo, forecast.hi] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
  lo -= pad; hi += pad;
  if (ceil != null && lo < ceil) hi = Math.min(hi, ceil); // a bounded measure (oxygen saturation stops at 100%)
  const t0 = points[0].t, t1 = forecast ? forecast.t : points[points.length - 1].t;
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
  let fcg = '';
  if (forecast && points.length > 1) {
    const lp = points[points.length - 1], fx = x(forecast.t).toFixed(1);
    fcg = `<line x1="${x(lp.t).toFixed(1)}" y1="${y(lp.v).toFixed(1)}" x2="${fx}" y2="${y(forecast.value).toFixed(1)}" class="fc-line"/><line x1="${fx}" x2="${fx}" y1="${y(forecast.hi).toFixed(1)}" y2="${y(forecast.lo).toFixed(1)}" class="fc-range"/><circle cx="${fx}" cy="${y(forecast.value).toFixed(1)}" r="5" class="fc-dot"><title>Forecast: ${Math.round(forecast.value * 10) / 10} ${esc(unit)}</title></circle>`;
  }
  return `<svg class="spark ov-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}: ${points.length} value${points.length === 1 ? '' : 's'}${ref ? `, shaded band around ${esc(ref.label)}` : ''}${forecast ? ', dashed forecast for the next check' : ''}">${g}${points.length > 1 ? `<polyline points="${line}" class="line"/>` : ''}${fcg}${dots}${xs}</svg>`;
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

// Mission day labels as NASA writes them (v2.10): L-3 is three days before launch, FD5 is the fifth flight day,
// R+0 is landing day and R+12 twelve days after. Landing is taken as the end of the mission clock.
const dayIndex = (t) => { const d = new Date(t); return Math.round(+new Date(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); };
export function missionLabel(t, mc) {
  if (!mc?.start || !(mc.length >= 1)) return '';
  const s = new Date(`${mc.start}T00:00:00`);
  if (Number.isNaN(+s)) return '';
  const day = dayIndex(t) - dayIndex(s) + 1; // 1 on launch day
  if (day < 1) return `L-${1 - day}`;
  if (day <= mc.length) return `FD${day}`;
  return `R+${day - mc.length - 1}`;
}

// Return to baseline after landing (v2.10). Pre-flight range: the person's good values before launch, as a 95%
// prediction range (mean +/- t * SD * sqrt(1 + 1/n); needs 3 values). Back = two checks in a row inside it.
// Context only, not a target: in the Inspiration4 crew about 95% of measured markers were back to their pre-flight
// level within three months (published summary of the SOMA papers).
const T95 = { 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228 };
export function returnToBaseline(points, mc) {
  if (!mc?.start || !(mc.length >= 1)) return null;
  const good = (points || []).filter((q) => q.q !== 'low' && Number.isFinite(q.v));
  const label = (q) => missionLabel(q.t, mc);
  const pre = good.filter((q) => label(q).startsWith('L-')).map((q) => q.v);
  const post = good.filter((q) => label(q).startsWith('R+'));
  if (pre.length < 3 || !post.length) return null;
  const n = pre.length, m = meanOf(pre), sd = sdOf(pre);
  const half = (T95[n - 1] || 2.0) * Math.max(sd, 1e-9) * Math.sqrt(1 + 1 / n);
  const lo = m - half, hi = m + half, inside = (v) => v >= lo && v <= hi;
  let backAt = null;
  for (let i = 1; i < post.length; i += 1) if (inside(post[i - 1].v) && inside(post[i].v)) { backAt = label(post[i - 1]); break; }
  const last = post.at(-1);
  return { n, lo, hi, latest: last.v, latestDay: label(last), back: backAt != null && inside(last.v), backAt, insideNow: inside(last.v), postN: post.length };
}
export function returnLine(r, unit = '') {
  if (!r) return '';
  const u = unit && !['index', '0 to 1', 'ratio'].includes(unit) ? ` ${unit}` : '';
  const f = (v) => (Math.abs(v) >= 20 ? Math.round(v) : Math.round(v * 10) / 10);
  const range = `${f(r.lo)} to ${f(r.hi)}${u}, from ${r.n} pre-flight checks`;
  if (r.back) return `Since landing (${r.latestDay}): back inside your pre-flight range since ${r.backAt} (${range}).`;
  if (r.insideNow) return `Since landing (${r.latestDay}): the latest value is inside your pre-flight range (${range}); one more check inside it counts as back.`;
  return `Since landing (${r.latestDay}): still outside your pre-flight range (latest ${f(r.latest)}${u}; range ${range}). For context, about 95% of the Inspiration4 crew's measured markers were back within three months.`;
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

// ---------- Early warning and forecast (MODELED, v2.1; early warning rule revised in v2.5) ----------
// EWMA control chart (Roberts 1959) on the person's own values, against their own recent normal.
// - Recent normal: mean and spread of up to CAP good values that came before the latest HOLD checks (never fewer
//   than BASE_N, so the warning starts at the 9th good value). It moves with the person, so a slow seasonal
//   change is not a warning; the band rules above keep the comparison with the original baseline.
// - Smoothed line: starts at the recent normal and takes in the checks after it, newest weight LAMBDA.
// - Signal: the line sits further from the recent normal than L standard errors. The standard error counts the
//   smoothing and, when UNC is on, how uncertain a mean of m values is:
//   sd * sqrt(lambda / (2 - lambda) * (1 - (1 - lambda)^(2k)) + (1 - (1 - lambda)^k)^2 / m).
// Up to v2.4 the rule used the first 8 values for ever and left out the second term (EWMA_V21 below). Measured by
// simulateMonitoring, that gave about 6 false warnings per healthy person per year of daily checks; these
// settings give about 1 and catch a week long rise more often. All settings are design choices.
export const EWMA = { LAMBDA: 0.2, L: 3.2, BASE_N: 8, CAP: 28, HOLD: 5, UNC: true };
export const EWMA_V21 = { LAMBDA: 0.2, L: 3.5, BASE_N: 8, CAP: 8, HOLD: Infinity, UNC: false };
const meanOf = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sdOf = (a) => { const m = meanOf(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };
export function ewmaChart(points, p = EWMA) {
  const good = (points || []).filter((q) => q.q !== 'low' && Number.isFinite(q.v));
  if (good.length < p.BASE_N + 1) return null;
  const vals = good.map((q) => q.v);
  let first = null, last = null;
  const series = [];
  for (let i = p.BASE_N; i < good.length; i += 1) {
    const end = Math.max(p.BASE_N, i - p.HOLD);
    const base = vals.slice(Math.max(0, end - p.CAP), end);
    // A run of identical whole number readings has almost no spread; MIN_SD (half the display step) keeps one
    // changed digit from counting as a signal.
    const mu = meanOf(base), sd = Math.max(sdOf(base), p.MIN_SD || 0), m = base.length;
    let z = mu, k = 0;
    for (let j = end; j <= i; j += 1) { z = p.LAMBDA * vals[j] + (1 - p.LAMBDA) * z; k += 1; }
    const a = 1 - (1 - p.LAMBDA) ** k;
    const lim = p.L * sd * Math.sqrt((p.LAMBDA / (2 - p.LAMBDA)) * (1 - (1 - p.LAMBDA) ** (2 * k)) + (p.UNC === false ? 0 : (a * a) / m));
    const signal = sd > 0 && Math.abs(z - mu) > lim;
    if (signal && first == null) first = good[i].t;
    last = { t: good[i].t, z, lim, signal, mu, sd, m };
    series.push(last);
  }
  if (!(last.sd > 0)) return null;
  return { mu: last.mu, sd: last.sd, z: last.z, lim: last.lim, signal: last.signal, side: last.z > last.mu ? 'above' : 'below', firstSignalAt: first, n: good.length, baseN: last.m, series };
}
export function ewmaLine(e, unit = '') {
  if (!e) return '';
  const u = unit && !['index', '0 to 1', 'ratio'].includes(unit) ? ` ${unit}` : '';
  const r = (v) => Math.round(v * 10) / 10;
  return e.signal
    ? `Early warning: the smoothed trend of your latest checks sits ${e.side} your own recent normal (${r(e.mu)}${u}), beyond what your own spread explains. Recheck and note it for the reviewer.`
    : `Early warning: none. Your latest checks stay within what your own recent spread explains (recent normal ${r(e.mu)}${u}).`;
}

// Next value forecast with a guard (v2.4). Two candidates from the last good values (at most n): a straight
// line, and the plain average. The line is used only when it has predicted this person's own earlier values
// better than the average did (rolling one step ahead check, at least minChecks comparisons); otherwise the
// average is used. Reason: on the Inspiration4 crew data a line through sparse points predicted worse than the
// mean or the last value. Measured on simulated series (4000 per case, error in units of the person's own SD):
// with no trend and 6 values the guard picks the line 21% of the time (error 0.95; always average 0.85, always
// line 1.07), with 20 values 4%; with a trend of 1 SD per check and 8 values it picks the line every time
// (error 1.10; always average 3.54). A stricter margin lost more on real trends than it saved on noise.
export const FORECAST_MARGIN = 1;
const T975 = { 1: 12.71, 2: 4.3, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31 };
function fitLine(win) {
  const k = win.length, ts = win.map((q) => q.t / DAY), vs = win.map((q) => q.v);
  const mt = meanOf(ts), mv = meanOf(vs);
  const sxx = ts.reduce((s, t) => s + (t - mt) ** 2, 0);
  if (!(sxx > 0)) return null;
  const b = ts.reduce((s, t, i) => s + (t - mt) * (vs[i] - mv), 0) / sxx, a = mv - b * mt;
  const s = Math.sqrt(vs.reduce((q, v, i) => q + (v - (a + b * ts[i])) ** 2, 0) / (k - 2));
  return { a, b, s, mt, mv, sxx, k, span: ts[k - 1] - ts[0], at: (t) => a + b * t };
}
export function forecastNext(points, { n = 6, min = 4, margin = FORECAST_MARGIN, minChecks = 2 } = {}) {
  const all = (points || []).filter((q) => q.q !== 'low' && Number.isFinite(q.v));
  const good = all.slice(-n);
  if (good.length < min) return null;
  const k = good.length, ts = good.map((q) => q.t / DAY), vs = good.map((q) => q.v);
  const fit = fitLine(good);
  if (!fit) return null;
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).sort((x, y) => x - y);
  const step = Math.max(0.5, gaps[Math.floor(gaps.length / 2)]);
  const tn = ts[k - 1] + step;
  // Rolling check on the person's own history: predict each earlier value from the values before it.
  let eLine = 0, eMean = 0, checks = 0;
  for (let i = min; i < all.length; i += 1) {
    const win = all.slice(Math.max(0, i - n), i), f = fitLine(win);
    if (!f) continue;
    eLine += Math.abs(all[i].v - f.at(all[i].t / DAY)); eMean += Math.abs(all[i].v - f.mv); checks += 1;
  }
  const useLine = checks >= minChecks && eLine < margin * eMean;
  const base = { t: tn * DAY, aheadDays: step, slopePerWeek: fit.b * 7, n: k, checks, lineErr: checks ? eLine / checks : null, meanErr: checks ? eMean / checks : null };
  if (useLine) {
    const half = (T975[k - 2] || 2.0) * fit.s * Math.sqrt(1 + 1 / k + (tn - fit.mt) ** 2 / fit.sxx);
    const value = fit.at(tn);
    return { ...base, method: 'line', value, lo: value - half, hi: value + half };
  }
  const half = (T975[k - 1] || 2.0) * sdOf(vs) * Math.sqrt(1 + 1 / k);
  return { ...base, method: 'mean', value: fit.mv, lo: fit.mv - half, hi: fit.mv + half };
}
export function forecastLine(f, unit = '') {
  if (!f) return '';
  const u = unit && !['index', '0 to 1', 'ratio'].includes(unit) ? ` ${unit}` : '';
  const r = (v) => (Math.abs(v) >= 20 ? Math.round(v) : Math.round(v * 10) / 10);
  const days = Math.round(f.aheadDays);
  const how = f.method === 'mean'
    ? `from the average of the last ${f.n} good values (${f.checks < 2 ? 'too few values yet to trust a trend line' : 'a straight line has not predicted your earlier values better'}, so the simpler forecast is used)`
    : `from a straight line through the last ${f.n} good values`;
  return `Forecast for the next check (in about ${days} day${days === 1 ? '' : 's'}): ${r(f.value)}${u}, likely between ${r(f.lo)} and ${r(f.hi)}, ${how}.`;
}

// How far along the person's own baseline is. Below EWMA.BASE_N good values the personal range is rough:
// on the Inspiration4 data, three earlier values put about half of all new results "outside" by chance.
export function baselineReadiness(points) {
  const n = (points || []).filter((q) => q.q !== 'low' && Number.isFinite(q.v)).length;
  return { n, need: EWMA.BASE_N, ready: n >= EWMA.BASE_N };
}
export function readinessLine(b) {
  if (!b || b.ready || !b.n) return '';
  const left = b.need - b.n;
  return `Baseline strength: ${b.n} of ${b.need} good quality values. Your own range is still rough, so treat a single value outside it with caution; ${left} more check${left === 1 ? '' : 's'} and the early warning starts.`;
}

// Simulation to measure the early warning against the 3 in a row rule on series with a known change.
// Values are in units of the person's own standard deviation. band = the rule's band, in the same units.
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function simulateDetection({ seed = 7, runs = 2000, shift = 1.5, drift = 0, before = 8, after = 10, band = 2 } = {}) {
  const r = rng(seed);
  const gauss = () => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  const tally = { ewma: { hit: 0, delay: [] }, run3: { hit: 0, delay: [] } };
  for (let k = 0; k < runs; k += 1) {
    const pts = [];
    for (let i = 0; i < before + after; i += 1) {
      const j = i - before + 1;
      const mean = i < before ? 0 : shift + drift * j;
      pts.push({ t: i * DAY, v: mean + gauss(), q: 'high' });
    }
    // Early warning: first signal index.
    // Both rules watch the same checks: the `after` window that follows the person's first `before` values.
    let firstE = null;
    for (let i = before + 1; i <= pts.length; i += 1) { const e = ewmaChart(pts.slice(0, i)); if (e?.signal) { firstE = i - 1; break; } }
    // 3 in a row outside ±band around the person's first value.
    let firstR = null, runLen = 0;
    for (let i = before; i < pts.length; i += 1) { runLen = Math.abs(pts[i].v - pts[0].v) > band ? runLen + 1 : 0; if (runLen >= TREND.SUSTAIN_RUN) { firstR = i; break; } }
    for (const [name, at] of [['ewma', firstE], ['run3', firstR]]) {
      if (at == null) continue;
      tally[name].hit += 1; tally[name].delay.push(at - before + 1);
    }
  }
  const med = (a) => { if (!a.length) return null; const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  // With shift 0 and drift 0 there is no change, so `signalPct` is the false alarm rate over the `after` checks.
  const pack = (x) => ({ signalPct: Math.round((x.hit / runs) * 1000) / 10, medianDelay: med(x.delay) });
  return { runs, shift, drift, before, after, band, ewma: pack(tally.ewma), run3: pack(tally.run3) };
}

// Can the early warning catch an illness, and how often does it cry wolf? (MODELED, v2.5)
// A simulated healthy adult's resting pulse varies from day to day around their own mean with a standard
// deviation of SD_WITHIN (3.03 bpm: the average within person standard deviation of daily resting heart rate in
// 92,457 wearable users, Quer et al. 2020, PLOS ONE, doi 10.1371/journal.pone.0227709), plus the sensor's own error.
// - Healthy year: checks every `everyDays` for 365 days after the first 8. A false warning is counted each time a
//   rule switches on.
// - Illness: after LEAD_DAYS healthy days the pulse sits RISE bpm higher for ILL_DAYS days (7 bpm is the median
//   rise around COVID-19 onset in Mishra et al. 2020, Nature Biomedical Engineering, doi 10.1038/s41551-020-00640-6;
//   the 7 day length is an assumption). Caught = a rule switches on at a check during those days.
// - `band`: the 3 in a row rule's band around the first value (8 bpm is the app's default pulse noise band).
// Independent, normally distributed noise is a best case: real people also have bad nights, alcohol, exercise
// and seasons (about 2 bpm across the year in Quer 2020; `seasonBpm` is the size of that swing, peak to trough).
export const MONITOR = { SD_WITHIN: 3.03, RISE: 7, ILL_DAYS: 7, BAND: 8, LEAD_DAYS: 28 };
// `missPct` (v2.8): each scheduled check after the first 8 is skipped with this chance, to model missed checks in
// remote work (travel, weather, no battery). MODELED; the share of missed checks is an assumption.
export function simulateMonitoring({ seed = 11, runs = 2000, everyDays = 1, sensorSd = 1, sdWithin = MONITOR.SD_WITHIN, rise = MONITOR.RISE, illDays = MONITOR.ILL_DAYS, band = MONITOR.BAND, seasonBpm = 0, rule = EWMA, missPct = 0 } = {}) {
  const r = rng(seed);
  const gauss = () => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  const s = Math.hypot(sdWithin, sensorSd), B = rule.BASE_N, nYear = Math.floor(365 / everyDays);
  const flags = {
    ewma: (pts) => { const out = new Array(pts.length).fill(false); const e = ewmaChart(pts, rule); if (e) e.series.forEach((x, k) => { out[B + k] = x.signal; }); return out; },
    run3: (pts) => { const out = new Array(pts.length).fill(false); let n = 0, side = 0; for (let i = 1; i < pts.length; i += 1) { const d = pts[i].v - pts[0].v, sg = d > band ? 1 : d < -band ? -1 : 0; n = sg && sg === side ? n + 1 : sg ? 1 : 0; side = sg; out[i] = n >= TREND.SUSTAIN_RUN; } return out; },
  };
  const tally = { ewma: { episodes: 0, people: 0, caught: 0, tried: 0, delay: [] }, run3: { episodes: 0, people: 0, caught: 0, tried: 0, delay: [] } };
  const lead = Math.max(4, Math.round(MONITOR.LEAD_DAYS / everyDays)), tail = Math.ceil((illDays + 1) / everyDays) + 1;
  const keep = (arr) => (missPct > 0 ? arr.filter((_, i) => i < B || r() >= missPct / 100) : arr);
  for (let k = 0; k < runs; k += 1) {
    const phase = r() * 2 * Math.PI;
    const year = Array.from({ length: B + nYear }, (_, i) => ({ t: i * everyDays * DAY, v: 65 + s * gauss() + (seasonBpm / 2) * Math.sin(phase + (2 * Math.PI * i * everyDays) / 365), q: 'high' }));
    const t0 = (B + lead - 1 + r()) * everyDays; // the illness starts at a random moment between two checks
    const ill0 = Array.from({ length: B + lead + tail }, (_, i) => { const t = i * everyDays; return { t: t * DAY, v: 65 + s * gauss() + (t >= t0 && t < t0 + illDays ? rise : 0), q: 'high' }; });
    const yearK = keep(year), ill = keep(ill0);
    for (const name of ['ewma', 'run3']) {
      const T = tally[name], f = flags[name](yearK);
      let ep = 0;
      for (let i = B; i < yearK.length; i += 1) if (f[i] && !f[i - 1]) ep += 1;
      T.episodes += ep; if (ep) T.people += 1;
      const g = flags[name](ill);
      const tOf = (i) => ill[i].t / DAY;
      let first = ill.findIndex((q) => q.t / DAY > t0); // first check after the illness starts
      if (first < 0) first = ill.length;
      if (first > 0 && g[first - 1]) continue; // already on before the illness: not a clean test
      T.tried += 1;
      for (let i = first; i < ill.length && tOf(i) < t0 + illDays; i += 1) if (g[i] && !g[i - 1]) { T.caught += 1; T.delay.push(tOf(i) - t0); break; }
    }
  }
  const med = (a) => { if (!a.length) return null; const v = a.slice().sort((x, y) => x - y); return Math.round(v[Math.floor(v.length / 2)] * 10) / 10; };
  const pack = (T) => ({ falsePerYear: Math.round((T.episodes / runs) * 100) / 100, peopleWithFalsePct: Math.round((T.people / runs) * 100), caughtPct: T.tried ? Math.round((T.caught / T.tried) * 100) : null, medianDelayDays: med(T.delay) });
  return { runs, everyDays, sensorSd, checksPerYear: nYear, rise, illDays, seasonBpm, missPct, ewma: pack(tally.ewma), run3: pack(tally.run3) };
}


// ---------- Illness early warning (MODELED, v2.8) ----------
// Combines the person's own physiology with what they report, because in the DETECT study (Quer et al. 2021,
// Nature Medicine 27:73, 30,529 people) symptoms plus sensor changes told COVID-19 positive from negative
// symptomatic people better (AUC 0.80) than symptoms alone (0.71). Signals, each against the person's own
// recent normal with the early warning rule above: resting pulse above (own device pulse when it has enough
// history, otherwise the camera), breathing above, temperature above. Fever: a typed temperature of 38.0 °C or
// more (US CDC definition) or "Feverish or chills" ticked. Illness symptoms: feverish, stuffy nose, headache,
// short of breath. Levels:
//   possible: fever, or illness symptoms together with at least one physiology signal
//   watch: one physiology signal without symptoms, or symptoms without a physiology signal
// It never names an illness. Measured on simulated pulse alone (simulateMonitoring): a 7 bpm, 7 day rise is
// caught in 96% of cases with daily checks and an accurate sensor, 26% with checks every 3 days, 6% weekly.
const SYM_WORDS = { fever: 'feverish or chills', congestion: 'stuffy nose', headache: 'headache', breath: 'short of breath' };
export const ILLNESS = { FEVER_C: 38.0, SYMPTOMS: ['fever', 'congestion', 'headache', 'breath'] };
export function illnessWatch(sessions, { upTo = null } = {}) {
  const cut = upTo ? +new Date(upTo) : Infinity;
  const list = (sessions || []).filter((x) => +new Date(x.createdAt) <= cut);
  const checkups = list.filter(isCheckup).sort(byDate);
  const last = checkups.at(-1);
  if (!last) return null;
  const ewOf = (id) => {
    const pts = seriesFor(id, list);
    const e = ewmaChart(pts, METRIC_DEFS[id].res ? { ...EWMA, MIN_SD: METRIC_DEFS[id].res / 2 } : EWMA);
    return { id, n: pts.filter((q) => q.q !== 'low').length, up: !!(e && e.signal && e.side === 'above'), ready: !!e };
  };
  const dev = ewOf('devPulse'), cam = ewOf('pulse');
  const pulse = dev.ready ? dev : cam;
  const signals = [];
  if (pulse.up) signals.push(pulse.id === 'devPulse' ? 'pulse (own device) above your recent normal' : 'pulse (camera) above your recent normal');
  const resp = ewOf('resp'); if (resp.up) signals.push('breathing above your recent normal');
  const temp = ewOf('temp'); if (temp.up) signals.push('temperature above your recent normal');
  const t = last.devices?.tempC;
  const ticked = (last.context?.checklist || []).filter((x) => ILLNESS.SYMPTOMS.includes(x));
  const fever = (Number.isFinite(t) && t >= ILLNESS.FEVER_C) || ticked.includes('fever');
  const level = fever || (ticked.length && signals.length) ? 'possible' : signals.length || ticked.length ? 'watch' : 'none';
  return { level, fever, tempC: Number.isFinite(t) ? t : null, symptoms: ticked, symptomWords: ticked.map((x) => SYM_WORDS[x]), signals, at: last.createdAt,
    ready: pulse.ready, pulseSource: pulse.id, history: pulse.n, need: EWMA.BASE_N + 1 };
}
export function illnessLine(w) {
  if (!w) return '';
  const sy = w.symptoms.map((s) => SYM_WORDS[s]).join(', ');
  const why = [w.tempC != null && w.tempC >= ILLNESS.FEVER_C ? `temperature ${w.tempC} °C (fever is 38.0 °C or more)` : '', sy ? `symptoms: ${sy}` : '', ...w.signals].filter(Boolean).join('; ');
  if (w.level === 'possible') return `Possible illness signs: ${why}. Rest, recheck within 12 hours, keep away from others if you can, and tell a health worker or your flight surgeon. This is a warning to act on, not a diagnosis.`;
  if (w.level === 'watch') return `Worth watching: ${why}. One sign alone is often a bad night, exercise or the measurement. Recheck tomorrow at the same time.`;
  if (!w.ready) return `No illness signs today. The pulse part needs ${w.need} good checkups to know your normal; you have ${w.history}.`;
  return 'No illness signs today: no fever, no illness symptoms, and pulse, breathing and temperature within your own recent normal.';
}
