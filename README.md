# RelaisÉcho Link

**A guided camera checkup for people far from a clinic: in orbit, and in remote northern communities.**

A phone or laptop camera coaches you into the same position as your own baseline, measures only when the capture is good, compares today with your baseline rather than with a population average, and builds a small packet a nurse or flight surgeon can review. Everything runs in the browser. Video never leaves the device.

NASA Space Apps Challenge 2026, Montreal. Challenge: *Create Health Monitoring Software for Astronauts on Space Missions.*

> Research prototype. Not a diagnostic device. Not affiliated with or endorsed by NASA or the Canadian Space Agency. The northern use case is a hypothesis to develop with communities; no partnership is claimed.

## Try it in one minute (no camera needed)

1. Open the app (GitHub Pages link in the repository's About box, or run it locally, see below).
2. Home page > **Explore with sample data**: two weeks of invented checkups, clearly labelled.
3. **Mission board**: today's checklist, alertness, sleep pressure, daylight, radiation budget for an ISS or Mars mission, live NASA space weather, NASA crew blood data.
4. **History**: trends against the baseline with a measurement noise band.
5. Home page > **Open a review packet** > **Show a sample packet**: what the nurse sees, and the reply that closes the loop.

Or let it play by itself: Home page > **30 second captioned demo** (also `/?reel=1`). **Record it as a video file** saves the same 30 seconds as a video, and **Captions file (.srt)** gives the subtitles as a separate track.

## What it does

| Area | What you get | Label on screen |
| --- | --- | --- |
| Guided checkup | Positioning ghost from your baseline, quality gates (light, distance, movement, frame rate), a timer that counts only usable seconds | LIVE |
| Pulse | POS camera pulse from nine skin regions, 10 s windows, rejected windows reported | EXPERIMENTAL |
| Breathing | Four channels (neck band, upper torso, head bob, head tilt), best one reported with how many agree | EXPERIMENTAL |
| Eyes | Blinks and eye closure during the scan and, optionally, the reaction test | EXPERIMENTAL |
| Dental photos | Front and both sides, levelled and scaled by the mouth corners, baseline against today slider, reviewer marks, colour comparison with a lighting check | EXPERIMENTAL |
| Change against baseline | A difference counts only when it beats the method's noise band (published figures, or your own bench error after 5 reference pairs) | MODELED |
| Alertness | 3 minute reaction test with the published PVT-B settings, compared with your own first test | EXPERIMENTAL |
| Overview | One screen: a body chart whose regions open trend graphs against your own first value, four headline numbers, a short "look here first" list and the next step; four sample scenarios to explore, a mission clock (day N of M) and one page printing. A reading order, not a score | LIVE |
| Mission board | Today checklist, checkup rhythm, sleep pressure (two process model), daylight by latitude next to the station's 16 sunrises a day, radiation budget for ISS and Mars missions (NASA-STD-3001, Curiosity RAD), live space weather (NASA DONKI), signal delay to Mars today (JPL orbital elements), Inspiration4 crew blood data (NASA OSDR OSD-575), brain clearance explainer | LIVE, MODELED, PUBLISHED or NASA DATA per tile |
| Eye grid | Amsler grid self check, one eye at a time, compared with your own first check; counts travel in the packet | EXPERIMENTAL |
| Experimental checks | Seven short camera checks, each compared only with your own first result: jaw opening (mm, iris scaled), eye following a moving dot (match and delay), pupil light response (screen flash), inner eyelid colour (redness against the white of the eye, confirmed before saving), neck photos before and during a swallow, hand steadiness (phone motion sensor or camera, 3 to 12 Hz), and a pulse timing index plus a colour ratio index (face against an open palm). The last two are indexes, never mmHg or a saturation percentage | EXPERIMENTAL |
| Symptoms | Ten fixed items ticked before a checkup (plus free text), carried in the packet and counted over 14 days in History; chest pain or shortness of breath shows an urgent care message | |
| Review loop | Nurse view opens with a "Read first" list built from the packet (urgent ticks, changes outside the noise band, low quality captures); a reading order, not a score. Packet as text, JSON, compressed file, QR code or print; nurse view opens it with no upload; reply file marks it acknowledged | |
| Shared devices | Several people on one device, each with their own baseline and history | |
| Device check | One screen that tests the browser, the real camera frame rate, brightness, face model load and tracking speed, and gives a report to copy (no personal data in it) | |
| Demo reel | A 30 second captioned walk through on the sample data, with built in tab recording | |
| Your data | One screen listing what is stored, what can leave, the three places the app fetches from, and an erase everything button | |
| Access | Works offline after the first visit, installable, English and French (draft), Inuktitut slots awaiting a certified translator, five text sizes (Aa−, Aa, Aa+), light and dark, spoken coaching, screen reader checks | |

There is no combined health score on purpose: one number would hide which part changed.

## NASA and partner data used

- **NASA OSDR OSD-575** (SpaceX Inspiration4): comprehensive metabolic panel and Eve Technologies inflammation panels for the four crew members, bundled as `data/osd575-cmp.json`. The app uses it to show why a personal baseline matters: 23 of 60 results the day after landing were inside the lab's population range but outside that person's own pre-flight values, and IL-6 rose above its own pre-flight values in all four crew members.
- **NASA-STD-3001** career radiation limit (600 mSv) and published ISS crew doses for the radiation tile, plus the dose rates **NASA's Curiosity mission (RAD instrument)** measured on the way to Mars and on its surface, so a Mars mission can be compared with the same limit.
- **NASA DONKI** space weather database: solar flares (7 days) and solar energetic particle events (30 days), read live from api.nasa.gov when the person asks. The only part of the app that needs a connection after the first visit, and it fails gracefully without one.
- **JPL Solar System Dynamics** approximate planet positions for the signal delay tile, checked against published Mars close approaches.
- **PVT-B** (Basner, Mollicone and Dinges 2011), the brief reaction test developed with NASA support and used on the ISS, for the alertness check.
- Published spaceflight sleep and brain findings (Barger et al. 2014; Jones et al. 2022; Barisano et al. 2022) as context on the board.

Full list with links: `DATA_SOURCES.md`. Software and font licences: `LICENSES.md`. AI use: `AI_DISCLOSURE.md`.

## What is tested, and what is not

- `npm test`: 104 unit tests on the signal processing, models, data handling and repository checks. No dependencies.
- A synthetic video with a known 72 bpm colour pulse and 15 breaths per minute runs through the whole browser pipeline (`tests/e2e_synthetic.mjs`) and returns 72 and 15. This shows the code path works.
- An automated accessibility audit (axe-core) of eight screens (home, board, history, crew data, reaction test, nurse view, checkup setup, device check) in light and dark mode found no violations at v0.50.
- **Not shown: accuracy on real people.** Camera pulse error is known to rise on darker skin (a published meta analysis reports about 4 beats per minute for Fitzpatrick types I to V and about 14 for type VI), cold skin is untested, and every threshold in `js/config.js` is a design choice. That is why every estimate is labelled EXPERIMENTAL and the app refuses to give a number when a capture fails its checks.

## Run it

```sh
npm test                      # unit tests (Node 22), no dependencies
python3 -m http.server 8080   # then open http://localhost:8080
```

Camera access needs `localhost` or HTTPS. `/?mock=1` replaces the face model with fixed fake landmarks, for testing the wiring only.

The face model (`face_landmarker.task`, about 3.6 MB) downloads from Google on first camera use and is then kept for offline use. To bundle it instead: `sh scripts/fetch-model.sh`.

After changing any file, run `npm run stamp`. It updates the version in the footer and the offline cache name, so browsers pick up the new build. `npm test` fails if you forget.

### Upload to GitHub in the browser

GitHub's web upload takes at most 100 files at a time and 25 MiB per file. This repository is kept under both (a test enforces it), so one drag and drop is enough:

1. Unzip the package. Open the folder that contains `index.html`.
2. Select everything inside it (Ctrl+A) and drag it onto the repository's **Add file > Upload files** page.
3. Commit. Settings > Pages > Deploy from a branch > `main`, root.
4. Open the site and check the version in the page footer.

## Bench test (do this with real people)

1. Record a reference at the same time: a fingertip oximeter or watch for pulse, and metronome paced breathing (for example 6, 12 and 20 breaths/min) or a teammate counting breaths.
2. Run a checkup. On the results screen, open "Bench test" and enter the reference values and conditions (for example "window light", "dim", "small head movement").
3. Repeat across lighting conditions and people who agree to take part.
4. History > Export bench test CSV. Report mean absolute error, rejected windows and n, including failures.
5. Also test deliberate failures: cover the lens, wave your head, turn off the lights. The app should refuse with a reason.

Say what the sample cannot show: skin tone coverage, demographic fairness, other devices.

## Privacy

- Video is processed in the browser. Checkups are stored in this browser only (IndexedDB), per person, and leave the device only when you export them.
- Names of people on a shared device stay on the device and are never written into packets.
- **Do not commit face video, photos or exported checkups to this repository.** A test fails if an exported file is found in the repo.
- If you add `samples/sample.mp4`, it becomes public on the deployed site. Use a recording only of an adult team member who agrees to that.

## How it works

| File | Role |
| --- | --- |
| `js/vision.js`, `js/geometry.js`, `js/align.js` | MediaPipe Face Landmarker (Apache 2.0), face size and angles, skin and breathing regions, positioning against the baseline template |
| `js/pulse.js`, `js/resp.js`, `js/dsp.js`, `js/frame.js` | POS pulse (Wang et al. 2017), breathing channels, filters and spectra written for this project, pixel sampling and frame timing |
| `js/eyes.js`, `js/pvt.js` | Eye aspect ratio blinks; reaction test scoring |
| `js/overview.js` | Overview body chart: region status, series and the SVG line chart |
| `js/exp.js`, `js/expui.js` | Experimental checks: measurements (unit tested on synthetic input) and the guided screens |
| `js/dental.js`, `js/dentalcmp.js` | Guided mouth crops; CIELAB colour comparison with a lighting check |
| `js/change.js`, `js/board.js`, `js/crew.js` | Noise bands and bench error; sleep, radiation and today models; OSD-575 summaries |
| `js/packet.js`, `js/review.js`, `js/reply.js`, `js/qr.js` | Review packet, nurse view checks, reply and compression, QR code |
| `js/store.js`, `js/backup.js`, `js/demo.js`, `js/extras.js` | Local storage per person, backup and restore, sample data, reminders and exports |
| `js/i18n.js`, `js/speech.js`, `js/evidence.js` | Languages, spoken coaching, the Evidence text behind every number |
| `js/config.js` | **Every threshold.** All are MODELED design choices, not clinical cut offs |
| `sw.js`, `scripts/stamp_sw.mjs` | Offline cache, stamped per build |

The original baseline is kept on purpose, so slow drift never becomes the new normal.

## Limitations

Camera pulse, breathing, eye and dental colour measures are experimental and unvalidated in this implementation. Accuracy falls with movement, poor or flickering light and darker skin tones. Dental photos cover visible front surfaces only, and the app never labels decay or disease. A normal camera cannot see the retina, so no SANS claim is made. The sleep and radiation tiles are models and published figures, not measurements of you.

## More

`CHANGELOG.md` (every version), `DATA_SOURCES.md`, `LICENSES.md`, `AI_DISCLOSURE.md`. Licence: Apache 2.0.
