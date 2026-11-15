import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSpeaker } from '../js/speech.js';
import { parseBackup, mergePlan } from '../js/backup.js';

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
