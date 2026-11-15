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
  { id: 'sleep', label: 'Slept badly' },
  { id: 'mouth', label: 'Tooth or gum pain' },
  { id: 'fever', label: 'Feverish or chills' },
  { id: 'breath', label: 'Short of breath', urgent: true },
  { id: 'chest', label: 'Chest pain', urgent: true },
];

export const URGENT_TEXT = 'Chest pain or trouble breathing can be an emergency. Contact your clinician, flight surgeon or local emergency number now. This app cannot assess it.';

const known = (ids) => SYMPTOMS.filter((s) => Array.isArray(ids) && ids.includes(s.id));

// Labels in the list's own order; unknown ids are dropped.
export const symptomLabels = (ids) => known(ids).map((s) => s.label);
export const hasUrgent = (ids) => known(ids).some((s) => s.urgent);

// How many checkups in the last `days` days had each symptom ticked. Reaction tests are not checkups.
export function symptomCounts(sessions, now = new Date(), days = 14) {
  const since = +now - days * 24 * 3600 * 1000;
  const checkups = (sessions || []).filter((s) => s.kind !== 'alertness' && s.kind !== 'vision' && +new Date(s.createdAt) >= since && +new Date(s.createdAt) <= +now);
  const rows = SYMPTOMS.map((sym) => ({ ...sym, count: checkups.filter((s) => s.context?.checklist?.includes(sym.id)).length })).filter((r) => r.count > 0);
  return { checkups: checkups.length, rows };
}
