// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Unit tests: radiation missions, space weather parsing, daylight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missionDose, MISSION_PRESETS, issMissionDose, RADIATION } from '../js/board.js';
import { donkiUrls, flareFlux, summarizeSpaceWeather, loadSpaceWeather, isFresh } from '../js/spaceweather.js';
import { dayLength, declination, dayOfYear, fmtHours, PLACES } from '../js/daylight.js';

test('mission dose: ISS matches the old ISS only function, Mars uses the Curiosity figures', () => {
  const iss = missionDose({ leoDays: 180 });
  assert.equal(Math.round(iss.low), Math.round(issMissionDose(180).low));
  assert.equal(Math.round(iss.high), Math.round(issMissionDose(180).high));
  const transit = missionDose(MISSION_PRESETS.find((p) => p.id === 'marsTransit'));
  assert.equal(Math.round(transit.low), 662);            // published: about 0.66 Sv for the round trip
  assert.equal(transit.low, transit.high);
  const mars = missionDose(MISSION_PRESETS.find((p) => p.id === 'mars'));
  assert.ok(mars.low > 950 && mars.high < 1030, `${mars.low} to ${mars.high}`); // published: about 1 Sv
  assert.ok(mars.fracLow > 1.5, 'well over the 600 mSv career limit');
  assert.equal(missionDose({ leoDays: -5, transitDays: 'x' }).high, 0);
  assert.equal(RADIATION.careerLimitMsv, 600);
});

test('DONKI request addresses and flare classes', () => {
  const u = donkiUrls(new Date('2026-11-15T12:00:00Z'), 'my key');
  assert.equal(u.flares, 'https://api.nasa.gov/DONKI/FLR?startDate=2026-11-08&endDate=2026-11-15&api_key=my%20key');
  assert.equal(u.sep, 'https://api.nasa.gov/DONKI/SEP?startDate=2026-10-16&endDate=2026-11-15&api_key=my%20key');
  assert.ok(Math.abs(flareFlux('X5.0') - 5e-4) < 1e-12);
  assert.ok(Math.abs(flareFlux('m1.2') - 1.2e-5) < 1e-12);
  assert.equal(flareFlux('C'), 1e-6);
  assert.equal(flareFlux(''), null);
  assert.equal(flareFlux(null), null);
});

// Invented events shaped like the documented DONKI fields. Not real space weather.
const FAKE_FLARES = [
  { flrID: '2026-11-10T01:00:00-FLR-001', beginTime: '2026-11-10T01:00Z', peakTime: '2026-11-10T01:20Z', classType: 'M2.3', activeRegionNum: 14000 },
  { flrID: '2026-11-12T05:00:00-FLR-001', beginTime: '2026-11-12T05:00Z', peakTime: '2026-11-12T05:31Z', classType: 'X1.4', activeRegionNum: 14001 },
  { flrID: '2026-11-13T09:00:00-FLR-001', beginTime: '2026-11-13T09:00Z', peakTime: null, classType: 'C8.8' },
  { flrID: 'broken', classType: null },
];
const FAKE_SEPS = [{ sepID: 'a', eventTime: '2026-11-12T07:10Z' }, { sepID: 'b', eventTime: '2026-10-30T02:00Z' }, { sepID: 'c' }];

test('space weather summary counts classes, finds the strongest flare and the latest particle event', () => {
  const s = summarizeSpaceWeather(FAKE_FLARES, FAKE_SEPS);
  assert.equal(s.flares, 3);
  assert.deepEqual(s.counts, { X: 1, M: 1, C: 1, other: 0 });
  assert.equal(s.strongest.cls, 'X1.4');
  assert.equal(s.strongest.peak, '2026-11-12T05:31Z');
  assert.equal(s.sepEvents, 2);
  assert.equal(s.lastSep, '2026-11-12T07:10Z');
  assert.equal(s.level, 'high');
  const quiet = summarizeSpaceWeather(null, undefined);
  assert.deepEqual([quiet.flares, quiet.sepEvents, quiet.strongest, quiet.level], [0, 0, null, 'low']);
});

test('space weather loading: empty body means no events, rate limit and server errors are reported', async () => {
  const res = (status, body) => ({ status, ok: status >= 200 && status < 300, text: async () => body });
  const now = new Date('2026-11-15T12:00:00Z');
  const okFetch = async (url) => res(200, url.includes('/FLR') ? JSON.stringify(FAKE_FLARES) : '');
  const out = await loadSpaceWeather({ now, fetchFn: okFetch });
  assert.equal(out.flares, 3);
  assert.equal(out.sepEvents, 0);
  assert.equal(out.fetchedAt, now.toISOString());
  await assert.rejects(loadSpaceWeather({ now, fetchFn: async () => res(429, '') }), /rate/);
  await assert.rejects(loadSpaceWeather({ now, fetchFn: async () => res(500, '') }), /http 500/);
  assert.equal(isFresh(out, new Date(+now + 2 * 3600e3)), true);
  assert.equal(isFresh(out, new Date(+now + 4 * 3600e3)), false);
  assert.equal(isFresh(null), false);
});

test('day length matches known values', () => {
  const d = (lat, iso) => dayLength(lat, new Date(iso));
  const mtl = d(45.5, '2026-11-15T17:00:00Z');
  assert.ok(Math.abs(mtl.hours - 9.53) < 0.1, `Montreal 15 Nov: ${mtl.hours}`);          // about 9 h 32 min
  const iq = d(63.75, '2026-12-21T17:00:00Z');
  assert.ok(Math.abs(iq.hours - 4.33) < 0.12, `Iqaluit 21 Dec: ${iq.hours}`);            // about 4 h 20 min
  assert.equal(d(76.4, '2026-12-01T17:00:00Z').kind, 'polarNight');
  assert.equal(d(76.4, '2026-06-21T17:00:00Z').kind, 'midnightSun');
  const eq = d(0, '2026-03-20T12:00:00Z');
  assert.ok(Math.abs(eq.hours - 12.1) < 0.1, `Equator at the equinox: ${eq.hours}`);
  assert.equal(dayOfYear(new Date('2026-01-01T00:00:00Z')), 1);
  assert.ok(Math.abs((declination(172) * 180) / Math.PI - 23.44) < 0.1);
  assert.equal(fmtHours(9.53), '9 h 32 min');
  assert.equal(dayLength('abc'), null);
  assert.ok(PLACES.every((p) => p.lat > 40 && p.lat < 85));
});

// ---- signal delay (Earth to Mars) ----
{
  const { earthMars, marsCycle, heliocentric, moonOneWaySec, fmtDelay, AU_KM, C_KM_S } = await import('../js/delay.js');

  test('Earth to Mars distance matches published close approaches', () => {
    const km = (iso) => earthMars(new Date(iso)).km / 1e6;
    assert.ok(Math.abs(km('2003-08-27T09:51:00Z') - 55.76) < 0.3, `2003: ${km('2003-08-27T09:51:00Z')}`); // closest in recorded history
    assert.ok(Math.abs(km('2020-10-06T14:00:00Z') - 62.07) < 0.3, `2020: ${km('2020-10-06T14:00:00Z')}`);
    const far = earthMars(new Date('2019-09-02T10:00:00Z'));
    assert.ok(far.km / 1e6 > 395 && far.km / 1e6 < 402, `conjunction 2019: ${far.km / 1e6}`);
    const r = Math.hypot(...heliocentric('earth', new Date('2026-01-04T00:00:00Z')));
    assert.ok(Math.abs(r - 0.9833) < 0.001, `Earth at perihelion: ${r}`);
  });

  test('light time and solar conjunction windows', () => {
    const near = earthMars(new Date('2020-10-06T14:00:00Z'));
    assert.ok(Math.abs(near.oneWaySec - 207) < 2, `${near.oneWaySec}`);            // about 3.5 minutes
    assert.ok(Math.abs(near.oneWaySec - (near.au * AU_KM) / C_KM_S) < 1e-9);
    assert.ok(near.elongationDeg > 160);                                             // opposite the Sun in the sky
    assert.ok(earthMars(new Date('2023-11-18T05:00:00Z')).elongationDeg < 1);        // NASA's 2023 pause ran 11 to 25 Nov
    assert.ok(earthMars(new Date('2023-11-05T00:00:00Z')).elongationDeg > 2);
    assert.ok(earthMars(new Date('2023-12-02T00:00:00Z')).elongationDeg > 2);
    const c = marsCycle(new Date('2023-06-01T00:00:00Z'));
    assert.equal(c.conjunction.start.toISOString().slice(0, 7), '2023-11');
    assert.ok(c.conjunction.days >= 12 && c.conjunction.days <= 18, `${c.conjunction.days} days`);
    assert.ok(c.min.oneWaySec > 150 && c.min.oneWaySec < 400);
    assert.ok(c.max.oneWaySec > 1150 && c.max.oneWaySec < 1350);                     // about 20 to 22 minutes
    assert.ok(c.min.oneWaySec < c.max.oneWaySec);
  });

  test('delay formatting and the Moon', () => {
    assert.ok(Math.abs(moonOneWaySec() - 1.28) < 0.01);
    assert.equal(fmtDelay(1.282), '1.3 s');
    assert.equal(fmtDelay(45), '45 s');
    assert.equal(fmtDelay(654), '10 min 54 s');
    assert.equal(fmtDelay(1204.4), '20 min 04 s');
  });
}
