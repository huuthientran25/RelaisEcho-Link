// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Restore checkups from an exported backup (History > Export all). Nothing is overwritten:
// checkups already on this device are kept, and the device's own original baseline stays the original.
const KINDS = new Set(['baseline', 'followup', 'symptom', 'demo', 'alertness', 'vision', 'exp', 'acuity']);

export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { sessions: [], error: 'This file is not valid JSON.' }; }
  if (!Array.isArray(data)) return { sessions: [], error: 'This file is not a RelaisÉcho backup (expected a list of checkups).' };
  const sessions = data.filter((s) => s && typeof s === 'object' && typeof s.id === 'string' && s.id
    && typeof s.createdAt === 'string' && !Number.isNaN(+new Date(s.createdAt)) && KINDS.has(s.kind));
  return { sessions, rejected: data.length - sessions.length, error: sessions.length ? '' : 'No checkups found in this file.' };
}

export function mergePlan(existing, incoming) {
  const have = new Set(existing.map((s) => s.id));
  const deviceHasOriginal = existing.some((s) => s.kind === 'baseline' && s.isOriginal);
  const toAdd = incoming.filter((s) => !have.has(s.id)).map((s) => (deviceHasOriginal && s.isOriginal ? { ...s, isOriginal: false } : s));
  return { toAdd, skipped: incoming.length - toAdd.length };
}
