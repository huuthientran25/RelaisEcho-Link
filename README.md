# RelaisÉcho Link

Guided camera checkup for people far from specialists, in orbit and in remote northern communities. A phone or laptop camera coaches you into the same position as your baseline, measures only when the capture is good, and prepares a short review packet for a remote practitioner.

NASA Space Apps Challenge 2026, Montreal. Challenge: Create Health Monitoring Software for Astronauts on Space Missions.

**Research prototype. Not a diagnostic device. Not affiliated with or endorsed by NASA or the Canadian Space Agency.**

## What works now

| Feature | Status |
| --- | --- |
| Camera (front or rear) or your own video file as the source | Working |
| Quality gates: face found, distance, brightness, clipped highlights, movement, frame rate | Working; the timer counts only usable seconds |
| Positioning ghost: baseline face outline, coaching ("Come a little closer", "Lower your chin a little") | Working |
| Pulse estimate (POS method), 10 s windows, rejected windows reported | Working |
| Breathing estimate from upper torso movement, with a cycle count cross check | Working |
| Dental photos: front and both sides, head angle, lip opening, light, glare and sharpness gates, levelled and scaled crops | Working |
| Compare: baseline vs today slider, reviewer marks with notes | Working |
| Review packet: text summary and JSON, size shown, optional photos | Working |
| History, bench test CSV export, offline use (service worker) | Working |
| Sample replay | Needs a recording at `samples/sample.mp4` (see Privacy) |
| QR code packet, vision module, OSD-575 imported results channel | Not built yet |

Labels on screen: **LIVE** (camera) or **RECORDED VIDEO** (file), and **EXPERIMENTAL** on every estimate until the bench test says more.

## Run it

```sh
npm test                      # signal processing unit tests (Node 18+), no dependencies
python3 -m http.server 8080   # then open http://localhost:8080
```

Camera access needs `localhost` or HTTPS. On a phone, use the deployed HTTPS link.

The face model (`face_landmarker.task`, about 3.6 MB) is downloaded from Google on first use. To make the app work fully offline, bundle it:

```sh
sh scripts/fetch-model.sh     # saves models/face_landmarker.task
```

### Deploy on GitHub Pages

1. Create a public repository after the hackathon start (14 Nov 2026, 9:00 AM local) and push these files.
2. Settings > Pages > Deploy from branch > `main` / root.
3. The site appears at `https://<user>.github.io/<repo>/`. The `.nojekyll` file is already included.

### Testing without a face model

Open `/?mock=1` to replace the face model with fixed fake landmarks. This is for testing the app's wiring only.

`scripts/make_synthetic_video.py` writes a synthetic video with a known 72 bpm colour pulse and 15 breaths/min torso movement. `tests/e2e_synthetic.mjs` plays it through a fake camera in headless Chrome. On 14 Nov 2026 the full browser pipeline returned **72 bpm and 15 /min** from this video, both as a camera stream and as an H.264 file. This shows the code path works. **It says nothing about accuracy on real people.**

## Bench test (do this with real people)

1. Record a reference at the same time: a fingertip oximeter or watch for pulse, and metronome paced breathing (for example 6, 12 and 20 breaths/min) or a teammate counting breaths.
2. Run a checkup. On the results screen, open "Bench test" and enter the reference values and conditions (for example "window light", "dim", "small head movement").
3. Repeat across lighting conditions and people who agree to take part.
4. History > Export bench test CSV. Report mean absolute error, rejected windows and n, including failures.
5. Also test deliberate failures: cover the lens, wave your head, turn off the lights. The app should refuse with a reason.

Say what the sample cannot show: skin tone coverage, demographic fairness, other devices.

## Privacy

- Video is processed in the browser. Checkups are stored in this browser only (IndexedDB) and leave the device only when you export them.
- **Do not commit face video or photos of anyone to this repository.** The 2026 Space Apps Terms say solutions that include personally identifiable information will not be posted. Publish summary numbers only.
- If you add `samples/sample.mp4`, it becomes public on the deployed site. Use a recording only of a team member who agrees to that, or leave it out and use the video file option during demos.

## How it works

- `js/vision.js` loads MediaPipe Face Landmarker (Apache 2.0).
- `js/geometry.js` computes face size, roll, an approximate turn angle from the nose position between the face edges, and a nose position index for chin up or down. It also defines the skin regions and the torso box.
- `js/align.js` compares the face with the baseline template using apparent size and angle, never centimetres.
- `js/pulse.js` implements POS (Wang et al. 2017): uniform resampling, band pass from 0.7 to 3.0 Hz, and a spectral peak with SNR in 10 s windows (2 s step). Windows that fail capture or signal checks are rejected.
- `js/resp.js` tracks the vertical shift of torso row profiles (correlation plus sub row refinement), band passes from 0.1 to 0.7 Hz, and cross checks with a cycle count.
- `js/dental.js` checks head angle and lip opening per view, picks the sharpest frame (variance of Laplacian), and levels and scales the crop by the mouth corners.
- `js/config.js` holds **every threshold**. All of them are **MODELED** design choices, not clinical cut offs. Change them only with bench test evidence, and note the change here.
- The original baseline is kept forever. Comparisons show the original beside recent checkups, so slow drift never becomes the new normal.

## Limitations

Camera pulse and breathing are experimental and unvalidated in this implementation. Accuracy falls with movement, poor or flickering light, and, according to published work, darker skin tones. Dental photos cover visible front surfaces only, and the app never labels decay or disease. A normal camera cannot see the retina, so no SANS claim is possible. Northern community relevance is a hypothesis to co-develop with local clinicians and communities. No partnership exists.

## Licences and sources

See `LICENSES.md` (software), `DATA_SOURCES.md` (data and references) and `AI_DISCLOSURE.md`.
