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
    const inLab = r1 >= analyte.rangeMin && r1 <= analyte.rangeMax;
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
