// Test only: a fake face landmarker used when the page is opened with ?mock=1.
// Lets the full flow run without the model file (for example in CI). Never used otherwise.
import { FACE_OVAL, LIPS_OUTER } from './geometry.js';

export function mockLandmarker() {
  return {
    detectForVideo(_video, ts) {
      const wob = 0.002 * Math.sin(ts / 700);
      const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.4, z: 0 }));
      const set = (i, x, y) => { pts[i] = { x: x + wob, y, z: 0 }; };
      FACE_OVAL.forEach((i, k) => { const a = (k / FACE_OVAL.length) * 2 * Math.PI - Math.PI / 2; set(i, 0.5 + 0.12 * Math.cos(a), 0.38 + 0.2 * Math.sin(a)); });
      set(10, 0.5, 0.18); set(152, 0.5, 0.58); set(234, 0.38, 0.4); set(454, 0.62, 0.4);
      set(33, 0.44, 0.33); set(263, 0.56, 0.33); set(1, 0.5, 0.40); set(151, 0.5, 0.25);
      set(50, 0.45, 0.43); set(280, 0.55, 0.43);
      LIPS_OUTER.forEach((i, k) => { const a = (k / LIPS_OUTER.length) * 2 * Math.PI; set(i, 0.5 + 0.045 * Math.cos(a), 0.5 + 0.02 * Math.sin(a)); });
      set(61, 0.455, 0.5); set(291, 0.545, 0.5); set(13, 0.5, 0.495); set(14, 0.5, 0.506);
      return { faceLandmarks: [pts] };
    },
  };
}
