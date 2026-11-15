// Text for the evidence drawer. Keep each entry to: method, source, what it cannot tell you.

export const EVIDENCE = {
  pulse: {
    title: 'Pulse estimate',
    method: 'Tiny colour changes in forehead and cheek skin follow each heartbeat. The POS method separates that signal from lighting changes, then the strongest rhythm between 42 and 180 beats per minute is taken from 10 second windows. Nine skin regions are tracked (forehead centre, sides and between the brows, upper and lower cheeks, chin); after the scan each is scored on its own, and the clearest up to five are pooled if that beats the standard forehead and cheeks estimate. Windows with poor capture or a weak rhythm are rejected, not averaged in.',
    source: 'Wang, den Brinker, Stuijk and de Haan, Algorithmic Principles of Remote PPG, IEEE Transactions on Biomedical Engineering, 2017.',
    limits: 'Our implementation is not clinically validated. Accuracy drops with movement and dim or flickering light. Published work finds it clearly worse on the darkest skin: one meta analysis reported mean error rising from about 4 beats per minute (Fitzpatrick types I to V) to about 14 (type VI). Cold skin has not been tested. It cannot give blood pressure, oxygen saturation or heart rhythm.',
  },
  resp: {
    title: 'Breathing estimate',
    method: 'Breathing moves the neck, shoulders and head slightly. The app tracks four channels separately (a band under the chin, the upper torso, head bob and head tilt), finds the dominant rhythm between 6 and 42 breaths per minute in each, and reports the cleanest one with how many others agree. A cycle count is used as a cross check.',
    source: 'Published video work reports mean errors of about 1.3 breaths per minute from chest motion and about 2.0 from head motion alone (IEEE EMBC 2022). Those results do not validate this code.',
    limits: 'Needs natural breathing, no talking and the upper torso in view. It does not measure oxygen or lung function.',
  },
  dental: {
    title: 'Dental photos',
    method: 'Each view is accepted only when the head angle, lip opening, light, glare and sharpness pass. The sharpest frame is kept, then levelled and scaled by the mouth corners so photos from different days line up.',
    source: 'NASA lists limited in-flight dental capability as a research gap (Human Research Roadmap). Dentist review of remotely taken photos has been studied; automated diagnosis is not claimed here.',
    limits: 'Front surfaces only. Colour depends on light, so redness comparisons need similar lighting. No decay or gum disease is detected by the app.',
  },
  quality: {
    title: 'Why the app sometimes refuses',
    method: 'Every frame is checked for face position, size, brightness, clipped highlights and movement. Only frames that pass count toward the 30 usable seconds.',
    source: 'Thresholds are design choices for this prototype (see js/config.js), tuned on our own bench test.',
    limits: 'A passed check means the capture is usable, not that the result is correct.',
  },
  sleep: {
    title: 'Sleep pressure (modeled)',
    method: 'Sleep pressure (Process S) rises while you are awake and falls while you sleep. The curve uses the published time constants (18.2 hours rising, 4.2 hours falling) and assumes the days before last night looked like your usual sleep.',
    source: 'Daan, Beersma and Borbély 1984, as tabulated by Achermann 1999. Context: ISS crews slept about 6 hours a night on average against 8.5 hours scheduled (Barger et al., Lancet Neurology 2014). In ISS astronauts, nights of 6 hours or less were linked to worse reaction test scores (Jones et al. 2022).',
    limits: 'A model of the average person, not a measurement of you. The body clock (circadian) part is shown only as a band because its timing is not measured. It does not detect sleep disorders.',
  },
  radiation: {
    title: 'Radiation budget',
    method: 'Days in low Earth orbit are multiplied by a low and a high published ISS daily dose. Days in deep space transit and on the Mars surface are multiplied by the dose rates the Curiosity mission measured. The total is compared with the career limit.',
    source: 'Career limit below 600 mSv for all ages and sexes: NASA-STD-3001 Volume 1, standard 4030. ISS low end: 19 crew averaged 72 mSv over about 6 months (Cucinotta et al., Radiation Research 2008). ISS high end: about 310 mSv per year (Chancellor et al. 2017, as cited in later reviews). Deep space transit: about 1.8 mSv per day inside the Mars Science Laboratory cruise vehicle, about 0.66 Sv for a round trip of 180 days each way (Zeitlin et al., Science 2013). Mars surface: 0.64 to 0.67 mSv per day (Hassler et al., Science 2014). A mission of 180 days out, 500 on the surface and 180 back comes to about 1 Sv.',
    limits: 'Actual dose depends on the solar cycle, shielding, spacewalks and orbit. The deep space figures come from one vehicle during low to moderate solar activity, and a large solar particle event would add to them. This is context for planning, not a dosimeter reading.',
  },
  spaceweather: {
    title: 'Space weather',
    method: 'When you press the button, the app asks NASA\'s DONKI database for solar flares in the last 7 days and solar energetic particle events in the last 30 days. It shows the strongest flare class, how many flares of each class, and the number and latest date of particle events. The answer is kept on this device for 3 hours.',
    source: 'NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information), Community Coordinated Modeling Center, NASA Goddard, through api.nasa.gov. Flare classes rise tenfold from C to M to X. NASA-STD-3001 Volume 1, standard 4031, requires that a design reference solar particle event (the sum of the October 1989 events) give a crew member less than 250 mSv, and NASA habitat studies size a shielded storm shelter for such events.',
    limits: 'A catalogue of events, not a forecast and not a dose. For official forecasts use NOAA\'s Space Weather Prediction Center. The list can lag the Sun by hours, and the shared demonstration key can be refused when many people use it.',
  },
  daylight: {
    title: 'Daylight',
    method: 'Day length is calculated from the date and the latitude with NOAA\'s general solar position equations, taking sunrise and sunset as the moment the top of the Sun meets the horizon, with standard refraction.',
    source: 'NOAA Global Monitoring Laboratory, solar calculation details. ISS figure: "In 24 hours, the space station makes 16 orbits of Earth, traveling through 16 sunrises and sunsets" (NASA, International Space Station Facts and Figures). ISS crews slept about 6 hours a night on average against 8.5 hours scheduled (Barger et al., Lancet Neurology 2014).',
    limits: 'Twilight is not counted, and in the Arctic it adds hours of usable light around the polar night. Terrain, cloud and indoor lighting are ignored. The tile describes light outside; it does not measure your body clock or advise treatment.',
  },
  delay: {
    title: 'Signal delay',
    method: 'The positions of Earth and Mars around the Sun are calculated for today from Keplerian orbital elements. The straight line distance between them, divided by the speed of light, gives the one way delay. The shortest and longest delays are found by repeating this for each of the next 780 days, about one full cycle of the two planets.',
    source: 'JPL Solar System Dynamics, Keplerian Elements for Approximate Positions of the Major Planets (Table 1, valid 1800 to 2050). Checked against published close approaches: about 55.8 million km on 27 Aug 2003 and about 62.1 million km on 6 Oct 2020. Solar conjunction: NASA pauses commanding of its Mars spacecraft for about two weeks roughly every two years, when Mars is within about 2 degrees of the Sun in the sky (for example 11 to 25 Nov 2023).',
    limits: 'Geometry only. Real links add relay hops, antenna scheduling and data rate limits, and the approximate elements are good to a few tens of thousands of kilometres. "Earth" is the Earth and Moon barycentre.',
  },
  amsler: {
    title: 'Eye grid',
    method: 'An Amsler grid: 20 by 20 squares with a centre dot. One eye is covered, the other looks at the dot, and the person marks squares where lines look wavy, blurred, dim or missing. The standard chart is 10 cm wide and read at about 30 cm, so a square spans about one degree. Marks are compared with the person\'s first check on this device; a mark right next to an old one counts as the same spot.',
    source: 'Scheduled vision checks on the ISS are static visual acuity, an Amsler grid and a self-reported survey ("The case for expanding visual assessments during spaceflight", Prehospital and Disaster Medicine, 2023; NASA ocular surveillance briefings list "Amsler grid (ISS: Laptop)"). Spaceflight associated neuro-ocular syndrome (SANS) is the reason for that surveillance.',
    limits: 'This is not the flight software and it cannot detect SANS: swelling of the optic disc is found with optical coherence tomography and fundoscopy, not with a grid. Results depend on distance, lighting, glasses and attention. The screen size is exact only after the optional card calibration. Shown, not judged.',
  },
  alertness: {
    title: 'Alertness check',
    method: 'A brief psychomotor vigilance test: a counter appears after a random 1 to 4 second wait, for 3 minutes. The app reports the median reaction time, lapses (responses of 355 ms or slower, the threshold published for the 3 minute version, plus missed counters) and false starts (pressing early).',
    source: 'Brief 3 minute PVT (PVT-B): Basner, Mollicone and Dinges, Acta Astronautica 2011. In ISS astronauts, nights of 6 hours of sleep or less were linked to worse PVT-B scores (Jones et al. 2022).',
    limits: 'Test length, the 1 to 4 second waits, the 355 ms lapse threshold and the 100 ms false start rule follow the published PVT-B; the published test waits 30 seconds before counting a missed counter, this app waits 10. Screens, keyboards and browsers add their own delay, so numbers are compared only with your own earlier tests on the same device, never with published norms. Practice makes the first tests slower. It does not diagnose fatigue or any condition.',
  },
  eyes: {
    title: 'Blinks and eye closure',
    method: 'During the reaction test (optional) and the resting scan the camera finds eyelid landmarks, up to about 15 times a second in the test. Eye opening is measured as lid height over eye width (eye aspect ratio). Your own open-eye value is learned in the first seconds; the eye counts as closed below 60% of it. Closures under half a second count as blinks, longer ones are counted separately.',
    source: 'Eye aspect ratio: Soukupová and Čech, Real-time eye blink detection using facial landmarks, 2016. Long and frequent eye closures are a recognised sign of drowsiness in fatigue research; this app uses no published cut off.',
    limits: 'Not validated. Glasses, glare, dim light, looking down and low frame rates all affect it, and a 15 per second rate can miss very quick blinks. The thresholds are design choices. It does not diagnose drowsiness or any eye condition.',
  },
  dentalAuto: {
    title: 'Automatic dental comparison',
    method: 'Both photos are already levelled and scaled by the mouth corners. Inside the mouth outline, light low-colour pixels are treated as tooth-like and reddish pixels as gum-like, and their average colour is compared in CIELAB: L* is lightness, a* is red-green, b* is yellow-blue. A lighting check runs first; if overall brightness differs by more than 8 L* units, colours are not compared. The change map marks pixels whose colour moved by more than 15 units.',
    source: 'CIELAB colour difference is the standard way to describe tooth colour change in dental research; this app\'s pixel rules and limits are design choices, not validated thresholds.',
    limits: 'Not validated. Lighting, white balance, camera, lip position and saliva all change the result. Gum-like pixels can include the inner lips. Front surfaces only. It cannot detect decay, gum disease or any condition.',
  },
  change: {
    title: 'Change against your baseline',
    method: 'A difference only counts as a change if it is bigger than the method\'s typical error: 8 beats per minute for pulse and 3 breaths per minute for breathing.',
    source: 'Pulse: POS at rest had a mean error of 3.8 and a root mean square error of 7.6 beats per minute on the UBFC-Phys dataset (light skin, published analysis). Breathing: about 1.3 breaths per minute from chest motion and 2.0 from head motion (IEEE EMBC 2022). These describe other implementations, so they are placeholders: once you have entered 5 reference values on the results screen, the band switches to twice your own mean error (shown in History).',
    limits: 'Error is larger on darker skin, in poor light and with movement. A change can be real and still smaller than the band, and a change beyond the band can still be noise.',
  },
  crew: {
    title: 'Inspiration4 crew blood data',
    method: 'Serum comprehensive metabolic panel from the four Inspiration4 crew members, three times before flight (92, 44 and 3 days before launch) and four times after (1, 45, 82 and 194 days after return). The chart shows each person\'s values against the lab\'s population range and their own pre-flight range.',
    source: 'NASA Open Science Data Repository, OSD-575 (LSDS-8), doi 10.26030/mc5d-p710; Overbey et al., Nature 2024 (Space Omics and Medical Atlas). Values copied from the published TRANSFORMED files (metabolic panel, Eve cardiovascular and immune multiplex panels) by scripts/build_osd575.py. Race based eGFR columns are left out. The multiplex inflammation markers are research assays with no clinical reference range.',
    limits: 'Four people, single blood draws, fasting and time of day not shown here. Three pre-flight values is a small baseline and lab tests vary day to day. Shown to explain personal baselines, not to judge anyone\'s health.',
  },
  glymphatic: {
    title: 'Brain clearance and sleep',
    method: 'Educational tile only. Nothing is measured or scored.',
    source: 'Barisano et al., PNAS 2022: perivascular spaces enlarged after long ISS flights. Miao et al., Nature Neuroscience 2024: in mice, clearance fell during sleep and anaesthesia. Plá, Kroesbergen, Nedergaard et al., Nature Neuroscience 2025: disputed that conclusion; the authors replied.',
    limits: 'Human glymphatic function in spaceflight is a hypothesis. Most mechanism work is in animals.',
  },
};
