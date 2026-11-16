# AI use disclosure

Edit this file so it describes what the team actually did.

- **Tool:** Claude (Anthropic), Claude Opus 5.5 and Claude Sonnet 5.5, used through claude.ai on 14 and 15 November 2026, after the hackathon started.
- **What it produced:**
  - The app code in `js/`, `index.html`, `css/` and `sw.js` (versions v0.1 to v1.2), under the team's direction and feature requests
  - The unit tests (`tests/`, 129 tests), browser test scripts and the synthetic test video script
  - `scripts/build_osd575.py`, which converts the NASA OSDR OSD-575 files into `data/osd575-cmp.json`
  - A research brief on rules, accuracy, open data and northern health context (Claude research mode)
  - The README and the licence and data source notes
  - The French interface text (`js/i18n-fr.js`, `js/evidence-fr.js` and `js/i18n.js`): an SI-generated draft, labelled on screen as written with AI help and awaiting a fluent reviewer. No Inuktitut text is generated.
  - The planning document, the UI mockups and the 30 second video storyboard
- **What the team did:** all creative decisions were made by the team (Thien Tran): the product idea, the Earth use case, which features to build, keep or cut, the colour scheme and logo choice, and the wording of the pitch. [Add the review, real device tests and bench test results.]
- **Other AI tools:** ChatGPT Astra (OpenAI) was also used. The logo was generated with ChatGPT; it carries a visible "AI" watermark and an "AI-generated (ChatGPT)" caption wherever it appears in the app, the demo reel and the slides.
- **AI images or video:** the logo is the only AI generated image; it was generated with ChatGPT (OpenAI) at the team's request, and the app icons were cut from it. Space Apps requires a visible watermark on SI-generated images: the app shows an "AI" mark on the logo plus the caption "Logo: AI-generated (ChatGPT)", the demo reel's title and end cards say "AI-generated logo", and the slide deck's cover says "AI-generated logo (ChatGPT)". The small browser tab and home screen icons are too small to carry text; this file and the footer note cover them. Screenshots in the deck are of the app itself, not generated images.
- **AI audio:** the music in the 30 second demo video is an original track synthesized from scratch by `scripts/make_music.py`, a program written by Claude (no samples or outside audio). Space Apps asks that AI audio be acknowledged in text and metadata: this line, and the video file's metadata (comment and audio track title), say so. The same track ships in the app as `audio/relaisecho-theme-ai-generated.mp3` for the in-app demo reel; its ID3 title and comment say it is AI-generated, and the reel shows "Music: AI-generated" on screen while it plays.
- **Code and data metadata:** every source file the team's AI tool wrote (`js/`, `tests/`, `scripts/`, `css/app.css`, `sw.js`, `index.html`) starts with a line marking it as AI-assisted (SI-generated) code; `index.html` also has an `ai-disclosure` meta tag; `package.json` has an `ai_disclosure` field; each bundled data summary in `data/` has an `ai_disclosure` field. Vendored third party code (`vendor/`) and fonts are not AI-generated and are not marked.
- **Demo video:** the in-app reel shows "SI-generated demo (AI-assisted) · Sample data" in the top right the whole time, so a recording made from it is watermarked. The 30 second video carries a visible "AI-assisted production" watermark, and its metadata names the AI-generated music.
- **AI inside the app:** none. No language model or generative model runs in the app. The face landmark model is MediaPipe's (see `LICENSES.md`).
