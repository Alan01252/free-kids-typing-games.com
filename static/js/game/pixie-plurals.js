(function pixiePlurals() {
  const paths = {
    s: [
      { one: 'cat', stem: 'cat', ending: 's', sprite: 0, rule: 'Add S: cat becomes cats.' },
      { one: 'bug', stem: 'bug', ending: 's', sprite: 1, rule: 'Add S: bug becomes bugs.' },
      { one: 'frog', stem: 'frog', ending: 's', sprite: 2, rule: 'Add S: frog becomes frogs.' },
      { one: 'star', stem: 'star', ending: 's', sprite: 3, rule: 'Add S: star becomes stars.' },
      { one: 'seed', stem: 'seed', ending: 's', sprite: 4, rule: 'Add S: seed becomes seeds.' },
      { one: 'flower', stem: 'flower', ending: 's', sprite: 5, rule: 'Add S: flower becomes flowers.' }
    ],
    mix: [
      { one: 'box', stem: 'box', ending: 'es', sprite: 6, rule: 'After X, add ES: box becomes boxes.' },
      { one: 'bush', stem: 'bush', ending: 'es', sprite: 7, rule: 'After SH, add ES: bush becomes bushes.' },
      { one: 'fox', stem: 'fox', ending: 'es', sprite: 8, rule: 'After X, add ES: fox becomes foxes.' },
      { one: 'berry', stem: 'berr', ending: 'ies', sprite: 9, rule: 'For BERRY, change Y to IES: berries.' },
      { one: 'leaf', stem: 'lea', ending: 'ves', sprite: 10, rule: 'For LEAF, change F to VES: leaves.' },
      { one: 'mouse', stem: '', ending: 'mice', sprite: 11, rule: 'A changing word: one mouse, two mice.' }
    ]
  };
  const get = id => document.getElementById(id);
  const row = get('letterRow');
  const board = get('gameArea');
  const status = get('status');
  const path = get('pluralPath');
  let words = paths.s;
  let round = 0;
  let letter = 0;
  let active = false;
  const keyboard = window.GameTouchKeyboard?.attach({
    id: 'pixie-plurals',
    label: 'Tap letters to grow plurals',
    onKeyPress: key => typeLetter(key, true),
    getViewportTarget: () => row,
    getPaddingTarget: () => document.querySelector('.game-shell')
  });

  function makeSprite(index) {
    const art = document.createElement('span');
    art.className = 'pixie-sprite';
    art.setAttribute('aria-hidden', 'true');
    art.dataset.sprite = index;
    art.style.setProperty('--sprite-x', `${(index % 6) * 20}%`);
    art.style.setProperty('--sprite-y', index < 6 ? '0%' : '100%');
    return art;
  }

  function pictures(target, index, count) {
    target.replaceChildren(...Array.from({ length: count }, () => makeSprite(index)));
  }

  function play(id) {
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

  function resetGarden() {
    const garden = get('pluralGarden');
    garden.replaceChildren();
    words.forEach((word, index) => {
      const plot = document.createElement('li');
      plot.className = 'garden-plot';
      plot.setAttribute('aria-label', `Patch ${index + 1}, waiting to grow`);
      plot.appendChild(makeSprite(4));
      garden.appendChild(plot);
    });
    updateProgress();
  }

  function updateProgress() {
    get('progressCounter').textContent = `${round} / ${words.length}`;
    get('gardenProgress').value = round;
    get('gardenProgress').textContent = `${round} of ${words.length} patches grown`;
  }

  function growPlot() {
    const word = words[round];
    const plot = get('pluralGarden').children[round];
    pictures(plot, word.sprite, 2);
    plot.classList.add('is-grown');
    plot.setAttribute('aria-label', `Patch ${round + 1}: two ${word.stem + word.ending}`);
  }

  function renderLetters() {
    const word = words[round];
    const plural = word.stem + word.ending;
    row.replaceChildren();
    for (let i = 0; i < plural.length; i += 1) {
      const tile = document.createElement('span');
      tile.className = 'letter-box';
      tile.textContent = plural[i].toUpperCase();
      tile.setAttribute('role', 'listitem');
      if (i >= word.stem.length) tile.classList.add('plural-ending');
      if (i < letter) tile.classList.add('filled');
      if (i === letter) {
        tile.classList.add('current');
        tile.setAttribute('aria-current', 'step');
      }
      tile.setAttribute('aria-label', `Letter ${plural[i].toUpperCase()}${i < letter ? ', correct' : i === letter ? ', next' : ''}`);
      row.appendChild(tile);
    }
    row.setAttribute('aria-label', `Spell the plural ${plural.toUpperCase()}`);
    window.GameUI?.fitLettersFor(row);
    if (keyboard?.isTouchDevice()) keyboard.ensureVisible(row);
  }

  function renderWord() {
    const word = words[round];
    get('roundNumber').textContent = `Word ${round + 1} of ${words.length}`;
    get('singularWord').textContent = word.one;
    const ending = document.createElement('mark');
    ending.textContent = word.ending;
    get('pluralWord').replaceChildren(document.createTextNode(word.stem), ending);
    get('pluralRule').textContent = word.rule;
    pictures(get('singlePicture'), word.sprite, 1);
    pictures(get('pluralPicture'), word.sprite, 2);
    renderLetters();
  }

  function finish() {
    active = false;
    keyboard?.hide();
    get('pixiePlay').hidden = true;
    get('pixieFinished').hidden = false;
    board.classList.add('is-finished');
    play('soundWin');
    const content = document.createElement('div');
    content.className = 'pixie-win';
    const image = document.querySelector('.pixie-scene').cloneNode();
    image.className = 'pixie-win-art';
    image.alt = '';
    const title = document.createElement('h2');
    title.textContent = 'A garden full of more!';
    const message = document.createElement('p');
    message.textContent = 'You spelled six plurals and helped Pip’s garden blossom. One little word can grow into so much!';
    content.append(image, title, message);
    if (window.GameCelebration) {
      window.GameCelebration.show({ content: content.outerHTML, onPlayAgain: start, focusTarget: get('pixieAgainBtn'), initialFocus: 'playAgain' });
    } else get('pixieAgainBtn').focus();
  }

  function typeLetter(key, touch = false) {
    if (!active || window.GameCelebration?.isOpen() || !/^[a-z]$/i.test(key)) return;
    if (!touch) keyboard?.flashKey(key);
    const word = words[round];
    const plural = word.stem + word.ending;
    if (key.toLowerCase() !== plural[letter]) {
      tell('bad', `Try ${plural[letter].toUpperCase()}. Your garden can wait!`);
      if (keyboard?.isTouchDevice()) keyboard.ensureVisible(row);
      return;
    }
    letter += 1;
    play('soundCorrect');
    if (letter === plural.length) {
      growPlot();
      round += 1;
      letter = 0;
      updateProgress();
      if (round === words.length) {
        finish();
        return;
      }
      tell('ok', `${plural.toUpperCase()}! Another patch has grown.`);
      play('soundGrow');
      renderWord();
    } else {
      tell('ok', `Lovely! Next letter: ${plural[letter].toUpperCase()}.`);
      renderLetters();
    }
  }

  function start() {
    words = paths[path.value] || paths.s;
    round = 0;
    letter = 0;
    active = true;
    board.classList.add('is-playing');
    board.classList.remove('is-finished');
    get('pixieSetup').hidden = true;
    get('pixieFinished').hidden = true;
    get('pixiePlay').hidden = false;
    get('resetBtn').hidden = false;
    resetGarden();
    tell('', `Type ${words[0].stem + words[0].ending} to grow your first patch.`);
    renderWord();
    if (keyboard?.isTouchDevice()) keyboard.show();
    else get('resetBtn').focus({ preventScroll: true });
  }

  function reset() {
    active = false;
    keyboard?.hide();
    round = 0;
    letter = 0;
    words = paths[path.value] || paths.s;
    board.classList.remove('is-playing', 'is-finished');
    get('pixieSetup').hidden = false;
    get('pixiePlay').hidden = true;
    get('pixieFinished').hidden = true;
    get('resetBtn').hidden = true;
    row.replaceChildren();
    resetGarden();
    get('startBtn').focus({ preventScroll: true });
  }

  get('startBtn').addEventListener('click', start);
  get('resetBtn').addEventListener('click', reset);
  get('pixieAgainBtn').addEventListener('click', start);
  document.addEventListener('keydown', event => {
    if (!window.GameUI?.shouldHandleGameKey(event) || !active || !/^[a-z]$/i.test(event.key)) return;
    event.preventDefault();
    typeLetter(event.key);
  });
  resetGarden();
})();
