// Text for the evidence drawer. Keep each entry to: method, source, what it cannot tell you.

export const EVIDENCE = {
  pulse: {
    title: 'Pulse estimate',
    method: 'Tiny colour changes in forehead and cheek skin follow each heartbeat. The POS method separates that signal from lighting changes, then the strongest rhythm between 42 and 180 beats per minute is taken from 10 second windows. Windows with poor capture or a weak rhythm are rejected, not averaged in.',
    source: 'Wang, den Brinker, Stuijk and de Haan, Algorithmic Principles of Remote PPG, IEEE Transactions on Biomedical Engineering, 2017.',
    limits: 'Our implementation is not clinically validated. Accuracy drops with movement, dim or flickering light, and has been reported to be worse on darker skin in published work. It cannot give blood pressure, oxygen saturation or heart rhythm.',
  },
  resp: {
    title: 'Breathing estimate',
    method: 'Breathing lifts the shoulders and chest. The app tracks the up and down shift of edges in a box under the chin and finds the dominant rhythm between 6 and 42 breaths per minute. A cycle count is used as a cross check.',
    source: 'Torso video breathing rate has been validated in published smartphone studies (for example Nature Communications Medicine, 2022); those results do not validate this code.',
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
};
