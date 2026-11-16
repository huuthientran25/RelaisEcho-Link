// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Device check: can this browser, camera and connection run a checkup? Run before demo day,
// or when a scan refuses to start. Pure functions here; the camera work is in main.js.
// The report holds technical lines only: no names, no measurements, no pictures.

// Frame rate from frame timestamps in milliseconds. Uses the whole span, so a few late frames do not skew it.
export function fpsFromTimes(times) {
  const t = (times || []).filter((x) => Number.isFinite(x));
  if (t.length < 2) return { fps: 0, frames: t.length, seconds: 0 };
  const seconds = (t[t.length - 1] - t[0]) / 1000;
  return { fps: seconds > 0 ? +(((t.length - 1) / seconds)).toFixed(1) : 0, frames: t.length, seconds: +seconds.toFixed(2) };
}

export const median = (arr) => {
  const a = (arr || []).filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// env: plain booleans gathered in the browser. need: 'camera' (live checkup), 'core' (app cannot work), 'nice' (optional).
export function featureList(env) {
  const f = (id, ok, need, label, ifMissing) => ({ id, ok: !!ok, need, label, ifMissing });
  return [
    f('secure', env.secure, 'camera', 'Secure page (https or localhost)', 'Browsers only open the camera on https pages or localhost. Open the GitHub Pages link, not a file on disk.'),
    f('camera', env.getUserMedia, 'camera', 'Camera access available', 'This browser cannot open a camera here. Use "Video file" in the checkup setup instead.'),
    f('wasm', env.wasm, 'core', 'WebAssembly (runs the face model)', 'The face model cannot run. Use a current Chrome, Edge, Brave, Firefox or Safari.'),
    f('idb', env.indexedDb, 'core', 'Storage for history (IndexedDB)', 'Checkups cannot be saved. Leave private browsing mode.'),
    f('webgl', env.webgl2, 'nice', 'Graphics acceleration (WebGL 2)', 'Face tracking falls back to the processor and may be slower.'),
    f('rvfc', env.rvfc, 'nice', 'Exact camera frame times', 'Frame times come from the screen refresh instead. Slightly less exact.'),
    f('sw', env.serviceWorker, 'nice', 'Offline use (service worker)', 'The app needs a connection each time it is opened.'),
    f('gzip', env.compression, 'nice', 'Compressed packets', 'Packets are saved uncompressed, which is fine.'),
    f('speech', env.speech, 'nice', 'Spoken coaching', 'Instructions are shown on screen only.'),
  ];
}

// r.camera: { width, height, reportedFps, fps, luma } ; r.model: { ok, seconds, source, delegate, error } ;
// r.track: { medianMs, fps, facePct } ; any of them may be missing when that part was not run.
export function verdicts(r, cfg) {
  const out = [];
  const add = (level, text) => out.push({ level, text });
  const q = cfg.quality;
  for (const f of featureList(r.env || {})) {
    if (!f.ok && f.need !== 'nice') add(f.need === 'core' ? 'fail' : 'warn', `${f.label}: missing. ${f.ifMissing}`);
  }
  if (r.cameraError) add('fail', `Camera: ${r.cameraError}`);
  if (r.camera) {
    const c = r.camera;
    if (c.fps < q.minFps) add('fail', `The camera delivered ${c.fps} frames a second; a scan needs at least ${q.minFps}. Add light (cameras slow down in the dark) and close other apps that use the camera.`);
    else if (c.fps < q.softFps) add('warn', `The camera delivered ${c.fps} frames a second. A scan works from ${q.minFps}, but ${q.softFps} or more gives a steadier pulse. More light usually raises it.`);
    else add('ok', `Camera frame rate ${c.fps} a second: enough.`);
    if (c.luma != null) {
      if (c.luma < q.minLuma) add('warn', `The picture is dark (brightness ${Math.round(c.luma)} of 255; the scan wants a face at ${q.minLuma} or more). Face a window or a lamp.`);
      else if (c.luma > q.maxLuma) add('warn', `The picture is very bright (brightness ${Math.round(c.luma)} of 255). Turn away from direct light.`);
      else add('ok', `Brightness ${Math.round(c.luma)} of 255: fine.`);
    }
  }
  if (r.model) {
    if (!r.model.ok) add('fail', `Face model: ${r.model.error || 'could not be loaded'}`);
    else add('ok', `Face model loaded in ${r.model.seconds} s (${r.model.delegate || 'engine unknown'}).`);
  }
  if (r.track) {
    const t = r.track;
    if (t.fps < q.minFps) add('fail', `Face tracking managed ${t.fps} frames a second (${Math.round(t.medianMs)} ms a frame); a scan needs at least ${q.minFps}. Close other tabs and apps, or use a faster device.`);
    else if (t.fps < q.softFps) add('warn', `Face tracking managed ${t.fps} frames a second (${Math.round(t.medianMs)} ms a frame). Usable, with a low frame rate warning during the scan.`);
    else add('ok', `Face tracking ${t.fps} frames a second (${Math.round(t.medianMs)} ms a frame): enough.`);
    if (t.facePct < 50) add('warn', `A face was found in ${Math.round(t.facePct)}% of frames. Sit facing the camera with your whole face in view; if you were not in front of it, ignore this line.`);
  }
  return out;
}

export const overall = (list) => (list.some((v) => v.level === 'fail') ? 'fail' : list.some((v) => v.level === 'warn') ? 'warn' : 'ok');

export function reportText(r, list, meta = {}) {
  const yn = (b) => (b ? 'yes' : 'no');
  const lines = [
    `RelaisÉcho Link device report (${meta.version || 'version unknown'})`,
    `When: ${meta.when || ''}`,
    `Browser: ${meta.userAgent || 'unknown'}`,
    `Screen: ${meta.screen || 'unknown'} · processors: ${meta.cores ?? 'unknown'} · memory: ${meta.memoryGb ? `about ${meta.memoryGb} GB` : 'not reported'}`,
    `Online: ${yn(meta.online)} · offline cache: ${meta.cache || 'none'} · face model cached: ${meta.modelCached == null ? 'unknown' : yn(meta.modelCached)}`,
    `Free storage: ${meta.storage || 'not reported'}`,
    '',
    ...featureList(r.env || {}).map((f) => `[${f.ok ? 'ok' : f.need === 'nice' ? 'optional, missing' : 'MISSING'}] ${f.label}`),
  ];
  if (r.cameraError) lines.push('', `Camera: ${r.cameraError}`);
  if (r.camera) lines.push('', `Camera: ${r.camera.width}x${r.camera.height}, reports ${r.camera.reportedFps ?? '?'} fps, measured ${r.camera.fps} fps over ${r.camera.seconds} s, brightness ${r.camera.luma == null ? '?' : Math.round(r.camera.luma)} of 255`);
  if (r.model) lines.push(r.model.ok ? `Face model: loaded in ${r.model.seconds} s, ${r.model.source || 'source unknown'}, engine ${r.model.delegate || 'unknown'}` : `Face model: FAILED (${r.model.error || 'no detail'})`);
  if (r.track) lines.push(`Face tracking: median ${Math.round(r.track.medianMs)} ms a frame, ${r.track.fps} frames a second, face found in ${Math.round(r.track.facePct)}% of frames`);
  if (!r.camera && !r.cameraError) lines.push('', 'Camera test: not run');
  lines.push('', 'Verdict:', ...(list.length ? list.map((v) => ` ${v.level.toUpperCase()}: ${v.text}`) : [' Nothing checked yet.']));
  return lines.join('\n');
}
