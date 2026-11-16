// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Symptom checklist: a short fixed list ticked before a checkup, so a reviewer reads the same
// words every time and the History screen can count them. Free text stays available next to it.
// The list is a design choice for the prototype (common in-flight complaints plus the items a
// remote nurse would ask first); it is not a validated questionnaire and nothing is scored.

export const SYMPTOMS = [
  { id: 'headache', label: 'Headache' },
  { id: 'congestion', label: 'Stuffy nose or puffy face' },
  { id: 'vision', label: 'Blurry or changed vision' },
  { id: 'nausea', label: 'Nausea or dizziness' },
  { id: 'back', label: 'Back pain' },
  { id: 'sleep', label: 'Short sleep (5 h or less)', auto: true }, // ticked automatically from the sleep hours answer below
  { id: 'mouth', label: 'Tooth or gum pain' },
  { id: 'fever', label: 'Feverish or chills' },
  { id: 'breath', label: 'Short of breath', urgent: true },
  { id: 'chest', label: 'Chest pain', urgent: true },
];

// Sleep last night, asked once in the checkup and reused by the Board's sleep pressure tile.
// Buckets are whole hours as asked; the hours value is the one the sleep model uses for the bucket (a design choice).
export const SLEEP_BUCKETS = [
  { id: 'le3', label: '3 h or less', h: 3 },
  { id: '4-5', label: '4 to 5 h', h: 4.5 },
  { id: '6-7', label: '6 to 7 h', h: 6.5 },
  { id: '8+', label: '8 h or more', h: 8 },
];
export const sleepBucket = (id) => SLEEP_BUCKETS.find((b) => b.id === id) || null;
// Hours back to the closest bucket (for nights entered as exact times).
export const bucketFor = (h) => (!Number.isFinite(h) ? null : h <= 3.5 ? SLEEP_BUCKETS[0] : h < 5.75 ? SLEEP_BUCKETS[1] : h < 7.75 ? SLEEP_BUCKETS[2] : SLEEP_BUCKETS[3]);
export const shortSleep = (id) => id === 'le3' || id === '4-5';

export const URGENT_TEXT = 'Chest pain or trouble breathing can be an emergency. Contact your clinician, flight surgeon or local emergency number now. This app cannot assess it.';

const known = (ids) => SYMPTOMS.filter((s) => Array.isArray(ids) && ids.includes(s.id));

// Labels in the list's own order; unknown ids are dropped.
export const symptomLabels = (ids) => known(ids).map((s) => s.label);
export const hasUrgent = (ids) => known(ids).some((s) => s.urgent);

// How many checkups in the last `days` days had each symptom ticked. Reaction tests are not checkups.
export function symptomCounts(sessions, now = new Date(), days = 14) {
  const since = +now - days * 24 * 3600 * 1000;
  const checkups = (sessions || []).filter((s) => s.kind !== 'alertness' && s.kind !== 'vision' && s.kind !== 'exp' && s.kind !== 'acuity' && +new Date(s.createdAt) >= since && +new Date(s.createdAt) <= +now);
  const rows = SYMPTOMS.map((sym) => ({ ...sym, count: checkups.filter((s) => s.context?.checklist?.includes(sym.id)).length })).filter((r) => r.count > 0);
  return { checkups: checkups.length, rows };
}
