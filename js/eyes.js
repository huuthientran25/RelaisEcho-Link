// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Eye closure during the alertness check. EXPERIMENTAL.
// Eye aspect ratio (EAR): eyelid opening divided by eye width (Soukupová and Čech 2016),
// computed on MediaPipe Face Mesh landmarks. Thresholds are MODELED and relative to the
// person's own open-eye value, so no population cut off is used.

export const EYE_CONFIG = {
  closedFrac: 0.6,       // closed when EAR falls below 60% of this person's open-eye EAR
  warmupMs: 3000,        // collect this long before judging closure
  longClosureMs: 500,    // closures at least this long are counted separately from blinks
  openPercentile: 0.9,   // open-eye reference: 90th percentile of recent EAR
  refWindow: 300,        // samples kept for the reference
};

// MediaPipe Face Mesh indices: corner, corner, two upper and two lower lid points per eye.
const LEFT = { p1: 33, p4: 133, p2: 160, p6: 144, p3: 158, p5: 153 };
const RIGHT = { p1: 362, p4: 263, p2: 385, p6: 380, p3: 387, p5: 373 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function ear(lm, e) {
  const w = dist(lm[e.p1], lm[e.p4]);
  if (!(w > 1e-6)) return null;
  return (dist(lm[e.p2], lm[e.p6]) + dist(lm[e.p3], lm[e.p5])) / (2 * w);
}

// Mean of both eyes, or null when the landmarks are unusable.
export function eyeAspect(lm) {
  if (!lm) return null;
  const l = ear(lm, LEFT), r = ear(lm, RIGHT);
  if (l == null || r == null) return null;
  return (l + r) / 2;
}

export class EyeTracker {
  constructor(cfg = EYE_CONFIG) {
    this.cfg = cfg;
    this.recent = [];
    this.t0 = null; this.lastT = null;
    this.trackedMs = 0; this.closedMs = 0; this.totalMs = 0;
    this.closedSince = null;
    this.blinks = 0; this.longClosures = 0;
  }

  get openRef() {
    if (this.recent.length < 10) return null;
    const s = [...this.recent].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * this.cfg.openPercentile))];
  }

  // t in ms; value is the eye aspect ratio or null when no face was found.
  push(t, value) {
    if (this.t0 === null) this.t0 = t;
    const dt = this.lastT === null ? 0 : Math.min(250, Math.max(0, t - this.lastT));
    this.lastT = t;
    this.totalMs += dt;
    if (value == null) { this.endClosure(t); return; }
    this.recent.push(value);
    if (this.recent.length > this.cfg.refWindow) this.recent.shift();
    if (t - this.t0 < this.cfg.warmupMs) return;
    const ref = this.openRef;
    if (!ref) return;
    this.trackedMs += dt;
    const closed = value < this.cfg.closedFrac * ref;
    if (closed) {
      this.closedMs += dt;
      if (this.closedSince === null) this.closedSince = t;
    } else this.endClosure(t);
  }

  endClosure(t) {
    if (this.closedSince === null) return;
    const len = t - this.closedSince;
    if (len >= this.cfg.longClosureMs) this.longClosures += 1; else this.blinks += 1;
    this.closedSince = null;
  }

  summary() {
    if (this.lastT !== null) this.endClosure(this.lastT);
    const min = this.trackedMs / 60000;
    return {
      trackedPct: this.totalMs ? Math.round((100 * this.trackedMs) / this.totalMs) : 0,
      blinksPerMin: min > 0.25 ? Math.round((this.blinks / min) * 10) / 10 : null,
      longClosures: this.longClosures,
      closedPct: this.trackedMs ? Math.round((1000 * this.closedMs) / this.trackedMs) / 10 : null,
    };
  }
}

// Eye opening in mm (EXPERIMENTAL): the gap between upper and lower lid at two points per eye (the same
// landmarks as the blink measure), scaled by assuming an 11.7 mm iris. Compared only with the person's own
// original baseline; a lid that sits lower or higher than before is something to show a clinician.
import { irisInfo } from './exp.js';
export const LID = { bandMm: 1.0, minFrames: 30, openQuantile: 0.75 };
export function lidOpeningMm(lm, W, H) {
  const iris = irisInfo(lm, W, H);
  if (!iris || !iris.pxPerMm) return null;
  const d = (a, b) => Math.hypot((lm[a].x - lm[b].x) * W, (lm[a].y - lm[b].y) * H);
  return { right: ((d(RIGHT_LID.p2, RIGHT_LID.p6) + d(RIGHT_LID.p3, RIGHT_LID.p5)) / 2) / iris.pxPerMm,
    left: ((d(LEFT_LID.p2, LEFT_LID.p6) + d(LEFT_LID.p3, LEFT_LID.p5)) / 2) / iris.pxPerMm };
}
const RIGHT_LID = { p2: 160, p6: 144, p3: 158, p5: 153 };
const LEFT_LID = { p2: 385, p6: 380, p3: 387, p5: 373 };
// Open-eye value per eye: the 75th percentile of frames, so blinks and half closed frames do not pull it down.
export function summarizeLids(frames, cfg = LID) {
  const out = { frames: 0 };
  for (const side of ['right', 'left']) {
    const v = frames.filter((f) => f && Number.isFinite(f[side]) && f[side] > 0).map((f) => f[side]).sort((a, b) => a - b);
    out.frames = Math.max(out.frames, v.length);
    out[side] = v.length >= cfg.minFrames ? Math.round(v[Math.min(v.length - 1, Math.floor(v.length * cfg.openQuantile))] * 10) / 10 : null;
  }
  out.diffMm = out.right != null && out.left != null ? Math.round((out.right - out.left) * 10) / 10 : null;
  return out.right == null && out.left == null ? null : out;
}
export function compareLids(today, base, band = LID.bandMm) {
  if (!today) return { verdict: 'none', rows: [] };
  const rows = ['right', 'left'].map((side) => {
    const t = today[side], b = base ? base[side] : null;
    const d = t != null && b != null ? Math.round((t - b) * 10) / 10 : null;
    return { side, today: t, base: b, delta: d, outside: d != null && Math.abs(d) > band + 1e-9 };
  });
  return { verdict: !base ? 'reference' : rows.some((r) => r.outside) ? 'different' : 'same', rows };
}
