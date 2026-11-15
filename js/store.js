// Local storage of checkups in IndexedDB. Nothing leaves the device unless the user exports it.

const DB = 'relaisecho-link';
const STORE = 'sessions';

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
  return tx('readwrite', (s) => s.put(session));
}

export async function listSessions() {
  const all = await tx('readonly', (s) => s.getAll());
  return (all || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function deleteSession(id) {
  return tx('readwrite', (s) => s.delete(id));
}

export function clearAll() {
  return tx('readwrite', (s) => s.clear());
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
