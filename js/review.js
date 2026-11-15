// Practitioner side: check a packet before showing it. Packets are plain JSON written by buildPacket().
export function validatePacket(p) {
  if (!p || typeof p !== 'object') return 'This file is not a review packet.';
  if (typeof p.schema !== 'string' || !p.schema.startsWith('relaisecho-packet/')) return 'This file is not a RelaisÉcho Link review packet (schema missing).';
  if (!p.checkup || !p.results || !p.results.pulse_bpm || !p.results.breathing_per_min) return 'The packet is missing its results section.';
  if (!Array.isArray(p.dental)) return 'The packet is missing its dental section.';
  return '';
}

// Data URLs only, and only JPEG or PNG, before an image from a packet is shown.
export function safeImage(src) {
  return typeof src === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : null;
}
