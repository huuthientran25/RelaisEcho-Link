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

test('eye opening: mm from the lid gap, open-eye percentile ignores blinks, 1 mm band', async () => {
  const { lidOpeningMm, summarizeLids, compareLids } = await import('../js/eyes.js');
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (i, x, y) => { lm[i] = { x, y, z: 0 }; };
  set(33, 0.40, 0.4); set(133, 0.46, 0.4); set(362, 0.54, 0.4); set(263, 0.60, 0.4);
  const r = 0.0117 * 2; // iris 11.7 mm wide at 4 px per mm on a 1000 px frame
  const iris = (c, cx) => { set(c, cx, 0.4); set(c + 1, cx + r, 0.4); set(c + 2, cx, 0.4 - r); set(c + 3, cx - r, 0.4); set(c + 4, cx, 0.4 + r); };
  iris(468, 0.43); iris(473, 0.57);
  const lids = (gapMm) => { const g = (gapMm * 4) / 1000 / 2; for (const [u, l, x] of [[160, 144, 0.42], [158, 153, 0.44], [385, 380, 0.56], [387, 373, 0.58]]) { set(u, x, 0.4 - g); set(l, x, 0.4 + g); } };
  lids(10);
  const one = lidOpeningMm(lm, 1000, 1000);
  assert.ok(Math.abs(one.right - 10) < 1e-6 && Math.abs(one.left - 10) < 1e-6);
  const frames = Array.from({ length: 60 }, (_, i) => (i % 10 === 0 ? { right: 1, left: 1 } : { right: 10, left: 9 }));
  const s = summarizeLids(frames);
  assert.deepEqual([s.right, s.left, s.diffMm], [10, 9, 1]);
  assert.equal(summarizeLids(frames.slice(0, 5)), null);
  assert.equal(compareLids({ right: 8.5, left: 9 }, { right: 10, left: 9 }).verdict, 'different');
  assert.equal(compareLids({ right: 9.5, left: 9 }, { right: 10, left: 9 }).verdict, 'same');
});

test('bed rest exercise summary: control lost fitness, exercise groups kept most of it', async () => {
  const { readFileSync } = await import('node:fs');
  const d = JSON.parse(readFileSync(new URL('../data/bedrest-vo2.json', import.meta.url), 'utf8'));
  assert.match(d.source, /10\.83263\/w056-8t76/);
  const g = Object.fromEntries(d.groups.map((x) => [x.id, x]));
  assert.ok(g.control.median_pct < -15 && g.exercise.median_pct > -6 && g.fly.median_pct > -6);
  assert.equal(d.people, 37);
  for (const x of d.groups) assert.deepEqual(Object.keys(x).sort(), ['id', 'label', 'lost_over_5pct', 'median_pct', 'n', 'q1_pct', 'q3_pct']);
});

test('bed rest summary ships aggregates only, with a falling first week', async () => {
  const { readFileSync } = await import('node:fs');
  const d = JSON.parse(readFileSync(new URL('../data/bedrest-pv.json', import.meta.url), 'utf8'));
  assert.match(d.source, /10\.83263\/4dzb-2267/);
  assert.ok(d.people >= 40 && d.bins.length === 5);
  assert.ok(d.bins[0].median_pct < -5 && d.bins.at(-1).median_pct > d.bins[1].median_pct, 'drop in bed rest, partial recovery after');
  for (const b of d.bins) assert.deepEqual(Object.keys(b).sort(), ['below_own_pre_min', 'label', 'median_pct', 'n', 'q1_pct', 'q3_pct']);
});
