import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EyeTracker, eyeAspect } from '../js/eyes.js';

test('eye aspect ratio is larger for open eyes', () => {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const lid = (h) => {
    const set = (i, x, y) => { lm[i] = { x, y }; };
    for (const [c1, c2, u1, u2, l1, l2, xa, xb] of [[33, 133, 160, 158, 144, 153, 0.44, 0.475], [362, 263, 385, 387, 380, 373, 0.525, 0.56]]) {
      set(c1, xa, 0.33); set(c2, xb, 0.33);
      set(u1, xa + (xb - xa) / 3, 0.33 - h); set(u2, xa + 2 * (xb - xa) / 3, 0.33 - h);
      set(l1, xa + (xb - xa) / 3, 0.33 + h); set(l2, xa + 2 * (xb - xa) / 3, 0.33 + h);
    }
    return eyeAspect(lm);
  };
  assert.ok(lid(0.006) > 3 * lid(0.001));
  assert.equal(eyeAspect(null), null);
});

test('tracker counts blinks, long closures and closed time at 15 frames per second', () => {
  const tr = new EyeTracker();
  const dt = 1000 / 15;
  for (let t = 0; t <= 60000; t += dt) {
    const blink = t > 5000 && t % 4000 < 150;          // about 14 blinks in the minute after warmup
    const long = t > 30000 && t < 30700;                // one 0.7 s closure
    tr.push(t, blink || long ? 0.05 : 0.3);
  }
  const s = tr.summary();
  assert.equal(s.longClosures, 1);
  assert.ok(s.blinksPerMin > 10 && s.blinksPerMin < 20, `blinks ${s.blinksPerMin}`);
  assert.ok(s.closedPct > 2 && s.closedPct < 8, `closed ${s.closedPct}`);
  assert.ok(s.trackedPct > 90);
});

test('no face means no tracked time', () => {
  const tr = new EyeTracker();
  for (let t = 0; t < 10000; t += 66) tr.push(t, null);
  assert.equal(tr.summary().trackedPct, 0);
  assert.equal(tr.summary().blinksPerMin, null);
});
