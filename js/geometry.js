// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Face geometry from MediaPipe Face Landmarker (478 points, normalized image coordinates).
// Index lists follow MediaPipe's face mesh topology.

export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
export const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
export const KEY = {
  foreheadTop: 10, foreheadMid: 151, noseTip: 1, chin: 152,
  eyeOuterA: 33, eyeOuterB: 263, faceEdgeA: 234, faceEdgeB: 454,
  cheekA: 50, cheekB: 280, mouthA: 61, mouthB: 291, lipInnerTop: 13, lipInnerBottom: 14,
};
const KEYPOINTS = [33, 263, 1, 61, 291, 152, 10, 234, 454];

const deg = (r) => (r * 180) / Math.PI;

// lm: array of {x, y, z}; W, H: pixel size of the analysed frame.
export function faceGeometry(lm, W, H) {
  const P = (i) => ({ x: lm[i].x * W, y: lm[i].y * H });
  const ea = P(KEY.eyeOuterA), eb = P(KEY.eyeOuterB);
  const fa = P(KEY.faceEdgeA), fb = P(KEY.faceEdgeB);
  const nose = P(KEY.noseTip), chin = P(KEY.chin), top = P(KEY.foreheadTop);
  const faceWidth = Math.hypot(fb.x - fa.x, fb.y - fa.y);
  const faceHeight = Math.hypot(chin.x - top.x, chin.y - top.y);
  const center = { x: (fa.x + fb.x + top.x + chin.x) / 4, y: (fa.y + fb.y + top.y + chin.y) / 4 };
  const roll = deg(Math.atan2(eb.y - ea.y, eb.x - ea.x));
  // Turn index: where the nose tip sits between the two face edges (0.5 = facing camera).
  // In an unmirrored camera image the subject's left is image right, so a positive value
  // means the person has turned toward their own left. Degrees are approximate.
  const span = fb.x - fa.x;
  const r = span !== 0 ? (nose.x - fa.x) / span : 0.5;
  const yaw = deg(Math.asin(Math.max(-1, Math.min(1, (r - 0.5) * 2))));
  const eyeMidY = (ea.y + eb.y) / 2;
  const pitchIndex = chin.y - eyeMidY !== 0 ? (nose.y - eyeMidY) / (chin.y - eyeMidY) : 0.5;
  const mouthA = P(KEY.mouthA), mouthB = P(KEY.mouthB);
  const mouthWidth = Math.hypot(mouthB.x - mouthA.x, mouthB.y - mouthA.y);
  const lipT = P(KEY.lipInnerTop), lipB = P(KEY.lipInnerBottom);
  const mouthGapRatio = mouthWidth > 0 ? Math.hypot(lipB.x - lipT.x, lipB.y - lipT.y) / mouthWidth : 0;
  return { faceWidth, faceHeight, center, roll, yaw, pitchIndex, mouthA, mouthB, mouthWidth, mouthGapRatio, chin, top, W, H };
}

export function keypointArray(lm) {
  return KEYPOINTS.map((i) => [lm[i].x, lm[i].y]);
}

// Mean landmark movement between frames, in face widths per second.
export function motionSpeed(prevKp, kp, faceWidthNorm, dtSec) {
  if (!prevKp || dtSec <= 0) return 0;
  let s = 0;
  for (let i = 0; i < kp.length; i++) s += Math.hypot(kp[i][0] - prevKp[i][0], kp[i][1] - prevKp[i][1]);
  return s / kp.length / Math.max(faceWidthNorm, 1e-6) / dtSec;
}

// Skin regions for pulse: forehead and both cheeks, sized from face width. Pixel boxes.
export function pulseRois(lm, g) {
  return pulseRegions(lm, g).slice(0, 3).map((r) => r.box);
}

// Nine skin regions for the pulse. The first three are the classic forehead and cheeks; the
// others add forehead sides, the area between the brows, upper cheeks and chin. Each region is
// tracked on its own so the cleanest ones can be chosen after the scan (see pulse.js).
// MediaPipe Face Mesh indices.
export const PULSE_REGIONS = [
  { id: 'forehead', label: 'forehead centre', i: KEY.foreheadMid, dy: -0.06, w: 0.34, h: 0.12 },
  { id: 'cheekL', label: 'left cheek', i: KEY.cheekA, dy: 0, w: 0.15, h: 0.13 },
  { id: 'cheekR', label: 'right cheek', i: KEY.cheekB, dy: 0, w: 0.15, h: 0.13 },
  { id: 'foreheadL', label: 'forehead left', i: 108, dy: 0, w: 0.13, h: 0.10 },
  { id: 'foreheadR', label: 'forehead right', i: 337, dy: 0, w: 0.13, h: 0.10 },
  { id: 'glabella', label: 'between the brows', i: 9, dy: 0, w: 0.10, h: 0.08 },
  { id: 'malarL', label: 'upper left cheek', i: 117, dy: 0.02, w: 0.12, h: 0.09 },
  { id: 'malarR', label: 'upper right cheek', i: 346, dy: 0.02, w: 0.12, h: 0.09 },
  { id: 'chin', label: 'chin', i: 199, dy: 0, w: 0.16, h: 0.08 },
];

export function pulseRegions(lm, g) {
  const fw = g.faceWidth;
  return PULSE_REGIONS.map((r) => {
    const c = { x: lm[r.i].x * g.W, y: lm[r.i].y * g.H + r.dy * fw };
    return { id: r.id, label: r.label, box: { x: c.x - (r.w * fw) / 2, y: c.y - (r.h * fw) / 2, w: r.w * fw, h: r.h * fw } };
  });
}

// Upper torso box under the chin for breathing.
export function torsoRoi(g) {
  const x0 = g.center.x - 1.1 * g.faceWidth, x1 = g.center.x + 1.1 * g.faceWidth;
  const y0 = g.chin.y + 0.3 * g.faceHeight, y1 = g.chin.y + 1.05 * g.faceHeight;
  const cx0 = Math.max(0, x0), cx1 = Math.min(g.W, x1), cy0 = Math.max(0, y0), cy1 = Math.min(g.H, y1);
  return { x: cx0, y: cy0, w: Math.max(0, cx1 - cx0), h: Math.max(0, cy1 - cy0), visibleFrac: Math.max(0, cy1 - cy0) / Math.max(1, y1 - y0) };
}

// Narrow band directly under the chin (neck and collar). It stays inside the frame when the
// shoulders do not, so breathing can still be tracked on a close laptop camera.
export function neckRoi(g) {
  const cx = g.chin.x;
  const x0 = cx - 0.55 * g.faceWidth, x1 = cx + 0.55 * g.faceWidth;
  const y0 = g.chin.y + 0.10 * g.faceHeight, y1 = g.chin.y + 0.55 * g.faceHeight;
  const cx0 = Math.max(0, x0), cx1 = Math.min(g.W, x1), cy0 = Math.max(0, y0), cy1 = Math.min(g.H, y1);
  return { x: cx0, y: cy0, w: Math.max(0, cx1 - cx0), h: Math.max(0, cy1 - cy0), visibleFrac: Math.max(0, cy1 - cy0) / Math.max(1, y1 - y0) };
}
