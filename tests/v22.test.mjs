import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimatePulse, estimatePulseRegions } from '../js/pulse.js';
import { PULSE_REGIONS } from '../js/geometry.js';

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
