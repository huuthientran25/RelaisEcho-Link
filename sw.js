// Offline cache for the app shell, the MediaPipe runtime and (if bundled) the face model.
const CACHE = 'relaisecho-v12';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/main.js', 'js/config.js', 'js/vision.js', 'js/geometry.js', 'js/frame.js', 'js/align.js',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'fonts/noto-sans-canadian-aboriginal-canadian-aboriginal-400-normal.woff2', 'fonts/noto-sans-canadian-aboriginal-canadian-aboriginal-700-normal.woff2',
  'js/dsp.js', 'js/mock.js', 'js/pulse.js', 'js/resp.js', 'js/dental.js', 'js/store.js', 'js/packet.js', 'js/evidence.js', 'js/board.js', 'js/pvt.js', 'js/i18n.js', 'js/qr.js', 'js/crew.js', 'js/change.js', 'js/eyes.js', 'js/speech.js', 'js/backup.js', 'vendor/qrcode/qrcode.mjs', 'data/osd575-cmp.json',
  'vendor/mediapipe/vision_bundle.mjs', 'vendor/mediapipe/wasm/vision_wasm_internal.js', 'vendor/mediapipe/wasm/vision_wasm_internal.wasm',
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
