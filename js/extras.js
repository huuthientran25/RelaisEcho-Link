// Small helpers: calendar reminder file, photo clean-up.

// iCalendar file with a repeating checkup reminder at the baseline's time of day.
// Works with any calendar app, offline, with no notification permission.
export function reminderIcs({ start, freq = 'DAILY', title = 'RelaisÉcho checkup', now = new Date() }) {
  const p = (n) => String(n).padStart(2, '0');
  const local = (d) => `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
  const utc = (d) => `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  const end = new Date(+start + 10 * 60000);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RelaisEcho Link//EN', 'BEGIN:VEVENT',
    `UID:relaisecho-${+start}@relaisecho.local`, `DTSTAMP:${utc(now)}`, `DTSTART:${local(start)}`, `DTEND:${local(end)}`,
    `RRULE:FREQ=${freq === 'WEEKLY' ? 'WEEKLY' : 'DAILY'}`, `SUMMARY:${title}`,
    'DESCRIPTION:Same time of day as your baseline makes pulse and breathing compare fairly.',
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

// Removes stored dental photos from checkups older than maxAgeDays. Results and comparisons stay.
export function stripOldPhotos(sessions, maxAgeDays, now = new Date()) {
  const cutoff = +now - maxAgeDays * 24 * 3600 * 1000;
  const changed = [];
  for (const s of sessions) {
    if (+new Date(s.createdAt) >= cutoff || !s.dental) continue;
    if (s.isOriginal) continue; // the original baseline keeps its photos: every comparison needs them
    let hit = false;
    const dental = {};
    for (const [k, d] of Object.entries(s.dental)) {
      if (d && d.image) { dental[k] = { ...d, image: null, imageRemoved: true }; hit = true; } else dental[k] = d;
    }
    if (hit) changed.push({ ...s, dental });
  }
  return changed;
}

// One row per checkup or reaction test, for a spreadsheet. No images, no names.
export function resultsCsv(sessions) {
  const head = ['date_utc', 'kind', 'pulse_bpm', 'pulse_quality', 'breaths_per_min', 'breathing_quality', 'breathing_channel',
    'blinks_per_min', 'eyes_closed_pct', 'reaction_median_ms', 'reaction_lapses', 'reaction_false_starts', 'reviewer_status', 'demo', 'symptoms_ticked', 'eye_grid_right_marked', 'eye_grid_left_marked', 'acuity_right_logmar', 'acuity_left_logmar', 'acuity_distance_m'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = sessions.map((s) => [s.createdAt, s.kind, s.pulse?.bpm, s.pulse?.quality, s.resp?.rpm, s.resp?.quality, s.resp?.channel,
    s.eyes?.blinksPerMin, s.eyes?.closedPct, s.alertness?.medianMs, s.alertness?.lapses, s.alertness?.falseStarts, s.reply?.status, s.demo ? 'yes' : '',
    (s.context?.checklist || []).join(' '), s.vision ? (s.vision.right || []).length : '', s.vision ? (s.vision.left || []).length : '', s.acuity?.right?.logmar, s.acuity?.left?.logmar, s.acuity ? s.acuity.distanceMm / 1000 : '']
    .map(q).join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}

// Camera choice: the options for the "Which camera" list, from navigator.mediaDevices.enumerateDevices().
// Labels are empty until the person has allowed the camera once, so unnamed ones get a number.
export function cameraOptions(devices, savedId) {
  const cams = (devices || []).filter((d) => d.kind === 'videoinput');
  const opts = cams.map((d, i) => ({ id: d.deviceId || '', label: d.label || `Camera ${i + 1}` })).filter((o) => o.id);
  const chosen = opts.some((o) => o.id === savedId) ? savedId : '';
  return { show: opts.length > 1, options: [{ id: '', label: 'Automatic (front or rear, as chosen above)' }, ...opts], chosen };
}

// Constraints for getUserMedia: an exact device when one was picked, otherwise the facing direction.
export function cameraConstraints(kind, deviceId, fps) {
  const base = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: fps } };
  return { video: deviceId ? { ...base, deviceId: { exact: deviceId } } : { ...base, facingMode: kind }, audio: false };
}
