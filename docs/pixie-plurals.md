# Pixie Plurals

### 1) One-sentence pitch
Help Pip, a woodland pixie, grow a magical garden by spelling plurals, learning how one becomes more than one while practising letter recognition and keyboard skills.

### 2) Core loop (3–6 bullets)
- Choose Add S or Pixie Mix and start a six-word garden.
- See one illustrated object beside two matching objects, with singular and plural words underneath.
- Read the short transformation hint and type the complete plural; changed letters are highlighted.
- Correct letters fill their tiles; mistakes show the next letter without losing progress.
- Completing a plural grows a garden patch containing two matching objects.
- Finish six patches, celebrate, then replay or choose another path.

### 3) Why it fits this repo (3–6 bullets)
- The Hugo layout retains all five define blocks and the shared footer.
- Shared game shells, cards, status banners and letter rows provide responsive structure.
- GameTouchKeyboard handles tap input and keeps the active letter in view.
- GameUI fits complete words and ignores modifiers, held keys and form input.
- GameCelebration provides the accessible win overlay, focus handling and replay.

### 4) Implementation checklist (files + key notes)
- Content: content/games/pixie-plurals.md, light theme and a grown-up one/two tip.
- Template: layouts/games/pixie-plurals.html, uses Witch’s Word Brew’s helper structure with a new illustrated garden and singular/plural comparison.
- Scoped styles: assets/css/games/pixie-plurals.css.
- Controller: static/js/game/pixie-plurals.js, explicit spelling data for each word instead of guessing plural rules.
- Register between Phoneme Sound Lab and Quick Fox Quest in data/games.yaml, with an illustrated menu thumbnail.
- Art masters: static/images/pixie-plurals/pip.png and objects.png; browser assets: pip.webp and objects.webp in the same folder.
- Tests: tests/shared-ui.test.mjs covers both paths with real physical-key and touch journeys, matching one/two pictures, accurate suffixes, irregular words, mistake recovery, whole-word fitting, garden progress, replay, reset, mobile feedback, landscape and reduced motion. The shared all-game audit includes the new page.

### 5) Difficulty scaling + accessibility
Add S: CAT→CATS, BUG→BUGS, FROG→FROGS, STAR→STARS, SEED→SEEDS, FLOWER→FLOWERS.

Pixie Mix: BOX→BOXES, BUSH→BUSHES, FOX→FOXES, BERRY→BERRIES, LEAF→LEAVES, MOUSE→MICE. Word-specific hints avoid teaching “always add S” or overgeneralising Y/F changes. Explicit stems/endings also highlight the entire irregular word MICE.

There is no timer, score penalty or animation gate. One and two are drawn by duplicating the same single-object sprite in code, ensuring counts are correct. Strong sage/lilac/cream contrast, a gold current letter and green completed letters make state clear alongside text labels. Only the feedback region announces updates. Garden slots and the native progress bar have accessible descriptions. Reduced-motion preferences suppress growth animation. Sound uses the shared mute helper and tolerates unavailable external clips.

### 6) Assets (optional)
Generated using the built-in image-generation tool, without the CLI/API fallback. Original transparent PNGs are preserved; FFmpeg made smaller WebP files while retaining alpha. Embedded audio uses Google Actions wood-plank, cartoon-boing and magic-chime URLs; clips are not redistributed.

Pixie prompt:

```text
Use case: illustration-story. Asset type: children's typing game storybook character vignette, landscape 3:2 composition, genuinely transparent background.
Primary request: a beautiful friendly woodland pixie tending a tiny magical garden. Premium original children's storybook art, richly painted gouache, soft colored-pencil textures and tactile natural materials, charming rounded forms and exquisite gentle lighting, NOT emoji or flat clipart.
Subject: a small cheerful pixie with warm brown skin, short curly dark hair, little pointed ears, translucent dragonfly-like wings, a sage-green leaf dress with a soft lavender petal collar and tiny slippers. The pixie kneels on a mossy stone on the LEFT, smiling and holding a delicate gold star-tipped wand toward a cluster of tiny pink bell flowers and a rounded toadstool on the RIGHT. A few very subtle warm gold magical motes. Everything fully visible, including wings and feet. A cozy nature-loving character, gentle and welcoming for children ages 2–6. Eye-level three-quarter view. Soft mint, moss, dusty lilac, warm cream and amber palette, lovely moonlit glow but bright readable face. Generous transparent breathing room around the self-contained silhouette and transparent soft grounded shadow. No rectangular backdrop, no sky, no text, no letters, no logos, no watermark, no checkerboard. This must be a production-quality transparent illustration readable at 240–440px wide.
```

Object atlas prompt:

```text
Use case: stylized-concept. Asset type: precisely aligned 12-icon sprite atlas for a children's plural-spelling garden game. Landscape 3:1 canvas, exactly SIX equal square columns by TWO equal square rows on a genuinely transparent background. Each isolated object centered in its own cell with at least 12% empty cell padding, no overlaps, no dividers or visible grid.
Style: premium hand-painted children's storybook gouache, tactile softly shaded forms, soft colored-pencil edges, charming friendly animals, botanical garden palette of moss, sage, lilac, cream, amber and soft rose. Strong readable silhouettes, no emoji, no flat generic clipart.
EXACT left-to-right order:
TOP ROW: 1 a friendly sitting ginger CAT; 2 a little friendly spotted ladybird BUG; 3 a smiling green FROG; 4 a glowing gold five-point STAR; 5 one large almond-brown SEED with no leaf or sprout; 6 one pink bell FLOWER with green stem and two leaves.
BOTTOM ROW: 1 one small cream wooden BOX; 2 one rounded green BUSH with no berries; 3 one friendly curled-tail orange FOX; 4 one ripe purple BERRY with little green cap; 5 one sage-green pointed LEAF; 6 one tiny friendly grey MOUSE with rounded ears and pink nose.
Exactly ONE object in every cell. Every animal/object fully contained within its own uniform square cell. Consistent visual scale, ample transparent separation, no objects crossing grid boundaries, no ground plane, no frame, no text, no labels, no letters or numbers, no watermark, no checkerboard. These icons will be duplicated by code to visibly show ONE object becoming TWO matching objects, so exact single-object silhouettes and uniform grid placement are essential.
```
