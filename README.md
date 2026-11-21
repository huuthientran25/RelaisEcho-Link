# RelaisÉcho Link

**A guided camera health checkup for people far from a clinic: astronauts in orbit, and remote northern communities.**

A phone or laptop camera coaches the person into the same position as their own first checkup, measures only when the capture is good, compares today with *their own* baseline rather than a population average, and builds a short packet a nurse or flight surgeon can review, down to a 160 character satellite text. Everything runs in the browser and works offline. Video never leaves the device.

**Live demo:** https://huuthientran25.github.io/RelaisEcho-Link/ · **Built by:** Thien Tran (BSc Exercise Science, Concordia University) at the NASA Space Apps Challenge 2026, Montreal, for the challenge *Create Health Monitoring Software for Astronauts on Space Missions*.

> Research prototype. Not a diagnostic device. Not affiliated with or endorsed by NASA or the Canadian Space Agency. The northern use case is a hypothesis to develop with communities; no partnership is claimed.

## Highlights

- **The core idea, tested on NASA data:** in NASA's Inspiration4 crew blood panels (OSDR OSD-575), the inflammation marker IL-6 rose above each crew member's own pre-flight values the day after landing in 4 of 4 people, which chance alone gives about 1 time in 256; set against the published week to week variation of IL-6 in healthy people (about 32%), the size of the rise was clearly beyond normal variation in 1 of the 4. The app also backtests its own idea on this data and reports where it fails: with only three pre-flight values, a personal range flags about as many results as chance would (5 of 108 with a 95% personal range, against about 5.4 expected), so a personal baseline needs more values before it can be trusted. That is why the early warning waits for 8.
- **Camera vital signs in the browser:** pulse (POS method, nine skin regions), breathing (four motion channels), blinks and guided dental photos, with quality gates that refuse to report a number from a bad capture.
- **Early warning, rebuilt on measurement:** an EWMA control chart compares each person's latest checks with their own recent normal. A simulation built on published resting pulse variability (Quer et al. 2020) and a 7 bpm, 7 day illness (Mishra et al. 2020) measures what it can do: about 1 false warning per healthy person per year of daily checks (the first version gave about 6, so the rule was changed), and a week long rise caught in 96% of cases with an accurate sensor, 42% with 5 bpm of sensor error, 26% with a check every 3 days and 6% with weekly checks. So the app says plainly that spot checks with a camera do not detect illness. Each chart also forecasts the next value with a 95% prediction range. Modeled, not validated on real people.
- **The phone's own motion sensor:** a standing balance check (phone held against the chest, eyes open then closed) gives trunk sway in thousandths of g, after a published method validated against a force plate; balance is one of the functions astronauts lose after flight. Hand steadiness uses the same sensor. No camera needed, and beeps guide the eyes closed part.
- **Touchscreen pointing after NASA's Fine Motor Skills study:** targets of two sizes, time to tap, misses and Fitts throughput. NASA found astronauts lose this skill in the first week in orbit and the first month after landing.
- **Illness early warning:** fever, symptoms and the person's own pulse, breathing and temperature, combined the way the DETECT study found works best; with its expected hit and miss rates stated.
- **Camera oxygen saturation, research only:** calibrated to each person against their own oximeter, and shown only when it beats guessing their usual value.
- **Ready for a community led validation study:** see [VALIDATION_PROTOCOL.md](VALIDATION_PROTOCOL.md). No northern validation is claimed.
- **Mission days and recovery:** with a mission clock, charts label days L-3, FD5, R+2 as NASA does, and each measure says when it is back inside the person's own pre-flight range.
- **Mapped to NASA's own risk list:** a table on the Mission board shows which NASA human system risks each measure informs, and what the app cannot measure.
- **Readings from low cost devices:** a fingertip oximeter, a thermometer or a blood pressure cuff can be typed in at each checkup, charted against the person's own baseline and carried in the review packet and the 160 character message, marked as typed in. The camera does not estimate oxygen saturation: the published phone camera study needed a fingertip on the lens and still had a mean error of 5 points.
- **Honest statistics:** a change counts only when it beats the method's measurement noise; each trend is classed as one odd value, a sustained change or a drift; the latest value is reported as a z score against the person's own spread; bench testing against a reference device gives a Bland and Altman agreement plot.
- **Space health context from real data:** radiation budget against NASA-STD-3001, live NASA DONKI space weather, Inspiration4 inflammation after landing (serum and urine) and plasma proteomics (OSD-563), NASA bed rest studies, a two process sleep model fed by a sleep log, and reaction time (PVT-B) after short versus longer nights.
- **Built for low bandwidth and shared devices:** offline after the first visit, several people per device, review packet as file, QR code or satellite text with an integrity fingerprint, English and French.
- **Engineering:** vanilla JavaScript (no framework, no build step), 142 unit tests, 200 automated browser checks, automated accessibility audits (axe-core) with no violations in either language, and every threshold documented as a design choice in one file.

## Try it in one minute (no camera needed)

1. Open the live demo (or run it locally, see below).
2. Home page > **Explore with the full sample**: two weeks of invented checkups for one person plus a sample crew of four, clearly labelled.
3. **Overview**: UTC and local time, a rest suggestion only when the data supports one, headline numbers including mission radiation, and a body chart. Click Heart: pulse sits above its band 3 times in a row, a sustained change, with the early warning and a dashed forecast for the next check.
4. **Board**: sleep pressure with a 7 night log, reaction time against sleep, radiation budget for an ISS or Mars mission, live NASA space weather, Inspiration4 crew blood and inflammation after landing, NASA bed rest studies.
5. **History**: trends against the baseline, and the bench test agreement plot.
6. Home page > **Open a review packet** > **Show a sample packet**: what the nurse sees, its fingerprint check, and the reply that closes the loop.
7. **Language**: switch to Français.

Or let it play by itself: Home page > **30 second captioned demo** (also `/?reel=1`).

## How it was built

I designed the product, chose the features, the data and every threshold, and directed the build over the hackathon weekend and the days after. Most of the code, tests and documentation were written with an AI coding assistant (Claude, Anthropic) under my direction; the logo was made with ChatGPT. Details in `AI_DISCLOSURE.md`. No AI model runs inside the app.

## What it does

| Area | What you get | Label on screen |
| --- | --- | --- |
| Guided checkup | Positioning ghost from your baseline, quality gates (light, distance, movement, frame rate), a timer that counts only usable seconds | LIVE |
| Pulse | POS camera pulse from nine skin regions, 10 s windows, rejected windows reported | EXPERIMENTAL |
| Breathing | Four channels (neck band, upper torso, head bob, head tilt), best one reported with how many agree | EXPERIMENTAL |
| Eyes | Blinks and eye closure during the scan and, optionally, the reaction test | EXPERIMENTAL |
| Dental photos | Front and both sides, levelled and scaled by the mouth corners, baseline against today slider, reviewer marks, colour comparison with a lighting check | EXPERIMENTAL |
| Change against baseline | A difference counts only when it beats the method's noise band (published figures, or your own bench error after 5 reference pairs). Each trend also says whether it is one odd value, a sustained change (3 good quality values in a row outside the band) or a drift inside the band toward its edge | MODELED |
| Derived measures | Own mean, standard deviation, variation and z score of the latest value against the person's own earlier values; heartbeats per breath; Earth adult resting ranges for pulse and breathing as context; BMI with WHO categories and CDC averages (Body measures card, menstrual cycle note for women) | MODELED |
| Bench test | Enter a reference (fingertip oximeter, watch, counted breaths) after a checkup; History shows mean error, bias and a Bland and Altman agreement plot | |
| Alertness | 3 minute reaction test with the published PVT-B settings, compared with your own first test, and after short versus longer nights from the sleep log | EXPERIMENTAL |
| Overview | One screen: a body chart whose regions open trend graphs against your own first value, four headline numbers, a short "look here first" list and the next step; four sample scenarios to explore, a mission clock (day N of M) and one page printing. A reading order, not a score | LIVE |
| Mission board | Today checklist, checkup rhythm, sleep pressure (two process model; filled from the checkup's sleep hours answer, with a 7 night log you can fill in later), daylight by latitude next to the station's 16 sunrises a day, radiation budget for ISS and Mars missions (NASA-STD-3001, Curiosity RAD), live space weather (NASA DONKI), signal delay to Mars today (JPL orbital elements), Inspiration4 crew blood data (NASA OSDR OSD-575), inflammation after landing in serum and urine (OSD-575 and OSD-656 NULISAseq), NASA bed rest fluid shift and exercise (NLSP), brain clearance explainer | LIVE, MODELED, PUBLISHED or NASA DATA per tile |
| Eye grid and eye chart | Amsler grid self check and a tumbling E acuity chart (logMAR, per letter scoring, screen limit stated), one eye at a time, each compared with your own first check; eye opening in mm during the scan | EXPERIMENTAL |
| Experimental checks | Seven short camera checks, each compared only with your own first result: jaw opening (mm, iris scaled), eye following a moving dot (match and delay), pupil light response (screen flash), inner eyelid colour (redness against the white of the eye, confirmed before saving), neck photos before and during a swallow, hand steadiness (phone motion sensor or camera, 3 to 12 Hz), and a pulse timing index plus a colour ratio index (face against an open palm). The last two are indexes, never mmHg or a saturation percentage | EXPERIMENTAL |
| Symptoms | Nine fixed items plus a sleep hours answer ticked before a checkup (plus free text), carried in the packet and counted over 14 days in History; chest pain or shortness of breath shows an urgent care message | |
| Review loop | Nurse view opens with a "Read first" list built from the packet (urgent ticks, changes outside the noise band, sustained changes, low quality captures); a reading order, not a score. Packet as text, JSON, compressed file, QR code, print or a 160 character message for a satellite text messenger; nurse view opens it with no upload; reply file marks it acknowledged | |
| Shared devices | Several people on one device, each with their own baseline and history; "Everyone on this device" on the Overview lists them in reading order (urgent ticks, sustained changes, look again) for a crew tablet or a health centre laptop | |
| Device check | One screen that tests the browser, the real camera frame rate, brightness, face model load and tracking speed, and gives a report to copy (no personal data in it) | |
| Demo reel | A 30 second captioned walk through on the sample data, with built in tab recording | |
| Your data | One screen listing what is stored, what can leave, the three places the app fetches from, and an erase everything button | |
| Access | Works offline after the first visit, installable, English and French (whole interface, Evidence cards, nurse view and demo reel; AI-assisted draft awaiting a fluent reviewer; packet files stay English), Inuktitut slots awaiting a certified translator, five text sizes (Aa−, Aa, Aa+), light and dark, spoken coaching, screen reader checks | |

There is no combined health score on purpose: one number would hide which part changed.

## NASA and partner data used

- **NASA OSDR OSD-575** (SpaceX Inspiration4): comprehensive metabolic panel and Eve Technologies inflammation panels for the four crew members, bundled as `data/osd575-cmp.json`. The app uses it to show why a personal baseline matters: 23 of 60 results the day after landing were inside the lab's population range but outside that person's own pre-flight values, and IL-6 rose above its own pre-flight values in all four crew members.
- **NASA OSDR OSD-563** (Inspiration4 plasma proteomics): group level results; 59 of 1765 proteins differed the day after landing. Summary only, in `data/osd575-cmp.json`.
- **NASA-STD-3001** career radiation limit (600 mSv) and published ISS crew doses for the radiation tile, plus the dose rates **NASA's Curiosity mission (RAD instrument)** measured on the way to Mars and on its surface, so a Mars mission can be compared with the same limit.
- **NASA DONKI** space weather database: solar flares (7 days) and solar energetic particle events (30 days), read live from api.nasa.gov when the person asks. The only part of the app that needs a connection after the first visit, and it fails gracefully without one.
- **JPL Solar System Dynamics** approximate planet positions for the signal delay tile, checked against published Mars close approaches.
- **PVT-B** (Basner, Mollicone and Dinges 2011), the brief reaction test developed with NASA support and used on the ISS, for the alertness check.
- Published spaceflight sleep and brain findings (Barger et al. 2014; Jones et al. 2022; Barisano et al. 2022) as context on the board.

Full list with links: `DATA_SOURCES.md`. Software and font licences: `LICENSES.md`. AI use: `AI_DISCLOSURE.md`.

## What is tested, and what is not

- `npm test`: 142 unit tests on the signal processing, models, data handling and repository checks. No dependencies.
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

## Bench test (do this with real people)

1. Record a reference at the same time: a fingertip oximeter or watch for pulse, and metronome paced breathing (for example 6, 12 and 20 breaths/min) or a teammate counting breaths.
2. Run a checkup. On the results screen, open "Bench test", enter the reference values, tap the conditions (window light, dim light, head movement, skin tone and so on) and a participant code such as P01 (never a name).
3. Repeat across lighting conditions and people who agree to take part.
4. History > **Bench test report (one page)**: pairs, failures, mean absolute error, bias, limits of agreement, error by condition and the agreement plot, ready to print. History > Export bench test CSV gives the raw rows.
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
| `js/acuity.js` | Eye chart: letter sizes, screen limit, the run and logMAR scoring |
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

Camera pulse, breathing, eye and dental colour measures are experimental and unvalidated in this implementation. Accuracy falls with movement, poor or flickering light and darker skin tones. Dental photos cover visible front surfaces only, and the app never labels decay or disease. A normal camera cannot see the retina, so no SANS claim is made. The sleep and radiation tiles are models and published figures, not measurements of you. The early warning is modeled: in simulation it needs daily checks and an accurate sensor to catch a week long rise, and it misses most of them with weekly checks or camera level error. Readings typed in from a person's own devices are passed on as typed; the app cannot check them.

## More

`CHANGELOG.md` (every version), `DATA_SOURCES.md`, `LICENSES.md`, `AI_DISCLOSURE.md`. Licence: Apache 2.0.
