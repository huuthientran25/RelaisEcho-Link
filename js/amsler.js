// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Eye self check with an Amsler grid: a square grid with a centre dot. The person covers one eye,
// looks at the dot and marks squares where lines look wavy, blurred, dim or missing.
// The standard chart is 10 cm wide with 5 mm squares, read at about 30 cm, so one square spans
// about one degree of the visual field. Results are compared with the person's own first check.
// Shown, not judged: the grid reports what the person marked. It cannot see the optic nerve.

export const N = 20;                    // squares per side
export const CHART_MM = 100;            // standard chart width
export const READ_CM = 30;              // standard reading distance
export const CARD_MM = 85.6;            // width of a bank or ID card (ISO/IEC 7810 ID-1), used to calibrate the screen
export const DEFAULT_PX_PER_MM = 96 / 25.4; // a CSS pixel is 1/96 inch on a typical desktop screen

const rc = (cell) => [Math.floor(cell / N), cell % N];
const valid = (cells) => [...new Set((cells || []).filter((c) => Number.isInteger(c) && c >= 0 && c < N * N))].sort((a, b) => a - b);

// Where on the grid a square sits. The central 4 by 4 squares are the middle of sight.
export function areaOf(cell) {
  const [r, c] = rc(cell);
  if (r >= N / 2 - 2 && r < N / 2 + 2 && c >= N / 2 - 2 && c < N / 2 + 2) return 'centre';
  return `${r < N / 2 ? 'upper' : 'lower'} ${c < N / 2 ? 'left' : 'right'}`;
}

const AREAS = ['centre', 'upper left', 'upper right', 'lower left', 'lower right'];

export function summarize(cells) {
  const v = valid(cells);
  const byArea = AREAS.map((a) => ({ area: a, count: v.filter((c) => areaOf(c) === a).length })).filter((x) => x.count);
  return { count: v.length, byArea, text: v.length ? `${v.length} square${v.length === 1 ? '' : 's'} marked (${byArea.map((x) => `${x.area} ${x.count}`).join(', ')})` : 'nothing marked' };
}

// Squares marked today with no reference mark on or next to them. Marking by hand is not exact,
// so a mark one square away from an old one is treated as the same spot.
export function newSince(today, ref) {
  const t = valid(today), r = valid(ref).map(rc);
  return t.filter((cell) => { const [y, x] = rc(cell); return !r.some(([ry, rx]) => Math.abs(ry - y) <= 1 && Math.abs(rx - x) <= 1); });
}

// eye: 'right' or 'left'. ref is the reference check's vision record, or null on the first check.
export function compareEye(today, ref) {
  const sum = summarize(today);
  if (!ref) return { ...sum, fresh: [], verdict: 'reference', line: sum.count ? `${sum.text}. Saved as your reference.` : 'Nothing marked. Saved as your reference.' };
  const fresh = newSince(today, ref);
  const cleared = newSince(ref, today).length;
  if (fresh.length) {
    const f = summarize(fresh);
    return { ...sum, fresh, verdict: 'new', line: `${f.count} square${f.count === 1 ? '' : 's'} marked that ${f.count === 1 ? 'was' : 'were'} clear in your reference (${f.byArea.map((x) => `${x.area} ${x.count}`).join(', ')}).` };
  }
  return { ...sum, fresh, verdict: 'same', line: sum.count ? `${sum.text}; the same spots as your reference${cleared ? `, ${cleared} fewer` : ''}.` : (cleared ? 'Nothing marked today; your reference had marks.' : 'Nothing marked, same as your reference.') };
}

// Grid size on this screen: true size (100 mm) when it fits, otherwise as large as fits, with the
// reading distance shortened in proportion so one square still spans about one degree.
export function gridSize(pxPerMm, availPx) {
  const ppm = Number.isFinite(pxPerMm) && pxPerMm > 0 ? pxPerMm : DEFAULT_PX_PER_MM;
  const want = CHART_MM * ppm;
  const sizePx = want <= availPx ? Math.round(want) : Math.max(120, Math.floor(availPx / N) * N);
  const mm = sizePx / ppm;
  return { sizePx, cellPx: sizePx / N, mm: Math.round(mm), readCm: Math.round((READ_CM * mm) / CHART_MM), trueSize: mm >= CHART_MM - 3 };
}

export const cleanCells = valid;

// The pieces a review packet carries: counts only, plus what is new against the reference.
export function visionForPacket(rec, refRec) {
  if (!rec?.vision) return null;
  const ref = refRec && refRec.id !== rec.id ? refRec.vision : null;
  const r = compareEye(rec.vision.right, ref ? ref.right : null), l = compareEye(rec.vision.left, ref ? ref.left : null);
  return { date: rec.createdAt, right_eye: r.text, left_eye: l.text, new_vs_reference: ref ? { right: r.fresh.length, left: l.fresh.length, reference_date: refRec.createdAt } : null,
    grid_mm: rec.vision.mm, true_size: !!rec.vision.trueSize, label: 'EXPERIMENTAL Amsler grid self check; what the person marked, not a finding' };
}
