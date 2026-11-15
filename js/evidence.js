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
  glymphatic: {
    title: 'Brain clearance and sleep',
    method: 'Educational tile only. Nothing is measured or scored.',
    source: 'Barisano et al., PNAS 2022: perivascular spaces enlarged after long ISS flights. Miao et al., Nature Neuroscience 2024: in mice, clearance fell during sleep and anaesthesia. Plá, Kroesbergen, Nedergaard et al., Nature Neuroscience 2025: disputed that conclusion; the authors replied.',
    limits: 'Human glymphatic function in spaceflight is a hypothesis. Most mechanism work is in animals.',
  },
};
