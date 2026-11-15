// Guided dental photos: three views, each cropped to a standard frame around the mouth,
// levelled and scaled by the mouth corners so baseline and follow up photos line up.
// The app never labels decay or disease; a person reviews and marks the photos.

import { CONFIG } from './config.js';
import { LIPS_OUTER } from './geometry.js';
import { sharpnessStats } from './frame.js';
import { irisInfo, EXP } from './exp.js';

// Face distance from the camera, as the iris height in the picture over the picture width. The vertical
// iris diameter is used because turning the head (side views) narrows the iris sideways but not up and down.
// Same camera and resolution: a bigger value means closer. Not comparable across cameras.
export function irisScale(lm, videoW, videoH) {
  const iris = irisInfo(lm, videoW, videoH);
  if (!iris) return null;
  const v = Math.max(iris.right.vPx || 0, iris.left.vPx || 0);
  return v > 2 && videoW > 0 ? v / videoW : null;
}
// Rough distance in cm for display only (assumes a typical camera field of view).
export function approxDistanceCm(scale, hfovDeg = CONFIG.dental.hfovDeg) {
  if (!(scale > 0)) return null;
  const focalOverWidth = 0.5 / Math.tan((hfovDeg * Math.PI) / 360);
  return Math.round((EXP.irisMm * focalOverWidth) / scale / 10);
}
// Compare with the baseline photo's distance. ratio > 1 means closer than at baseline.
export function distanceGate(scale, target, tol = CONFIG.dental.distTol) {
  if (!(scale > 0) || !(target > 0)) return { ok: true, ratio: null };
  const ratio = scale / target;
  if (ratio < 1 - tol) return { ok: false, ratio, msg: 'Move closer to the camera, as at your baseline' };
  if (ratio > 1 + tol) return { ok: false, ratio, msg: 'Move back a little, as at your baseline' };
  return { ok: true, ratio };
}

export const VIEWS = [
  { id: 'front', label: 'Front', hint: 'Face the camera, smile so your teeth show, lips apart' },
  { id: 'right', label: 'Your right side', hint: 'Keep smiling and turn your head to your left' },
  { id: 'left', label: 'Your left side', hint: 'Keep smiling and turn your head to your right' },
];

function yawGate(viewId, yaw) {
  const c = CONFIG.dental;
  if (viewId === 'front') {
    if (Math.abs(yaw) <= c.frontMaxYawDeg) return { ok: true };
    return { ok: false, msg: yaw > 0 ? 'Turn a little to your right to face the camera' : 'Turn a little to your left to face the camera' };
  }
  // Positive yaw means the person turned to their own left, which shows their right side.
  const want = viewId === 'right' ? 1 : -1;
  const y = yaw * want;
  if (y < c.sideMinYawDeg) return { ok: false, msg: viewId === 'right' ? 'Turn your head further to your left' : 'Turn your head further to your right' };
  if (y > c.sideMaxYawDeg) return { ok: false, msg: 'Turn back a little' };
  return { ok: true };
}

// Draw a levelled, scale-normalized mouth crop from the full resolution video frame.
export function cropMouth(video, lm, out) {
  const c = CONFIG.dental;
  const W = video.videoWidth, H = video.videoHeight;
  const a = { x: lm[61].x * W, y: lm[61].y * H }, b = { x: lm[291].x * W, y: lm[291].y * H };
  let cx = 0, cy = 0;
  for (const i of LIPS_OUTER) { cx += lm[i].x * W; cy += lm[i].y * H; }
  cx /= LIPS_OUTER.length; cy /= LIPS_OUTER.length;
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const mouthW = Math.hypot(b.x - a.x, b.y - a.y);
  const scale = (c.mouthWidthInCrop * c.cropWidth) / Math.max(mouthW, 1);
  out.width = c.cropWidth; out.height = c.cropHeight;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(-angle);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.drawImage(video, 0, 0, W, H);
  ctx.restore();
  // Store lip points in crop coordinates so reviewers can see what was aligned.
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  const lips = LIPS_OUTER.map((i) => {
    const x = (lm[i].x * W - cx) * scale, y = (lm[i].y * H - cy) * scale;
    return [(x * cos - y * sin + out.width / 2) / out.width, (x * sin + y * cos + out.height / 2) / out.height];
  });
  return { lips, mouthWidthPx: mouthW, upscale: scale };
}

export class DentalCapture {
  constructor() {
    this.crop = document.createElement('canvas');
    this.small = document.createElement('canvas');
    this.small.width = 480; this.small.height = 270;
    this.reset();
  }
  reset() { this.view = 0; this.results = {}; this.good = 0; this.best = null; this.frame = 0; this.distTargets = null; this.lastScale = null; }
  get currentView() { return VIEWS[this.view]; }
  get done() { return this.view >= VIEWS.length; }
  skipView() { this.results[this.currentView.id] = { view: this.currentView.id, captured: false, reason: 'skipped by user' }; this.nextView(); }
  nextView() { this.view++; this.good = 0; this.best = null; }

  // Called each frame with landmarks and geometry. Returns UI status.
  update(video, lm, g) {
    const c = CONFIG.dental;
    if (this.done) return { done: true };
    const view = this.currentView;
    if (!lm) return { ok: false, msg: 'Face not found. Bring the camera closer to your mouth area.' };
    if (g.mouthGapRatio < c.minMouthGapRatio) return { ok: false, msg: 'Smile with lips apart so your teeth show' };
    const yg = yawGate(view.id, g.yaw);
    if (!yg.ok) return { ok: false, msg: yg.msg };
    const scale = irisScale(lm, video.videoWidth, video.videoHeight);
    this.lastScale = scale;
    const target = this.distTargets ? (this.distTargets[view.id] || this.distTargets.front) : null;
    const dg = distanceGate(scale, target);
    this.lastRatio = dg.ratio;
    if (!dg.ok) return { ok: false, msg: dg.msg };
    this.frame++;
    if (this.frame % 2) return { ok: true, msg: 'Hold still', progress: this.good / c.goodFramesNeeded };
    const meta = cropMouth(video, lm, this.crop);
    const sctx = this.small.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(this.crop, 0, 0, this.small.width, this.small.height);
    const st = sharpnessStats(sctx.getImageData(0, 0, this.small.width, this.small.height));
    if (st.meanLuma < c.minLuma) return { ok: false, msg: 'Too dark. Add light facing you (a phone flashlight helps).' };
    if (st.glareFrac > c.maxGlareFrac) return { ok: false, msg: 'Glare on the teeth. Tilt the light or the camera slightly.' };
    this.good++;
    if (!this.best || st.sharpness > this.best.sharpness) {
      this.best = { view: view.id, captured: true, sharpness: st.sharpness, meanLuma: st.meanLuma, glareFrac: st.glareFrac,
        yaw: g.yaw, lips: meta.lips, image: this.crop.toDataURL('image/jpeg', 0.88), marks: [],
        distScale: scale, videoW: video.videoWidth, distRatio: dg.ratio };
    }
    if (this.good >= c.goodFramesNeeded) {
      this.results[view.id] = { ...this.best, framesConsidered: this.good };
      this.nextView();
      return { ok: true, captured: view.id, msg: `${view.label} captured`, done: this.done };
    }
    return { ok: true, msg: 'Hold still', progress: this.good / c.goodFramesNeeded };
  }
}
