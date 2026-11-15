# Licences

## This project

Original code and content: Apache License 2.0 (see `LICENSE`).

## Third party software and models

| Component | Use | Licence | Where stated |
| --- | --- | --- | --- |
| MediaPipe Tasks Vision (`@mediapipe/tasks-vision` 1.2.3), vendored in `vendor/mediapipe/` | Face landmark runtime (JS and WebAssembly) | Apache License 2.0 | npm package metadata `"license": "Apache-2.0"` |
| MediaPipe Face Landmarker model (`face_landmarker.task`: BlazeFace short range detector, Face Mesh V2, Blendshape V2) | Face landmarks | Apache License 2.0 | Google MediaPipe model cards for each model |
| qrcode-generator 2.0.4 by Kazuhiko Arase (`vendor/qrcode/qrcode.mjs`) | QR code of the text summary | MIT | header of the vendored file; npm metadata `"license": "MIT"`. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED. |
| Noto Sans Canadian Aboriginal, syllabics subset, weights 400 and 700 (`fonts/`, packaged by `@fontsource/noto-sans-canadian-aboriginal` 5.3.0) | Inuktitut and Cree syllabics | SIL Open Font License 1.1 | `fonts/OFL-Noto-Sans-Canadian-Aboriginal.txt` (Copyright 2022 The Noto Project Authors) |
| Atkinson Hyperlegible, Latin subset, weights 400 and 700 (`fonts/`, packaged by `@fontsource/atkinson-hyperlegible` 5.3.0) | Interface typeface, designed for low vision readers | SIL Open Font License 1.1 | `fonts/OFL-Atkinson-Hyperlegible.txt`; npm package metadata `"license": "OFL-1.1"` |

No other third party code is included. Bundled data: NASA OSDR OSD-575 values, see `DATA_SOURCES.md`. POS pulse extraction, filters, FFT, breathing tracking and dental sharpness checks are written for this project.

Fonts: Atkinson Hyperlegible and Noto Sans Canadian Aboriginal are bundled (see table). Colour palette idea follows the familiar white, dark grey and navy look of Canadian government sites; no government logo, flag or wordmark is used and no affiliation is claimed.

## Deliberately not used

- rPPG-Toolbox: its RAIL licence restricts health inference.
- GPL-3.0 rPPG libraries (for example pyVHR, heartbeat-js): they would force a copyleft licence.
- Research-only or non-commercial datasets (for example UBFC-rPPG, MMPD, SCAMPS, CGMacros): they do not meet the Space Apps rule that non-NASA material be "freely and publicly available without restriction" or OSI licensed.
