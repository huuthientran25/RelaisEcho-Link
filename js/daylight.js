// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Daylight: how long the Sun is up today at a given latitude, next to the 16 sunrises a day on the ISS.
// Formulas: NOAA's general solar position equations (fractional year, declination), sunrise and
// sunset at a zenith of 90.833 degrees (refraction and the Sun's radius included).

const rad = (d) => (d * Math.PI) / 180;

export function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
}

// Solar declination in radians for a day of the year (1 to 366), at local noon.
export function declination(doy, daysInYear = 365) {
  const g = ((2 * Math.PI) / daysInYear) * (doy - 1);
  return 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
}

// { hours, kind }: kind is 'normal', 'polarNight' (Sun never rises) or 'midnightSun' (Sun never sets).
export function dayLength(latDeg, date = new Date()) {
  const lat = Math.max(-89.9, Math.min(89.9, Number(latDeg)));
  if (!Number.isFinite(lat)) return null;
  const y = date.getUTCFullYear();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const decl = declination(dayOfYear(date), leap ? 366 : 365);
  const cosH = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl);
  if (cosH >= 1) return { hours: 0, kind: 'polarNight' };
  if (cosH <= -1) return { hours: 24, kind: 'midnightSun' };
  return { hours: (2 * (Math.acos(cosH) * 180) / Math.PI) / 15, kind: 'normal' };
}

export const fmtHours = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };

// Latitudes rounded to 0.1 degree. Northern communities first, then Montreal as a southern comparison.
export const PLACES = [
  { id: 'iqaluit', name: 'Iqaluit, Nunavut', lat: 63.7 },
  { id: 'kuujjuaq', name: 'Kuujjuaq, Nunavik', lat: 58.1 },
  { id: 'rankin', name: 'Rankin Inlet, Nunavut', lat: 62.8 },
  { id: 'pond', name: 'Pond Inlet, Nunavut', lat: 72.7 },
  { id: 'resolute', name: 'Resolute, Nunavut', lat: 74.7 },
  { id: 'grise', name: 'Grise Fiord, Nunavut', lat: 76.4 },
  { id: 'montreal', name: 'Montreal, Quebec', lat: 45.5 },
];

export const ISS_SUNRISES_PER_DAY = 16; // NASA, International Space Station Facts and Figures
