// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Review packet: a small, honest summary a remote nurse or flight surgeon can read.
// States what was measured, how good the capture was, and what was NOT assessed.

import { SLEEP_BUCKETS, sleepBucket, symptomLabels, hasUrgent } from './symptoms.js';

export const LIMITS = [
  'Camera estimates of pulse and breathing are experimental and not validated for clinical use.',
  'Dental photos show visible front surfaces only; back surfaces and below the gum line are not assessed.',
  'No diagnosis is made. New or severe symptoms need direct clinical contact.',
];

export function buildPacket(session, cmp, { includeImages = false, alertness = null, change = null, vision = null, experimental = [], acuity = null, trends = [], benchAgreement = null } = {}) {
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
      eyelid_opening_mm: session.eyelid ? { right: session.eyelid.right, left: session.eyelid.left, baseline_right: cmp.original?.eyelid?.right ?? null, baseline_left: cmp.original?.eyelid?.left ?? null, label: 'EXPERIMENTAL, iris scaled; compared only with the original baseline' } : null,
      capture: { usable_seconds: Math.round(session.usableSeconds || 0), elapsed_seconds: Math.round(session.elapsedSeconds || 0), rejected_reasons: session.rejectCounts || {} },
    },
    comparison: {
      original_baseline: cmp.original ? { date: cmp.original.createdAt, pulse_bpm: cmp.original.pulse?.bpm ?? null, breathing_per_min: cmp.original.resp?.rpm ?? null } : null,
      recent: cmp.recent.map((s) => ({ date: s.createdAt, pulse_bpm: s.pulse?.bpm ?? null, breathing_per_min: s.resp?.rpm ?? null })),
      change_vs_original: change,
      bench_agreement: benchAgreement,
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
    acuity_self_check: acuity,
    experimental_checks: experimental || [],
    trends: trends || [],
    self_report_checklist: symptomLabels(session.context?.checklist),
    self_report_urgent: hasUrgent(session.context?.checklist),
    self_report_sleep: sleepBucket(session.context?.sleepH)?.label || null,
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
  if (p.acuity_self_check) { const a = p.acuity_self_check; lines.push(`Eye chart ${a.date.slice(0, 10)} at ${a.distance_m} m: right ${a.right_eye?.snellen ?? '-'} (${a.right_eye?.vs_first ?? '-'}), left ${a.left_eye?.snellen ?? '-'} (${a.left_eye?.vs_first ?? '-'}) (experimental self check)`); }
  const ag = p.comparison?.bench_agreement;
  if (ag) for (const [l, a, u] of [['Pulse', ag.pulse_bpm, 'bpm'], ['Breathing', ag.breathing_per_min, '/min']]) if (a) lines.push(`Bench agreement, ${l.toLowerCase()}: ${a.pairs} pairs, bias ${a.bias} ${u}, limits ${a.limits_of_agreement[0]} to ${a.limits_of_agreement[1]} ${u} (own reference device)`);
  for (const t of p.trends || []) lines.push(`Trend: ${t.measure} ${t.kind === 'sustained' ? `${t.side} the band ${t.run} checks in a row (sustained)` : `drifting ${t.side === 'above' ? 'up' : 'down'} about ${Math.abs(t.per_week)} ${t.unit} a week, still inside the band`}${t.experimental ? ' [experimental]' : ''}`);
  for (const x of p.experimental_checks || []) lines.push(`${x.title} ${x.date.slice(0, 10)}: ${Object.entries(x.values).filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`).join(', ')}${x.differs?.length ? `; differs from own first check: ${x.differs.join(', ')}` : x.verdict === 'reference' ? '; first check' : ''} (experimental${x.check === 'circ' ? ', indexes, not blood pressure or oxygen saturation' : ''})`);
  if (p.integrity?.fingerprint) lines.push(`Fingerprint: ${p.integrity.fingerprint}`);
  if (p.self_report_urgent) lines.push('URGENT ITEM TICKED: chest pain or shortness of breath. Contact the person directly.');
  if (p.self_report_checklist?.length) lines.push(`Symptoms ticked: ${p.self_report_checklist.join(', ')}`);
  if (p.self_report_sleep) lines.push(`Sleep last night (self report): ${p.self_report_sleep}`);
  if (p.self_report) lines.push(`Self report: ${p.self_report}`);
  lines.push('Not assessed: back tooth surfaces, below gum line; no diagnosis made. Estimates are experimental.');
  return lines.join('\n');
}

// A 160 character version for a satellite text messenger or SMS, when a file or QR code cannot be sent.
// Most important first; whatever does not fit is dropped and the message ends with "+MORE".
// The legend (SMS_LEGEND) is shown next to it and must travel with the first message to a new reviewer.
const SYM_CODE = { Headache: 'HA', 'Stuffy nose or puffy face': 'NF', 'Blurry or changed vision': 'VI', 'Nausea or dizziness': 'ND', 'Back pain': 'BK', 'Short sleep (5 h or less)': 'SL', 'Slept badly': 'SL', 'Tooth or gum pain': 'TG', 'Feverish or chills': 'FV', 'Short of breath': 'SB', 'Chest pain': 'CP' };
const TREND_CODE = { Pulse: 'P', Breathing: 'R', 'Reaction time, median': 'RT', 'Gum redness change, front photo': 'GUM', 'Mouth opening (lips)': 'JAW' };
export const SMS_MAX = 160;
export const SMS_LEGEND = 'RE = RelaisÉcho checkup, BL baseline / FU follow up, time UTC. URGENT = chest pain (CP) or short of breath (SB) ticked: contact the person now. P pulse bpm, R breaths/min: "ok" inside own band, +N or -N beyond it, ~ low quality, xN = N checks in a row outside. RT reaction ms. SYM ticked: HA headache, NF nose or face, VI vision, ND nausea, BK back, SL short sleep (5 h or less), TG tooth or gum, FV fever, SB short of breath, CP chest pain. SLP sleep last night as answered: le3 = 3 h or less, 4-5, 6-7, 8+ hours. DENT gum a* / teeth b* change. EXP checks that differ. EYE new grid squares, ACU eye chart worse. NOTE = person wrote a note.';
export function packetSms(p) {
  const r = p.results || {};
  const ch = p.comparison?.change_vs_original || {};
  const trends = p.trends || [];
  const sus = (measure) => { const t = trends.find((x) => x.measure === measure && x.kind === 'sustained'); return t ? `x${t.run}` : ''; };
  const vital = (code, v, c, quality, measure) => {
    if (v == null) return `${code}-`;
    const q = quality && quality !== 'high' ? '~' : '';
    const d = c && (c.kind === 'up' || c.kind === 'down') && Number.isFinite(c.diff) ? `${c.diff > 0 ? '+' : ''}${Math.round(c.diff)}` : c && c.kind === 'noise' ? 'ok' : '';
    return `${code}${v}${q}${d ? ` ${d}` : ''}${sus(measure)}`;
  };
  const head = `RE ${p.checkup.kind === 'baseline' ? 'BL' : 'FU'} ${p.checkup.capturedAt.slice(5, 16).replace('T', ' ')}`;
  const tokens = [];
  if (p.self_report_urgent) tokens.push(`URGENT ${(p.self_report_checklist || []).filter((x) => x === 'Chest pain' || x === 'Short of breath').map((x) => SYM_CODE[x]).join('+')}`);
  tokens.push(vital('P', r.pulse_bpm?.value, ch.pulse, r.pulse_bpm?.quality, 'Pulse'));
  tokens.push(vital('R', r.breathing_per_min?.value, ch.breathing, r.breathing_per_min?.quality, 'Breathing'));
  const sym = (p.self_report_checklist || []).map((x) => SYM_CODE[x]).filter(Boolean);
  if (sym.length) tokens.push(`SYM ${sym.join(',')}`);
  const slp = SLEEP_BUCKETS.find((b) => b.label === p.self_report_sleep);
  if (slp) tokens.push(`SLP ${slp.id}`);
  if (p.alertness) tokens.push(`RT${p.alertness.median_ms}${sus('Reaction time, median')}`);
  const dent = [];
  for (const d of p.dental || []) {
    const a = d.auto_compare;
    if (a?.flags?.length) { if (a.gum_red_delta_a != null) dent.push(`gum${a.gum_red_delta_a > 0 ? '+' : ''}${a.gum_red_delta_a}`); if (a.tooth_yellow_delta_b != null) dent.push(`teeth${a.tooth_yellow_delta_b > 0 ? '+' : ''}${a.tooth_yellow_delta_b}`); }
  }
  if (dent.length) tokens.push(`DENT ${[...new Set(dent)].join(',')}`);
  for (const t of trends) if (t.kind === 'sustained' && TREND_CODE[t.measure] && !['P', 'R', 'RT'].includes(TREND_CODE[t.measure])) tokens.push(`${TREND_CODE[t.measure]}x${t.run}`);
  const v = p.vision_self_check?.new_vs_reference;
  if (v && v.right + v.left > 0) tokens.push(`EYE R${v.right}L${v.left}`);
  const ac = p.acuity_self_check;
  const worse = ['right_eye', 'left_eye'].filter((k) => ac?.[k]?.vs_first === 'worse').map((k) => k[0].toUpperCase());
  if (worse.length) tokens.push(`ACU worse ${worse.join('')}`);
  const exp = (p.experimental_checks || []).filter((x) => x.differs?.length).map((x) => x.check.toUpperCase());
  if (exp.length) tokens.push(`EXP ${exp.join(',')}`);
  if (p.self_report) tokens.push('NOTE');
  let out = head;
  let dropped = false;
  for (const t of tokens) {
    if (dropped) break;
    const next = `${out} | ${t}`;
    if (next.length <= SMS_MAX - 6) out = next; else dropped = true;
  }
  return dropped ? `${out} +MORE` : out;
}

// The reviewer's side of the short message: turns "RE FU 11-14 13:33 | P72 +10x3 | ..." back into plain lines.
const SYM_NAME = Object.fromEntries(Object.entries(SYM_CODE).map(([k, v]) => [v, k]));
export function decodeSms(text) {
  const t = String(text || '').trim();
  const parts = t.split('|').map((x) => x.trim()).filter(Boolean);
  if (!parts.length || !/^RE (BL|FU) /.test(parts[0])) return { ok: false, lines: ['This does not look like a RelaisÉcho short message (it should start with "RE BL" or "RE FU").'] };
  const more = /\+MORE$/.test(t);
  if (more) parts[parts.length - 1] = parts[parts.length - 1].replace(/\s*\+MORE$/, '');
  const lines = [];
  const [, kind, when] = parts[0].match(/^RE (BL|FU) (.+)$/);
  lines.push(`${kind === 'BL' ? 'Baseline' : 'Follow up'} checkup, ${when} UTC.`);
  for (const p of parts.slice(1)) {
    let m = p.match(/^URGENT (.+)$/);
    if (m) { lines.push(`URGENT: ${m[1].split('+').map((c) => SYM_NAME[c] || c).join(' and ')} ticked. Contact the person now.`); continue; }
    m = p.match(/^(P|R)(-|\d+)(~?)(?: (ok|[+-]\d+))?(?:x(\d+))?$/);
    if (m) {
      const what = m[1] === 'P' ? 'Pulse' : 'Breathing', unit = m[1] === 'P' ? 'bpm' : 'per minute';
      if (m[2] === '-') { lines.push(`${what}: no result.`); continue; }
      const vs = m[4] === 'ok' ? 'inside the person\'s own band' : m[4] ? `${m[4]} against the original baseline, beyond the band` : 'no baseline comparison';
      lines.push(`${what} ${m[2]} ${unit}${m[3] ? ' (low or medium quality capture)' : ''}: ${vs}${m[5] ? `, outside the band ${m[5]} checks in a row` : ''}.`);
      continue;
    }
    m = p.match(/^SYM (.+)$/);
    if (m) { lines.push(`Symptoms ticked: ${m[1].split(',').map((c) => SYM_NAME[c] || c).join(', ')}.`); continue; }
    m = p.match(/^SLP (le3|4-5|6-7|8\+)$/);
    if (m) { lines.push(`Sleep last night (self report): ${sleepBucket(m[1]).label}.`); continue; }
    m = p.match(/^RT(\d+)(?:x(\d+))?$/);
    if (m) { lines.push(`Reaction test median ${m[1]} ms${m[2] ? `, outside the band ${m[2]} tests in a row` : ''}.`); continue; }
    m = p.match(/^DENT (.+)$/);
    if (m) { lines.push(`Dental colour change against baseline: ${m[1].split(',').map((x) => x.replace(/^gum/, 'gums a* ').replace(/^teeth/, 'teeth b* ')).join(', ')}.`); continue; }
    m = p.match(/^(GUM|JAW)x(\d+)$/);
    if (m) { lines.push(`${m[1] === 'GUM' ? 'Gum redness' : 'Jaw opening'}: outside the band ${m[2]} checks in a row.`); continue; }
    m = p.match(/^EYE R(\d+)L(\d+)$/);
    if (m) { lines.push(`Eye grid: new marked squares, right ${m[1]}, left ${m[2]}.`); continue; }
    m = p.match(/^ACU worse (R?L?)$/);
    if (m) { lines.push(`Eye chart: 2 or more lines worse in the ${m[1].split('').map((x) => (x === 'R' ? 'right' : 'left')).join(' and ')} eye.`); continue; }
    m = p.match(/^EXP (.+)$/);
    if (m) { lines.push(`Experimental checks that differ from the person's first: ${m[1].toLowerCase().split(',').join(', ')}.`); continue; }
    if (p === 'NOTE') { lines.push('The person wrote a note: ask for the full packet.'); continue; }
    lines.push(`Not recognised: ${p}`);
  }
  if (more) lines.push('More did not fit in 160 characters: ask for the full packet.');
  return { ok: true, lines };
}

// Fingerprint: SHA-256 of the packet (without its own integrity field), first 16 hex digits.
// The reviewer's copy recomputes it, so a file damaged or edited on the way shows up as "changed".
// Anyone can recompute it, so it is a check against accidents, not a security signature.
export async function fingerprint(p) {
  const { integrity, ...rest } = p || {};
  const bytes = new TextEncoder().encode(JSON.stringify(rest));
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  const hex = [...hash].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16).toUpperCase();
  return hex.match(/.{4}/g).join('-');
}
export async function sealPacket(built) {
  try {
    const fp = await fingerprint(built.packet);
    built.packet.integrity = { fingerprint: fp, method: 'SHA-256 of the packet without this field, first 16 hex digits', note: 'Shows accidental damage or edits on the way; not a security signature.' };
    built.json = JSON.stringify(built.packet, null, 2);
    built.bytes = new Blob([built.json]).size;
  } catch { /* no Web Crypto (very old browser or insecure page): the packet goes without a fingerprint */ }
  return built;
}
export async function checkIntegrity(p) {
  const want = p?.integrity?.fingerprint;
  if (!want) return { state: 'none' };
  try {
    const got = await fingerprint(p);
    return { state: got === want ? 'intact' : 'changed', fingerprint: want, computed: got };
  } catch { return { state: 'unchecked', fingerprint: want }; }
}
