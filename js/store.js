// Local storage of checkups in IndexedDB. Nothing leaves the device unless the user exports it.

const DB = 'relaisecho-link';
const STORE = 'sessions';

// Profiles: one shared device (a station laptop, a family tablet, a clinic iPad) can hold
// checkups for several people. Every read and write below is scoped to the current profile.
// Checkups saved before profiles existed belong to 'default'.
export const DEFAULT_PROFILE = 'default';
let currentProfile = DEFAULT_PROFILE;
export function setProfile(id) { currentProfile = id || DEFAULT_PROFILE; }
export function getProfile() { return currentProfile; }
const inProfile = (s) => (s.profileId || DEFAULT_PROFILE) === currentProfile;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const out = fn(s);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
  });
}

export function saveSession(session) {
  const rec = session.profileId ? session : { ...session, profileId: currentProfile };
  if (rec !== session) session.profileId = currentProfile;
  return tx('readwrite', (s) => s.put(rec));
}

async function allSessions() {
  return (await tx('readonly', (s) => s.getAll())) || [];
}

export async function listSessions() {
  return (await allSessions()).filter(inProfile).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Every profile, for the profile list and for deleting a whole profile.
export async function countByProfile() {
  const out = {};
  for (const s of await allSessions()) { const k = s.profileId || DEFAULT_PROFILE; out[k] = (out[k] || 0) + 1; }
  return out;
}

export function deleteSession(id) {
  return tx('readwrite', (s) => s.delete(id));
}

// Deletes the current profile's checkups only; other people on this device are untouched.
export async function clearAll() {
  const ids = (await listSessions()).map((s) => s.id);
  if (!ids.length) return;
  await tx('readwrite', (s) => { ids.forEach((id) => s.delete(id)); });
}

// The original baseline is the first baseline ever saved; it is never replaced automatically,
// so slow change cannot quietly become the new normal.
export async function baselineAndRecent(excludeId) {
  const all = (await listSessions()).filter((s) => s.id !== excludeId && s.complete && s.kind !== 'demo');
  const original = all.find((s) => s.kind === 'baseline' && s.isOriginal) || all.find((s) => s.kind === 'baseline') || null;
  const recent = all.filter((s) => s !== original).slice(-3);
  return { original, recent, all };
}

export function newId() {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 7)}`;
}

// Deliberate, confirmed action from History: pick which baseline is the reference.
// Earlier baselines stay in History; nothing is deleted.
export async function setOriginal(id) {
  const all = await listSessions();
  for (const s of all) {
    if (s.kind === 'baseline' && (s.isOriginal || s.id === id)) await saveSession({ ...s, isOriginal: s.id === id });
  }
}

export async function allIds() {
  return new Set((await allSessions()).map((s) => s.id));
}
