// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Unit tests: device check and demo reel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { fpsFromTimes, median, featureList, verdicts, overall, reportText } from '../js/devicecheck.js';
import { REEL, reelTotal, sceneAt, reelSrt, pickRecordingType, REEL_MUSIC } from '../js/reel.js';
import { existsSync, statSync } from 'node:fs';

const ALL = { secure: true, getUserMedia: true, wasm: true, indexedDb: true, webgl2: true, rvfc: true, serviceWorker: true, compression: true, speech: true };

test('frame rate from timestamps and median', () => {
  const times = Array.from({ length: 76 }, (_, i) => 1000 + i * (1000 / 30)); // 2.5 s at 30 fps
  const f = fpsFromTimes(times);
  assert.equal(f.fps, 30);
  assert.equal(f.frames, 76);
  assert.equal(f.seconds, 2.5);
  assert.deepEqual(fpsFromTimes([]), { fps: 0, frames: 0, seconds: 0 });
  assert.deepEqual(fpsFromTimes([5]), { fps: 0, frames: 1, seconds: 0 });
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
});

test('device verdicts: a good laptop passes', () => {
  const r = { env: ALL, camera: { width: 1280, height: 720, reportedFps: 30, fps: 29.8, seconds: 2.5, luma: 120 },
    model: { ok: true, seconds: 1.4, source: 'bundled', delegate: 'GPU' }, track: { medianMs: 9, fps: 29.5, facePct: 100 } };
  const v = verdicts(r, CONFIG);
  assert.equal(overall(v), 'ok');
  assert.ok(v.every((x) => x.level === 'ok'));
  const text = reportText(r, v, { version: 'v0.50', userAgent: 'TestBrowser/1', online: true, cache: 'relaisecho-x', modelCached: true });
  assert.match(text, /device report \(v0\.50\)/);
  assert.match(text, /Camera: 1280x720, reports 30 fps, measured 29\.8 fps/);
  assert.match(text, /Face tracking: median 9 ms a frame/);
  assert.doesNotMatch(text, /MISSING/);
});

test('device verdicts: slow camera, dark room, missing features and camera errors are named', () => {
  const slow = verdicts({ env: ALL, camera: { fps: 6.2, luma: 30 }, track: { medianMs: 140, fps: 6.1, facePct: 20 } }, CONFIG);
  assert.equal(overall(slow), 'fail');
  assert.ok(slow.some((x) => x.level === 'fail' && /6\.2 frames a second/.test(x.text)));
  assert.ok(slow.some((x) => x.level === 'warn' && /dark/.test(x.text)));
  assert.ok(slow.some((x) => x.level === 'warn' && /20% of frames/.test(x.text)));
  const mid = verdicts({ env: ALL, camera: { fps: 10, luma: 120 } }, CONFIG);
  assert.equal(overall(mid), 'warn');
  const noCam = verdicts({ env: { ...ALL, secure: false, getUserMedia: false, webgl2: false } }, CONFIG);
  assert.equal(overall(noCam), 'warn');              // a video file still works
  assert.equal(noCam.length, 2);                     // optional features are not verdict lines
  const noStore = verdicts({ env: { ...ALL, indexedDb: false } }, CONFIG);
  assert.equal(overall(noStore), 'fail');
  const denied = verdicts({ env: ALL, cameraError: 'permission was denied.' }, CONFIG);
  assert.equal(overall(denied), 'fail');
  const badModel = verdicts({ env: ALL, camera: { fps: 30, luma: 120 }, model: { ok: false, error: 'Could not download the face model.' } }, CONFIG);
  assert.ok(badModel.some((x) => x.level === 'fail' && /Could not download/.test(x.text)));
  assert.match(reportText({ env: {} }, [], {}), /Camera test: not run/);
  assert.equal(featureList({}).filter((f) => f.need !== 'nice').length, 4);
});

test('demo reel is exactly 30 seconds with readable captions', () => {
  assert.equal(reelTotal(), 30);
  assert.equal(new Set(REEL.map((x) => x.id)).size, REEL.length);
  for (const x of REEL) {
    assert.ok(x.sec >= 3, `${x.id} is on screen long enough`);
    assert.ok(x.caption.length <= 80, `${x.id} caption fits two lines`);
    assert.ok(x.caption.split(/\s+/).length / x.sec <= 3.6, `${x.id} can be read in time`); // about 215 words a minute at most
  }
  assert.equal(sceneAt(0).scene.id, 'title');
  assert.equal(sceneAt(3.99).scene.id, 'title');
  assert.equal(sceneAt(4).scene.id, 'setup');
  assert.equal(sceneAt(29.9).scene.id, 'end');
  assert.equal(sceneAt(30), null);
});

test('caption file and recording format choice', () => {
  const srt = reelSrt();
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:03,950\nRelaisÉcho Link/);
  assert.match(srt, /7\n00:00:27,000 --> 00:00:29,950\n/);
  assert.equal(srt.split('\n\n').length, REEL.length);
  assert.deepEqual(pickRecordingType((t) => t === 'video/webm'), { mimeType: 'video/webm', ext: 'webm' });
  assert.deepEqual(pickRecordingType((t) => t === 'video/mp4'), { mimeType: 'video/mp4', ext: 'mp4' });
  assert.equal(pickRecordingType(() => false), null);
  assert.equal(pickRecordingType(() => { throw new Error('x'); }), null);
});

// ---- eye grid (Amsler) ----
{
  const { N, areaOf, summarize, newSince, compareEye, gridSize, cleanCells, visionForPacket, DEFAULT_PX_PER_MM } = await import('../js/amsler.js');
  const { buildPacket, packetText } = await import('../js/packet.js');
  const cell = (row, col) => row * N + col;

  test('eye grid: areas and summary', () => {
    assert.equal(N, 20);
    assert.equal(areaOf(cell(0, 0)), 'upper left');
    assert.equal(areaOf(cell(0, 19)), 'upper right');
    assert.equal(areaOf(cell(19, 0)), 'lower left');
    assert.equal(areaOf(cell(19, 19)), 'lower right');
    assert.equal(areaOf(cell(9, 9)), 'centre');
    assert.equal(areaOf(cell(8, 11)), 'centre');
    assert.equal(areaOf(cell(7, 9)), 'upper left');
    assert.equal(summarize([]).text, 'nothing marked');
    assert.equal(summarize([cell(0, 0), cell(0, 1), cell(9, 9)]).text, '3 squares marked (centre 1, upper left 2)');
    assert.deepEqual(cleanCells([5, 5, -1, 400, 2.5, 'x', 7]), [5, 7]);
  });

  test('eye grid: a mark next to an old one is the same spot, a distant one is new', () => {
    const ref = [cell(5, 5)];
    assert.deepEqual(newSince([cell(5, 6), cell(6, 6)], ref), []);
    assert.deepEqual(newSince([cell(5, 8)], ref), [cell(5, 8)]);
    assert.equal(compareEye([], null).verdict, 'reference');
    assert.equal(compareEye([cell(5, 6)], ref).verdict, 'same');
    const changed = compareEye([cell(5, 5), cell(15, 15), cell(15, 16)], ref);
    assert.equal(changed.verdict, 'new');
    assert.equal(changed.fresh.length, 2);
    assert.match(changed.line, /2 squares marked that were clear in your reference \(lower right 2\)/);
    assert.match(compareEye([], ref).line, /your reference had marks/);
    assert.match(compareEye([], []).line, /same as your reference/);
  });

  test('eye grid: size on screen and reading distance', () => {
    const big = gridSize(DEFAULT_PX_PER_MM, 900);
    assert.equal(big.trueSize, true);
    assert.equal(big.readCm, 30);
    assert.equal(big.mm, 100);
    const phone = gridSize(6.0, 340);               // a phone: the grid cannot be 10 cm wide
    assert.equal(phone.trueSize, false);
    assert.ok(phone.mm > 50 && phone.mm < 60, `${phone.mm}`);
    assert.ok(phone.readCm >= 15 && phone.readCm <= 18, `${phone.readCm}`);
    assert.equal(gridSize(NaN, 500).trueSize, true); // falls back to the default pixel size
  });

  test('eye grid in the review packet: counts and what is new, never the picture', () => {
    const ref = { id: 'v1', createdAt: '2026-11-01T09:00:00Z', kind: 'vision', vision: { right: [], left: [cell(3, 3)], mm: 100, trueSize: true } };
    const now = { id: 'v2', createdAt: '2026-11-14T09:00:00Z', kind: 'vision', vision: { right: [cell(12, 12), cell(12, 13)], left: [cell(3, 4)], mm: 100, trueSize: true } };
    const v = visionForPacket(now, ref);
    assert.equal(v.right_eye, '2 squares marked (lower right 2)');
    assert.deepEqual([v.new_vs_reference.right, v.new_vs_reference.left], [2, 0]);
    assert.equal(visionForPacket(ref, ref).new_vs_reference, null);       // the reference itself has nothing to compare with
    assert.equal(visionForPacket(null, ref), null);
    const base = { id: 'a', kind: 'followup', createdAt: '2026-11-15T10:00:00Z', source: 'camera', dental: {}, context: {} };
    const p = buildPacket(base, { original: null, recent: [] }, { vision: v }).packet;
    assert.equal(p.vision_self_check.left_eye, '1 square marked (upper left 1)');
    assert.match(packetText(p), /Eye grid 2026-11-14: right 2 squares marked .*new vs reference: right 2, left 0/);
    assert.equal(buildPacket(base, { original: null, recent: [] }).packet.vision_self_check, null);
    assert.doesNotMatch(JSON.stringify(p.vision_self_check), /\[\d/);     // no cell lists leave the device
  });
}

// ---- your data (privacy inventory) ----
{
  const { inventory, inventoryLines, fmtBytes, NETWORK, EXPORTS, NEVER } = await import('../js/privacy.js');
  const { readFileSync, readdirSync } = await import('node:fs');

  test('inventory counts what is stored, per person and for the device', () => {
    const img = `data:image/jpeg;base64,${'A'.repeat(4000)}`;
    const recs = [
      { kind: 'baseline', profileId: 'default', template: { w: 1 }, dental: { front: { image: img }, left: { captured: false } }, context: { symptoms: '', checklist: ['sleep'] } },
      { kind: 'followup', profileId: 'default', dental: {}, context: { symptoms: '  ' } },
      { kind: 'alertness', profileId: 'default' },
      { kind: 'vision', profileId: 'default' },
      { kind: 'followup', profileId: 'p2', dental: {}, context: { symptoms: 'sore gum' } },
      { kind: 'baseline', dental: {}, demo: true },                    // no profile id: belongs to 'default'
    ];
    const inv = inventory(recs, 'default');
    assert.deepEqual([inv.mine.checkups, inv.mine.reactionTests, inv.mine.eyeChecks, inv.mine.photos, inv.mine.faceTemplates, inv.mine.notes], [3, 1, 1, 1, 1, 1]);
    assert.ok(inv.mine.photoBytes > 2900 && inv.mine.photoBytes < 3100);
    assert.equal(inv.device.checkups, 4);
    assert.equal(inv.device.notes, 2);
    assert.equal(inv.device.sample, 1);
    assert.equal(inv.people, 2);
    assert.equal(inventory([], 'default').mine.checkups, 0);
    const lines = inventoryLines(inv.mine);
    assert.match(lines[0], /^3 checkups/);
    assert.match(lines[2], /^1 dental photo, about 3 kB/);
    assert.equal(fmtBytes(5 * 1048576), '5.0 MB');
    assert.equal(fmtBytes(10), '10 bytes');
  });

  test('every outside address in the app is listed on the "Your data" screen', () => {
    const hosts = new Set();
    const files = [...readdirSync('js').filter((f) => f.endsWith('.js')).map((f) => `js/${f}`), 'sw.js'];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // Addresses the code can actually request: string literals passed around as URLs, not links in comments or evidence text.
      for (const m of src.matchAll(/^(?!\s*\/\/).*?['"`](https?:\/\/[^'"`\s/]+)/gm)) {
        if (f === 'js/evidence.js' || f === 'js/privacy.js') continue;
        if (new URL(m[1]).host === 'www.w3.org') continue; // XML namespace names, never requested
        hosts.add(new URL(m[1]).host);
      }
    }
    const listed = NETWORK.map((n) => n.host);
    for (const h of hosts) assert.ok(listed.includes(h), `${h} is requested by the app but not listed in js/privacy.js`);
    assert.ok(hosts.has('api.nasa.gov') && hosts.has('storage.googleapis.com'));
    assert.ok(EXPORTS.length >= 3 && NEVER.length >= 3);
  });
}

// ---- camera choice ----
{
  const { cameraOptions, cameraConstraints } = await import('../js/extras.js');
  test('camera list shows only when there is a choice, and a missing saved camera falls back to automatic', () => {
    const devs = [{ kind: 'audioinput', deviceId: 'm' }, { kind: 'videoinput', deviceId: 'a', label: 'Integrated Camera' }, { kind: 'videoinput', deviceId: 'b', label: '' }];
    const c = cameraOptions(devs, 'b');
    assert.equal(c.show, true);
    assert.deepEqual(c.options.map((o) => o.label), ['Automatic (front or rear, as chosen above)', 'Integrated Camera', 'Camera 2']);
    assert.equal(c.chosen, 'b');
    assert.equal(cameraOptions(devs, 'gone').chosen, '');
    assert.equal(cameraOptions(devs.slice(0, 2), '').show, false);
    assert.equal(cameraOptions([{ kind: 'videoinput', deviceId: '' }, { kind: 'videoinput', deviceId: '' }], '').show, false); // before permission
    assert.equal(cameraOptions(null, '').show, false);
    assert.deepEqual(cameraConstraints('user', '', 30).video.facingMode, 'user');
    const exact = cameraConstraints('user', 'a', 30).video;
    assert.deepEqual(exact.deviceId, { exact: 'a' });
    assert.equal(exact.facingMode, undefined);
  });
}

test('reel music: AI label, file present and small, recording format carries audio', () => {
  assert.match(REEL_MUSIC.label, /AI-generated/);
  const f = new URL(`../${REEL_MUSIC.src}`, import.meta.url);
  assert.ok(existsSync(f));
  assert.ok(statSync(f).size < 1_000_000);
  assert.ok(REEL_MUSIC.volume > 0 && REEL_MUSIC.volume <= 1);
  const all = () => true;
  assert.equal(pickRecordingType(all, true).mimeType, 'video/webm;codecs=vp9,opus');
  assert.equal(pickRecordingType(all).mimeType, 'video/webm;codecs=vp9');
  const noOpus = (t) => !/opus|mp4a/.test(t);
  assert.equal(pickRecordingType(noOpus, true).mimeType, 'video/webm;codecs=vp9');
});
