// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Space weather from NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information),
// run by the Community Coordinated Modeling Center at NASA Goddard and served by api.nasa.gov.
// Live data: needs internet, and is loaded only after the person asks for it. No user data is sent.
// Field names follow the DONKI documentation: FLR items carry classType, beginTime, peakTime,
// activeRegionNum and link; SEP items carry eventTime.

export const DONKI = {
  base: 'https://api.nasa.gov/DONKI',
  demoKey: 'DEMO_KEY',   // NASA's shared demonstration key: about 30 requests an hour per network address
  flareDays: 7,
  sepDays: 30,
  cacheHours: 3,
  timeoutMs: 9000,
};

const DAY = 24 * 3600 * 1000;
const ymd = (d) => d.toISOString().slice(0, 10);

export function donkiUrls(now = new Date(), key = DONKI.demoKey, cfg = DONKI) {
  const q = (type, days) => `${cfg.base}/${type}?startDate=${ymd(new Date(+now - days * DAY))}&endDate=${ymd(now)}&api_key=${encodeURIComponent(key || cfg.demoKey)}`;
  return { flares: q('FLR', cfg.flareDays), sep: q('SEP', cfg.sepDays) };
}

// Flare class such as "M1.2" or "X5.0" to peak X-ray flux in W/m2 (A 1e-8, B 1e-7, C 1e-6, M 1e-5, X 1e-4).
export function flareFlux(classType) {
  const m = /^([ABCMX])\s*(\d+(?:\.\d+)?)?/i.exec(String(classType ?? '').trim());
  if (!m) return null;
  const base = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 }[m[1].toUpperCase()];
  return base * (m[2] ? parseFloat(m[2]) : 1);
}

// Turns the two DONKI lists into the few numbers the tile shows. Tolerates missing or odd fields.
export function summarizeSpaceWeather(flares, seps) {
  const fl = (Array.isArray(flares) ? flares : [])
    .map((f) => ({ cls: String(f?.classType ?? '').trim().toUpperCase(), flux: flareFlux(f?.classType), peak: f?.peakTime || f?.beginTime || null, region: f?.activeRegionNum ?? null }))
    .filter((f) => f.flux != null);
  const counts = { X: 0, M: 0, C: 0, other: 0 };
  for (const f of fl) { if (f.cls[0] in counts) counts[f.cls[0]] += 1; else counts.other += 1; }
  const strongest = fl.reduce((best, f) => (!best || f.flux > best.flux ? f : best), null);
  const sepTimes = (Array.isArray(seps) ? seps : []).map((s) => s?.eventTime).filter((t) => typeof t === 'string' && t).sort();
  const level = counts.X ? 'high' : counts.M ? 'moderate' : 'low';
  return { flares: fl.length, counts, strongest, sepEvents: sepTimes.length, lastSep: sepTimes.length ? sepTimes[sepTimes.length - 1] : null, level };
}

// Fetches both lists. fetchFn is injectable for tests. Throws Error('rate'), Error('http 500'), an abort or a network error.
export async function loadSpaceWeather({ now = new Date(), key, fetchFn = fetch, cfg = DONKI } = {}) {
  const urls = donkiUrls(now, key, cfg);
  const get = async (url) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs);
    try {
      const r = await fetchFn(url, { signal: ctl.signal });
      if (r.status === 429) throw new Error('rate');
      if (!r.ok) throw new Error(`http ${r.status}`);
      const text = await r.text();
      return text.trim() ? JSON.parse(text) : []; // DONKI answers with an empty body when nothing happened
    } finally { clearTimeout(timer); }
  };
  const [flares, seps] = await Promise.all([get(urls.flares), get(urls.sep)]);
  return { fetchedAt: now.toISOString(), ...summarizeSpaceWeather(flares, seps) };
}

export const isFresh = (saved, now = new Date(), cfg = DONKI) => !!saved?.fetchedAt && +now - +new Date(saved.fetchedAt) < cfg.cacheHours * 3600 * 1000 && +now >= +new Date(saved.fetchedAt);
