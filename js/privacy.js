// "Your data": a plain inventory of what this device holds and what the app can send or fetch.
// Pure functions; the screen itself is drawn in main.js. Keep NETWORK and EXPORTS true to the code:
// tests/repo.test.mjs fails if a new outside address appears in the app without being listed here.

export const NETWORK = [
  { host: 'this site', what: 'The app\'s own files', when: 'On the first visit and when a new version is published. After that it works offline.' },
  { host: 'storage.googleapis.com', what: 'The face tracking model (a file of numbers, about 4 MB)', when: 'Once, the first time a camera check starts. Nothing about you is sent with the request.' },
  { host: 'api.nasa.gov', what: 'Solar flare and particle event lists (NASA DONKI)', when: 'Only when you press the button on the Space weather tile. The request carries two dates and an API key.' },
];

export const EXPORTS = [
  'A review packet: text, file, QR code or print. You choose whether photos go in it.',
  'A reply file that a reviewer sends back to you.',
  'A backup of all checkups (.json), and results or bench test tables (.csv).',
  'A calendar reminder (.ics), a device report, a demo video you record yourself.',
];

export const NEVER = ['No account, no sign in.', 'No analytics, no advertising, no cookies.', 'No server: video frames are analysed in this browser and then discarded.'];

export const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} kB` : `${Math.round(n || 0)} bytes`);

// What is in the records: counts only. sessions are raw records from every profile on the device.
export function inventory(sessions, profileId) {
  const all = sessions || [];
  const mine = all.filter((s) => (s.profileId || 'default') === profileId);
  const count = (list) => {
    const checkups = list.filter((s) => s.kind === 'baseline' || s.kind === 'followup');
    let photos = 0, photoBytes = 0;
    for (const s of checkups) for (const d of Object.values(s.dental || {})) if (d && d.image) { photos += 1; photoBytes += Math.round(d.image.length * 0.75); }
    return {
      checkups: checkups.length,
      reactionTests: list.filter((s) => s.kind === 'alertness').length,
      eyeChecks: list.filter((s) => s.kind === 'vision').length,
      expChecks: list.filter((s) => s.kind === 'exp').length,
      expPhotos: list.filter((s) => s.kind === 'exp' && s.exp?.images).reduce((n, s) => n + Object.values(s.exp.images).filter(Boolean).length, 0),
      photos, photoBytes,
      faceTemplates: checkups.filter((s) => s.template).length,
      notes: checkups.filter((s) => (s.context?.symptoms || '').trim() || s.context?.checklist?.length).length,
      sample: list.filter((s) => s.demo).length,
    };
  };
  return { mine: count(mine), device: count(all), people: new Set(all.map((s) => s.profileId || 'default')).size };
}

export function inventoryLines(c) {
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  return [
    n(c.checkups, 'checkup', 'checkups') + ' (pulse and breathing estimates, capture quality, your answers)',
    n(c.faceTemplates, 'face position template', 'face position templates') + ' (numbers for where your face sat in the frame, used to line up later checkups; not a picture)',
    n(c.photos, 'dental photo', 'dental photos') + (c.photos ? `, about ${fmtBytes(c.photoBytes)}` : '') + ' (kept only if you took them)',
    n(c.notes, 'checkup with symptom ticks or notes', 'checkups with symptom ticks or notes'),
    n(c.reactionTests, 'reaction test', 'reaction tests'),
    n(c.eyeChecks, 'eye grid check', 'eye grid checks'),
    n(c.expChecks || 0, 'experimental check', 'experimental checks') + (c.expPhotos ? ` with ${c.expPhotos} small neck or eyelid photo${c.expPhotos === 1 ? '' : 's'}` : ''),
  ];
}
