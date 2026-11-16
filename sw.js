// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Offline cache for the app shell, the MediaPipe runtime and (if bundled) the face model.
const CACHE = 'relaisecho-1.1.0-1e4183034f';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'audio/relaisecho-theme-ai-generated.mp3',
  'css/app.css',
  'data/bedrest-pv.json',
  'data/bedrest-vo2.json',
  'data/osd575-cmp.json',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'fonts/noto-sans-canadian-aboriginal-canadian-aboriginal-400-normal.woff2',
  'fonts/noto-sans-canadian-aboriginal-canadian-aboriginal-700-normal.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/logo-128.png',
  'icons/logo-64.png',
  'icons/logo-blue-128.png',
  'icons/logo-blue-bar-64.png',
  'js/acuity.js',
  'js/align.js',
  'js/amsler.js',
  'js/backup.js',
  'js/board.js',
  'js/change.js',
  'js/config.js',
  'js/crew.js',
  'js/daylight.js',
  'js/delay.js',
  'js/demo.js',
  'js/dental.js',
  'js/dentalcmp.js',
  'js/devicecheck.js',
  'js/dsp.js',
  'js/evidence-fr.js',
  'js/evidence.js',
  'js/exp.js',
  'js/expui.js',
  'js/extras.js',
  'js/eyes.js',
  'js/frame.js',
  'js/geometry.js',
  'js/i18n-fr.js',
  'js/i18n.js',
  'js/main.js',
  'js/mock.js',
  'js/overview.js',
  'js/packet.js',
  'js/privacy.js',
  'js/pulse.js',
  'js/pvt.js',
  'js/qr.js',
  'js/reel.js',
  'js/reply.js',
  'js/resp.js',
  'js/review.js',
  'js/spaceweather.js',
  'js/speech.js',
  'js/store.js',
  'js/symptoms.js',
  'js/vision.js',
  'vendor/mediapipe/vision_bundle.mjs',
  'vendor/mediapipe/wasm/vision_wasm_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_internal.wasm',
  'vendor/qrcode/qrcode.mjs',
];
const OPTIONAL = ['models/face_landmarker.task'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    for (const u of OPTIONAL) { try { await c.add(u); } catch { /* model not bundled */ } }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    self.clients.claim();
  })());
});

// Cache first for same origin files and the remote model; network for everything else.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const cacheable = e.request.method === 'GET' && (url.origin === self.location.origin || url.hostname === 'storage.googleapis.com');
  if (!cacheable) return;
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok && (res.type === 'basic' || res.type === 'cors')) (await caches.open(CACHE)).put(e.request, res.clone());
      return res;
    } catch (err) {
      if (e.request.mode === 'navigate') return caches.match('index.html');
      throw err;
    }
  })());
});
