// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Eye chart: a tumbling E letter chart, one eye at a time, scored in logMAR the way ETDRS charts are
// (five letters a line, 0.1 logMAR between lines, 0.02 per letter). EXPERIMENTAL self check, compared only
// with the person's own first check on the same screen and distance. Pure functions; the screen is in main.js.

export const ACUITY = {
  topLogmar: 1.0,          // largest line (20/200)
  startLogmar: 0.6,        // first line shown
  perLine: 5,
  minPx: 5,                // an E needs at least 5 screen pixels of height to be drawn honestly (5 strokes and gaps)
  bandLogmar: 0.2,         // change of 2 lines or more counts as "different from your first check" (MODELED)
  distancesMm: [400, 1000, 2000],
};
export const DIRS = ['right', 'down', 'left', 'up'];

// Letter height in mm: the whole E subtends 5 minutes of arc at logMAR 0, times 10^logMAR.
export const optoMm = (logmar, distMm) => distMm * Math.tan(((5 / 60) * Math.PI / 180) * 10 ** logmar);
export const snellen = (logmar) => `20/${Math.round(20 * 10 ** logmar)}`;
const round1 = (x) => Math.round(x * 10) / 10;

// Smallest line this screen can draw at this distance (letters at least minPx tall), rounded up to a line.
export function floorLogmar(pxPerMm, distMm, minPx = ACUITY.minPx) {
  for (let l = -0.3; l <= ACUITY.topLogmar + 1e-9; l = round1(l + 0.1)) if (optoMm(l, distMm) * pxPerMm >= minPx) return round1(l);
  return null;
}
export function lineList(floor) {
  const out = [];
  for (let l = ACUITY.topLogmar; l >= floor - 1e-9; l = round1(l - 0.1)) out.push(round1(l));
  return out;
}

// Five directions for one line: every direction at least once, no three in a row the same.
export function lineDirs(rand = Math.random) {
  const d = [...DIRS, DIRS[Math.floor(rand() * 4)]];
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

// The run for one eye. Starts at startLogmar (or the smallest line the screen allows, if larger). If the start
// line has fewer than 3 right it steps up a line at a time. Then it steps down until a line has 2 or fewer
// right or the screen limit is reached.
export class AcuityRun {
  constructor(floor, rand = Math.random) {
    this.lines = lineList(floor);
    this.rand = rand;
    const startIdx = this.lines.findIndex((l) => l <= ACUITY.startLogmar + 1e-9);
    this.idx = startIdx < 0 ? this.lines.length - 1 : startIdx;
    this.startIdx = this.idx;
    this.dir = 'start';           // 'up' while looking for a passed line above the start, then 'down'
    this.results = {};            // logmar -> correct count
    this.topPassedIdx = null;
    this.done = false;
    this.newLine();
  }
  newLine() { this.dirs = lineDirs(this.rand); this.pos = 0; this.correct = 0; }
  get logmar() { return this.lines[this.idx]; }
  get target() { return this.dirs[this.pos]; }
  answer(dir) {
    if (this.done) return;
    if (dir === this.target) this.correct += 1;
    this.pos += 1;
    if (this.pos < ACUITY.perLine) return;
    const l = this.logmar, c = this.correct;
    this.results[l] = c;
    const passed = c >= 3;
    if (this.dir === 'start' || this.dir === 'up') {
      if (passed) {
        this.topPassedIdx = this.idx;
        this.dir = 'down';
        this.idx = Math.max(this.idx, this.startIdx) + 1; // continue below the lowest line already tested
      } else if (this.idx > 0) { this.dir = 'up'; this.idx -= 1; this.newLine(); return; } else { this.done = true; return; }
    } else if (!passed) { this.done = true; return; } else this.idx += 1;
    if (this.idx >= this.lines.length || this.results[this.lines[this.idx]] != null) { this.done = true; return; }
    this.newLine();
  }
  // ETDRS style letter score: lines above the highest line tested count as read.
  score() {
    const tested = Object.keys(this.results).map(Number);
    if (!tested.length) return null;
    const top = Math.max(...tested);
    const above = this.lines.filter((l) => l > top + 1e-9).length * ACUITY.perLine;
    const letters = above + Object.values(this.results).reduce((a, b) => a + b, 0);
    const logmar = Math.round((ACUITY.topLogmar + 0.1 - 0.02 * letters) * 100) / 100;
    const floor = this.lines[this.lines.length - 1];
    const atScreenLimit = this.results[floor] != null && this.results[floor] >= 3;
    return { logmar, letters, snellen: snellen(logmar), atScreenLimit, floor };
  }
}

// Compare one eye with the first check. Larger logMAR = worse.
export function compareAcuity(today, ref, band = ACUITY.bandLogmar) {
  if (!today || today.logmar == null) return { verdict: 'none' };
  if (!ref || ref.logmar == null) return { verdict: 'reference' };
  const d = Math.round((today.logmar - ref.logmar) * 100) / 100;
  // A result stuck at the screen limit cannot show improvement or small loss below that limit.
  const verdict = Math.abs(d) >= band - 1e-9 ? (d > 0 ? 'worse' : 'better') : 'same';
  return { verdict, delta: d, lines: Math.round(d * 10 * 10) / 10 };
}

export function acuityForPacket(rec, refRec) {
  if (!rec?.acuity) return null;
  const eye = (e) => {
    const t = rec.acuity[e];
    if (!t) return null;
    const c = compareAcuity(t, refRec && refRec !== rec ? refRec.acuity?.[e] : null);
    return { logmar: t.logmar, snellen: t.snellen, at_screen_limit: !!t.atScreenLimit, vs_first: c.verdict === 'reference' ? 'first check' : c.verdict, change_logmar: c.delta ?? null };
  };
  return { date: rec.createdAt, distance_m: rec.acuity.distanceMm / 1000, right_eye: eye('right'), left_eye: eye('left'), screen_calibrated: !!rec.acuity.calibrated,
    label: 'EXPERIMENTAL self check (tumbling E, ETDRS style scoring); compared only with the person\'s own first check' };
}
