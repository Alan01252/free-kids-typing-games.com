# Speed Racer artwork refresh

Created with the built-in image-generation tool. The PNG originals are saved in static/images/speed-racer/car.png and circuit.png. The game uses car.webp (480 × 320, transparent) and circuit.webp (1440 × 480), compressed with FFmpeg while preserving the artwork and the car’s alpha.

The illustrated car replaces the emoji inside the blue circle. A sunlit countryside backdrop, an asphalt straight, native chequered finish markings, a compact two-column dashboard and a teal/cream palette replace the old oval track. The car’s travel range accounts for its width, keeping the entire sprite visible at the starting and finishing positions and after phone rotation. Completed words light the seven roadside markers. The stopwatch stops at the same value shown in the win dialog and is excluded from live announcements. Reduced-motion settings disable car movement transitions.

Validation in tests/shared-ui.test.mjs covers starts, correct and incorrect letters, full seven-word races, finish bounds, both rotation directions, reset/replay, stable final time, image loading and reduced motion at desktop, 320px and 390px phones and short landscape. The existing shared mobile audit still covers every registered game.

## Car prompt

```text
Use case: stylized-concept. Asset type: children's racing-game car sprite, landscape 3:2 composition, genuinely transparent background.
Primary request: a gorgeous little cherry-red racing go-kart pointing to the RIGHT, complete and isolated, for a polished kids typing race. Premium hand-painted 3D toy illustration with tactile enamel surfaces and soft gouache texture, rounded friendly forms, strong readable silhouette. Three-quarter SIDE VIEW with a tiny touch of overhead view; chunky charcoal rubber wheels, cream racing stripes, turquoise windscreen, warm gold wheel hubs and a little rear spoiler. A cheerful little driver wearing a sunny-yellow rounded helmet and goggles sits naturally in the car, very simple friendly face. Vehicle low and wide, lively but no exaggerated motion blur. Warm sunlight, soft contact shadow beneath the tires. Car entirely within the frame including the spoiler, tires and front nose, 12% transparent breathing room at every edge. Small enough visual detail to look excellent at 110–160px wide. No letters, no numbers, no logos, no watermark, no border, no floor or background rectangle, no scenery, no checkerboard. Red, cream, yellow and turquoise palette. Every visible car and driver element must fit completely inside the transparent canvas.
```

## Circuit prompt

```text
Use case: illustration-story. Asset type: wide landscape backdrop for a children's typing race, landscape 3:1 composition.
Primary request: a beautifully illustrated sunlit countryside racing circuit environment. Premium hand-painted toy-world illustration, soft gouache textures and rounded 3D-like forms, charming and polished. Pale blue sky with soft cream clouds in the top half, layered sage-green rolling hills, a small friendly distant trackside grandstand with striped cream and coral canopy on the LEFT, a few triangular bunting pennants on poles near the far edges, tiny rounded trees. A warm sunny festival racing day. The entire LOWER THIRD must be an uncluttered smooth grassy foreground, gentle sage and mint tones, because a separate interactive asphalt straight and moving car will be overlaid by the game. No baked-in road, no cars, no characters, no finish-line arch, no text, no logos, no numbers or signs, no watermark, no border. Avoid tiny busy details. Camera looks straight across the countryside, not overhead, no vanishing-point road; background should be usable at both wide desktop widths and cropped phone widths. Soft teal, sage, pale blue, cream and a little warm coral palette. Keep center spacious and quiet.
```
