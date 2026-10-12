(function witchWordBrew() {
  const recipes = {
    little: [
      { word: 'cat', hint: 'A whisker of curiosity.', sprite: 0 },
      { word: 'bat', hint: 'A flutter from the twilight sky.', sprite: 1 },
      { word: 'web', hint: 'A silvery thread of moonlight.', sprite: 2 },
      { word: 'moon', hint: 'A spoonful of soft night light.', sprite: 3 },
      { word: 'wand', hint: 'A swish of something wonderful.', sprite: 4 },
      { word: 'star', hint: 'The final sprinkle of sparkle.', sprite: 5 }
    ],
    big: [
      { word: 'ghost', hint: 'A friendly little floating cloud.', sprite: 6 },
      { word: 'broom', hint: 'A sweep of midnight magic.', sprite: 7 },
      { word: 'spell', hint: 'A secret from the recipe book.', sprite: 8 },
      { word: 'spider', hint: 'Eight tiny tiptoes of wonder.', sprite: 9 },
      { word: 'pumpkin', hint: 'A little glow from a lantern.', sprite: 10 },
      { word: 'magic', hint: 'A bottle of make-believe.', sprite: 11 }
    ]
  };
  const get = id => document.getElementById(id);
  const board = get('gameArea');
  const row = get('letterRow');
  const status = get('status');
  const difficulty = get('brewDifficulty');
  const flying = get('flyingIngredient');
  let recipe = recipes.little;
  let ingredientIndex = 0;
  let letterIndex = 0;
  let active = false;

  const keyboard = window.GameTouchKeyboard?.attach({
    id: 'witch-word-brew',
    label: 'Tap letters to brew a little magic',
    onKeyPress: key => typeLetter(key, true),
    getViewportTarget: () => row,
    getPaddingTarget: () => document.querySelector('.game-shell')
  });

  function setSprite(element, index) {
    element.style.setProperty('--sprite-x', `${(index % 6) * 20}%`);
    element.style.setProperty('--sprite-y', index < 6 ? '0%' : '100%');
  }

  function sound(id) {
    const audio = get(id);
    audio.currentTime = 0;
    window.GameSound?.play(audio);
  }

  function tell(kind, message) {
    status.classList.toggle('ok', kind === 'ok');
    status.classList.toggle('bad', kind === 'bad');
    get('statusBadge').textContent = kind === 'bad' ? '?' : '✦';
    get('statusText').textContent = message;
  }

  function renderLetters() {
    const word = recipe[ingredientIndex].word;
    row.replaceChildren();
    for (let i = 0; i < word.length; i += 1) {
      const letter = word[i].toUpperCase();
      const tile = document.createElement('span');
      tile.className = 'letter-box';
      tile.textContent = letter;
      tile.setAttribute('role', 'listitem');
      if (i < letterIndex) tile.classList.add('filled');
      if (i === letterIndex) {
        tile.classList.add('current');
        tile.setAttribute('aria-current', 'step');
      }
      tile.setAttribute('aria-label', `Letter ${letter}${i < letterIndex ? ', correct' : i === letterIndex ? ', next' : ''}`);
      row.appendChild(tile);
    }
    window.GameUI?.fitLettersFor(row);
    if (keyboard?.isTouchDevice()) keyboard.ensureVisible(row);
  }

  function renderShelf() {
    const shelf = get('recipeShelf');
    shelf.replaceChildren();
    recipe.forEach((ingredient, i) => {
      const item = document.createElement('li');
      item.classList.toggle('is-added', i < ingredientIndex);
      item.classList.toggle('is-current', i === ingredientIndex);
      item.setAttribute('aria-label', `${ingredient.word}, ${i < ingredientIndex ? 'added' : i === ingredientIndex ? 'next' : 'waiting'}`);
      if (i === ingredientIndex) item.setAttribute('aria-current', 'step');
      const art = document.createElement('span');
      art.className = 'brew-sprite';
      art.setAttribute('aria-hidden', 'true');
      setSprite(art, ingredient.sprite);
      item.appendChild(art);
      shelf.appendChild(item);
    });
    get('progressCounter').textContent = `${ingredientIndex} / ${recipe.length}`;
    get('brewProgress').value = ingredientIndex;
    get('brewProgress').textContent = `${ingredientIndex} of ${recipe.length} ingredients`;
  }

  function renderIngredient() {
    const ingredient = recipe[ingredientIndex];
    get('ingredientName').textContent = ingredient.word[0].toUpperCase() + ingredient.word.slice(1);
    get('ingredientHint').textContent = ingredient.hint;
    get('ingredientNumber').textContent = `Ingredient ${ingredientIndex + 1} of ${recipe.length}`;
    setSprite(get('ingredientArt'), ingredient.sprite);
    renderLetters();
    renderShelf();
  }

  function sparkle(index) {
    if (window.GameUI?.prefersReducedMotion()) {
      flying.hidden = true;
      return;
    }
    setSprite(flying, index);
    flying.hidden = false;
    board.classList.remove('is-sparkling');
    // Restart only the decorative animation; gameplay never waits for it.
    flying.style.animation = 'none';
    void flying.offsetWidth;
    flying.style.removeProperty('animation');
    board.classList.add('is-sparkling');
  }

  function finish() {
    active = false;
    keyboard?.hide();
    board.classList.add('is-brewed');
    get('witchMessage').textContent = '“You’ve made the night a little brighter!”';
    get('brewPlay').hidden = true;
    get('brewFinished').hidden = false;
    sound('soundWin');
    const content = document.createElement('div');
    content.className = 'brew-win';
    const potion = document.createElement('span');
    potion.className = 'brew-sprite';
    potion.setAttribute('aria-hidden', 'true');
    setSprite(potion, 11);
    const title = document.createElement('h2');
    title.textContent = 'Moonlight, bottled!';
    const message = document.createElement('p');
    message.textContent = 'Six ingredients, beautifully spelled. Juniper’s potion is ready to sparkle!';
    content.append(potion, title, message);
    if (window.GameCelebration) {
      window.GameCelebration.show({ content: content.outerHTML, onPlayAgain: start, focusTarget: get('brewAgainBtn'), initialFocus: 'playAgain' });
    } else {
      get('brewAgainBtn').focus();
    }
  }

  function typeLetter(key, fromTouch = false) {
    if (!active || window.GameCelebration?.isOpen() || !/^[a-z]$/i.test(key)) return;
    if (!fromTouch) keyboard?.flashKey(key);
    const ingredient = recipe[ingredientIndex];
    if (key.toLowerCase() !== ingredient.word[letterIndex]) {
      tell('bad', `Try ${ingredient.word[letterIndex].toUpperCase()}. Your potion is safe — keep going!`);
      if (keyboard?.isTouchDevice()) keyboard.ensureVisible(row);
      return;
    }
    letterIndex += 1;
    sound('soundCorrect');
    if (letterIndex === ingredient.word.length) {
      sparkle(ingredient.sprite);
      ingredientIndex += 1;
      letterIndex = 0;
      renderShelf();
      if (ingredientIndex === recipe.length) {
        finish();
        return;
      }
      tell('ok', `${ingredient.word.toUpperCase()} is in! Next, spell ${recipe[ingredientIndex].word.toUpperCase()}.`);
      get('witchMessage').textContent = `“Lovely! ${ingredientIndex} ingredients in our cauldron.”`;
      sound('soundIngredient');
      renderIngredient();
    } else {
      tell('ok', `Lovely! Next letter: ${ingredient.word[letterIndex].toUpperCase()}.`);
      renderLetters();
    }
  }

  function start() {
    recipe = recipes[difficulty.value] || recipes.little;
    ingredientIndex = 0;
    letterIndex = 0;
    active = true;
    flying.hidden = true;
    board.classList.remove('is-brewed', 'is-sparkling');
    board.classList.add('is-playing');
    get('brewSetup').hidden = true;
    get('brewFinished').hidden = true;
    get('brewPlay').hidden = false;
    get('resetBtn').hidden = false;
    get('witchMessage').textContent = '“Let’s start with a little magic.”';
    tell('', `Spell ${recipe[0].word.toUpperCase()} to add our first ingredient.`);
    renderIngredient();
    // Keep Space/Enter focused on a meaningful control while letters play the game.
    if (keyboard?.isTouchDevice()) keyboard.show();
    else get('resetBtn').focus({ preventScroll: true });
  }

  function reset() {
    active = false;
    keyboard?.hide();
    flying.hidden = true;
    board.classList.remove('is-playing', 'is-brewed', 'is-sparkling');
    get('brewSetup').hidden = false;
    get('brewPlay').hidden = true;
    get('brewFinished').hidden = true;
    get('resetBtn').hidden = true;
    get('witchMessage').textContent = '“Come in, little spell-maker!”';
    row.replaceChildren();
    get('startBtn').focus({ preventScroll: true });
  }

  flying.addEventListener('animationend', () => { flying.hidden = true; });
  get('startBtn').addEventListener('click', start);
  get('resetBtn').addEventListener('click', reset);
  get('brewAgainBtn').addEventListener('click', start);
  document.addEventListener('keydown', event => {
    if (!window.GameUI?.shouldHandleGameKey(event)) return;
    if (!active || !/^[a-z]$/i.test(event.key)) return;
    event.preventDefault();
    typeLetter(event.key);
  });
})();
