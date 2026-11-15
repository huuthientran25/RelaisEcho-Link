# Changelog

Newest first. Every version was built during NASA Space Apps 2026 (14 and 15 Nov 2026).

## Changes in v0.58 (15 Nov 2026)

- **Overview tab: everything on one screen.** A body chart with seven regions (sleep and alertness, eyes, mouth and jaw, neck, heart and circulation, breathing, hands). Each region's dot shows urgent tick, look again, logged or not measured, with a dashed line to its label. Selecting a region plots its measures over time with the person's own first value (or the original baseline) and its band; "Show values" gives the same numbers as a table. Four headline numbers (pulse, breathing, reaction time, last night's sleep), a short "Look here first" list and the next step sit beside it. The Board stays the detailed view. A reading order, not a score.
- **Tabs** under the top bar: Overview, Checkup, Board, Experimental, History; the current one is highlighted.
- **Text size: Aa−, Aa, Aa+.** Five steps from 85% to 150%, applied like browser zoom so layouts reflow instead of overlapping; the camera layers stay full size. Replaces the single A+ toggle (an old "larger text" setting maps to 130%).
- **Dental photos at the baseline's distance.** Each dental photo records how large the iris appears (vertical size, so turning the head does not change it). Later dental photos on the same camera must be within 12% of the original baseline's distance before they count, with "Move closer" or "Move back a little" coaching (English and French). A different camera is named as not comparable. The first dental set shows a rough distance in cm.
- **Sharper camera overlays.** The guide outline and measurement boxes are now drawn at the screen's real pixel density, with rounded corners, a light fill and small labels (forehead, cheek, neck, chest; eyelid, neck, palm, hand in the experimental checks) that read correctly in selfie view.
- **Logo redrawn as a flat vector** (`icons/logo-mark.svg`): corner brackets, an eye and two echo arcs in two colours, no gradients or fake shading. It is inlined in the page so it follows the light and dark themes; app icons are rendered from it. AI disclosure updated.
- 102 unit tests; browser regression extended; no accessibility violations on 11 screens in light and dark.

## Changes in v0.57 (15 Nov 2026)

- **Experimental checks**, a new screen (home page, footer, board tile). Seven guided camera checks, each saved and compared only with the person's own first result of the same check; bands are design choices and a result outside one reads "differs from your first check", never "abnormal". Failed tries are saved as failed, with the reason.
  - Jaw opening: inner lip gap and chin swing in mm, scaled by an assumed 11.7 mm iris width.
  - Eye following: a dot moves at 0.25 cycles per second for 20 s, then holds; how closely and how late the irises follow, catch up jumps, steadiness on the still dot.
  - Pupil light response: 3 s dark, 2 s white screen, 3 s dark; narrowing per eye, time to half narrowing, left against right. Refuses when pupil and iris cannot be told apart, which is common with dark eyes in visible light.
  - Inner eyelid colour: redness index of the pulled down lower eyelid against the white of the same eye; the person confirms the close up before it is saved.
  - Neck check (thyroid area): photos of the lower front neck before and during a swallow, matched to the first check for a reviewer; swallow movements counted. The app looks for nothing in the photos.
  - Hand steadiness: phone motion sensor or camera, each hand 15 s; strongest rhythm in 3 to 12 Hz and its share of all movement.
  - Pulse timing and colour ratio: face and open palm side by side; how much later the palm pulse arrives (a blood pressure related index) and a red over blue pulse ratio (an oxygen related index). Shown as indexes against the first check only, never mmHg or %.
- Packets carry the latest result of each check from the last 14 days (neck and eyelid photos only when "Include photos" is ticked); the nurse view lists them and adds a note to "Read first" when one differs from the first check. History, "Your data", backup restore and a new CSV export include them. Sample data has invented results.
- Evidence drawers for each check cite the studies and say plainly what the check cannot tell.
- 94 unit tests (11 new, synthetic inputs with known answers); browser regression at 93 checks (mock face that opens its mouth and follows the dot); no accessibility violations on 10 screens in light and dark.
- Untested on real faces: iris scale, pupil separation, eyelid boxes and palm timing all need a real person and camera.

## Changes in v0.56 (15 Nov 2026)

- **Camera choice.** When a device has more than one camera (a laptop with a virtual camera from a video call app, an external webcam), the checkup setup shows a "Which camera" list and remembers the pick. If the saved camera is later unplugged, the scan falls back to the automatic choice instead of failing. Untested on real multi camera hardware; the selection logic is unit tested.
- 83 unit tests; browser regression unchanged at 77 checks.

## Changes in v0.55 (15 Nov 2026), includes v0.54

- **v0.54 Board jump bar.** The mission board now has 12 tiles, so a row of links jumps to each one.
- **v0.55 "Read first" in the nurse view.** The reviewer sees a short reading order built only from what the packet states: urgent symptom ticks first, then changes outside the noise band (pulse, breathing, eye grid, dental colour), then low quality captures, then notes. It is not a score and not a finding, and a calm packet says so.
- 82 unit tests; browser regression at 77 checks; no accessibility violations.

## Changes in v0.53 (15 Nov 2026), includes v0.51 and v0.52

- **v0.51 Signal delay tile.** One way light time from Earth to Mars today, the shortest and longest of the coming 26 months, the round trip for a question and its answer, the Moon for comparison, and the next solar conjunction pause. Positions from JPL's approximate orbital elements; the model reproduces the 2003 and 2020 close approaches to within 0.1 million km and the Nov 2023 conjunction window. It explains why the app is built to work without a live clinician.
- **v0.52 Eye grid.** An Amsler grid self check (the ISS vision checks include one): one eye at a time, tap, drag or use the keyboard to mark squares that look wavy, blurred, dim or missing. Optional bank card calibration draws the grid at its true 10 cm; on small screens the reading distance is shortened to match. The first check is the reference; a mark next to an old one counts as the same spot. Counts (never the picture) go into the next review packet, the nurse view, History and the CSV. It cannot detect SANS and says so.
- **v0.53 Your data.** A screen (footer link) that counts what is stored for this person and for the device, lists what can leave and the only three places the app fetches from, and offers a backup and "Erase everything on this device". A unit test fails if the code ever gains an outside address that this screen does not list.
- 81 unit tests; browser regression at 75 checks; no accessibility violations on the new screens.

## Changes in v0.50 (15 Nov 2026), includes v0.48 and v0.49

Demo day batch: find out why a device struggles, record the demo, and give the reviewer structured symptoms.

- **v0.48 Check this device.** A screen (home page link) that lists what the browser supports, then on request opens the camera for about 6 seconds: real frame rate, brightness, face model load time and engine (GPU or CPU), tracking time per frame and how often a face was found. Each line is judged against the scan's own limits in `js/config.js`. The report can be copied or saved; it holds no names, measurements or pictures. Leaving the screen stops the camera. Scan start errors now point to it.
- **v0.49 Demo reel.** Home page > "30 second captioned demo" (or `/?reel=1`): a 3 second countdown, then seven captioned scenes on the invented sample data, exactly 30 seconds, ending on a closing card. "Record it as a video file" records the tab while it plays and saves a `.webm` (or `.mp4` where that is all the browser offers) that stops just before the 30 second mark; "Captions file (.srt)" exports the same subtitles. Esc stops it. The person's own profile and radiation mission are put back afterwards. Checked in headless Chrome: 1280 by 720, 29.85 s. **Not checked: the share prompt on a real desktop browser.**
- **v0.50 Symptom checklist.** Ten fixed items in the checkup setup (headache, stuffy nose or puffy face, vision change, nausea or dizziness, back pain, poor sleep, tooth or gum pain, feverish, short of breath, chest pain) next to the free text. Ticks travel in the packet (JSON, text, QR), show in the nurse view and History rows, are counted over 14 days in History and are added to the results CSV. Ticking chest pain or shortness of breath shows an urgent care message at once and flags the packet. The list is a design choice, not a validated questionnaire, and nothing is scored.
- 72 unit tests; browser regression at 59 checks, plus a recording test.

## Changes in v0.47 (15 Nov 2026), includes v0.45 and v0.46

Space environment batch: three board tiles that tie the checkup to where the person is.

- **v0.45 Radiation budget for a whole mission.** Days in low Earth orbit, in deep space transit and on the Mars surface, with presets (10 day visit, ISS 6 months, ISS about a year, Mars transit only, Mars 180 + 500 + 180 days). Low Earth orbit uses the published ISS range; transit (about 1.8 mSv a day) and Mars surface (0.64 to 0.67 mSv a day) use what NASA's Curiosity mission measured. The Mars preset comes to about 1 Sv, about 1.6 times NASA's 600 mSv career limit, which matches the published total. The bar turns to the alert colour when the low estimate passes the limit.
- **v0.46 Space weather from NASA DONKI.** Strongest solar flare and flare counts for the last 7 days, solar energetic particle events for the last 30. Loaded from api.nasa.gov only when the person presses the button, kept for 3 hours, optional own API key, and a clear message when offline, rate limited or unreachable (the last saved copy stays on screen). **Not yet exercised against the live service**: the build environment could not reach api.nasa.gov, so the parser is tested with invented events only.
- **v0.47 Daylight.** Hours of daylight today for Iqaluit, Kuujjuaq, Rankin Inlet, Pond Inlet, Resolute, Grise Fiord, Montreal or any latitude (NOAA solar equations), including polar night and midnight sun, next to the station's 16 sunrises a day. Checked against known values: Montreal on 15 Nov is about 9 h 32 min.
- Evidence panels and `DATA_SOURCES.md` list the new sources. 64 unit tests; browser regression extended to 41 checks.

## Changes in v0.44 (15 Nov 2026)

Hardening release, and the first one packaged as a single GitHub ready folder.

- **Deploys now replace the offline cache every time.** The service worker cache name is stamped from the version plus a fingerprint of the files (`npm run stamp`), and the offline file list is generated from the repo. From v0.35 to v0.43 the cache name had not changed, so a browser that had visited before could keep showing old code. The page footer now shows the version, so you can see which build is live.
- **Leaving a scan stops the camera.** Opening the board or history during a scan or the dental step used to leave the camera running and could jump back to the results later. Now the camera stops, an unfinished scan is dropped and dental photos already taken are kept.
- **Frame times fall back to the wall clock** when a browser reports a camera frame time that does not advance, instead of stalling the scan timer.
- **Reaction test settings confirmed** against Basner, Mollicone and Dinges 2011: 3 minutes, 1 to 4 s waits, 355 ms lapse threshold, under 100 ms false start. One stated difference: the paper waits 30 s before counting a missed counter, the app 10 s.
- The "Watch sample replay" button appears only when a recording is bundled (`sampleReplay` in `js/config.js`). The sleep tile stops reusing sleep times older than last night. One shared database connection instead of one per read.
- Tests: version named test files merged into four themed files, plus repo checks (stamp is current, every module is in the offline list, **at most 100 files and 25 MiB per file for GitHub's web upload**, no personal exports). 59 tests.
- README rewritten for the current app; the full history moved to this file.

## Changes in v0.43 (15 Nov 2026)

- The packet's text summary (and QR code) includes the automatic dental comparison result per view.

## Changes in v0.42 (15 Nov 2026)

- Crew data screen: download the shown test as CSV (crew by timepoint, lab range, unit, source line), and a DOI link to the OSD-575 study.

## Changes in v0.41 (15 Nov 2026)

- Alertness results note the practice effect for the first three tests run the same way.
- Radiation tile presets: 10 day visit, 6 month increment, about one year.

## Changes in v0.40 (15 Nov 2026)

- History: delete a single checkup or reaction test, with a stronger warning for the original baseline.

## Changes in v0.39 (15 Nov 2026)

- History: every checkup has a "Packet" link that reopens its review packet (download, compress, QR, print, load a reply). Reopening never changes which baseline is the original.

## Changes in v0.38 (15 Nov 2026)

- The board's crew data tile adds the IL-6 finding computed from OSD-575: above its own pre-flight values the day after landing in all four crew members.

## Changes in v0.37 (15 Nov 2026)

- The sample packet in the nurse view now includes a drawn (not photographed) sample mouth with a reviewer mark and the automatic dental comparison, so judges see the dental side without a camera. Result on the drawn pair: teeth more yellow (b* +11.2), gums redder (a* +18.3).

## Changes in v0.36 (15 Nov 2026)

- `AI_DISCLOSURE.md` updated for everything built so far (models, dates, what was generated, the OSD-575 script, the research brief) with a slot for the team to state how the logo was made.

## Changes in v0.35 (15 Nov 2026)

- French drafts for the newer headings (tour, Today, crew data, history, nurse view); translator template regenerated (36 strings).

## Changes in v0.34 (15 Nov 2026)

- Honest offline status in the top bar: "ready offline" only when both the app and the face model are saved on the device; otherwise it says board and history work offline and the model downloads on first camera use. Verified: the app reloads with the network off.

## Changes in v0.33 (15 Nov 2026)

- History can export all results as a CSV for a spreadsheet: date, kind, pulse and breathing with quality and channel, blinks, reaction test, reviewer outcome and a demo flag. No images and no names.

## Changes in v0.32 (15 Nov 2026)

- Review packets now carry the pulse skin regions used and the eyes during the scan (blinks per minute, time closed, long closures; experimental, shown not judged); the text summary and the nurse view show them.

## Changes in v0.29 to v0.31, released together as v0.31 (15 Nov 2026)

- **v0.29, calendar reminders.** The Checkup rhythm tile offers a daily or weekly reminder as an .ics file at the baseline's time of day, for any calendar app, offline and with no notification permission.
- **v0.30, larger text.** "A+" in the top bar raises the base size from 18 to 22 px for low vision readers; remembered on the device.
- **v0.31, photo clean-up and storage use.** History shows how much app data the browser holds and can remove dental photos from checkups older than 30 days; results stay, and the original baseline keeps its photos because every comparison needs them.
- 51 unit tests.

## Changes in v0.26 to v0.28, released together as v0.28 (15 Nov 2026)

- **v0.26, reviewer reply closes the loop.** The nurse view has a "Reply to the sender" form (no action needed, please do another checkup, or please contact the clinic, plus a note) that downloads a small reply file. The person loads it on the packet screen; the status changes to Sent and Acknowledged and the reviewer's outcome and note are shown. Replies only attach to a checkup of the selected person on that device.
- **v0.27, compressed packets.** "Download compressed (.json.gz)" uses the browser's built-in gzip; the nurse view opens .gz packets directly. Test packet: 0.6 KB instead of 1.3 KB.
- **v0.28, one minute tour** on the home page for judges: sample data, board, history, nurse view.
- 49 unit tests.

## Changes in v0.23 to v0.25, released together as v0.25 (15 Nov 2026)

- **v0.23, French live coaching.** Scan and dental coaching, status chips and spoken instructions now follow the French setting (draft text, Canadian French, needs a fluent check). Nunavik is in Quebec, so French matters for the northern use case. A test fails if a new coaching phrase has no French version.
- **v0.24, print.** Print buttons on the packet screen and the nurse view; the print layout drops the controls and prints black on white for a paper file.
- **v0.25, automated accessibility audit.** Every main screen, in light and dark mode, was checked with axe-core: no violations after fixing two (header landmarks for the person bar, and an empty table header).
- 47 unit tests.

## Changes in v0.20 to v0.22, released together as v0.22 (15 Nov 2026)

- **v0.20, blue light mode, amber dark mode.** Light mode now uses the blue logo and its colours: pale blue-white ground `#F4F8FA`, deep teal ink `#0B1F2A`, cyan `#1FD6EC` primary buttons, dark band `#041D2B` top bar. Dark mode keeps the amber logo and charcoal, ivory and amber. The logo in the top bar and on the home page switches with the mode. Checked contrast: ink 15.8:1, links 5.8:1, button text on cyan 9.6:1.
- **v0.21, nine skin regions for the pulse** (was three): forehead centre, left and right, between the brows, upper and lower cheeks on each side, and chin. Each is scored separately after the scan; the clearest up to five are pooled when that beats the standard forehead and cheeks estimate. The result card lists which regions were used and how many gave a clear signal.
- **v0.22, blinks during the resting scan.** Blinks per minute, percent of time eyes closed and long closures are now recorded during the scan too, shown next to the original baseline's values, without a fatigue verdict: blink rate varies too much over 30 seconds. The 3 minute alertness test remains the fatigue check.
- 45 unit tests.

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
