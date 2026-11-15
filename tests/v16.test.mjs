import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDemoSessions, DEMO_PROFILE } from '../js/demo.js';
import { validatePacket, safeImage } from '../js/review.js';
import { benchError, noiseFloor } from '../js/change.js';
import { buildPacket } from '../js/packet.js';

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
