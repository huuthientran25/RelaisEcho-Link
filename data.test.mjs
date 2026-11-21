// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Unit tests (Node's built in runner): npm test
// Each block below keeps its own imports and helpers, so names cannot collide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ---------- Change vs baseline, crew data, QR ----------
{
  const { changeVsBaseline, NOISE } = await import('../js/change.js');
  const { summarizeCrew, rangeDisagreements } = await import('../js/crew.js');
  const { qrSvg, QR_MAX_BYTES } = await import('../js/qr.js');

  test('change vs baseline respects the noise band', () => {
    assert.equal(changeVsBaseline(75, 70, NOISE.pulseBpm).kind, 'noise');
    assert.equal(changeVsBaseline(80, 70, NOISE.pulseBpm).kind, 'up');
    assert.equal(changeVsBaseline(10, 15, NOISE.breathsPerMin).kind, 'down');
    assert.equal(changeVsBaseline(null, 15, 3).kind, 'none');
  });

  const data = JSON.parse(readFileSync(new URL('../data/osd575-cmp.json', import.meta.url)));

  test('OSD-575 file has 4 crew, 7 timepoints and lab ranges', () => {
    assert.deepEqual(data.crew, ['C001', 'C002', 'C003', 'C004']);
    assert.equal(data.timepoints.length, 7);
    for (const a of data.analytes) {
      if (a.rangeMin != null) assert.ok(a.rangeMin < a.rangeMax, a.name);
      for (const c of data.crew) assert.equal(a.series[c].length, 7);
    }
    assert.ok(!data.analytes.some((a) => /egfr/i.test(a.key)), 'race based eGFR excluded');
  });

  test('crew summary matches the published values for potassium', () => {
    const k = data.analytes.find((a) => a.key === 'potassium');
    const s = summarizeCrew(k, data.timepoints).C003;   // pre 3.7, 3.5, 3.3; day after landing 3.0
    assert.equal(s.r1, 3.0);
    assert.equal(s.preMin, 3.3);
    assert.equal(s.inLab, false);
    assert.equal(s.inOwn, false);
    const r = rangeDisagreements(data);
    assert.equal(r.r1Total, 60);
    assert.equal(r.preTotal, 180);
  });

  test('QR encodes UTF-8 text and refuses oversized text', () => {
    const q = qrSvg('RelaisÉcho Link · pulse 72 bpm');
    assert.ok(q.ok && q.svg.startsWith('<svg') && q.modules >= 21);
    assert.equal(qrSvg('x'.repeat(QR_MAX_BYTES + 1)).ok, false);
  });
}

// ---------- Spoken coaching and backup ----------
{
  const { makeSpeaker } = await import('../js/speech.js');
  const { parseBackup, mergePlan } = await import('../js/backup.js');

  function fakeSpeech() {
    const said = [];
    let t = 0;
    const timers = [];
    const sp = makeSpeaker({
      synth: { cancel() {}, speak(u) { said.push([u.text, u.lang]); } },
      Utterance: function U(text) { this.text = text; },
      now: () => t,
      setTimer: (fn, ms) => { timers.push([t + ms, fn]); return timers.length; },
      clearTimer: () => {},
    });
    const advance = (ms) => { t += ms; for (const tm of timers.splice(0)) { if (tm[0] <= t) tm[1](); else timers.push(tm); } };
    return { sp, said, advance };
  }

  test('speaker is silent until enabled, skips repeats and loading messages, keeps only the latest', () => {
    const { sp, said, advance } = fakeSpeech();
    sp.say('Hold still');
    assert.equal(said.length, 0);
    sp.setEnabled(true); sp.setLang('fr-CA');
    sp.say('Hold still');
    sp.say('Hold still');
    sp.say('Loading the face model…');
    assert.deepEqual(said, [['Hold still', 'fr-CA']]);
    advance(500); sp.say('Come a little closer'); sp.say('Too dark: turn on a light facing you');
    assert.equal(said.length, 1);
    advance(2000);
    assert.deepEqual(said.at(-1), ['Too dark: turn on a light facing you', 'fr-CA']);
  });

  test('backup parsing rejects bad files and keeps valid checkups', () => {
    assert.match(parseBackup('not json').error, /not valid JSON/);
    assert.match(parseBackup('{"a":1}').error, /expected a list/);
    const r = parseBackup(JSON.stringify([{ id: 'a', createdAt: '2026-11-14T10:00:00Z', kind: 'baseline' }, { id: 'b', kind: 'baseline' }, { nope: 1 }]));
    assert.equal(r.sessions.length, 1);
    assert.equal(r.rejected, 2);
  });

  test('merge never overwrites and keeps the device original baseline', () => {
    const existing = [{ id: 'a', kind: 'baseline', isOriginal: true }];
    const incoming = [{ id: 'a', kind: 'baseline' }, { id: 'c', kind: 'baseline', isOriginal: true }, { id: 'd', kind: 'followup' }];
    const plan = mergePlan(existing, incoming);
    assert.equal(plan.skipped, 1);
    assert.deepEqual(plan.toAdd.map((s) => [s.id, !!s.isOriginal]), [['c', false], ['d', false]]);
    assert.equal(mergePlan([], incoming).toAdd.find((s) => s.id === 'c').isOriginal, true);
  });
}

// ---------- Sample data and packet checks ----------
{
  const { makeDemoSessions, DEMO_PROFILE } = await import('../js/demo.js');
  const { validatePacket, safeImage } = await import('../js/review.js');
  const { benchError, noiseFloor } = await import('../js/change.js');
  const { buildPacket, packetText } = await import('../js/packet.js');

  test('demo data is deterministic, marked, recent and fills every screen', () => {
    const now = new Date('2026-11-15T12:00');
    const a = makeDemoSessions(now), b = makeDemoSessions(now);
    assert.deepEqual(a, b);
    assert.ok(a.every((s) => s.demo === true && s.profileId === DEMO_PROFILE));
    const checkups = a.filter((s) => s.kind !== 'alertness');
    assert.equal(checkups.length, 12);
    assert.equal(checkups.filter((s) => s.isOriginal).length, 1);
    assert.equal(a.filter((s) => s.kind === 'alertness').length, 5);
    assert.ok(+now - +new Date(a.at(-1).createdAt) < 2 * 24 * 3600 * 1000);
    assert.equal(noiseFloor(benchError(a), 'pulse').source.startsWith('your bench test'), true);
  });

  test('packet validation and safe images', () => {
    assert.match(validatePacket(null), /not a review packet/);
    assert.match(validatePacket({ schema: 'x' }), /schema missing/);
    const sess = { id: 'x', kind: 'followup', createdAt: '2026-11-15T10:00:00Z', source: 'camera', pulse: { bpm: 70, quality: 'high', accepted: 10, total: 10 }, resp: { rpm: 15, quality: 'high', seconds: 30 }, dental: {}, context: {} };
    const { packet } = buildPacket(sess, { original: null, recent: [] }, { change: null });
    assert.equal(validatePacket(packet), '');
    assert.ok(safeImage('data:image/jpeg;base64,AAAA'));
    assert.equal(safeImage('javascript:alert(1)'), null);
    assert.equal(safeImage('data:image/svg+xml;base64,AAAA'), null);
  });
}

// ---------- Reviewer reply and compressed packets ----------
{
  const { makeReply, validateReply, gzipText, readMaybeGzip } = await import('../js/reply.js');

  const packet = { checkup: { id: 'abc', capturedAt: '2026-11-15T10:00:00Z' } };
  test('reply round trip and validation', () => {
    const r = makeReply(packet, 'recheck', 'Recheck tomorrow', new Date('2026-11-15T12:00:00Z'));
    assert.equal(r.status_text, 'Reviewed: please do another checkup');
    assert.equal(validateReply(r, [{ id: 'abc' }]).session.id, 'abc');
    assert.match(validateReply(r, [{ id: 'zzz' }]).error, /not on this device/);
    assert.match(validateReply({ schema: 'x' }, []).error, /not a RelaisÉcho reviewer reply/);
    assert.throws(() => makeReply(packet, 'nope'));
  });
  test('gzip round trip', async () => {
    const text = JSON.stringify({ hello: 'É'.repeat(500) });
    const gz = await gzipText(text);
    assert.ok(gz && gz.length < text.length / 3);
    const file = { arrayBuffer: async () => gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) };
    assert.equal(await readMaybeGzip(file), text);
    const plain = new TextEncoder().encode(text);
    assert.equal(await readMaybeGzip({ arrayBuffer: async () => plain.buffer }), text);
  });

  const { buildPacket, packetText } = await import('../js/packet.js');
  test('packet text includes the automatic dental comparison', () => {
    const sess = { id: 'x', kind: 'followup', createdAt: '2026-11-15T10:00:00Z', source: 'camera', pulse: { bpm: 70, quality: 'high', accepted: 10, total: 10 }, resp: { rpm: 15, quality: 'high', seconds: 30 },
      dental: { front: { view: 'front', captured: true, marks: [], auto: { comparable: true, flags: ['Gums look redder than at baseline (a* +6).'], notes: [] } } }, context: {} };
    const { packet } = buildPacket(sess, { original: null, recent: [] });
    assert.match(packetText(packet), /auto compare: Gums look redder/);
  });
}

// ---------- Reminders, photo clean-up, CSV ----------
{
  const { reminderIcs, stripOldPhotos } = await import('../js/extras.js');

  test('calendar reminder is valid iCalendar with a repeat rule', () => {
    const ics = reminderIcs({ start: new Date(2026, 10, 16, 9, 5), freq: 'WEEKLY', now: new Date(Date.UTC(2026, 10, 15, 12)) });
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /DTSTART:20261116T090500\r\n/);
    assert.match(ics, /RRULE:FREQ=WEEKLY\r\n/);
    assert.match(ics, /END:VCALENDAR\r\n$/);
  });

  test('old photos are removed except on the original baseline', () => {
    const now = new Date('2026-11-15T12:00:00Z');
    const sessions = [
      { id: 'o', isOriginal: true, createdAt: '2026-09-01T10:00:00Z', dental: { front: { image: 'data:x' } } },
      { id: 'a', createdAt: '2026-09-10T10:00:00Z', dental: { front: { image: 'data:x' }, left: { captured: false } } },
      { id: 'b', createdAt: '2026-11-10T10:00:00Z', dental: { front: { image: 'data:x' } } },
    ];
    const out = stripOldPhotos(sessions, 30, now);
    assert.deepEqual(out.map((s) => s.id), ['a']);
    assert.equal(out[0].dental.front.image, null);
    assert.equal(out[0].dental.front.imageRemoved, true);
    assert.equal(sessions[1].dental.front.image, 'data:x', 'input not mutated');
  });

  const { resultsCsv } = await import('../js/extras.js');
  test('results CSV has one row per record and escapes quotes', () => {
    const csv = resultsCsv([{ createdAt: '2026-11-15T10:00:00Z', kind: 'followup', pulse: { bpm: 70, quality: 'high' }, resp: { rpm: 14, quality: 'high', channel: 'chest' } },
      { createdAt: '2026-11-15T10:10:00Z', kind: 'alertness', alertness: { medianMs: 260, lapses: 1, falseStarts: 0 }, reply: { status: 'ok' } }]);
    const lines = csv.trim().split('\n');
    assert.equal(lines.length, 3);
    assert.match(lines[1], /"70","high","14","high","chest"/);
    assert.match(lines[2], /"260","1","0","ok"/);
  });
}

// ---- symptom checklist ----
{
  const { SYMPTOMS, symptomLabels, hasUrgent, symptomCounts, URGENT_TEXT } = await import('../js/symptoms.js');
  const { buildPacket, packetText } = await import('../js/packet.js');
  const { makeDemoSessions } = await import('../js/demo.js');
  const { resultsCsv } = await import('../js/extras.js');

  test('symptom checklist: labels keep the list order, unknown ids are dropped, urgent items are flagged', () => {
    assert.equal(new Set(SYMPTOMS.map((s) => s.id)).size, SYMPTOMS.length);
    assert.deepEqual(symptomLabels(['sleep', 'nope', 'headache']), ['Headache', 'Short sleep (5 h or less)']);
    assert.deepEqual(symptomLabels(undefined), []);
    assert.equal(hasUrgent(['headache']), false);
    assert.equal(hasUrgent(['headache', 'chest']), true);
    assert.equal(hasUrgent(null), false);
    assert.match(URGENT_TEXT, /emergency/);
  });

  test('symptom counts cover the last 14 days of checkups only', () => {
    const now = new Date('2026-11-15T12:00:00Z');
    const s = (daysAgo, checklist, kind = 'followup') => ({ kind, createdAt: new Date(+now - daysAgo * 864e5).toISOString(), context: { checklist } });
    const c = symptomCounts([s(1, ['headache', 'sleep']), s(2, ['sleep']), s(20, ['sleep']), s(3, ['sleep'], 'alertness'), s(4, undefined)], now);
    assert.equal(c.checkups, 3);
    assert.deepEqual(c.rows.map((r) => [r.id, r.count]), [['headache', 1], ['sleep', 2]]);
    assert.deepEqual(symptomCounts([], now), { checkups: 0, rows: [] });
  });

  test('packet, text summary and CSV carry the ticked symptoms; urgent ticks are called out', () => {
    const base = { id: 'a', kind: 'followup', createdAt: '2026-11-15T10:00:00Z', source: 'camera', dental: {} };
    const calm = buildPacket({ ...base, context: { symptoms: 'tired', checklist: ['sleep', 'headache'] } }, { original: null, recent: [] }).packet;
    assert.deepEqual(calm.self_report_checklist, ['Headache', 'Short sleep (5 h or less)']);
    assert.match(packetText(calm), /Symptoms ticked: Headache, Short sleep \(5 h or less\)/);
    assert.doesNotMatch(packetText(calm), /URGENT/);
    const urgent = buildPacket({ ...base, context: { checklist: ['chest'] } }, { original: null, recent: [] }).packet;
    assert.equal(urgent.self_report_urgent, true);
    assert.match(packetText(urgent), /URGENT ITEM TICKED/);
    const old = buildPacket({ ...base, context: { symptoms: '' } }, { original: null, recent: [] }).packet; // records made before the checklist existed
    assert.deepEqual(old.self_report_checklist, []);
    const csv = resultsCsv([{ ...base, context: { checklist: ['sleep', 'mouth'] } }]);
    assert.match(csv.split('\n')[0], /symptoms_ticked,eye_grid_right_marked,eye_grid_left_marked,acuity_right_logmar,acuity_left_logmar,acuity_distance_m$/);
    assert.match(csv.split("\n")[1], /"sleep mouth","","","","",""$/);
    assert.ok(makeDemoSessions(new Date('2026-11-15T12:00:00Z')).some((x) => x.context?.checklist?.includes('mouth')));
  });
}

// ---- reviewer reading order ----
{
  const { standouts } = await import('../js/review.js');
  test('standouts: urgent first, then changes, cautions, notes; calm packets list nothing', () => {
    const p = { results: { pulse_bpm: { value: 80, quality: 'medium' }, breathing_per_min: { value: 14, quality: 'high' } },
      comparison: { change_vs_original: { pulse: { kind: 'up', text: '+12 bpm' }, breathing: { kind: 'same', text: 'within the band' } } },
      vision_self_check: { new_vs_reference: { right: 2, left: 1 } },
      dental: [{ view: 'front', auto_compare: { flags: ['Gums look redder than at baseline.'] }, reviewer_marks: [{ x: 0.1, y: 0.2 }] }],
      self_report_checklist: ['Headache'], self_report_urgent: true, self_report: 'tired' };
    const s = standouts(p);
    assert.equal(s[0].level, 'urgent');
    assert.deepEqual(s.map((x) => x.level), ['urgent', 'change', 'change', 'change', 'caution', 'note', 'note', 'note']);
    assert.ok(s.some((x) => /Pulse is outside the noise band.*\+12 bpm/.test(x.text)));
    assert.ok(s.some((x) => /3 newly marked squares/.test(x.text)));
    assert.ok(!s.some((x) => /Breathing is outside/.test(x.text)));
    const calm = { results: { pulse_bpm: { value: 64, quality: 'high' }, breathing_per_min: { value: 14, quality: 'high' } }, comparison: {}, dental: [] };
    assert.deepEqual(standouts(calm), []);
    assert.match(standouts({ results: { pulse_bpm: { value: null }, breathing_per_min: { value: null } } })[0].text, /no pulse or breathing result/);
  });
}

test('sleep answer: buckets, short sleep flag, packet line', async () => {
  const { SLEEP_BUCKETS, sleepBucket, bucketFor, shortSleep, SYMPTOMS } = await import('../js/symptoms.js');
  const { buildPacket, packetText } = await import('../js/packet.js');
  assert.deepEqual(SLEEP_BUCKETS.map((b) => b.label), ['3 h or less', '4 to 5 h', '6 to 7 h', '8 h or more']);
  assert.equal(sleepBucket('4-5').h, 4.5);
  assert.equal(bucketFor(2).id, 'le3'); assert.equal(bucketFor(5.5).id, '4-5'); assert.equal(bucketFor(7).id, '6-7'); assert.equal(bucketFor(9).id, '8+');
  assert.ok(shortSleep('le3') && shortSleep('4-5') && !shortSleep('6-7'));
  assert.ok(SYMPTOMS.find((x) => x.id === 'sleep').auto, 'short sleep is ticked from the hours answer, not shown as a box');
  const base = { id: 'x', kind: 'followup', createdAt: '2026-11-15T12:00:00.000Z', pulse: { bpm: 70, quality: 'high' }, resp: { rpm: 14, quality: 'high' }, dental: {} };
  const p = buildPacket({ ...base, context: { sleepH: '4-5', checklist: ['sleep'] } }, { original: null, recent: [] });
  assert.equal(p.packet.self_report_sleep, '4 to 5 h');
  assert.match(packetText(p.packet), /Sleep last night \(self report\): 4 to 5 h/);
});

test('satellite message carries the sleep answer and decodes it', async () => {
  const { buildPacket, packetSms, decodeSms } = await import('../js/packet.js');
  const base = { id: 'x', kind: 'followup', createdAt: '2026-11-15T12:00:00.000Z', pulse: { bpm: 70, quality: 'high' }, resp: { rpm: 14, quality: 'high' }, dental: {} };
  const sms = packetSms(buildPacket({ ...base, context: { sleepH: '4-5', checklist: ['sleep'] } }, { original: null, recent: [] }).packet);
  assert.match(sms, /SYM SL \| SLP 4-5/);
  assert.ok(sms.length <= 160);
  assert.ok(decodeSms(sms).lines.includes('Sleep last night (self report): 4 to 5 h.'));
  assert.ok(decodeSms('RE FU 11-15 12:00 | SLP 8+').lines.includes('Sleep last night (self report): 8 h or more.'));
});

test('bench test report: pairs, failures, conditions, participant codes', async () => {
  const { benchReport, isParticipantCode } = await import('../js/change.js');
  const mk = (bpm, ref, cond, part, rpm = null, rref = '') => ({ createdAt: '2026-11-16T10:00:00Z', pulse: { bpm, quality: bpm == null ? 'none' : 'high' }, resp: { rpm, quality: 'high' }, reference: { pulseBpm: ref, breathsPerMin: rref, conditions: cond, participant: part, device: 'oximeter' } });
  const r = benchReport([mk(70, 72, 'window light', 'P01'), mk(80, 76, 'dim light, head movement', 'P02'), mk(null, 65, 'dim light', 'P02'), mk(66, 66, 'window light', 'P03', 14, 15), { createdAt: 'x', pulse: { bpm: 60 } }]);
  assert.equal(r.checkups, 4); assert.equal(r.participants, 3); assert.deepEqual(r.devices, ['oximeter']);
  assert.equal(r.pulse.attempts, 4); assert.equal(r.pulse.n, 3); assert.equal(r.pulse.failed, 1, 'no estimate counts as a failure, not dropped');
  assert.equal(r.pulse.mae, 2); assert.equal(r.pulse.ba.n, 3);
  assert.deepEqual(r.pulse.byCondition.find((c) => c.condition === 'window light'), { condition: 'window light', n: 2, mae: 1 });
  assert.equal(r.resp.n, 1);
  assert.ok(isParticipantCode('P01') && isParticipantCode('') && !isParticipantCode('Thien') && !isParticipantCode('P 01'));
});

test('backtest on Inspiration4 crew data matches chance where it should', async () => {
  const fs = await import('node:fs');
  const { backtestCrew } = await import('../js/crew.js');
  const d = JSON.parse(fs.readFileSync(new URL('../data/osd575-cmp.json', import.meta.url), 'utf8'));
  const r = backtestCrew(d);
  assert.equal(r.series, 108);
  assert.equal(r.outsideRange, 54, 'outside the min to max of 3 values: half, as chance predicts');
  assert.equal(r.outsidePI, 5); assert.equal(r.expectedPI, 5.4);
  assert.deepEqual(r.standouts[0], { name: 'IL-6', crew: 'C003', z: 50.4 });
  assert.deepEqual(r.il6, { up: 4, n: 4, chanceOneIn: 256 });
  assert.deepEqual(r.predictR1, { mean: 12.8, last: 11.2, trend: 16, n: 108 });
  assert.deepEqual(r.predictR45, { premean: 15.7, persist: 18.2, premeanBetter: 61, n: 107 });
  assert.deepEqual(r.returned, { 'R+45': 2, 'R+82': 2, 'R+194': 0, never: 1 });
});

test('adaptive personal ranges with published biological variation (v2.4)', async () => {
  const fs = await import('node:fs');
  const { adaptiveRange, adaptiveBacktest, BIO_VARIATION } = await import('../js/crew.js');
  const one = adaptiveRange([100], 10);
  assert.equal(one.ownWeight, 0, 'one value: all of the spread comes from the published variation');
  const many = adaptiveRange([100, 101, 99, 100, 102, 98, 100, 101, 99], 10);
  assert.equal(many.ownWeight, 67); assert.ok(many.hi - many.lo < one.hi - one.lo, 'steady own values narrow the range');
  assert.equal(adaptiveRange([], 10), null); assert.equal(adaptiveRange([5], 0), null);
  const d = JSON.parse(fs.readFileSync(new URL('../data/osd575-cmp.json', import.meta.url), 'utf8'));
  const r = adaptiveBacktest(d);
  assert.equal(Object.keys(BIO_VARIATION).length, 14);
  assert.equal(r.series, 56); assert.equal(r.expected, 2.8);
  assert.equal(r.own, 4); assert.equal(r.adaptive, 8); assert.equal(r.rcv, 19);
  assert.deepEqual(r.il6.map((x) => x.changePct), [94, 31, 190, 62]);
  assert.equal(r.il6[0].risePct, 102);
  assert.deepEqual(r.il6.filter((x) => x.beyond).map((x) => x.crew), ['C003'], 'only one IL-6 rise clears normal within-person variation');
});

test('readings typed in from the person\'s own devices: cleaned, charted, packed and decoded (v2.5)', async () => {
  const { cleanDevices, DEVICE_FIELDS, METRIC_DEFS, REGIONS, seriesFor, deviceLine, buildRegions } = await import('../js/overview.js');
  const { buildPacket, packetText, packetSms, decodeSms, deviceReadings, deviceText, SMS_LEGEND } = await import('../js/packet.js');
  const { standouts } = await import('../js/review.js');
  const { frText } = await import('../js/i18n-fr.js');
  assert.deepEqual(cleanDevices({ spo2: '97', pulse: '71', tempC: '36.84', sys: '128', dia: '82' }), { spo2: 97, pulse: 71, tempC: 36.8, sys: 128, dia: 82 });
  assert.deepEqual(cleanDevices({ spo2: '197', tempC: '98.6', pulse: '' }), null, 'typing slips and Fahrenheit are refused, not stored');
  assert.deepEqual(cleanDevices({ spo2: 96, sys: 120 }), { spo2: 96 }, 'blood pressure needs both numbers');
  assert.deepEqual(cleanDevices({ sys: 80, dia: 120 }), null, 'upper number must be above the lower');
  assert.equal(cleanDevices(null), null);
  for (const f of DEVICE_FIELDS) assert.ok(METRIC_DEFS[f.metric] && REGIONS.some((r) => r.metrics.includes(f.metric)), `${f.key} has a chart and a body region`);
  assert.equal(REGIONS.length, 7, 'no new body region');

  const base = { id: 'x', kind: 'followup', createdAt: '2026-11-16T12:00:00.000Z', pulse: { bpm: 70, quality: 'high' }, resp: { rpm: 14, quality: 'high' }, dental: {}, context: {} };
  const { packet } = buildPacket({ ...base, devices: { spo2: 93, pulse: 71, tempC: 36.8, sys: 128, dia: 82 } }, { original: null, recent: [] });
  assert.deepEqual(packet.device_readings, { oxygen_saturation_pct: 93, pulse_bpm: 71, temperature_c: 36.8, blood_pressure_mmhg: { systolic: 128, diastolic: 82 }, label: 'Typed in by the person from their own devices; not measured or checked by the app' });
  assert.equal(buildPacket(base, { original: null, recent: [] }).packet.device_readings, null);
  assert.match(packetText(packet), /Own devices \(typed in, not checked by the app\): oxygen saturation 93%, pulse 71 bpm, temperature 36\.8 °C, blood pressure 128\/82 mmHg/);
  const sms = packetSms(packet);
  assert.match(sms, /\| P70 \| R14 \| DEV O93 T36\.8 B128\/82 HR71/); assert.ok(sms.length <= 160);
  assert.ok(decodeSms(sms).lines.includes('From the person\'s own devices (typed in, not checked by the app): oxygen saturation 93%, temperature 36.8 °C, blood pressure 128/82 mmHg, pulse 71 bpm.'));
  assert.match(SMS_LEGEND, /DEV typed in from own devices/);
  const so = standouts({ ...packet, dental: [] });
  assert.ok(so.some((x) => x.level === 'change' && /^Oxygen saturation 93%, typed in/.test(x.text)), 'a low typed oxygen saturation is read first');
  assert.ok(!standouts({ ...packet, dental: [], device_readings: { oxygen_saturation_pct: 97 } }).some((x) => /Oxygen saturation/.test(x.text)));
  assert.equal(deviceText(deviceReadings({ tempC: 37.2 })), 'temperature 37.2 °C');

  const sessions = [97, 98, 97, 93].map((v, i) => ({ id: `d${i}`, kind: i ? 'followup' : 'baseline', createdAt: `2026-11-1${i}T09:00:00.000Z`, pulse: { bpm: 70, quality: 'high' }, resp: { rpm: 14, quality: 'high' }, dental: {}, devices: { spo2: v } }));
  assert.deepEqual(seriesFor('spo2', sessions).map((p) => p.v), [97, 98, 97, 93]);
  const lungs = buildRegions(sessions, { original: sessions[0], floors: { pulse: 8, resp: 3 } }).find((r) => r.id === 'lungs');
  assert.equal(lungs.status, 'review'); assert.match(lungs.reasons.join(' '), /Oxygen saturation, fingertip oximeter 93 % \(first 97\)/);
  assert.match(deviceLine('spo2', 93), /below that: warm your hand, sit still and recheck/);
  assert.match(deviceLine('spo2', 98), /inside that/);
  assert.equal(deviceLine('temp', 36.8), '');
  for (const en of [deviceLine('spo2', 93), deviceLine('spo2', 98), deviceLine('bpSys', 128), 'oxygen saturation 93%, pulse 71 bpm, temperature 36.8 °C, blood pressure 128/82 mmHg',
    decodeSms(sms).lines.find((l) => /own devices/.test(l)), so.find((x) => /Oxygen saturation/.test(x.text)).text, 'Oxygen saturation, fingertip oximeter (no data)', 'Temperature, thermometer, °C', 'Blood pressure, upper number, mmHg']) {
    const fr = frText(en); assert.ok(fr && fr !== en && !/undefined|null/.test(fr), `French for: ${en} -> ${fr}`);
  }
  assert.equal(frText('temperature 36.8 °C'), 'température 36,8 °C');
  const { lineChart } = await import('../js/overview.js');
  const pts = [97, 98, 99, 100].map((v, i) => ({ t: i * 86400000, v, q: 'high' }));
  const axis = (svg) => [...svg.matchAll(/class="ax" text-anchor="end">([-\d.]+)</g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...axis(lineChart(pts, { ref: { base: 97, band: 3, label: 'your first value' } }))) > 100, 'without a ceiling the padded axis passes 100');
  assert.equal(Math.max(...axis(lineChart(pts, { ref: { base: 97, band: 3, label: 'your first value' }, ceil: 100 }))), 100, 'oxygen saturation axis stops at 100%');
});

