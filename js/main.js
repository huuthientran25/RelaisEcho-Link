// RelaisÉcho Link app controller: screens, camera or file source, frame loop.
import { CONFIG } from './config.js';
import { getFaceLandmarker, getModelSource, getDelegate, MODEL_URLS, detect } from './vision.js';
import { faceGeometry, keypointArray, motionSpeed, pulseRois, pulseRegions, PULSE_REGIONS, torsoRoi, neckRoi, LIPS_OUTER } from './geometry.js';
import { roiMeanRGB, rowProfile, makeFrameClock } from './frame.js';
import { makeTemplate, defaultTemplate, compareToTemplate } from './align.js';
import { estimatePulse, livePulse, estimateWindow, estimatePulseRegions } from './pulse.js';
import { TorsoTracker, estimateRespMulti } from './resp.js';
import { DentalCapture, VIEWS, approxDistanceCm } from './dental.js';
import { saveSession, listSessions, baselineAndRecent, newId, clearAll, setOriginal, deleteSession, setProfile, getProfile, countByProfile, allIds, everySession, eraseDatabase, DEFAULT_PROFILE } from './store.js';
import { NETWORK, EXPORTS, NEVER, inventory, inventoryLines, fmtBytes } from './privacy.js';
import { buildPacket, packetText } from './packet.js';
import { EVIDENCE } from './evidence.js';
import { sleepPressure, missionDose, MISSION_PRESETS, consistency, RADIATION, todaySteps } from './board.js';
import { loadSpaceWeather, isFresh } from './spaceweather.js';
import { SYMPTOMS, URGENT_TEXT, symptomLabels, hasUrgent, symptomCounts } from './symptoms.js';
import { dayLength, fmtHours, PLACES, ISS_SUNRISES_PER_DAY } from './daylight.js';
import { PVT_CONFIG, summarizePvt, comparePvt, randomIsi } from './pvt.js';
import { applyLang, phrase } from './i18n.js';
import { changeVsBaseline, benchError, noiseFloor, MIN_BENCH_PAIRS } from './change.js';
import { qrSvg, QR_MAX_BYTES } from './qr.js';
import { summarizeCrew, rangeDisagreements, aboveOwnAfterFlight, compact } from './crew.js';
import { eyeAspect, EyeTracker, lidOpeningMm, summarizeLids, compareLids, LID } from './eyes.js';
import { makeSpeaker } from './speech.js';
import { parseBackup, mergePlan } from './backup.js';
import { makeDemoSessions, makeDemoExp, SCENARIOS, DEMO_PROFILE, DEMO_NAME } from './demo.js';
import { validatePacket, safeImage, standouts } from './review.js';
import { analyzeMouth, compareMouth, changeMap, mouthMask } from './dentalcmp.js';
import { REPLY_STATUSES, makeReply, validateReply, gzipText, readMaybeGzip } from './reply.js';
import { reminderIcs, stripOldPhotos, resultsCsv, cameraOptions, cameraConstraints } from './extras.js';
import { featureList, fpsFromTimes, median, verdicts, overall, reportText } from './devicecheck.js';
import { REEL, reelTotal, sceneAt, reelSrt, pickRecordingType } from './reel.js';
import { earthMars, marsCycle, moonOneWaySec, fmtDelay } from './delay.js';
import { initExp } from './expui.js';
import { ACUITY, optoMm, snellen, floorLogmar, AcuityRun, compareAcuity, acuityForPacket } from './acuity.js';
import { expForPacket, checkTitle, CHECKS as EXP_CHECKS } from './exp.js';
import { METRIC_DEFS, seriesFor, referenceFor, buildRegions, lineChart, BODY_SVG, missionDay } from './overview.js';
import { N as AMS_N, CARD_MM, DEFAULT_PX_PER_MM, summarize as amsSummary, compareEye, gridSize, cleanCells, visionForPacket } from './amsler.js';

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
// Screens where the camera may be running. Leaving them (for the board, history, home...) stops the
// camera, drops an unfinished scan and keeps any dental photos already taken.
const LIVE_SCREENS = ['scan', 'results', 'dental'];
function abandonCapture() {
  if (state.scan && !state.scan.finished) state.scan.finished = true;
  const d = state.dental;
  if (d && !d.finished) {
    d.finished = true;
    if (state.session && Object.values(d.results).some((r) => r.captured)) { state.session.dental = d.results; saveSession(state.session); }
  }
  stopSource();
}
let curLang = 'en'; // set by setLang
const pvt = { running: false }; // alertness test state; declared early because show() reads it
const dev = { r: { env: {} }, meta: {}, running: false, stream: null, token: null }; // device check state; show() reads it too
let expApi = null; // experimental checks controller, set up at the end of this file
const TAB_OF = { overview: 'overview', setup: 'setup', scan: 'setup', results: 'setup', dental: 'setup', compare: 'setup', packet: 'setup',
  board: 'board', alertness: 'board', crew: 'board', vision: 'board', acuity: 'board', exp: 'exp', history: 'history' };
function show(name) {
  state.screen = name;
  document.querySelectorAll('.tabs [data-tab]').forEach((b) => { if (b.dataset.tab === TAB_OF[name]) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (name === 'overview') renderOverview();
  if (name !== 'alertness' && pvt.running) pvtAbort();
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== `screen-${name}`; });
  window.scrollTo(0, 0);
  if (!LIVE_SCREENS.includes(name)) abandonCapture();
  if (name === 'history') renderHistory();
  if (name === 'setup') prepareSetup();
  if (name === 'board') renderBoard();
  if (name === 'alertness') pvtReset();
  if (name === 'crew') renderCrew();
  if (name !== 'device') devStop();
  if (name === 'vision') visReset();
  if (name === 'acuity') acReset();
  if (name !== 'exp') expApi?.stop();
  if (name === 'exp') expApi?.reset();
  if (name === 'privacy') renderPrivacy();
  if (name === 'device') renderDevice();
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

// Offline readiness: the app shell is cached, and whether the face model is cached too.
const offline = { shell: false, model: false };
async function checkOffline() {
  try {
    const keys = await caches.keys();
    for (const k of keys) {
      const c = await caches.open(k);
      if (await c.match('index.html') || await c.match('./')) offline.shell = true;
      const reqs = await c.keys();
      if (reqs.some((r) => /face_landmarker\.task/.test(r.url))) offline.model = true;
    }
  } catch { /* caches unavailable (private mode) */ }
  updateNet();
}
function updateNet() {
  const on = navigator.onLine;
  $('netStatus').textContent = on ? (offline.model ? 'Online · works offline' : 'Online') : (offline.model ? 'Offline: checkups still work' : 'Offline: board and history work');
  $('netStatus').title = offline.model ? 'The app and the face model are saved on this device.' : offline.shell ? 'The app is saved on this device; the face model downloads on first use of the camera.' : 'Open the app once online to save it on this device.';
  $('netStatus').classList.toggle('off', !on);
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);
updateNet();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker not registered', e));
  navigator.serviceWorker.ready.then(() => setTimeout(checkOffline, 1500)).catch(() => {});
}

/* ---------- setup ---------- */
async function prepareSetup() {
  // A new checkup starts with nothing ticked, so yesterday's symptoms are never carried over by accident.
  document.querySelectorAll('#symptomTicks input').forEach((i) => { i.checked = false; });
  $('urgentNote').hidden = true; $('symptoms').value = '';
  refreshCameraList();
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
    context: { activity: f.get('activity'), glasses: f.get('glasses'), symptoms: $('symptoms').value.trim(), checklist: tickedSymptoms() },
    complete: false, dental: {},
  };
  await startScan(src, file);
});
// Symptom checklist in the setup form.
$('symptomTicks').innerHTML = SYMPTOMS.map((x) => `<label><input type="checkbox" name="sym" value="${x.id}"> ${esc(x.label)}</label>`).join('');
function tickedSymptoms() { return [...document.querySelectorAll('#symptomTicks input:checked')].map((i) => i.value); }
$('symptomTicks').addEventListener('change', () => {
  const urgent = hasUrgent(tickedSymptoms());
  $('urgentNote').hidden = !urgent;
  $('urgentNote').textContent = urgent ? `! ${URGENT_TEXT}` : '';
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
    const picked = $('camPick').value || '';
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(kind, picked, CONFIG.perf.cameraFps)); }
    catch (err) {
      // The saved camera was unplugged or renamed: fall back to the automatic choice once.
      if (!picked || (err.name !== 'OverconstrainedError' && err.name !== 'NotFoundError')) throw err;
      prefs.set('camId', ''); $('camPick').value = '';
      stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(kind, '', CONFIG.perf.cameraFps));
    }
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
  const clock = makeFrameClock(state.sourceKind === 'file');
  const step = (now, meta) => {
    if (state.loop !== token) return;
    const t = clock(meta);
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
  coachEl.textContent = phrase(curLang, 'Loading the face model…');
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
      : `Could not start: ${err.message || err}. "Check this device" on the home page shows what is missing.`;
}

/* ---------- resting scan ---------- */
async function startScan(src, file) {
  show('scan');
  moveStage('scanStageSlot');
  $('coach').textContent = phrase(curLang, 'Starting…');
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
    camT: [], stride: 1, strided: 0, chipsHtml: '', regs: Object.fromEntries(PULSE_REGIONS.map((r) => [r.id, { label: r.label, samples: [] }])),
    eyes: new EyeTracker(), lids: [] };
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
  const q0 = CONFIG.quality;
  if (s.inferMs != null) {
    // Only skip frames when the camera is fast enough that half its frames still clear the soft limit.
    if (s.stride === 1 && s.inferMs > CONFIG.perf.workBudgetMs && s.camT.length / 2 >= 2 * q0.softFps) s.stride = 2;
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
  // Every skin region on its own, one sample per frame, so they stay aligned for pooling later.
  let regs = null;
  if (g) {
    regs = pulseRegions(lm, g);
    for (const rg of regs) {
      const m = roiMeanRGB(img, [rg.box]);
      s.regs[rg.id].samples.push({ t, r: m.r, g: m.g, b: m.b, n: m.n, ok: ok && m.n > 20 && m.clippedFrac < 0.05 });
    }
  }
  // Blinks during the resting scan (experimental).
  s.eyes.push(t, lm ? eyeAspect(lm) : null);
  if (lm && ok) s.lids.push(lidOpeningMm(lm, AW, AH));
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
  if (s.elapsed > 2 && fps >= q.minFps && fps < q.softFps) checks.push({ key: 'fpsSoft', label: `Low frame rate (${fps.toFixed(0)} fps), results less certain`, ok: false, soft: true });

  drawScanOverlay(g, regs ? regs.map((r) => r.box) : rois, torso, neck, al);
  if (t - state.uiT > 150 || t < state.uiT) {
    state.uiT = t;
    const chipsHtml = checks.map((c) => `<span class="chip ${c.ok ? '' : 'bad'}">${c.ok ? '✓' : '!'} ${esc(phrase(curLang, c.label))}</span>`).join('');
    if (chipsHtml !== s.chipsHtml) { $('chips').innerHTML = chipsHtml; s.chipsHtml = chipsHtml; }
    const coach = phrase(curLang, coachMessage(lm, checks, al));
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

// The overlay canvas is kept at the screen's real pixel density (not the 480 px analysis size), so the
// guide lines and boxes stay sharp. Drawing still uses analysis coordinates; px is one screen pixel in them.
function overlayCtx() {
  const c = $('overlay');
  const { AW, AH } = state;
  const r = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const k = r.width > 0 ? Math.max(1, Math.min(4, (r.width * dpr) / AW)) : 1;
  const w = Math.round(AW * k), h = Math.round(AH * k);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const px = r.width > 0 ? AW / r.width : 1;
  const mirrored = $('stage').classList.contains('mirror');
  // A box with rounded corners, a light fill and an optional small label that reads correctly in selfie view.
  const box = (b, color, label) => {
    ctx.save();
    ctx.lineWidth = 2 * px; ctx.strokeStyle = color; ctx.fillStyle = `${color}22`;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 4 * px); else ctx.rect(b.x, b.y, b.w, b.h);
    ctx.fill(); ctx.stroke();
    if (label) {
      ctx.font = `700 ${12 * px}px system-ui, sans-serif`;
      const tw = ctx.measureText(label).width + 8 * px, th = 16 * px;
      const lx = b.x, ly = Math.max(0, b.y - th - 2 * px);
      ctx.translate(lx + tw / 2, 0);
      if (mirrored) ctx.scale(-1, 1);
      ctx.fillStyle = 'rgba(4, 18, 26, 0.78)';
      ctx.fillRect(-tw / 2, ly, tw, th);
      ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText(label, 0, ly + th / 2 + 0.5 * px);
    }
    ctx.restore();
  };
  return { ctx, W: AW, H: AH, px, box };
}

function drawScanOverlay(g, rois, torso, neck, al) {
  const { ctx, W, H, px, box } = overlayCtx();
  const tpl = state.scan.template;
  ctx.lineWidth = 3 * px;
  ctx.setLineDash([10 * px, 7 * px]);
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
    const names = ['forehead', 'cheek', 'cheek'];
    rois.forEach((b, i) => box(b, '#F2B36B', b.w > 40 * px ? names[i] : ''));
    if (neck && neck.h > 0 && neck.visibleFrac >= 0.8) box(neck, '#9CC3F5', 'neck');
    if (torso && torso.h > 0 && torso.visibleFrac >= 0.75) box(torso, '#9CC3F5', 'chest');
  }
}

$('btnStopScan').addEventListener('click', () => finishScan());

async function finishScan() {
  const s = state.scan;
  if (!s || s.finished) return;
  s.finished = true;
  stopLoop();
  const sess = state.session;
  sess.pulse = estimatePulseRegions(s.regs, estimatePulse(s.pulse));
  sess.eyes = s.eyes.summary();
  sess.eyelid = summarizeLids(s.lids);
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
    ${r?.regionsUsed ? `<p class="fine">Skin regions used: ${r.regionsUsed.map(esc).join(', ')} (${r.regionScores?.filter((x) => x.quality === 'high' || x.quality === 'medium').length ?? 0} of ${r.regionScores?.length ?? 0} gave a clear signal)</p>` : ''}
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
  if (sess.eyes && sess.eyes.trackedPct >= 50 && sess.eyes.blinksPerMin != null) {
    const be = original?.eyes && original.eyes.blinksPerMin != null ? original.eyes : null;
    html += `<div class="card"><h3>Eyes during the scan <span class="tag">EXPERIMENTAL</span></h3>
      <p>${sess.eyes.blinksPerMin} blinks per minute · eyes closed ${sess.eyes.closedPct}% of the time · ${sess.eyes.longClosures} closure${sess.eyes.longClosures === 1 ? '' : 's'} of half a second or longer.${be ? ` Original baseline: ${be.blinksPerMin} blinks per minute, closed ${be.closedPct}%.` : ''}</p>
      <p class="fine">Blink rate swings a lot from minute to minute and person to person, so this is shown, not judged. For a fatigue check, the 3 minute alertness test is more sensitive. <button type="button" class="link-btn" data-evidence="eyes">Evidence</button></p></div>`;
  }
  if (sess.eyelid) {
    const bl = original && original.id !== sess.id ? original.eyelid : null;
    const lc = compareLids(sess.eyelid, bl);
    html += `<div class="card"><h3>Eye opening <span class="tag">EXPERIMENTAL</span></h3>
      <p>${lc.rows.map((r) => `${r.side === 'right' ? 'Right' : 'Left'} eye ${r.today ?? '-'} mm${r.base != null ? ` (baseline ${r.base} mm${r.outside ? ', <strong>different</strong>' : ''})` : ''}`).join(' · ')}</p>
      <p class="${lc.verdict === 'different' ? 'warnline' : 'fine'}">${lc.verdict === 'reference' ? 'Saved with your baseline; later checkups are compared with it.' : lc.verdict === 'different' ? `! An eyelid sits more than ${LID.bandMm} mm higher or lower than at your baseline. Squinting, light and tiredness change this; if it stays, or one lid droops, tell a clinician.` : `Within ${LID.bandMm} mm of your baseline.`}</p>
      <p class="fine">Gap between the lids with eyes open, scaled by an assumed 11.7 mm iris. <button type="button" class="link-btn" data-evidence="lids">Evidence</button></p></div>`;
  }
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
      <thead><tr><th scope="col"><span class="sr-only">Measure</span></th><th scope="col">Today</th><th scope="col">Original baseline<br><span class="fine">${fmtDate(original.createdAt)}</span></th><th scope="col">Last ${recent.length || 0}</th></tr></thead>
      <tbody><tr><th scope="row">Pulse, bpm</th><td>${sess.pulse.bpm ?? '-'}</td><td>${original.pulse?.bpm ?? '-'}</td><td>${range('p', (r) => r.pulse?.bpm)}</td></tr>
      <tr><th scope="row">Breathing, /min</th><td>${sess.resp.rpm ?? '-'}</td><td>${original.resp?.rpm ?? '-'}</td><td>${range('r', (r) => r.resp?.rpm)}</td></tr></tbody></table>
      <p class="fine">The original baseline is kept on purpose, so slow drift never becomes the new normal. No value here is a diagnosis.</p>`;
    const bench = benchError(await listSessions());
    const pf = noiseFloor(bench, 'pulse'), rf = noiseFloor(bench, 'resp');
    const pc = changeVsBaseline(sess.pulse.bpm, original.pulse?.bpm, pf.value);
    const rc = changeVsBaseline(sess.resp.rpm, original.resp?.rpm, rf.value);
    const line = (label, c) => `<li class="${c.kind === 'up' || c.kind === 'down' ? 'warnline' : ''}">${label}: ${esc(c.text)}</li>`;
    const gapMin = (() => { const a = new Date(sess.createdAt), b = new Date(original.createdAt); const g = Math.abs((a.getHours() * 60 + a.getMinutes()) - (b.getHours() * 60 + b.getMinutes())); return Math.min(g, 1440 - g); })();
    html += `<ul class="change-list">${line('Pulse', pc)}${line('Breathing', rc)}</ul>
      ${gapMin > 120 ? `<p class="fine">This checkup is ${Math.round(gapMin / 60)} hours away from your baseline's time of day; pulse varies over the day, so differences are less certain.</p>` : ''}
      <p class="fine">Noise bands from ${esc(pf.source === rf.source ? pf.source : `${pf.source} for pulse, ${rf.source} for breathing`)}. <button type="button" class="link-btn" data-evidence="change">Evidence</button></p>`;
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
  // Face distance: later dental photos are taken at the original baseline's distance, on the same camera.
  const { original } = await baselineAndRecent(state.session.id);
  const od = original?.dental || {};
  const targets = Object.fromEntries(Object.entries(od).filter(([, r]) => r?.captured && r.distScale > 0).map(([k, r]) => [k, r.distScale]));
  const sameCam = !!original && (original.cameraLabel || '') === (state.session.cameraLabel || '') && state.session.source !== 'file';
  state.dental.distTargets = sameCam && Object.keys(targets).length ? targets : null;
  state.dental.distNote = !original || !Object.keys(targets).length ? 'baseline' : sameCam ? 'match' : 'othercam';
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
  $('dentalCoach').textContent = st.msg ? phrase(curLang, `${d.done ? '' : `${d.currentView.label}: `}${st.msg}`) : '';
  if (!d.done) $('dentalCoach').title = d.currentView.hint;
  $('dentalBar').style.width = `${Math.round((st.progress || 0) * 100)}%`;
  dentalDistLine(d);
  drawMouthGuide(lm, st.ok);
  if (st.captured) renderViewSteps();
  if (st.done || d.done) finishDental();
}

let lastDistText = '';
function dentalDistLine(d) {
  let t = '';
  if (d.distNote === 'match' && d.lastRatio != null) {
    const pct = Math.round(Math.abs(d.lastRatio - 1) * 100);
    t = pct <= Math.round(CONFIG.dental.distTol * 100) ? `Distance: matches your baseline photos (within ${Math.round(CONFIG.dental.distTol * 100)}%) ✓` : `Distance: about ${pct}% ${d.lastRatio < 1 ? 'farther from' : 'closer to'} the camera than your baseline photos.`;
  } else if (d.distNote === 'baseline' && d.lastScale) {
    t = `Distance about ${approxDistanceCm(d.lastScale)} cm (rough). These photos set the distance for later dental checks on this camera.`;
  } else if (d.distNote === 'othercam') t = 'A different camera from your baseline, so the face distance cannot be matched. Photos still line up by the mouth corners.';
  if (t !== lastDistText) { lastDistText = t; $('dentalDist').textContent = t; }
}

function drawMouthGuide(lm, ok) {
  const { ctx, W, H, px } = overlayCtx();
  if (!lm) return;
  ctx.setLineDash([8 * px, 6 * px]);
  ctx.lineWidth = 3 * px;
  ctx.strokeStyle = ok ? '#7FE3D4' : '#F2B36B';
  ctx.beginPath();
  LIPS_OUTER.forEach((i, k) => {
    const x = lm[i].x * W, y = lm[i].y * H;
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
    if (hasBase) {
      const auto = document.createElement('div');
      auto.className = 'dental-auto';
      auto.innerHTML = '<p class="fine">Comparing colours with the baseline…</p>';
      box.insertBefore(auto, box.querySelector('.marks'));
      dentalAuto(cmp, auto, today, base).catch((err) => { console.warn(err); auto.innerHTML = '<p class="fine">Automatic comparison could not run on this browser.</p>'; });
    }
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
  if (sess.complete === undefined) sess.complete = sess.kind !== 'baseline' || !!sess.template;
  await saveSession(sess);
  const cmp = await baselineAndRecent(sess.id);
  const alert = (await listSessions()).filter((x) => x.kind === 'alertness'
    && Math.abs(+new Date(x.createdAt) - +new Date(sess.createdAt)) <= 24 * 3600 * 1000).pop() || null;
  let change = null;
  if (cmp.original) {
    const bench = benchError(await listSessions());
    const pf = noiseFloor(bench, 'pulse'), rf = noiseFloor(bench, 'resp');
    change = { pulse: { ...changeVsBaseline(sess.pulse?.bpm, cmp.original.pulse?.bpm, pf.value), band: pf.value, band_source: pf.source },
      breathing: { ...changeVsBaseline(sess.resp?.rpm, cmp.original.resp?.rpm, rf.value), band: rf.value, band_source: rf.source } };
  }
  const visAll = (await listSessions()).filter((x) => x.kind === 'vision' && x.vision);
  const visRec = visAll.filter((x) => Math.abs(+new Date(x.createdAt) - +new Date(sess.createdAt)) <= 7 * 24 * 3600 * 1000).pop() || null;
  const acAll = (await listSessions()).filter((x) => x.kind === 'acuity' && x.acuity);
  const acRec = acAll.filter((x) => Math.abs(+new Date(x.createdAt) - +new Date(sess.createdAt)) <= 14 * 24 * 3600 * 1000).pop() || null;
  const acuity = acRec ? acuityForPacket(acRec, acAll.find((x) => x.acuity.distanceMm === acRec.acuity.distanceMm)) : null;
  const experimental = expForPacket(await listSessions(), { now: new Date(sess.createdAt), includeImages: $('includeImages').checked });
  lastPacket = buildPacket(sess, cmp, { includeImages: $('includeImages').checked, alertness: alert, change, vision: visionForPacket(visRec, visAll[0]), experimental, acuity });
  $('packetText').textContent = packetText(lastPacket.packet);
  renderPacketStatus(sess);
  gzipText(lastPacket.json).then((gz) => {
    lastPacket.gz = gz;
    $('btnDownloadGz').hidden = !gz;
    $('gzNote').textContent = gz ? `Compressed file: ${(gz.length / 1024).toFixed(1)} KB instead of ${(lastPacket.bytes / 1024).toFixed(1)} KB, useful on small satellite data plans.` : '';
  });
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
  const b = benchError(all);
  const row = (label, x, unit) => (x.n ? `<li>${label}: ${x.n} pair${x.n === 1 ? '' : 's'}, mean error ${x.mae} ${unit}, bias ${x.bias > 0 ? '+' : ''}${x.bias} ${unit}${x.n < MIN_BENCH_PAIRS ? ` (${MIN_BENCH_PAIRS - x.n} more to replace the published noise band)` : ' (now used as your noise band)'}</li>` : `<li>${label}: no reference values yet</li>`);
  $('trendBox').innerHTML = trendHtml(all.slice().reverse());
  const sc = symptomCounts(all);
  $('symptomBox').innerHTML = sc.rows.length ? `<div class="card"><h2>Symptoms ticked, last 14 days</h2>
    <p class="fine">Out of ${sc.checkups} checkup${sc.checkups === 1 ? '' : 's'}. A count of what was ticked, not a score.</p>
    <ul class="sym-counts">${sc.rows.map((r) => `<li><span class="sym-n">${r.count}</span> ${esc(r.label)}${r.urgent ? ' <span class="tag alert">URGENT ITEM</span>' : ''}</li>`).join('')}</ul></div>` : '';
  if (navigator.storage?.estimate) navigator.storage.estimate().then((e) => { $('storageNote').textContent = `This browser holds about ${(e.usage / 1048576).toFixed(1)} MB of app data on this device.`; }).catch(() => {});
  $('btnDeleteProfile').hidden = getProfile() === DEFAULT_PROFILE;
  $('benchSummary').innerHTML = `<div class="card"><h2>Your bench test</h2>
    <p>Enter a watch, oximeter or counted breaths reference on the results screen. Once there are ${MIN_BENCH_PAIRS} pairs, comparisons use your own measured error instead of published figures.</p>
    <ul>${row('Pulse', b.pulse, 'bpm')}${row('Breathing', b.resp, '/min')}</ul></div>`;
  const currentOriginal = (await baselineAndRecent()).original?.id;
  const pvtLine = (s) => `<div class="hist-item"><span><strong>alertness</strong> · ${fmtDate(s.createdAt)}</span>
      <span>Median ${s.alertness.medianMs ?? '-'} ms · lapses ${s.alertness.lapses} · false starts ${s.alertness.falseStarts}</span>
      <button type="button" class="link-btn" data-delete-one="${esc(s.id)}">Delete</button></div>`;
  const visLine = (s) => `<div class="hist-item"><span><strong>eye grid</strong> · ${fmtDate(s.createdAt)}</span>
      <span>Right eye: ${esc(amsSummary(s.vision?.right).text)} · Left eye: ${esc(amsSummary(s.vision?.left).text)}</span>
      <button type="button" class="link-btn" data-delete-one="${esc(s.id)}">Delete</button></div>`;
  const acLine = (s) => `<div class="hist-item"><span><strong>eye chart</strong> · ${fmtDate(s.createdAt)} · ${s.acuity.distanceMm / 1000} m</span>
      <span>Right ${esc(s.acuity.right?.snellen ?? '-')} · Left ${esc(s.acuity.left?.snellen ?? '-')}</span>
      <button type="button" class="link-btn" data-delete-one="${esc(s.id)}">Delete</button></div>`;
  const expLine = (s) => `<div class="hist-item"><span><strong>experimental</strong> · ${esc(checkTitle(s.exp.check))} · ${fmtDate(s.createdAt)}</span>
      <span>${s.exp.ok ? 'measured' : `no result: ${esc(s.exp.reason || '')}`}</span>
      <button type="button" class="link-btn" data-delete-one="${esc(s.id)}">Delete</button></div>`;
  $('historyList').innerHTML = all.length ? all.map((s) => s.kind === 'alertness' ? pvtLine(s) : s.kind === 'vision' ? visLine(s) : s.kind === 'exp' && s.exp ? expLine(s) : s.kind === 'acuity' && s.acuity ? acLine(s) : `<div class="hist-item">
      <span><strong>${esc(s.kind)}</strong> · ${fmtDate(s.createdAt)} · ${s.source === 'file' ? 'video file' : 'camera'}</span>
      <span>Pulse ${s.pulse?.bpm ?? '-'} (${s.pulse?.quality ?? 'none'}) · Breathing ${s.resp?.rpm ?? '-'} (${s.resp?.quality ?? 'none'})
      ${s.reference?.pulseBpm ? ` · ref pulse ${s.reference.pulseBpm}` : ''}${s.reference?.breathsPerMin ? ` · ref breathing ${s.reference.breathsPerMin}` : ''}
      · dental ${Object.values(s.dental || {}).filter((d) => d.captured).length}/3${s.context?.checklist?.length ? ` · ticked: ${symptomLabels(s.context.checklist).map(esc).join(', ')}` : ''}</span>
      <button type="button" class="link-btn" data-open-packet="${esc(s.id)}">Packet</button>
      <button type="button" class="link-btn" data-delete-one="${esc(s.id)}">Delete</button>
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
  if (!window.confirm(`Delete every checkup for ${profileName(getProfile())} on this device? Other people's checkups stay. This cannot be undone.`)) return;
  await clearAll();
  renderHistory();
});

/* ---------- sample replay ---------- */
$('btnSample').hidden = !CONFIG.sampleReplay; // shown only when a recording is bundled (see js/config.js)
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
      <p>${c.daysThisWeek >= 3 ? 'Steady rhythm. Regular checkups make real changes easier to spot.' : 'A few checkups a week at the same time of day give the clearest comparison.'}</p>
      <p class="fine">Reminder in your calendar at ${fmtClock(new Date(c.original.createdAt))}: <button type="button" class="link-btn" data-ics="DAILY">daily</button> · <button type="button" class="link-btn" data-ics="WEEKLY">weekly</button></p>`;
  }
  // Sleep form defaults: last saved values, else last night 23:00 to 07:00.
  const saved = prefs.get('sleep');
  const now = new Date();
  const wake = new Date(now); wake.setHours(7, 0, 0, 0); if (wake > now) wake.setDate(wake.getDate() - 1);
  const bed = new Date(+wake - 8 * H_MS);
  // Saved times are reused only while they still describe last night; older entries would make the
  // model show many hours awake that never happened.
  const savedEnd = saved?.end ? +new Date(saved.end) : NaN;
  const fresh = Number.isFinite(savedEnd) && savedEnd <= +now + 60000 && +now - savedEnd < 20 * H_MS;
  $('sleepStart').value = fresh ? saved.start : toLocalInput(bed);
  $('sleepEnd').value = fresh ? saved.end : toLocalInput(wake);
  $('usualSleep').value = saved?.usual ?? '';
  const mission = prefs.get('radMission');
  if (mission) { $('radLeo').value = mission.leoDays ?? 180; $('radTransit').value = mission.transitDays ?? 0; $('radSurface').value = mission.surfaceDays ?? 0; }
  updateSleepTile(); updateRadTile(); renderDaylight(); refreshSpaceWeather(false); renderDelay(); renderEyeTile(); expApi?.renderTile();
  renderAlertTile();
  renderCrewTile();
  renderBedTile();
}

function updateSleepTile() {
  const start = new Date($('sleepStart').value), end = new Date($('sleepEnd').value);
  const usualRaw = $('usualSleep').value;
  prefs.set('sleep', { start: $('sleepStart').value, end: $('sleepEnd').value, usual: usualRaw === '' ? '' : Number(usualRaw) });
  const r = sleepPressure({ sleepStart: start, sleepEnd: end, now: new Date(), usualSleepH: usualRaw === '' ? undefined : Number(usualRaw) });
  const svg = $('sleepChart');
  state.lastSleep = r;
  renderToday();
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
  const m = { leoDays: Number($('radLeo').value) || 0, transitDays: Number($('radTransit').value) || 0, surfaceDays: Number($('radSurface').value) || 0 };
  prefs.set('radMission', m);
  const d = missionDose(m);
  const over = d.fracLow >= 1;
  const pct = (f) => Math.min(100, f * 100);
  const bar = $('radBar');
  bar.classList.toggle('over', over);
  bar.style.left = over ? '0%' : `${pct(d.fracLow)}%`;
  bar.style.width = over ? '100%' : `${Math.max(0.8, pct(d.fracHigh) - pct(d.fracLow))}%`;
  const span = (lo, hi) => (Math.round(lo) === Math.round(hi) ? `${Math.round(lo)}` : `${Math.round(lo)} to ${Math.round(hi)}`);
  const parts = [];
  if (d.leoDays) parts.push(`low Earth orbit ${span(...d.parts.leo)}`);
  if (d.transitDays) parts.push(`transit ${span(...d.parts.transit)}`);
  if (d.surfaceDays) parts.push(`Mars surface ${span(...d.parts.surface)}`);
  const limit = RADIATION.careerLimitMsv;
  const verdict = over ? ` <strong>About ${(d.low / limit).toFixed(1)} times the limit.</strong>`
    : d.fracHigh >= 1 ? ' <strong>The high estimate reaches or passes the limit.</strong>' : '';
  $('radBody').innerHTML = `<p class="big-num">${span(d.low, d.high)}<span class="unit"> mSv</span></p>
    <p>That is ${span(d.fracLow * 100, d.fracHigh * 100)}% of NASA's ${limit} mSv career limit.${verdict}</p>
    ${parts.length > 1 ? `<p class="fine">In mSv: ${parts.join(' · ')}.</p>` : ''}
    ${d.transitDays || d.surfaceDays ? '<p class="fine">Deep space figures were measured by the Curiosity mission\'s RAD instrument in 2011 to 2013, a time of low to moderate solar activity. A large solar particle event would add to them.</p>' : ''}`;
  document.querySelectorAll('#radPresets [data-mission]').forEach((b) => {
    const p = MISSION_PRESETS.find((x) => x.id === b.dataset.mission);
    b.setAttribute('aria-pressed', p && p.leoDays === d.leoDays && p.transitDays === d.transitDays && p.surfaceDays === d.surfaceDays ? 'true' : 'false');
  });
}
$('radPresets').innerHTML = MISSION_PRESETS.map((p) => `<button type="button" class="link-btn" data-mission="${p.id}" aria-pressed="false">${esc(p.label)}</button>`).join(' · ');
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mission]');
  if (!b) return;
  const p = MISSION_PRESETS.find((x) => x.id === b.dataset.mission);
  if (!p) return;
  $('radLeo').value = p.leoDays; $('radTransit').value = p.transitDays; $('radSurface').value = p.surfaceDays;
  updateRadTile();
});
['radLeo', 'radTransit', 'radSurface'].forEach((id) => $(id).addEventListener('input', updateRadTile));

/* ---------- daylight tile ---------- */
$('dayPlace').innerHTML = PLACES.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.lat}°N)</option>`).join('') + '<option value="custom">Other latitude…</option>';
function renderDaylight() {
  const sel = $('dayPlace');
  const savedPlace = prefs.get('dayPlace');
  if (savedPlace && !sel.dataset.ready) { sel.value = [...sel.options].some((o) => o.value === savedPlace.id) ? savedPlace.id : 'iqaluit'; if (savedPlace.lat != null) $('dayLat').value = savedPlace.lat; }
  sel.dataset.ready = '1';
  const custom = sel.value === 'custom';
  $('dayLatWrap').hidden = !custom;
  const place = custom ? { name: `Latitude ${$('dayLat').value}°`, lat: Number($('dayLat').value) } : PLACES.find((p) => p.id === sel.value);
  prefs.set('dayPlace', { id: sel.value, lat: custom ? place.lat : null });
  const now = new Date();
  const d = dayLength(place.lat, now);
  if (!d) { $('dayBody').innerHTML = '<p class="warnline">! Enter a latitude between 89 south (-89) and 89 north.</p>'; return; }
  const mtl = dayLength(45.5, now);
  const big = d.kind === 'polarNight' ? 'Polar night</p><p><strong>The Sun does not rise today.</strong>'
    : d.kind === 'midnightSun' ? 'Midnight sun</p><p><strong>The Sun does not set today.</strong>'
      : `${fmtHours(d.hours)}<span class="unit"> of daylight today</span>`;
  $('dayBody').innerHTML = `<p class="big-num">${big}</p>
    <div class="daybar" role="img" aria-label="${Math.round((d.hours / 24) * 100)} percent of the 24 hours are daylight"><div style="width:${((d.hours / 24) * 100).toFixed(1)}%"></div></div>
    <p>${sel.value === 'montreal' ? '' : `Montreal today: ${fmtHours(mtl.hours)}. `}On the ISS: about ${ISS_SUNRISES_PER_DAY} sunrises and sunsets every 24 hours.</p>
    <p>Light is the body clock's main time signal. Very short days, days with no night and 16 sunrises a day all blur it, which is why station crews live by one fixed clock. A regular checkup time helps for the same reason.</p>`;
}
$('dayPlace').addEventListener('change', renderDaylight);
$('dayLat').addEventListener('input', renderDaylight);

/* ---------- space weather tile (NASA DONKI, loaded on request) ---------- */
const fmtDay = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); };
function spaceWeatherHtml(d, note) {
  const c = d.counts;
  const list = [c.X && `${c.X} X class`, c.M && `${c.M} M class`, c.C && `${c.C} C class`, c.other && `${c.other} weaker`].filter(Boolean).join(', ');
  const head = d.strongest
    ? `<p class="big-num">${esc(d.strongest.cls)}<span class="unit"> strongest solar flare, last 7 days</span></p>
       <p>${d.flares} flare${d.flares === 1 ? '' : 's'} recorded: ${list}. X is the strongest class, then M, then C.${d.strongest.peak ? ` The strongest peaked on ${fmtDay(d.strongest.peak)}.` : ''}</p>`
    : '<p class="big-num">Quiet<span class="unit"> no flares recorded in the last 7 days</span></p>';
  return `${head}
    <p><strong>${d.sepEvents}</strong> solar energetic particle event${d.sepEvents === 1 ? '' : 's'} in the last 30 days${d.lastSep ? ` (latest ${fmtDay(d.lastSep)})` : ''}. Particle events are what raise crew dose beyond Earth's magnetic shield; flares mostly disturb radio.</p>
    ${note ? `<p class="warnline">! ${esc(note)}</p>` : ''}
    <p class="fine">NASA DONKI, read ${fmtDate(d.fetchedAt)} · <button type="button" class="link-btn" data-sw="refresh">Refresh</button></p>`;
}
async function refreshSpaceWeather(force) {
  const body = $('swBody');
  const saved = prefs.get('sw');
  $('swKey').value = prefs.get('swKey') || '';
  if (!force && !prefs.get('swAuto')) {
    body.innerHTML = `<p>Solar flares and particle storms are the fast changing part of the radiation picture.</p>
      <p><button type="button" class="btn primary" data-sw="load">Load live data from NASA</button></p>`;
    return;
  }
  if (!force && isFresh(saved)) { body.innerHTML = spaceWeatherHtml(saved); return; }
  if (!navigator.onLine) {
    body.innerHTML = saved ? spaceWeatherHtml(saved, 'Offline: showing the last saved copy.') : '<p>Offline. Space weather needs internet once; everything else on this board works without it.</p>';
    return;
  }
  body.innerHTML = '<p>Loading from NASA DONKI…</p>';
  try {
    const d = await loadSpaceWeather({ key: prefs.get('swKey') || undefined });
    prefs.set('sw', d); prefs.set('swAuto', true);
    body.innerHTML = spaceWeatherHtml(d);
  } catch (err) {
    const why = err && err.message === 'rate' ? 'NASA\'s shared demonstration key is over its hourly limit. Try later or add your own free key below.'
      : 'Could not reach NASA DONKI (no connection, blocked, or the service is down).';
    body.innerHTML = saved ? spaceWeatherHtml(saved, `${why} Showing the last saved copy.`)
      : `<p class="warnline">! ${esc(why)}</p><p><button type="button" class="btn" data-sw="load">Try again</button></p>`;
  }
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-sw]')) refreshSpaceWeather(true); });
$('swKey').addEventListener('change', (e) => { prefs.set('swKey', e.target.value.trim()); });

$('sleepForm').addEventListener('input', updateSleepTile);

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
  const sameWay = before.filter((x) => !!x.alertness.withEyes === pvt.withEyes).length;
  const practiceNote = pvt.save && sameWay < 3 ? ' Early tests are still affected by practice, so the comparison firms up after about three tests.' : '';
  $('pvtRun').hidden = true; $('pvtIntro').hidden = true; $('pvtResult').hidden = false;
  $('pvtResult').innerHTML = `<div class="card result">
      <p><span class="tag live">LIVE</span><span class="tag">EXPERIMENTAL</span></p>
      <p class="big">${sum.medianMs ?? '-'}<span class="unit"> ms median reaction time</span></p>
      <p>${sum.lapses} lapse${sum.lapses === 1 ? '' : 's'} (355 ms or slower, or missed) · ${sum.falseStarts} false start${sum.falseStarts === 1 ? '' : 's'} · ${sum.valid} of ${sum.stimuli} responses counted</p>
      <p class="${cmp && cmp.verdict === 'slower' ? 'warnline' : 'okline'}">${esc(verdict + practiceNote)}</p>
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

/* ---------- spoken coaching ---------- */
const speaker = makeSpeaker({ synth: window.speechSynthesis, Utterance: window.SpeechSynthesisUtterance });
if (!('speechSynthesis' in window)) { $('speakToggle').disabled = true; $('speakToggle').closest('label').append(' (not available in this browser)'); }
speaker.setEnabled(!!prefs.get('speak'));
$('speakToggle').checked = !!prefs.get('speak');
$('speakToggle').addEventListener('change', (e) => { prefs.set('speak', e.target.checked); speaker.setEnabled(e.target.checked); if (e.target.checked) speaker.say(phrase(curLang, 'Spoken instructions on.')); });
for (const id of ['coach', 'dentalCoach']) {
  new MutationObserver(() => { if (!$(id).closest('.screen').hidden) speaker.say($(id).textContent); })
    .observe($(id), { childList: true, characterData: true, subtree: true });
}

/* ---------- light and dark ---------- */
// Follows the device setting until the person picks one; the choice is remembered.
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('btnTheme').setAttribute('aria-pressed', dark ? 'true' : 'false');
  $('btnTheme').textContent = dark ? 'Light' : 'Dark';
  document.querySelector('meta[name=theme-color]').setAttribute('content', dark ? '#101113' : '#041D2B');
  // Blue logo in light mode, amber logo in dark mode.
  document.querySelector('.brand img').src = dark ? 'icons/logo-64.png' : 'icons/logo-blue-bar-64.png';
  document.querySelector('.hero-logo').src = dark ? 'icons/logo-128.png' : 'icons/logo-blue-128.png';
}
const savedTheme = prefs.get('theme');
applyTheme(savedTheme ? savedTheme === 'dark' : !!(darkQuery && darkQuery.matches));
darkQuery?.addEventListener?.('change', (e) => { if (!prefs.get('theme')) applyTheme(e.matches); });
$('btnTheme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  prefs.set('theme', dark ? 'dark' : 'light');
  applyTheme(dark);
});

/* ---------- restore backup ---------- */
$('restoreFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const parsed = parseBackup(await file.text());
  if (parsed.error) { window.alert(parsed.error); return; }
  const plan = mergePlan(await listSessions(), parsed.sessions);
  if (!plan.toAdd.length) { window.alert(`Nothing new: all ${parsed.sessions.length} checkups in this file are already on this device.`); return; }
  if (!window.confirm(`Add ${plan.toAdd.length} checkup${plan.toAdd.length === 1 ? '' : 's'} from this backup? ${plan.skipped} already here will be kept as they are. Nothing is deleted.`)) return;
  const taken = await allIds();
  for (const x of plan.toAdd) await saveSession({ ...x, profileId: getProfile(), id: taken.has(x.id) ? newId() : x.id });
  $('restoreMsg').textContent = `Restored ${plan.toAdd.length} checkups.`;
  renderHistory();
});

/* ---------- language ---------- */
function setLang(code) {
  const { code: used, notice } = applyLang(code);
  curLang = used;
  speaker.setLang(used === 'fr' ? 'fr-CA' : 'en-CA');
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
      <p>results the day after landing were inside the lab's normal range but outside that person's own pre-flight values. A population range alone would not notice them.</p>
      ${(() => { const il6 = d.analytes.find((x) => x.key === 'il_6'); if (!il6) return ''; const sm = Object.values(summarizeCrew(il6, d.timepoints)).filter(Boolean); const up = sm.filter((v) => v.r1 > v.preMax).length; return `<p><strong>IL-6</strong>, an inflammation marker with no lab range, rose above its own pre-flight values in ${up} of ${sm.length} crew members the day after landing.</p>`; })()}`;
  } catch { /* data file missing: keep the static text */ }
}

async function renderCrew() {
  const d = await loadCrew();
  const sel = $('crewAnalyte');
  if (!sel.options.length) {
    const panels = [...new Set(d.analytes.map((a) => a.panel || 'Comprehensive metabolic panel'))];
    sel.innerHTML = panels.map((pn) => `<optgroup label="${esc(pn)}">${d.analytes.map((a, i) => ((a.panel || 'Comprehensive metabolic panel') === pn
      ? `<option value="${i}">${esc(a.name)} (${esc(a.unit)})</option>` : '')).join('')}</optgroup>`).join('');
    sel.addEventListener('change', drawCrew);
  }
  const r = rangeDisagreements(d);
  $('crewSummary').innerHTML = `Across the ${d.analytes.filter((x) => x.rangeMin != null).length} standard blood tests with a lab range: <strong>${r.normalButUnusual} of ${r.r1Total}</strong> day-after-landing results were "normal" for the population but outside that person's own pre-flight values, and <strong>${r.preOutsideLab} of ${r.preTotal}</strong> pre-flight results (their usual) would already be flagged by the population range. Three pre-flight values is a small baseline, so some of this is ordinary variation.${(() => { const inf = aboveOwnAfterFlight(d); return inf.total ? ` For the ${d.analytes.filter((a) => a.rangeMin == null).length} inflammation markers, which have no lab range at all, <strong>${inf.above} of ${inf.total}</strong> day-after-landing values rose above that person's highest pre-flight value: their own baseline is the only yardstick there is.` : ''; })()}`;
  drawCrew();
}

function drawCrew() {
  const d = crewData;
  const a = d.analytes[Number($('crewAnalyte').value) || 0];
  const sum = summarizeCrew(a, d.timepoints);
  const all = Object.values(a.series).flat().filter((v) => v != null);
  const hasLab = a.rangeMin != null && a.rangeMax != null;
  const lo = hasLab ? Math.min(a.rangeMin, ...all) : Math.min(...all), hi = hasLab ? Math.max(a.rangeMax, ...all) : Math.max(...all);
  const pad = (hi - lo) * 0.12 || 1;
  const yMin = lo - pad, yMax = hi + pad;
  const W = 300, H = 190, L = 44, R = 8, T = 26, B = 30;
  const n = d.timepoints.length;
  const x = (i) => L + (i / (n - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const fmt = compact;
  const flightX = (x(2) + x(3)) / 2;
  $('crewCharts').innerHTML = d.crew.map((c) => {
    const vals = a.series[c];
    const s = sum[c];
    const pts = vals.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    const own = s ? `<rect x="${L}" y="${y(s.preMax).toFixed(1)}" width="${W - L - R}" height="${Math.max(2, y(s.preMin) - y(s.preMax)).toFixed(1)}" class="own"/>` : '';
    const dots = vals.map((v, i) => (v == null ? '' : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4.5" class="${hasLab && (v < a.rangeMin || v > a.rangeMax) ? 'out' : i >= 3 && s && (v < s.preMin || v > s.preMax) ? 'unusual' : 'pt'}"/>`)).join('');
    return `<figure class="crew-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c)} ${esc(a.name)} over time">
      ${hasLab ? `<rect x="${L}" y="${y(a.rangeMax).toFixed(1)}" width="${W - L - R}" height="${(y(a.rangeMin) - y(a.rangeMax)).toFixed(1)}" class="lab"/>` : ''}
      ${own}
      <line x1="${flightX}" x2="${flightX}" y1="${T - 6}" y2="${H - B}" class="flight"/>
      <text x="${flightX}" y="${T - 10}" class="ax" text-anchor="middle">flight</text>
      <polyline points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" class="line"/>
      ${dots}
      <text x="${L - 4}" y="${(y(hasLab ? a.rangeMax : hi) + 4).toFixed(1)}" class="ax" text-anchor="end">${fmt(hasLab ? a.rangeMax : hi)}</text>
      <text x="${L - 4}" y="${(y(hasLab ? a.rangeMin : lo) + 4).toFixed(1)}" class="ax" text-anchor="end">${fmt(hasLab ? a.rangeMin : lo)}</text>
      <text x="${x(0)}" y="${H - 8}" class="ax" text-anchor="start">before</text>
      <text x="${x(n - 1)}" y="${H - 8}" class="ax" text-anchor="end">after</text>
    </svg><figcaption>${esc(c)}${s ? ` · day after landing ${fmt(s.r1)} (${s.pct > 0 ? '+' : ''}${Math.round(s.pct)}% vs own pre-flight)` : ''}</figcaption></figure>`;
  }).join('');
  $('crewTable').innerHTML = `<table><caption class="fine" style="text-align:left">${esc(a.name)}, ${esc(a.unit)}. ${hasLab ? `Lab range ${a.rangeMin} to ${a.rangeMax}.` : 'Research assay: no lab reference range exists, so only each person\'s own pre-flight values can be used.'}</caption>
    <thead><tr><th scope="col">Crew</th><th scope="col">Own pre-flight</th><th scope="col">Day after landing</th><th scope="col">Lab range says</th><th scope="col">Own range says</th></tr></thead>
    <tbody>${d.crew.map((c) => { const s = sum[c]; return s ? `<tr><th scope="row">${esc(c)}</th><td>${fmt(s.preMin)} to ${fmt(s.preMax)}</td><td>${fmt(s.r1)}</td><td>${s.inLab === null ? 'no lab range' : s.inLab ? 'normal' : '<strong>outside</strong>'}</td><td>${s.inOwn ? 'usual' : '<strong>unusual</strong>'}</td></tr>` : `<tr><th scope="row">${esc(c)}</th><td colspan="4">missing</td></tr>`; }).join('')}</tbody></table>
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

/* ---------- today checklist ---------- */
async function renderToday() {
  const all = await listSessions();
  const t = todaySteps({ sessions: all.filter((x) => x.kind !== 'alertness' && x.kind !== 'vision' && x.kind !== 'demo'), alertTests: all.filter((x) => x.kind === 'alertness'), sleep: state.lastSleep });
  $('todayMsg').textContent = t.message;
  $('todayList').innerHTML = t.steps.map((st) => `<li class="${st.done ? 'done' : ''}"><span class="mark-box" aria-hidden="true">${st.done ? '✓' : ''}</span>
    <span>${esc(st.text)}</span>${!st.done && st.nav ? ` <button type="button" class="link-btn" data-nav="${st.nav}">Go</button>` : ''}</li>`).join('');
}

/* ---------- profiles (one shared device, several people) ---------- */
function profiles() {
  const list = prefs.get('profiles');
  const base = Array.isArray(list) && list.length ? list : [{ id: DEFAULT_PROFILE, name: 'Me' }];
  return base.some((p) => p.id === DEFAULT_PROFILE) ? base : [{ id: DEFAULT_PROFILE, name: 'Me' }, ...base];
}
const profileName = (id) => (profiles().find((p) => p.id === id) || { name: 'this person' }).name;

function renderProfileBar() {
  const cur = getProfile();
  $('profileSel').innerHTML = profiles().map((p) => `<option value="${esc(p.id)}"${p.id === cur ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  $('demoBadge').hidden = cur !== DEMO_PROFILE;
}

function switchProfile(id) {
  if (pvt.running) pvtAbort();
  setProfile(id);
  prefs.set('profile', id);
  renderProfileBar();
  const scr = state.screen || 'home';
  show(['scan', 'dental', 'results', 'compare', 'packet'].includes(scr) ? 'home' : scr);
}

$('profileSel').addEventListener('change', (e) => switchProfile(e.target.value));
$('btnAddProfile').addEventListener('click', () => {
  const name = (window.prompt('Name or initials for the new person (stays on this device only):') || '').trim().slice(0, 40);
  if (!name) return;
  const id = `p-${Date.now().toString(36)}`;
  prefs.set('profiles', [...profiles(), { id, name }]);
  switchProfile(id);
});
$('btnDeleteProfile').addEventListener('click', async () => {
  const id = getProfile();
  if (id === DEFAULT_PROFILE) return;
  if (!window.confirm(`Remove ${profileName(id)} and all of their checkups from this device? This cannot be undone.`)) return;
  await clearAll();
  prefs.set('profiles', profiles().filter((p) => p.id !== id));
  switchProfile(DEFAULT_PROFILE);
});

setProfile(profiles().some((p) => p.id === prefs.get('profile')) ? prefs.get('profile') : DEFAULT_PROFILE);
renderProfileBar();

/* ---------- sample data ---------- */
// Fill the sample profile with one scenario. Rebuilt every time so the dates stay recent.
async function loadDemo(scenario = prefs.get('demoScenario') || 'shortsleep') {
  if (!profiles().some((p) => p.id === DEMO_PROFILE)) prefs.set('profiles', [...profiles(), { id: DEMO_PROFILE, name: DEMO_NAME }]);
  setProfile(DEMO_PROFILE);
  await clearAll();
  const now = new Date();
  for (const x of [...makeDemoSessions(now, 42, scenario), ...makeDemoExp(now, scenario)]) await saveSession(x);
  prefs.set('profile', DEMO_PROFILE);
  prefs.set('demoScenario', scenario);
  renderProfileBar();
}
$('btnDemo').addEventListener('click', async () => { await loadDemo(); show('board'); });

/* ---------- trends ---------- */
function trendHtml(sessions) {
  const pts = sessions.filter((x) => x.kind !== 'alertness' && x.kind !== 'demo' && (x.pulse?.bpm != null || x.resp?.rpm != null));
  if (pts.length < 2) return '';
  const original = pts.find((x) => x.kind === 'baseline' && x.isOriginal) || pts.find((x) => x.kind === 'baseline');
  const bench = benchError(sessions);
  const chart = (title, unit, get, qual, floor, base) => {
    const data = pts.map((x) => ({ t: +new Date(x.createdAt), v: get(x), q: qual(x) })).filter((d) => d.v != null);
    if (data.length < 2) return '';
    const W = 600, H = 190, L = 40, R = 10, T = 14, B = 28;
    const t0 = data[0].t, t1 = data[data.length - 1].t || t0 + 1;
    const vals = data.map((d) => d.v).concat(base != null ? [base - floor.value, base + floor.value] : []);
    const lo = Math.floor(Math.min(...vals) - 2), hi = Math.ceil(Math.max(...vals) + 2);
    const x = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const band = base != null ? `<rect x="${L}" y="${y(base + floor.value).toFixed(1)}" width="${W - L - R}" height="${(y(base - floor.value) - y(base + floor.value)).toFixed(1)}" class="band"/>
      <line x1="${L}" x2="${W - R}" y1="${y(base).toFixed(1)}" y2="${y(base).toFixed(1)}" class="baseline"/>` : '';
    const line = data.map((d) => `${x(d.t).toFixed(1)},${y(d.v).toFixed(1)}`).join(' ');
    const dots = data.map((d) => `<circle cx="${x(d.t).toFixed(1)}" cy="${y(d.v).toFixed(1)}" r="5" class="${d.q === 'low' ? 'lowq' : base != null && Math.abs(d.v - base) > floor.value ? 'now' : 'dotpt'}"/>`).join('');
    const fmtD = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
    return `<figure class="trend"><figcaption><strong>${title}</strong> <span class="fine">${unit} · band ±${floor.value} around the original baseline (${esc(floor.source)})</span></figcaption>
      <svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} over time">${band}<polyline points="${line}" class="line"/>${dots}
      <text x="${L - 6}" y="${(y(hi) + 12).toFixed(1)}" class="ax" text-anchor="end">${hi}</text><text x="${L - 6}" y="${y(lo).toFixed(1)}" class="ax" text-anchor="end">${lo}</text>
      <text x="${L}" y="${H - 6}" class="ax">${fmtD(t0)}</text><text x="${W - R}" y="${H - 6}" class="ax" text-anchor="end">${fmtD(t1)}</text></svg></figure>`;
  };
  return `<div class="card"><h2>Trends</h2>
    ${chart('Pulse', 'bpm', (x) => x.pulse?.bpm, (x) => x.pulse?.quality, noiseFloor(bench, 'pulse'), original?.pulse?.bpm ?? null)}
    ${chart('Breathing', 'per minute', (x) => x.resp?.rpm, (x) => x.resp?.quality, noiseFloor(bench, 'resp'), original?.resp?.rpm ?? null)}
    <p class="fine">Red dots sit outside the band, hollow dots were low quality captures. Outside the band means "worth a recheck", not a diagnosis.</p></div>`;
}

/* ---------- practitioner review ---------- */
$('reviewFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let p = null;
  try { p = JSON.parse(await readMaybeGzip(file)); } catch { /* handled below */ }
  const err = p ? validatePacket(p) : 'This file is not valid JSON.';
  $('reviewOut').innerHTML = err ? `<p class="warnline">! ${esc(err)}</p>` : reviewHtml(p) + replyFormHtml();
  if (!err) wireReplyForm(p);
});

function reviewHtml(p) {
  const r = p.results, c = p.comparison || {};
  const ch = c.change_vs_original;
  const chLine = (label, x) => (x ? `<li class="${x.kind === 'up' || x.kind === 'down' ? 'warnline' : ''}">${label}: ${esc(x.text)} <span class="fine">(band ±${esc(x.band)}, ${esc(x.band_source)})</span></li>` : '');
  const when = (iso) => (iso ? fmtDate(iso) : '-');
  const dental = (p.dental || []).map((d) => {
    const img = safeImage(d.image_jpeg_dataurl);
    const marks = (d.reviewer_marks || []).map((m, i) => `<span class="mark" style="left:${(+m.x * 100).toFixed(1)}%;top:${(+m.y * 100).toFixed(1)}%"><span>${i + 1}</span></span>`).join('');
    const au = d.auto_compare;
    const auHtml = au ? `<p class="fine"><strong>Automatic comparison (experimental):</strong> ${au.flags?.length ? au.flags.map(esc).join(' ') : au.comparable ? 'no colour change beyond the set limits.' : 'not compared.'} ${(au.notes || []).map(esc).join(' ')}</p>` : '';
    return `<figure class="review-photo"><figcaption><strong>${esc(d.view)}</strong>: ${d.captured ? 'captured' : 'not captured'}${d.reviewer_marks?.length ? ` · ${d.reviewer_marks.length} mark(s): ${d.reviewer_marks.map((m, i) => `${i + 1}. ${esc(m.note || 'no note')}`).join('; ')}` : ''}</figcaption>
      ${auHtml}${img ? `<div class="cmp review-img"><img src="${img}" alt="${esc(d.view)} dental photo">${marks}</div>` : d.captured ? '<p class="fine">Photo not included in this packet (the sender left images out to keep it small).</p>' : ''}</figure>`;
  }).join('');
  const so = standouts(p);
  const soMark = { urgent: '!', change: '▲', caution: '?', note: '·' };
  const soHtml = `<div class="card standouts"><h2>Read first</h2>${so.length ? `<ul>${so.map((x) => `<li class="so-${x.level}"><span aria-hidden="true">${soMark[x.level]}</span> ${esc(x.text)}</li>`).join('')}</ul>` : '<p>Nothing in this packet is flagged: results sit inside the noise band and nothing was ticked.</p>'}
      <p class="fine">A reading order built from the lines below. Not a score and not a finding.</p></div>`;
  return `${soHtml}<div class="card result">
      <p><span class="tag">${esc(p.checkup.kind)}</span> captured ${when(p.checkup.capturedAt)} · ${esc(p.checkup.source)} · packet ${esc(p.schema)}</p>
      <table><thead><tr><th scope="col"><span class="sr-only">Measure</span></th><th scope="col">This checkup</th><th scope="col">Original baseline${c.original_baseline ? `<br><span class="fine">${when(c.original_baseline.date)}</span>` : ''}</th><th scope="col">Quality</th></tr></thead>
      <tbody><tr><th scope="row">Pulse, bpm</th><td>${r.pulse_bpm.value ?? '-'}</td><td>${c.original_baseline?.pulse_bpm ?? '-'}</td><td>${esc(r.pulse_bpm.quality)} · ${esc(r.pulse_bpm.windows)}</td></tr>
      <tr><th scope="row">Breathing, /min</th><td>${r.breathing_per_min.value ?? '-'}</td><td>${c.original_baseline?.breathing_per_min ?? '-'}</td><td>${esc(r.breathing_per_min.quality)}</td></tr></tbody></table>
      ${ch ? `<ul class="change-list">${chLine('Pulse', ch.pulse)}${chLine('Breathing', ch.breathing)}</ul>` : '<p class="fine">No original baseline in this packet, so no change is assessed.</p>'}
      ${r.pulse_bpm.note ? `<p class="fine">Pulse note: ${esc(r.pulse_bpm.note)}</p>` : ''}${r.breathing_per_min.note ? `<p class="fine">Breathing note: ${esc(r.breathing_per_min.note)}</p>` : ''}
      ${c.recent?.length ? `<p class="fine">Recent: ${c.recent.map((x) => `${when(x.date)} pulse ${x.pulse_bpm ?? '-'}, breathing ${x.breathing_per_min ?? '-'}`).join(' · ')}</p>` : ''}
      ${p.alertness ? `<p><strong>Alertness test</strong> ${when(p.alertness.date)}: median ${esc(p.alertness.median_ms)} ms, ${esc(p.alertness.lapses)} lapses, ${esc(p.alertness.false_starts)} false starts <span class="fine">(${esc(p.alertness.label)})</span></p>` : ''}
      ${p.vision_self_check ? `<p><strong>Eye grid self check</strong> ${when(p.vision_self_check.date)}: right eye ${esc(p.vision_self_check.right_eye)}; left eye ${esc(p.vision_self_check.left_eye)}.${p.vision_self_check.new_vs_reference ? ` <span class="${p.vision_self_check.new_vs_reference.right + p.vision_self_check.new_vs_reference.left ? 'warnline' : ''}">New against the reference of ${when(p.vision_self_check.new_vs_reference.reference_date)}: right ${esc(p.vision_self_check.new_vs_reference.right)}, left ${esc(p.vision_self_check.new_vs_reference.left)} squares.</span>` : ' First check, so nothing to compare with.'} <span class="fine">(${esc(p.vision_self_check.label)})</span></p>` : ''}
      ${p.acuity_self_check ? `<p><strong>Eye chart self check</strong> ${when(p.acuity_self_check.date)} at ${esc(p.acuity_self_check.distance_m)} m: ${['right_eye', 'left_eye'].map((k) => { const e = p.acuity_self_check[k]; return e ? `${k === 'right_eye' ? 'right' : 'left'} ${esc(e.snellen)} (logMAR ${esc(e.logmar)}${e.at_screen_limit ? ', screen limit' : ''}; <span class="${e.vs_first === 'worse' ? 'warnline' : ''}">${esc(e.vs_first)}</span>)` : ''; }).filter(Boolean).join('; ')} <span class="fine">(${esc(p.acuity_self_check.label)}${p.acuity_self_check.screen_calibrated ? '' : '; screen not calibrated'})</span></p>` : ''}
      ${(p.experimental_checks || []).length ? `<h3>Experimental checks</h3><p class="fine">Each compared only with the person's own first check. Not validated, not a diagnosis. The pulse timing and colour indexes are not blood pressure or oxygen saturation.</p><ul>${p.experimental_checks.map((x) => `<li><strong>${esc(x.title)}</strong> ${when(x.date)}: ${Object.entries(x.values || {}).filter(([, v]) => v != null).map(([k, v]) => `${esc(k)} ${esc(v)}`).join(', ')}${x.differs?.length ? ` <span class="warnline">· differs from first check: ${x.differs.map(esc).join(', ')}</span>` : x.verdict === 'reference' ? ' · first check' : ' · no change beyond bands'}${x.images ? `<div class="exp-photos">${Object.entries(x.images).map(([k, src]) => safeImage(src) ? `<figure><img src="${safeImage(src)}" alt="${esc(x.title)} photo (${esc(k)})"><figcaption class="fine">${esc(k)}</figcaption></figure>` : '').join('')}</div>` : ''}</li>`).join('')}</ul>` : ''}
      ${p.self_report_urgent ? `<p class="warnline">! The person ticked chest pain or shortness of breath. ${esc(URGENT_TEXT)}</p>` : ''}
      ${p.self_report_checklist?.length ? `<p><strong>Symptoms ticked:</strong> ${p.self_report_checklist.map(esc).join(', ')}</p>` : ''}
      ${p.self_report ? `<p><strong>Self report:</strong> ${esc(p.self_report)}</p>` : ''}
      <p><strong>Capture:</strong> ${esc(r.capture?.usable_seconds)} usable of ${esc(r.capture?.elapsed_seconds)} seconds.</p>
      ${r.pulse_regions_used ? `<p class="fine">Pulse skin regions used: ${r.pulse_regions_used.map(esc).join(', ')}</p>` : ''}
      ${r.eyes_during_scan ? `<p class="fine">Eyes during the scan: ${esc(r.eyes_during_scan.blinks_per_min)} blinks per minute, closed ${esc(r.eyes_during_scan.closed_pct)}% of the time, ${esc(r.eyes_during_scan.long_closures)} long closures (experimental, shown not judged).</p>` : ''}
    </div>
    ${dental ? `<h2>Dental photos</h2>${dental}` : ''}
    <div class="card"><h2>Not assessed</h2><ul>${(p.not_assessed || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
}

// A sample packet built from the invented demo data, so a reviewer can see the nurse view without a file.
$('btnSamplePacket').addEventListener('click', async () => {
  const demo = makeDemoSessions(new Date());
  const checkups = demo.filter((x) => x.kind !== 'alertness');
  const sess = checkups.at(-1), original = checkups[0];
  const bench = benchError(demo);
  const pf = noiseFloor(bench, 'pulse'), rf = noiseFloor(bench, 'resp');
  const change = { pulse: { ...changeVsBaseline(sess.pulse.bpm, original.pulse.bpm, pf.value), band: pf.value, band_source: pf.source },
    breathing: { ...changeVsBaseline(sess.resp.rpm, original.resp.rpm, rf.value), band: rf.value, band_source: rf.source } };
  const alert = demo.filter((x) => x.kind === 'alertness').at(-1);
  // Drawn (not photographed) sample mouths so the dental part of the nurse view is filled in too.
  const lips = Array.from({ length: 20 }, (_, k) => { const t = (k / 20) * 2 * Math.PI; return [0.5 + 0.31 * Math.cos(t), 0.5 + 0.17 * Math.sin(t)]; });
  const baseImg = drawSampleMouth([178, 98, 104], [232, 226, 210]);
  const todayImg = drawSampleMouth([206, 72, 88], [236, 224, 186]);
  const auto = await sampleDentalAuto(todayImg, baseImg, lips);
  const sessD = { ...sess, dental: { front: { view: 'front', captured: true, image: todayImg, lips, marks: [{ x: 0.42, y: 0.43, note: 'Gum looks redder here (sample)' }], auto } },
    context: { symptoms: 'Slept badly two nights, mild headache. Gums sore when brushing. (Invented sample.)', checklist: ['headache', 'sleep', 'mouth'] } };
  const { packet } = buildPacket(sessD, { original, recent: checkups.slice(-4, -1) }, { alertness: alert, change, includeImages: true, experimental: expForPacket(makeDemoExp(new Date())) });
  $('reviewOut').innerHTML = `<p class="tag pub">SAMPLE PACKET, INVENTED DATA</p>${reviewHtml(packet)}${replyFormHtml()}`;
  wireReplyForm(packet);
});

/* ---------- automatic dental comparison ---------- */
const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
// Shrink the lip outline toward its centre so the mask covers teeth and gums more than the lips themselves.
const innerLips = (lips) => {
  if (!lips || lips.length < 6) return null;
  const cx = lips.reduce((s2, p) => s2 + p[0], 0) / lips.length, cy = lips.reduce((s2, p) => s2 + p[1], 0) / lips.length;
  return lips.map(([x, y]) => [cx + (x - cx) * 0.88, cy + (y - cy) * 0.68]);
};

async function dentalAuto(cmp, out, today, base) {
  const W = 240, H = 135;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const read = async (src) => { ctx.clearRect(0, 0, W, H); ctx.drawImage(await loadImg(src), 0, 0, W, H); return ctx.getImageData(0, 0, W, H).data; };
  const mask = mouthMask(W, H, innerLips(today.lips));
  const A = analyzeMouth(await read(today.image), W, H, mask);
  const B = analyzeMouth(await read(base.image), W, H, mask);
  const r = compareMouth(A, B);
  const cm = changeMap(A.lab, B.lab, mask);
  today.auto = { ...r, changedPct: cm.changedPct, method: 'CIELAB colour of tooth-like and gum-like pixels inside the mouth outline; experimental' };
  saveSession(state.session);
  const row = (label, v, unit = '') => (v == null ? '' : `<li>${label}: ${v > 0 ? '+' : ''}${v}${unit}</li>`);
  out.innerHTML = `<h3>Automatic comparison <span class="tag">EXPERIMENTAL</span></h3>
    ${r.flags.length ? `<ul class="change-list">${r.flags.map((f) => `<li class="warnline">${esc(f)}</li>`).join('')}</ul>` : r.comparable ? '<p class="okline">No colour change beyond the set limits.</p>' : ''}
    ${r.notes.map((n) => `<p class="fine">${esc(n)}</p>`).join('')}
    <ul class="fine">${row('Brightness vs baseline, L*', r.lightingDelta)}${row('Tooth yellowness, b*', r.toothYellowDelta)}${row('Tooth lightness, L*', r.toothLightDelta)}${row('Gum redness, a*', r.gumRedDelta)}${row('Visible tooth area', r.toothAreaChangePct, '%')}<li>Pixels that changed colour clearly: ${cm.changedPct}%</li></ul>
    <label class="check"><input type="checkbox" class="show-map"> Show change map on the photo</label>
    <p class="fine">Colour only, front surfaces only, and light changes colour; this is a prompt to look, not a finding. <button type="button" class="link-btn" data-evidence="dentalAuto">Evidence</button></p>`;
  // Change map overlay, drawn at analysis size and stretched over the photo.
  const ov = document.createElement('canvas'); ov.width = W; ov.height = H; ov.className = 'change-map'; ov.hidden = true;
  const octx = ov.getContext('2d'); const img = octx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) if (cm.map[i]) { img.data[i * 4] = 255; img.data[i * 4 + 1] = 64; img.data[i * 4 + 2] = 160; img.data[i * 4 + 3] = 150; }
  octx.putImageData(img, 0, 0);
  cmp.appendChild(ov);
  out.querySelector('.show-map').addEventListener('change', (e) => { ov.hidden = !e.target.checked; });
}

/* ---------- print ---------- */
document.addEventListener('click', (e) => { if (e.target.closest('[data-print]')) window.print(); });

/* ---------- reviewer reply and compressed packets ---------- */
function replyFormHtml() {
  return `<div class="card"><h2>Reply to the sender</h2>
    <fieldset><legend>Outcome</legend><div class="seg">
      ${Object.entries(REPLY_STATUSES).map(([k, v], i) => `<label><input type="radio" name="replyStatus" value="${k}"${i === 0 ? ' checked' : ''}> ${esc(v)}</label>`).join('')}
    </div></fieldset>
    <label for="replyNote">Note (optional)</label>
    <textarea id="replyNote" rows="2" maxlength="1000" placeholder="For example: pulse a bit higher than usual, recheck tomorrow morning"></textarea>
    <p class="row"><button type="button" class="btn primary" id="btnReply">Download reply (.json)</button></p>
    <p class="fine">The reply is a small file you send back the same way the packet came. Nothing is uploaded.</p></div>`;
}
function wireReplyForm(packet) {
  $('btnReply').addEventListener('click', () => {
    const status = document.querySelector('input[name=replyStatus]:checked').value;
    const reply = makeReply(packet, status, $('replyNote').value);
    download(`relaisecho-reply-${packet.checkup.id}.json`, JSON.stringify(reply, null, 2), 'application/json');
  });
}
function renderPacketStatus(sess) {
  const r = sess.reply;
  $('stAck').className = r ? (r.status === 'ok' ? 'good' : 'warn') : '';
  $('stAck').textContent = r ? 'Acknowledged' : 'Not acknowledged';
  if (r) { $('stSent').className = 'good'; $('stSent').textContent = 'Sent'; }
  $('replyBox').innerHTML = r ? `<div class="card"><p><strong>${esc(r.status_text)}</strong> · reviewed ${fmtDate(r.reviewed_at)}</p>${r.note ? `<p>${esc(r.note)}</p>` : ''}</div>` : '';
}
$('btnDownloadGz').addEventListener('click', () => {
  if (!lastPacket?.gz) return;
  const url = URL.createObjectURL(new Blob([lastPacket.gz], { type: 'application/gzip' }));
  const a = document.createElement('a'); a.href = url; a.download = `relaisecho-packet-${state.session.id}.json.gz`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('replyFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let r = null;
  try { r = JSON.parse(await file.text()); } catch { /* handled below */ }
  const v = validateReply(r, await listSessions());
  if (v.error) { window.alert(v.error); return; }
  v.session.reply = r;
  await saveSession(v.session);
  if (state.session && state.session.id === v.session.id) state.session.reply = r;
  renderPacketStatus(v.session);
});
// Tour links on the home page.
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tour]');
  if (!t) return;
  if (t.dataset.tour === 'demo') $('btnDemo').click();
  if (t.dataset.tour === 'packet') { show('review'); $('btnSamplePacket').click(); }
});

/* ---------- calendar reminder, photo clean-up, larger text ---------- */
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-ics]');
  if (!b) return;
  const { original } = await baselineAndRecent();
  if (!original) return;
  const at = new Date(original.createdAt), start = new Date();
  start.setHours(at.getHours(), at.getMinutes(), 0, 0);
  if (start < new Date()) start.setDate(start.getDate() + 1);
  download(`relaisecho-reminder-${b.dataset.ics.toLowerCase()}.ics`, reminderIcs({ start, freq: b.dataset.ics }), 'text/calendar');
});
$('btnStripPhotos').addEventListener('click', async () => {
  const changed = stripOldPhotos(await listSessions(), 30);
  if (!changed.length) { window.alert('No photos older than 30 days (the original baseline always keeps its photos).'); return; }
  if (!window.confirm(`Remove dental photos from ${changed.length} checkup${changed.length === 1 ? '' : 's'} older than 30 days? Results stay; the original baseline keeps its photos.`)) return;
  for (const x of changed) await saveSession(x);
  renderHistory();
});
// Text size: five steps, like browser zoom on the page (the camera layers stay full screen).
const TEXT_STEPS = [0.85, 1, 1.15, 1.3, 1.5];
function applyTextSize(step) {
  const i = Math.max(0, Math.min(TEXT_STEPS.length - 1, Number.isInteger(step) ? step : 1));
  document.documentElement.style.setProperty('--page-zoom', TEXT_STEPS[i]);
  document.documentElement.classList.toggle('big-text', i >= 3);
  $('btnTextDown').disabled = i === 0; $('btnTextUp').disabled = i === TEXT_STEPS.length - 1;
  $('btnTextReset').setAttribute('aria-pressed', i === 1 ? 'true' : 'false');
  $('textSizeNote').textContent = `Text size ${Math.round(TEXT_STEPS[i] * 100)} percent`;
  prefs.set('textStep', i);
  return i;
}
const textStep = () => { const v = prefs.get('textStep'); return Number.isInteger(v) ? v : prefs.get('bigText') ? 3 : 1; };
$('btnTextDown').addEventListener('click', () => applyTextSize(textStep() - 1));
$('btnTextUp').addEventListener('click', () => applyTextSize(textStep() + 1));
$('btnTextReset').addEventListener('click', () => applyTextSize(1));
applyTextSize(textStep());

$('btnResultsCsv').addEventListener('click', async () => { download('relaisecho-results.csv', resultsCsv(await listSessions()), 'text/csv'); });

// A simple drawn mouth: dark mouth opening, gum band, a row of teeth, lips around.
function drawSampleMouth(gum, tooth) {
  const W = 960, H = 540, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(196,150,128)'; x.fillRect(0, 0, W, H);                       // skin
  x.fillStyle = 'rgb(170,92,96)'; x.beginPath(); x.ellipse(W / 2, H / 2, 0.33 * W, 0.2 * H, 0, 0, Math.PI * 2); x.fill(); // lips
  x.fillStyle = 'rgb(40,18,20)'; x.beginPath(); x.ellipse(W / 2, H / 2, 0.29 * W, 0.15 * H, 0, 0, Math.PI * 2); x.fill(); // opening
  x.save(); x.beginPath(); x.ellipse(W / 2, H / 2, 0.29 * W, 0.15 * H, 0, 0, Math.PI * 2); x.clip();
  x.fillStyle = `rgb(${gum.join(',')})`; x.fillRect(0, H / 2 - 0.15 * H, W, 0.06 * H);   // gums
  x.fillStyle = `rgb(${tooth.join(',')})`;
  for (let i = -5; i <= 5; i++) x.fillRect(W / 2 + i * 0.05 * W - 0.022 * W, H / 2 - 0.09 * H, 0.044 * W, 0.12 * H); // teeth
  x.restore();
  return c.toDataURL('image/jpeg', 0.85);
}
async function sampleDentalAuto(todaySrc, baseSrc, lips) {
  const W = 240, H = 135, c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const read = async (src) => { ctx.clearRect(0, 0, W, H); ctx.drawImage(await loadImg(src), 0, 0, W, H); return ctx.getImageData(0, 0, W, H).data; };
  const mask = mouthMask(W, H, innerLips(lips));
  const A = analyzeMouth(await read(todaySrc), W, H, mask), B = analyzeMouth(await read(baseSrc), W, H, mask);
  return { ...compareMouth(A, B), changedPct: changeMap(A.lab, B.lab, mask).changedPct };
}

// Reopen the review packet of any past checkup from History.
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-open-packet]');
  if (!b) return;
  const sess = (await listSessions()).find((x) => x.id === b.dataset.openPacket);
  if (!sess) return;
  state.session = sess;
  await renderPacket();
  show('packet');
});

// Delete one record. Deleting the original baseline is allowed but warned about, since comparisons depend on it.
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-delete-one]');
  if (!b) return;
  const all = await listSessions();
  const sess = all.find((x) => x.id === b.dataset.deleteOne);
  if (!sess) return;
  const { original } = await baselineAndRecent();
  const isOrig = original && original.id === sess.id;
  const msg = isOrig
    ? 'This is your original baseline. Every comparison uses it. Delete it anyway? The next baseline (if any) becomes the reference.'
    : `Delete this ${sess.kind} from ${fmtDate(sess.createdAt)}? This cannot be undone.`;
  if (!window.confirm(msg)) return;
  await deleteSession(sess.id);
  renderHistory();
});


$('btnCrewCsv').addEventListener('click', () => {
  if (!crewData) return;
  const a = crewData.analytes[Number($('crewAnalyte').value) || 0];
  const rows = [['crew', ...crewData.timepoints, 'lab_range_min', 'lab_range_max', 'unit'].join(',')];
  for (const c of crewData.crew) rows.push([c, ...a.series[c].map((v) => (v == null ? '' : v)), a.rangeMin ?? '', a.rangeMax ?? '', a.unit].join(','));
  download(`osd575-${a.key}.csv`, `# ${a.name}. Source: NASA OSDR OSD-575, doi 10.26030/mc5d-p710\n${rows.join('\n')}\n`, 'text/csv');
});

/* ---------- device check ---------- */
function devEnv() {
  let webgl2 = false;
  try { webgl2 = !!document.createElement('canvas').getContext('webgl2'); } catch { webgl2 = false; }
  return {
    secure: window.isSecureContext, getUserMedia: !!navigator.mediaDevices?.getUserMedia, wasm: typeof WebAssembly === 'object',
    indexedDb: 'indexedDB' in window, webgl2, rvfc: 'requestVideoFrameCallback' in HTMLVideoElement.prototype,
    serviceWorker: 'serviceWorker' in navigator, compression: 'CompressionStream' in window, speech: 'speechSynthesis' in window,
  };
}
async function devMeta() {
  const m = { version: $('appVersion').textContent, when: fmtDate(new Date().toISOString()), userAgent: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height} at ${window.devicePixelRatio || 1}x`, cores: navigator.hardwareConcurrency, memoryGb: navigator.deviceMemory, online: navigator.onLine };
  try {
    const keys = await caches.keys();
    m.cache = keys.join(', ') || 'none';
    m.modelCached = !!(await caches.match(MODEL_URLS.remote)) || !!(await caches.match(MODEL_URLS.local));
  } catch { m.cache = 'not available'; }
  try { const e = await navigator.storage.estimate(); m.storage = `${((e.quota - e.usage) / 1073741824).toFixed(1)} GB free`; } catch { /* not reported by this browser */ }
  return m;
}
function devPaint() {
  const list = verdicts(dev.r, CONFIG);
  const mark = { ok: '✓', warn: '!', fail: '✕' };
  const cls = { ok: 'okline', warn: 'warnline', fail: 'warnline' };
  const tested = dev.r.camera || dev.r.cameraError;
  const head = !list.length ? '' : overall(list) === 'ok' ? '<li class="okline">✓ This device can run a checkup.</li>'
    : overall(list) === 'warn' ? '<li class="warnline">! This device can run a checkup, with the cautions below.</li>'
      : '<li class="warnline">✕ Something needed for a live checkup is missing or too slow. See below.</li>';
  $('devVerdict').innerHTML = `${tested ? head : ''}${list.map((v) => `<li class="${cls[v.level]}">${mark[v.level]} ${esc(v.text)}</li>`).join('')}
    ${tested ? '' : '<li class="plain">– Camera not tested yet. Press "Test the camera" above.</li>'}`;
  $('devReport').textContent = reportText(dev.r, list, dev.meta);
}
async function renderDevice() {
  dev.r = { env: devEnv() };
  $('devStatus').textContent = '';
  $('devCopied').textContent = '';
  $('devBasics').innerHTML = featureList(dev.r.env).map((f) => `<li class="${f.ok ? 'okline' : f.need === 'nice' ? 'plain' : 'warnline'}">${f.ok ? '✓' : f.need === 'nice' ? '–' : '!'} ${esc(f.label)}${f.ok ? '' : `: ${esc(f.ifMissing)}`}</li>`).join('');
  devPaint();
  dev.meta = await devMeta();
  $('devMeta').textContent = `${dev.meta.online ? 'Online' : 'Offline'} · offline copy: ${dev.meta.cache} · face model ${dev.meta.modelCached ? 'saved on this device' : 'not saved yet (downloads on the first scan)'}${dev.meta.storage ? ` · ${dev.meta.storage}` : ''}`;
  devPaint();
}
function devStop() {
  dev.token = null; dev.running = false;
  if (dev.stream) { dev.stream.getTracks().forEach((t) => t.stop()); dev.stream = null; }
  const v = $('devVideo');
  if (v) { v.pause(); v.srcObject = null; v.hidden = true; }
}
// Calls fn(timeMs, index) for each camera frame during `ms` milliseconds, then resolves.
function devFrames(v, ms, alive, fn) {
  return new Promise((res) => {
    const rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    const start = performance.now();
    let i = 0, done = false;
    const finish = () => { if (!done) { done = true; res(); } };
    const step = () => {
      if (done) return;
      if (!alive()) return finish();
      const t = performance.now();
      try { fn(t, i); } catch (err) { console.error(err); }
      i += 1;
      if (t - start >= ms) return finish();
      next();
    };
    const next = () => (rvfc ? v.requestVideoFrameCallback(step) : requestAnimationFrame(step));
    next();
    setTimeout(finish, ms + 4000); // a camera that never delivers a frame must not hang the test
  });
}
async function devCameraTest() {
  if (dev.running) return;
  dev.running = true;
  const token = {}; dev.token = token;
  const alive = () => dev.token === token;
  const say = (t) => { $('devStatus').textContent = t; };
  dev.r = { env: dev.r.env };
  devPaint();
  const v = $('devVideo');
  try {
    say('Opening the camera…');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: CONFIG.perf.cameraFps } }, audio: false });
    if (!alive()) { stream.getTracks().forEach((t) => t.stop()); return; }
    dev.stream = stream;
    v.srcObject = stream; v.muted = true; v.playsInline = true; v.hidden = false;
    await waitForDims(v);
    await v.play();
    const settings = stream.getVideoTracks()[0]?.getSettings?.() || {};
    say('Measuring the camera frame rate and brightness…');
    const c = document.createElement('canvas'); c.width = 64; c.height = 36;
    const cx = c.getContext('2d', { willReadFrequently: true });
    const times = [], lumas = [];
    await devFrames(v, 2500, alive, (t, i) => {
      times.push(t);
      if (i % 8 !== 0) return;
      cx.drawImage(v, 0, 0, 64, 36);
      const d = cx.getImageData(0, 0, 64, 36).data;
      let sum = 0;
      for (let k = 0; k < d.length; k += 4) sum += 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
      lumas.push(sum / (d.length / 4));
    });
    if (!alive()) return;
    const f = fpsFromTimes(times);
    dev.r.camera = { width: v.videoWidth, height: v.videoHeight, reportedFps: settings.frameRate ? Math.round(settings.frameRate) : null, fps: f.fps, seconds: f.seconds, luma: median(lumas) };
    devPaint();
    say('Loading the face model (the first time needs internet and can take a minute)…');
    const t0 = performance.now();
    let lm = null;
    try {
      lm = await getFaceLandmarker();
      dev.r.model = { ok: true, seconds: +((performance.now() - t0) / 1000).toFixed(1), source: getModelSource(), delegate: getDelegate() };
    } catch (err) { dev.r.model = { ok: false, error: err.message || String(err) }; }
    if (!alive()) return;
    devPaint();
    if (lm) {
      say('Timing face tracking…');
      const ms = [], tt = [];
      let found = 0;
      await devFrames(v, 2500, alive, (t) => {
        const a = performance.now();
        const face = detect(lm, v);
        ms.push(performance.now() - a);
        if (face) found += 1;
        tt.push(t);
      });
      if (!alive()) return;
      const steady = ms.length > 6 ? ms.slice(3) : ms; // the first detections include one-off start up work
      dev.r.track = { medianMs: median(steady) ?? 0, fps: fpsFromTimes(tt).fps, facePct: ms.length ? (100 * found) / ms.length : 0 };
    }
    say('Done. The camera is off again.');
  } catch (err) {
    const name = err && err.name;
    dev.r.cameraError = name === 'NotAllowedError' ? 'permission was denied. Allow the camera for this site (the camera icon in the address bar), then test again.'
      : name === 'NotFoundError' ? 'no camera was found on this device.'
        : name === 'NotReadableError' ? 'the camera is in use by another app, such as a video call or the Camera app. Close it and test again.'
          : `could not start (${(err && err.message) || err}).`;
    say('The camera test stopped.');
  } finally {
    if (alive()) { devStop(); devPaint(); }
  }
}
$('btnDevCam').addEventListener('click', devCameraTest);
$('btnDevCopy').addEventListener('click', async () => {
  const text = $('devReport').textContent;
  try { await navigator.clipboard.writeText(text); $('devCopied').textContent = 'Copied. Paste it into a message.'; }
  catch {
    const range = document.createRange(); range.selectNodeContents($('devReport'));
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    $('devCopied').textContent = 'Could not copy by itself. The report is selected: press Ctrl+C (or Cmd+C).';
  }
});
$('btnDevSave').addEventListener('click', () => download('relaisecho-device-report.txt', $('devReport').textContent, 'text/plain'));

/* ---------- demo reel: 30 seconds, captioned, on the sample data ---------- */
const reel = { on: false, t0: 0, tick: null, idx: -1, timers: [], recorder: null, prevProfile: null };
const reelLater = (ms, fn) => { reel.timers.push(setTimeout(() => { if (reel.on) fn(); }, ms)); };
function reelScroll(sel, block = 'start') {
  const el = document.querySelector(sel);
  if (!el) return;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block });
}
function reelCard(html) { const c = $('reelCard'); c.hidden = !html; c.innerHTML = html || ''; }
const REEL_TITLE = `<div><img src="icons/logo-blue-128.png" alt=""><h2>RelaisÉcho Link</h2><p>A guided camera checkup, compared with your own baseline</p><p>NASA Space Apps Challenge 2026 · Montreal</p></div>`;
const REEL_END = `<div><img src="icons/logo-blue-128.png" alt=""><h2>RelaisÉcho Link</h2><p>Runs in the browser. Works offline. Video never leaves the device.</p><p>Research prototype, not a diagnostic device. Sample data shown.</p></div>`;
const REEL_ACTIONS = {
  title: () => { show('home'); reelCard(REEL_TITLE); },
  setup: () => { reelCard(null); show('setup'); reelLater(1700, () => reelScroll('#symptomTicks', 'center')); },
  board: () => { show('board'); reelLater(2300, () => reelScroll('#h-t-sleep')); },
  space: () => {
    document.querySelector('[data-mission="mars"]')?.click();
    reelScroll('#h-t-rad');
    reelLater(2600, () => reelScroll('#h-t-crew'));
  },
  history: () => { show('history'); reelLater(1900, () => reelScroll('#symptomBox', 'center')); },
  packet: () => { show('review'); $('btnSamplePacket').click(); reelLater(2400, () => reelScroll('.review-photo', 'center')); },
  end: () => { reelCard(REEL_END); },
};
function reelFrame() {
  if (!reel.on) return;
  const t = (performance.now() - reel.t0) / 1000;
  const total = reelTotal();
  $('reelProg').style.width = `${Math.min(100, (t / total) * 100).toFixed(2)}%`;
  // An in-app recording stops just before the 30 second mark, so the saved video never runs over.
  if (reel.recorder && reel.recorder.state === 'recording' && t >= total - 0.15) { try { reel.recorder.stop(); } catch { /* already stopped */ } }
  const at = sceneAt(t);
  if (!at) { reelFinish(); return; }
  if (at.index !== reel.idx) {
    reel.idx = at.index;
    $('reelCaption').textContent = at.scene.caption;
    try { REEL_ACTIONS[at.scene.id]?.(); } catch (err) { console.error(err); }
  }
}
async function reelLoadSample() {
  reel.prevProfile = getProfile();
  reel.prevMission = prefs.get('radMission');
  if (!profiles().some((p) => p.id === DEMO_PROFILE)) prefs.set('profiles', [...profiles(), { id: DEMO_PROFILE, name: DEMO_NAME }]);
  await loadDemo('shortsleep');
}
// countdown: seconds of "start your recorder" before the first scene (0 when the app records by itself).
async function reelStart({ countdown = 3, onBegin = null } = {}) {
  if (reel.on) return;
  reel.on = true; reel.idx = -1;
  await reelLoadSample();
  if (!reel.on) return;
  document.body.classList.add('reel-on');
  $('reelLayer').hidden = false;
  $('reelProg').style.width = '0%';
  $('reelCaption').textContent = countdown ? 'Start your screen recorder now. Press Esc to stop.' : '';
  for (let n = countdown; n > 0 && reel.on; n -= 1) {
    reelCard(`<div><p>The 30 second demo starts in</p><p class="reel-count">${n}</p></div>`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!reel.on) return;
  if (onBegin) onBegin();
  reel.t0 = performance.now();
  reelFrame();
  reel.tick = setInterval(reelFrame, 100);
}
// Called when the 30 seconds are over: the closing card stays up so a recording ends cleanly.
function reelFinish() {
  clearInterval(reel.tick); reel.tick = null;
  $('reelProg').style.width = '100%';
  reel.timers.push(setTimeout(() => {
    if (!reel.on) return;
    reelCard(`${REEL_END.replace('</div>', '')}<div class="row"><button type="button" class="btn primary" data-reel="again">Play again</button><button type="button" class="btn" data-reel="close">Close</button></div></div>`);
    $('reelCaption').textContent = '';
  }, 3000));
}
function reelStop() {
  if (!reel.on) return;
  reel.on = false;
  clearInterval(reel.tick); reel.tick = null;
  reel.timers.forEach(clearTimeout); reel.timers = [];
  const rec = reel.recorder;
  if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* already stopped */ } }
  reelCard(null);
  $('reelLayer').hidden = true;
  document.body.classList.remove('reel-on');
  // Put back what the reel changed: the person's own profile and their radiation mission.
  if (reel.prevMission) prefs.set('radMission', reel.prevMission);
  if (reel.prevProfile && reel.prevProfile !== getProfile()) { setProfile(reel.prevProfile); prefs.set('profile', reel.prevProfile); renderProfileBar(); }
  show('home');
}
// Records this tab while the reel plays and saves the video. The browser asks which tab to share.
async function reelRecord() {
  const note = $('reelNote');
  const type = window.MediaRecorder ? pickRecordingType((t) => MediaRecorder.isTypeSupported(t)) : null;
  if (!type || !navigator.mediaDevices?.getDisplayMedia) {
    note.textContent = 'This browser cannot record its own tab. Play the demo and use your screen recorder instead (Windows: Win+Alt+R, Mac: Shift+Cmd+5).';
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 }, cursor: 'never' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
  } catch {
    note.textContent = 'Recording was not started (sharing was cancelled or blocked). You can still play the demo and use your own screen recorder.';
    return;
  }
  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: type.mimeType, videoBitsPerSecond: 5_000_000 });
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    reel.recorder = null;
    const blob = new Blob(chunks, { type: type.mimeType.split(';')[0] });
    if (blob.size) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `relaisecho-link-demo-30s.${type.ext}`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      note.textContent = `Saved relaisecho-link-demo-30s.${type.ext} (${(blob.size / 1048576).toFixed(1)} MB). Watch it once before you upload it.`;
    } else note.textContent = 'The recording came out empty. Play the demo and use your own screen recorder instead.';
  };
  stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (rec.state !== 'inactive') rec.stop(); }); // the person pressed "Stop sharing"
  reel.recorder = rec;
  note.textContent = 'Recording…';
  await reelStart({ countdown: 0, onBegin: () => rec.start(1000) });
  if (!reel.on && rec.state === 'inactive') { stream.getTracks().forEach((t) => t.stop()); reel.recorder = null; } // stopped before it began
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-reel]');
  if (!b) return;
  const what = b.dataset.reel;
  if (what === 'play') reelStart();
  if (what === 'record') reelRecord();
  if (what === 'srt') download('relaisecho-link-demo-captions.srt', reelSrt(), 'application/x-subrip');
  if (what === 'again') { reelStop(); reelStart(); }
  if (what === 'close') reelStop();
});
$('reelStop').addEventListener('click', reelStop);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && reel.on) reelStop(); });
if (new URLSearchParams(location.search).has('reel')) reelStart();

/* ---------- signal delay tile ---------- */
function renderDelay() {
  const now = new Date();
  const d = earthMars(now), c = marsCycle(now);
  const span = c.max.oneWaySec - c.min.oneWaySec;
  const pos = span > 0 ? Math.max(0, Math.min(100, ((d.oneWaySec - c.min.oneWaySec) / span) * 100)) : 50;
  const mon = (x) => x.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
  const day = (x) => x.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  const inPause = c.conjunction && +c.conjunction.start - +now < 86400000;
  $('delayBody').innerHTML = `<p class="big-num">${fmtDelay(d.oneWaySec)}</p>
    <p>for a signal from Earth to Mars today, one way.</p>
    <div class="delaybar" role="img" aria-label="Today's delay sits ${Math.round(pos)} percent of the way from the shortest to the longest of this cycle"><div style="left:${pos.toFixed(1)}%"></div></div>
    <p class="fine delay-ends"><span>shortest ${fmtDelay(c.min.oneWaySec)} · ${mon(c.min.date)}</span><span>longest ${fmtDelay(c.max.oneWaySec)} · ${mon(c.max.date)}</span></p>
    <p>A question and its answer take at least <strong>${fmtDelay(2 * d.oneWaySec)}</strong> across ${Math.round(d.km / 1e6)} million km. To the Moon it is ${fmtDelay(moonOneWaySec())} each way.</p>
    ${c.conjunction ? `<p>${inPause ? 'Now' : `From about ${day(c.conjunction.start)}`}, Mars passes behind the Sun as seen from Earth. NASA stops sending commands to its Mars spacecraft for about two weeks each time.</p>` : ''}
    <p>Nobody can coach a checkup live across that gap. So the app coaches, checks the capture and packs the result by itself, and the reviewer answers later. The same design fits a clinic that is a flight away, or a connection that is down.</p>`;
}

/* ---------- eye grid (Amsler) ---------- */
const vis = { step: 'intro', eye: 'right', cells: { right: new Set(), left: new Set() }, cursor: Math.floor(AMS_N / 2) * AMS_N + Math.floor(AMS_N / 2), size: null, paint: null };
// Page zoom from the text size buttons: true sizes (mm) must be divided by it, because the page is scaled.
const pageZoom = () => Number(getComputedStyle(document.documentElement).getPropertyValue('--page-zoom')) || 1;
const visPxPerMm = () => { const v = Number(prefs.get('pxPerMm')); return v >= 2 && v <= 12 ? v : DEFAULT_PX_PER_MM; };
const visRecords = async () => (await listSessions()).filter((x) => x.kind === 'vision' && x.vision);
function visGridSvg(size, cells, { ref = [], cursor = null, fresh = [] } = {}) {
  const c = size.cellPx, w = size.sizePx;
  const rect = (cell, cls) => `<rect class="${cls}" x="${(cell % AMS_N) * c + 1}" y="${Math.floor(cell / AMS_N) * c + 1}" width="${c - 2}" height="${c - 2}"/>`;
  let h = '';
  for (let i = 1; i < AMS_N; i += 1) h += `<line x1="${i * c}" y1="0" x2="${i * c}" y2="${w}"/><line x1="0" y1="${i * c}" x2="${w}" y2="${i * c}"/>`;
  h += [...cells].map((x) => rect(x, 'vis-mark')).join('') + ref.map((x) => rect(x, 'vis-ref')).join('');
  h += `<circle cx="${w / 2}" cy="${w / 2}" r="${Math.max(3, c * 0.22)}" fill="#000"/>`;
  if (cursor != null) h += rect(cursor, 'vis-cursor');
  return h;
}
function visDraw() {
  const g = $('visGrid'), size = vis.size;
  g.setAttribute('width', size.sizePx); g.setAttribute('height', size.sizePx); g.setAttribute('viewBox', `0 0 ${size.sizePx} ${size.sizePx}`);
  g.innerHTML = visGridSvg(size, vis.cells[vis.eye], { cursor: document.activeElement === g ? vis.cursor : null });
  const sum = amsSummary([...vis.cells[vis.eye]]);
  g.setAttribute('aria-label', `Grid for the ${vis.eye} eye, ${AMS_N} by ${AMS_N} squares. ${sum.text}.`);
  $('visCount').textContent = sum.count ? `${sum.text[0].toUpperCase()}${sum.text.slice(1)}.` : 'Nothing marked yet. If every line looks straight and complete, press "Done with this eye".';
}
function visReset() {
  vis.step = 'intro'; vis.eye = 'right'; vis.cells = { right: new Set(), left: new Set() }; vis.paint = null;
  $('visIntro').hidden = false; $('visRun').hidden = true; $('visResult').hidden = true;
  const ppm = visPxPerMm();
  $('visScale').value = ppm;
  $('visCard').style.width = `${((CARD_MM * ppm) / pageZoom()).toFixed(1)}px`;
  $('visCalNote').textContent = prefs.get('pxPerMm') ? 'A saved size is in use on this device.' : 'Using the default size. On phones and some laptops the grid then comes out smaller or larger than 10 cm.';
}
function visEye(eye) {
  vis.step = 'run'; vis.eye = eye;
  vis.cursor = Math.floor(AMS_N / 2) * AMS_N + Math.floor(AMS_N / 2); // the keyboard cursor starts beside the centre dot for each eye
  $('visIntro').hidden = true; $('visResult').hidden = true; $('visRun').hidden = false;
  const wrap = $('visGridWrap');
  vis.size = gridSize(visPxPerMm() / pageZoom(), Math.min(wrap.clientWidth || 320, window.innerHeight / pageZoom() - 40) - 8);
  const other = eye === 'right' ? 'left' : 'right';
  $('visEyeTitle').textContent = `${eye === 'right' ? 'Right' : 'Left'} eye: cover your ${other} eye`;
  $('visEyeHelp').textContent = `Hold the screen about ${vis.size.readCm} cm from your eye. Look only at the dot in the middle. Without moving your eye, mark any squares where the lines look wavy, blurred, dim or missing.`;
  $('visSizeNote').textContent = vis.size.trueSize ? `Grid ${vis.size.mm} mm wide${prefs.get('pxPerMm') ? '' : ' if this screen uses standard pixels (not calibrated)'}.`
    : `This screen fits a ${vis.size.mm} mm grid instead of 100 mm, so the distance is shortened to match.`;
  $('btnVisNext').textContent = eye === 'right' ? 'Done with this eye' : 'Done, show the result';
  visDraw();
  $('visEyeTitle').focus({ preventScroll: true });
  wrap.scrollIntoView({ block: 'center' });
}
function visCellAt(e) {
  const r = $('visGrid').getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) / r.width) * AMS_N), y = Math.floor(((e.clientY - r.top) / r.height) * AMS_N);
  return x < 0 || y < 0 || x >= AMS_N || y >= AMS_N ? null : y * AMS_N + x;
}
function visSet(cell, on) { const set = vis.cells[vis.eye]; if (on) set.add(cell); else set.delete(cell); }
$('visGrid').addEventListener('pointerdown', (e) => {
  const cell = visCellAt(e);
  if (cell == null) return;
  e.preventDefault();
  vis.paint = !vis.cells[vis.eye].has(cell); // the first square decides whether this stroke marks or clears
  vis.cursor = cell;
  visSet(cell, vis.paint);
  try { $('visGrid').setPointerCapture(e.pointerId); } catch { /* not supported */ }
  visDraw();
});
$('visGrid').addEventListener('pointermove', (e) => {
  if (vis.paint == null) return;
  const cell = visCellAt(e);
  if (cell == null || vis.cells[vis.eye].has(cell) === vis.paint) return;
  visSet(cell, vis.paint);
  visDraw();
});
['pointerup', 'pointercancel'].forEach((t) => $('visGrid').addEventListener(t, () => { vis.paint = null; }));
$('visGrid').addEventListener('keydown', (e) => {
  const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -AMS_N, ArrowDown: AMS_N }[e.key];
  if (move) {
    const col = vis.cursor % AMS_N;
    if ((e.key === 'ArrowLeft' && col === 0) || (e.key === 'ArrowRight' && col === AMS_N - 1)) { e.preventDefault(); return; }
    const next = vis.cursor + move;
    if (next >= 0 && next < AMS_N * AMS_N) vis.cursor = next;
    e.preventDefault(); visDraw();
  } else if (e.key === ' ' || e.key === 'Enter') {
    visSet(vis.cursor, !vis.cells[vis.eye].has(vis.cursor));
    e.preventDefault(); visDraw();
  }
});
$('visGrid').addEventListener('focus', visDraw);
$('visGrid').addEventListener('blur', visDraw);
$('btnVisClear').addEventListener('click', () => { vis.cells[vis.eye].clear(); visDraw(); });
$('btnVisStart').addEventListener('click', () => visEye('right'));
$('btnVisNext').addEventListener('click', () => { if (vis.eye === 'right') visEye('left'); else visFinish(); });
$('visScale').addEventListener('input', (e) => { $('visCard').style.width = `${((CARD_MM * Number(e.target.value)) / pageZoom()).toFixed(1)}px`; });
$('btnVisCal').addEventListener('click', () => { prefs.set('pxPerMm', Number($('visScale').value)); $('visCalNote').textContent = 'Saved. The grid is now drawn at true size where the screen is large enough.'; });
$('btnVisCalReset').addEventListener('click', () => { prefs.set('pxPerMm', null); visReset(); });
async function visFinish() {
  const before = await visRecords();
  const refRec = before[0] || null;
  const rec = { id: newId(), createdAt: new Date().toISOString(), kind: 'vision', source: 'device', complete: false,
    vision: { right: cleanCells([...vis.cells.right]), left: cleanCells([...vis.cells.left]), squares: AMS_N, mm: vis.size.mm, readCm: vis.size.readCm, trueSize: vis.size.trueSize, calibrated: !!prefs.get('pxPerMm') } };
  await saveSession(rec);
  vis.step = 'result';
  $('visRun').hidden = true; $('visResult').hidden = false;
  const small = gridSize(visPxPerMm() * 0.5, 240);
  const eyeHtml = (eye) => {
    const cmp = compareEye(rec.vision[eye], refRec ? refRec.vision[eye] : null);
    const refCells = refRec ? cleanCells(refRec.vision[eye]) : [];
    return `<figure><figcaption>${eye === 'right' ? 'Right' : 'Left'} eye</figcaption>
      <svg class="vis-grid" width="${small.sizePx}" height="${small.sizePx}" viewBox="0 0 ${small.sizePx} ${small.sizePx}" role="img" aria-label="${eye} eye grid: ${esc(cmp.text)}">${visGridSvg(small, rec.vision[eye], { ref: refCells })}</svg>
      <p class="${cmp.verdict === 'new' ? 'warnline' : ''}">${cmp.verdict === 'new' ? '! ' : ''}${esc(cmp.line)}</p></figure>`;
  };
  const anyNew = refRec && (compareEye(rec.vision.right, refRec.vision.right).verdict === 'new' || compareEye(rec.vision.left, refRec.vision.left).verdict === 'new');
  $('visResult').innerHTML = `<div class="card result">
      <p><span class="tag">EXPERIMENTAL</span> <span class="tag">SHOWN, NOT JUDGED</span></p>
      <div class="vis-pair">${eyeHtml('right')}${eyeHtml('left')}</div>
      <p class="fine">Pink squares: marked today.${refRec ? ` Dashed outlines: marked in your reference check of ${fmtDate(refRec.createdAt)}.` : ''}</p>
      ${anyNew ? '<p>New marks can come from a different distance, lighting or tiredness. Repeat the check once, the same way as your reference. If the new marks stay, tell your clinician or flight surgeon; if the change was sudden, treat it as urgent.</p>' : ''}
      <p class="fine">Saved on this device${refRec ? '' : ' as your reference'}. The latest check from the last 7 days is added to your next review packet as counts, not as a picture.</p>
      <div class="row"><button type="button" class="btn primary" data-nav="board">Back to the board</button><button type="button" class="btn" data-nav="vision">Check again</button></div>
    </div>`;
  $('visResult').scrollIntoView({ block: 'start' });
}
async function renderEyeTile() {
  const recs = await visRecords();
  const body = $('eyeBody');
  const acLine = await acTileLine();
  if (!recs.length) {
    body.innerHTML = `<p>A one minute per eye grid check and a letter chart. On the ISS, crew vision checks include an Amsler grid and a visual acuity chart, because spaceflight can change the back of the eye.</p>
      <p><button type="button" class="btn primary" data-nav="vision">Do the eye grid</button> <button type="button" class="btn" data-nav="acuity">Eye chart</button></p>${acLine}`;
    return;
  }
  const last = recs[recs.length - 1], ref = recs.length > 1 ? recs[0] : null;
  const r = compareEye(last.vision.right, ref ? ref.vision.right : null), l = compareEye(last.vision.left, ref ? ref.vision.left : null);
  const fresh = r.fresh.length + l.fresh.length;
  body.innerHTML = `<p class="big-num">${r.count + l.count}<span class="unit"> square${r.count + l.count === 1 ? '' : 's'} marked, both eyes</span></p>
    <p>Right eye ${r.count} · left eye ${l.count} · ${fmtDate(last.createdAt)}</p>
    <p class="${fresh ? 'warnline' : 'okline'}">${!ref ? 'This is your reference check.' : fresh ? `! ${fresh} square${fresh === 1 ? '' : 's'} marked that ${fresh === 1 ? 'was' : 'were'} clear in your reference. Repeat the check; if it stays, tell your clinician.` : '✓ No new marks against your reference.'}</p>
    <p><button type="button" class="btn" data-nav="vision">Check again</button> <button type="button" class="btn" data-nav="acuity">Eye chart</button></p>${acLine}`;
}

/* ---------- your data ---------- */
async function renderPrivacy() {
  const inv = inventory(await everySession(), getProfile());
  const list = (c) => `<ul>${inventoryLines(c).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  let usage = '';
  try { const e = await navigator.storage.estimate(); usage = `<p class="fine">In total the browser holds about ${fmtBytes(e.usage)} for this app, including the offline copy and the face model.</p>`; } catch { /* not reported */ }
  $('privInventory').innerHTML = `<h3>${esc(profileName(getProfile()))}</h3>${list(inv.mine)}
    ${inv.people > 1 ? `<h3>Everyone on this device (${inv.people} people)</h3>${list(inv.device)}` : ''}
    ${inv.device.sample ? `<p class="fine">${inv.device.sample} of these records are invented sample data.</p>` : ''}
    <p class="fine">Also kept: your settings (language, theme, text size, sleep times, mission days, people's names) and, if you loaded it, the last space weather answer. Names never go into a packet.</p>${usage}`;
  $('privExports').innerHTML = EXPORTS.map((x) => `<li>${esc(x)}</li>`).join('');
  $('privNetwork').innerHTML = `<table><thead><tr><th scope="col">From</th><th scope="col">What</th><th scope="col">When</th></tr></thead><tbody>${NETWORK.map((n) => `<tr><th scope="row">${esc(n.host)}</th><td>${esc(n.what)}</td><td>${esc(n.when)}</td></tr>`).join('')}</tbody></table>`;
  $('privNever').innerHTML = NEVER.map((x) => `<li>${esc(x)}</li>`).join('');
  $('privNote').textContent = '';
}
$('btnPrivBackup').addEventListener('click', async () => {
  download('relaisecho-all-checkups.json', JSON.stringify(await listSessions(), null, 2), 'application/json');
  $('privNote').textContent = 'Backup saved for the person chosen above. It holds health information: keep it somewhere private and never put it in a public repository.';
});
$('btnErase').addEventListener('click', async () => {
  if (!window.confirm('Erase every person\'s checkups, photos, settings and the offline copy from this device? This cannot be undone.')) return;
  $('privNote').textContent = 'Erasing…';
  try {
    stopSource(); devStop();
    await eraseDatabase();
    Object.keys(localStorage).filter((k) => k.startsWith('re.')).forEach((k) => localStorage.removeItem(k));
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  } catch (err) { console.error(err); }
  window.location.replace(window.location.pathname);
});

/* ---------- camera choice ---------- */
async function refreshCameraList() {
  const wrap = $('camPickWrap');
  try {
    const c = cameraOptions(await navigator.mediaDevices.enumerateDevices(), prefs.get('camId') || '');
    $('camPick').innerHTML = c.options.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('');
    $('camPick').value = c.chosen;
    wrap.hidden = !c.show || document.querySelector('input[name=source]:checked')?.value === 'file';
  } catch { wrap.hidden = true; }
}
$('camPick').addEventListener('change', (e) => prefs.set('camId', e.target.value));
document.querySelectorAll('input[name=source]').forEach((r) => r.addEventListener('change', refreshCameraList));

/* ---------- experimental checks (js/expui.js) ---------- */
expApi = initExp({ $, esc, fmtDate, state, acan, actx, startSource, stopSource, ensureModel, startLoop, stopLoop, moveStage, detect,
  saveSession, listSessions, newId, download, openEvidence, sourceError, overlayCtx });
if (state.screen === 'board') expApi.renderTile();


/* ---------- overview: everything on one screen ---------- */
const ovState = { region: null, metric: null };
function sleepLastNight() {
  const sv = prefs.get('sleep');
  if (!sv?.start || !sv?.end) return null;
  const start = +new Date(sv.start), end = +new Date(sv.end), now = Date.now();
  if (!(end > start) || end > now + 60000 || now - end > 20 * H_MS) return null;
  return Math.round(((end - start) / H_MS) * 10) / 10;
}
const OV_WORD = { urgent: 'urgent tick', review: 'look again', logged: 'logged', none: 'not measured' };
const OV_GO = { pulse: ['setup', 'Start a checkup'], resp: ['setup', 'Start a checkup'], gum: ['setup', 'Start a checkup'], alert: ['alertness', 'Do the reaction test'],
  eyegrid: ['vision', 'Do the eye grid'], gaze: ['exp', 'Open experimental checks'], pupil: ['exp', 'Open experimental checks'], pallor: ['exp', 'Open experimental checks'],
  jaw: ['exp', 'Open experimental checks'], tremor: ['exp', 'Open experimental checks'], ptt: ['exp', 'Open experimental checks'], ror: ['exp', 'Open experimental checks'] };
let ovCache = null;
async function renderOverview() {
  const all = await listSessions();
  const { original } = await baselineAndRecent();
  const bench = benchError(all);
  const floors = { pulse: noiseFloor(bench, 'pulse').value, resp: noiseFloor(bench, 'resp').value };
  const checkups = all.filter((s) => (s.kind === 'baseline' || s.kind === 'followup') && (s.pulse || s.resp));
  const lastC = checkups.at(-1) || null;
  const sleepH = sleepLastNight();
  const regions = buildRegions(all, { original, floors, sleepHours: sleepH, latestChecklist: lastC?.context?.checklist || [] });
  ovCache = { all, original, floors, regions };
  if (!ovState.region || !regions.some((r) => r.id === ovState.region)) {
    ovState.region = (regions.find((r) => r.status === 'urgent') || regions.find((r) => r.status === 'review') || regions.find((r) => r.id === 'heart')).id;
    ovState.metric = null;
  }
  drawOvBody();
  // Mission clock and scenario picker
  const mc = prefs.get('missionClock');
  const md = mc ? missionDay(mc.start, mc.length) : null;
  $('ovMission').innerHTML = !md ? '<p class="fine">No mission clock set.</p>'
    : md.phase === 'before' ? `<p>Mission starts in ${md.daysToGo} day${md.daysToGo === 1 ? '' : 's'} (${md.length} days long)</p>`
      : md.phase === 'after' ? `<p>Mission ended ${md.daysSince} day${md.daysSince === 1 ? '' : 's'} ago (${md.length} days)</p>`
        : `<p>Mission day ${md.day} of ${md.length}</p><div class="meter" role="img" aria-label="${Math.round(md.pct * 100)} percent of the mission done"><div style="transform:scaleX(${md.pct.toFixed(3)})"></div></div>`;
  if (mc) { $('ovStart').value = mc.start; $('ovLen').value = mc.length; }
  const cur = getProfile() === DEMO_PROFILE ? prefs.get('demoScenario') || 'shortsleep' : 'shortsleep';
  $('ovScenario').innerHTML = SCENARIOS.map((x) => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${esc(x.label)}</option>`).join('');
  $('ovScenario').title = (SCENARIOS.find((x) => x.id === cur) || SCENARIOS[0]).line;
  // Headline numbers
  const kpi = (k, v, unit, sub, warn) => `<div class="ov-kpi"><p class="k">${k}</p><p class="v">${v ?? '-'}${v != null && unit ? ` <small>${unit}</small>` : ''}</p><p class="s${warn ? ' warn' : ''}">${sub}</p></div>`;
  const ch = (val, base, floor) => (val == null ? null : changeVsBaseline(val, base, floor));
  const pc = ch(lastC?.pulse?.bpm, original?.pulse?.bpm, floors.pulse), rc = ch(lastC?.resp?.rpm, original?.resp?.rpm, floors.resp);
  const word = (c) => (!c ? 'No checkup yet' : c.kind === 'up' ? 'Above your baseline band' : c.kind === 'down' ? 'Below your baseline band' : c.kind === 'noise' ? 'Within your baseline band' : 'First checkup');
  const tests = all.filter((x) => x.kind === 'alertness' && x.alertness);
  const lastT = tests.at(-1), firstT = tests[0];
  const slower = lastT && firstT && lastT !== firstT && lastT.alertness.medianMs > firstT.alertness.medianMs * 1.1;
  $('ovKpis').innerHTML = kpi('Pulse', lastC?.pulse?.bpm, 'bpm', word(pc), pc && (pc.kind === 'up' || pc.kind === 'down'))
    + kpi('Breathing', lastC?.resp?.rpm, '/min', word(rc), rc && (rc.kind === 'up' || rc.kind === 'down'))
    + kpi('Reaction', lastT?.alertness.medianMs, 'ms', !lastT ? 'No test yet' : tests.length < 2 ? 'First test' : slower ? 'Over 10% slower than first' : 'Within 10% of first', slower)
    + kpi('Sleep', sleepH, 'h', sleepH == null ? 'Enter last night on the Board' : sleepH < 6 ? 'Under 6 h last night' : 'Last night', sleepH != null && sleepH < 6);
  drawOvChart();
  // What to look at, and the next step
  const flagged = regions.filter((r) => r.reasons.length).sort((a, b) => (a.status === 'urgent' ? -1 : 0) - (b.status === 'urgent' ? -1 : 0));
  const t = todaySteps({ sessions: all.filter((x) => x.kind !== 'alertness' && x.kind !== 'vision' && x.kind !== 'demo'), alertTests: tests, sleep: state.lastSleep });
  const next = t.steps.find((st) => !st.done);
  $('ovNext').innerHTML = `<h2>${flagged.length ? 'Look here first' : 'Nothing stands out'}</h2>
    ${flagged.length ? `<ul>${flagged.slice(0, 4).map((r) => `<li class="${r.status === 'urgent' ? 'warnline' : ''}"><button type="button" class="link-btn ov-jump" data-ov-region="${r.id}">${esc(r.label)}</button>: ${r.reasons.slice(0, 2).map(esc).join('; ')}${r.reasons.length > 2 ? ` and ${r.reasons.length - 2} more` : ''}</li>`).join('')}${flagged.length > 4 ? `<li>${flagged.length - 4} more region${flagged.length - 4 === 1 ? '' : 's'} on the chart</li>` : ''}</ul>` : '<p>Everything measured sits inside its band against your own first value.</p>'}
    ${flagged.some((r) => r.status === 'urgent') ? `<p class="warnline">! ${esc(URGENT_TEXT)}</p>` : ''}
    ${next ? `<p><strong>Next step:</strong> ${esc(next.text)} ${next.nav ? `<button type="button" class="link-btn" data-nav="${next.nav}">Go</button>` : ''}</p>` : ''}
    <p class="fine">A reading order, not a diagnosis. Bands are design choices.</p>`;
}
function drawOvBody() {
  const { regions } = ovCache;
  const pts = regions.map((r) => `${r.id === ovState.region ? `<circle class="ov-pt-ring" cx="${r.dot[0]}" cy="${r.dot[1]}" r="14"/>` : ''}<circle class="ov-pt ${r.status}" cx="${r.dot[0]}" cy="${r.dot[1]}" r="8"/>`).join('');
  $('ovBody').innerHTML = BODY_SVG.replace('</svg>', `${pts}</svg>`) + '<svg class="ov-leaders" aria-hidden="true"></svg>' + regions.map((r) => `<button type="button" class="ov-reg ${r.side}" style="top:${r.y}%" data-ov-region="${r.id}" aria-pressed="${r.id === ovState.region}" title="${esc(r.label)}"><span class="ov-dot ${r.status}" aria-hidden="true"></span><span>${esc(r.short || r.label)}<span class="sr-only">${r.short && r.short !== r.label ? ` (${esc(r.label)})` : ''}, ${OV_WORD[r.status]}</span></span></button>`).join('');
  drawOvLeaders();
}
// Thin lines from each label to its dot on the figure, recomputed when the layout changes.
function drawOvLeaders() {
  const box = $('ovBody'), fig = box.querySelector('.ov-body-fig'), svg = box.querySelector('.ov-leaders');
  if (!fig || !svg || !ovCache) return;
  const b = box.getBoundingClientRect(), f = fig.getBoundingClientRect();
  if (!b.width || !f.height) return;
  const z = b.width / box.offsetWidth || 1; // page zoom from the text size buttons
  const k = f.height / 460;
  svg.setAttribute('viewBox', `0 0 ${b.width / z} ${b.height / z}`);
  svg.innerHTML = ovCache.regions.map((r) => {
    const el = box.querySelector(`[data-ov-region="${r.id}"]`);
    if (!el) return '';
    const e = el.getBoundingClientRect();
    const x1 = ((r.side === 'left' ? e.right : e.left) - b.left) / z, y1 = (e.top + e.height / 2 - b.top) / z;
    const x2 = (f.left - b.left + r.dot[0] * k) / z, y2 = (f.top - b.top + r.dot[1] * k) / z;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${r.id === ovState.region ? 'on' : ''}"/>`;
  }).join('');
}
if (window.ResizeObserver) new ResizeObserver(() => { if (state.screen === 'overview') drawOvLeaders(); }).observe($('ovBody'));
function drawOvChart() {
  const { all, original, floors, regions } = ovCache;
  const r = regions.find((x) => x.id === ovState.region);
  $('ovRegionName').textContent = r.label;
  if (!r.metrics.length) {
    $('ovMetric').hidden = true;
    const neck = all.filter((s) => s.kind === 'exp' && s.exp?.check === 'neck' && s.exp.ok);
    const last = neck.at(-1), first = neck[0];
    const img = (src, cap) => (safeImage(src) ? `<figure><img src="${safeImage(src)}" alt="${esc(cap)}"><figcaption class="fine">${esc(cap)}</figcaption></figure>` : '');
    $('ovChartTitle').textContent = 'Neck photos';
    $('ovChart').innerHTML = last ? `<div class="ov-photos">${img(last.exp.images?.during || last.exp.images?.before, `Latest, ${fmtDate(last.createdAt)}`)}${first !== last ? img(first.exp.images?.during || first.exp.images?.before, `First check, ${fmtDate(first.createdAt)}`) : ''}</div>`
      : '<div class="ov-empty"><div><p>No neck check yet. It saves photos only, so there is no graph.</p><button type="button" class="btn" data-nav="exp">Open experimental checks</button></div></div>';
    $('ovChartNote').textContent = 'Photos for a reviewer to compare; the app looks for nothing in them.';
    $('ovValues').innerHTML = '';
    return;
  }
  $('ovMetric').hidden = false;
  const withData = r.metrics.filter((m) => seriesFor(m, all).length);
  const flaggedM = withData.find((m) => { const p = seriesFor(m, all), rf = referenceFor(m, p, { original, floors }); const v = p.at(-1).v; return rf && rf.band != null && (p.length > 1 || ['pulse', 'resp', 'gum'].includes(m)) && Math.abs(v - rf.base) > rf.band; });
  if (!ovState.metric || !r.metrics.includes(ovState.metric)) ovState.metric = flaggedM || withData[0] || r.metrics[0];
  $('ovMetric').innerHTML = r.metrics.map((m) => `<option value="${m}" ${m === ovState.metric ? 'selected' : ''}>${esc(METRIC_DEFS[m].label)}${withData.includes(m) ? '' : ' (no data)'}</option>`).join('');
  const def = METRIC_DEFS[ovState.metric];
  const pts = seriesFor(ovState.metric, all);
  const ref = referenceFor(ovState.metric, pts, { original, floors });
  $('ovChartTitle').textContent = `${def.label}${def.unit && def.unit !== 'index' ? `, ${def.unit}` : ''}`;
  if (!pts.length) {
    const go = OV_GO[ovState.metric];
    $('ovChart').innerHTML = `<div class="ov-empty"><div><p>No values yet.</p>${go ? `<button type="button" class="btn" data-nav="${go[0]}">${go[1]}</button>` : ''}</div></div>`;
    $('ovChartNote').textContent = ''; $('ovValues').innerHTML = '';
    return;
  }
  $('ovChart').innerHTML = lineChart(pts, { unit: def.unit, ref, title: def.label });
  const exp = def.src.startsWith('exp:');
  $('ovChartNote').textContent = `${pts.length} value${pts.length === 1 ? '' : 's'}${ref ? ` · line: ${ref.label}${ref.band ? `, shaded band ±${Math.round(ref.band * 100) / 100}` : ''}` : ' · no baseline yet'}${exp ? ' · experimental' : ''}. Red dots sit outside the band; hollow dots were low quality captures.`;
  $('ovValues').innerHTML = `<table><thead><tr><th scope="col">Date</th><th scope="col">${esc(def.label)}</th></tr></thead><tbody>${pts.slice().reverse().map((p) => `<tr><td>${fmtDate(new Date(p.t).toISOString())}</td><td>${p.v}${def.unit && def.unit !== 'index' ? ` ${esc(def.unit)}` : ''}</td></tr>`).join('')}</tbody></table>`;
}
$('screen-overview').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ov-region]');
  if (!b || !ovCache) return;
  ovState.region = b.dataset.ovRegion; ovState.metric = null;
  drawOvBody(); drawOvChart();
  $('ovBody').querySelector(`[data-ov-region="${ovState.region}"]`)?.focus();
});
$('ovMetric').addEventListener('change', (e) => { ovState.metric = e.target.value; drawOvChart(); });

$('btnOvScenario').addEventListener('click', async () => {
  const id = $('ovScenario').value;
  await loadDemo(id);
  ovState.region = null; ovState.metric = null;
  await renderOverview();
  $('restoreMsg').textContent = `Sample scenario loaded: ${(SCENARIOS.find((x) => x.id === id) || {}).label}. ${(SCENARIOS.find((x) => x.id === id) || {}).line}`;
});
$('btnOvClock').addEventListener('click', () => {
  const start = $('ovStart').value, length = Number($('ovLen').value);
  if (!start || !missionDay(start, length)) { $('ovLen').focus(); return; }
  prefs.set('missionClock', { start, length });
  renderOverview();
});
$('btnOvClockClear').addEventListener('click', () => { prefs.set('missionClock', null); $('ovStart').value = ''; $('ovLen').value = ''; renderOverview(); });
$('btnOvPrint').addEventListener('click', () => window.print());

/* ---------- eye chart (tumbling E, js/acuity.js) ---------- */
const ac = { eye: 'right', run: null, res: {}, dist: 1000, ppm: DEFAULT_PX_PER_MM, floor: 0, startT: 0 };
const acRecords = async () => (await listSessions()).filter((x) => x.kind === 'acuity' && x.acuity);
const acRefFor = (list, rec) => list.find((x) => x.id !== rec.id && x.acuity.distanceMm === rec.acuity.distanceMm) || null;
function acLimitText() {
  ac.dist = Number(document.querySelector('input[name=acDist]:checked')?.value) || 1000;
  ac.ppm = visPxPerMm();
  ac.floor = floorLogmar(ac.ppm, ac.dist);
  const cal = !!prefs.get('pxPerMm');
  $('acLimit').textContent = ac.floor == null ? 'This screen is too small for the chart at this distance; choose a longer distance.'
    : `At ${ac.dist / 1000} m this screen can draw letters down to logMAR ${ac.floor.toFixed(1)} (${snellen(ac.floor)}).${ac.floor > 0 ? ' Normal adult vision is often better than that, so a perfect score here means "at least this good", not 20/20.' : ''}${cal ? '' : ' Screen not calibrated: sizes assume a standard desktop pixel.'}`;
  $('btnAcStart').disabled = ac.floor == null;
}
function acReset() {
  const saved = Number(prefs.get('acDist')) || 1000;
  $('acDistSet').innerHTML = '<legend>Your eyes\' distance from the screen</legend>' + ACUITY.distancesMm.map((d) => `<label><input type="radio" name="acDist" value="${d}" ${d === saved ? 'checked' : ''}> ${d / 1000} m${d === 400 ? ' (phone in hand)' : d === 1000 ? ' (laptop, arm out plus a bit)' : ' (across a small room; a helper presses the answers)'}</label>`).join('');
  $('acIntro').hidden = false; $('acRun').hidden = true; $('acResult').hidden = true;
  ac.res = {}; ac.run = null;
  acLimitText();
}
$('acDistSet').addEventListener('change', () => { prefs.set('acDist', Number(document.querySelector('input[name=acDist]:checked').value)); acLimitText(); });
function acEye(eye) {
  ac.eye = eye;
  ac.run = new AcuityRun(ac.floor);
  $('acIntro').hidden = true; $('acResult').hidden = true; $('acRun').hidden = false;
  $('acEyeTitle').textContent = `${eye === 'right' ? 'Right' : 'Left'} eye: cover your ${eye === 'right' ? 'left' : 'right'} eye with your palm`;
  acDraw();
  $('acEyeTitle').focus({ preventScroll: true });
  $('acStage').scrollIntoView({ block: 'center' });
}
const AC_ROT = { right: 0, down: 90, left: 180, up: 270 };
function acDraw() {
  const r = ac.run;
  const px = Math.max(ACUITY.minPx, Math.round((optoMm(r.logmar, ac.dist) * ac.ppm) / pageZoom()));
  const e = $('acE');
  e.setAttribute('width', px); e.setAttribute('height', px);
  $('acEg').setAttribute('transform', `rotate(${AC_ROT[r.target]} 2.5 2.5)`);
  $('acProgress').textContent = `Line ${r.lines.indexOf(r.logmar) + 1} of ${r.lines.length} · letter ${r.pos + 1} of ${ACUITY.perLine}`;
}
function acAnswer(dir) {
  if (!ac.run || ac.run.done || $('acRun').hidden) return;
  ac.run.answer(dir);
  if (!ac.run.done) { acDraw(); return; }
  ac.res[ac.eye] = ac.run.score();
  if (ac.eye === 'right') acEye('left'); else acFinish();
}
$('acRun').addEventListener('click', (e) => { const b = e.target.closest('[data-ac]'); if (b) acAnswer(b.dataset.ac); });
document.addEventListener('keydown', (e) => {
  if (state.screen !== 'acuity' || $('acRun').hidden) return;
  const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ' ': 'nope' }[e.key];
  if (k) { e.preventDefault(); acAnswer(k); }
});
async function acFinish() {
  const rec = { id: newId(), createdAt: new Date().toISOString(), kind: 'acuity', source: 'device', complete: false,
    acuity: { right: ac.res.right, left: ac.res.left, distanceMm: ac.dist, pxPerMm: Math.round(ac.ppm * 100) / 100, calibrated: !!prefs.get('pxPerMm'), floor: ac.floor } };
  await saveSession(rec);
  const list = await acRecords();
  const ref = acRefFor(list, rec);
  $('acRun').hidden = true; $('acResult').hidden = false;
  const eyeRow = (e) => {
    const t = rec.acuity[e], c = compareAcuity(t, ref?.acuity?.[e]);
    const vs = c.verdict === 'reference' ? 'first check at this distance' : c.verdict === 'worse' ? `${Math.abs(c.lines)} lines worse than your first check` : c.verdict === 'better' ? `${Math.abs(c.lines)} lines better than your first check` : 'within 2 lines of your first check';
    return `<tr><th scope="row">${e === 'right' ? 'Right' : 'Left'} eye</th><td>${t.logmar.toFixed(2)}</td><td>${esc(t.snellen)}${t.atScreenLimit ? ' or better (screen limit)' : ''}</td><td class="${c.verdict === 'worse' ? 'warnline' : ''}">${vs}</td></tr>`;
  };
  const worse = ['right', 'left'].some((e) => compareAcuity(rec.acuity[e], ref?.acuity?.[e]).verdict === 'worse');
  $('acResult').innerHTML = `<div class="card result"><p><span class="tag">EXPERIMENTAL</span> <span class="tag">SHOWN, NOT JUDGED</span></p>
    <h2>Eye chart result</h2>
    <table><thead><tr><th scope="col">Eye</th><th scope="col">logMAR</th><th scope="col">Snellen</th><th scope="col">Against your first check</th></tr></thead><tbody>${eyeRow('right')}${eyeRow('left')}</tbody></table>
    <p class="fine">logMAR: 0 is 20/20; each 0.1 higher is one line larger. Distance ${ac.dist / 1000} m${rec.acuity.calibrated ? ', calibrated screen' : ', screen not calibrated'}.</p>
    ${worse ? '<p class="warnline">! Two or more lines worse can come from a different distance, light, tiredness or glasses. Repeat the check the same way. If it stays, tell your clinician; if it came on suddenly, treat it as urgent.</p>' : ''}
    <p class="fine">Saved on this device. The latest result from the last 14 days goes into your next review packet. <button type="button" class="link-btn" data-evidence="acuity">Evidence</button></p>
    <div class="row"><button type="button" class="btn primary" data-nav="board">Back to the board</button><button type="button" class="btn" data-nav="acuity">Check again</button></div></div>`;
  $('acResult').scrollIntoView({ block: 'start' });
}
$('btnAcStart').addEventListener('click', () => { acLimitText(); if (ac.floor != null) acEye('right'); });
async function acTileLine() {
  const list = await acRecords();
  if (!list.length) return '';
  const last = list[list.length - 1], ref = acRefFor(list, last);
  const f = (e) => (last.acuity[e] ? `${e === 'right' ? 'right' : 'left'} ${last.acuity[e].snellen}` : '');
  const worse = ['right', 'left'].some((e) => compareAcuity(last.acuity[e], ref?.acuity?.[e]).verdict === 'worse');
  return `<p class="${worse ? 'warnline' : ''}">Eye chart ${fmtDate(last.createdAt)}: ${f('right')}, ${f('left')}${worse ? ' · ! 2 or more lines worse than your first check' : ''}</p>`;
}

/* ---------- NASA bed rest plasma volume (data/bedrest-pv.json, built by scripts/build_bedrest.py) ---------- */
let bedData = null;
async function renderBedTile() {
  try { if (!bedData) bedData = await (await fetch('data/bedrest-pv.json')).json(); }
  catch { $('bedBody').innerHTML = '<p class="fine">Bed rest data not available offline yet.</p>'; return; }
  const bins = bedData.bins;
  const W = 520, H = 210, L = 46, R = 10, T = 14, B = 46;
  const lo = Math.min(-30, ...bins.map((b) => b.q1_pct)), hi = 5;
  const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const bw = (W - L - R) / bins.length;
  let g = `<line x1="${L}" x2="${W - R}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="baseline"/>`;
  for (const v of [0, -10, -20, -30]) if (v >= lo) g += `<text x="${L - 6}" y="${(y(v) + 5).toFixed(1)}" class="ax" text-anchor="end">${v}%</text>`;
  bins.forEach((b, i) => {
    const cx = L + bw * i + bw / 2, w = bw * 0.46;
    g += `<rect x="${(cx - w / 2).toFixed(1)}" y="${y(0).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1, y(b.median_pct) - y(0)).toFixed(1)}" class="${i === bins.length - 1 ? 'bar-post' : 'bar'}"/>`;
    g += `<line x1="${cx}" x2="${cx}" y1="${y(b.q3_pct).toFixed(1)}" y2="${y(b.q1_pct).toFixed(1)}" class="whisk"/>`;
    g += `<text x="${cx}" y="${H - 26}" class="ax" text-anchor="middle">${esc(b.label.replace('After bed rest (days 0 to 3)', 'After').replace('Days ', ''))}</text><text x="${cx}" y="${H - 8}" class="ax" text-anchor="middle">n ${b.n}</text>`;
  });
  const first = bins[0], all = bins.slice(0, -1);
  const below = all.reduce((a, b) => a + b.below_own_pre_min, 0), n = all.reduce((a, b) => a + b.n, 0);
  $('bedBody').innerHTML = `<p class="big-num">${first.median_pct}%<span class="unit"> median plasma volume in the first week</span></p>
    <svg class="spark bed-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Median change in plasma volume against each person's own pre bed rest value: ${bins.map((b) => `${b.label} ${b.median_pct} percent, n ${b.n}`).join('; ')}">${g}</svg>
    <p>${below} of ${n} person-windows during bed rest sat below that person's own lowest value before bed rest. The fluid shift starts in the first week and is partly reversed within days of getting up (median ${bins.at(-1).median_pct}%).</p>
    <p class="fine">${bedData.people} people from ${bedData.campaigns.length} NASA campaigns, pooled across exercise and control groups. Bars: median; lines: middle half. This is why the app compares you with your own baseline.</p>`;
}
