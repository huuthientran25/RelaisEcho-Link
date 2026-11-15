// Closing the loop: the reviewer sends back a small reply file; the person loads it and the
// packet shows as acknowledged. No server: the file travels by whatever channel sent the packet.
export const REPLY_STATUSES = {
  ok: 'Reviewed: no action needed',
  recheck: 'Reviewed: please do another checkup',
  contact: 'Reviewed: please contact the clinic',
};

export function makeReply(packet, status, note, now = new Date()) {
  if (!REPLY_STATUSES[status]) throw new Error('unknown status');
  return { schema: 'relaisecho-reply/0.1', checkup_id: packet.checkup.id, checkup_captured: packet.checkup.capturedAt,
    reviewed_at: now.toISOString(), status, status_text: REPLY_STATUSES[status], note: String(note || '').slice(0, 1000) };
}

export function validateReply(r, sessions) {
  if (!r || r.schema !== 'relaisecho-reply/0.1') return { error: 'This file is not a RelaisÉcho reviewer reply.' };
  if (!REPLY_STATUSES[r.status]) return { error: 'The reply has an unknown status.' };
  const s = sessions.find((x) => x.id === r.checkup_id);
  if (!s) return { error: 'This reply is for a checkup that is not on this device for the person selected.' };
  return { session: s };
}

// gzip with the browser's built-in CompressionStream (no library). Returns null where unsupported.
export async function gzipText(text) {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function readMaybeGzip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed packets.');
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  return new TextDecoder().decode(buf);
}
