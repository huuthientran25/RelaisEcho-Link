# Licences

## This project

Original code and content: Apache License 2.0 (see `LICENSE`).

## Third party software and models

| Component | Use | Licence | Where stated |
| --- | --- | --- | --- |
| MediaPipe Tasks Vision (`@mediapipe/tasks-vision` 1.2.3), vendored in `vendor/mediapipe/` | Face landmark runtime (JS and WebAssembly) | Apache License 2.0 | npm package metadata `"license": "Apache-2.0"` |
| MediaPipe Face Landmarker model (`face_landmarker.task`: BlazeFace short range detector, Face Mesh V2, Blendshape V2) | Face landmarks | Apache License 2.0 | Google MediaPipe model cards for each model |

No other third party code is included. POS pulse extraction, filters, FFT, breathing tracking and dental sharpness checks are written for this project.

Fonts: none bundled. The app uses system fonts.

## Deliberately not used

- rPPG-Toolbox: its RAIL licence restricts health inference.
- GPL-3.0 rPPG libraries (for example pyVHR, heartbeat-js): they would force a copyleft licence.
- Research-only or non-commercial datasets (for example UBFC-rPPG, MMPD, SCAMPS, CGMacros): they do not meet the Space Apps rule that non-NASA material be "freely and publicly available without restriction" or OSI licensed.
