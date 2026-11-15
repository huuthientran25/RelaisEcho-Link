// QR code of the text summary, so a nurse can take it off the screen with any phone camera, no network needed.
// Encoder: qrcode-generator by Kazuhiko Arase (MIT), vendored in vendor/qrcode/.
import { qrcode } from '../vendor/qrcode/qrcode.mjs';

// UTF-8 bytes, so accents and syllabics survive.
qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));

export const QR_MAX_BYTES = 1200; // beyond this, codes get too dense to scan reliably off a laptop screen

export function qrSvg(text, { ec = 'M', quiet = 4 } = {}) {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > QR_MAX_BYTES) return { ok: false, bytes };
  const q = qrcode(0, bytes > 600 ? 'L' : ec);
  q.addData(text, 'Byte');
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  const size = n + quiet * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code of the text summary"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  return { ok: true, svg, bytes, modules: n, version: (n - 17) / 4 };
}
