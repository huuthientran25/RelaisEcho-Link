# Validation study kit: testing RelaisÉcho Link with a northern community

Status: **draft for discussion with community partners. No study has been done, and the app makes no claim of northern validation.** This kit is meant to make a community led study easy to start, not to replace community decisions. Everything below can be changed by the partners.

## 1. Governance comes first

- **Inuit data, Inuit decisions.** Inuit Tapiriit Kanatami's National Inuit Strategy on Research calls for Inuit access, ownership and control over data and information. A study starts only after a community or regional organization asks for it or agrees to lead it.
- **Nunavut.** Anyone planning health research in Nunavut must obtain a Scientific Research Licence from the Nunavut Research Institute under Nunavut's Scientists Act, and evidence of prior community consultation is a required part of the application (nri.nu.ca, read 17 Nov 2026).
- **Nunavik.** Health and wellness research projects are first submitted to the Nunavik Regional Board of Health and Social Services for evaluation (nrbhss.ca, read 17 Nov 2026). Nunavik organizations have also set up a regional research governance body; check which approvals it requires at the time.
- **Elsewhere.** Other regions (for example the Northwest Territories, Nunatsiavut, NunatuKavut) have their own licensing and review processes; ask the regional organization.
- **University ethics** (for example Concordia's research ethics board) is needed as well, and does not replace community approval.
- **Language.** Materials in Inuktitut are prepared by community translators. The app does not use machine translation for Inuktitut.

## 2. Question

Does the camera checkup measure pulse and breathing well enough, in the conditions where people would use it, to follow a person's own changes? Secondary: how often do checks fail, and does the error depend on light, cold, skin tone or the phone?

## 3. Design (proposal)

- **Method comparison**, each participant measured at the same time by the app and by a reference: a fingertip pulse oximeter (pulse) and counted breaths over 60 seconds by a trained community health worker (breathing). The app's bench test mode already records both, with condition tags and participant codes (it refuses names).
- **Conditions to cover** (each tagged in the app): indoor and outdoor light, after coming in from the cold, morning and evening, phone types people actually own.
- **Repeated checks** in a subset of people over several weeks, to measure how much a person's own values vary from check to check, which is what the early warning relies on.
- **Failures count.** A scan that gives no value counts against the method; it is never dropped.

## 4. How many people

The app's bench report computes this from the pairs collected so far. The standard error of a 95% limit of agreement is about the square root of 3 s² / n, where s is the standard deviation of the differences and n the number of pairs (Bland, after Bland and Altman 1986). So n = 3 × (1.96 × s / w)² pairs pin each limit to within ± w.

Example (MODELED, not our data): if the camera and the oximeter differ with a standard deviation of 4.5 bpm, pinning the limits to ± 2 bpm needs about 59 pairs, and ± 1 bpm about 234. Bland usually recommends 100 pairs, which gives about ± 0.34 s. Pairs should come from many different people.

## 5. Analysis plan (to be agreed and written down before data collection)

- Bland and Altman: bias, 95% limits of agreement with their confidence intervals, plotted against the mean.
- Failure rate overall and by condition.
- Error by condition tag and by phone, reported even when the groups are small, with the group sizes.
- Within person variation from the repeated checks, then rerun of the app's `simulateMonitoring` with that measured variation and sensor error, to state what the early warning can and cannot catch with the real numbers.
- Success criteria proposed for discussion, not decided: pulse limits of agreement within ± 10 bpm, failure rate under 20%. The partners decide what is good enough for their purpose.

## 6. Data

- Stays on the community's devices. The app has no server; exports are files the community holds.
- Participant codes only; no names, photos or video leave the device unless the partners decide otherwise.
- Results go back to the community first, in plain language, before any publication.

## 7. What the app already provides

Bench test mode with condition tags and participant codes; a one page bench report with failures, bias, limits of agreement, error by condition and the sample size planning above; CSV export; offline use; English and French. The monitoring simulation can model missed checks (`missPct`): in simulation, with daily checks and an accurate sensor, a week long 7 bpm rise is caught in 96% of cases, 78% if 30% of checks are missed, and 23% if 30% are missed and the sensor error is 5 bpm (MODELED).

## 8. What is missing

A community partner who wants this; ethics and licensing; Inuktitut materials by community translators; reference devices; funding for community researchers' time.
