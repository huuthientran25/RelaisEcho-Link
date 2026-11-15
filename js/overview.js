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
};

export const REGIONS = [
  { id: 'head', label: 'Sleep and alertness', short: 'Sleep', metrics: ['alert'], dot: [150, 28], side: 'left', y: 2 },
  { id: 'eyes', label: 'Eyes', short: 'Eyes', metrics: ['eyegrid', 'acuityR', 'acuityL', 'lidR', 'lidL', 'gaze', 'pupil', 'pallor'], dot: [161, 48], side: 'right', y: 6 },
  { id: 'mouth', label: 'Mouth and jaw', short: 'Mouth and jaw', metrics: ['jaw', 'gum'], dot: [150, 74], side: 'left', y: 15 },
  { id: 'neck', label: 'Neck', short: 'Neck', metrics: [], dot: [150, 97], side: 'right', y: 19 },
  { id: 'heart', label: 'Heart and circulation', short: 'Heart', metrics: ['pulse', 'ptt', 'ror'], dot: [164, 150], side: 'left', y: 31 },
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

// Region status from facts already computed by the app. Returns [{ ...region, status, reasons }].
export function buildRegions(sessions, { original = null, floors = {}, sleepHours = null, latestChecklist = [] } = {}) {
  const ticks = new Set(latestChecklist || []);
  return REGIONS.map((r) => {
    const reasons = [];
    let any = false;
    for (const id of r.metrics) {
      const pts = seriesFor(id, sessions);
      if (!pts.length) continue;
      any = true;
      const ref = referenceFor(id, pts, { original, floors });
      const last = pts[pts.length - 1];
      if (pts.length > 1 || id === 'pulse' || id === 'resp' || id === 'gum') {
        const u = ['index', '0 to 1'].includes(METRIC_DEFS[id].unit) ? '' : ` ${METRIC_DEFS[id].unit}`;
        if (outside(last.v, ref)) reasons.push(`${METRIC_DEFS[id].label} ${last.v}${u} (${ref.label === 'original baseline' ? 'baseline' : ref.label === 'no change' ? 'expected' : 'first'} ${Math.round(ref.base * 100) / 100})`);
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
    return { ...r, status, reasons };
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
