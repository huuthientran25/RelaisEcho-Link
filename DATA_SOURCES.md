# Data sources and references

## Data inside the app

No third party dataset is bundled. Measurements come from the user's own camera or video file and stay in their browser.

## Validation data

- **Team self-recordings**, with a reference taken at the same time (fingertip oximeter or watch, metronome paced or counted breaths). Only summary numbers are published. No face video goes in the repository.
- **Synthetic video** from `scripts/make_synthetic_video.py`, with a known pulse and breathing rate. It checks the code path only.

## Space agency data (planned, not yet integrated)

| Dataset | Planned role | Terms |
| --- | --- | --- |
| NASA OSDR OSD-575, Inspiration4 serum panels (n = 4, 3 day flight) | Imported results channel to show the original-baseline comparison on real astronaut data. It tests the comparison logic, not the camera. | NASA open access policy. CC0-1.0 per sibling OSDR studies (verify on the study page). |
| NASA OSDR OSD-569, Inspiration4 CBC | Same role | CC0-1.0 (OSDR page) |
| NASA Life Sciences Portal, UTMB Bedrest Campaign 1 Daily Vitals (n = 3) | Context for a daily check record of pulse and respiration | Publicly available; U.S. Government work |

## References cited in the app

- Wang W, den Brinker AC, Stuijk S, de Haan G. Algorithmic principles of remote PPG. IEEE Transactions on Biomedical Engineering, 2017.
- NASA Human Research Roadmap, gap on limited in-flight dental capability: https://humanresearchroadmap.nasa.gov/gaps/gap.aspx?i=435
- NASA SANS clinical update: https://ntrs.nasa.gov/citations/20220014606
- Smartphone fingertip heart rate and torso video respiratory rate validation (Communications Medicine, 2022): https://www.nature.com/articles/s43856-022-00102-x
- Ax et al. 2026, lower eyelid position in astronauts (context for a possible eye module): https://onlinelibrary.wiley.com/doi/full/10.1002/eer3.70043
- Space Apps 2026 Participant Terms: https://www.spaceappschallenge.org/legal/
