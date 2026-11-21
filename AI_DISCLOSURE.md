# How AI was used

RelaisÉcho Link was built by Thien Tran at the NASA Space Apps Challenge 2026 (Montreal, 14 and 15 November 2026) with AI assistance. This file says exactly what the AI tools did, so anyone reading the code knows who did what.

## What I did

- The product idea and the two use cases (astronauts in orbit, remote northern communities).
- Which features to build, keep or cut, in what order, and how they should behave.
- The choice of NASA and published data, and the decision to compare each person with their own baseline instead of a population average.
- Every threshold and design rule (all collected in `js/config.js` and labelled as design choices), the colour scheme, the logo choice and the wording of the pitch.
- Reviewing the results on screen, reporting problems and deciding what changed.

## What Claude (Anthropic) did, under my direction

- Wrote most of the app code in `js/`, `index.html`, `css/` and `sw.js`.
- Wrote the unit tests (`tests/`, 132 tests), the browser test scripts and the synthetic test video script.
- Wrote `scripts/build_osd575.py`, which turns the NASA OSDR OSD-575, OSD-656 and OSD-563 files into the small summaries in `data/`.
- Wrote the README, the licence and data source notes, and a research brief on accuracy, open data and northern health context.
- Drafted the French interface text. It is labelled on screen as an AI-assisted draft awaiting a fluent reviewer. No Inuktitut text was generated.
- Wrote `scripts/make_music.py`, which synthesizes the demo music from scratch (no samples). The demo shows "Music: AI-generated" while it plays.

Every source file written this way starts with a line saying so, and `package.json` and each data summary carry an `ai_disclosure` field.

## Other tools

- **ChatGPT (OpenAI):** the logo was made with ChatGPT for this project; the app icons were cut from it. During the hackathon it carried a visible "AI" mark, as the Space Apps rules required for AI-generated images. This portfolio edition (v2.0) removes that mark; this file keeps the credit.
- **ChatGPT Astra (OpenAI)** was also used during the hackathon.

## AI inside the app

None. No language model or generative model runs in the app. The face landmark model is Google's MediaPipe Face Landmarker (see `LICENSES.md`).

## Not yet done

- Accuracy on real people has not been tested (see the README's bench test section).
- The French text has not been reviewed by a fluent speaker.
