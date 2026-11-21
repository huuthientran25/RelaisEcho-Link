// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Inspiration4 crew blood data (NASA OSDR OSD-575): shows why a personal baseline matters.
// Published data, shown for context. Nothing here is about the user.

export const PRE = ['L-92', 'L-44', 'L-3'];

// For one analyte: each crew member's own pre-flight spread, the day after landing (R+1),
// and whether R+1 sits inside the lab's population range and inside their own pre-flight range.
export function summarizeCrew(analyte, timepoints) {
  const idx = (tp) => timepoints.indexOf(tp);
  const out = {};
  for (const [crew, vals] of Object.entries(analyte.series)) {
    const pre = PRE.map((tp) => vals[idx(tp)]).filter((v) => v != null);
    const r1 = vals[idx('R+1')];
    if (!pre.length || r1 == null) { out[crew] = null; continue; }
    const preMean = pre.reduce((a, b) => a + b, 0) / pre.length;
    const preMin = Math.min(...pre), preMax = Math.max(...pre);
    const hasLab = analyte.rangeMin != null && analyte.rangeMax != null;
    const inLab = hasLab ? r1 >= analyte.rangeMin && r1 <= analyte.rangeMax : null;   // null: research assay, no lab range
    const inOwn = r1 >= preMin && r1 <= preMax;
    out[crew] = { preMean, preMin, preMax, r1, pct: ((r1 - preMean) / preMean) * 100, inLab, inOwn };
  }
  return out;
}

// How often the population range and the person's own baseline tell different stories, across all analytes.
// normalButUnusual: day after landing, inside the lab range but outside that person's own three pre-flight values.
// preOutsideLab: pre-flight values (their usual) that the population range would already flag.
export function rangeDisagreements(data) {
  let normalButUnusual = 0, r1Total = 0, preOutsideLab = 0, preTotal = 0;
  const idx = (tp) => data.timepoints.indexOf(tp);
  for (const a of data.analytes) {
    if (a.rangeMin == null || a.rangeMax == null) continue;
    const s = summarizeCrew(a, data.timepoints);
    for (const [crew, v] of Object.entries(s)) {
      if (!v) continue;
      r1Total += 1;
      if (v.inLab && !v.inOwn) normalButUnusual += 1;
      for (const tp of PRE) {
        const x = a.series[crew][idx(tp)];
        if (x == null) continue;
        preTotal += 1;
        if (x < a.rangeMin || x > a.rangeMax) preOutsideLab += 1;
      }
    }
  }
  return { normalButUnusual, r1Total, preOutsideLab, preTotal };
}

// Research assays without a lab range: how many day-after-landing values rose above the person's own pre-flight maximum.
export function aboveOwnAfterFlight(data) {
  let above = 0, total = 0;
  for (const a of data.analytes) {
    if (a.rangeMin != null) continue;
    for (const v of Object.values(summarizeCrew(a, data.timepoints))) {
      if (!v) continue;
      total += 1;
      if (v.r1 > v.preMax) above += 1;
    }
  }
  return { above, total };
}

// Compact number for labels: 18 385 000 -> 18.4M, 1606.5 -> 1607, 3.19 -> 3.2
export function compact(v) {
  if (v == null || !Number.isFinite(v)) return '-';
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${Math.round(v / 1e3)}k`;
  if (a >= 20) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

// Backtest on the real crew data (v2.3). Three questions, each answered against what chance alone would give.
// 1. Day 1 results outside the person's own range: the min to max of three pre-flight values (by chance, a new value
//    from an unchanged person lands outside it half the time) and a 95% personal prediction interval
//    (mean ± t(0.975, 2 df) × SD × √(1 + 1/3); by chance, 5% of the time).
// 2. For results outside the 95% interval: the first later visit back inside it.
// 3. Prediction: day 1 from pre-flight values (mean, last value, straight line), and day 45 from either the pre-flight
//    mean (assumes recovery) or the day 1 value (assumes the change persists). Median absolute percentage error.
export const BACKTEST_DAY = { 'L-92': -92, 'L-44': -44, 'L-3': -3, 'R+1': 4, 'R+45': 48, 'R+82': 85, 'R+194': 197 }; // 3 day flight
export function backtestCrew(data) {
  const idx = (tp) => data.timepoints.indexOf(tp);
  const k = 4.303 * Math.sqrt(1 + 1 / 3);
  const med = (a) => { const v = a.slice().sort((x, y) => x - y); const n = v.length; return n ? Math.round((n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) * 10) / 10 : null; };
  const pctErr = (p, x) => (x ? (Math.abs(p - x) / Math.abs(x)) * 100 : null);
  let series = 0, outsideRange = 0;
  const standouts = [], returned = { 'R+45': 0, 'R+82': 0, 'R+194': 0, never: 0 };
  const e1 = { mean: [], last: [], trend: [] }, e45 = { premean: [], persist: [] };
  let premeanBetter = 0;
  for (const a of data.analytes) {
    for (const [crew, vals] of Object.entries(a.series)) {
      const pre = PRE.map((tp) => vals[idx(tp)]);
      const r1 = vals[idx('R+1')];
      if (pre.some((v) => v == null) || r1 == null) continue;
      const m = pre.reduce((s, v) => s + v, 0) / 3;
      const sd = Math.sqrt(pre.reduce((s, v) => s + (v - m) ** 2, 0) / 2);
      if (!(sd > 0)) continue;
      series += 1;
      if (r1 < Math.min(...pre) || r1 > Math.max(...pre)) outsideRange += 1;
      if (Math.abs(r1 - m) > k * sd) {
        standouts.push({ name: a.name, crew, z: Math.round(((r1 - m) / sd) * 10) / 10 });
        let back = 'never';
        for (const tp of ['R+45', 'R+82', 'R+194']) { const x = vals[idx(tp)]; if (x != null && Math.abs(x - m) <= k * sd) { back = tp; break; } }
        returned[back] += 1;
      }
      const xs = PRE.map((tp) => BACKTEST_DAY[tp]), mx = xs.reduce((s, v) => s + v, 0) / 3;
      const b = xs.reduce((s, x, i) => s + (x - mx) * (pre[i] - m), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
      const trend = m + b * (BACKTEST_DAY['R+1'] - mx);
      for (const [key, p] of [['mean', m], ['last', pre[2]], ['trend', trend]]) { const e = pctErr(p, r1); if (e != null) e1[key].push(e); }
      const r45 = vals[idx('R+45')];
      if (r45 != null && r45 !== 0) {
        const a1 = pctErr(m, r45), a2 = pctErr(r1, r45);
        e45.premean.push(a1); e45.persist.push(a2);
        if (a1 < a2) premeanBetter += 1;
      }
    }
  }
  standouts.sort((x, y) => Math.abs(y.z) - Math.abs(x.z));
  const il6 = data.analytes.find((x) => x.key === 'il_6');
  const il6s = il6 ? Object.values(summarizeCrew(il6, data.timepoints)).filter(Boolean) : [];
  const il6up = il6s.filter((v) => v.r1 > v.preMax).length;
  return {
    series, outsideRange, expectedRange: Math.round(series * 0.5), outsidePI: standouts.length, expectedPI: Math.round(series * 0.05 * 10) / 10,
    standouts, returned,
    predictR1: { mean: med(e1.mean), last: med(e1.last), trend: med(e1.trend), n: e1.mean.length },
    predictR45: { premean: med(e45.premean), persist: med(e45.persist), premeanBetter, n: e45.premean.length },
    il6: { up: il6up, n: il6s.length, chanceOneIn: il6s.length ? 4 ** il6s.length : null },
  };
}

// ---------- Personal ranges that borrow published biological variation (MODELED, v2.4) ----------
// Within-person biological variation (CVI, %) of healthy adults sampled weekly. Sources: EuBIVAS summary
// (Carobene et al. 2022, Clin Chem Lab Med 60:505, doi 10.1515/cclm-2021-0370, Table 2) and, for IL-6, the EFLM
// Biological Variation Database meta-analysis (biologicalvariation.eu, 4 studies). Creatinine uses the Jaffe row.
// Limits: the lab's own measurement error is not known here and is taken as zero, and the crew were sampled
// weeks to months apart, so these ranges are if anything too narrow.
export const BIO_VARIATION = {
  glucose: 4.7, sodium: 0.53, potassium: 3.92, chloride: 0.98, calcium: 1.81, urea_nitrogen_bun: 14.1,
  total_protein: 2.6, albumin: 2.5, alt: 9.3, ast: 9.5, alkaline_phosphatase: 5.3, creatinine: 4.7,
  total_bilirubin: 20.9, il_6: 31.9,
};
const T975_DF = { 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 12: 2.179, 15: 2.131, 20: 2.086 };
const t975 = (df) => T975_DF[df] || (df > 20 ? 1.96 + 2.5 / df : T975_DF[Math.max(...Object.keys(T975_DF).map(Number).filter((k) => k <= df))]);
// Adaptive personal range on the log scale. The spread starts at the published within-person variation
// (worth NU0 pseudo values, a design choice) and moves to the person's own spread as their values add up:
// variance = (NU0 * prior + (n - 1) * own) / (NU0 + n - 1). The same idea as the Athlete Biological Passport's
// adaptive model (Sottas et al.), reduced to one conjugate update.
export const ADAPTIVE_NU0 = 4;
export function adaptiveRange(values, cviPct, nu0 = ADAPTIVE_NU0) {
  const v = (values || []).filter((x) => Number.isFinite(x) && x > 0);
  if (!v.length || !(cviPct > 0)) return null;
  const n = v.length, ln = v.map(Math.log), m = ln.reduce((s, x) => s + x, 0) / n;
  const s2 = n > 1 ? ln.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1) : 0;
  const p2 = Math.log(1 + (cviPct / 100) ** 2);
  const df = nu0 + n - 1, var_ = (nu0 * p2 + (n - 1) * s2) / df;
  const half = t975(df) * Math.sqrt(var_ * (1 + 1 / n));
  const rcv = 1.96 * Math.sqrt(p2 * (1 + 1 / n));
  return {
    n, centre: Math.exp(m), lo: Math.exp(m - half), hi: Math.exp(m + half),
    ownWeight: Math.round(((n - 1) / df) * 100), // share of the spread that comes from the person's own values
    rcvLo: Math.exp(m - rcv), rcvHi: Math.exp(m + rcv), risePct: Math.round((Math.exp(rcv) - 1) * 100), fallPct: Math.round((1 - Math.exp(-rcv)) * 100),
  };
}
// Day 1 after flight against three kinds of personal range, on the analytes that have published variation.
export function adaptiveBacktest(data) {
  const idx = (tp) => data.timepoints.indexOf(tp);
  const out = { series: 0, own: 0, rcv: 0, adaptive: 0, flagged: [], il6: [] };
  for (const a of data.analytes) {
    const cvi = BIO_VARIATION[a.key];
    if (!cvi) continue;
    for (const [crew, vals] of Object.entries(a.series)) {
      const pre = PRE.map((tp) => vals[idx(tp)]), r1 = vals[idx('R+1')];
      if (pre.some((x) => !(x > 0)) || !(r1 > 0)) continue;
      const g = adaptiveRange(pre, cvi);
      const ln = pre.map(Math.log), m = ln.reduce((s, x) => s + x, 0) / 3, sd = Math.sqrt(ln.reduce((s, x) => s + (x - m) ** 2, 0) / 2);
      out.series += 1;
      const own = Math.abs(Math.log(r1) - m) > 4.303 * sd * Math.sqrt(4 / 3);
      const rcv = r1 < g.rcvLo || r1 > g.rcvHi, ad = r1 < g.lo || r1 > g.hi;
      if (own) out.own += 1;
      if (rcv) out.rcv += 1;
      if (ad) out.adaptive += 1;
      const changePct = Math.round((r1 / g.centre - 1) * 100);
      if (ad || rcv) out.flagged.push({ name: a.name, key: a.key, crew, changePct, adaptive: ad, rcv });
      if (a.key === 'il_6') out.il6.push({ crew, changePct, risePct: g.risePct, beyond: r1 > g.rcvHi, adaptive: r1 > g.hi });
    }
  }
  out.expected = Math.round(out.series * 0.05 * 10) / 10;
  out.flagged.sort((x, y) => Math.abs(y.changePct) - Math.abs(x.changePct));
  return out;
}
