# Witch’s Word Brew

### 1) One-sentence pitch
Help Juniper, a friendly witch, brew a moonlight potion by spelling six illustrated ingredients, practising letter recognition and short-word spelling.

### 2) Core loop (3–6 bullets)
- Choose Little spells (3–4 letters) or Bigger spells (5–7 letters), then start.
- Match the illustrated ingredient and type its displayed letters.
- Correct letters fill green tiles; mistakes give a gentle next-letter hint without losing progress.
- Complete a word to toss the ingredient into the cauldron and stamp the recipe shelf.
- Add all six ingredients to bottle moonlight, celebrate, and brew again.

### 3) Why it fits this repo (3–6 bullets)
- Hugo content and layout use the existing five template blocks and shared footer.
- Shared game shell, card, status banner, and letter rows keep the layout consistent.
- GameTouchKeyboard supplies native touch keys and tracks the active letter.
- GameUI fits complete words and guards keyboard shortcuts and form controls.
- GameCelebration supplies the accessible win dialog and replay.

### 4) Implementation checklist (files + key notes)
- Content: content/games/witch-word-brew.md, dark theme and grown-up reading tip.
- Layout: layouts/games/witch-word-brew.html, based on Only Verbs’ shared helpers with a new illustrated kitchen and parchment recipe book.
- Scoped styling: assets/css/games/witch-word-brew.css.
- Controller: static/js/game/witch-word-brew.js, isolated state and two fixed six-word recipes.
- Register the game before Word Builder in data/games.yaml, with optional artwork for the shared menu card.
- Art: static/images/witch-word-brew/kitchen.png and ingredients.png are original generated masters; kitchen.webp and ingredients.webp are optimised browser assets with alpha preserved.
- Validation: tests/shared-ui.test.mjs covers physical keys, real touch taps, both recipes, mistake recovery, reset, replay, word fitting, reduced motion and blocked external requests. The existing mobile audit automatically includes the new game.

### 5) Difficulty scaling + accessibility
Little spells: CAT, BAT, WEB, MOON, WAND, STAR. Bigger spells: GHOST, BROOM, SPELL, SPIDER, PUMPKIN, MAGIC. No time limit, penalties or reading-speed requirement. Clear cream/plum text, amber current letters and green completed letters; progress has text and an accessible native progress bar. Only feedback uses a live region. Touch and physical keyboards share one input handler. Form controls, modifiers and held keys are ignored. Reduced-motion preferences suppress decorative bubbles and ingredient tosses. Sound uses the shared mute controls and tolerates unavailable external audio.

### 6) Assets (optional)
Created with the built-in image-generation tool. No CLI/API fallback. Original RGBA PNGs are preserved; FFmpeg produced smaller WebP versions without changing the artwork.

Kitchen prompt:

```text
Use case: illustration-story. Asset type: premium children's typing game scene, landscape 3:2 composition, genuinely transparent background.
Primary request: a friendly little witch and her bubbling cauldron for a cozy Halloween word game for ages 2–6. Original richly painted storybook art, tactile gouache and soft colored-pencil edges, charming rounded shapes, restrained intricate detail, beautifully lit, polished children's book illustration, NOT emoji or generic flat clipart.
Composition: a complete self-contained vignette with a little witch on the LEFT HALF wearing an oversized plum-purple pointed hat, round spectacles, copper-red bob hair, deep violet dress, smiling warmly and holding a wooden stirring spoon; a large round charcoal cauldron with a warm copper crescent emblem on the RIGHT HALF, turquoise potion visibly glowing at the rim, small pale gold sparkles, on a small rustic wooden table. Small amber candle and tiny moss accents at table foot only. The witch and the pot are fully visible and clearly readable at small phone sizes. Witch's face near x30% y35%; cauldron's open rim near x67% y60%. Generous transparent breathing room around the outer silhouette, grounded soft transparent shadow. No setting/background, no floor rectangle, no border, no checkerboard. No text, no letters, no logos, no watermark. Friendly magical mood, soft amber candlelight and mint potion glow, plum/indigo/copper palette. Keep the cauldron rim uncluttered for animated UI bubbles.
```

Ingredient atlas prompt:

```text
Use case: stylized-concept. Asset type: exactly 12 illustrated ingredient icons in a precise 6-column by 2-row sprite atlas on a genuinely transparent background. Landscape 3:1 canvas, 12 EQUAL SQUARE CELLS, each illustration centered in its cell, equal generous empty padding (at least 15% of each cell), NO visible grid or dividers.
Primary request: cozy Halloween ingredients for a beautiful children's witch typing game ages 2–6. Original premium storybook gouache illustrations, soft colored-pencil edges, richly shaded tactile surfaces, rounded friendly forms, readable silhouettes, plum violet, amber, mint, soft cream and charcoal palette, little highlights, NOT emoji, NOT generic flat clipart.
EXACT ordering LEFT TO RIGHT:
TOP ROW: 1 a sitting friendly black CAT with amber eyes; 2 a friendly purple BAT with spread wings; 3 a silvery delicate spider WEB; 4 a golden crescent MOON; 5 a little violet magic WAND with gold star tip; 6 a glowing five-point golden STAR.
BOTTOM ROW: 1 a small friendly cream GHOST; 2 a little witch BROOM with honey-colored bristles; 3 a rolled parchment SPELL scroll with a violet ribbon and a simple star drawing, NO writing; 4 a friendly round purple SPIDER with eight short legs; 5 a warm orange PUMPKIN with little green stem; 6 a round mint MAGIC potion bottle with cork and gold star sparkle.
Each object fully contained in its own square cell, no touching neighboring cells, objects similar visual weight, black cat and ghost have sweet expressive faces. Transparent backdrop, no text, no labels, no letters, no numbered cells, no watermark. This is a functional game sprite atlas, exact uniform placement is essential.
```

Audio uses the Google Actions wood-plank, cartoon-boing and magic-chime URLs embedded in the layout; audio files are not redistributed.
