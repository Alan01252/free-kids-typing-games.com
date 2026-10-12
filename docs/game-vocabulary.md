# Game vocabulary audit

All 24 registered games were reviewed against their setting or learning goal.
Random word pools are maintained in `data/game_words.json`; the six corresponding
templates read that data directly. Words should be familiar, concrete where
possible, and genuinely connected to the game. Do not use a generic random-noun
list or made-up fragments as spelling targets.

Picture-led games keep their fixed word, illustration and hint records together.
Changing an illustrated word also requires changing the matching picture and
hint. Sound-led games must keep spelling, phoneme chunks and audio aligned.

| Game | Vocabulary policy and audit result |
| --- | --- |
| A–Z | Full alphabet in order; letter-recognition goal. |
| Airport Adventure | Ticket, bag, gate, seat, runway and takeoff match the illustrated airport journey. |
| Directions | Up, down, left and right directly control movement. |
| Easter Egg Hunt | Egg, bunny, chick, tulip, basket and Easter match each illustrated find. |
| Emotion Journey | Feeling names match the character’s expressions and descriptions. |
| Farm Animals | Farm animals and common farmyard companions, with matching pictures. |
| Firefly Flicker | Alphabet letters are the intended skill; letter targets are appropriate. |
| Ghostly Word Hunt | Replaced abstract vocabulary with nine concrete words: ghost, door, cobweb; book, spell, candle; moon, mask, shadow. Each group belongs to its haunted room. |
| Maze Escape | Arrow-key directions drive the maze; there is no arbitrary word pool. |
| New Year’s Countdown | Ten through one, followed by HAPPY NEW YEAR. |
| Numbers Nemesis | Accurate number names from one to twenty, matched to numerals. |
| Only Verbs | Action words remain appropriate to the explicit grammar goal; existing pool preserved and centralised. |
| Phoneme Sound Lab | Everyday objects demonstrate sound chunks. Replaced vague THING/brain picture with THUMB/thumb picture, using TH /θ/, U /ʌ/ and MB /m/ with existing audio. |
| Pixie Plurals | Singular/plural object pairs, with accurate S, ES, IES, VES and MICE transformations. |
| Quick Fox Quest | Changed “jumped” to “jumps” so the promised pangram actually contains all 26 letters. The win quote now uses the same sentence constant. |
| Rocket Run | Replaced fragments and generic sparkle/sound words with 20 space and launch terms, including moon, Mars, Earth, rocket, orbit, comet and astronaut. |
| Sandcastle Builder | Scoop, base, tower, shells and moat follow the illustrated construction steps. |
| Santa Spells | Sixteen concrete Christmas/Santa words: Santa, elf, gift, toy, sack, sleigh, bell, tree, star, holly, cookie, milk, reindeer, snow, hat and boot. |
| Snowman Builder | Snow, building actions, body parts, hat colours and the final sparkle match the existing snowman stages. |
| Speed Racer | Twenty-four racing/vehicle words, including car, lap, pit, kart, tyre, fuel, gear, track, wheel, speed, brake, finish, helmet and trophy. Unrelated nouns removed. |
| Supermarket Spelling | Groceries and checkout match the aisle illustrations. |
| Vampire Vowels | A, E, I, O and U match the vowel-learning goal. |
| Witch’s Word Brew | Magical/Halloween ingredients match their artwork and recipe hints. |
| Word Builder | Familiar everyday starter words fit the general word-building goal. Adult-chosen custom targets remain supported. |

The refreshed random pools have no duplicate entries and use plain A–Z spelling,
matching their input handlers. The longest curated default target is ASTRONAUT
(nine letters). Browser checks exercise longest-word fitting on a 320px phone,
real random sampling, full rounds, all haunted rooms, Word Builder’s suggestions,
THUMB’s spelling and sound files, and the fox sentence’s alphabet coverage.
