// Review packet: a small, honest summary a remote nurse or flight surgeon can read.
// States what was measured, how good the capture was, and what was NOT assessed.

import { symptomLabels, hasUrgent } from './symptoms.js';

export const LIMITS = [
  'Camera estimates of pulse and breathing are experimental and not validated for clinical use.',
  'Dental photos show visible front surfaces only; back surfaces and below the gum line are not assessed.',
  'No diagnosis is made. New or severe symptoms need direct clinical contact.',
];

export function buildPacket(session, cmp, { includeImages = false, alertness = null, change = null, vision = null } = {}) {
  const src = session.source === 'file' ? 'recorded video' : 'live camera';
  const packet = {
    schema: 'relaisecho-packet/0.1',
    created: new Date().toISOString(),
    checkup: { id: session.id, kind: session.kind, capturedAt: session.createdAt, source: src, camera: session.cameraLabel || '', context: session.context },
    results: {
      pulse_bpm: { value: session.pulse?.bpm ?? null, quality: session.pulse?.quality ?? 'none', windows: `${session.pulse?.accepted ?? 0} of ${session.pulse?.total ?? 0} accepted`, note: session.pulse?.reason || '', label: 'EXPERIMENTAL estimate' },
      breathing_per_min: { value: session.resp?.rpm ?? null, quality: session.resp?.quality ?? 'none', usable_seconds: Math.round(session.resp?.seconds ?? 0), note: session.resp?.reason || '', label: 'EXPERIMENTAL estimate' },
      eyes_during_scan: session.eyes && session.eyes.trackedPct >= 50 ? { blinks_per_min: session.eyes.blinksPerMin, closed_pct: session.eyes.closedPct, long_closures: session.eyes.longClosures, label: 'EXPERIMENTAL, shown not judged' } : null,
      pulse_regions_used: session.pulse?.regionsUsed || null,
      capture: { usable_seconds: Math.round(session.usableSeconds || 0), elapsed_seconds: Math.round(session.elapsedSeconds || 0), rejected_reasons: session.rejectCounts || {} },
    },
    comparison: {
      original_baseline: cmp.original ? { date: cmp.original.createdAt, pulse_bpm: cmp.original.pulse?.bpm ?? null, breathing_per_min: cmp.original.resp?.rpm ?? null } : null,
      recent: cmp.recent.map((s) => ({ date: s.createdAt, pulse_bpm: s.pulse?.bpm ?? null, breathing_per_min: s.resp?.rpm ?? null })),
      change_vs_original: change,
    },
    dental: Object.values(session.dental || {}).map((d) => ({
      view: d.view, captured: !!d.captured, sharpness: d.sharpness ? Math.round(d.sharpness) : null,
      reviewer_marks: (d.marks || []).map((m) => ({ x: +m.x.toFixed(3), y: +m.y.toFixed(3), note: m.note })),
      auto_compare: d.auto ? { comparable: d.auto.comparable, flags: d.auto.flags, notes: d.auto.notes, lighting_delta_L: d.auto.lightingDelta, tooth_yellow_delta_b: d.auto.toothYellowDelta ?? null, tooth_light_delta_L: d.auto.toothLightDelta ?? null, gum_red_delta_a: d.auto.gumRedDelta ?? null, tooth_area_change_pct: d.auto.toothAreaChangePct, changed_pct: d.auto.changedPct, label: 'EXPERIMENTAL colour comparison with baseline' } : null,
      ...(includeImages && d.image ? { image_jpeg_dataurl: d.image } : {}),
    })),
    alertness: alertness?.alertness ? { date: alertness.createdAt, median_ms: alertness.alertness.medianMs, lapses: alertness.alertness.lapses,
      false_starts: alertness.alertness.falseStarts, label: 'EXPERIMENTAL 3 minute reaction test; device delay included' } : null,
    vision_self_check: vision,
    self_report_checklist: symptomLabels(session.context?.checklist),
    self_report_urgent: hasUrgent(session.context?.checklist),
    self_report: session.context?.symptoms || '',
    reference_values: session.reference || null,
    not_assessed: LIMITS,
  };
  const json = JSON.stringify(packet, null, 2);
  return { packet, json, bytes: new Blob([json]).size };
}

export function packetText(p) {
  const r = p.results;
  const lines = [
    `RelaisÉcho Link review packet (${p.checkup.kind}, ${p.checkup.capturedAt.slice(0, 16).replace('T', ' ')} UTC)`,
    `Source: ${p.checkup.source}`,
    `Pulse: ${r.pulse_bpm.value ?? 'no result'} bpm (${r.pulse_bpm.quality}; ${r.pulse_bpm.windows})`,
    `Breathing: ${r.breathing_per_min.value ?? 'no result'} /min (${r.breathing_per_min.quality})`,
  ];
  if (p.comparison.original_baseline) lines.push(`Original baseline ${p.comparison.original_baseline.date.slice(0, 10)}: pulse ${p.comparison.original_baseline.pulse_bpm ?? '-'}, breathing ${p.comparison.original_baseline.breathing_per_min ?? '-'}`);
  for (const d of p.dental) lines.push(`Dental ${d.view}: ${d.captured ? 'captured' : 'not captured'}${d.reviewer_marks.length ? `, ${d.reviewer_marks.length} mark(s)` : ''}${d.auto_compare ? `; auto compare: ${d.auto_compare.flags?.length ? d.auto_compare.flags.join(' ') : d.auto_compare.comparable ? 'no colour change beyond limits' : 'not compared'}` : ''}`);
  if (p.alertness) lines.push(`Alertness test ${p.alertness.date.slice(0, 16).replace('T', ' ')} UTC: median ${p.alertness.median_ms ?? '-'} ms, ${p.alertness.lapses} lapses, ${p.alertness.false_starts} false starts (experimental)`);
  if (r.eyes_during_scan) lines.push(`Eyes during scan: ${r.eyes_during_scan.blinks_per_min} blinks/min, closed ${r.eyes_during_scan.closed_pct}% (experimental)`);
  if (p.vision_self_check) lines.push(`Eye grid ${p.vision_self_check.date.slice(0, 10)}: right ${p.vision_self_check.right_eye}; left ${p.vision_self_check.left_eye}${p.vision_self_check.new_vs_reference ? `; new vs reference: right ${p.vision_self_check.new_vs_reference.right}, left ${p.vision_self_check.new_vs_reference.left}` : ''} (experimental self check)`);
  if (p.self_report_urgent) lines.push('URGENT ITEM TICKED: chest pain or shortness of breath. Contact the person directly.');
  if (p.self_report_checklist?.length) lines.push(`Symptoms ticked: ${p.self_report_checklist.join(', ')}`);
  if (p.self_report) lines.push(`Self report: ${p.self_report}`);
  lines.push('Not assessed: back tooth surfaces, below gum line; no diagnosis made. Estimates are experimental.');
  return lines.join('\n');
}
