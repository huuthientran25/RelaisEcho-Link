// Unit tests (Node's built in runner): npm test
// Each block below keeps its own imports and helpers, so names cannot collide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ---------- Signal processing: pulse, breathing, alignment ----------
{
  // Run with: node --test tests/
  // Synthetic signals only. These check the math, not real world accuracy.
  const { estimatePulse } = await import('../js/pulse.js');
  const { estimateResp, profileShift, TorsoTracker } = await import('../js/resp.js');

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

  // Skin colour trace: pulse mostly in green, slow light drift on all channels, sensor noise,
  // irregular frame timing around 30 fps.
  function syntheticSkin({ bpm, seconds, noise = 0.15, seed = 1, jitterMs = 6, motionBursts = [] }) {
    const r = rng(seed);
    const out = [];
    let t = 0;
    while (t < seconds * 1000) {
      const s = t / 1000;
      const pulse = Math.sin(2 * Math.PI * (bpm / 60) * s) + 0.3 * Math.sin(4 * Math.PI * (bpm / 60) * s + 0.6);
      const drift = 6 * Math.sin(2 * Math.PI * 0.05 * s);
      let ok = true;
      let motion = 0;
      for (const [a, b] of motionBursts) if (s >= a && s < b) { motion = 8 * Math.sin(2 * Math.PI * 1.3 * s); ok = false; }
      out.push({
        t,
        r: 150 + drift + 0.12 * pulse + motion + noise * gauss(r),
        g: 110 + drift + 0.35 * pulse + motion + noise * gauss(r),
        b: 90 + drift + 0.08 * pulse + motion + noise * gauss(r),
        ok,
      });
      t += 33.3 + jitterMs * (r() - 0.5) * 2;
    }
    return out;
  }

  test('POS recovers a clean 72 bpm pulse', () => {
    const res = estimatePulse(syntheticSkin({ bpm: 72, seconds: 30 }));
    assert.ok(res.bpm !== null, res.reason);
    assert.ok(Math.abs(res.bpm - 72) <= 2, `got ${res.bpm}`);
    assert.equal(res.accepted, res.total);
  });

  test('POS recovers 54 and 110 bpm', () => {
    for (const bpm of [54, 110]) {
      const res = estimatePulse(syntheticSkin({ bpm, seconds: 30, seed: bpm }));
      assert.ok(Math.abs(res.bpm - bpm) <= 2, `want ${bpm} got ${res.bpm}`);
    }
  });

  test('windows overlapping flagged motion are rejected, rest still estimate', () => {
    const res = estimatePulse(syntheticSkin({ bpm: 80, seconds: 40, motionBursts: [[12, 18]] }));
    assert.ok(res.accepted < res.total, 'some windows should be rejected');
    assert.ok(Math.abs(res.bpm - 80) <= 2, `got ${res.bpm}`);
  });

  test('pure noise does not produce a confident pulse', () => {
    const r = rng(9);
    const samples = [];
    for (let t = 0; t < 30000; t += 33.3) samples.push({ t, r: 150 + 2 * gauss(r), g: 110 + 2 * gauss(r), b: 90 + 2 * gauss(r), ok: true });
    const res = estimatePulse(samples);
    assert.notEqual(res.quality, 'high', `noise gave ${res.bpm} bpm with quality ${res.quality}`);
  });

  // Torso profile: a few horizontal edges (collar, shoulders) shifted by breathing.
  function profileAt(offset, rows = 80, r = Math.random) {
    const p = new Float64Array(rows);
    for (let i = 0; i < rows; i++) {
      const y = i - offset;
      p[i] = 60 + 80 / (1 + Math.exp(-(y - 25))) + 40 / (1 + Math.exp(-(y - 55) * 0.8)) + 2 * gauss(r);
    }
    return p;
  }

  test('profileShift measures a 1.5 row shift', () => {
    const r = rng(3);
    const a = profileAt(0, 80, r), b = profileAt(1.5, 80, r);
    const { shift } = profileShift(a, b);
    assert.ok(Math.abs(shift - 1.5) < 0.35, `got ${shift}`);
  });

  test('breathing at 15 per minute is recovered from row profiles', () => {
    const r = rng(5);
    const tracker = new TorsoTracker();
    const samples = [];
    for (let t = 0; t < 32000; t += 33.3) {
      const off = 1.2 * Math.sin(2 * Math.PI * 0.25 * (t / 1000)) + 0.2 * gauss(r) * 0.2;
      const y = tracker.push(profileAt(off, 80, r));
      samples.push({ t, y, ok: true });
    }
    const res = estimateResp(samples);
    assert.ok(res.rpm !== null, res.reason);
    assert.ok(Math.abs(res.rpm - 15) <= 1, `got ${res.rpm}`);
  });

  test('breathing needs enough usable seconds', () => {
    const samples = [];
    for (let t = 0; t < 10000; t += 33.3) samples.push({ t, y: Math.sin(t / 600), ok: true });
    const res = estimateResp(samples);
    assert.equal(res.rpm, null);
  });

  // ---- added in v0.2: breathing channels, alignment hysteresis, honest pulse message ----
  const { estimateRespMulti } = await import('../js/resp.js');
  const { compareToTemplate } = await import('../js/align.js');

  function breathChannel({ rpm, seconds = 40, noise = 0.3, seed = 3, amp = 1 }) {
    const r = rng(seed);
    const out = [];
    for (let t = 0; t < seconds * 1000; t += 33) {
      out.push({ t, y: amp * Math.sin(2 * Math.PI * (rpm / 60) * (t / 1000)) + noise * gauss(r), ok: true });
    }
    return out;
  }

  test('multi channel breathing picks the clean channel and reports agreement', () => {
    const noisy = breathChannel({ rpm: 15, noise: 4, seed: 5, amp: 0.05 });
    const clean = breathChannel({ rpm: 15, noise: 0.2, seed: 6 });
    const second = breathChannel({ rpm: 15.5, noise: 0.4, seed: 7 });
    const res = estimateRespMulti({ head: noisy, neck: clean, chest: second });
    assert.equal(res.channel === 'neck' || res.channel === 'chest', true);
    assert.ok(Math.abs(res.rpm - 15) <= 1, `rpm ${res.rpm}`);
    assert.ok(res.agreeing >= 1);
    assert.equal(res.channels.length, 3);
  });

  test('multi channel breathing says so when nothing was tracked', () => {
    const res = estimateRespMulti({ neck: [], chest: [], head: [], pitch: [] });
    assert.equal(res.rpm, null);
    assert.equal(res.quality, 'none');
    assert.match(res.reason, /neck and shoulders/i);
  });

  test('alignment hysteresis keeps a slightly drifted pose aligned', () => {
    const tpl = { center: { x: 0.5, y: 0.4 }, faceWidth: 0.3, roll: 0, yaw: 0, pitchIndex: null, aspect: 1.5 };
    const mk = (dx) => ({ W: 480, H: 320, center: { x: (0.5 + 0.3 * 0.10 * dx) * 480, y: 0.4 * 320 }, faceWidth: 0.3 * 480, roll: 0, yaw: 0, pitchIndex: 0.5 });
    assert.equal(compareToTemplate(mk(1.2), tpl, 1).ok, false);
    assert.equal(compareToTemplate(mk(1.2), tpl, 1.35).ok, true);
    assert.equal(compareToTemplate(mk(1.6), tpl, 1.35).ok, false);
  });

  test('low confidence pulse explains the real reason', () => {
    const res = estimatePulse(syntheticSkin({ bpm: 72, seconds: 40, motionBursts: [[0, 9], [11, 19], [21, 25]] }));
    assert.equal(res.quality, 'low');
    assert.match(res.reason, /only \d+ of \d+ windows were clean/);
  });

  test('breathing peak at the band edge is ignored as drift', () => {
    const slow = breathChannel({ rpm: 6, seconds: 60, noise: 0.05 });
    const res = estimateResp(slow);
    assert.equal(res.rpm, null);
    assert.match(res.reason, /edge of the breathing range/);
  });
}

// ---------- Blinks and eye closure ----------
{
  const { EyeTracker, eyeAspect } = await import('../js/eyes.js');

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
}

// ---------- Nine pulse regions ----------
{
  const { estimatePulse, estimatePulseRegions } = await import('../js/pulse.js');
  const { PULSE_REGIONS } = await import('../js/geometry.js');

  // Synthetic region series: a 72 bpm pulse buried in noise; "clean" regions have strong pulse, "noisy" ones weak.
  function series(amp, noise, seed) {
    let x = seed;
    const rnd = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32 - 0.5; };
    const out = [];
    for (let k = 0; k < 30 * 40; k++) {
      const t = k * (1000 / 30);
      const p = amp * Math.sin(2 * Math.PI * 1.2 * t / 1000);
      out.push({ t, r: 120 + 0.3 * p + noise * rnd(), g: 90 + p + noise * rnd(), b: 80 + 0.2 * p + noise * rnd(), n: 400, ok: true });
    }
    return out;
  }

  test('nine regions are defined with labels', () => {
    assert.equal(PULSE_REGIONS.length, 9);
    assert.ok(PULSE_REGIONS.every((r) => r.label && r.w > 0 && r.h > 0));
  });

  test('pooling clean regions beats a weak standard estimate', () => {
    const regions = {};
    PULSE_REGIONS.forEach((r, i) => { regions[r.id] = { label: r.label, samples: series(i < 3 ? 0.05 : 0.6, i < 3 ? 1.5 : 0.4, 7 + i) }; });
    // Standard estimate from the three weak regions.
    const base = estimatePulse(regions.forehead.samples);
    const res = estimatePulseRegions(regions, base);
    assert.ok(Math.abs(res.bpm - 72) <= 2, `bpm ${res.bpm}`);
    assert.ok(res.regionsUsed.length >= 2 && !res.regionsUsed.includes('forehead centre'), res.regionsUsed.join(','));
    assert.equal(res.regionScores.length, 9);
  });

  test('keeps the standard estimate when pooling is not better', () => {
    const regions = {};
    PULSE_REGIONS.forEach((r, i) => { regions[r.id] = { label: r.label, samples: series(0.01, 2, 3 + i) }; });
    const base = { bpm: 70, quality: 'high', snrMedian: 9, accepted: 10, total: 10 };
    const res = estimatePulseRegions(regions, base);
    assert.equal(res.bpm, 70);
    assert.deepEqual(res.regionsUsed, ['forehead centre', 'left cheek', 'right cheek']);
  });
}
// ---------- Frame clock ----------
{
  const { makeFrameClock } = await import('../js/frame.js');

  test('frame clock: files use media time; cameras keep media spacing on a wall clock base', () => {
    let w = 5000;
    const file = makeFrameClock(true, () => w);
    assert.equal(file({ mediaTime: 1.5 }), 1500);
    const cam = makeFrameClock(false, () => w);
    const t1 = cam({ mediaTime: 10.000 }); w += 40;
    const t2 = cam({ mediaTime: 10.033 }); w += 25;
    const t3 = cam({ mediaTime: 10.066 });
    assert.equal(t1, 5000);
    assert.ok(Math.abs((t2 - t1) - 33) < 1e-6 && Math.abs((t3 - t2) - 33) < 1e-6, 'media spacing kept');
    assert.equal(makeFrameClock(false, () => 77)(null), 77, 'no metadata: wall clock');
  });

  test('frame clock: a stuck media time falls back to the wall clock with no jump', () => {
    let w = 1000;
    const cam = makeFrameClock(false, () => w);
    const out = [];
    for (let i = 0; i < 8; i++) { out.push(cam({ mediaTime: 0 })); w += 33; }
    for (let i = 1; i < out.length; i++) assert.ok(out[i] >= out[i - 1] && out[i] - out[i - 1] <= 120, `step ${i}: ${out[i] - out[i - 1]}`);
    assert.ok(out[7] - out[0] > 150, 'time advances once the wall clock takes over');
  });
}
