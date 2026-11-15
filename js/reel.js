// Demo reel: a 30 second, captioned walk through the app on the invented sample data, made to be
// screen recorded for the Space Apps demo video (30 seconds, English subtitles).
// Scene lengths are in seconds and must add up to 30. Captions stay short enough to read in the time shown.

export const REEL = [
  { id: 'title', sec: 4, caption: 'RelaisÉcho Link: a guided camera checkup for people far from a clinic.' },
  { id: 'setup', sec: 4, caption: 'The camera estimates pulse and breathing. Video never leaves the device.' },
  { id: 'board', sec: 5, caption: 'Mission board: today\'s checklist, alertness, sleep pressure, daylight.' },
  { id: 'space', sec: 5, caption: 'NASA data in context: mission radiation, space weather, crew blood data.' },
  { id: 'history', sec: 4, caption: 'Each result is compared with your own baseline, not a population average.' },
  { id: 'packet', sec: 5, caption: 'A review packet goes to a nurse or flight surgeon by file or QR code.' },
  { id: 'end', sec: 3, caption: 'In orbit, and in remote northern communities. Space Apps 2026.' },
];

export const reelTotal = (reel = REEL) => reel.reduce((s, x) => s + x.sec, 0);

// Which scene is on screen t seconds after the start; null once the reel is over.
export function sceneAt(t, reel = REEL) {
  let start = 0;
  for (let i = 0; i < reel.length; i += 1) {
    if (t < start + reel[i].sec) return { index: i, scene: reel[i], start, into: t - start };
    start += reel[i].sec;
  }
  return null;
}

// The same captions as a SubRip (.srt) file, for video sites that take a separate subtitle track.
export function reelSrt(reel = REEL) {
  const stamp = (s) => `00:00:${String(Math.floor(s)).padStart(2, '0')},${String(Math.round((s % 1) * 1000)).padStart(3, '0')}`;
  let start = 0;
  return reel.map((x, i) => {
    const block = `${i + 1}\n${stamp(start)} --> ${stamp(start + x.sec - 0.05)}\n${x.caption}\n`;
    start += x.sec;
    return block;
  }).join('\n');
}

// First recording format this browser supports, with its file extension; null when it cannot record at all.
export function pickRecordingType(isSupported) {
  const types = [['video/webm;codecs=vp9', 'webm'], ['video/webm;codecs=vp8', 'webm'], ['video/webm', 'webm'], ['video/mp4', 'mp4']];
  const hit = types.find(([t]) => { try { return isSupported(t); } catch { return false; } });
  return hit ? { mimeType: hit[0], ext: hit[1] } : null;
}
