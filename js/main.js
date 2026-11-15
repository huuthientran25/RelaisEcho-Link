// RelaisÉcho Link app controller: screens, camera or file source, frame loop.
import { CONFIG } from './config.js';
import { getFaceLandmarker, getModelSource, detect } from './vision.js';
import { faceGeometry, keypointArray, motionSpeed, pulseRois, torsoRoi, neckRoi, LIPS_OUTER } from './geometry.js';
import { roiMeanRGB, rowProfile } from './frame.js';
import { makeTemplate, defaultTemplate, compareToTemplate } from './align.js';
import { estimatePulse, livePulse, estimateWindow } from './pulse.js';
import { TorsoTracker, estimateRespMulti } from './resp.js';
import { DentalCapture, VIEWS } from './dental.js';
import { saveSession, listSessions, baselineAndRecent, newId, clearAll, setOriginal } from './store.js';
import { buildPacket, packetText } from './packet.js';
import { EVIDENCE } from './evidence.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHANNEL_LABEL = { neck: 'neck band', chest: 'upper torso', head: 'head bob', pitch: 'head tilt' };
const fmtDate = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') : '');

const state = {
  session: null, stream: null, fileUrl: null, sourceKind: null, landmarker: null,
  loop: null, scan: null, dental: null, AW: 480, AH: 270, uiT: 0,
};
const acan = document.createElement('canvas');
const actx = acan.getContext('2d', { willReadFrequently: true });

/* ---------- navigation ---------- */
function show(name) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== `screen-${name}`; });
  window.scrollTo(0, 0);
  if (name === 'home') stopSource();
  if (name === 'history') renderHistory();
  if (name === 'setup') prepareSetup();
  const h = document.querySelector(`#screen-${name} h1`);
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}
document.addEventListener('click', async (e) => {
  const mk = e.target.closest('[data-make-original]');
  if (mk) {
    if (window.confirm('Make this checkup your original baseline? Earlier baselines stay in History, but new comparisons will use this one.')) {
      await setOriginal(mk.dataset.makeOriginal);
      renderHistory();
    }
    return;
  }
  const nav = e.target.closest('[data-nav]');
  if (nav) { e.preventDefault(); show(nav.dataset.nav); }
  const ev = e.target.closest('[data-evidence]');
  if (ev) openEvidence(ev.dataset.evidence);
});

function openEvidence(key) {
  const ev = EVIDENCE[key];
  if (!ev) return;
  $('evTitle').textContent = ev.title;
  $('evMethod').textContent = ev.method;
  $('evSource').textContent = ev.source;
  $('evLimits').textContent = ev.limits;
  $('evidenceDialog').showModal();
}

function updateNet() {
  const on = navigator.onLine;
  $('netStatus').textContent = on ? 'Online' : 'Offline: still works';
  $('netStatus').classList.toggle('off', !on);
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);
updateNet();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker not registered', e));
}

/* ---------- setup ---------- */
async function prepareSetup() {
  const { original } = await baselineAndRecent();
  const base = document.querySelector('input[name=kind][value=baseline]');
  const follow = document.querySelector('input[name=kind][value=followup]');
  if (!original) {
    base.checked = true; follow.disabled = true;
    $('kindNote').textContent = 'No baseline yet. This checkup becomes your original baseline.';
  } else {
    follow.disabled = false; follow.checked = true;
    $('kindNote').textContent = `Compared with your original baseline from ${fmtDate(original.createdAt)} and your recent checkups.`;
  }
}
document.querySelectorAll('input[name=source]').forEach((r) => r.addEventListener('change', () => {
  $('fileWrap').hidden = document.querySelector('input[name=source]:checked').value !== 'file';
}));

$('setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const src = f.get('source');
  const file = $('fileInput').files[0];
  if (src === 'file' && !file) { $('fileInput').setCustomValidity('Choose a video file first.'); $('fileInput').reportValidity(); return; }
  $('fileInput').setCustomValidity('');
  state.session = {
    id: newId(), createdAt: new Date().toISOString(), kind: f.get('kind') || 'baseline',
    source: src === 'file' ? 'file' : 'camera', facing: src === 'file' ? null : src,
    context: { activity: f.get('activity'), glasses: f.get('glasses'), symptoms: $('symptoms').value.trim() },
    complete: false, dental: {},
  };
  await startScan(src, file);
});

/* ---------- source handling ---------- */
function stopLoop() { state.loop = null; }

function stopSource() {
  stopLoop();
  const v = $('video');
  if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
  if (state.fileUrl) { URL.revokeObjectURL(state.fileUrl); state.fileUrl = null; }
  v.pause(); v.removeAttribute('src'); v.srcObject = null; v.onended = null;
}

function waitForDims(v) {
  return new Promise((res) => {
    if (v.videoWidth) return res();
    v.addEventListener('loadedmetadata', () => res(), { once: true });
  });
}

async function startSource(kind, file) {
  stopSource();
  const v = $('video');
  v.muted = true; v.playsInline = true;
  if (kind === 'file') {
    state.fileUrl = URL.createObjectURL(file);
    v.src = state.fileUrl; v.loop = false;
    state.session && (state.session.cameraLabel = `file: ${file.name}`);
  } else {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: kind, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } }, audio: false,
    });
    state.stream = stream;
    v.srcObject = stream;
    if (state.session) state.session.cameraLabel = stream.getVideoTracks()[0]?.label || kind;
  }
  state.sourceKind = kind;
  await waitForDims(v);
  await v.play();
  const vw = v.videoWidth, vh = v.videoHeight;
  state.AW = Math.min(480, vw);
  state.AH = Math.round((state.AW * vh) / vw);
  acan.width = state.AW; acan.height = state.AH;
  const ov = $('overlay');
  ov.width = state.AW; ov.height = state.AH;
  const stage = $('stage');
  stage.style.aspectRatio = `${vw} / ${vh}`;
  stage.style.width = `min(100%, calc(68vh * ${vw / vh}))`;
  stage.classList.toggle('mirror', kind === 'user');
}

function moveStage(slotId) { $(slotId).appendChild($('stage')); }

function startLoop(handler) {
  const v = $('video');
  const token = {};
  state.loop = token;
  const rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  const step = (now, meta) => {
    if (state.loop !== token) return;
    const t = meta && Number.isFinite(meta.mediaTime) ? meta.mediaTime * 1000 : performance.now();
    try { handler(t, meta); } catch (err) { console.error(err); }
    schedule();
  };
  const schedule = () => {
    if (state.loop !== token) return;
    if (rvfc) v.requestVideoFrameCallback(step); else requestAnimationFrame((n) => step(n, null));
  };
  schedule();
}

async function ensureModel(coachEl) {
  if (state.landmarker) return state.landmarker;
  coachEl.textContent = 'Loading the face model…';
  state.landmarker = await getFaceLandmarker();
  $('modelNote').textContent = `Face landmarks: MediaPipe Face Landmarker, ${getModelSource()}.`;
  return state.landmarker;
}

function sourceError(err, coachEl) {
  console.error(err);
  const name = err && err.name;
  coachEl.textContent = name === 'NotAllowedError'
    ? 'Camera permission was denied. Allow the camera in your browser settings, or choose "Video file" in setup.'
    : name === 'NotFoundError' ? 'No camera found. Choose "Video file" in setup.'
      : `Could not start: ${err.message || err}`;
}

/* ---------- resting scan ---------- */
async function startScan(src, file) {
  show('scan');
  moveStage('scanStageSlot');
  $('coach').textContent = 'Starting…';
  try {
    await ensureModel($('coach'));
    await startSource(src, file);
  } catch (err) { sourceError(err, $('coach')); return; }
  const aspect = state.AW / state.AH;
  let template = defaultTemplate(aspect);
  const { original } = await baselineAndRecent(state.session.id);
  if (state.session.kind !== 'baseline' && original?.template) {
    if (Math.abs(original.template.aspect - aspect) < 0.05) template = original.template;
    else state.session.notComparable = 'Camera shape differs from the baseline (portrait vs landscape); default framing used.';
  }
  state.scan = { t0: null, lastT: null, usable: 0, elapsed: 0, pulse: [], resp: { neck: [], chest: [], head: [], pitch: [] },
    trackers: { neck: new TorsoTracker(), chest: new TorsoTracker() },
    prevKp: null, speed: null, rejects: {}, alignWorst: {}, wasAligned: false, wasStill: false,
    template, tplCandidate: null, fpsT: [], liveT: 0, finished: false,
    frames: 0, skipped: 0, lastPresented: null, inferMs: null, fpsSum: 0, fpsN: 0 };
  $('video').onended = () => finishScan();
  startLoop(scanFrame);
}

function scanFrame(t, meta) {
  const s = state.scan;
  if (!s || s.finished) return;
  const tw0 = performance.now();
  const v = $('video');
  const { AW, AH } = state;
  if (s.t0 === null) s.t0 = t;
  const dt = s.lastT === null ? 0 : Math.max(0, Math.min(0.25, (t - s.lastT) / 1000));
  s.lastT = t;
  s.elapsed = (t - s.t0) / 1000;
  s.fpsT.push(t);
  while (s.fpsT.length && t - s.fpsT[0] > 2000) s.fpsT.shift();
  const fps = s.fpsT.length / 2;
  if (s.elapsed > 2) { s.fpsSum += fps; s.fpsN += 1; }
  // Frames the browser presented that we did not get to: shows whether tracking keeps up with the camera.
  if (meta && Number.isFinite(meta.presentedFrames)) {
    if (s.lastPresented !== null) s.skipped += Math.max(0, meta.presentedFrames - s.lastPresented - 1);
    s.lastPresented = meta.presentedFrames;
  }
  s.frames += 1;

  actx.drawImage(v, 0, 0, AW, AH);
  const img = actx.getImageData(0, 0, AW, AH);
  const lm = detect(state.landmarker, v);
  const q = CONFIG.quality;
  const checks = [];
  let g = null, rois = null, torso = null, neck = null, rgb = null, al = null, ok = false;
  if (!lm) {
    checks.push({ key: 'face', label: 'Face not found', ok: false });
    s.prevKp = null; s.wasAligned = false; s.wasStill = false;
  } else {
    g = faceGeometry(lm, AW, AH);
    rois = pulseRois(lm, g);
    rgb = roiMeanRGB(img, rois);
    const kp = keypointArray(lm);
    const sp = motionSpeed(s.prevKp, kp, g.faceWidth / AW, dt);
    s.prevKp = kp;
    s.speed = s.speed == null ? sp : 0.7 * s.speed + 0.3 * sp;
    const sizeOk = g.faceWidth / AW >= q.minFaceWidthFrac;
    const lightOk = rgb.meanLuma >= q.minLuma && rgb.meanLuma <= q.maxLuma && rgb.clippedFrac <= q.maxClippedFrac;
    // Hysteresis: once a check passes it stays passed a little longer, so tiny wobble at the edge
    // of a tolerance does not reset the timer every frame.
    const stillOk = s.speed <= q.maxMotionPerSec * (s.wasStill ? q.motionHoldSlack : 1);
    s.wasStill = stillOk;
    al = compareToTemplate(g, s.template, s.wasAligned ? CONFIG.align.holdSlack : 1);
    s.wasAligned = al.ok;
    if (!al.ok) s.alignWorst[al.worst] = (s.alignWorst[al.worst] || 0) + dt;
    checks.push({ key: 'light', label: lightOk ? 'Light' : rgb.meanLuma < q.minLuma ? 'Too dark' : 'Too bright', ok: lightOk });
    checks.push({ key: 'still', label: stillOk ? 'Still' : 'Moving', ok: stillOk });
    checks.push({ key: 'size', label: sizeOk ? 'Distance' : 'Too far', ok: sizeOk });
    checks.push({ key: 'aligned', label: al.ok ? 'Aligned' : 'Not aligned', ok: al.ok });
    if (s.elapsed > 2 && fps < q.minFps) checks.push({ key: 'fps', label: `Low frame rate (${fps.toFixed(0)} fps)`, ok: false });
    ok = checks.every((c) => c.ok);
    torso = torsoRoi(g);
    neck = neckRoi(g);
  }
  for (const c of checks) if (!c.ok) s.rejects[c.key] = (s.rejects[c.key] || 0) + dt;
  if (ok) { s.usable += dt; s.tplCandidate = makeTemplate(lm, g); }
  if (rgb && rgb.n > 40) s.pulse.push({ t, r: rgb.r, g: rgb.g, b: rgb.b, ok });
  // Breathing channels. Head channels need only a face. Neck and torso channels need their box in frame.
  let breathCh = false;
  if (g) {
    s.resp.head.push({ t, y: (g.center.y / AH) * 1000, ok });
    s.resp.pitch.push({ t, y: g.pitchIndex * 1000, ok });
  }
  if (neck && neck.visibleFrac >= 0.8) {
    const prof = rowProfile(img, neck);
    if (prof) { s.resp.neck.push({ t, y: s.trackers.neck.push(prof), ok }); breathCh = true; }
  }
  if (torso && torso.visibleFrac >= 0.75) {
    const prof = rowProfile(img, torso);
    if (prof) { s.resp.chest.push({ t, y: s.trackers.chest.push(prof), ok }); breathCh = true; }
  }
  if (g && !breathCh) checks.push({ key: 'torso', label: 'Neck and shoulders out of view', ok: false, soft: true });

  drawScanOverlay(g, rois, torso, neck, al);
  if (t - state.uiT > 150 || t < state.uiT) {
    state.uiT = t;
    $('chips').innerHTML = checks.map((c) => `<span class="chip ${c.ok ? '' : 'bad'}">${c.ok ? '✓' : '!'} ${esc(c.label)}</span>`).join('');
    $('coach').textContent = coachMessage(lm, checks, al);
    const target = CONFIG.scan.targetUsableSeconds;
    $('usableBar').style.width = `${Math.min(100, (s.usable / target) * 100)}%`;
    $('usableText').textContent = `${Math.floor(s.usable)} of ${target} usable seconds`;
    const skipPct = s.frames + s.skipped ? Math.round((100 * s.skipped) / (s.frames + s.skipped)) : 0;
    $('fpsText').textContent = `Camera ${fps.toFixed(0)} fps · tracking ${Math.round(s.inferMs || 0)} ms per frame${skipPct ? ` · skipped ${skipPct}%` : ''}`;
  }
  if (t - s.liveT > 1000) {
    s.liveT = t;
    const lp = livePulse(s.pulse);
    $('livePulse').textContent = lp ? `Live preview: ${Math.round(lp.bpm)} bpm${lp.weak ? ' (weak signal)' : ''}` : '';
  }
  const spent = performance.now() - tw0;
  s.inferMs = s.inferMs == null ? spent : 0.9 * s.inferMs + 0.1 * spent;
  if (s.usable >= CONFIG.scan.targetUsableSeconds || s.elapsed >= CONFIG.scan.maxElapsedSeconds) finishScan();
}

function coachMessage(lm, checks, al) {
  if (!lm) return 'Bring your face into the outline';
  const bad = (k) => checks.find((c) => c.key === k && !c.ok);
  if (bad('size')) return 'Come a little closer';
  if (bad('light')) return bad('light').label === 'Too dark' ? 'Too dark: turn on a light facing you' : 'Too bright: move out of direct light';
  if (bad('aligned')) return al.message;
  if (bad('still')) return 'Hold still';
  if (bad('fps')) return 'Camera is running slowly; close other apps';
  return 'Hold still and breathe normally';
}

function drawScanOverlay(g, rois, torso, neck, al) {
  const c = $('overlay');
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  const tpl = state.scan.template;
  ctx.lineWidth = Math.max(2, W / 200);
  ctx.setLineDash([W / 50, W / 70]);
  ctx.strokeStyle = al && al.ok ? '#7CF0A8' : '#FFD166';
  ctx.beginPath();
  if (tpl.oval) {
    tpl.oval.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
    ctx.closePath();
  } else {
    const rx = (tpl.faceWidth * W) / 2;
    ctx.ellipse(tpl.center.x * W, tpl.center.y * H, rx, rx * 1.3, 0, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  if ($('showBoxes').checked && g) {
    ctx.lineWidth = Math.max(1.5, W / 300);
    ctx.strokeStyle = '#F2B36B';
    rois.forEach((b) => ctx.strokeRect(b.x, b.y, b.w, b.h));
    ctx.strokeStyle = '#9CC3F5';
    if (neck && neck.h > 0 && neck.visibleFrac >= 0.8) ctx.strokeRect(neck.x, neck.y, neck.w, neck.h);
    if (torso && torso.h > 0 && torso.visibleFrac >= 0.75) ctx.strokeRect(torso.x, torso.y, torso.w, torso.h);
  }
}

$('btnStopScan').addEventListener('click', () => finishScan());

async function finishScan() {
  const s = state.scan;
  if (!s || s.finished) return;
  s.finished = true;
  stopLoop();
  const sess = state.session;
  sess.pulse = estimatePulse(s.pulse);
  sess.resp = estimateRespMulti(s.resp);
  sess.usableSeconds = s.usable;
  sess.elapsedSeconds = s.elapsed;
  sess.rejectCounts = Object.fromEntries(Object.entries(s.rejects).map(([k, v]) => [k, Math.round(v)]));
  // Which alignment axis kept failing, and how the loop kept up with the camera (for tuning).
  sess.alignRejects = Object.fromEntries(Object.entries(s.alignWorst).map(([k, v]) => [k, Math.round(v)]));
  sess.cameraFps = s.fpsN ? Math.round(s.fpsSum / s.fpsN) : null;
  sess.trackerMs = Math.round(s.inferMs || 0);
  sess.skippedFramesPct = s.frames + s.skipped ? Math.round((100 * s.skipped) / (s.frames + s.skipped)) : 0;
  if (sess.kind === 'baseline' && s.tplCandidate) sess.template = s.tplCandidate;
  // A baseline needs a recorded face position (for the ghost); measurements can be retaken later.
  sess.complete = sess.kind !== 'baseline' || !!sess.template;
  await saveSession(sess);
  await renderResults();
  show('results');
}

/* ---------- results ---------- */
function resultCard(title, value, unit, r, evKey) {
  const live = state.session.source === 'file' ? 'RECORDED VIDEO' : 'LIVE';
  const q = r?.quality || 'none';
  const big = value != null ? `<span class="big">${value}</span> <span class="unit">${unit}</span>` : '<span class="big">No result</span>';
  return `<h2>${title}</h2><p>${big}</p>
    <p><span class="tag live">${live}</span><span class="tag">EXPERIMENTAL</span></p>
    <p class="q-${q}">Quality: ${q}${r?.total != null ? ` · ${r.accepted} of ${r.total} windows accepted` : ''}${r?.seconds ? ` · ${Math.round(r.seconds)} usable s` : ''}</p>
    ${r?.channel ? `<p class="fine">Measured from: ${esc(CHANNEL_LABEL[r.channel] || r.channel)}${r.agreeing ? ` · ${r.agreeing} other channel${r.agreeing > 1 ? 's' : ''} agree` : ''}</p>` : ''}
    ${r?.channels?.length ? `<p class="fine">${r.channels.map((c) => `${esc(CHANNEL_LABEL[c.name] || c.name)}: ${c.rpm ?? 'none'}`).join(' · ')}</p>` : ''}
    ${r?.reason ? `<p class="fine">${esc(r.reason)}</p>` : ''}
    <button type="button" class="link-btn" data-evidence="${evKey}">Why this number? Evidence</button>`;
}

async function renderResults() {
  const sess = state.session, s = state.scan;
  $('pulseCard').innerHTML = resultCard('Pulse estimate', sess.pulse.bpm, 'bpm', sess.pulse, 'pulse');
  $('respCard').innerHTML = resultCard('Breathing estimate', sess.resp.rpm, '/min', sess.resp, 'resp');
  drawWave(s.pulse);
  const { original, recent } = await baselineAndRecent(sess.id);
  let html = '';
  if (sess.notComparable) html += `<p class="fine">${esc(sess.notComparable)}</p>`;
  if (!original) {
    html += sess.kind === 'baseline'
      ? `<p class="fine">${sess.complete
        ? `Saved as your original baseline. Later checkups are compared with it.${sess.pulse.bpm == null && sess.resp.rpm == null ? ' No pulse or breathing result this time; retake to add them.' : ''}`
        : 'Baseline not saved: no frame passed every check, so your position could not be recorded. Retake the scan.'}</p>`
      : '';
  } else {
    const range = (key, f) => {
      const vals = recent.map((r) => f(r)).filter((x) => x != null);
      return vals.length ? `${Math.min(...vals)} to ${Math.max(...vals)}` : '-';
    };
    html += `<table><caption class="fine" style="text-align:left">Compared with your own earlier checkups</caption>
      <thead><tr><th scope="col"></th><th scope="col">Today</th><th scope="col">Original baseline<br><span class="fine">${fmtDate(original.createdAt)}</span></th><th scope="col">Last ${recent.length || 0}</th></tr></thead>
      <tbody><tr><th scope="row">Pulse, bpm</th><td>${sess.pulse.bpm ?? '-'}</td><td>${original.pulse?.bpm ?? '-'}</td><td>${range('p', (r) => r.pulse?.bpm)}</td></tr>
      <tr><th scope="row">Breathing, /min</th><td>${sess.resp.rpm ?? '-'}</td><td>${original.resp?.rpm ?? '-'}</td><td>${range('r', (r) => r.resp?.rpm)}</td></tr></tbody></table>
      <p class="fine">The original baseline is kept on purpose, so slow drift never becomes the new normal. No value here is a diagnosis.</p>`;
  }
  $('cmpTable').innerHTML = html;
  ['refPulse', 'refResp', 'refDevice', 'refNotes'].forEach((id) => { $(id).value = ''; });
}

function drawWave(samples) {
  const c = $('waveCanvas');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const ok = samples.filter((x) => x.ok);
  if (ok.length < 120) return;
  const tEnd = ok[ok.length - 1].t;
  const win = ok.filter((x) => x.t >= tEnd - 10000);
  if (win.length < 80) return;
  const { signal } = estimateWindow(win);
  let max = 0;
  for (const v of signal) max = Math.max(max, Math.abs(v));
  ctx.strokeStyle = '#F2B36B'; ctx.lineWidth = 2; ctx.beginPath();
  signal.forEach((v, i) => {
    const x = (i / (signal.length - 1)) * c.width, y = c.height / 2 - (v / (max || 1)) * (c.height * 0.42);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}

function saveReference() {
  const n = (id) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : null; };
  state.session.reference = { pulseBpm: n('refPulse'), breathsPerMin: n('refResp'), device: $('refDevice').value.trim(), conditions: $('refNotes').value.trim() };
  saveSession(state.session);
}
['refPulse', 'refResp', 'refDevice', 'refNotes'].forEach((id) => $(id).addEventListener('change', saveReference));

$('btnRetake').addEventListener('click', () => {
  const old = state.session;
  state.session = { ...old, id: newId(), createdAt: new Date().toISOString(), pulse: null, resp: null, template: undefined, dental: {}, complete: false, reference: null };
  startScan(old.source === 'file' ? 'file' : old.facing, $('fileInput').files[0]);
});
$('btnSkipDental').addEventListener('click', async () => { stopSource(); await renderCompare(); show('compare'); });
$('btnToDental').addEventListener('click', () => startDental());

/* ---------- dental ---------- */
async function startDental(file) {
  show('dental');
  moveStage('dentalStageSlot');
  state.dental = new DentalCapture();
  renderViewSteps();
  const v = $('video');
  const needSource = state.session.source === 'file' ? !file && (v.ended || !v.src) : !state.stream;
  $('btnDentalFile').hidden = state.session.source !== 'file';
  if (state.session.source === 'file' && !file) {
    $('dentalCoach').textContent = 'Choose a recording of your smile: front, then turning to each side.';
    return;
  }
  try {
    if (file) await startSource('file', file);
    else if (needSource) await startSource(state.session.facing || 'user');
  } catch (err) { sourceError(err, $('dentalCoach')); return; }
  $('video').onended = () => finishDental();
  startLoop(dentalFrame);
}

const dentalFilePicker = document.createElement('input');
dentalFilePicker.type = 'file'; dentalFilePicker.accept = 'video/*';
dentalFilePicker.addEventListener('change', () => { if (dentalFilePicker.files[0]) startDental(dentalFilePicker.files[0]); });
$('btnDentalFile').addEventListener('click', () => dentalFilePicker.click());

function renderViewSteps() {
  const d = state.dental;
  $('viewSteps').innerHTML = VIEWS.map((vw, i) => {
    const cls = d.results[vw.id] ? 'done' : i === d.view ? 'active' : '';
    return `<li class="${cls}">${d.results[vw.id]?.captured ? '✓ ' : ''}${esc(vw.label)}</li>`;
  }).join('');
}

function dentalFrame() {
  const d = state.dental;
  if (!d || d.done) return;
  const v = $('video');
  const lm = detect(state.landmarker, v);
  const g = lm ? faceGeometry(lm, state.AW, state.AH) : null;
  const st = d.update(v, lm, g);
  $('dentalCoach').textContent = st.msg ? `${d.done ? '' : `${d.currentView.label}: `}${st.msg}` : '';
  if (!d.done) $('dentalCoach').title = d.currentView.hint;
  $('dentalBar').style.width = `${Math.round((st.progress || 0) * 100)}%`;
  drawMouthGuide(lm, st.ok);
  if (st.captured) renderViewSteps();
  if (st.done || d.done) finishDental();
}

function drawMouthGuide(lm, ok) {
  const c = $('overlay');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  if (!lm) return;
  ctx.setLineDash([c.width / 60, c.width / 90]);
  ctx.lineWidth = Math.max(2, c.width / 200);
  ctx.strokeStyle = ok ? '#7FE3D4' : '#F2B36B';
  ctx.beginPath();
  LIPS_OUTER.forEach((i, k) => {
    const x = lm[i].x * c.width, y = lm[i].y * c.height;
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
}

$('btnSkipView').addEventListener('click', () => {
  const d = state.dental;
  if (!d || d.done) return;
  d.skipView();
  renderViewSteps();
  if (d.done) finishDental();
});

async function finishDental() {
  const d = state.dental;
  if (!d || d.finished) return;
  d.finished = true;
  stopLoop();
  while (!d.done) d.skipView();
  state.session.dental = d.results;
  await saveSession(state.session);
  stopSource();
  await renderCompare();
  show('compare');
}

/* ---------- compare ---------- */
async function renderCompare() {
  const sess = state.session;
  const { original } = await baselineAndRecent(sess.id);
  const list = $('compareList');
  list.innerHTML = '';
  $('compareNote').textContent = original
    ? `Slide between your original baseline (${fmtDate(original.createdAt)}) and today. Tap a photo to mark an area for the reviewer.`
    : 'These photos become your reference. Tap a photo to mark an area you want a practitioner to look at.';
  for (const vw of VIEWS) {
    const today = sess.dental?.[vw.id];
    const base = original?.dental?.[vw.id];
    const box = document.createElement('div');
    box.className = 'card';
    if (!today?.captured) {
      box.innerHTML = `<h2>${esc(vw.label)}</h2><p class="fine">Not captured${today?.reason ? `: ${esc(today.reason)}` : ''}.</p>`;
      list.appendChild(box);
      continue;
    }
    const hasBase = !!base?.captured;
    box.innerHTML = `<h2>${esc(vw.label)}</h2>
      <div class="cmp" role="img" aria-label="${esc(vw.label)} photo${hasBase ? ', baseline and today' : ''}">
        ${hasBase ? `<img alt="" src="${base.image}">` : ''}
        <img alt="" class="today" src="${today.image}">
        ${hasBase ? '<div class="divider"></div><span class="lbl" style="left:8px">BASELINE</span><span class="lbl" style="right:8px">TODAY</span>' : '<span class="lbl" style="right:8px">TODAY</span>'}
      </div>
      ${hasBase ? `<label class="fine">Slide to compare<input type="range" min="0" max="100" value="50" class="slider" style="width:100%"></label>` : ''}
      <ol class="marks fine"></ol>`;
    list.appendChild(box);
    const cmp = box.querySelector('.cmp');
    const top = box.querySelector('img.today');
    const divider = box.querySelector('.divider');
    const setPos = (p) => { if (hasBase) { top.style.clipPath = `inset(0 0 0 ${p}%)`; divider.style.left = `${p}%`; } };
    setPos(50);
    box.querySelector('.slider')?.addEventListener('input', (e) => setPos(+e.target.value));
    const renderMarks = () => {
      cmp.querySelectorAll('.mark').forEach((m) => m.remove());
      today.marks = today.marks || [];
      today.marks.forEach((m, i) => {
        const el = document.createElement('div');
        el.className = 'mark';
        el.style.left = `${m.x * 100}%`; el.style.top = `${m.y * 100}%`;
        el.innerHTML = `<span>${i + 1}</span>`;
        cmp.appendChild(el);
      });
      box.querySelector('.marks').innerHTML = today.marks.map((m, i) => `<li>Mark ${i + 1}
        <input type="text" data-i="${i}" value="${esc(m.note)}" placeholder="Note for the reviewer" aria-label="Note for mark ${i + 1}">
        <button type="button" class="link-btn" data-del="${i}">Remove</button></li>`).join('');
    };
    cmp.addEventListener('click', (e) => {
      const r = cmp.getBoundingClientRect();
      today.marks = today.marks || [];
      today.marks.push({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, note: '' });
      renderMarks(); saveSession(sess);
    });
    box.querySelector('.marks').addEventListener('input', (e) => {
      const i = e.target.dataset.i;
      if (i != null) { today.marks[i].note = e.target.value; saveSession(sess); }
    });
    box.querySelector('.marks').addEventListener('click', (e) => {
      const i = e.target.dataset.del;
      if (i != null) { today.marks.splice(+i, 1); renderMarks(); saveSession(sess); }
    });
    renderMarks();
  }
}
$('btnToPacket').addEventListener('click', async () => { await renderPacket(); show('packet'); });

/* ---------- packet ---------- */
let lastPacket = null;
async function renderPacket() {
  const sess = state.session;
  sess.complete = sess.kind !== 'baseline' || !!sess.template;
  await saveSession(sess);
  const cmp = await baselineAndRecent(sess.id);
  lastPacket = buildPacket(sess, cmp, { includeImages: $('includeImages').checked });
  $('packetText').textContent = packetText(lastPacket.packet);
  const kb = lastPacket.bytes / 1024;
  $('packetSize').textContent = kb < 10 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
}
$('includeImages').addEventListener('change', renderPacket);
$('btnDownload').addEventListener('click', () => {
  if (!lastPacket) return;
  download(`relaisecho-packet-${state.session.id}.json`, lastPacket.json, 'application/json');
});
$('btnCopy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('packetText').textContent); $('btnCopy').textContent = 'Copied'; }
  catch { $('btnCopy').textContent = 'Copy failed: select the text instead'; }
  setTimeout(() => { $('btnCopy').textContent = 'Copy text summary'; }, 2000);
});

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- history ---------- */
async function renderHistory() {
  const all = (await listSessions()).reverse();
  const currentOriginal = (await baselineAndRecent()).original?.id;
  $('historyList').innerHTML = all.length ? all.map((s) => `<div class="hist-item">
      <span><strong>${esc(s.kind)}</strong> · ${fmtDate(s.createdAt)} · ${s.source === 'file' ? 'video file' : 'camera'}</span>
      <span>Pulse ${s.pulse?.bpm ?? '-'} (${s.pulse?.quality ?? 'none'}) · Breathing ${s.resp?.rpm ?? '-'} (${s.resp?.quality ?? 'none'})
      ${s.reference?.pulseBpm ? ` · ref pulse ${s.reference.pulseBpm}` : ''}${s.reference?.breathsPerMin ? ` · ref breathing ${s.reference.breathsPerMin}` : ''}
      · dental ${Object.values(s.dental || {}).filter((d) => d.captured).length}/3</span>
      ${s.kind === 'baseline' && s.complete ? (s.id === currentOriginal ? '<span class="tag live">ORIGINAL BASELINE</span>' : `<button type="button" class="link-btn" data-make-original="${esc(s.id)}">Use as original baseline</button>`) : ''}</div>`).join('')
    : '<p class="fine">No checkups yet.</p>';
}

$('btnBenchCsv').addEventListener('click', async () => {
  const rows = (await listSessions()).filter((s) => s.reference && (s.reference.pulseBpm || s.reference.breathsPerMin));
  const head = ['created', 'kind', 'source', 'est_pulse_bpm', 'ref_pulse_bpm', 'pulse_error_bpm', 'pulse_quality', 'windows_accepted', 'windows_total',
    'est_breaths_min', 'ref_breaths_min', 'breath_error', 'breath_quality', 'resp_channel', 'camera_fps', 'usable_s', 'elapsed_s', 'device', 'conditions'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((s) => {
    const pe = s.pulse?.bpm != null && s.reference.pulseBpm != null ? s.pulse.bpm - s.reference.pulseBpm : '';
    const re = s.resp?.rpm != null && s.reference.breathsPerMin != null ? s.resp.rpm - s.reference.breathsPerMin : '';
    return [s.createdAt, s.kind, s.source, s.pulse?.bpm, s.reference.pulseBpm, pe, s.pulse?.quality, s.pulse?.accepted, s.pulse?.total,
      s.resp?.rpm, s.reference.breathsPerMin, re, s.resp?.quality, s.resp?.channel, s.cameraFps, Math.round(s.usableSeconds || 0), Math.round(s.elapsedSeconds || 0),
      s.reference.device, s.reference.conditions].map(q).join(',');
  });
  download('relaisecho-bench-test.csv', [head.join(','), ...lines].join('\n'), 'text/csv');
});
$('btnExportAll').addEventListener('click', async () => {
  download('relaisecho-all-checkups.json', JSON.stringify(await listSessions(), null, 2), 'application/json');
});
$('btnClear').addEventListener('click', async () => {
  if (!window.confirm('Delete every checkup stored in this browser? This cannot be undone.')) return;
  await clearAll();
  renderHistory();
});

/* ---------- sample replay ---------- */
$('btnSample').addEventListener('click', async () => {
  try {
    const r = await fetch('samples/sample.mp4');
    if (!r.ok) throw new Error('missing');
    const blob = await r.blob();
    const file = new File([blob], 'sample.mp4', { type: blob.type || 'video/mp4' });
    state.session = { id: newId(), createdAt: new Date().toISOString(), kind: 'demo', source: 'file', facing: null,
      context: { activity: 'resting', glasses: 'no', symptoms: '' }, complete: false, dental: {} };
    await startScan('file', file);
  } catch {
    $('sampleNote').textContent = 'No sample recording is bundled yet. Choose "Video file" in setup to run the checkup on your own recording.';
  }
});

show('home');
