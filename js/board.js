// Mission board: separate labelled tiles, never one combined health score.
// LIVE = measured on this device. MODELED = calculated from a published model. PUBLISHED = a published figure for context.
// Every constant below has its source next to it. Change nothing here without updating the source note.

// Two process model of sleep regulation, Process S only.
// Daan, Beersma and Borbély 1984 (Am J Physiol), parameters as tabulated in Achermann 1999 (J Biol Rhythms). S rises while awake toward 1 and decays while asleep toward 0.
export const TWO_PROCESS = {
  tauRiseH: 18.2,      // time constant of S while awake
  tauDecayH: 4.2,      // time constant of S while asleep
  upperMean: 0.67,     // mean upper threshold (sleep onset)
  lowerMean: 0.17,     // mean lower threshold (waking)
  circadianAmp: 0.12,  // amplitude of the circadian swing of both thresholds
};

const H = 3600 * 1000;

// Steady state S at bedtime for a schedule repeated every day: d hours asleep, 24 - d awake.
export function steadyBedtimeS(sleepH, p = TWO_PROCESS) {
  const a = Math.exp(-sleepH / p.tauDecayH);
  const b = Math.exp(-(24 - sleepH) / p.tauRiseH);
  return (1 - b) / (1 - a * b);
}

export function sAfterSleep(s0, hours, p = TWO_PROCESS) { return s0 * Math.exp(-hours / p.tauDecayH); }
export function sAfterWake(s0, hours, p = TWO_PROCESS) { return 1 - (1 - s0) * Math.exp(-hours / p.tauRiseH); }

// Modeled sleep pressure now, from last night's sleep and the usual sleep length before it.
// Returns the value, a band reading against the model thresholds, and a curve for drawing.
export function sleepPressure({ sleepStart, sleepEnd, now, usualSleepH }, p = TWO_PROCESS) {
  const t0 = +sleepStart, t1 = +sleepEnd, tn = +now;
  if (!(t1 > t0) || !(tn >= t0)) return null;
  const sleptH = (t1 - t0) / H;
  if (sleptH > 16) return null;
  const usual = Number.isFinite(usualSleepH) && usualSleepH > 2 && usualSleepH < 14 ? usualSleepH : sleptH;
  const sBed = steadyBedtimeS(usual, p);
  const at = (t) => {
    if (t < t0) {
      // Before last bedtime: assume the usual schedule the day before.
      const prevBed = t0 - 24 * H, prevWake = prevBed + usual * H;
      if (t <= prevWake) return sAfterSleep(sBed, Math.max(0, (t - prevBed) / H), p);
      return sAfterWake(sAfterSleep(sBed, usual, p), (t - prevWake) / H, p);
    }
    if (t <= t1) return sAfterSleep(sBed, (t - t0) / H, p);
    return sAfterWake(sAfterSleep(sBed, sleptH, p), (t - t1) / H, p);
  };
  const s = at(tn);
  const lo = p.upperMean - p.circadianAmp, hi = p.upperMean + p.circadianAmp;
  const band = s < lo ? 'below' : s > hi ? 'above' : 'within';
  const curve = [];
  const from = Math.max(t0 - 24 * H, Math.min(t0 - 6 * H, tn - 30 * H)), to = tn;
  for (let t = from; t <= to + 1; t += 15 * 60 * 1000) curve.push({ t, s: at(t) });
  return { s, sleptH, usualH: usual, band, lo, hi, curve, from, to, asleepNow: tn <= t1 };
}

// Radiation context. Figures are published values; the mission estimate is simple multiplication.
export const RADIATION = {
  careerLimitMsv: 600,       // NASA-STD-3001 Vol 1, standard 4030: career effective dose below 600 mSv, all ages and sexes
  issLowMsvPerDay: 0.4,      // Cucinotta et al. 2008, Radiat Res 170:127: 19 ISS crew, mean 72 mSv over about 6 months
  issHighMsvPerDay: 0.85,    // about 310 mSv per year upper end, Chancellor et al. 2017 as cited in later reviews
  designFreeSpaceMsvPerDay: 1.3, // NASA-STD-3001 long mission design limit, free space
  designSurfaceMsvPerDay: 0.9,   // NASA-STD-3001 long mission design limit, planetary surface
};

export function issMissionDose(days, r = RADIATION) {
  const d = Math.max(0, Number(days) || 0);
  const low = d * r.issLowMsvPerDay, high = d * r.issHighMsvPerDay;
  return { days: d, low, high, fracLow: low / r.careerLimitMsv, fracHigh: high / r.careerLimitMsv };
}

// Checkup consistency: counts and time of day matching. Encourages regular, comparable checkups.
export function consistency(sessions, now = new Date()) {
  const done = sessions.filter((s) => s.complete || s.pulse || s.resp);
  const week = done.filter((s) => +now - +new Date(s.createdAt) <= 7 * 24 * H);
  const original = done.find((s) => s.isOriginal) || done.find((s) => s.kind === 'baseline');
  const last = done.length ? done[done.length - 1] : null;
  const minutes = (d) => d.getHours() * 60 + d.getMinutes();
  let timeGapMin = null;
  if (original) {
    const g = Math.abs(minutes(now) - minutes(new Date(original.createdAt)));
    timeGapMin = Math.min(g, 1440 - g);
  }
  // Distinct days with a checkup in the last 7, for a gentle streak.
  const days = new Set(week.map((s) => new Date(s.createdAt).toDateString()));
  return { total: done.length, thisWeek: week.length, daysThisWeek: days.size, original, last, timeGapMin };
}
