// Review packet: a small, honest summary a remote nurse or flight surgeon can read.
// States what was measured, how good the capture was, and what was NOT assessed.

export const LIMITS = [
  'Camera estimates of pulse and breathing are experimental and not validated for clinical use.',
  'Dental photos show visible front surfaces only; back surfaces and below the gum line are not assessed.',
  'No diagnosis is made. New or severe symptoms need direct clinical contact.',
];

export function buildPacket(session, cmp, { includeImages = false, alertness = null, change = null } = {}) {
  const src = session.source === 'file' ? 'recorded video' : 'live camera';
  const packet = {
    schema: 'relaisecho-packet/0.1',
    created: new Date().toISOString(),
    checkup: { id: session.id, kind: session.kind, capturedAt: session.createdAt, source: src, camera: session.cameraLabel || '', context: session.context },
    results: {
      pulse_bpm: { value: session.pulse?.bpm ?? null, quality: session.pulse?.quality ?? 'none', windows: `${session.pulse?.accepted ?? 0} of ${session.pulse?.total ?? 0} accepted`, note: session.pulse?.reason || '', label: 'EXPERIMENTAL estimate' },
      breathing_per_min: { value: session.resp?.rpm ?? null, quality: session.resp?.quality ?? 'none', usable_seconds: Math.round(session.resp?.seconds ?? 0), note: session.resp?.reason || '', label: 'EXPERIMENTAL estimate' },
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
  for (const d of p.dental) lines.push(`Dental ${d.view}: ${d.captured ? 'captured' : 'not captured'}${d.reviewer_marks.length ? `, ${d.reviewer_marks.length} mark(s)` : ''}`);
  if (p.alertness) lines.push(`Alertness test ${p.alertness.date.slice(0, 16).replace('T', ' ')} UTC: median ${p.alertness.median_ms ?? '-'} ms, ${p.alertness.lapses} lapses, ${p.alertness.false_starts} false starts (experimental)`);
  if (p.self_report) lines.push(`Self report: ${p.self_report}`);
  lines.push('Not assessed: back tooth surfaces, below gum line; no diagnosis made. Estimates are experimental.');
  return lines.join('\n');
}
