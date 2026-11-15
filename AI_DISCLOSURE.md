# AI use disclosure

Edit this file so it describes what the team actually did.

- **Tool:** Claude (Anthropic), Claude Opus 5.5 and Claude Sonnet 5.5, used through claude.ai on 14 and 15 November 2026, after the hackathon started.
- **What it produced:**
  - The app code in `js/`, `index.html`, `css/` and `sw.js` (versions v0.1 to v0.58), under the team's direction and feature requests
  - The unit tests (`tests/`, 102 tests), browser test scripts and the synthetic test video script
  - `scripts/build_osd575.py`, which converts the NASA OSDR OSD-575 files into `data/osd575-cmp.json`
  - A research brief on rules, accuracy, open data and northern health context (Claude research mode)
  - The README and the licence and data source notes
  - The planning document, the UI mockups and the 30 second video storyboard
- **What the team did:** [describe the team's review, testing on real devices, bench test, threshold changes, design decisions and edits]
- **AI images or video:** the first logo concept was generated with ChatGPT (OpenAI) at the team's request. In v0.58 Claude redrew it as a flat vector (`icons/logo-mark.svg`: corner brackets, an eye, two echo arcs) and rendered the app icons from it, so the logo in the app is AI made in both steps. [Check the current Space Apps rule on AI generated images, including any watermark requirement, and state here how the team handled it.] Any AI generated image or footage in the submission video must follow the same rule.
- **AI inside the app:** none. No language model or generative model runs in the app. The face landmark model is MediaPipe's (see `LICENSES.md`).
