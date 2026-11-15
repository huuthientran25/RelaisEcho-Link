// Loads the MediaPipe Face Landmarker (library and model are Apache 2.0, see LICENSES.md).
// Model file: served from ./models/ when present (offline), otherwise from Google's model bucket.

import { FaceLandmarker, FilesetResolver } from '../vendor/mediapipe/vision_bundle.mjs';

const MODEL_LOCAL = new URL('../models/face_landmarker.task', import.meta.url).href;
const MODEL_REMOTE = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const WASM_BASE = new URL('../vendor/mediapipe/wasm', import.meta.url).href;

let instance = null;
let modelSource = '';
let delegateUsed = '';
export const MODEL_URLS = { local: MODEL_LOCAL, remote: MODEL_REMOTE };

async function exists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

export async function getFaceLandmarker() {
  if (instance) return instance;
  if (new URLSearchParams(location.search).has('mock')) {
    const { mockLandmarker } = await import('./mock.js');
    modelSource = 'MOCK landmarks for testing (not a real face model)';
    delegateUsed = 'mock';
    instance = mockLandmarker();
    return instance;
  }
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const local = await exists(MODEL_LOCAL);
  modelSource = local ? 'bundled model (works offline)' : 'model downloaded from Google (needs internet once)';
  const path = local ? MODEL_LOCAL : MODEL_REMOTE;
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: path, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
  try {
    instance = await FaceLandmarker.createFromOptions(fileset, options('GPU'));
    delegateUsed = 'GPU';
  } catch (e) {
    console.warn('GPU delegate failed, using CPU', e);
    try {
      instance = await FaceLandmarker.createFromOptions(fileset, options('CPU'));
      delegateUsed = 'CPU';
    } catch (e2) {
      const err = new Error(local
        ? 'The bundled face model could not be loaded.'
        : 'Could not download the face model. Connect to the internet once, or bundle it with scripts/fetch-model.sh.');
      err.cause = e2;
      throw err;
    }
  }
  return instance;
}

export function getModelSource() {
  return modelSource;
}

// 'GPU', 'CPU' or 'mock': which engine the face model ended up on. Empty until the model has loaded.
export function getDelegate() {
  return delegateUsed;
}

let lastTs = 0;
// Timestamps passed to MediaPipe must strictly increase.
export function detect(landmarker, video) {
  let ts = performance.now();
  if (ts <= lastTs) ts = lastTs + 1;
  lastTs = ts;
  const res = landmarker.detectForVideo(video, ts);
  return res.faceLandmarks && res.faceLandmarks.length ? res.faceLandmarks[0] : null;
}
