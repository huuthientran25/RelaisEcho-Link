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

## Changes in v0.17 to v0.19, released together as v0.19 (15 Nov 2026)

- **v0.17, new logo and amber palette.** The team's amber logo replaces the old mark (top bar, home page, app icons). Light mode: warm ivory `#F0E4D2` ground, charcoal `#17191C` ink, amber `#EFA951` primary buttons. Dark mode: charcoal ground, ivory ink, amber accents. Dark follows the device setting until the person picks Light or Dark (remembered); it replaces the earlier red night mode. Text pairs checked at 5.3:1 or better (links on ivory), most above 7:1.
- **v0.18, frame rate limits relaxed.** Frames are rejected only below 8 analysed frames per second (was 12; a pulse up to 3 Hz needs more than 6). Between 8 and 12 the scan continues with a "low frame rate, results less certain" note. The smoothness rule that analyses every second frame now only kicks in when the camera is fast enough (24 fps or more), so slow webcams are never halved.
- **v0.19, automatic dental comparison with the baseline** (compare screen, EXPERIMENTAL). Inside the mouth outline, tooth-like and gum-like pixels are compared in CIELAB: tooth yellowness (b*), tooth lightness (L*), gum redness (a*), visible tooth area, and a change map overlay. A lighting check runs first; if brightness differs by more than 8 L* units, colours are not compared. Results go into the review packet and the nurse view. Limits are MODELED design choices, not validated thresholds, and no condition is detected.
- 42 unit tests.

## Changes in v0.13 to v0.16, released together as v0.16 (15 Nov 2026)

- **v0.13, several people on one device.** A "Checkups for" bar picks the person; every checkup, baseline, reaction test, trend, bench test, export, restore and delete is scoped to that person. Fits a shared station laptop or a family or clinic tablet. Names stay on the device and are never put in packets. Checkups from before profiles exist belong to "Me".
- **v0.14, explore with sample data.** One button creates a clearly labelled "Sample crew member (invented data)" profile with 12 checkups over two weeks, 6 watch references and 5 reaction tests, including a short sleep stretch where pulse rises and reactions slow. Judges and new users can see every screen filled in without a camera. The numbers are invented and deterministic.
- **v0.15, trends in History.** Pulse and breathing over time with the original baseline line and the noise band (published, or your own bench error once you have 5 pairs). Points beyond the band are red, low quality captures hollow. A value on the edge of the band now counts as noise, since estimates are whole numbers.
- **v0.16, nurse side packet viewer.** "Open a review packet" (home page) shows a packet file in the browser with no upload: results with quality, change against the original baseline with the band used, recent values, reaction test, self report, dental photos with the sender's marks, and what was not assessed. Images must be JPEG or PNG data URLs; anything else is refused. "Show a sample packet" demonstrates it with invented data. Packets now include the change assessment.
- 38 unit tests.

## Changes in v0.10 to v0.12, released together as v0.12 (15 Nov 2026)

- **v0.10, spoken coaching** (checkbox in setup, remembered): the device's own speech engine reads the coach messages aloud during the scan and dental capture, in English or French to match the language setting. Speaks only when the message changes, at most every 2 s, always the latest. Useful when you are holding still and cannot read the screen.
- **v0.11, night mode** (Night/Day in the top bar, remembered): dim, red-shifted palette with no pure white, every text pair at least 7:1 contrast. Meant for checking the board at night; it makes no sleep or health claim. QR codes stay black on white so they still scan. For camera checkups, a lit room matters more than the screen colour.
- **v0.12, restore from backup** (History): load an "Export all" file onto a new device or after clearing the browser. Nothing is overwritten, checkups already present are skipped, and the device's own original baseline stays the original. Invalid files are refused with a reason.
- 36 unit tests.

## Changes in v0.7 to v0.9, released together as v0.9 (15 Nov 2026)

- **v0.7, inflammation markers from NASA OSDR OSD-575.** 12 markers from the Eve Technologies cardiovascular and immune panels (CRP, fibrinogen, haptoglobin, alpha-1 acid glycoprotein, serum amyloid P, IL-6, IL-8, IL-10, TNF-alpha, interferon gamma, MCP-1, IP-10) join the 15 metabolic tests, grouped by panel. They have no clinical reference range, so only each person's own pre-flight range is shown. From the data: 20 of 48 day-after-landing values rose above that person's highest pre-flight value; IL-6 rose above it in all four crew members. Built by `scripts/build_osd575.py` with the two extra CSVs.
- **v0.8, "Today" checklist** at the top of the Mission board: baseline first, then today's checkup (with the baseline time of day), the alertness test (prompted when last night's sleep was under 6 hours), and a rest reminder when the sleep model is above its band. Done items are ticked. A checklist, not a score.
- **v0.9, your own bench error.** History shows the app's error against the reference values you entered (pairs, mean error, bias). With 5 or more pairs, the change-against-baseline noise band switches from published figures to twice your own mean error (minimum 2, MODELED rule), and results say which source was used.
- 33 unit tests.

## Changes in v0.6 (15 Nov 2026)

- **Blinks and eye closure during the alertness check** (optional checkbox). The front camera tracks eyelid landmarks at up to 15 frames a second; eye opening is lid height over eye width (eye aspect ratio, Soukupová and Čech 2016) against the person's own open-eye value. Reports blinks per minute, percent of time eyes closed and closures of half a second or longer, plus how much of the test was tracked (no result under 50%). Thresholds are MODELED. Camera tests are compared only with camera tests, because analysis can add delay. Camera stops when the test ends.
- **Install for offline use** button (Chromium browsers), with 192 and 512 px PNG icons in the navy palette. Verified that the browser offers installation.
- Global `[hidden]` rule so hidden buttons never show.
- 30 unit tests.

## Changes in v0.5 (15 Nov 2026)

- **NASA open data: Inspiration4 crew blood tests** (new screen, tile on the Mission board). OSDR OSD-575 comprehensive metabolic panel for the 4 crew, 3 draws before and 4 after the 2021 flight, against the lab's population range and each person's own pre-flight range. Across 15 tests, 23 of 60 day-after-landing results were inside the population range but outside that person's own pre-flight values, and 11 of 180 pre-flight results would already be flagged by the population range. This is the case for RelaisÉcho's own-baseline design, shown on real astronaut data. Three pre-flight values is a small baseline; the screen says so.
- **Change against baseline with a noise band**: results now say whether a difference beats the method's typical error (pulse ±8 bpm, breathing ±3 /min, MODELED from published figures until the bench test replaces them), and warn when the checkup is far from the baseline's time of day.
- **QR code of the text summary** on the packet screen: a nurse can scan it off the screen with any phone, no internet. Text only, no photos; refused above 1200 bytes. Verified by decoding the rendered code (jsQR) and matching it to the summary text exactly.
- 27 unit tests.

## Changes in v0.4 (15 Nov 2026)

- **Alertness check** (new screen, tile on the Mission board): a 3 minute brief psychomotor vigilance test in the style of PVT-B (Basner, Mollicone and Dinges 2011): random 1 to 4 s waits, a millisecond counter, lapses at 355 ms or slower, false starts under 100 ms. Reports median reaction time, lapses and false starts, a dot chart across the test, and the change against your first full test on the same device (10% band, MODELED). A 1 minute practice is not saved. Responses use the event's own timestamp; the test stops if the app is hidden. EXPERIMENTAL: screen and input delay are included, so results are only compared on the same device. The latest test within 24 hours of a checkup is added to the review packet. Jones et al. 2022 linked 6 h or less of sleep to worse PVT-B scores in ISS astronauts. PVT-B constants are from the cited paper as recalled by the team; check them against the paper before the final submission.
- **Language selector** (English, Français, ᐃᓄᒃᑎᑐᑦ). French is a draft for the home page, board and alertness intro; other screens stay English. Inuktitut shows the syllabics name and a notice, and falls back to English: every string has an empty slot in `lang/translation-template.json` for a certified translator. No machine translation. Syllabics use the bundled Noto Sans Canadian Aboriginal (OFL), loaded only when syllabics appear.
- 23 unit tests, including one that fails if a translatable string lacks its French draft.

## Changes in v0.3 (15 Nov 2026)

- **Mission board** (new screen, button on home and in the top bar). Separate labelled tiles, no combined score:
  - *Checkup rhythm* (LIVE): checkup days this week, and whether now is within 2 hours of the baseline time of day.
  - *Sleep pressure* (MODELED): Process S of the two process model with the published time constants (Daan, Beersma and Borbély 1984: 18.2 h rise, 4.2 h decay, threshold 0.67 ± 0.12). Context: Barger et al. 2014 (ISS sleep about 6.1 h vs 8.5 h scheduled); Jones et al. 2022 (6 h or less linked to worse PVT-B in ISS crew). The circadian phase is not measured, so it is drawn as a band only.
  - *Radiation budget* (PUBLISHED): days on the ISS times a published daily dose range (0.4 to 0.85 mSv/day) against the **NASA-STD-3001** career limit of 600 mSv.
  - *Brain clearance and sleep* (EDUCATIONAL): Barisano et al. 2022 PNAS; the open Miao 2024 vs Plá 2025 debate. No number shown.
- **Smoother interface on 60 Hz and faster screens.** Face tracking shares the page's thread. When it takes more than 12 ms a frame, every second camera frame is analysed (15 per second is plenty for a pulse up to 3 Hz) so buttons, scrolling and the progress bar keep up. The scan screen shows screen fps, camera fps, analysed fps and ms per frame. Progress bar animates with a transform, chips and coach text update only when they change. Camera capture is requested at 30 fps again (v0.2 asked for 60, which costs exposure and gives no better pulse). Test: `?mock=1&slow=20` simulates a slow device; synthetic pulse and breathing still pass at half rate.
- Home page: the "What it refuses to do" card is replaced by "What is new here". Limits stay in each Evidence drawer and the "How the quality checks work" note.
- Evidence drawers now give published error figures: rPPG error rises on the darkest skin types (meta analysis, about 4 to 14 bpm); motion breathing about 1.3 breaths/min from chest vs 2.0 from head (IEEE EMBC 2022). Cold skin is untested.
- 18 unit tests (`npm test`).

## Changes in v0.2 (15 Nov 2026)

Made after the first real scans on a laptop webcam (four checkups, one Apple Watch reference).

- **Breathing never ran** in those scans: the torso box sat below the bottom of the frame. Added a narrow **neck band** under the chin plus two **head channels** (vertical bob and tilt). Each channel is analysed separately, the best one is used, and all are listed on the results card. A peak stuck at the edge of the breathing band is ignored as drift. These channels are EXPERIMENTAL and unvalidated: bench test them against a metronome and publish failures.
- **Alignment and stillness checks now have hysteresis** (`holdSlack`, `motionHoldSlack` in `js/config.js`, both MODELED), so edge wobble does not reset the timer. Each checkup also records which alignment axis kept failing (`alignRejects`).
- **Pulse message fixed**: a low confidence result now says why (for example only 3 of 15 windows were clean).
- **Frame rate**: the camera is asked for 60 fps when available. The scan screen shows measured camera fps, tracking time per frame and skipped frame share, and each checkup records them. The camera, not the app, sets the real limit; most laptop webcams run at 30. Higher frame rates do not make the pulse estimate better by themselves, and dim light often forces the camera back to a lower rate.
- **History**: a baseline can be made the original baseline after a confirmation. Earlier baselines stay.
- **Northern Navy restyle**: white ground, dark grey text, navy structure, one blue for actions, one red for things to fix, Atkinson Hyperlegible bundled (OFL). Buttons change colour on hover (only where a pointer exists) and on keyboard focus.
- Bench CSV gains `resp_channel` and `camera_fps` columns.

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
