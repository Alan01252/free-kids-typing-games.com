# Kids Free Typing Games

Hugo site with bite-sized typing games for kids. Uses Tailwind/PostCSS for styles and deploys to S3/CloudFront from GitHub Actions.

## Prerequisites
- Node.js 20+
- Hugo (extended) available in `$PATH`
- npm

## Install
```bash
npm ci
```

## Local development
```bash
npm run dev
```
Starts `hugo server --disableFastRender` with live reload at http://localhost:1313.

## Build
```bash
npm run build
```
Runs `hugo --gc --minify` and writes static output to `public/`.

## Browser regression checks

Start the preview with `npm run dev`, then run `npm test` in another terminal. The
suite uses Node's built-in test runner and a local headless Chromium browser;
there are no additional npm test dependencies. Chromium must be installed and
available as `chromium`, or set `CHROME_BIN` to your Chrome/Chromium executable.

```bash
CHROME_BIN=chromium npm test
```

`SITE_URL` overrides the default `http://127.0.0.1:1313`. Set
`TEST_SCREENSHOT_DIR=/tmp/typing-screenshots` to save screenshots during the run.
Checks cover both menus, failed-script fallback, all registered game pages at
1280px and 320px, and active play at 320×740, 390×844, and 740×360. Mobile checks
inspect single-line words, individual letter bounds, clipped labels, and keyboard
overlap before and after typing. Keyboard geometry checks also cover 375px phones
and verify equal letter-key widths, consistent horizontal/vertical gaps, centered rows,
and a separate Space row across standard, Space-enabled, and vowel layouts.
The suite also covers real touch taps through all five Vampire Vowels rounds,
long Emotion Journey words through phone rotation, readable custom
words with horizontal scrolling when necessary, desktop letter fitting, alphabet
replay, dialog focus, mute persistence, and local touch keys with external requests blocked.
Witch’s Word Brew checks complete both recipes with physical keys and real touch
taps, including mistake recovery, reset, replay and reduced-motion preferences.
Speed Racer checks car bounds throughout a race and after rotation, letter-driven
movement, replay, image loading, and the final stopwatch value.
Pixie Plurals checks both lessons, matching singular/plural pictures, regular and
irregular spellings, mistake recovery, garden growth, touch play and replay.
Vocabulary checks cover curated pool selection, the longest theme words on
phones, full rounds, phoneme spelling/audio alignment and pangram coverage.

Random word pools live in `data/game_words.json`. Keep each pool relevant to its
game’s setting or learning goal. Fixed picture-based sequences stay beside their
image and hint records. See [the vocabulary audit](docs/game-vocabulary.md).

Game menu cards come from `layouts/partials/game-library.html` and
`data/games.yaml`. Set each game's `skill` to `letters`, `words`, or `challenge`
when registering it so both menus agree. Shared visual styles live in
`assets/css/main.css`; game-specific colour variables remain in game layouts.

## Deploy (CI)
Push to `main` triggers `.github/workflows/deploy.yml`:
- Checkout, Node 20 setup (npm cache), `npm ci`
- Install Hugo (extended, latest)
- `hugo --minify`
- Sync `public/` to the S3 bucket `free-kids-typing-games.com` (with `--delete`)


## Site config
`config.toml` sets `baseURL = "https://free-kids-typing-games.com/"`. Update this if the domain changes so sitemaps and canonical URLs stay correct.
