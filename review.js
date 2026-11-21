// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Practitioner side: check a packet before showing it. Packets are plain JSON written by buildPacket().
export function validatePacket(p) {
  if (!p || typeof p !== 'object') return 'This file is not a review packet.';
  if (typeof p.schema !== 'string' || !p.schema.startsWith('relaisecho-packet/')) return 'This file is not a RelaisÉcho Link review packet (schema missing).';
  if (!p.checkup || !p.results || !p.results.pulse_bpm || !p.results.breathing_per_min) return 'The packet is missing its results section.';
  if (!Array.isArray(p.dental)) return 'The packet is missing its dental section.';
  return '';
}

// Data URLs only, and only JPEG or PNG, before an image from a packet is shown.
export function safeImage(src) {
  return typeof src === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : null;
}

// "What stands out": the few lines a reviewer should read first, taken only from what the packet
// already states. A reading order, not a score and not a finding. Urgent items come first.
export function standouts(p) {
  const out = [];
  const add = (level, text) => out.push({ level, text });
  if (p.self_report_urgent) add('urgent', 'Chest pain or shortness of breath was ticked. Contact the person directly.');
  const ch = p.comparison?.change_vs_original;
  for (const [label, x] of [['Pulse', ch?.pulse], ['Breathing', ch?.breathing]]) {
    if (x && (x.kind === 'up' || x.kind === 'down')) add('change', `${label} is outside the noise band against the original baseline: ${String(x.text).replace(/\.$/, '')}.`);
  }
  const q = (label, r) => { if (r && r.value != null && r.quality && r.quality !== 'high') add('caution', `${label} estimate came from a ${r.quality} quality capture, so read it loosely.`); };
  q('Pulse', p.results?.pulse_bpm); q('Breathing', p.results?.breathing_per_min);
  if (p.results?.pulse_bpm?.value == null && p.results?.breathing_per_min?.value == null) add('caution', 'The capture gave no pulse or breathing result.');
  const ill = p.illness_watch;
  if (ill?.level === 'possible') add('change', `Possible illness signs (modeled): ${[ill.temperature_c != null && ill.temperature_c >= 38 ? `temperature ${ill.temperature_c} °C` : '', ill.symptoms?.length ? `symptoms ${ill.symptoms.join(', ')}` : '', ...(ill.signals || [])].filter(Boolean).join('; ')}. Contact the person; not a diagnosis.`);
  const o2 = p.device_readings?.oxygen_saturation_pct;
  if (Number.isFinite(o2) && o2 < 95) add('change', `Oxygen saturation ${o2}%, typed in from the person's own oximeter: below the 95% to 100% most healthy people read (FDA). Not checked by the app; cold fingers, movement and darker skin affect oximeters.`);
  const v = p.vision_self_check?.new_vs_reference;
  if (v && v.right + v.left > 0) add('change', `Eye grid: ${v.right + v.left} newly marked square${v.right + v.left === 1 ? '' : 's'} against the person's reference (right ${v.right}, left ${v.left}).`);
  for (const d of p.dental || []) {
    if (d.auto_compare?.flags?.length) add('change', `Dental ${d.view}: ${d.auto_compare.flags.join(' ')}`);
    if (d.reviewer_marks?.length) add('note', `Dental ${d.view}: ${d.reviewer_marks.length} mark${d.reviewer_marks.length === 1 ? '' : 's'} placed by the sender.`);
  }
  const ac = p.acuity_self_check;
  for (const k of ['right_eye', 'left_eye']) if (ac?.[k]?.vs_first === 'worse') add('change', `Eye chart: ${k === 'right_eye' ? 'right' : 'left'} eye ${ac[k].snellen}, 2 or more lines worse than the person's first check at ${ac.distance_m} m.`);
  for (const x of p.experimental_checks || []) if (x.differs?.length) add('note', `Experimental ${x.title.toLowerCase()}: differs from the person's own first check (${x.differs.join(', ')}). Experimental, often explained by light or distance.`);
  for (const t of p.trends || []) {
    if (t.kind === 'sustained') add(t.experimental ? 'note' : 'change', `${t.measure}: ${t.side} the band ${t.run} checks in a row, a sustained change rather than one odd value${t.experimental ? ' (experimental measure)' : ''}.`);
    else if (t.kind === 'early_warning') add('note', `${t.measure}: early warning, the smoothed trend sits ${t.side} the person's own recent normal (modeled; recheck).`);
    else if (t.kind === 'drift') add('note', `${t.measure}: drifting ${t.side === 'above' ? 'up' : 'down'} about ${Math.abs(t.per_week)} ${t.unit} a week, still inside the band.`);
  }
  if (p.self_report_checklist?.length) add('note', `Symptoms ticked: ${p.self_report_checklist.join(', ')}.`);
  if (p.self_report) add('note', 'The person wrote a note (see Self report).');
  const order = { urgent: 0, change: 1, caution: 2, note: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
