// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Positioning ghost: compare the live face with the saved baseline pose and say what to fix.
// Matches apparent size and angle, never centimetres.

import { CONFIG } from './config.js';
import { FACE_OVAL } from './geometry.js';

// Template saved with a baseline: normalized outline plus pose numbers.
export function makeTemplate(lm, g) {
  return {
    oval: FACE_OVAL.map((i) => [lm[i].x, lm[i].y]),
    center: { x: g.center.x / g.W, y: g.center.y / g.H },
    faceWidth: g.faceWidth / g.W,
    roll: g.roll, yaw: g.yaw, pitchIndex: g.pitchIndex,
    aspect: g.W / g.H,
  };
}

// Generic target used before any baseline exists.
export function defaultTemplate(aspect) {
  const a = CONFIG.align;
  const fw = aspect >= 1 ? a.defaultFaceWidthLandscape : a.defaultFaceWidthPortrait;
  return { oval: null, center: { ...a.defaultCenter }, faceWidth: fw, roll: 0, yaw: 0, pitchIndex: null, aspect, isDefault: true };
}

// Returns { ok, error (0 = perfect, 1 = at tolerance), message, parts }
export function compareToTemplate(g, tpl, slack = 1) {
  const a = CONFIG.align;
  const k = tpl.isDefault ? a.defaultTolMultiplier : 1;
  const cx = g.center.x / g.W, cy = g.center.y / g.H, fw = g.faceWidth / g.W;
  const parts = {
    // Offsets in baseline face widths. y is converted to width units with the frame aspect.
    dx: (cx - tpl.center.x) / tpl.faceWidth / (a.centerTol * k),
    dy: (cy - tpl.center.y) / tpl.aspect / tpl.faceWidth / (a.centerTol * k),
    scale: (fw / tpl.faceWidth - 1) / (a.scaleTol * k),
    roll: (g.roll - tpl.roll) / (a.rollTolDeg * k),
    yaw: (g.yaw - tpl.yaw) / (a.yawTolDeg * k),
    pitch: tpl.pitchIndex == null ? 0 : (g.pitchIndex - tpl.pitchIndex) / (a.pitchTol * k),
  };
  let worst = 'dx', worstVal = 0;
  for (const [key, v] of Object.entries(parts)) if (Math.abs(v) > worstVal) { worst = key; worstVal = Math.abs(v); }
  const ok = worstVal <= slack;
  return { ok, error: worstVal, worst, parts, message: ok ? 'Hold still' : coach(worst, parts[worst]) };
}

// Words use the person's own left and right (the camera image is unmirrored).
function coach(key, v) {
  switch (key) {
    case 'dx': return v > 0 ? 'Move a little to your right' : 'Move a little to your left';
    case 'dy': return v > 0 ? 'Move up a little, or lower the camera' : 'Move down a little, or raise the camera';
    case 'scale': return v > 0 ? 'Move back a little' : 'Come a little closer';
    case 'roll': return 'Level your head';
    case 'yaw': return v > 0 ? 'Turn your head slightly to your right' : 'Turn your head slightly to your left';
    case 'pitch': return v > 0 ? 'Raise your chin a little' : 'Lower your chin a little';
    default: return 'Adjust your position';
  }
}
