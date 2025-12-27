# Agent Notes

## Quick Start: New Game Checklist
- **Create content stub** in `content/games/<slug>.md` with the standard front matter (`title`, `layout`, `tip`, optional `theme`). The `layout` key must equal the template filename you add under `layouts/games/<slug>.html`.
- **Copy a reference layout** from `layouts/games/` (Rocket Run, Only Verbs, etc.) and trim it down. Keep every `define` block: `styles`, `body_class`, `main`, `footer`, `scripts`.
- **Include the shared footer** in the `footer` block (don’t leave it empty), e.g. `{{ partial "game-footer.html" (dict "context" . "tip" .Params.tip "theme" (default "light" .Params.theme)) }}` (use `"dark"` as the fallback if the game uses a dark theme).
- **Use shared shells** in `main`: wrap everything in `.game-shell`, use `.game-card` for surfaces, `.status-banner` for status, `.letter-row` for typing rows, etc. These classes are styled globally in `assets/css/main.css`.
- **Register the game** in `data/games.yaml` (alphabetical list) so navigation, footer carousel, and landing pages stay in sync.
- **Store art and audio** in `static/` (`static/images/...`, etc.) so Hugo copies them automatically. New PNG face art should retain transparent backgrounds.
- **Run Hugo** (`hugo server` for live preview, `hugo` for a one-off build) instead of editing anything in `public/`.

## Building Layouts Consistently
- Scan `assets/css/main.css` for reusable variables before inventing new styles. Many games only override CSS custom properties inside `.game-<slug>`.
- Stick to the shared structure:
  - `.game-shell` wraps each page and controls width/gap.
  - `.game-card` surfaces hold controls, play area, etc.; set per-card overrides with inline `style="--card-shadow-current: …"`.
  - `.status-banner`, `.status-badge`, `.letter-row`, `.letter-box` already have behavior; only tweak colors/sizes via CSS variables.
- For JavaScript, hook up common helpers:
  - `window.GameTouchKeyboard.attach({ … })` for touch devices.
  - `window.GameCelebration.show({ … })` when the player wins.
- Avoid adding global `<script>` or `<style>` tags outside the provided `define` blocks to keep Hugo partials clean.

## Shared Components
### Celebration Overlay
- Partial lives at `layouts/partials/game-win-overlay.html`.
- Trigger with `window.GameCelebration.show({ content, onPlayAgain, focusTarget, initialFocus })`.
- Base template (`layouts/_default/baseof.html`) injects the overlay markup automatically after the `footer`.

### Touch Keyboard & UI Helpers
- `window.GameTouchKeyboard` handles on-screen keys. Pass `getViewportTarget` pointing to the element you want scrolled into view.
- `window.GameUI.fitLettersFor(element)` ensures `.letter-row` boxes resize correctly; call after rendering letters and again inside `requestAnimationFrame`.

## Sound Effects
- Default typing feedback: `https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg`
- Wrong-answer cue: `https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg`
- Rocket Run win: `https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg` (previous `descending_whistle` blocks on ORB)

Use any clip from the Google Actions library (Cartoon category) directly in `<audio>` elements:
```
https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg
https://actions.google.com/sounds/v1/cartoon/cartoon_cowbell.ogg
https://actions.google.com/sounds/v1/cartoon/cartoon_ringing_hit.ogg
https://actions.google.com/sounds/v1/cartoon/clown_horn.ogg
https://actions.google.com/sounds/v1/cartoon/clown_slide_sound_effects.ogg
https://actions.google.com/sounds/v1/cartoon/concussive_guitar_hit.ogg
https://actions.google.com/sounds/v1/cartoon/concussive_hit_guitar_boing.ogg
https://actions.google.com/sounds/v1/cartoon/cowbell_ringing.ogg
https://actions.google.com/sounds/v1/cartoon/crash_layer_cymbals.ogg
https://actions.google.com/sounds/v1/cartoon/crash_layer_drumset.ogg
https://actions.google.com/sounds/v1/cartoon/crash_layer_kick_drum.ogg
https://actions.google.com/sounds/v1/cartoon/crash_layer_kick_pedal.ogg
https://actions.google.com/sounds/v1/cartoon/crash_layer_snare.ogg
https://actions.google.com/sounds/v1/cartoon/crazy_dinner_bell.ogg
https://actions.google.com/sounds/v1/cartoon/cymbal_kick.ogg
https://actions.google.com/sounds/v1/cartoon/deflate.ogg
https://actions.google.com/sounds/v1/cartoon/drumset_falling_down_stairs.ogg
https://actions.google.com/sounds/v1/cartoon/face_stretch.ogg
https://actions.google.com/sounds/v1/cartoon/fart_toot.ogg
https://actions.google.com/sounds/v1/cartoon/getting_stuck.ogg
https://actions.google.com/sounds/v1/cartoon/goofy_spring_bounces.ogg
https://actions.google.com/sounds/v1/cartoon/hair_ripping.ogg
https://actions.google.com/sounds/v1/cartoon/hitting_a_woodblock.ogg
https://actions.google.com/sounds/v1/cartoon/inflating_big_balloon.ogg
https://actions.google.com/sounds/v1/cartoon/instrument_strum.ogg
https://actions.google.com/sounds/v1/cartoon/jingle_bells.ogg
https://actions.google.com/sounds/v1/cartoon/long_fart.ogg
https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg
https://actions.google.com/sounds/v1/cartoon/mechanical_clock_ring.ogg
https://actions.google.com/sounds/v1/cartoon/metal_strike.ogg
https://actions.google.com/sounds/v1/cartoon/metal_twang.ogg
https://actions.google.com/sounds/v1/cartoon/metallic_clank.ogg
https://actions.google.com/sounds/v1/cartoon/metallic_twang_high.ogg
https://actions.google.com/sounds/v1/cartoon/motor_running_muffled.ogg
https://actions.google.com/sounds/v1/cartoon/punchline_drum.ogg
https://actions.google.com/sounds/v1/cartoon/rainstick_slow.ogg
https://actions.google.com/sounds/v1/cartoon/rubber_duck_squeak_series.ogg
https://actions.google.com/sounds/v1/cartoon/rubber_glove_snapping_series.ogg
https://actions.google.com/sounds/v1/cartoon/rubber_squeaking.ogg
https://actions.google.com/sounds/v1/cartoon/siren_whistle.ogg
https://actions.google.com/sounds/v1/cartoon/slapping_three_faces.ogg
https://actions.google.com/sounds/v1/cartoon/slide_whistle_crazy_series.ogg
https://actions.google.com/sounds/v1/cartoon/slide_whistle_rise_and_fall.ogg
https://actions.google.com/sounds/v1/cartoon/slide_whistle_up.ogg
https://actions.google.com/sounds/v1/cartoon/slide_whistle_to_drum.ogg
https://actions.google.com/sounds/v1/cartoon/small_bell_jingle.ogg
https://actions.google.com/sounds/v1/cartoon/stomach_thumps.ogg
https://actions.google.com/sounds/v1/cartoon/straw_squeak.ogg
https://actions.google.com/sounds/v1/cartoon/suction_cup_pull.ogg
https://actions.google.com/sounds/v1/cartoon/tympani_bing.ogg
https://actions.google.com/sounds/v1/cartoon/ufo_zip_whistle.ogg
https://actions.google.com/sounds/v1/cartoon/vomit_in_bathroom.ogg
https://actions.google.com/sounds/v1/cartoon/vomiting_close.ogg
https://actions.google.com/sounds/v1/cartoon/wet_fart.ogg
https://actions.google.com/sounds/v1/cartoon/wind_up_toy.ogg
https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg
https://actions.google.com/sounds/v1/cartoon/woodpecker.ogg
https://actions.google.com/sounds/v1/cartoon/xylophone_tip_toe_scale_up.ogg
```

**Terms reminder:** the library is hosted by Google; embed the URLs in the project only and do not redistribute the files separately.

## Art & Asset Tips
- Keep character PNGs transparent so gradients show through (`sips -g hasAlpha static/images/*.png` on macOS helps verify).
- Place reusable SVGs or audio in `static/` so Hugo copies them unchanged.
- When adding new gradients or shadows, prefer CSS custom properties inside `.game-<slug>` so other games stay unaffected.
