# Data sources and references

## Data inside the app

- The user's own measurements come from their camera or video file and stay in their browser.
- **NASA OSDR OSD-575** (SpaceX Inspiration4, LSDS-8), serum comprehensive metabolic panel, doi 10.26030/mc5d-p710, bundled as `data/osd575-cmp.json` (15 metabolic analytes with lab reference ranges plus 12 Eve Technologies cardiovascular and immune multiplex markers without ranges; 4 crew, 7 timepoints). Built by `scripts/build_osd575.py` from `LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv`, `LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv` and `LSDS-8_Multiplex_serum_immune_EvePanel_TRANSFORMED.csv`. Race based eGFR columns are excluded. Publication: Overbey et al., Nature 2024, doi 10.1038/s41586-024-07639-y. Terms: NASA open data; exact licence text to be confirmed on the OSDR study page before submission.
- **NASA OSDR OSD-575 and OSD-656** (SpaceX Inspiration4), NULISAseq (Alamar) panels: serum `LSDS-8_Multiplex_serum.immune.AlamarPanel_TRANSFORMED.csv` (OSD-575, doi 10.26030/mc5d-p710, 203 targets) and urine `LSDS-64_Multiplex_urine.immune.AlamarPanel_TRANSFORMED.csv` (OSD-656, doi 10.26030/7cax-yj10, taken from the study's own ISA metadata). Summarised for 8 markers (IL-6, IL-8/CXCL8, MPO, MMP-8, BDNF, GFAP, TNF, VSNL1) as fold change against each crew member's own preflight mean, minus the whole panel's median change for that sample; stored in `data/osd575-cmp.json` under `nulisa`, built by `scripts/build_osd575.py`. Shown on the Board tile "Inflammation after landing". Agrees with Kim et al., Nature Communications 2024, doi 10.1038/s41467-024-49211-2 (IL-6 after this flight).
- **Earth reference values (v1.1):** CDC FastStats, Body Measurements, https://www.cdc.gov/nchs/fastats/body-measurements.htm (US adults 20 and over, NHANES August 2021 to August 2023: men 68.9 in, 199.0 lb; women 63.5 in, 171.8 lb). Adult BMI categories: WHO (under 18.5, 18.5 to 24.9, 25 to 29.9, 30 and over). Resting pulse 60 to 100 bpm: American Heart Association (as cited by Mayo Clinic, "Heart rate: What's normal?"). Breathing 12 to 20 per minute: OpenStax, Clinical Nursing Skills, 15.6 Respiration. Menstrual cycle and pulse: Shilaih M. et al., Scientific Reports 2017 (pulse rate during sleep with a wearable: +2.1 bpm fertile window, about +3.2 to 3.8 bpm mid-luteal against menstruation); Moran V.H. et al., Clinical Physiology 2000, doi 10.1046/j.1365-2281.2000.00285.x. Spaceflight menstruation: menstrual suppression is common and data from astronauts who menstruate in flight are limited (Jain and Wotring, npj Microgravity 2016; AstroCup, arXiv 2506.20718).
- Published constants used in the Mission board (see references below): NASA-STD-3001 career limit, ISS dose range, two process model constants, PVT-B settings.
- **NASA DONKI** (Space Weather Database Of Notifications, Knowledge, Information; Community Coordinated Modeling Center, NASA Goddard), read live through `https://api.nasa.gov/DONKI/FLR` (solar flares, last 7 days) and `https://api.nasa.gov/DONKI/SEP` (solar energetic particle events, last 30 days). Loaded only when the person presses the button on the Space weather tile, kept on the device for 3 hours, never bundled. The request carries two dates and an API key (NASA's shared `DEMO_KEY` unless the person enters their own). API guide: https://api.nasa.gov/ . **Status: the parser is unit tested with invented events; the live request could not be exercised from the build environment, so test it once on a real connection.**
- **NASA Life Sciences Portal, Bed Rest Standard Measures: Plasma Volume** (PI Steven Platts), doi 10.83263/4dzb-2267: Campaign 1, Campaign 3 and CFT70 files, summarized by `scripts/build_bedrest.py` into `data/bedrest-pv.json` (medians and counts only; the raw files are not re-hosted because redistribution terms are not confirmed). Shown on the Board's Bed rest fluid shift tile.
- **NASA Life Sciences Portal, Aerobic Capacity, Flight Analog** (PI Alan D. Moore Jr.), doi 10.83263/w056-8t76: CFT70 70 day bed rest peak oxygen uptake before and after, summarized by `scripts/build_vo2.py` into `data/bedrest-vo2.json` (medians and counts per group only; raw files not re-hosted). Shown on the Board's Exercise during bed rest tile.
- **NASA Mars Science Laboratory, RAD instrument** (Curiosity): the deep space transit and Mars surface dose rates in the radiation tile (see references).

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
- Zeitlin C et al. Measurements of energetic particle radiation in transit to Mars on the Mars Science Laboratory. Science 340:1080, 2013 (about 1.8 mSv per day dose equivalent in cruise; about 0.66 Sv for a round trip). Hassler DM et al. Mars' surface radiation environment measured with the Mars Science Laboratory's Curiosity rover. Science 343:1244797, 2014 (0.64 mSv per day on the surface). Southwest Research Institute release, December 2013 (0.67 mSv per day, Aug 2012 to Jun 2013; about 1.01 Sv for 180 days out, 500 on the surface, 180 back).
- NASA-STD-3001 Volume 1, standard 4031 (design reference solar particle event below 250 mSv), in technical brief OCHMO-TB-020: https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf
- JPL Solar System Dynamics, Keplerian Elements for Approximate Positions of the Major Planets (Table 1, 1800 to 2050), used by the Signal delay tile: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- Mars solar conjunction (commanding paused about two weeks, about every two years, when Mars is within about 2 degrees of the Sun): NASA/JPL releases, for example 11 to 25 Nov 2023.
- "The case for expanding visual assessments during spaceflight", Prehospital and Disaster Medicine, 2023 (scheduled ISS vision checks: static visual acuity, Amsler grid, self-reported survey): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10445111/
- NOAA Global Monitoring Laboratory, solar calculation details (equations used by the Daylight tile): https://gml.noaa.gov/grad/solcalc/calcdetails.html
- NASA, International Space Station Facts and Figures (16 orbits, 16 sunrises and sunsets in 24 hours): https://www.nasa.gov/international-space-station/space-station-facts-and-figures/
- Daan S, Beersma DGM, Borbély AA. Timing of human sleep: recovery process gated by a circadian pacemaker. Am J Physiol, 1984. Parameters as tabulated in Achermann P, J Biol Rhythms, 1999.
- Barger LK et al. Prevalence of sleep deficiency and use of hypnotics in astronauts before, during, and after spaceflight. Lancet Neurology 13(9):904, 2014.
- Basner M, Mollicone D, Dinges DF. Validity and sensitivity of a brief psychomotor vigilance test (PVT-B) to total and partial sleep deprivation. Acta Astronautica, 2011.
- Jones CW et al. 2022, sleep duration and PVT-B in ISS astronauts (as cited in a ClinicalTrials.gov protocol, NCT03911154).
- Barisano G et al. The effect of prolonged spaceflight on cerebrospinal fluid and perivascular spaces of astronauts and cosmonauts. PNAS 119:e2120439119, 2022.
- Miao A et al. Brain clearance is reduced during sleep and anesthesia. Nature Neuroscience 27:1046, 2024. Reply: Plá V et al., Nature Neuroscience 28:731, 2025.
- Motion-based respiratory rate estimation with motion artifact removal using video of face and upper body. IEEE EMBC, 2022.
- Nowara EM et al., meta analysis of skin type and remote PPG error (cited in npj Digital Medicine, 2025).
- Overbey EG et al. The Space Omics and Medical Atlas (SOMA) and international astronaut biobank. Nature, 2024.
- Buckenham Boyle A et al. Repeatability and agreement of white-to-white measurements between slit-scanning tomography, infrared biometry, dual rotating Scheimpflug camera/Placido disc tomography, and swept source anterior segment OCT. PLoS ONE, 2021 (iris width about 11.8 to 12.4 mm by device): https://pmc.ncbi.nlm.nih.gov/articles/PMC8284630
- Study of normal maximal mouth opening in 894 Indian adults (51.3 mm men, 44.3 mm women): https://pmc.ncbi.nlm.nih.gov/articles/PMC3428458
- Webcam eye tracking close to laboratory standards: comparing a new webcam-based system and the EyeLink 1000. Behavior Research Methods, 2024: https://pmc.ncbi.nlm.nih.gov/articles/PMC11289017
- McIlreavy L, Freeman TCA, Erichsen JT. Two-dimensional analysis of smooth pursuit eye movements. TVST 8(5):7, 2019, doi 10.1167/tvst.8.5.7.
- Smartphone RGB pupillometry with far red light (difficulty with dark irises in visible light). Scientific Reports, 2023: https://www.nature.com/articles/s41598-023-40796-0
- Neice AE et al. Feasibility study of a smartphone pupillometer and evaluation of its accuracy. Journal of Clinical Monitoring and Computing 35:1269, 2021.
- Collings S et al. Non-invasive detection of anaemia using digital photographs of the conjunctiva. PLoS ONE, 2016: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4829242/
- Zhao L et al. Prediction of anemia in real-time using a smartphone camera processing conjunctival images. PLoS ONE, 2024 (PubMed 38739605).
- University of Washington, Foundations of Clinical Medicine, Head and Neck Exam (thyroid inspection and palpation while swallowing water): https://uw.pressbooks.pub/fcmtextbook/?p=110
- Quantification of tremor using consumer product accelerometry is feasible in patients with essential tremor and Parkinson's disease. Journal of Clinical Movement Disorders 7:4, 2020: https://pmc.ncbi.nlm.nih.gov/articles/PMC7137336
- McDuff D. Camera measurement of physiological vital signs (review), 2021: https://arxiv.org/abs/2111.11547
- Sensors 17(7):1541, 2017, a study combining contact and imaging photoplethysmography for blood pressure; its introduction cites a face to palm pulse transit time study filmed at 420 frames per second: https://pmc.ncbi.nlm.nih.gov/articles/PMC5539707
- van Gastel M, Verkruijsse W. Contactless SpO2 with an RGB camera: experimental proof of calibrated SpO2. Biomedical Optics Express, 2022.
- Hoffman JS et al. Smartphone camera oximetry in an induced hypoxemia study. npj Digital Medicine 5, 2022, doi 10.1038/s41746-022-00665-y.
- Soukupová T, Čech J. Real-time eye blink detection using facial landmarks. Computer Vision Winter Workshop, 2016.
