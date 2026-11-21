# Changelog

Newest first. Every version was built during NASA Space Apps 2026 (14 and 15 Nov 2026).

## v2.10 (21 Nov 2026): mission day labels, return to baseline, one primary button everywhere

Numbered 2.10, not 3.0: under semantic versioning a major number means a breaking change, and nothing here breaks saved data, packets or links.

- **Mission day labels.** With a mission clock set, chart dates also show the day as NASA writes it: L-3 (three days before launch), FD5 (fifth flight day), R+2 (two days after landing, landing being the end of the clock). `missionLabel` in `js/overview.js`.
- **Return to baseline after landing.** For each measure on Overview: the person's pre-flight range (95% prediction range from at least 3 good pre-flight checks) and whether the measure is back inside it, counted as two checks in a row inside. Says since which R+ day, or that it is still outside, with context: about 95% of the Inspiration4 crew's measured markers were back within three months (published summary of the SOMA papers). Context, not a target. `returnToBaseline`, `returnLine`.
- **Dropped from the queue, with the reason:** "is this change what spaceflight usually does?" The Inspiration4 crew data in the app is blood chemistry; the app measures pulse, breathing and reaction time, so there is no crew curve for these measures to compare with.
- **Design pass on inner screens:** a browser check now counts visible primary buttons on all 13 screens; the Board had two, and "Do the eye grid" became secondary.
- 142 unit tests.

## v2.9 (21 Nov 2026): design clean up, NASA risk map

Audited against a 20 point list of tells of generated web design. Already fine and kept: no purple or gradient text, no glow or glossy shapes, no emoji, no bouncing motion, no reviews, left aligned, and the typeface stays Atkinson Hyperlegible (designed for low vision readers, chosen for a health app). Changed:

- **Home says what the app does.** New headline: "Check your pulse and breathing with a phone camera, against your own normal." The all caps label above it is gone.
- **One main button.** Start a checkup is the only primary action; Try it with sample data is secondary; Overview, Mission board, replay and install are plain links. The Overview sample button is no longer primary either.
- **One memorable thing.** The hero shows the real 160 character satellite message a nurse would receive (81 characters, from the sample person) and decodes it line by line with the same decoder as the nurse view. A unit test checks it stays valid.
- **The two generic boxes** ("What it captures", "What is new here") became a three step "How a checkup goes", which is a real sequence.
- **No tiny all caps or letter spacing.** Tags (Experimental, Live, Published, NASA data, Modeled, Sample data and others), Overview tile labels and step labels are sentence case; French entries added. Redundant labels above the Overview and Board headings removed.
- **No pills.** Online, the badge, the jump links and chips have small square corners.
- **4 pixel spacing grid.** 145 margin, padding and gap values moved to multiples of 4.
- **Middle dots** between links in the page replaced by spacing.
- **NASA risk map** on the Mission board (queue item 1): each NASA human system risk the app touches, what the app measures for it and what it cannot measure; no score per risk. Link to NASA's risk list, declared on the Your data screen (the app never contacts it).
- **Fix found in testing:** on a loaded machine a language switch could reset the experimental screen, and Check again then failed with an error because it no longer knew which check it belonged to. The Check again and Try again buttons now carry their own check id, and an unknown id returns to the list.
- 141 unit tests; 173 regression checks plus 19 new browser checks (home hero and risk map, both languages, phone and desktop), axe clean, French sweep 0 English.

## v2.8 (17 Nov 2026): illness early warning, camera oxygen saturation (research), northern validation kit

Thien asked to bring in three things the app had kept out. Each is in, labelled for what the evidence supports.

- **Illness early warning (MODELED).** `illnessWatch` in `js/overview.js` combines fever (typed temperature of 38.0 °C or more, the US CDC definition, or "Feverish or chills" ticked), illness symptoms (feverish, stuffy nose, headache, short of breath) and rises in pulse, breathing or temperature against the person's own recent normal. Possible illness signs: fever, or symptoms with a physiology signal. Worth watching: one alone. Shown as a panel on Overview, in the packet (`illness_watch`), the 160 character message (`ILL P` or `ILL W`) and first in the reviewer's reading order when possible. Never names an illness. Evidence card: DETECT (Quer et al. 2021, Nature Medicine 27:73; 30,529 people; symptoms plus sensors AUC 0.80 against 0.71 for symptoms alone) and the app's own simulation.
- **Camera oxygen saturation (RESEARCH).** After the pulse timing and colour ratio check, the person can type an oximeter reading taken at the same moment. `spo2Calibration` in `js/exp.js` fits a line for that person and shows a camera estimate only when the oximeter readings span at least 4 points and the line beats guessing the person's average in leave one out checks. Shown with its own error (never under 1 point), never as normal; a value under 95% says to measure with the oximeter now. For a healthy person at home (readings 95% to 100%) the range test will usually not pass, and the app says why. Evidence card cites Hoffman et al. 2022 (fingertip on the lens, 5.00 points mean absolute error).
- **Northern validation kit.** `VALIDATION_PROTOCOL.md`: governance first (ITK National Inuit Strategy on Research; Nunavut Research Institute licence under the Scientists Act with prior community consultation; Nunavik Regional Board of Health and Social Services evaluation), design, analysis plan, data held by the community, what is missing. No validation claim. The bench report now plans a study: how precisely the limits of agreement are known with the pairs so far, and how many pairs would pin them to ± 1, 2 or 3 units (`loaPrecision`, `pairsNeeded` in `js/change.js`, after Bland and Altman). `simulateMonitoring` gained `missPct` for missed checks: a week long 7 bpm rise is caught in 96% of cases with daily checks, 78% with 30% of checks missed, 23% with 30% missed and 5 bpm sensor error (MODELED).
- **Show my last result** on each experimental check, so an oximeter reading can be added later.
- 140 unit tests; 173 regression checks plus 15 new browser checks (illness panel, oximeter calibration flow), axe clean, French sweep 0 English.

## v2.7 (17 Nov 2026): touchscreen pointing test

- **Touchscreen pointing (experimental check, no camera).** After 3 practice targets, 24 yellow circles (12 of 56 and 12 of 28 CSS pixels, random order and places, at least 90 pixels apart) on a full screen dark area. Records time to tap, distance from the centre and misses; reports median time, misses overall and for small targets, and throughput (mean of log2(distance / width + 1) over time, the Shannon form of Fitts' law with the nominal width). Stop leaves without saving; leaving the screen mid test closes it. Compared only with the person's own first check (bands 20% for time and throughput, 15 points for misses, design choices). Shown on Overview under the hands. Based on NASA's Fine Motor Skills battery (Holden et al. 2023, Human Factors, PubMed 35609944: seven astronauts, decrements in the first week in orbit and the first month after landing); laboratory reference for phone throughput in Dunlop and MacKenzie 2026 (Sensors, doi 10.3390/s26185981). Evidence card in English and French. `pointingPlan`, `placeTarget`, `summarizePointing` in `js/exp.js`.
- Tested in a phone sized browser with real tap events, including stopping midway and leaving the screen; not yet tried on a real phone.
- **Fix found in testing:** on a busy machine, a tap that arrived before the screen repainted was silently ignored (one run needed 40 taps for 27 targets). The time now counts from when the target is placed, moved to the first paint when that comes first, and no tap is dropped. Three repeat runs: 27 taps each.
- 137 unit tests; 14 new browser checks.

## v2.6 (17 Nov 2026): standing balance from the phone motion sensor, code review fixes

- **Standing balance (experimental check, no camera).** The phone is held flat against the chest, feet together, 30 seconds with eyes open and 30 with eyes closed (the closed part can be skipped). `swayStats` in `js/exp.js` keeps movements between 0.1 and 5 Hz and reports the root mean square over the three axes in thousandths of g, plus eyes closed over eyes open. One, two and three beeps (and a buzz where the phone allows) mark start, close your eyes and finished, and the screen is kept awake. Compared only with the person's own first check, with wide bands (50%). Method after Hsieh et al. 2019 (Gait & Posture 67:160, doi 10.1016/j.gaitpost.2018.10.005); limits from De Groote et al. 2020 (doi 10.1101/2020.05.29.123620); spaceflight relevance from Frontiers in Physiology 2025 (doi 10.3389/fphys.2025.1677377). Shown on Overview under the head, in the packet with the other experimental checks, with an Evidence card in English and French. Tested in a browser with synthetic motion sensor events; not yet tried on a real phone.
- **Review fix: whole number readings.** A person whose oximeter nearly always shows the same number had almost no spread, so one changed digit could raise an early warning (2.29 false warnings a year in simulation for a reading that sits at 98). The early warning now uses at least half a display step as the spread for typed device readings: 0 false warnings in the same test, and a real drop (98 to 93) still signals.
- **Review fix:** the motion sensor capture is now shared by hand steadiness and balance instead of being written for one check.
- 136 unit tests; 13 new browser checks for the balance check on top of the 173.

## v2.5 (16 Nov 2026): early warning rebuilt on measurement, readings from low cost devices, code review fixes

- **Can the early warning catch an illness, and how often does it cry wolf?** New `simulateMonitoring` in `js/overview.js` (2000 simulated people per case, seed 11): a resting pulse that varies from day to day with a standard deviation of 3.03 bpm (average within person figure in 92,457 wearable users, Quer et al. 2020, PLOS ONE, doi 10.1371/journal.pone.0227709) plus sensor error; a healthy year of checks; and an illness modeled as 7 bpm higher for 7 days (median rise around COVID-19 onset in Mishra et al. 2020, doi 10.1038/s41551-020-00640-6; the 7 days are an assumption).
- **Result for the rule shipped since v2.1: too many false warnings.** In a healthy year of daily checks it switched on by mistake 5.93 times per person, and 8.26 times once a 2 bpm seasonal swing (Quer 2020) was added. Two causes: it kept the first 8 values as the baseline for ever, and its limit ignored how uncertain a mean of 8 values is.
- **Rule revised.** The early warning now compares the latest checks with the person's own recent normal (up to 28 good values before the latest 5 checks, never fewer than 8) and counts the uncertainty of that normal; limit 3.2 standard errors. Same test: 0.97 false warnings per person per year (63% of people get at least one), 1.02 with the seasonal swing, 0.37 with a check every 3 days and 0.21 with weekly checks. The 7 day rise is caught in 96% of cases with daily checks and 1 bpm of sensor error (89% before). The cost, stated plainly: at 5 bpm of sensor error it catches 42% (45% before), and in a person's first 10 monitored checks a step of 1.5 standard deviations is caught in 54.6% of series (76.7% before) and a drift in 68.7% (82.0% before), with false warnings in 6.8% (10.0% before). The 3 in a row rule stays at 32.9%, 39.1% and 9.3%. The old settings are kept as `EWMA_V21` so the comparison can be rerun.
- **What the simulation says about sensors and how often to check.** Week long rise caught: 96% (daily, 1 bpm error), 42% (5 bpm), 6% (15 bpm), 26% (every 3 days, 1 bpm), 6% (weekly, 1 bpm). Catching illness needs daily checks and an accurate sensor; a camera spot check now and then cannot do it. The Evidence card and README say so.
- **A weakness found in the older band rule, not yet fixed.** The 3 in a row rule compares with a single baseline checkup. With 5 bpm of sensor error one noisy first value anchors the band, and the rule fires 10.2 times in a healthy year of daily checks (82% of people). Queued: build the baseline from several checkups.
- **Readings from your own devices.** On the results screen, a fingertip oximeter (oxygen saturation and pulse), a thermometer and a blood pressure cuff can be typed in. They are saved with the checkup, charted on Overview against the person's own first reading with the same early warning and forecast, shown in History and the nurse view, and carried in the packet (`device_readings`) and the 160 character message (`DEV O97 T36.8 B128/82 HR71`), always marked as typed in and not checked by the app. Values a device cannot show are refused. A typed oxygen saturation under 95% goes to the top of the reviewer's reading order (95% to 100% for most healthy people, US FDA). The sample data carries invented readings. New Evidence card with sources and limits, in English and French.
- **No camera oxygen saturation.** The phone camera study (Hoffman et al. 2022, npj Digital Medicine, doi 10.1038/s41746-022-00665-y) pressed a fingertip on the lens and reported a mean absolute error of 5.00% of saturation, with 81% sensitivity and 79% specificity for readings below 90%. The app keeps its uncalibrated colour pulse ratio as an experimental index and gives no saturation number.
- **Code review fixes.** (1) Forecast guard: v2.4 described a second condition (next check not further away than the fitted period); it could never be false and is removed. Only the rolling check ever acted. The guard is now measured: on series with no trend it picks the line 21% of the time with 6 values (4% with 20) at a small cost in error (0.95 against 0.85 of the person's standard deviation); on a real trend of 1 standard deviation per check it picks the line every time with 8 values (error 1.10 against 3.54 for the average). (2) On phones, the Overview tile label "Respiration" broke across two lines in French; fixed. (3) The oxygen saturation chart axis and forecast no longer pass 100%. (4) The French Evidence test now compares numbers written with thousands separators (92,457 and 92 457).
- 135 unit tests, 173 browser checks (154 earlier plus 19 new), axe-core with no violations including the new card, and a French sweep with no English left.

## v2.4 (16 Nov 2026): adaptive personal ranges, forecast guard, baseline strength

- **Adaptive personal ranges with published biological variation (MODELED).** `adaptiveRange` in `js/crew.js` starts each range from the published week to week variation of healthy adults (CVI) and moves to the person's own spread as values add up (one conjugate update on the log scale, prior worth 4 pseudo values, a design choice). This is the idea behind the Athlete Biological Passport's adaptive model. CVI values: EuBIVAS summary, Carobene et al. 2022, doi 10.1515/cclm-2021-0370, Table 2 (13 metabolic panel tests), and the EFLM Biological Variation Database for IL-6 (31.9%, 4 studies).
- **Backtest on NASA OSD-575** (56 series with published variation, `adaptiveBacktest`): the range from three own values alone flagged 4 day 1 results, the adaptive range 8, published variation alone 19; chance gives about 2.8. Published variation alone flags too much because the lab's measurement error is unknown and taken as zero (sodium and chloride are reported in whole numbers).
- **A second, smaller correction on IL-6.** IL-6 rose above all three pre-flight values in 4 of 4 crew (still true, about 1 in 256 by chance). But IL-6 normally varies about 32% within a healthy person, so a rise has to pass about 102% against a three value baseline to stand clear. The rises were +94%, +31%, +190% and +62%: only 1 of 4 passed. The crew tile and crew screen now say both things.
- **Forecast guard.** The next check forecast now uses a straight line only when the line has predicted the person's own earlier values better than their average did (rolling one step ahead check) and the next check is not further away than the fitted period. Otherwise it uses the average, and says so.
- **Baseline strength line** on each Overview chart until the person has 8 good values: says the personal range is still rough and how many checks remain.
- 133 unit tests.

## v2.3 (16 Nov 2026): backtest on real crew data, and a correction

- **Backtest of personal baselines and simple predictions on NASA OSD-575** (4 crew, 27 analytes, 108 series), computed live by `backtestCrew` in `js/crew.js` and shown on the crew data screen:
  - Outside the min to max of three pre-flight values: 54 of 108 day 1 results, exactly what chance gives (a new value from an unchanged person lands outside the range of three earlier values half the time).
  - Outside a 95% personal prediction range: 5 of 108 (chance about 5.4): IL-6 and ALT and MCP-1 in one crew member, IL-6 and sodium in another. Two were back inside by day 45, two by day 82, one not by the last visit.
  - Predicting day 1 from pre-flight values, median error: last value 11.2%, pre-flight mean 12.8%, straight line trend 16.0%.
  - Predicting day 45: assuming a return to the pre-flight mean (15.7%) beat assuming the day 1 change persists (18.2%), closer in 61 of 107 series.
- **Correction.** Earlier versions (including the hackathon submission) led with "23 of 60 day 1 results were inside the lab range but outside the person's own pre-flight values" and said a population range would miss them. The count is right, but with only three pre-flight values about half of any new result lands outside them by chance, so it was evidence that the two references read differently, not of 23 real changes. The crew tile now leads with IL-6 (4 of 4 crew above all their own pre-flight values; chance about 1 in 256) and states the backtest; the demo reel caption and README changed to match.
- 132 unit tests.

## v2.2 (16 Nov 2026): bench test helper

- **Ready for a small comparison study.** On the results screen, the bench test now has tap to add condition tags (window light, dim light, lamp light, head movement, glasses, darker or lighter skin tone) and a participant code field that refuses names (letters then digits, such as P01).
- **One page bench test report** from History (a standalone HTML file that prints cleanly): checkups with a reference, pairs, failures (scans that gave no value count against the method, they are not dropped), pairs from low quality captures, mean absolute error, bias and limits of agreement with the Bland and Altman plot, and error by condition, for pulse and breathing. History also shows attempts, failures and error by condition. The CSV export gains the participant code.
- **Fix:** "sleep last night" is now kept per person on the device; before, one person's short night could show on another person's Overview (found by the browser regression).
- 131 unit tests.

## v2.1 (16 Nov 2026): early warning, forecast, plasma proteomics

- **Early warning (MODELED).** Each Overview chart now runs an EWMA control chart (Roberts 1959) on the person's own values: the first 8 good values set their own mean and spread, and a warning shows when the smoothed trend leaves that mean by more than 3.5 standard errors. It goes into the nurse packet as an "early warning" trend when no band rule has fired yet.
- **Measured by simulation, not assumed.** `simulateDetection` in `js/overview.js` runs 2000 synthetic series per case (seed 7). Over the same 10 monitored checks, the early warning raised about as many false alarms as the 3 in a row rule (10.0% against 9.3% of series with no change) and caught a step of 1.5 of the person's own standard deviations in 76.7% of series against 32.9%, and a slow drift (0.25 standard deviations per check) in 82.0% against 39.1%. Assumes independent normal noise; not validated on real people. Evidence card "How the early warning and forecast work".
- **Forecast for the next check.** A straight line through the last 6 good values gives the next value with a 95% prediction range, drawn dashed on the chart.
- **NASA OSDR OSD-563** (Inspiration4 plasma proteomics, group level): of 1765 proteins measured, 59 differed the day after landing (32 up, 27 down, adjusted p below 0.05), and 40 of those also differed when all postflight visits to day 82 were pooled. Added to the crew blood tile; built by `scripts/build_osd575.py --proteomics`.
- 130 unit tests.

## v2.0 (16 Nov 2026): portfolio edition

The hackathon submission is frozen as v1.2 (what the judges see). This edition is for a portfolio and continues from v1.3.

- The "AI" badge and caption on the logo are removed; the Space Apps rule that required them applied to the hackathon submission. The logo credit stays in `AI_DISCLOSURE.md`.
- The demo reel tells a story in 30 seconds: the problem (the clinic is far away), the method (a camera checkup against your own baseline), the evidence (NASA Inspiration4 data: 23 of 60 lab normal results were off the person's own baseline), the context (sleep, alertness, radiation) and the hand off (a packet for a nurse, even by satellite text). The on screen watermark now reads "Sample data", plus "Music: AI-generated" while the synthesized music plays.
- README rewritten as a project page: highlights, a one minute tour, how it was built. `AI_DISCLOSURE.md` rewritten in plain words. Footer credits the author.

## v1.3 (15 Nov 2026): sample data in one place, clock, suggested order

- One button loads the full sample (sample person with sleep log and reaction tests, plus the crew of four) on the home page and the Overview; the scenario loader and crew list are relabelled ("Load this scenario", "Crew list only").
- Overview shows UTC and local time and a rest suggestion only when the data supports it: modeled sleep pressure above the sleep band, or last night 5 h or less and a reaction test in the last 24 h slower than the person's reference. Otherwise it says there is no rest flag. Design choice, not medical advice.
- Overview radiation tile: mission dose estimate in mSv and share of NASA's 600 mSv career limit, from the mission set on the Board (default 180 days on the ISS).
- Overview "Suggested order" links: checkup, reaction test, mission board, history, nurse packet.

## v1.2 (15 Nov 2026): one sleep answer fills three places

- **Sleep hours instead of "Slept badly".** The checkup asks "Sleep last night": 3 h or less, 4 to 5 h, 6 to 7 h, 8 h or more (or Skip). The answer goes into the checkup record and the nurse packet ("Sleep last night (self report)"), ticks "Short sleep (5 h or less)" automatically for the two shortest answers (so symptom counts and the SL code in the satellite message keep working), fills Sleep pressure on the Board (unless exact times were entered there today) and the Sleep number on the Overview.
- **Retroactive sleep log.** The Board's Sleep pressure tile has a 7 night strip: each night can be filled in or changed later. Short nights show red. When usual sleep is left blank, the model uses the average of the logged nights in the last 14 days (3 or more needed), else last night.
- **Less scrolling.** Quick "Last night" buttons on top; exact bed and wake times fold away under "Exact times and usual sleep"; result and chart sit side by side when the tile is wide; shorter source note.
- **Reaction test against sleep.** The Alertness tile compares the person's own reaction test medians after short nights (5 h or less) and after longer nights, once there are 2 of each in the sleep log, and says plainly that a few tests are a pattern to watch, not a finding.
- **Satellite message** carries the sleep answer as `SLP le3`, `SLP 4-5`, `SLP 6-7` or `SLP 8+`, and the decoder reads it back.
- The sample person has an invented 14 night sleep log (short nights on the last three days in the short sleep scenario).
- Hours used by the model for each answer: 3, 4.5, 6.5 and 8 h (a design choice). Logged per person, on the device only.
- 129 unit tests.

## v1.1 (15 Nov 2026): derived metrics and Earth context

- **Your own spread, in standard deviations.** Once a measure has at least 5 earlier good quality values, the Overview shows the person's own mean, standard deviation and coefficient of variation, how many standard deviations the latest value sits from that mean (a z score against themselves, not against other people), and how many earlier values it exceeds. Low quality captures are skipped.
- **Earth reference ranges** next to the person's own baseline: resting pulse 60 to 100 bpm (American Heart Association) and breathing 12 to 20 per minute (clinical nursing references), with "your own baseline matters more than this range".
- **Heartbeats per breath**, a new derived measure from the same checkup's pulse and breathing, compared only with the person's own first value (band 20%, a design choice).
- **Body measures card** on the Overview: biological sex (used only for averages and notes), height, weight and BMI with the WHO adult categories and their limits (muscle, population differences, not a diagnosis). Earth averages from CDC (US adults 20 and over, NHANES 2021 to 2023: men 175.0 cm and 90.3 kg, women 161.3 cm and 77.9 kg). Sample people get the male or female average, with buttons to switch. For women, a note that the app does not take the menstrual cycle into account, that resting pulse is a few beats higher in the fertile window and luteal phase on Earth (Shilaih et al. 2017), and that spaceflight data on the cycle are limited and research is ongoing. Kept on the device, never in a packet. Evidence card in English and French.
- 127 unit tests.

## v1.0 (15 Nov 2026): submission release

- Release pass: every button target, Evidence key and in-page link checked; every screen opened in English and French, light and dark, with no console errors or failed requests; offline reload checked (app, sample data and NASA summaries all load without a network).
- French for the last remaining screens and messages (about 60 more strings: dental capture prompts, device check advice, eye test and nurse view lines, empty states).
- The "Everyone on this device" list turns into one block per person on phones and tablets (it was wider than the screen).
- README: one minute tour updated for the Overview, the sample crew, inflammation tile, fingerprint and short message decoder.
- Not in this release, by design or out of reach: the face model file (download `face_landmarker.task` into `models/` for full offline use from the first visit), real device validation, a fluent review of the French, Inuktitut.

## Changes in v0.67 (15 Nov 2026)

- **New NASA data built in: Inflammation after landing.** The Inspiration4 NULISAseq panels from serum (OSD-575, 203 proteins) and urine (OSD-656, doi 10.26030/7cax-yj10) are now inside the app, summarised for 8 markers as change against each crew member's own preflight values. The day after landing, IL-6 was above its own preflight level in 4 of 4 crew in serum (median 1.6×, the 3rd largest rise of 203) and 3 of 3 in urine (2.59×); urine neutrophil signals rose in all 3 (MMP-8 44×, MPO 23×, IL-8 8.5×); BDNF fell in serum in 4 of 4 (0.79×) and GFAP did not move. A dot chart shows every crew member. The summary is rebuilt by `scripts/build_osd575.py` (plain Python, no extra libraries), and a unit test checks it against the team's earlier analysis.
- **Packet fingerprint.** Every packet carries a short SHA-256 fingerprint; the nurse view recomputes it and says "matches: the file arrived as it was made" or warns that it was damaged or edited on the way. A check against accidents, stated as not a security signature.
- **Bench agreement in the packet.** When there are 3 or more reference pairs, the packet and nurse view state the device's bias and limits of agreement against the person's own reference device.
- **Old data flagged.** The Overview trend says when the latest value is 2 weeks old or more.
- 126 unit tests.

## Changes in v0.66 (15 Nov 2026)

- **One odd value or a real change?** Every Overview trend now says which: "Above the band 3 times in a row: a sustained change", "Only the latest value is outside the band... repeat the check", or "Still inside the band, but moving up about N a week". Rules (MODELED, design choices): sustained = the last 3 good quality values outside the band on the same side; drift = 4 values in a row moving one way that would reach the band edge within 14 days. Low quality captures are skipped. The "Look here first" list marks sustained changes ("3 in a row") and lists drifts separately, without raising a region's status.
- **Trends travel in the review packet** (`trends`, with the rule written into each entry) and show in the nurse view's "Read first" list. In the short sleep sample, pulse is above the band 3 checkups in a row.
- **Everyone on this device.** When a device holds more than one person (a crew tablet, a health centre laptop), the Overview lists them all: last checkup and how long ago, urgent ticks, sustained changes and regions to look at again, sorted as a reading order (urgent, then sustained, then look again), never as a ranking of health. "Load a sample crew of four" fills it with four invented people, one per scenario.
- **Nurse view in French** when the app is in French. The packet file itself stays English, and the person's own words (their note, their marks on photos) are never translated.
- **160 character message.** The packet screen has "Short message (160 characters)" for a satellite text messenger or SMS when a file or QR code cannot get through, for example `RE FU 11-14 13:33 | P72 +10x3 | R15~ ok | SYM HA,SL,TG | RT299 | DENT gum+18.3,teeth+11.2 | EXP JAW | NOTE`. Urgent ticks come first; whatever does not fit is dropped and the message ends with +MORE. A legend to send once to a new reviewer sits next to it, and the nurse view has "Got a short text message instead? Decode it", which turns the message back into plain sentences (in French too).
- **Bench test agreement plot.** With 3 or more reference pairs, History draws a Bland and Altman plot for pulse and breathing (app minus reference against their mean, bias and 95% limits of agreement), with a note that under about 20 pairs the limits are rough and describe this device, face and light only. This is where the real bench test results will show.
- Fixed a double full stop in the nurse view's pulse line.
- 124 unit tests, 137 browser checks.

## Changes in v0.65 (15 Nov 2026)

- **Evidence cards in French.** All 27 cards (method, source, what it cannot tell you) have a French version in `js/evidence-fr.js`. Paper titles, journals, authors and DOIs stay as published. A unit test checks that every card exists in both languages and that every number in the French text matches the English one.
- **Dialogs in French.** Confirmations, alerts and the new person prompt (delete, erase, restore, set as baseline, file errors) follow the chosen language.
- **French demo reel.** With Français selected, the 30 second demo shows French captions, cards and watermark, and "Captions file (.srt)" saves French subtitles, so a French demo video can be recorded from the app. The English reel is unchanged.
- Still English on purpose: the review packet and nurse view, the device report.
- 119 unit tests.

## Changes in v0.64 (15 Nov 2026)

- **French for the whole interface (draft).** Before, French covered about 40 strings (tabs, home, a few headings) and the newer screens stayed English. Now `js/i18n-fr.js` holds about 700 French entries plus 90 patterns for text with numbers, keyed by the exact English text, so English stays the single source. Text the app draws later (Overview reasons, Board tiles, History rows, scan results, experimental check prompts and results, eye chart and eye grid) is translated as it appears. Numbers, dates, units and people's names are never changed. Switching back to English restores every screen exactly (browser checked).
- **Stays English on purpose:** the review packet and nurse view (a clinical record should not change language between sender and reader), the Evidence cards with their citations, the device report, the demo reel captions and a few technical lines.
- **SI-generated text:** the French was drafted with Claude and is marked as a draft for a fluent reviewer, on screen and in `AI_DISCLOSURE.md`. Inuktitut still ships empty until a certified translator provides it.
- 118 unit tests (3 new for the French table: no empty or duplicate entries, numbers kept, unknown text left alone).

## Changes in v0.63 (15 Nov 2026)

- **Phones with large text.** A sweep of 8 screens at 360 px (phone) and 768 px (tablet) wide, at normal and the largest text size, found content wider than the screen in 4 places: the top bar at 768 px with large text, the Overview headline numbers, the board's sleep time inputs and the Experimental list on a phone with large text. Grids now shrink to the screen, the top bar wraps, and body chart labels get smaller instead of breaking inside a word ("Sle ep"). After the fix the same sweep finds nothing wider than the screen. Desktop layout unchanged (checked by screenshot).

## Changes in v0.62 (15 Nov 2026)

- **The in-app demo reel plays music.** The same 30 second track as the demo video (`audio/relaisecho-theme-ai-generated.mp3`, 0.4 MB, about 4 dB quieter than the first mix), synthesized by `scripts/make_music.py`, a program written with Claude: no samples or outside audio. A "Music (AI-generated)" box on the home page turns it off. If the browser blocks sound without a click (for example `/?reel=1`), the reel runs silent.
- **"Record it as a video file" now records the music too** (WebM with VP9 video and Opus audio, checked in headless Chrome: 30 s file with both tracks). Only the reel's music is recorded, not other tab sounds.
- **SI watermark in the reel.** "SI-generated demo (AI-assisted) · Sample data · Music: AI-generated" sits in the top right for the whole reel. The bottom left "Sample data" tag moved into it, and the Stop button is hidden while the app records itself (Esc still stops), so recorded files have clean corners.
- The music file carries the AI disclosure in its ID3 title and comment.
- 115 unit tests.

## Changes in v0.61 (15 Nov 2026)

- **AI watermark on the logo.** The Space Apps submission form requires a visible watermark on SI-generated images, and the logo was made with ChatGPT. The logo now carries a visible "AI" mark in the top bar and on the home page, a caption "Logo: AI-generated (ChatGPT)", an "AI-generated logo" mark on the demo reel's title and end cards, and a footer note.
- **Third NASA dataset: Exercise during bed rest tile.** NASA Life Sciences Portal "Aerobic Capacity, Flight Analog" (PI Alan D. Moore Jr., doi 10.83263/w056-8t76), CFT70 70 day bed rest, 37 people: peak oxygen uptake fell a median 22.6% with bed rest only (9 of 10 lost more than 5%), against medians of 3.2% and 3.0% in the exercise and flywheel groups. Only medians and counts ship (`data/bedrest-vo2.json`, `scripts/build_vo2.py`).
- **Demo reel** now shows the Overview body chart and the bed rest tile.
- 114 unit tests.

## Changes in v0.60 (15 Nov 2026)

- **Eye chart (visual acuity), one eye at a time.** Tumbling E letters, five a line, 0.1 logMAR between lines, scored per letter the way research letter charts are (0.02 logMAR per letter). Letter sizes come from the chosen distance (0.4, 1 or 2 m) and the bank card screen calibration; the app works out the smallest line the screen can draw and says when a result sits at that limit. Each eye is compared with the first check at the same distance; 2 lines or more reads "different". Arrow buttons, arrow keys or a helper. Results go to the Board eye tile, Overview (eyes), History, CSV, the packet, the nurse view and "Read first". ISS vision checks include acuity; this completes that pair with the eye grid.
- **Eye opening in mm** during the resting scan: the lid gap on each eye (open-eye value, blinks excluded), iris scaled, compared with the original baseline (1 mm band). Shown on the results screen, in the packet and on the Overview.
- **Fix:** true-size drawings (eye grid, card calibration, eye chart) now account for the Aa−/Aa+ page zoom, so 10 cm stays 10 cm.
- **Second NASA dataset: bed rest fluid shift tile** on the Board. NASA Life Sciences Portal "Bed Rest Standard Measures: Plasma Volume" (doi 10.83263/4dzb-2267; Campaign 1, Campaign 3, CFT70; 48 people): each person against their own pre bed rest mean. Median 10.4% lower in the first week (24 of 31 people below their own lowest pre value), partly back within days of getting up. Only medians and counts ship (`data/bedrest-pv.json`, built by `scripts/build_bedrest.py`); the raw files are not re-hosted because redistribution terms are not confirmed.
- Sample data includes two eye chart checks.
- 113 unit tests.

## Changes in v0.59 (15 Nov 2026)

- **Original logo kept.** The flat redraw from v0.58 is removed; the app uses the team's ChatGPT logo again.
- **Explore a scenario** on the Overview, all invented sample data in the sample profile: Three short nights (pulse up, reactions slower), A steady fortnight (everything inside its band), Gums getting redder (front dental colour drifts redder, gum pain ticked), Short of breath today (the urgent path). Each one changes the body chart, graphs and "Look here first".
- **Mission clock** on the Overview: set a start date and length to see "Mission day N of M" with a progress bar (a field rotation or winter posting works the same way). Display only.
- **Print** the Overview on one page.
- 104 unit tests.

## Changes in v0.58 (15 Nov 2026)

- **Overview tab: everything on one screen.** A body chart with seven regions (sleep and alertness, eyes, mouth and jaw, neck, heart and circulation, breathing, hands). Each region's dot shows urgent tick, look again, logged or not measured, with a dashed line to its label. Selecting a region plots its measures over time with the person's own first value (or the original baseline) and its band; "Show values" gives the same numbers as a table. Four headline numbers (pulse, breathing, reaction time, last night's sleep), a short "Look here first" list and the next step sit beside it. The Board stays the detailed view. A reading order, not a score.
- **Tabs** under the top bar: Overview, Checkup, Board, Experimental, History; the current one is highlighted.
- **Text size: Aa−, Aa, Aa+.** Five steps from 85% to 150%, applied like browser zoom so layouts reflow instead of overlapping; the camera layers stay full size. Replaces the single A+ toggle (an old "larger text" setting maps to 130%).
- **Dental photos at the baseline's distance.** Each dental photo records how large the iris appears (vertical size, so turning the head does not change it). Later dental photos on the same camera must be within 12% of the original baseline's distance before they count, with "Move closer" or "Move back a little" coaching (English and French). A different camera is named as not comparable. The first dental set shows a rough distance in cm.
- **Sharper camera overlays.** The guide outline and measurement boxes are now drawn at the screen's real pixel density, with rounded corners, a light fill and small labels (forehead, cheek, neck, chest; eyelid, neck, palm, hand in the experimental checks) that read correctly in selfie view.
- The team kept its original logo (made with ChatGPT); AI disclosure updated to say so.
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
