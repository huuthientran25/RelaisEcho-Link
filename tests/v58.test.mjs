// v0.58: dental face distance against the baseline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { irisScale, distanceGate, approxDistanceCm } from '../js/dental.js';

function face(irisNorm) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (i, x, y) => { lm[i] = { x, y, z: 0 }; };
  set(33, 0.40, 0.4); set(133, 0.46, 0.4); set(362, 0.54, 0.4); set(263, 0.60, 0.4);
  const iris = (c, cx, rH, rV) => { set(c, cx, 0.4); set(c + 1, cx + rH, 0.4); set(c + 2, cx, 0.4 - rV); set(c + 3, cx - rH, 0.4); set(c + 4, cx, 0.4 + rV); };
  iris(468, 0.43, irisNorm / 2 * 0.4, irisNorm / 2); // turned head: iris narrower sideways
  iris(473, 0.57, irisNorm / 2 * 0.4, irisNorm / 2);
  return lm;
}

test('iris scale uses the vertical iris size, so a turned head does not look farther away', () => {
  const s = irisScale(face(0.03), 1280, 720);
  assert.ok(Math.abs(s - (0.03 * 720) / 1280) < 1e-9);
  assert.equal(irisScale(Array(468).fill({ x: 0, y: 0 }), 1280, 720), null);
});

test('distance gate: within 12% passes, farther asks to come closer, closer asks to move back', () => {
  assert.equal(distanceGate(0.02, 0.02).ok, true);
  assert.equal(distanceGate(0.0215, 0.02).ok, true);
  const far = distanceGate(0.017, 0.02);
  assert.equal(far.ok, false); assert.match(far.msg, /^Move closer/);
  const near = distanceGate(0.024, 0.02);
  assert.equal(near.ok, false); assert.match(near.msg, /^Move back/);
  assert.equal(distanceGate(0.02, null).ok, true, 'no baseline: nothing to match');
});

test('rough distance in cm falls as the iris grows', () => {
  const a = approxDistanceCm(0.012), b = approxDistanceCm(0.024);
  assert.ok(a > 40 && a < 90, `got ${a}`);
  assert.equal(Math.round(a / b), 2);
  assert.equal(approxDistanceCm(0), null);
});
