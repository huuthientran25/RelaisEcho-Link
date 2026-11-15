# Data sources and references

## Data inside the app

- The user's own measurements come from their camera or video file and stay in their browser.
- **NASA OSDR OSD-575** (SpaceX Inspiration4, LSDS-8), serum comprehensive metabolic panel, doi 10.26030/mc5d-p710, bundled as `data/osd575-cmp.json` (15 analytes, 4 crew, 7 timepoints, lab reference ranges). Built by `scripts/build_osd575.py` from `LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv`. Race based eGFR columns are excluded. Publication: Overbey et al., Nature 2024, doi 10.1038/s41586-024-07639-y. Terms: NASA open data; exact licence text to be confirmed on the OSDR study page before submission.
- Published constants used in the Mission board (see references below): NASA-STD-3001 career limit, ISS dose range, two process model constants, PVT-B settings.

## Validation data

- **Team self-recordings**, with a reference taken at the same time (fingertip oximeter or watch, metronome paced or counted breaths). Only summary numbers are published. No face video goes in the repository.
- **Synthetic video** from `scripts/make_synthetic_video.py`, with a known pulse and breathing rate. It checks the code path only.

## Space agency data (other candidates, not integrated)

| Dataset | Planned role | Terms |
| --- | --- | --- |
| NASA OSDR OSD-569, Inspiration4 CBC | Same role | CC0-1.0 (OSDR page) |
| NASA Life Sciences Portal, UTMB Bedrest Campaign 1 Daily Vitals (n = 3) | Context for a daily check record of pulse and respiration | Publicly available; U.S. Government work |

## References cited in the app

- Wang W, den Brinker AC, Stuijk S, de Haan G. Algorithmic principles of remote PPG. IEEE Transactions on Biomedical Engineering, 2017.
- NASA Human Research Roadmap, gap on limited in-flight dental capability: https://humanresearchroadmap.nasa.gov/gaps/gap.aspx?i=435
- NASA SANS clinical update: https://ntrs.nasa.gov/citations/20220014606
- Smartphone fingertip heart rate and torso video respiratory rate validation (Communications Medicine, 2022): https://www.nature.com/articles/s43856-022-00102-x
- Ax et al. 2026, lower eyelid position in astronauts (context for a possible eye module): https://onlinelibrary.wiley.com/doi/full/10.1002/eer3.70043
- Space Apps 2026 Participant Terms: https://www.spaceappschallenge.org/legal/
- NASA-STD-3001 Volume 1, standard 4030 (career effective dose limit 600 mSv): https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf
- Cucinotta FA et al. Space radiation cancer risks and uncertainties (ISS crew doses). Radiation Research 170:127, 2008.
- Zeitlin C et al. Measurements of energetic particle radiation in transit to Mars on the Mars Science Laboratory. Science, 2013. Hassler DM et al. Mars' surface radiation environment measured with the MSL Curiosity rover. Science, 2014.
- Daan S, Beersma DGM, Borbély AA. Timing of human sleep: recovery process gated by a circadian pacemaker. Am J Physiol, 1984. Parameters as tabulated in Achermann P, J Biol Rhythms, 1999.
- Barger LK et al. Prevalence of sleep deficiency and use of hypnotics in astronauts before, during, and after spaceflight. Lancet Neurology 13(9):904, 2014.
- Basner M, Mollicone D, Dinges DF. Validity and sensitivity of a brief psychomotor vigilance test (PVT-B) to total and partial sleep deprivation. Acta Astronautica, 2011.
- Jones CW et al. 2022, sleep duration and PVT-B in ISS astronauts (as cited in a ClinicalTrials.gov protocol, NCT03911154).
- Barisano G et al. The effect of prolonged spaceflight on cerebrospinal fluid and perivascular spaces of astronauts and cosmonauts. PNAS 119:e2120439119, 2022.
- Miao A et al. Brain clearance is reduced during sleep and anesthesia. Nature Neuroscience 27:1046, 2024. Reply: Plá V et al., Nature Neuroscience 28:731, 2025.
- Motion-based respiratory rate estimation with motion artifact removal using video of face and upper body. IEEE EMBC, 2022.
- Nowara EM et al., meta analysis of skin type and remote PPG error (cited in npj Digital Medicine, 2025).
- Overbey EG et al. The Space Omics and Medical Atlas (SOMA) and international astronaut biobank. Nature, 2024.
- Soukupová T, Čech J. Real-time eye blink detection using facial landmarks. Computer Vision Winter Workshop, 2016.
