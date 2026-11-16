# AI use disclosure

Edit this file so it describes what the team actually did.

- **Tool:** Claude (Anthropic), Claude Opus 5.5 and Claude Sonnet 5.5, used through claude.ai on 14 and 15 November 2026, after the hackathon started.
- **What it produced:**
  - The app code in `js/`, `index.html`, `css/` and `sw.js` (versions v0.1 to v0.61), under the team's direction and feature requests
  - The unit tests (`tests/`, 114 tests), browser test scripts and the synthetic test video script
  - `scripts/build_osd575.py`, which converts the NASA OSDR OSD-575 files into `data/osd575-cmp.json`
  - A research brief on rules, accuracy, open data and northern health context (Claude research mode)
  - The README and the licence and data source notes
  - The planning document, the UI mockups and the 30 second video storyboard
- **What the team did:** all creative decisions were made by the team (Thien Tran): the product idea, the Earth use case, which features to build, keep or cut, the colour scheme and logo choice, and the wording of the pitch. [Add the review, real device tests and bench test results.]
- **Other AI tools:** ChatGPT Astra (OpenAI) was also used. The logo was generated with ChatGPT; it carries a visible "AI" watermark and an "AI-generated (ChatGPT)" caption wherever it appears in the app, the demo reel and the slides.
- **AI images or video:** the logo is the only AI generated image; it was generated with ChatGPT (OpenAI) at the team's request, and the app icons were cut from it. Space Apps requires a visible watermark on SI-generated images: the app shows an "AI" mark on the logo plus the caption "Logo: AI-generated (ChatGPT)", the demo reel's title and end cards say "AI-generated logo", and the slide deck's cover says "AI-generated logo (ChatGPT)". The small browser tab and home screen icons are too small to carry text; this file and the footer note cover them. Screenshots in the deck are of the app itself, not generated images.
- **AI inside the app:** none. No language model or generative model runs in the app. The face landmark model is MediaPipe's (see `LICENSES.md`).
