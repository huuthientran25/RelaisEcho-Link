#!/usr/bin/env sh
# Downloads the MediaPipe Face Landmarker model (Apache 2.0) so the app works fully offline.
set -e
cd "$(dirname "$0")/.."
mkdir -p models
curl -L -o models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
ls -l models/face_landmarker.task
