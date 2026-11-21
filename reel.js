// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Demo reel: a 30 second, captioned walk through the app on the invented sample data, made to be
// screen recorded for the Space Apps demo video (30 seconds, English subtitles).
// Scene lengths are in seconds and must add up to 30. Captions stay short enough to read in the time shown.

export const REEL = [
  { id: 'title', sec: 4, caption: 'RelaisÉcho Link: in orbit or the far North, the nearest clinic is far away.' },
  { id: 'setup', sec: 4, caption: 'A phone camera guides a checkup: pulse, breathing and mouth photos.' },
  { id: 'overview', sec: 5, caption: 'Every result is compared with your own baseline, not a population average.' },
  { id: 'space', sec: 5, caption: 'NASA crew data: IL-6 rose above each person\'s own pre-flight values, 4 of 4.' },
  { id: 'board', sec: 4, caption: 'Sleep, alertness and mission radiation sit on one mission board.' },
  { id: 'packet', sec: 5, caption: 'A nurse or flight surgeon gets a short packet, even by satellite text.' },
  { id: 'end', sec: 3, caption: 'Video stays on device. Built at NASA Space Apps 2026.' },
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
// withAudio: prefer formats that name an audio codec too, so the music goes into the file.
export function pickRecordingType(isSupported, withAudio = false) {
  const video = [['video/webm;codecs=vp9', 'webm'], ['video/webm;codecs=vp8', 'webm'], ['video/webm', 'webm'], ['video/mp4', 'mp4']];
  const audio = [['video/webm;codecs=vp9,opus', 'webm'], ['video/webm;codecs=vp8,opus', 'webm'], ['video/mp4;codecs=avc1,mp4a', 'mp4']];
  const types = withAudio ? [...audio, ...video] : video;
  const hit = types.find(([t]) => { try { return isSupported(t); } catch { return false; } });
  return hit ? { mimeType: hit[0], ext: hit[1] } : null;
}

// Background music for the reel. AI-generated: synthesized by code written with Claude (scripts/make_music.py),
// no samples. The label is shown on screen while it plays and is written into the file's metadata.
export const REEL_MUSIC = {
  src: 'audio/relaisecho-theme-ai-generated.mp3',
  volume: 0.8,
  label: 'Music: AI-generated',
};
