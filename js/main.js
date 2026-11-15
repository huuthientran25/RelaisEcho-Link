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
import { sleepPressure, issMissionDose, consistency, RADIATION } from './board.js';
import { PVT_CONFIG, summarizePvt, comparePvt, randomIsi } from './pvt.js';
import { applyLang } from './i18n.js';
import { NOISE, changeVsBaseline } from './change.js';
import { qrSvg, QR_MAX_BYTES } from './qr.js';
import { summarizeCrew, rangeDisagreements } from './crew.js';
import { eyeAspect, EyeTracker } from './eyes.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHANNEL_LABEL = { neck: 'neck band', chest: 'upper torso', head: 'head bob', pitch: 'head tilt' };
// Local date and time (stored values are UTC ISO strings).
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const state = {
  session: null, stream: null, fileUrl: null, sourceKind: null, landmarker: null,
  loop: null, scan: null, dental: null, AW: 480, AH: 270, uiT: 0,
};
const acan = document.createElement('canvas');
const actx = acan.getContext('2d', { willReadFrequently: true });

/* ---------- navigation ---------- */
const pvt = { running: false }; // alertness test state; declared early because show() reads it
function show(name) {
  if (name !== 'alertness' && pvt.running) pvtAbort();
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== `screen-${name}`; });
  window.scrollTo(0, 0);
  if (name === 'home') stopSource();
  if (name === 'history') renderHistory();
  if (name === 'setup') prepareSetup();
  if (name === 'board') renderBoard();
  if (name === 'alertness') pvtReset();
  if (name === 'crew') renderCrew();
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
      video: { facingMode: kind, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: CONFIG.perf.cameraFps } }, audio: false,
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
    frames: 0, skipped: 0, lastPresented: null, inferMs: null, fpsSum: 0, fpsN: 0,
    camT: [], stride: 1, strided: 0, chipsHtml: '' };
  startUiMeter();
  $('video').onended = () => finishScan();
  startLoop(scanFrame);
}

function scanFrame(t, meta) {
  const s = state.scan;
  if (!s || s.finished) return;
  const tw0 = performance.now();
  const v = $('video');
  const { AW, AH } = state;
  // Camera rate and frames the browser presented that we never got a callback for.
  s.camT.push(t);
  while (s.camT.length && t - s.camT[0] > 2000) s.camT.shift();
  if (meta && Number.isFinite(meta.presentedFrames)) {
    if (s.lastPresented !== null) s.skipped += Math.max(0, meta.presentedFrames - s.lastPresented - 1);
    s.lastPresented = meta.presentedFrames;
  }
  s.frames += 1;
  // Frame budget: when analysis is slow, analyse every second frame so the page stays smooth.
  if (s.inferMs != null) {
    if (s.stride === 1 && s.inferMs > CONFIG.perf.workBudgetMs) s.stride = 2;
    else if (s.stride === 2 && s.inferMs < CONFIG.perf.workRecoverMs) s.stride = 1;
  }
  if (s.stride > 1 && s.frames % s.stride) { s.strided += 1; return; }
  if (s.t0 === null) s.t0 = t;
  const dt = s.lastT === null ? 0 : Math.max(0, Math.min(0.25, (t - s.lastT) / 1000));
  s.lastT = t;
  s.elapsed = (t - s.t0) / 1000;
  s.fpsT.push(t);
  while (s.fpsT.length && t - s.fpsT[0] > 2000) s.fpsT.shift();
  const fps = s.fpsT.length / 2;
  if (s.elapsed > 2) { s.fpsSum += s.camT.length / 2; s.fpsN += 1; }

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
    const chipsHtml = checks.map((c) => `<span class="chip ${c.ok ? '' : 'bad'}">${c.ok ? '✓' : '!'} ${esc(c.label)}</span>`).join('');
    if (chipsHtml !== s.chipsHtml) { $('chips').innerHTML = chipsHtml; s.chipsHtml = chipsHtml; }
    const coach = coachMessage(lm, checks, al);
    if ($('coach').textContent !== coach) $('coach').textContent = coach;
    const target = CONFIG.scan.targetUsableSeconds;
    $('usableBar').style.transform = `scaleX(${Math.min(1, s.usable / target).toFixed(3)})`;
    $('usableText').textContent = `${Math.floor(s.usable)} of ${target} usable seconds`;
    const skipPct = s.frames + s.skipped ? Math.round((100 * s.skipped) / (s.frames + s.skipped)) : 0;
    const camFps = s.camT.length / 2;
    $('fpsText').textContent = `Screen ${uiMeter.fps || '…'} fps · camera ${camFps.toFixed(0)} fps · analysed ${fps.toFixed(0)} fps · ${Math.round(s.inferMs || 0)} ms per frame${skipPct ? ` · skipped ${skipPct}%` : ''}`;
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

// Screen refresh meter: counts painted frames per second while the scan runs, so a slow page is visible.
const uiMeter = { fps: 0, running: false };
function startUiMeter() {
  if (uiMeter.running) return;
  uiMeter.running = true;
  let n = 0, t0 = performance.now();
  const tick = (now) => {
    if (!state.scan || state.scan.finished || $('screen-scan').hidden) { uiMeter.running = false; uiMeter.fps = 0; return; }
    n += 1;
    if (now - t0 >= 1000) { uiMeter.fps = Math.round((n * 1000) / (now - t0)); n = 0; t0 = now; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
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
  sess.halfRateFramesPct = s.frames ? Math.round((100 * s.strided) / s.frames) : 0;
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
    const pc = changeVsBaseline(sess.pulse.bpm, original.pulse?.bpm, NOISE.pulseBpm);
    const rc = changeVsBaseline(sess.resp.rpm, original.resp?.rpm, NOISE.breathsPerMin);
    const line = (label, c) => `<li class="${c.kind === 'up' || c.kind === 'down' ? 'warnline' : ''}">${label}: ${esc(c.text)}</li>`;
    const gapMin = (() => { const a = new Date(sess.createdAt), b = new Date(original.createdAt); const g = Math.abs((a.getHours() * 60 + a.getMinutes()) - (b.getHours() * 60 + b.getMinutes())); return Math.min(g, 1440 - g); })();
    html += `<ul class="change-list">${line('Pulse', pc)}${line('Breathing', rc)}</ul>
      ${gapMin > 120 ? `<p class="fine">This checkup is ${Math.round(gapMin / 60)} hours away from your baseline's time of day; pulse varies over the day, so differences are less certain.</p>` : ''}
      <p class="fine">Noise bands are modeled from published camera error figures. <button type="button" class="link-btn" data-evidence="change">Evidence</button></p>`;
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
  const alert = (await listSessions()).filter((x) => x.kind === 'alertness'
    && Math.abs(+new Date(x.createdAt) - +new Date(sess.createdAt)) <= 24 * 3600 * 1000).pop() || null;
  lastPacket = buildPacket(sess, cmp, { includeImages: $('includeImages').checked, alertness: alert });
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
  const pvtLine = (s) => `<div class="hist-item"><span><strong>alertness</strong> · ${fmtDate(s.createdAt)}</span>
      <span>Median ${s.alertness.medianMs ?? '-'} ms · lapses ${s.alertness.lapses} · false starts ${s.alertness.falseStarts}</span></div>`;
  $('historyList').innerHTML = all.length ? all.map((s) => s.kind === 'alertness' ? pvtLine(s) : `<div class="hist-item">
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

/* ---------- mission board ---------- */
const H_MS = 3600 * 1000;
const pad2 = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtClock = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const prefs = {
  get(k) { try { return JSON.parse(localStorage.getItem(`re.${k}`)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(`re.${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

async function renderBoard() {
  const sessions = await listSessions();
  const c = consistency(sessions);
  const body = $('checkupBody');
  if (!c.total) {
    body.innerHTML = '<p class="big-num">0</p><p>No checkups yet. A first checkup becomes your baseline; every later one is compared with it.</p><p><button type="button" class="btn primary" data-nav="setup">Start a baseline</button></p>';
  } else {
    const dots = Array.from({ length: 7 }, (_, i) => `<span class="dot ${i < c.daysThisWeek ? 'on' : ''}" aria-hidden="true"></span>`).join('');
    const gap = c.timeGapMin;
    const timeMsg = gap == null ? '' : gap <= 120
      ? `<p class="okline">✓ Now is within 2 hours of your baseline time (${fmtClock(new Date(c.original.createdAt))}), so pulse and breathing compare fairly.</p>`
      : `<p class="warnline">! Your baseline was taken at ${fmtClock(new Date(c.original.createdAt))}. Pulse changes over the day, so a checkup near that time compares best.</p>`;
    body.innerHTML = `<p class="big-num">${c.daysThisWeek}<span class="unit"> of 7 days</span></p>
      <div class="dots">${dots}</div>
      <p>${c.total} checkup${c.total === 1 ? '' : 's'} saved, ${c.thisWeek} this week. Last one ${fmtDate(c.last.createdAt)}.</p>${timeMsg}
      <p>${c.daysThisWeek >= 3 ? 'Steady rhythm. Regular checkups make real changes easier to spot.' : 'A few checkups a week at the same time of day give the clearest comparison.'}</p>`;
  }
  // Sleep form defaults: last saved values, else last night 23:00 to 07:00.
  const saved = prefs.get('sleep');
  const now = new Date();
  const wake = new Date(now); wake.setHours(7, 0, 0, 0); if (wake > now) wake.setDate(wake.getDate() - 1);
  const bed = new Date(+wake - 8 * H_MS);
  $('sleepStart').value = saved?.start || toLocalInput(bed);
  $('sleepEnd').value = saved?.end || toLocalInput(wake);
  $('usualSleep').value = saved?.usual ?? '';
  const days = prefs.get('radDays');
  if (Number.isFinite(days)) $('radDays').value = days;
  updateSleepTile(); updateRadTile();
  renderAlertTile();
  renderCrewTile();
}

function updateSleepTile() {
  const start = new Date($('sleepStart').value), end = new Date($('sleepEnd').value);
  const usualRaw = $('usualSleep').value;
  prefs.set('sleep', { start: $('sleepStart').value, end: $('sleepEnd').value, usual: usualRaw === '' ? '' : Number(usualRaw) });
  const r = sleepPressure({ sleepStart: start, sleepEnd: end, now: new Date(), usualSleepH: usualRaw === '' ? undefined : Number(usualRaw) });
  const svg = $('sleepChart');
  if (!r) { $('sleepBody').innerHTML = '<p class="warnline">! Check the times: waking must come after sleep, within 16 hours, and not in the future.</p>'; svg.innerHTML = ''; return; }
  const read = r.asleepNow ? 'You are inside the sleep you entered, so the model shows pressure still falling.'
    : r.band === 'below' ? 'Below the model\'s sleep band: sleep pressure is low for now.'
      : r.band === 'within' ? 'Inside the model\'s sleep band: whether sleep comes easily now depends on the time of day.'
        : 'Above the model\'s sleep band: the model expects strong sleepiness. Plan rest before demanding tasks.';
  const short = r.sleptH < 6 ? '<p class="warnline">! Under 6 hours last night. In ISS astronauts, nights this short were linked to slower reaction test scores.</p>' : '';
  $('sleepBody').innerHTML = `<p class="big-num">${r.s.toFixed(2)}<span class="unit"> sleep pressure (0 to 1)</span></p>
    <p>${read}</p><p class="fine">Slept ${r.sleptH.toFixed(1)} h · usual ${r.usualH.toFixed(1)} h · ISS crews averaged about 6.1 h against 8.5 h scheduled.</p>${short}`;
  // Chart: curve, threshold band, now marker.
  const W = 600, Hh = 180, padL = 8, padR = 8, padT = 28, padB = 30;
  const x = (t) => padL + ((t - r.from) / (r.to - r.from)) * (W - padL - padR);
  const y = (v) => padT + (1 - v) * (Hh - padT - padB);
  const pts = r.curve.map((p) => `${x(p.t).toFixed(1)},${y(p.s).toFixed(1)}`).join(' ');
  const ticks = [];
  for (let t = Math.ceil(r.from / (6 * H_MS)) * 6 * H_MS; t <= r.to; t += 6 * H_MS) {
    ticks.push(`<text x="${Math.min(W - 30, Math.max(30, x(t))).toFixed(1)}" y="${Hh - 6}" class="ax" text-anchor="middle">${fmtClock(new Date(t))}</text>`);
  }
  svg.innerHTML = `<rect x="${padL}" y="${y(r.hi).toFixed(1)}" width="${W - padL - padR}" height="${(y(r.lo) - y(r.hi)).toFixed(1)}" class="band"/>
    <text x="${W - padR - 4}" y="${(y(r.hi) - 6).toFixed(1)}" class="ax" text-anchor="end">sleep band</text>
    <polyline points="${pts}" class="line"/>
    <circle cx="${x(r.to).toFixed(1)}" cy="${y(r.s).toFixed(1)}" r="6" class="now"/>${ticks.join('')}`;
}

function updateRadTile() {
  const days = Number($('radDays').value);
  prefs.set('radDays', days);
  $('radDaysOut').textContent = String(days);
  const d = issMissionDose(days);
  const pct = (f) => Math.min(100, f * 100);
  $('radBar').style.left = `${pct(d.fracLow)}%`;
  $('radBar').style.width = `${Math.max(0.8, pct(d.fracHigh) - pct(d.fracLow))}%`;
  const over = d.high >= RADIATION.careerLimitMsv;
  $('radBody').innerHTML = `<p class="big-num">${Math.round(d.low)} to ${Math.round(d.high)}<span class="unit"> mSv</span></p>
    <p>That is ${Math.round(d.fracLow * 100)} to ${Math.round(d.fracHigh * 100)}% of NASA's ${RADIATION.careerLimitMsv} mSv career limit.${over ? ' <strong>The high estimate reaches or passes the limit.</strong>' : ''}</p>
    <p class="fine">Beyond low Earth orbit, daily doses are higher; a Mars round trip could approach or pass this limit (see Evidence).</p>`;
}

$('sleepForm').addEventListener('input', updateSleepTile);
$('radDays').addEventListener('input', () => requestAnimationFrame(updateRadTile));

/* ---------- alertness check (brief PVT) ---------- */
const pvtTests = async () => (await listSessions()).filter((x) => x.kind === 'alertness' && x.alertness);

function pvtReset() {
  $('pvtIntro').hidden = false; $('pvtRun').hidden = true; $('pvtResult').hidden = true;
}

async function pvtStartEyes() {
  const v = $('pvtVideo');
  $('pvtIntro').hidden = true; $('pvtRun').hidden = false;
  $('pvtCounter').textContent = ''; $('pvtHint').textContent = 'Starting the camera…';
  try {
    await ensureModel($('pvtHint'));
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false });
    v.srcObject = stream; await v.play();
    pvt.eyeStream = stream;
    $('pvtCamBox').hidden = false;
    return true;
  } catch (err) {
    console.warn('Eye tracking unavailable', err);
    pvt.eyeError = err && err.name === 'NotAllowedError' ? 'Camera permission was denied, so eye closure was not tracked.' : 'The camera or face model could not start, so eye closure was not tracked.';
    return false;
  }
}

function pvtEyeLoop() {
  const v = $('pvtVideo');
  const step = () => {
    if (!pvt.running || !pvt.eyes) return;
    const now = performance.now();
    if (now - pvt.eyeLastT >= 66) { // at most about 15 analysed frames per second, to keep the counter smooth
      pvt.eyeLastT = now;
      const w0 = performance.now();
      const lm = detect(state.landmarker, v);
      pvt.eyes.push(now, eyeAspect(lm));
      const spent = performance.now() - w0;
      pvt.eyeMs = pvt.eyeMs == null ? spent : 0.9 * pvt.eyeMs + 0.1 * spent;
    }
    if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(step); else requestAnimationFrame(step);
  };
  step();
}

function pvtStopEyes() {
  if (pvt.eyeStream) { pvt.eyeStream.getTracks().forEach((t) => t.stop()); pvt.eyeStream = null; }
  const v = $('pvtVideo'); v.pause(); v.srcObject = null;
  $('pvtCamBox').hidden = true;
}

async function pvtStart() {
  if (pvt.starting || pvt.running) return;
  pvt.starting = true;
  try { await pvtBegin(); } finally { pvt.starting = false; }
}

async function pvtBegin() {
  const durationSec = Number(document.querySelector('input[name=pvtLen]:checked').value);
  pvt.eyes = null; pvt.eyeError = ''; pvt.eyeMs = null; pvt.eyeLastT = 0;
  const wantEyes = $('pvtEyes').checked;
  if (wantEyes && await pvtStartEyes()) pvt.eyes = new EyeTracker();
  pvt.withEyes = !!pvt.eyes;
  const now = performance.now();
  Object.assign(pvt, {
    running: true, save: durationSec >= PVT_CONFIG.durationSec, durationSec, trials: [],
    t0: now, endAt: now + durationSec * 1000, phase: 'wait', nextAt: now + randomIsi(), onset: null,
    feedbackUntil: 0, shown: '', leftShown: '',
  });
  $('pvtIntro').hidden = true; $('pvtResult').hidden = true; $('pvtRun').hidden = false;
  $('pvtCounter').textContent = ''; $('pvtHint').textContent = 'Wait for the counter';
  $('pvtTarget').classList.remove('live', 'early');
  $('pvtTarget').focus({ preventScroll: true });
  requestAnimationFrame(pvtFrame);
  if (pvt.eyes) pvtEyeLoop();
}

function pvtSet(text, cls) {
  if (pvt.shown !== text) { $('pvtCounter').textContent = text; pvt.shown = text; }
  const tgt = $('pvtTarget');
  tgt.classList.toggle('live', cls === 'live');
  tgt.classList.toggle('early', cls === 'early');
}

function pvtFrame(ts) {
  if (!pvt.running) return;
  const c = PVT_CONFIG;
  if (pvt.phase === 'feedback' && ts >= pvt.feedbackUntil) {
    pvt.phase = 'wait'; pvt.nextAt = ts + randomIsi();
    pvtSet('', null); $('pvtHint').textContent = '';
  }
  if (pvt.phase === 'wait') {
    if (ts >= pvt.endAt) { pvtFinish(); return; }
    if (ts >= pvt.nextAt) { pvt.phase = 'stim'; pvt.onset = ts; $('pvtHint').textContent = ''; }
  }
  if (pvt.phase === 'stim') {
    const el = ts - pvt.onset;
    if (el >= c.timeoutMs) {
      pvt.trials.push({ rt: null });
      pvt.phase = 'feedback'; pvt.feedbackUntil = ts + c.feedbackMs; pvtSet('Missed', 'early');
    } else pvtSet(String(Math.round(el)).padStart(3, '0'), 'live');
  }
  const frac = Math.min(1, (ts - pvt.t0) / (pvt.durationSec * 1000));
  $('pvtBar').style.transform = `scaleX(${frac.toFixed(3)})`;
  const left = `${Math.max(0, Math.ceil((pvt.endAt - ts) / 1000))} s left`;
  if (left !== pvt.leftShown) { $('pvtLeft').textContent = left; pvt.leftShown = left; }
  requestAnimationFrame(pvtFrame);
}

function pvtRespond(e) {
  if (!pvt.running) return;
  e.preventDefault();
  const c = PVT_CONFIG;
  const ts = e.timeStamp || performance.now();
  if (pvt.phase === 'stim') {
    const rt = Math.max(0, ts - pvt.onset);
    pvt.trials.push({ rt });
    pvt.phase = 'feedback'; pvt.feedbackUntil = performance.now() + c.feedbackMs;
    if (rt < c.falseStartMs) pvtSet('Too fast', 'early');
    else pvtSet(`${Math.round(rt)} ms`, null);
  } else if (pvt.phase === 'wait') {
    pvt.trials.push({ early: true });
    pvt.phase = 'feedback'; pvt.feedbackUntil = performance.now() + c.feedbackMs;
    pvtSet('Too early', 'early');
  }
}

function pvtAbort(message) {
  pvt.running = false;
  pvtStopEyes();
  pvtReset();
  if (message) { $('pvtResult').hidden = false; $('pvtResult').innerHTML = `<p class="warnline">! ${esc(message)}</p>`; }
}

async function pvtFinish() {
  pvt.running = false;
  pvtStopEyes();
  const sum = summarizePvt(pvt.trials);
  const eyes = pvt.eyes ? { ...pvt.eyes.summary(), analysisMs: Math.round(pvt.eyeMs || 0) } : null;
  const rts = pvt.trials.filter((t) => !t.early).map((t) => (t.rt == null ? null : Math.round(t.rt)));
  const before = await pvtTests();
  // Reference: the first saved test run the same way (with or without the camera), since camera work can add delay.
  const refRec = before.find((x) => !!x.alertness.withEyes === pvt.withEyes);
  const ref = refRec ? refRec.alertness : null;
  if (pvt.save) {
    await saveSession({ id: newId(), createdAt: new Date().toISOString(), kind: 'alertness', source: 'device', complete: false,
      alertness: { ...sum, durationSec: pvt.durationSec, rts, withEyes: pvt.withEyes, eyes, device: navigator.userAgent.slice(0, 120) } });
  }
  const cmp = comparePvt(sum, ref);
  const verdict = !pvt.save ? 'Practice run, not saved.'
    : !ref ? 'Saved as your reference test on this device. Later tests are compared with it.'
      : cmp.verdict === 'similar' ? `Similar to your reference test (${cmp.pct > 0 ? '+' : ''}${cmp.pct}% median).`
        : cmp.verdict === 'slower' ? `${cmp.pct}% slower than your reference test. Short sleep, illness and time of day can all do this; rest before demanding tasks if you can.`
          : `${Math.abs(cmp.pct)}% faster than your reference test. Practice also speeds people up over the first few tests.`;
  $('pvtRun').hidden = true; $('pvtIntro').hidden = true; $('pvtResult').hidden = false;
  $('pvtResult').innerHTML = `<div class="card result">
      <p><span class="tag live">LIVE</span><span class="tag">EXPERIMENTAL</span></p>
      <p class="big">${sum.medianMs ?? '-'}<span class="unit"> ms median reaction time</span></p>
      <p>${sum.lapses} lapse${sum.lapses === 1 ? '' : 's'} (355 ms or slower, or missed) · ${sum.falseStarts} false start${sum.falseStarts === 1 ? '' : 's'} · ${sum.valid} of ${sum.stimuli} responses counted</p>
      <p class="${cmp && cmp.verdict === 'slower' ? 'warnline' : 'okline'}">${esc(verdict)}</p>
      ${eyes ? pvtEyesHtml(eyes, ref && ref.eyes) : pvt.eyeError ? `<p class="fine">${esc(pvt.eyeError)}</p>` : ''}
      <svg class="spark" viewBox="0 0 600 180" role="img" aria-label="Reaction time for each response across the test">${pvtChart(rts)}</svg>
      <p class="fine">Each dot is one response, left to right through the test; the dashed line is the 355 ms lapse threshold. Device delay is included, so compare only on this device.</p>
    </div>
    <p class="row"><button type="button" class="btn primary" id="btnPvtAgain">Test again</button>
      <button type="button" class="btn" data-nav="board">Mission board</button></p>`;
  $('btnPvtAgain').addEventListener('click', pvtReset);
}

function pvtChart(rts) {
  const W = 600, Hh = 180, padL = 50, padR = 10, padT = 12, padB = 24;
  const vals = rts.map((r) => (r == null ? PVT_CONFIG.timeoutMs : r));
  if (!vals.length) return '';
  const maxY = Math.min(1000, Math.max(500, ...vals.filter((v) => v < PVT_CONFIG.timeoutMs)) * 1.1);
  const x = (i) => padL + (vals.length === 1 ? 0.5 : i / (vals.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - Math.min(v, maxY) / maxY) * (Hh - padT - padB);
  const lapse = PVT_CONFIG.lapseMs;
  const dots = vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5" class="${v >= lapse ? 'now' : 'dotpt'}"/>`).join('');
  return `<line x1="${padL}" x2="${W - padR}" y1="${y(lapse).toFixed(1)}" y2="${y(lapse).toFixed(1)}" class="lapse"/>
    <text x="${padL - 6}" y="${(y(lapse) + 6).toFixed(1)}" class="ax" text-anchor="end">355</text>
    <text x="${padL - 6}" y="${(y(0)).toFixed(1)}" class="ax" text-anchor="end">0</text>
    <text x="${padL - 6}" y="${(y(maxY) + 16).toFixed(1)}" class="ax" text-anchor="end">${Math.round(maxY)}</text>${dots}`;
}

$('btnPvtStart').addEventListener('click', pvtStart);
$('btnPvtStop').addEventListener('click', () => pvtAbort('Test stopped. Nothing was saved.'));
$('pvtTarget').addEventListener('pointerdown', pvtRespond);
$('pvtTarget').addEventListener('click', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (!pvt.running || e.repeat) return;
  if (e.code === 'Space' || e.key === ' ') pvtRespond(e);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && pvt.running) pvtAbort('Test stopped because the app was hidden. Nothing was saved.');
});

async function renderAlertTile() {
  const tests = await pvtTests();
  const body = $('alertBody');
  if (!tests.length) {
    body.innerHTML = `<p>A 3 minute reaction test, like the one astronauts take on the ISS. Slower responses and more lapses can show tiredness before you feel it.</p>
      <p><button type="button" class="btn primary" data-nav="alertness">Take the 3 minute test</button></p>`;
    return;
  }
  const last = tests[tests.length - 1].alertness, ref = tests[0].alertness;
  const cmp = tests.length > 1 ? comparePvt(last, ref) : null;
  const msg = !cmp ? 'This is your reference test.'
    : cmp.verdict === 'similar' ? 'Similar to your reference test.'
      : cmp.verdict === 'slower' ? `${cmp.pct}% slower than your reference test.` : `${Math.abs(cmp.pct)}% faster than your reference test.`;
  body.innerHTML = `<p class="big-num">${last.medianMs ?? '-'}<span class="unit"> ms median</span></p>
    <p>${last.lapses} lapse${last.lapses === 1 ? '' : 's'} · ${last.falseStarts} false start${last.falseStarts === 1 ? '' : 's'} · ${fmtDate(tests[tests.length - 1].createdAt)}</p>
    <p class="${cmp && cmp.verdict === 'slower' ? 'warnline' : 'okline'}">${msg}</p>
    <p><button type="button" class="btn" data-nav="alertness">Test again</button></p>`;
}

/* ---------- language ---------- */
function setLang(code) {
  const { code: used, notice } = applyLang(code);
  $('langSel').value = used;
  $('langNotice').hidden = !notice;
  $('langNotice').textContent = notice;
  prefs.set('lang', used);
}
$('langSel').addEventListener('change', (e) => setLang(e.target.value));
setLang(prefs.get('lang') || 'en');

/* ---------- QR code of the text summary ---------- */
$('btnQr').addEventListener('click', () => {
  const box = $('qrBox');
  if (!box.hidden) { box.hidden = true; $('btnQr').textContent = 'Show QR code'; return; }
  const text = $('packetText').textContent;
  const q = qrSvg(text);
  box.innerHTML = q.ok
    ? `<div class="qr-img">${q.svg}</div><p class="fine">Scan with any phone camera to copy the text summary (${q.bytes} bytes, no photos). Works with no internet. Anyone who can see the screen can scan it, so show it only to the person reviewing.</p>`
    : `<p class="warnline">! The summary is ${q.bytes} bytes, more than a QR code here holds reliably (${QR_MAX_BYTES}). Use Copy text summary or the file instead.</p>`;
  box.hidden = false;
  $('btnQr').textContent = 'Hide QR code';
});

/* ---------- crew data (NASA OSDR OSD-575) ---------- */
let crewData = null;
async function loadCrew() {
  if (!crewData) crewData = await (await fetch('data/osd575-cmp.json')).json();
  return crewData;
}

async function renderCrewTile() {
  try {
    const d = await loadCrew();
    const r = rangeDisagreements(d);
    $('crewTileBody').innerHTML = `<p class="big-num">${r.normalButUnusual}<span class="unit"> of ${r.r1Total}</span></p>
      <p>results the day after landing were inside the lab's normal range but outside that person's own pre-flight values. A population range alone would not notice them.</p>`;
  } catch { /* data file missing: keep the static text */ }
}

async function renderCrew() {
  const d = await loadCrew();
  const sel = $('crewAnalyte');
  if (!sel.options.length) {
    sel.innerHTML = d.analytes.map((a, i) => `<option value="${i}">${esc(a.name)} (${esc(a.unit)})</option>`).join('');
    sel.addEventListener('change', drawCrew);
  }
  const r = rangeDisagreements(d);
  $('crewSummary').innerHTML = `Across ${d.analytes.length} blood tests: <strong>${r.normalButUnusual} of ${r.r1Total}</strong> day-after-landing results were "normal" for the population but outside that person's own pre-flight values, and <strong>${r.preOutsideLab} of ${r.preTotal}</strong> pre-flight results (their usual) would already be flagged by the population range. Three pre-flight values is a small baseline, so some of this is ordinary variation.`;
  drawCrew();
}

function drawCrew() {
  const d = crewData;
  const a = d.analytes[Number($('crewAnalyte').value) || 0];
  const sum = summarizeCrew(a, d.timepoints);
  const all = Object.values(a.series).flat().filter((v) => v != null);
  const lo = Math.min(a.rangeMin, ...all), hi = Math.max(a.rangeMax, ...all);
  const pad = (hi - lo) * 0.12 || 1;
  const yMin = lo - pad, yMax = hi + pad;
  const W = 300, H = 190, L = 44, R = 8, T = 26, B = 30;
  const n = d.timepoints.length;
  const x = (i) => L + (i / (n - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const fmt = (v) => (Math.abs(v) >= 20 ? Math.round(v) : Math.round(v * 10) / 10);
  const flightX = (x(2) + x(3)) / 2;
  $('crewCharts').innerHTML = d.crew.map((c) => {
    const vals = a.series[c];
    const s = sum[c];
    const pts = vals.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    const own = s ? `<rect x="${L}" y="${y(s.preMax).toFixed(1)}" width="${W - L - R}" height="${Math.max(2, y(s.preMin) - y(s.preMax)).toFixed(1)}" class="own"/>` : '';
    const dots = vals.map((v, i) => (v == null ? '' : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4.5" class="${v < a.rangeMin || v > a.rangeMax ? 'out' : i >= 3 && s && (v < s.preMin || v > s.preMax) ? 'unusual' : 'pt'}"/>`)).join('');
    return `<figure class="crew-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c)} ${esc(a.name)} over time">
      <rect x="${L}" y="${y(a.rangeMax).toFixed(1)}" width="${W - L - R}" height="${(y(a.rangeMin) - y(a.rangeMax)).toFixed(1)}" class="lab"/>
      ${own}
      <line x1="${flightX}" x2="${flightX}" y1="${T - 6}" y2="${H - B}" class="flight"/>
      <text x="${flightX}" y="${T - 10}" class="ax" text-anchor="middle">flight</text>
      <polyline points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" class="line"/>
      ${dots}
      <text x="${L - 4}" y="${(y(a.rangeMax) + 4).toFixed(1)}" class="ax" text-anchor="end">${fmt(a.rangeMax)}</text>
      <text x="${L - 4}" y="${(y(a.rangeMin) + 4).toFixed(1)}" class="ax" text-anchor="end">${fmt(a.rangeMin)}</text>
      <text x="${x(0)}" y="${H - 8}" class="ax" text-anchor="start">before</text>
      <text x="${x(n - 1)}" y="${H - 8}" class="ax" text-anchor="end">after</text>
    </svg><figcaption>${esc(c)}${s ? ` · day after landing ${s.r1} (${s.pct > 0 ? '+' : ''}${Math.round(s.pct)}% vs own pre-flight)` : ''}</figcaption></figure>`;
  }).join('');
  $('crewTable').innerHTML = `<table><caption class="fine" style="text-align:left">${esc(a.name)}, ${esc(a.unit)}. Lab range ${a.rangeMin} to ${a.rangeMax}.</caption>
    <thead><tr><th scope="col">Crew</th><th scope="col">Own pre-flight</th><th scope="col">Day after landing</th><th scope="col">Lab range says</th><th scope="col">Own range says</th></tr></thead>
    <tbody>${d.crew.map((c) => { const s = sum[c]; return s ? `<tr><th scope="row">${esc(c)}</th><td>${s.preMin} to ${s.preMax}</td><td>${s.r1}</td><td>${s.inLab ? 'normal' : '<strong>outside</strong>'}</td><td>${s.inOwn ? 'usual' : '<strong>unusual</strong>'}</td></tr>` : `<tr><th scope="row">${esc(c)}</th><td colspan="4">missing</td></tr>`; }).join('')}</tbody></table>
    <p class="fine">Dots: navy within both ranges, blue outlined unusual for that person after flight, red outside the lab range.</p>`;
}

function pvtEyesHtml(e, refEyes) {
  if (e.trackedPct < 50) return `<p class="warnline">! Eyes were tracked for only ${e.trackedPct}% of the test (face out of view or too dark), so no eye result is given.</p>`;
  const cmp = refEyes && refEyes.blinksPerMin != null && e.blinksPerMin != null
    ? ` Your reference test: ${refEyes.blinksPerMin} blinks per minute, eyes closed ${refEyes.closedPct}%.` : '';
  return `<h3>Eyes <span class="tag">EXPERIMENTAL</span></h3>
    <p>${e.blinksPerMin ?? '-'} blinks per minute · eyes closed ${e.closedPct ?? '-'}% of the time · ${e.longClosures} closure${e.longClosures === 1 ? '' : 's'} of half a second or longer.${cmp}</p>
    <p class="fine">Tracked ${e.trackedPct}% of the test. Eye analysis took about ${e.analysisMs} ms per frame on this device; tests with the camera are only compared with other camera tests. <button type="button" class="link-btn" data-evidence="eyes">Evidence</button></p>`;
}

/* ---------- install for offline use ---------- */
// Chromium browsers offer an install prompt; elsewhere the button stays hidden and the
// service worker still caches the app after the first visit.
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('btnInstall').hidden = false;
});
$('btnInstall').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  const choice = await installEvent.userChoice.catch(() => null);
  installEvent = null;
  $('btnInstall').hidden = true;
  if (choice && choice.outcome === 'accepted') $('sampleNote').textContent = 'Installed. It opens like an app and works without internet after the first visit.';
});
window.addEventListener('appinstalled', () => { $('btnInstall').hidden = true; });
