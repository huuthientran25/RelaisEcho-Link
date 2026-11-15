// Text for the evidence drawer. Keep each entry to: method, source, what it cannot tell you.

export const EVIDENCE = {
  pulse: {
    title: 'Pulse estimate',
    method: 'Tiny colour changes in forehead and cheek skin follow each heartbeat. The POS method separates that signal from lighting changes, then the strongest rhythm between 42 and 180 beats per minute is taken from 10 second windows. Windows with poor capture or a weak rhythm are rejected, not averaged in.',
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
    method: 'Your number of days is multiplied by a low and a high published ISS daily dose and compared with the career limit.',
    source: 'Career limit below 600 mSv for all ages and sexes: NASA-STD-3001 Volume 1, standard 4030. Low end: 19 ISS crew averaged 72 mSv over about 6 months (Cucinotta et al., Radiation Research 2008). High end: about 310 mSv per year (Chancellor et al. 2017, as cited in later reviews). Deep space for comparison: Curiosity\'s RAD instrument measured about 0.46 mGy per day absorbed dose during the cruise to Mars (Zeitlin et al. 2013) and about 0.23 on the surface (Hassler et al. 2014).',
    limits: 'Actual dose depends on solar cycle, shielding, spacewalks and orbit. This is context for planning, not a dosimeter reading.',
  },
  alertness: {
    title: 'Alertness check',
    method: 'A brief psychomotor vigilance test: a counter appears after a random 1 to 4 second wait, for 3 minutes. The app reports the median reaction time, lapses (responses of 355 ms or slower, the threshold published for the 3 minute version, plus missed counters) and false starts (pressing early).',
    source: 'Brief 3 minute PVT (PVT-B): Basner, Mollicone and Dinges, Acta Astronautica 2011. In ISS astronauts, nights of 6 hours of sleep or less were linked to worse PVT-B scores (Jones et al. 2022).',
    limits: 'Screens, keyboards and browsers add their own delay, so numbers are compared only with your own earlier tests on the same device, never with published norms. Practice makes the first tests slower. It does not diagnose fatigue or any condition.',
  },
  eyes: {
    title: 'Blinks and eye closure',
    method: 'During the reaction test the front camera finds eyelid landmarks up to about 15 times a second. Eye opening is measured as lid height over eye width (eye aspect ratio). Your own open-eye value is learned in the first seconds; the eye counts as closed below 60% of it. Closures under half a second count as blinks, longer ones are counted separately.',
    source: 'Eye aspect ratio: Soukupová and Čech, Real-time eye blink detection using facial landmarks, 2016. Long and frequent eye closures are a recognised sign of drowsiness in fatigue research; this app uses no published cut off.',
    limits: 'Not validated. Glasses, glare, dim light, looking down and low frame rates all affect it, and a 15 per second rate can miss very quick blinks. The thresholds are design choices. It does not diagnose drowsiness or any eye condition.',
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
