// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Signal delay between Earth and Mars: why a checkup far from a clinic has to work without a live call.
// Positions: JPL "Keplerian Elements for Approximate Positions of the Major Planets", Table 1
// (valid 1800 to 2050), https://ssd.jpl.nasa.gov/planets/approx_pos.html . Each row is the six
// elements at J2000 followed by their rates per century: a (au), e, I (deg), L (deg),
// longitude of perihelion (deg), longitude of the ascending node (deg).
// "Earth" here is the Earth and Moon barycentre, which is within about 4,700 km of Earth's centre.

const ELEMENTS = {
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
};

export const AU_KM = 149597870.7;      // astronomical unit, exact by definition (IAU 2012)
export const C_KM_S = 299792.458;      // speed of light, exact by definition
export const MOON_KM = 384400;         // mean Earth to Moon distance
export const CONJUNCTION_DEG = 2;      // NASA pauses commanding Mars spacecraft when Mars is within 2 degrees of the Sun
const DEG = Math.PI / 180;
const DAY = 86400000;

const julianDate = (date) => +date / DAY + 2440587.5;

// Heliocentric position in the J2000 ecliptic plane, in au.
export function heliocentric(body, date) {
  const [el, rate] = ELEMENTS[body];
  const T = (julianDate(date) - 2451545.0) / 36525;
  const [a, e, I, L, peri, node] = el.map((v, i) => v + rate[i] * T);
  const w = peri - node;
  let M = (L - peri) % 360;
  if (M > 180) M -= 360;
  if (M < -180) M += 360;
  const eDeg = e / DEG;                 // the eccentricity in degrees, e* in JPL's notes
  let E = M + eDeg * Math.sin(M * DEG);
  for (let i = 0; i < 30; i += 1) {
    const dE = (M - (E - eDeg * Math.sin(E * DEG))) / (1 - e * Math.cos(E * DEG));
    E += dE;
    if (Math.abs(dE) <= 1e-6) break;
  }
  const xp = a * (Math.cos(E * DEG) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E * DEG);
  const cw = Math.cos(w * DEG), sw = Math.sin(w * DEG), cO = Math.cos(node * DEG), sO = Math.sin(node * DEG), cI = Math.cos(I * DEG), sI = Math.sin(I * DEG);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

// Distance, one way light time and how far Mars is from the Sun in Earth's sky.
export function earthMars(date = new Date()) {
  const e = heliocentric('earth', date), m = heliocentric('mars', date);
  const d = [m[0] - e[0], m[1] - e[1], m[2] - e[2]];
  const au = Math.hypot(...d);
  const rE = Math.hypot(...e);
  const cos = (-e[0] * d[0] - e[1] * d[1] - e[2] * d[2]) / (rE * au); // angle between Earth to Sun and Earth to Mars
  const km = au * AU_KM;
  return { au, km, oneWaySec: km / C_KM_S, elongationDeg: Math.acos(Math.max(-1, Math.min(1, cos))) / DEG };
}

// Shortest and longest delay over the coming 780 days (one Earth and Mars cycle), sampled daily,
// and the next stretch when Mars is within 2 degrees of the Sun.
export function marsCycle(from = new Date(), days = 780) {
  let min = null, max = null, conj = null;
  for (let i = 0; i <= days; i += 1) {
    const date = new Date(+from + i * DAY);
    const s = earthMars(date);
    if (!min || s.oneWaySec < min.oneWaySec) min = { date, oneWaySec: s.oneWaySec };
    if (!max || s.oneWaySec > max.oneWaySec) max = { date, oneWaySec: s.oneWaySec };
    if (s.elongationDeg < CONJUNCTION_DEG) {
      if (!conj) conj = { start: date, end: date, days: 1 };
      else if (+date - +conj.end <= DAY) { conj.end = date; conj.days += 1; }
    }
  }
  return { min, max, conjunction: conj };
}

export const moonOneWaySec = () => MOON_KM / C_KM_S;

export function fmtDelay(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${sec < 10 ? sec.toFixed(1) : s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}
