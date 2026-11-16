// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Sample data for a demo profile, so judges and new users can see every screen filled in
// without a camera. Every record is marked demo: true and lives in its own profile.
// The numbers are invented, deterministic and plausible; they are not anyone's health data.

export const DEMO_PROFILE = 'demo';
export const DEMO_NAME = 'Sample crew member (invented data)';
// A sample crew of four invented people, one per scenario, for the "Everyone on this device" list.
export const SAMPLE_CREW = [
  { id: DEMO_PROFILE, name: DEMO_NAME, scenario: 'shortsleep', seed: 42 },
  { id: 'demo-b', name: 'Sample crew member B (invented data)', scenario: 'steady', seed: 7 },
  { id: 'demo-c', name: 'Sample crew member C (invented data)', scenario: 'gums', seed: 11 },
  { id: 'demo-d', name: 'Sample crew member D (invented data)', scenario: 'breath', seed: 23 },
];

// Small deterministic generator so the demo looks the same every time.
function rng(seed) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
}

// Scenarios for "Explore a scenario": the same two invented weeks, told four ways.
export const SCENARIOS = [
  { id: 'shortsleep', label: 'Three short nights', line: 'Pulse rises and reactions slow after a run of short sleep.' },
  { id: 'steady', label: 'A steady fortnight', line: 'Everything stays inside its band. What a calm record looks like.' },
  { id: 'gums', label: 'Gums getting redder', line: 'The front dental photo drifts redder over the last checkups, with gum pain ticked.' },
  { id: 'breath', label: 'Short of breath today', line: 'Today\'s checkup has shortness of breath ticked and a faster breathing rate: the urgent path.' },
];

export function makeDemoSessions(now = new Date(), seed = 42, scenario = 'shortsleep') {
  const r = rng(seed);
  const day = 24 * 3600 * 1000;
  const out = [];
  const at = (daysAgo, minutes) => {
    const d = new Date(+now - daysAgo * day);
    d.setHours(9, 0, 0, 0);
    return new Date(+d + minutes * 60000);
  };
  const id = (i) => `demo-${String(i).padStart(3, '0')}`;
  // 12 checkups over 14 days; pulse rises on days 3 to 1 ago (a short sleep stretch in the story).
  const plan = [14, 13, 12, 11, 9, 8, 7, 6, 5, 3, 2, 1];
  plan.forEach((ago, i) => {
    const elevated = scenario === 'shortsleep' && ago <= 3;
    const breathless = scenario === 'breath' && ago === 1;
    const pulse = Math.round(63 + (r() - 0.5) * 5 + (elevated ? 9 : 0) + (breathless ? 11 : 0));
    const resp = Math.round(14 + (r() - 0.5) * 3 + (breathless ? 7 : 0));
    const quality = r() < 0.15 ? 'medium' : 'high';
    const s = {
      id: id(i), demo: true, profileId: DEMO_PROFILE, createdAt: at(ago, Math.round((r() - 0.5) * 70)).toISOString(),
      kind: i === 0 ? 'baseline' : 'followup', isOriginal: i === 0, source: 'camera', complete: true,
      cameraLabel: 'sample data',
      pulse: { bpm: pulse, quality, accepted: 11, total: 11, reason: '' },
      resp: { rpm: resp, quality: 'high', seconds: 30, channel: i % 3 ? 'chest' : 'neck', reason: '' },
      usableSeconds: 30, elapsedSeconds: 38 + Math.round(r() * 20), dental: {},
      context: { symptoms: elevated && ago === 2 ? 'Slept badly two nights, mild headache.' : breathless ? 'Out of breath after the stairs this morning. (Invented sample.)' : '',
        checklist: scenario === 'shortsleep' ? (ago === 3 ? ['sleep'] : ago === 2 ? ['headache', 'sleep'] : ago === 1 ? ['headache', 'sleep', 'mouth'] : ago === 9 ? ['back'] : [])
          : scenario === 'gums' ? (ago <= 2 ? ['mouth'] : [])
            : scenario === 'breath' ? (ago === 1 ? ['breath', 'tired'] : [])
              : (ago === 9 ? ['back'] : []) },
    };
    // Gum story: the front photo's automatic colour comparison drifts redder (a* units against baseline).
    if (scenario === 'gums') {
      const drift = { 6: 1.5, 5: 3, 3: 7.5, 2: 9, 1: 12 }[ago] ?? (ago === 14 ? null : Math.round((r() - 0.5) * 30) / 10);
      if (drift != null) s.dental = { front: { view: 'front', captured: true, marks: [], auto: { comparable: true, gumRedDelta: drift, toothYellowDelta: 0.4, lightingDelta: 1.1,
        flags: drift > 6 ? [`Gums look redder than the baseline photo (a* +${drift}).`] : [], notes: [], changedPct: drift > 6 ? 9 : 2 } } };
      else s.dental = { front: { view: 'front', captured: true, marks: [] } };
    }
    // Six checkups have a reference watch reading, so the bench test panel is filled in.
    if (i % 2 === 0) s.reference = { pulseBpm: pulse + Math.round((r() - 0.5) * 4), breathsPerMin: resp + Math.round((r() - 0.5) * 2), device: 'sample watch', conditions: 'sample data' };
    out.push(s);
  });
  // Five reaction tests; slower on the short sleep days.
  [13, 9, 6, 2, 1].forEach((ago, k) => {
    const slow = scenario === 'shortsleep' && ago <= 2;
    const median = Math.round(262 + (r() - 0.5) * 16 + (slow ? 34 : 0));
    const rts = Array.from({ length: 52 }, () => Math.round(median + (r() - 0.35) * 90 + (r() < (slow ? 0.12 : 0.03) ? 200 : 0)));
    const lapses = rts.filter((x) => x >= 355).length;
    out.push({
      id: id(100 + k), demo: true, profileId: DEMO_PROFILE, createdAt: at(ago, 15).toISOString(), kind: 'alertness', source: 'device', complete: false,
      alertness: { stimuli: 52, valid: 52, medianMs: median, lapses, falseStarts: slow ? 2 : 0, timeouts: 0, errors: lapses + (slow ? 2 : 0), durationSec: 180, rts, withEyes: false, eyes: null, device: 'sample data' },
    });
  });
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Invented experimental check results for the demo profile (no photos). The later jaw and timing
// results sit outside their bands on purpose, so the "differs from your first check" view can be seen.
export function makeDemoExp(now = new Date(), scenario = 'shortsleep') {
  const calm = scenario !== 'shortsleep';
  const day = 24 * 3600 * 1000;
  const at = (daysAgo, h) => { const d = new Date(+now - daysAgo * day); d.setHours(h, 15, 0, 0); return d.toISOString(); };
  const rec = (i, daysAgo, exp) => ({ id: `demo-exp-${String(i).padStart(2, '0')}`, createdAt: at(daysAgo, 9), kind: 'exp', source: 'device', demo: true, complete: false, exp: { ok: true, method: 'Invented sample result.', ...exp } });
  return [
    rec(1, 13, { check: 'jaw', maxOpenMm: 44.5, deviationMm: 0.8, openings: 3 }),
    rec(2, 1, { check: 'jaw', maxOpenMm: calm ? 43.6 : 37.0, deviationMm: calm ? 0.9 : 1.4, openings: 3 }),
    rec(3, 12, { check: 'gaze', followCorr: 0.91, lagMs: 160, eyeTravel: 0.11, smoothnessPct: 78, jumpsPer10s: 1.5, holdJitterPct: 6.2 }),
    rec(4, 2, { check: 'gaze', followCorr: 0.88, lagMs: 190, eyeTravel: 0.1, smoothnessPct: 74, jumpsPer10s: 2.5, holdJitterPct: 7.9 }),
    rec(5, 11, { check: 'pupil', right: { constrictionPct: 31.5, latencyMs: 330, restRatio: 0.41 }, left: { constrictionPct: 29.8, latencyMs: 360, restRatio: 0.4 }, asymmetryPct: 2.5, irisPx: 38 }),
    rec(6, 10, { check: 'pallor', eye: 'right', eyelidEi: 21.4, whiteEi: 6.1, relEi: 15.3 }),
    rec(7, 9, { check: 'tremor', mode: 'motion', unit: 'm/s²', right: { peakHz: null, share: 0.12, rms: 0.021 }, left: { peakHz: null, share: 0.1, rms: 0.019 } }),
    rec(8, 12, { check: 'circ', pttMs: 64, pttSpreadMs: 18, bpm: 62, rorFace: 0.912, rorPalm: 0.88, windows: '9 of 11', cameraFps: 30 }),
    rec(9, 1, { check: 'circ', pttMs: calm ? 58 : 31, pttSpreadMs: 22, bpm: scenario === 'breath' ? 75 : calm ? 63 : 72, rorFace: 0.934, rorPalm: 0.9, windows: '7 of 11', cameraFps: 30 }),
    { id: 'demo-acu-01', createdAt: at(12, 10), kind: 'acuity', source: 'device', demo: true, complete: false, acuity: { distanceMm: 1000, pxPerMm: 3.78, calibrated: true, floor: 0, right: { logmar: 0, letters: 55, snellen: '20/20', atScreenLimit: true, floor: 0 }, left: { logmar: 0.1, letters: 50, snellen: '20/25', atScreenLimit: false, floor: 0 } } },
    { id: 'demo-acu-02', createdAt: at(2, 10), kind: 'acuity', source: 'device', demo: true, complete: false, acuity: { distanceMm: 1000, pxPerMm: 3.78, calibrated: true, floor: 0, right: { logmar: 0.02, letters: 54, snellen: '20/21', atScreenLimit: false, floor: 0 }, left: { logmar: 0.1, letters: 50, snellen: '20/25', atScreenLimit: false, floor: 0 } } },
  ];
}
