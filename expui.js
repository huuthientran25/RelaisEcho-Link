// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Experimental checks: menu, guided capture loops and result screens. The measurements live in js/exp.js.
// Every check: camera frames are analysed in this browser and discarded. Only the numbers are kept,
// plus small photos for the neck and eyelid checks (shown to the person before anything is saved).

import {
  CHECKS, EXP, checkTitle, irisInfo, jawFrame, summarizeJaw, eyePosition, gazeTarget, summarizeGaze, pupilFromCrop, summarizePupil,
  patchMean, eyelidBoxes, pallorResult, rednessIndex, grayOf, motionEnergy, swallowEvents, columnProfile, tremorSpectrum, summarizeCirc, swayStats, summarizeBalance, pointingPlan, placeTarget, summarizePointing, spo2Calibration, spo2Estimate, spo2Line,
  compareExp, expCsv,
} from './exp.js';
import { faceGeometry, pulseRois } from './geometry.js';
import { roiMeanRGB, rowProfile } from './frame.js';
import { profileShift } from './resp.js';
import { std, median } from './dsp.js';

const EVKEY = { jaw: 'exp_jaw', gaze: 'exp_gaze', pupil: 'exp_pupil', pallor: 'exp_pallor', neck: 'exp_neck', tremor: 'exp_tremor', balance: 'exp_balance', point: 'exp_point', circ: 'exp_circ' };
const hasMotionSensor = () => typeof window.DeviceMotionEvent !== 'undefined' && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

const STEPS = {
  jaw: ['Sit facing the camera, face filling about a third of the picture.', 'Follow the prompts: mouth closed, then open as wide as is comfortable, then close. Three times.', 'Stop if it hurts. Do not force the jaw.'],
  gaze: ['Hold the screen at arm\'s length, level with your eyes.', 'A yellow dot moves left and right on a dark screen for 20 seconds, then stops in the middle for 5.', 'Follow it with your eyes only. Keep your head still.'],
  pupil: ['Dim the room lights and turn the screen to full brightness.', 'Bring your face to about 30 cm from the camera.', 'Look at the small grey dot. The screen stays dark for 3 seconds, flashes white for 2, then goes dark again.', 'Skip this check if flashing light can trigger seizures for you.'],
  pallor: ['Use daylight or a bright white lamp. Coloured or dim light changes the result.', 'With a clean finger, gently pull down one lower eyelid and look up, so the pink inside shows.', 'Hold for 8 seconds. Afterwards you confirm the picture shows the inner eyelid before anything is saved.'],
  neck: ['Have a glass of water ready and uncover your neck (open collar, no scarf).', 'Tip your head back a little so the lower front of the neck is in the yellow box.', 'When asked, take a sip, then swallow. Twice.', 'Two small neck photos are saved: before and during the swallow.'],
  tremor: ['One hand at a time, arm straight out in front of you, 15 seconds each.', 'Phone mode: hold the phone flat on your open palm. Camera mode: hold your open hand, palm toward the camera, inside the yellow box.', 'Do not brace the arm on anything.'],
  balance: ['Stand within reach of a wall or a sturdy chair, shoes off, feet together. Turn the sound on.', 'Press Start, then hold the phone flat against the middle of your chest with both hands, screen toward you.', 'One beep: stand as still as you can with eyes open for 30 seconds. Two beeps: close your eyes and keep still. Three beeps: finished, open your eyes.', 'Skip the eyes closed part if you feel unsteady, and open your eyes and hold on at once if you start to tip.'],
  point: ['Sit at a table and hold the phone in your other hand, or lay it flat. Use the index finger of the hand you write with.', 'The screen fills with a dark area. Tap each yellow circle as fast and as accurately as you can; the next one appears at once.', 'The first 3 are practice. 24 count: 12 big, 12 small, in random order. Tap Stop to leave.'],
  circ: ['Sit still in steady, even light (no flicker, no sun patches moving).', 'Hold one open palm flat beside your cheek, facing the camera, inside the yellow box. Keep it at cheek height.', 'Stay still and breathe normally for 30 seconds.', 'The two indexes are compared only with your own first check. They are not blood pressure and not oxygen saturation.'],
};

export function initExp(c) {
  const { $, esc, fmtDate } = c;
  const ex = { check: null, running: false, run: null, raf: 0, motion: null, pending: null };
  const records = async () => (await c.listSessions()).filter((x) => x.kind === 'exp' && x.exp);
  const firstOk = (list, id, exceptId) => list.find((x) => x.exp.check === id && x.exp.ok && x.id !== exceptId) || null;
  const pcan = document.createElement('canvas');
  const pctx = pcan.getContext('2d', { willReadFrequently: true });

  /* ---------- menu ---------- */
  async function renderMenu() {
    const list = await records();
    $('expList').innerHTML = CHECKS.map((k) => {
      const mine = list.filter((x) => x.exp.check === k.id);
      const last = mine[mine.length - 1];
      let status = '<p class="fine">Not done yet.</p>';
      if (last) {
        const ref = firstOk(list, k.id, last.id);
        const v = last.exp.ok ? compareExp(k.id, last.exp, ref ? ref.exp : null).verdict : 'failed';
        const word = { reference: 'first check saved', same: 'no change beyond the bands', different: 'differs from your first check', none: 'saved', failed: 'last try could not measure' }[v];
        status = `<p class="fine">Last: ${fmtDate(last.createdAt)} · <span class="${v === 'different' ? 'warnline' : ''}">${word}</span></p>`;
      }
      return `<div class="exp-item"><h2>${esc(k.title)}</h2><p class="fine">${esc(k.time)}</p><p>${esc(k.line)}</p>${status}
        <button type="button" class="btn" data-exp-open="${k.id}">Open</button></div>`;
    }).join('');
  }

  function reset() {
    stop();
    ex.check = null; ex.pending = null;
    $('expMenu').hidden = false; $('expRun').hidden = true; $('expResult').hidden = true;
    renderMenu();
  }

  function open(id) {
    const k = CHECKS.find((x) => x.id === id);
    if (!k) { reset(); return; } // unknown or missing check: back to the list instead of an error
    ex.check = id; ex.pending = null;
    $('expMenu').hidden = true; $('expResult').hidden = true; $('expRun').hidden = false;
    $('expTitle').textContent = k.title;
    $('expSteps').innerHTML = STEPS[id].map((s) => `<li>${esc(s)}</li>`).join('');
    $('expCoach').textContent = ''; $('expProg').style.transform = 'scaleX(0)';
    $('btnExpGo').disabled = false; $('btnExpGo').textContent = 'Start';
    $('expExtra').innerHTML = id === 'tremor' ? `<fieldset class="seg"><legend>How to measure</legend>
        <label><input type="radio" name="tremorMode" value="motion" ${hasMotionSensor() ? 'checked' : ''}> Phone in hand (motion sensor)</label>
        <label><input type="radio" name="tremorMode" value="camera" ${hasMotionSensor() ? '' : 'checked'}> Camera (hand in a box)</label></fieldset>`
      : id === 'balance' ? '<p><label><input type="checkbox" id="balOpenOnly"> Eyes open only (skip the eyes closed part)</label></p>' : '';
    records().then((list) => { // a way back to the last saved result (for example to add an oximeter reading later)
      if (ex.check !== id || !list.some((x) => x.exp.check === id && x.exp.ok)) return;
      $('expExtra').insertAdjacentHTML('beforeend', '<p><button type="button" class="link-btn" data-exp-last>Show my last result</button></p>');
    }).catch(() => {});
    $('expTitle').focus({ preventScroll: true });
  }

  /* ---------- the full screen layer (eye following, pupil flash) ---------- */
  function showLayer(kind) {
    const L = $('expLayer');
    L.className = `exp-layer ${kind}`; L.hidden = false;
    $('expDot').style.transform = 'translateX(0)';
    try { L.requestFullscreen?.().catch(() => {}); } catch { /* not allowed */ }
  }
  function hideLayer() {
    const L = $('expLayer');
    if (!L.hidden) { L.hidden = true; try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch { /* ignore */ } }
    cancelAnimationFrame(ex.raf); ex.raf = 0;
  }
  function animateDot() {
    const run = ex.run;
    if (!run || !ex.running) return;
    if (run.wall0 != null) {
      const s = (performance.now() - run.wall0) / 1000;
      const x = gazeTarget(s);
      window.__relaisTarget = x; // read by the test mock only
      $('expDot').style.transform = `translateX(${(x * 0.38 * window.innerWidth).toFixed(1)}px)`;
    }
    ex.raf = requestAnimationFrame(animateDot);
  }

  /* ---------- capture specs ---------- */
  const fullFrameCrop = (video, box, maxW = 240) => {
    const vw = video.videoWidth, vh = video.videoHeight, sx = vw / c.state.AW, sy = vh / c.state.AH;
    const bx = Math.max(0, box.x * sx), by = Math.max(0, box.y * sy), bw = Math.min(vw - bx, box.w * sx), bh = Math.min(vh - by, box.h * sy);
    if (!(bw > 4 && bh > 4)) return null;
    const scale = Math.min(1, maxW / bw);
    const can = document.createElement('canvas');
    can.width = Math.round(bw * scale); can.height = Math.round(bh * scale);
    can.getContext('2d').drawImage(video, bx, by, bw, bh, 0, 0, can.width, can.height);
    return can;
  };

  const SPECS = {
    jaw: {
      durationMs: () => 20000,
      init: () => ({ frames: [] }),
      coach: (r, el) => (el < 3000 ? 'Mouth closed. Look at the camera.' : Math.floor((el - 3000) / 2800) % 2 === 0 ? 'Open wide, as far as is comfortable.' : 'Close your mouth.'),
      frame: (r, el, lm) => { if (lm) r.frames.push(jawFrame(lm, c.state.AW, c.state.AH)); },
      draw: (r, lm, g2) => { if (!lm) return; const { AW, AH } = c.state; dot(g2, lm[13].x * AW, lm[13].y * AH); dot(g2, lm[14].x * AW, lm[14].y * AH); dot(g2, lm[152].x * AW, lm[152].y * AH); },
      summarize: (r) => ({ ...summarizeJaw(r.frames), method: 'Inner lip gap and chin position, scaled by assuming an 11.7 mm iris width.' }),
    },
    gaze: {
      layer: 'gaze',
      durationMs: () => (EXP.gaze.pursuitSec + EXP.gaze.holdSec) * 1000,
      init: () => ({ samples: [], yaw: [] }),
      coach: (r, el) => (el < 2500 ? 'Follow the yellow dot with your eyes only. Keep your head still.' : el < EXP.gaze.pursuitSec * 1000 ? '' : 'Keep looking at the dot.'),
      start: (r) => { window.__relaisExp = 'gaze'; animateDot(); },
      frame: (r, el, lm) => {
        if (r.wall0 == null) r.wall0 = performance.now();
        r.samples.push({ t: el, eye: lm ? eyePosition(lm, c.state.AW, c.state.AH) : null });
        if (lm) r.yaw.push(faceGeometry(lm, c.state.AW, c.state.AH).yaw);
      },
      summarize: (r) => {
        const s = summarizeGaze(r.samples);
        const turn = r.yaw.length > 10 ? std(r.yaw) : 0;
        return { ...s, headTurnDeg: Math.round(turn * 10) / 10, note: turn > 5 ? `The head turned during the check (about ${Math.round(turn)} degrees of spread), so this result compares less fairly.` : '',
          method: 'Iris position between the eye corners, against a dot moving at 0.25 cycles per second. The delay includes the camera\'s own delay, so compare only on the same device.' };
      },
    },
    pupil: {
      layer: 'pupil',
      durationMs: () => (EXP.pupil.darkSec + EXP.pupil.lightSec + EXP.pupil.afterSec) * 1000,
      init: () => ({ samples: [], irisPx: [] }),
      coach: (r, el) => (el < EXP.pupil.darkSec * 1000 ? 'Look at the small grey dot. Keep your eyes open.' : el < (EXP.pupil.darkSec + EXP.pupil.lightSec) * 1000 ? '' : 'Keep looking at the dot.'),
      frame: (r, el, lm, img, video) => {
        const on = el >= EXP.pupil.darkSec * 1000 && el < (EXP.pupil.darkSec + EXP.pupil.lightSec) * 1000;
        $('expLayer').classList.toggle('white', on);
        if (!lm) { r.samples.push({ t: el, right: null, left: null }); return; }
        const vw = video.videoWidth, vh = video.videoHeight;
        const iris = irisInfo(lm, vw, vh);
        if (!iris) return;
        const one = (e) => {
          if (!(e.r >= 5)) return null;
          const S = Math.ceil(2.4 * e.r), k = Math.min(1, 128 / S), w = Math.max(16, Math.round(S * k));
          pcan.width = w; pcan.height = w;
          pctx.drawImage(video, e.cx - S / 2, e.cy - S / 2, S, S, 0, 0, w, w);
          const d = pctx.getImageData(0, 0, w, w).data;
          return pupilFromCrop(d, w, w, w / 2, w / 2, e.r * (w / S));
        };
        r.irisPx.push(2 * iris.right.r);
        r.samples.push({ t: el, right: one(iris.right), left: one(iris.left) });
      },
      summarize: (r) => {
        const px = r.irisPx.length ? Math.round(median(r.irisPx)) : 0;
        const s = px && px < 12 ? { ok: false, reason: `The irises were only about ${px} pixels wide in the camera picture. Move closer to the camera and try again.` } : summarizePupil(r.samples);
        return { ...s, irisPx: px, method: 'Dark region connected to the centre of each iris, against the iris width, through a 2 second white screen. Camera exposure changes during the flash can reduce the measured narrowing.' };
      },
    },
    pallor: {
      durationMs: () => 8000,
      init: () => ({ s: { right: [], left: [] }, snap: {}, n: 0 }),
      coach: (r, el) => (el < 2000 ? 'Pull down one lower eyelid and look up.' : 'Hold still.'),
      frame: (r, el, lm, img, video) => {
        if (!lm || el < 1500) return;
        r.n += 1;
        const { AW, AH } = c.state;
        for (const side of ['right', 'left']) {
          const b = eyelidBoxes(lm, AW, AH, side);
          if (!b) continue;
          const conj = patchMean(img.data, AW, AH, b.conj), sclera = patchMean(img.data, AW, AH, b.sclera);
          if (!conj || !sclera) continue;
          r.s[side].push({ conj, sclera, ei: rednessIndex(conj) });
          if (r.n % 10 === 0 || !r.snap[side]) {
            const ew = b.eyeWidth, cx = b.conj.x + b.conj.w / 2;
            const area = { x: cx - 0.8 * ew, y: b.conj.y - 0.7 * ew, w: 1.6 * ew, h: 1.2 * ew };
            const can = fullFrameCrop(video, area, 220);
            if (can) {
              const k = can.width / (area.w * (video.videoWidth / AW));
              const g2 = can.getContext('2d'), sx = video.videoWidth / AW;
              g2.strokeStyle = '#FFD24A'; g2.lineWidth = 2;
              g2.strokeRect((b.conj.x - area.x) * sx * k, (b.conj.y - area.y) * sx * k, b.conj.w * sx * k, b.conj.h * sx * k);
              r.snap[side] = can.toDataURL('image/jpeg', 0.8);
            }
          }
        }
      },
      draw: (r, lm, g2) => {
        if (!lm) return;
        for (const side of ['right', 'left']) { const b = eyelidBoxes(lm, c.state.AW, c.state.AH, side); if (b) { box(g2, b.conj, '#FFD24A', side === 'right' ? 'eyelid' : ''); box(g2, b.sclera, '#9CC3F5'); } }
      },
      summarize: (r) => {
        const med = (arr, k) => ({ r: median(arr.map((x) => x[k].r)), g: median(arr.map((x) => x[k].g)), b: median(arr.map((x) => x[k].b)) });
        const sides = ['right', 'left'].filter((s) => r.s[s].length >= 5);
        if (!sides.length) return { ok: false, reason: 'The eyes were not tracked well enough. Keep your face in the frame and the other eye open.', method: '' };
        const side = sides.sort((a, b) => median(r.s[b].map((x) => x.ei)) - median(r.s[a].map((x) => x.ei)))[0];
        return { ...pallorResult(med(r.s[side], 'conj'), med(r.s[side], 'sclera')), eye: side, images: r.snap[side] ? { eyelid: r.snap[side] } : null,
          method: 'Redness index 100 x log10(red / green) of the inner lower eyelid minus the same index of the white of the eye, from the camera picture without a colour card.' };
      },
      confirm: true,
    },
    neck: {
      durationMs: () => EXP.neck.seconds * 1000 + 2000,
      init: () => ({ series: [], prev: null, box: null, vis: [], images: {}, maxE: 0, lastSnap: 0 }),
      coach: (r, el) => (el < 3000 ? 'Tip your head back a little so your neck is in the yellow box.' : el < 5000 ? 'Take a sip of water and hold it.' : el < 8000 ? 'Swallow now.' : el < 10000 ? 'Take another small sip.' : 'Swallow again.'),
      frame: (r, el, lm, img, video) => {
        const { AW, AH } = c.state;
        if (lm && (!r.box || el < 3000)) {
          const g = faceGeometry(lm, AW, AH);
          const x0 = g.chin.x - 0.65 * g.faceWidth, y0 = g.chin.y + 0.05 * g.faceHeight, y1 = g.chin.y + 0.85 * g.faceHeight;
          const bx = { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(AW, x0 + 1.3 * g.faceWidth) - Math.max(0, x0), h: Math.min(AH, y1) - Math.max(0, y0) };
          r.vis.push(Math.max(0, bx.h) / Math.max(1, y1 - y0));
          if (bx.w > 12 && bx.h > 12) r.box = bx;
        }
        if (!r.box || el < 3000) return;
        const gray = grayOf(img.data, AW, AH, r.box, 3);
        if (r.prev && r.prev.length === gray.length) r.series.push({ t: el, e: motionEnergy(r.prev, gray) });
        r.prev = gray;
        if (!r.images.before && el >= 4300) { const cv = fullFrameCrop(video, r.box); if (cv) r.images.before = cv.toDataURL('image/jpeg', 0.8); }
        const e = r.series.length ? r.series[r.series.length - 1].e : 0;
        if (el >= 5000 && e > r.maxE * 1.15 && el - r.lastSnap > 250) {
          r.maxE = e; r.lastSnap = el;
          const cv = fullFrameCrop(video, r.box); if (cv) r.images.during = cv.toDataURL('image/jpeg', 0.8);
        }
      },
      draw: (r, lm, g2) => { if (r.box) box(g2, r.box, '#FFD24A', 'neck'); },
      summarize: (r) => {
        const ev = swallowEvents(r.series);
        const vis = r.vis.length ? median(r.vis) : 0;
        const ok = !!r.images.before && vis >= EXP.neck.minPitchFrac;
        return { ok, swallows: ev.length, neckVisiblePct: Math.round(100 * vis), images: ok ? r.images : null,
          reason: !ok ? 'The neck was not in view. Sit further back or tip your head back a little more.' : ev.length ? '' : 'No swallow movement was picked up. The photos are still saved for a reviewer to compare.',
          method: 'Two photos of the lower front neck from the same framing, before and at the largest movement during the swallow. The app looks for nothing in them; a reviewer compares them with your first check.' };
      },
    },
    tremor: {
      durationMs: () => 38000,
      init: () => ({ mode: document.querySelector('input[name="tremorMode"]:checked')?.value || 'camera', h: { right: { t: [], c: [[], [], []] }, left: { t: [], c: [[], [], []] } }, X: 0, Y: 0, prevR: null, prevC: null, hand: null }),
      needsFace: false,
      phase: (el) => (el < 4000 ? ['prep', 'right'] : el < 19000 ? ['rec', 'right'] : el < 23000 ? ['prep', 'left'] : ['rec', 'left']),
      coach: (r, el) => {
        const [ph, hand] = SPECS.tremor.phase(el);
        const how = r.mode === 'motion' ? 'phone flat on your open palm' : 'palm toward the camera inside the yellow box';
        const left = Math.ceil(((hand === 'right' ? 19000 : 38000) - el) / 1000);
        return ph === 'prep' ? `${hand === 'right' ? 'Right' : 'Left'} hand: arm straight out, ${how}.` : `Hold steady, ${left} s.`;
      },
      box: () => { const { AW, AH } = c.state; return { x: 0.3 * AW, y: 0.22 * AH, w: 0.4 * AW, h: 0.56 * AH }; },
      frame: (r, el, lm, img) => {
        const [ph, hand] = SPECS.tremor.phase(el);
        if (ph !== 'rec') { r.prevR = null; r.prevC = null; r.X = 0; r.Y = 0; return; }
        const b = SPECS.tremor.box();
        const rp = rowProfile(img, b), cp = columnProfile(img.data, c.state.AW, c.state.AH, b);
        if (!rp || !cp) return;
        if (r.prevR) { r.Y += profileShift(r.prevR, rp).shift; r.X += profileShift(r.prevC, cp).shift; }
        r.prevR = rp; r.prevC = cp;
        const H = r.h[hand]; H.t.push(el); H.c[0].push(r.X); H.c[1].push(r.Y);
      },
      draw: (r, lm, g2) => box(g2, SPECS.tremor.box(), '#FFD24A', 'hand here'),
      summarize: (r) => {
        const fs = r.mode === 'motion' ? EXP.tremor.motionFs : EXP.tremor.camFs;
        const one = (H) => { const chans = r.mode === 'motion' ? H.c : H.c.slice(0, 2); const s = tremorSpectrum(H.t, chans, fs); return s.ok ? { peakHz: s.share >= 0.3 ? s.peakHz : null, share: s.share, rms: Math.round(s.rms * 1000) / 1000, fs: s.fsReal } : { reason: s.reason }; };
        const right = one(r.h.right), left = one(r.h.left);
        const ok = right.share != null || left.share != null;
        return { ok, mode: r.mode, unit: r.mode === 'motion' ? 'm/s²' : 'pixels', right, left,
          reason: ok ? '' : (right.reason || left.reason || 'No usable recording.'),
          method: r.mode === 'motion' ? 'Phone motion sensor, 3 to 12 Hz band, spectra of the three axes added together.' : 'Sideways and up and down shift of the picture inside the box, 3 to 12 Hz band. Camera mode depends on frame rate and on how far the hand is from the camera.' };
      },
    },
    balance: {
      durationMs: (r) => (r.openOnly ? 36000 : 72000),
      recStartMs: 6000,
      init: () => ({ mode: 'motion', openOnly: !!document.querySelector('#balOpenOnly')?.checked, h: { open: { t: [], c: [[], [], []] }, closed: { t: [], c: [[], [], []] } } }),
      needsFace: false,
      phase: (el) => (el < 6000 ? ['prep', 'open'] : el < 36000 ? ['rec', 'open'] : el < 42000 ? ['prep', 'closed'] : ['rec', 'closed']),
      coach: (r, el) => {
        const [ph, key] = SPECS.balance.phase(el);
        if (key === 'open') return ph === 'prep' ? 'Feet together, phone flat against your chest. It starts at the beep.' : 'Eyes open. Stand as still as you can.';
        return ph === 'prep' ? 'Two beeps: close your eyes and keep standing still.' : 'Eyes closed. Stand still until the three beeps.';
      },
      cue: (ph, key) => beep(ph === 'done' ? 3 : ph === 'rec' && key === 'open' ? 1 : ph === 'prep' && key === 'closed' ? 2 : 0),
      summarize: (r) => {
        const one = (H) => swayStats(H.t, H.c);
        return { ...summarizeBalance(one(r.h.open), r.openOnly ? null : one(r.h.closed)), unit: 'mg',
          method: 'Phone motion sensor, phone held against the chest, feet together. Movements between 0.1 and 5 Hz, root mean square over the three axes, in thousandths of g.' };
      },
    },
    point: {
      init: () => ({ mode: 'touch', trials: [] }),
      summarize: (r) => ({ ...summarizePointing(r.trials), hand: r.hand || 'writing hand', screen: r.screen,
        method: 'Targets of 56 and 28 CSS pixels at random places; time from the target appearing to the tap; a tap outside the circle is a miss. Throughput = mean of log2(distance / width + 1) divided by the time, the Shannon form of Fitts\' law with the nominal width.' }),
    },
    circ: {
      durationMs: () => 6000 + EXP.circ.seconds * 1000,
      init: () => ({ samples: [], box: null, camT: [] }),
      coach: (r, el) => (el < 6000 ? 'Hold your open palm flat beside your cheek, facing the camera, inside the yellow box.' : `Keep still and breathe normally, ${Math.ceil((6000 + EXP.circ.seconds * 1000 - el) / 1000)} s.`),
      frame: (r, el, lm, img) => {
        const { AW, AH } = c.state;
        r.camT.push(el);
        if (!lm) { if (el >= 6000) r.samples.push({ t: el, ok: false }); return; }
        const g = faceGeometry(lm, AW, AH);
        if (!r.box || el < 6000) {
          const fw = g.faceWidth, s = 0.6 * fw, cy = ((lm[50].y + lm[280].y) / 2) * AH;
          const ra = { x: lm[454].x * AW + 0.12 * fw, y: cy - s / 2, w: s, h: s }, la = { x: lm[234].x * AW - 0.12 * fw - s, y: cy - s / 2, w: s, h: s };
          const room = (b) => Math.min(b.x, AW - (b.x + b.w), b.y, AH - (b.y + b.h));
          r.box = room(ra) >= room(la) ? ra : la;
        }
        if (el < 6000) return;
        const face = roiMeanRGB(img, pulseRois(lm, g)), palm = roiMeanRGB(img, [r.box]);
        const area = r.box.w * r.box.h;
        const ok = face.n > 50 && palm.n > 0.5 * area && face.clippedFrac < 0.05 && palm.clippedFrac < 0.05;
        r.samples.push({ t: el, ok, face: { r: face.r, g: face.g, b: face.b }, palm: { r: palm.r, g: palm.g, b: palm.b } });
      },
      draw: (r, lm, g2) => { if (r.box) box(g2, r.box, '#FFD24A', 'palm here'); if (lm) pulseRois(lm, faceGeometry(lm, c.state.AW, c.state.AH)).forEach((b) => box(g2, b, '#9CC3F5')); },
      summarize: (r) => {
        const dur = r.camT.length > 1 ? (r.camT[r.camT.length - 1] - r.camT[0]) / 1000 : 1;
        const fps = Math.round((r.camT.length - 1) / Math.max(1, dur));
        const s = summarizeCirc(r.samples);
        return { ...s, cameraFps: fps, note: fps < 24 ? `The camera gave about ${fps} frames per second, so each frame is ${Math.round(1000 / Math.max(1, fps))} ms apart; the timing index is coarse.` : '',
          method: 'Pulse from the face (forehead and cheeks) and from the palm with the POS method; timing = how much later the palm pulse arrives, from cross correlation in 10 second windows. Colour index = (pulse size over mean) in red divided by the same in blue, on the face.' };
      },
    },
  };

  const dot = (o, x, y) => { o.ctx.fillStyle = '#FFD24A'; o.ctx.beginPath(); o.ctx.arc(x, y, 3.5 * o.px, 0, 2 * Math.PI); o.ctx.fill(); };
  const box = (o, b, col, label) => o.box(b, col, label);

  /* ---------- run ---------- */
  async function go() {
    const id = ex.check, spec = SPECS[id];
    if (!spec || ex.running) return;
    ex.run = spec.init(); ex.run.t0 = null;
    $('expResult').hidden = true;
    $('btnExpGo').disabled = true;
    if (ex.run.mode === 'motion') { if (spec.cue) beep(0); return goMotion(); }
    if (ex.run.mode === 'touch') return goTouch();
    c.moveStage('expStageSlot');
    $('expCoach').textContent = 'Starting the camera…';
    try {
      if (spec.needsFace !== false) await c.ensureModel($('expCoach'));
      await c.startSource('user');
    } catch (err) { c.sourceError(err, $('expCoach')); $('btnExpGo').disabled = false; return; }
    if (ex.check !== id) { c.stopSource(); return; } // left the screen while the camera started
    ex.running = true;
    window.__relaisExp = id;
    if (spec.layer) showLayer(spec.layer);
    spec.start?.(ex.run);
    c.startLoop((t) => frame(t));
  }

  let lastCoach = '';
  const setCoach = (txt) => { if (txt !== lastCoach) { lastCoach = txt; $('expCoach').textContent = txt; $('expLayerMsg').textContent = txt; } };

  function frame(t) {
    const run = ex.run, spec = SPECS[ex.check];
    if (!ex.running || !run || !spec) return;
    if (run.t0 == null) run.t0 = t;
    const el = t - run.t0;
    const v = $('video');
    const { AW, AH } = c.state;
    c.actx.drawImage(v, 0, 0, AW, AH);
    const img = c.actx.getImageData(0, 0, AW, AH);
    const lm = spec.needsFace === false ? null : c.detect(c.state.landmarker, v);
    spec.frame(run, el, lm, img, v);
    setCoach(spec.coach(run, el, lm) || (lm || spec.needsFace === false ? '' : 'Face not found.'));
    $('expProg').style.transform = `scaleX(${Math.min(1, el / spec.durationMs(run)).toFixed(3)})`;
    const o = c.overlayCtx();
    spec.draw?.(run, lm, o);
    if (el >= spec.durationMs(run)) finish();
  }

  // Beeps and a buzz for checks done without looking at the screen. Created inside the Start click so sound is allowed.
  let beepCtx = null;
  function beep(n) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) { beepCtx = beepCtx || new Ctx(); beepCtx.resume?.(); }
      if (!n) return;
      try { navigator.vibrate?.(Array.from({ length: n * 2 - 1 }, () => 160)); } catch { /* no vibration */ }
      if (!beepCtx) return;
      for (let i = 0; i < n; i += 1) {
        const o = beepCtx.createOscillator(), g = beepCtx.createGain();
        o.frequency.value = 880; g.gain.value = 0.25; o.connect(g); g.connect(beepCtx.destination);
        const t = beepCtx.currentTime + i * 0.32; o.start(t); o.stop(t + 0.18);
      }
    } catch { /* no sound on this device */ }
  }

  // Touchscreen pointing: a full screen dark area with one yellow target at a time.
  function goTouch() {
    const run = ex.run, cfg = EXP.point, plan = pointingPlan(Date.now(), cfg);
    const L = document.createElement('div');
    L.className = 'exp-arena'; L.id = 'expArena';
    L.innerHTML = `<p class="exp-arena-msg" id="expArenaMsg" aria-live="polite">Practice: tap the yellow circle.</p>
      <button type="button" class="btn exp-arena-stop" id="expArenaStop">Stop</button><span class="exp-arena-target" id="expArenaTarget" aria-hidden="true"></span>`;
    document.body.appendChild(L);
    try { L.requestFullscreen?.().catch(() => {}); } catch { /* not allowed */ }
    ex.running = true; ex.arena = L;
    const T = L.querySelector('#expArenaTarget');
    let i = -1, cur = null, shownAt = 0, timer = 0;
    run.screen = { w: Math.round(window.innerWidth), h: Math.round(window.innerHeight) };
    const next = () => {
      clearTimeout(timer);
      i += 1;
      if (i >= plan.sizes.length) { endTouch(true); return; }
      const W = L.clientWidth, H = L.clientHeight - 70, w = plan.sizes[i];
      const prev = cur;
      const p = placeTarget(W, H, w, prev, plan.rnd, cfg);
      cur = { ...p, w, d: prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0 };
      Object.assign(T.style, { width: `${w}px`, height: `${w}px`, left: `${p.x - w / 2}px`, top: `${p.y - w / 2 + 60}px` });
      T.hidden = false;
      $('expArenaMsg').textContent = i < cfg.practice ? 'Practice: tap the yellow circle.' : `${i - cfg.practice + 1} of ${plan.sizes.length - cfg.practice}`;
      // Time from when the target is placed; moved to the first paint when that comes before the tap. A tap is never
      // dropped because the screen had not repainted yet (that happened on a busy test machine).
      const placedAt = performance.now(), shown = i; shownAt = placedAt;
      requestAnimationFrame(() => { if (i === shown && shownAt === placedAt) shownAt = performance.now(); });
      timer = setTimeout(() => { if (!cur) return; run.trials.push({ w, d: cur.d, ms: null, dx: 0, dy: 0, practice: i < cfg.practice }); shownAt = 0; next(); }, cfg.timeoutMs);
    };
    const onDown = (e) => {
      if (e.target.closest('#expArenaStop') || !cur || !shownAt) return;
      e.preventDefault();
      const r = L.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top - 60;
      run.trials.push({ w: cur.w, d: cur.d, ms: Math.round(performance.now() - shownAt), dx: Math.round(x - cur.x), dy: Math.round(y - cur.y), practice: i < cfg.practice });
      shownAt = 0;
      next();
    };
    const close = () => {
      clearTimeout(timer); timer = 0; cur = null;
      L.removeEventListener('pointerdown', onDown);
      try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch { /* ignore */ }
      L.remove(); ex.arena = null; ex.closeArena = null;
    };
    const endTouch = (complete) => {
      close();
      if (complete) finish();
      else { ex.running = false; $('btnExpGo').disabled = false; $('expCoach').textContent = 'Stopped. Nothing was saved.'; }
    };
    ex.closeArena = close;
    L.addEventListener('pointerdown', onDown);
    L.querySelector('#expArenaStop').addEventListener('click', () => endTouch(false));
    next();
  }

  // Checks read from the phone motion sensor: hand steadiness (phone mode) and standing balance.
  async function goMotion() {
    const run = ex.run, id = ex.check, spec = SPECS[id];
    const total = spec.durationMs(run), firstKey = spec.phase(0)[1], recStart = spec.recStartMs ?? 4000;
    const fail = (msg) => { $('expCoach').textContent = msg; $('btnExpGo').disabled = false; };
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const p = await DeviceMotionEvent.requestPermission();
        if (p !== 'granted') throw new Error('denied');
      }
    } catch { fail(id === 'tremor' ? 'Motion sensor permission was not given. Choose "Camera" instead.' : 'Motion sensor permission was not given, so this check cannot run.'); return; }
    ex.running = true;
    // Keep the screen awake: a phone that locks itself after 30 seconds would stop the recording.
    try { ex.wake = await navigator.wakeLock?.request('screen'); } catch { ex.wake = null; }
    run.wall0 = performance.now();
    ex.motion = (e) => {
      const el = performance.now() - run.wall0;
      const [ph, key] = spec.phase(el);
      if (ph !== 'rec' || el >= total) return;
      const a = e.acceleration && e.acceleration.x != null ? e.acceleration : e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      const H = run.h[key]; H.t.push(el); H.c[0].push(a.x); H.c[1].push(a.y); H.c[2].push(a.z);
    };
    window.addEventListener('devicemotion', ex.motion);
    let lastPhase = '';
    const tick = () => {
      if (!ex.running || ex.run !== run) return;
      const el = performance.now() - run.wall0;
      if (el >= total) { spec.cue?.('done'); finish(); return; }
      const [ph, key] = spec.phase(el);
      if (spec.cue && `${ph} ${key}` !== lastPhase) { lastPhase = `${ph} ${key}`; spec.cue(ph, key); }
      setCoach(spec.coach(run, el));
      $('expProg').style.transform = `scaleX(${Math.min(1, el / total).toFixed(3)})`;
      if (el > recStart + 2500 && !run.h[firstKey].t.length) {
        stop(); fail(id === 'tremor' ? 'No motion sensor readings arrived. Choose "Camera" instead.' : 'No motion sensor readings arrived. This check needs a phone or tablet with a motion sensor.'); return;
      }
      ex.raf = requestAnimationFrame(tick);
    };
    ex.raf = requestAnimationFrame(tick);
  }

  function stop() {
    ex.running = false;
    window.__relaisExp = null;
    c.stopLoop?.();
    if (ex.motion) { window.removeEventListener('devicemotion', ex.motion); ex.motion = null; }
    if (ex.wake) { try { ex.wake.release(); } catch { /* already released */ } ex.wake = null; }
    ex.closeArena?.(); // leaving mid test: stop the timer and remove the arena
    hideLayer();
    if (c.state.stream || $('video').srcObject) c.stopSource();
    if ($('stage').parentElement?.id === 'expStageSlot') c.moveStage('stageHome');
    try { c.overlayCtx(); } catch { /* no overlay yet */ }
    lastCoach = '';
  }

  async function finish() {
    const id = ex.check, spec = SPECS[id], run = ex.run;
    stop();
    $('btnExpGo').disabled = false; $('btnExpGo').textContent = 'Check again';
    $('expProg').style.transform = 'scaleX(1)';
    let result;
    try { result = spec.summarize(run); } catch (err) { console.error(err); result = { ok: false, reason: `The analysis failed: ${err.message || err}` }; }
    if (spec.confirm && result.ok) { ex.pending = result; renderConfirm(result); return; }
    await save(result);
  }

  async function save(result) {
    const rec = { id: c.newId(), createdAt: new Date().toISOString(), kind: 'exp', source: 'device', complete: false, exp: { check: ex.check, ...result } };
    await c.saveSession(rec);
    ex.pending = null;
    await renderResult(rec);
  }

  function renderConfirm(result) {
    const img = result.images?.eyelid;
    $('expResult').hidden = false;
    $('expResult').innerHTML = `<div class="card result"><h2>Is this the inner eyelid?</h2>
      ${img ? `<div class="exp-photos"><figure><img src="${img}" alt="Close up of the ${esc(result.eye)} eye with a yellow box below it"><figcaption class="fine">${result.eye === 'right' ? 'Right' : 'Left'} eye as the camera saw it.</figcaption></figure></div>` : ''}
      <p>Save only if the yellow box sits on the pink inside of the lower eyelid. If it sits on skin or lashes, retake.</p>
      <div class="row"><button type="button" class="btn primary" id="btnExpYes">Yes, save it</button><button type="button" class="btn" id="btnExpNo">No, retake</button></div></div>`;
    $('btnExpYes').addEventListener('click', () => save(ex.pending));
    $('btnExpNo').addEventListener('click', () => { ex.pending = null; $('expResult').hidden = true; go(); });
    $('expResult').scrollIntoView({ block: 'start' });
  }

  /* ---------- results ---------- */
  const fmtVal = (v, unit) => (v == null ? '-' : `${v}${unit && unit !== 'index' && unit !== '' ? ` ${unit}` : ''}`);
  function tableHtml(cmp, refDate) {
    return `<table class="exp-table"><thead><tr><th scope="col">Measure</th><th scope="col">Today</th><th scope="col">Your first check${refDate ? `<br><span class="fine">${fmtDate(refDate)}</span>` : ''}</th><th scope="col">Difference</th></tr></thead><tbody>
      ${cmp.rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th><td>${fmtVal(r.today, r.unit)}</td><td>${fmtVal(r.ref, r.unit)}</td><td class="${r.outside ? 'warnline' : ''}">${r.delta == null ? '-' : `${r.delta > 0 ? '+' : ''}${r.delta}${r.outside ? ' (beyond the band)' : ''}`}</td></tr>`).join('')}</tbody></table>`;
  }
  function extrasHtml(e, ref) {
    const id = e.check;
    if (id === 'neck') {
      const fig = (src, cap) => (src ? `<figure><img src="${src}" alt="${esc(cap)}"><figcaption class="fine">${esc(cap)}</figcaption></figure>` : '');
      return `<div class="exp-photos">${fig(e.images?.before, 'Today, before swallowing')}${fig(e.images?.during, 'Today, during the swallow')}${ref ? fig(ref.images?.before, 'First check, before') + fig(ref.images?.during, 'First check, during') : ''}</div>
        <p>The app looks for nothing in these photos. A lump that moves when you swallow, or one side looking fuller than the other, is something to show a clinician; a normal looking neck does not rule thyroid disease out.</p>`;
    }
    if (id === 'pallor') return e.images?.eyelid ? `<div class="exp-photos"><figure><img src="${e.images.eyelid}" alt="Inner eyelid close up"><figcaption class="fine">Today</figcaption></figure>${ref?.images?.eyelid ? `<figure><img src="${ref.images.eyelid}" alt="Inner eyelid close up, first check"><figcaption class="fine">First check</figcaption></figure>` : ''}</div>
      <p>Lower numbers mean a paler inner eyelid. The index does not estimate haemoglobin, and room light changes it.</p>` : '';
    if (id === 'tremor') return `<p class="fine">Mode: ${e.mode === 'motion' ? 'phone motion sensor' : 'camera'}. Shake size (RMS): right ${e.right?.rms ?? '-'}, left ${e.left?.rms ?? '-'} ${esc(e.unit)}, comparable only in the same mode at the same distance. Speed is shown only when a clear rhythm was found (share at least 0.3); a rhythmic share near 0 means no shake stood out. Small fast shaking is normal in everyone.</p>`;
    if (id === 'point') return `<p class="fine">Big targets: ${e.big?.medianMs ?? '-'} ms, ${e.big?.missPct ?? '-'}% missed. Small targets: ${e.small?.medianMs ?? '-'} ms, ${e.small?.missPct ?? '-'}% missed. Not tapped in time: ${e.timeouts ?? 0}. Compare only with your own earlier checks on the same phone, same hand and same posture: screen size and grip change the numbers.</p>`;
    if (id === 'balance') return `<p class="fine">Largest single movement: eyes open ${e.open?.peakMg ?? '-'} mg${e.closed ? `, eyes closed ${e.closed.peakMg ?? '-'} mg` : ''}. ${esc(e.note || '')} Most people sway more with eyes closed. Compare only with your own earlier checks done the same way: shoes off, same floor, phone in the same place.</p>`;
    if (id === 'circ') return `<p><strong>Not blood pressure. Not oxygen saturation.</strong> In small research studies, a shorter face to palm timing went with higher pressure within the same person, under controlled conditions and usually with fast cameras. The colour index is an uncalibrated cousin of what a pulse oximeter measures with red and infrared light; an ordinary camera has no infrared channel. Pulse during the check: ${e.bpm ?? '-'} bpm · windows used ${esc(e.windows ?? '-')}${e.cameraFps ? ` · camera ${e.cameraFps} frames per second` : ''}.</p>`;
    if (id === 'gaze') return `<p class="fine">Catch up jumps: ${e.jumpsPer10s ?? '-'} per 10 s · steadiness while holding on the dot: ${e.holdJitterPct ?? '-'}% of the eye travel (lower is steadier) · smoothness ${e.smoothnessPct ?? '-'}%.</p>`;
    if (id === 'pupil') return `<p class="fine">Time to half narrowing: right ${e.right?.latencyMs ?? '-'} ms, left ${e.left?.latencyMs ?? '-'} ms. Iris width in the picture: ${e.irisPx || '-'} pixels.</p>`;
    if (id === 'jaw') return `<p class="fine">Openings counted: ${e.openings ?? '-'}. This is the gap between the lips, not between the teeth, so it reads smaller than a dentist's measurement.</p>`;
    return '';
  }

  async function renderResult(rec) {
    const list = await records();
    const e = rec.exp, ref = firstOk(list, e.check, rec.id);
    const out = $('expResult');
    out.hidden = false;
    const ev = `<button type="button" class="link-btn" data-evidence="${EVKEY[e.check]}">Evidence</button>`;
    if (!e.ok) {
      out.innerHTML = `<div class="card result"><p><span class="tag">Experimental</span></p><h2>${esc(checkTitle(e.check))}: no result</h2>
        <p class="warnline">${esc(e.reason || 'The check could not measure this time.')}</p>
        <p class="fine">Saved as a failed try, so the record is honest. Nothing was compared. ${ev}</p>
        <div class="row"><button type="button" class="btn primary" data-exp-again="${esc(e.check || '')}">Try again</button><button type="button" class="btn" data-exp-menu>Back to the list</button></div></div>`;
    } else {
      const cmp = compareExp(e.check, e, ref ? ref.exp : null);
      const verdict = cmp.verdict === 'reference' ? '<p>Saved as your first check of this kind. Later checks are compared with it.</p>'
        : cmp.verdict === 'different' ? `<p class="warnline">! Some measures differ from your first check. Light, distance, camera and effort often explain this. Repeat the check once, the same way. If the difference stays, mention it to your clinician.</p>`
          : '<p class="okline">✓ No measure moved beyond its band against your first check.</p>';
      out.innerHTML = `<div class="card result"><p><span class="tag">Experimental</span> <span class="tag">Shown, not judged</span></p>
        <h2>${esc(checkTitle(e.check))}</h2>${tableHtml(cmp, ref?.createdAt)}${verdict}
        ${e.reason ? `<p class="fine">${esc(e.reason)}</p>` : ''}${e.note ? `<p class="fine">${esc(e.note)}</p>` : ''}
        ${extrasHtml(e, ref ? ref.exp : null)}
        ${e.check === 'circ' ? spo2Html(rec, list) : ''}
        <p class="fine">Method: ${esc(e.method || '')} Bands are design choices, not medical limits. ${ev}</p>
        <p class="fine">Saved on this device. The latest result from the last 14 days goes into your next review packet${e.images ? ' (photos only if you tick "Include photos")' : ''}.</p>
        <div class="row"><button type="button" class="btn primary" data-exp-menu>Back to the list</button><button type="button" class="btn" data-exp-again="${esc(e.check || '')}">Check again</button></div></div>`;
    }
    out.scrollIntoView({ block: 'start' });
  }

  // Research: pair this colour ratio with a fingertip oximeter reading taken now, and show the person's own calibration.
  function spo2Html(rec, list) {
    const pairs = list.filter((x) => x.exp.check === 'circ' && x.exp.ok && Number.isFinite(x.exp.rorFace) && Number.isFinite(x.exp.oximeter)).map((x) => ({ ror: x.exp.rorFace, spo2: x.exp.oximeter }));
    const cal = spo2Calibration(pairs);
    const est = Number.isFinite(rec.exp.oximeter) ? null : spo2Estimate(cal, rec.exp.rorFace);
    return `<div class="exp-spo2"><h3 class="h-sub">Camera oxygen saturation (research)</h3>
      <p class="fine">${esc(spo2Line(cal, est))}</p>
      <p><label>Fingertip oximeter reading right now (%) <input type="number" id="expOxi" min="50" max="100" step="1" inputmode="numeric" value="${rec.exp.oximeter ?? ''}" data-rec="${esc(rec.id)}"></label></p>
      <p class="fine">Each reading you add is one calibration pair for your camera. <button type="button" class="link-btn" data-evidence="spo2">Evidence</button></p></div>`;
  }
  document.addEventListener('change', async (e) => {
    if (e.target?.id !== 'expOxi') return;
    const v = Number(e.target.value), id = e.target.dataset.rec;
    const rec = (await records()).find((x) => x.id === id);
    if (!rec) return;
    if (Number.isFinite(v) && v >= 50 && v <= 100 && e.target.value !== '') rec.exp.oximeter = Math.round(v); else delete rec.exp.oximeter;
    await c.saveSession(rec);
    await renderResult(rec);
  });

  async function renderTile() {
    const list = await records();
    const body = $('expTileBody');
    if (!body) return;
    const done = CHECKS.map((k) => {
      const mine = list.filter((x) => x.exp.check === k.id && x.exp.ok);
      if (!mine.length) return null;
      const last = mine[mine.length - 1], ref = mine.length > 1 ? mine[0] : null;
      const v = compareExp(k.id, last.exp, ref ? ref.exp : null).verdict;
      return `<li>${esc(k.title)}: ${fmtDate(last.createdAt)} · <span class="${v === 'different' ? 'warnline' : ''}">${v === 'reference' ? 'first check' : v === 'different' ? 'differs from first' : 'no change beyond bands'}</span></li>`;
    }).filter(Boolean);
    body.innerHTML = done.length ? `<ul class="today-list">${done.join('')}</ul><p><button type="button" class="btn" data-nav="exp">Open experimental checks</button></p>`
      : '<p>Nine short checks with the camera, motion sensor or touchscreen, each compared with your own first result.</p><p><button type="button" class="btn primary" data-nav="exp">Try the experimental checks</button></p>';
  }

  /* ---------- wiring ---------- */
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-exp-open]');
    if (o) { open(o.dataset.expOpen); return; }
    if (e.target.closest('[data-exp-menu]')) { reset(); return; }
    if (e.target.closest('[data-exp-last]')) { records().then((list) => { const last = list.filter((x) => x.exp.check === ex.check && x.exp.ok).pop(); if (last) renderResult(last); }); return; }
    const ag = e.target.closest('[data-exp-again]');
    if (ag) { const id = ag.dataset.expAgain || ex.check; if (!CHECKS.some((x) => x.id === id)) { reset(); return; } open(id); go(); }
  });
  $('btnExpGo').addEventListener('click', go);
  $('btnExpBack').addEventListener('click', reset);
  $('btnExpEvidence').addEventListener('click', () => c.openEvidence(EVKEY[ex.check]));
  $('expLayerStop').addEventListener('click', () => { stop(); $('btnExpGo').disabled = false; $('expCoach').textContent = 'Stopped. Nothing was saved.'; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('expLayer').hidden) $('expLayerStop').click(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && ex.running) { stop(); $('btnExpGo').disabled = false; $('expCoach').textContent = 'Stopped because the app was hidden. Nothing was saved.'; } });
  $('btnExpCsv').addEventListener('click', async () => c.download('relaisecho-experimental-checks.csv', expCsv(await records()), 'text/csv'));

  return { reset, stop, renderTile, isRunning: () => ex.running };
}
