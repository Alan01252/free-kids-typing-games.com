import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Real-browser checks using Chrome's pipe transport; no testing dependency or port needed.
// Start `npm run dev`, then run `CHROME_BIN=chromium npm test`.
const base = process.env.SITE_URL || 'http://127.0.0.1:1313';
const profile = await mkdtemp(join(tmpdir(), 'typing-ui-test-'));
const chrome = spawn(process.env.CHROME_BIN || 'chromium', [
  '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-pipe',
  `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
let sequence = 0;
let buffer = '';
const pending = new Map();
const exceptions = [];
let chromeError = '';
chrome.stderr.on('data', data => { chromeError += data; });
chrome.on('error', error => {
  for (const { reject } of pending.values()) reject(error);
  pending.clear();
});
chrome.stdio[4].on('error', () => {});
chrome.stdio[3].on('error', () => {});
chrome.stdio[4].setEncoding('utf8');
chrome.stdio[4].on('data', data => {
  buffer += data.toString();
  let boundary;
  while ((boundary = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, boundary));
    buffer = buffer.slice(boundary + 1);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    const request = pending.get(message.id);
    if (!request) continue;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  }
});
function command(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out. Chrome: ${chromeError.slice(-1200)}`));
    }, 10000);
    pending.set(id, {
      resolve: value => { clearTimeout(timeout); resolve(value); },
      reject: error => { clearTimeout(timeout); reject(error); }
    });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
  });
}
const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
const send = (method, params) => command(method, params, sessionId);
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await test('shared game UI', async t => {
  t.after(async () => {
    chrome.kill();
    await new Promise(resolve => chrome.once('exit', resolve));
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
  });
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function until(expression) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Page condition timed out: ${expression}`);
  }
  async function navigate(path) {
    await send('Page.navigate', { url: base + path });
    await until(`location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete' && !!window.GameUI`);
  }
  async function screenshot(name) {
    if (!process.env.TEST_SCREENSHOT_DIR) return;
    await mkdir(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(process.env.TEST_SCREENSHOT_DIR, name + '.png'), Buffer.from(data, 'base64'));
  }
  async function viewport(width, height, touch = false) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
    await send('Emulation.setTouchEmulationEnabled', { enabled: touch });
  }

  await t.test('curated vocabulary drives the random games, longest theme words fit, and phoneme and pangram lessons stay accurate', async () => {
    const vocabulary = JSON.parse(await readFile(new URL('../data/game_words.json', import.meta.url), 'utf8'));
    const games = [
      { slug: 'speed-racer', bank: 'WORD_BANK', selected: 'raceWords', row: 'wordBoxes', rounds: 7 },
      { slug: 'rocket-run', bank: 'WORD_BANK', selected: 'words', row: 'letterRow', rounds: 7 },
      { slug: 'santa-spells', bank: 'WORD_BANK', selected: 'words', row: 'letterRow', rounds: 6 },
      { slug: 'only-verbs', bank: 'VERB_LIST', selected: 'verbs', row: 'letterRow', rounds: 7, sampler: 'shuffleVerbs' }
    ];
    exceptions.length = 0;
    await viewport(320, 740, true);
    for (const { slug, bank, selected, row, rounds, sampler = 'shuffleWords' } of games) {
      const pool = vocabulary[slug].words;
      await navigate(`/games/${slug}/`);
      assert.deepEqual(await evaluate(bank), pool, `${slug} uses the wrong vocabulary pool`);
      assert.equal(new Set(pool).size, pool.length, `${slug} repeats pool entries`);
      assert.ok(pool.every(word => /^[a-z]+$/.test(word) && word.length <= 9), `${slug} contains an untypeable target`);
      await evaluate(`document.getElementById('startBtn').click()`);
      const picked = await evaluate(selected);
      assert.equal(picked.length, rounds);
      assert.equal(new Set(picked).size, rounds);
      picked.forEach(word => assert.ok(pool.includes(word), `${slug} selected an unrelated word`));
      await evaluate(`document.getElementById('resetBtn').click()`);
      const longest = [...pool].sort((a, b) => b.length - a.length)[0];
      const lesson = [longest, ...pool.filter(word => word !== longest)].slice(0, rounds);
      await evaluate(`${sampler} = () => ${JSON.stringify(lesson)}; document.getElementById('startBtn').click()`);
      await new Promise(resolve => setTimeout(resolve, 650));
      assert.equal(await evaluate(`document.getElementById('${row}').textContent.toLowerCase()`), longest);
      const bounds = await evaluate(`(() => {
        const row = document.getElementById('${row}');
        const bounds = row.getBoundingClientRect();
        return [...row.children].map(el => { const r = el.getBoundingClientRect(); return {
          line: el.offsetTop, left: r.left, right: r.right, rowLeft: bounds.left, rowRight: bounds.right,
          width: r.width, font: parseFloat(getComputedStyle(el).fontSize) }; });
      })()`);
      assert.equal(new Set(bounds.map(tile => tile.line)).size, 1, `${slug}: ${longest} wraps`);
      bounds.forEach(tile => assert.ok(tile.left >= tile.rowLeft - 1 && tile.right <= tile.rowRight + 1 && tile.width >= 24 && tile.font >= 16, `${slug}: ${longest} is clipped or unreadable`));
      await screenshot(`vocabulary-${slug}-${longest}`);
      await evaluate(`(() => { for (const word of ${JSON.stringify(lesson)}) for (const key of word) document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); })()`);
      await until(`GameCelebration.isOpen()`);
    }
    await navigate('/games/word-builder/');
    assert.deepEqual(await evaluate(`WORDS`), vocabulary['word-builder'].words);
    assert.deepEqual(await evaluate(`[...document.getElementById('wordList').options].map(option => option.value)`), vocabulary['word-builder'].words);
    await evaluate(`document.getElementById('randomBtn').click()`);
    assert.ok(vocabulary['word-builder'].words.includes(await evaluate(`document.getElementById('wordInput').value`)));
    await navigate('/games/ghostly-word-hunt/');
    const rooms = vocabulary['ghostly-word-hunt'].rooms;
    assert.deepEqual(await evaluate(`ROOMS`), rooms);
    await evaluate(`document.getElementById('startBtn').click()`);
    for (const room of rooms) {
      for (const word of room.words) {
        assert.equal(await evaluate(`document.getElementById('roomLabel').textContent`), room.name);
        assert.equal(await evaluate(`[...document.querySelectorAll('#candleRow .candle-letter')].map(el => el.textContent).join('').toLowerCase()`), word);
        await evaluate(`(() => { for (const key of ${JSON.stringify(word)}) document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); })()`);
      }
    }
    await until(`GameCelebration.isOpen()`);
    await navigate('/games/phoneme-sound-lab/');
    const thumb = await evaluate(`WORD_BANK.find(word => word.label === 'Thumb')`);
    assert.equal(thumb.segments.map(segment => segment.letters).join(''), 'thumb');
    assert.equal(thumb.emoji, '👍');
    assert.equal(await evaluate(`WORD_BANK.find(word => word.label === 'Thumb').segments.flatMap(segment => segment.phonemeKeys).map(key => PHONEME_LIBRARY[key].ipa).join('')`), 'θʌm');
    for (const key of thumb.segments.flatMap(segment => segment.phonemeKeys)) {
      assert.ok((await readFile(new URL(`../static/audio/phonemes/${key}.wav`, import.meta.url))).length > 44, `missing phoneme clip ${key}`);
    }
    await evaluate(`shuffle = list => list.filter(word => word.word === 'thumb'); document.getElementById('startBtn').click()`);
    assert.equal(await evaluate(`[...document.querySelectorAll('.segment-letter')].map(el => el.textContent).join('').toLowerCase()`), 'thumb');
    await evaluate(`(() => { for (const key of 'thumb') document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); })()`);
    await until(`GameCelebration.isOpen()`);
    await navigate('/games/quick-fox/');
    const sentence = await evaluate(`SENTENCE`);
    assert.equal(new Set(sentence.toLowerCase().replace(/[^a-z]/g, '')).size, 26, 'the fox sentence misses alphabet letters');
    await evaluate(`document.getElementById('startBtn').click(); for (const key of SENTENCE) document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))`);
    await until(`GameCelebration.isOpen()`);
    assert.deepEqual(exceptions, []);
  });

  await t.test('every Phoneme Lab word plays the matching local sound after each completed spelling chunk', async () => {
    const lessons = [
      { word: 'Ship', ipa: 'ʃɪp', chunks: [['sh', 'shopping'], ['i', 'kit'], ['p', 'popular']] },
      { word: 'Goat', ipa: 'ɡəʊt', chunks: [['g', 'gravely'], ['oa', 'boat'], ['t', 'tinker']] },
      { word: 'Chair', ipa: 'ʧeə', chunks: [['ch', 'changed'], ['air', 'square']] },
      { word: 'Spoon', ipa: 'spuːn', chunks: [['s', 'massage'], ['p', 'popular'], ['oo', 'school'], ['n', 'nine']] },
      { word: 'Thumb', ipa: 'θʌm', chunks: [['th', 'thigh'], ['u', 'pulse'], ['mb', 'mapping']] },
      { word: 'Juice', ipa: 'ʤuːs', chunks: [['j', 'magenta'], ['ui', 'school'], ['ce', 'massage']] }
    ];
    exceptions.length = 0;
    for (const { word, ipa, chunks } of lessons) {
      await navigate('/games/phoneme-sound-lab/');
      const lesson = await evaluate(`WORD_BANK.find(entry => entry.label === ${JSON.stringify(word)})`);
      assert.equal(lesson.segments.map(segment => segment.letters).join(''), word.toLowerCase());
      assert.deepEqual(lesson.segments.map(segment => [segment.letters, ...segment.phonemeKeys]), chunks);
      assert.equal(await evaluate(`WORD_BANK.find(entry => entry.label === ${JSON.stringify(word)}).segments.flatMap(segment => segment.phonemeKeys).map(key => PHONEME_LIBRARY[key].ipa).join('')`), ipa);
      // Observe actual media playback without replacing Audio.play or GameSound's behaviour.
      await evaluate(`(() => {
        window.phonemePlayback = [];
        GameSound.setEnabled(true);
        const play = GameSound.play;
        GameSound.play = audio => {
          if (audio.src.includes(AUDIO_BASE)) {
            const entry = { file: new URL(audio.src).pathname.split('/').pop(), ended: false, error: null };
            phonemePlayback.push(entry);
            audio.addEventListener('ended', () => { entry.ended = true; entry.duration = audio.duration; }, { once: true });
            audio.addEventListener('error', () => { entry.error = audio.error?.code; }, { once: true });
          }
          return play(audio);
        };
        shuffle = list => list.filter(entry => entry.label === ${JSON.stringify(word)});
      })()`);
      await send('Runtime.evaluate', { expression: `document.getElementById('startBtn').click()`, userGesture: true });
      for (const [index, [letters, sound]] of chunks.entries()) {
        for (const [letterIndex, key] of [...letters].entries()) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key, text: key });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key });
          assert.equal(await evaluate(`phonemePlayback.length`), index + (letterIndex === letters.length - 1 ? 1 : 0), `${word}: sound played before its chunk was complete`);
        }
        assert.equal(await evaluate(`phonemePlayback[${index}].file`), `${sound}.wav`);
        await until(`phonemePlayback[${index}].ended || phonemePlayback[${index}].error !== null`);
        const playback = await evaluate(`phonemePlayback[${index}]`);
        assert.equal(playback.error, null, `${word}: ${sound}.wav failed to decode`);
        assert.ok(playback.ended && playback.duration > 0, `${word}: ${sound}.wav did not play to completion`);
      }
      assert.equal(await evaluate(`GameCelebration.isOpen()`), true, `${word}: typing the chunks did not complete the word`);
    }
    assert.deepEqual(exceptions, []);
  });

  await t.test('Pixie Plurals teaches both paths with matching one/two pictures, accurate endings, touch play, recovery and replay', async () => {
    const lessons = {
      s: [['cat', 'cats', 's', 0], ['bug', 'bugs', 's', 1], ['frog', 'frogs', 's', 2], ['star', 'stars', 's', 3], ['seed', 'seeds', 's', 4], ['flower', 'flowers', 's', 5]],
      mix: [['box', 'boxes', 'es', 6], ['bush', 'bushes', 'es', 7], ['fox', 'foxes', 'es', 8], ['berry', 'berries', 'ies', 9], ['leaf', 'leaves', 'ves', 10], ['mouse', 'mice', 'mice', 11]]
    };
    exceptions.length = 0;
    await send('Network.setBlockedURLs', { urls: ['https://*'] });
    async function pressLetter(key, touch) {
      if (touch) {
        const point = await evaluate(`(() => { const r = document.querySelector('#gameTouchKeyboard [data-skbtn="${key.toUpperCase()}"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: key.toUpperCase(), code: `Key${key.toUpperCase()}` });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: key.toUpperCase(), code: `Key${key.toUpperCase()}` });
      }
    }
    try {
      for (const touch of [false, true]) {
        for (const [path, words] of Object.entries(lessons)) {
          const width = touch ? (path === 'mix' ? 320 : 390) : 1280;
          await viewport(width, touch ? 844 : 1000, touch);
          await navigate('/games/pixie-plurals/');
          assert.equal(await evaluate(`document.querySelector('.pixie-scene').complete && document.querySelector('.pixie-scene').naturalWidth > 0`), true);
          await screenshot(`pixie-setup-${width}-${path}`);
          await evaluate(`document.getElementById('pluralPath').value = '${path}'; document.getElementById('startBtn').click()`);
          if (touch) {
            await until(`document.querySelector('#gameTouchControls.is-active')`);
            await until(`document.getElementById('gameTouchControls').getBoundingClientRect().bottom <= innerHeight + 1`);
          }
          await evaluate(`(() => { for (const options of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { repeat: true }, { isComposing: true }]) document.dispatchEvent(new KeyboardEvent('keydown', { key: '${words[0][1][0]}', bubbles: true, ...options })); document.getElementById('pluralPath').dispatchEvent(new KeyboardEvent('keydown', { key: '${words[0][1][0]}', bubbles: true })); })()`);
          assert.equal(await evaluate(`document.querySelectorAll('#letterRow .filled').length`), 0);
          await pressLetter('z', touch);
          assert.equal(await evaluate(`document.querySelectorAll('#pluralGarden .is-grown').length`), 0);
          assert.match(await evaluate(`document.getElementById('statusText').textContent`), /garden can wait/);
          if (touch) {
            await new Promise(resolve => setTimeout(resolve, 350));
            assert.equal(await evaluate(`(() => { const r = document.getElementById('status').getBoundingClientRect(); return r.height >= 40 && r.top >= 0 && r.bottom < document.getElementById('gameTouchControls').getBoundingClientRect().top; })()`), true, 'mobile plural hint is covered');
          }
          for (const [round, [one, plural, ending, sprite]] of words.entries()) {
            const details = await evaluate(`(() => {
              const row = document.getElementById('letterRow'), bounds = row.getBoundingClientRect();
              return { one: document.getElementById('singularWord').textContent,
                plural: document.getElementById('pluralWord').textContent,
                ending: document.querySelector('#pluralWord mark').textContent,
                oneSprites: [...document.querySelectorAll('#singlePicture .pixie-sprite')].map(el => Number(el.dataset.sprite)),
                twoSprites: [...document.querySelectorAll('#pluralPicture .pixie-sprite')].map(el => Number(el.dataset.sprite)),
                target: row.textContent.toLowerCase(), endingTiles: row.querySelectorAll('.plural-ending').length,
                tiles: [...row.children].map(el => { const r = el.getBoundingClientRect(); return { line: el.offsetTop, left: r.left, right: r.right, rowLeft: bounds.left, rowRight: bounds.right }; }) };
            })()`);
            assert.equal(details.one, one);
            assert.equal(details.plural, plural);
            assert.equal(details.target, plural);
            assert.equal(details.ending, ending);
            assert.equal(details.endingTiles, ending.length);
            assert.deepEqual(details.oneSprites, [sprite]);
            assert.deepEqual(details.twoSprites, [sprite, sprite]);
            assert.equal(new Set(details.tiles.map(tile => tile.line)).size, 1, `${plural} wraps`);
            details.tiles.forEach(tile => assert.ok(tile.left >= tile.rowLeft - 1 && tile.right <= tile.rowRight + 1, `${plural} is clipped`));
            if (round === 3 || round === 5) await screenshot(`pixie-word-${plural}-${width}`);
            for (const [index, letter] of [...plural].entries()) {
              if (one === 'berry' && index === 4) {
                await pressLetter('y', touch);
                assert.equal(await evaluate(`document.querySelectorAll('#letterRow .filled').length`), 4, 'BERRYS advanced the lesson');
                assert.equal(await evaluate(`document.getElementById('progressCounter').textContent`), `${round} / 6`);
              }
              if (one === 'mouse' && index === 1) {
                await pressLetter('o', touch);
                assert.equal(await evaluate(`document.querySelectorAll('#letterRow .filled').length`), 1, 'MOUSES advanced the lesson');
              }
              const before = await evaluate(`document.getElementById('progressCounter').textContent + ':' + document.querySelectorAll('#letterRow .filled').length`);
              await pressLetter(letter, touch);
              await until(`GameCelebration.isOpen() || document.getElementById('progressCounter').textContent + ':' + document.querySelectorAll('#letterRow .filled').length !== ${JSON.stringify(before)}`);
              if (index < plural.length - 1) assert.equal(await evaluate(`document.getElementById('progressCounter').textContent`), `${round} / 6`);
            }
            assert.equal(await evaluate(`document.querySelectorAll('#pluralGarden .is-grown').length`), round + 1);
            assert.equal(await evaluate(`document.getElementById('gardenProgress').value`), round + 1);
            assert.deepEqual(await evaluate(`[...document.getElementById('pluralGarden').children[${round}].querySelectorAll('.pixie-sprite')].map(el => Number(el.dataset.sprite))`), [sprite, sprite]);
          }
          await until(`GameCelebration.isOpen()`);
          assert.equal(await evaluate(`document.getElementById('progressCounter').textContent`), '6 / 6');
          await new Promise(resolve => setTimeout(resolve, 700));
          await screenshot(`pixie-win-${width}-${path}`);
          await evaluate(`document.querySelector('[data-overlay-again]').click()`);
          await until(`!GameCelebration.isOpen() && document.getElementById('progressCounter').textContent === '0 / 6'`);
          assert.equal(await evaluate(`document.getElementById('letterRow').textContent.toLowerCase()`), words[0][1]);
          assert.equal(await evaluate(`document.querySelectorAll('#pluralGarden .is-grown').length`), 0);
          await evaluate(`document.getElementById('resetBtn').click()`);
          assert.equal(await evaluate(`document.getElementById('pixieSetup').hidden`), false);
          assert.equal(await evaluate(`document.getElementById('pluralPath').value`), path);
          await pressLetter(words[0][1][0], false);
          assert.equal(await evaluate(`document.getElementById('letterRow').children.length`), 0);
        }
      }
      await viewport(740, 360, true);
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await navigate('/games/pixie-plurals/');
      await evaluate(`document.getElementById('startBtn').click(); for (const key of 'cats') document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }))`);
      await until(`document.querySelector('#gameTouchControls.is-active')`);
      await new Promise(resolve => setTimeout(resolve, 650));
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.garden-plot.is-grown .pixie-sprite')).animationName`), 'none');
      assert.equal(await evaluate(`(() => { const status = document.getElementById('status').getBoundingClientRect(), current = document.querySelector('#letterRow .current').getBoundingClientRect(), keyboard = document.getElementById('gameTouchControls').getBoundingClientRect(); return status.height >= 40 && status.top >= 0 && status.bottom < keyboard.top && current.top >= 0 && current.bottom < keyboard.top; })()`), true, 'landscape feedback or current letter is covered');
      await screenshot('pixie-landscape-feedback');
      assert.deepEqual(exceptions, []);
    } finally {
      await send('Network.setBlockedURLs', { urls: [] });
      await send('Emulation.setEmulatedMedia', { features: [] });
    }
  });

  await t.test('Speed Racer artwork stays inside the track from start to finish, resizes and replays with a stopped final timer', async () => {
    exceptions.length = 0;
    const measureCar = () => evaluate(`(() => {
      const track = document.querySelector('.race-track').getBoundingClientRect();
      const car = document.getElementById('car').getBoundingClientRect();
      const image = document.querySelector('#car img');
      return { left: car.left, right: car.right, top: car.top, bottom: car.bottom, width: car.width,
        trackLeft: track.left, trackRight: track.right, trackTop: track.top, trackBottom: track.bottom,
        progress: Number(document.getElementById('car').style.getPropertyValue('--race-progress')),
        imageLoaded: image.complete && image.naturalWidth > 0 };
    })()`);
    const contained = (metrics, label) => {
      assert.equal(metrics.imageLoaded, true);
      assert.ok(metrics.width >= 110, `${label}: sprite too small`);
      assert.ok(metrics.left >= metrics.trackLeft && metrics.right <= metrics.trackRight, `${label}: car clipped horizontally`);
      assert.ok(metrics.top >= metrics.trackTop && metrics.bottom <= metrics.trackBottom, `${label}: car clipped vertically`);
    };
    for (const [width, height] of [[1280, 1000], [320, 740], [390, 844], [740, 360]]) {
      await viewport(width, height, width < 1280);
      await navigate('/games/speed-racer/');
      await evaluate(`document.getElementById('startBtn').click()`);
      await new Promise(resolve => setTimeout(resolve, 650));
      const start = await measureCar();
      contained(start, `${width}px start`);
      assert.equal(start.progress, 0);
      assert.equal(await evaluate(`[...document.querySelectorAll('.race-stat__value')].every(el => el.scrollWidth <= el.clientWidth + 1)`), true, `${width}px dashboard clips text`);
      assert.equal(await evaluate(`document.getElementById('timer').getAttribute('aria-live')`), 'off');
      assert.equal(await evaluate(`document.getElementById('gameArea').hasAttribute('aria-live')`), false);
      await evaluate(`(() => { const expected = document.querySelector('#wordBoxes .current').textContent; document.dispatchEvent(new KeyboardEvent('keydown', { key: expected === 'Z' ? 'x' : 'z', bubbles: true })); })()`);
      assert.equal((await measureCar()).progress, 0, 'a mistake moved the car');
      await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: document.querySelector('#wordBoxes .current').textContent, bubbles: true }))`);
      await new Promise(resolve => setTimeout(resolve, 400));
      const moved = await measureCar();
      contained(moved, `${width}px after typing`);
      assert.ok(moved.left > start.left && moved.progress > 0, 'correct letter did not advance the car');
      if (width === 1280) {
        await evaluate(`window.scrollTo({ top: document.getElementById('gameArea').offsetTop - 30, behavior: 'instant' })`);
        await screenshot('racer-desktop-start');
      } else {
        await screenshot(`racer-active-${width}x${height}`);
        await evaluate(`GameTouchKeyboard.hide(); window.scrollTo({ top: document.getElementById('gameArea').offsetTop, behavior: 'instant' })`);
        await new Promise(resolve => setTimeout(resolve, 400));
        await screenshot(`racer-track-${width}x${height}`);
      }
      await evaluate(`(() => { for (let i = 0; i < 100; i += 1) {
        if (GameCelebration.isOpen()) break;
        const current = document.querySelector('#wordBoxes .current');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: current.textContent, bubbles: true }));
      } })()`);
      await until(`GameCelebration.isOpen()`);
      await new Promise(resolve => setTimeout(resolve, 650));
      const finish = await measureCar();
      contained(finish, `${width}px finish`);
      assert.equal(finish.progress, 1);
      assert.equal(await evaluate(`document.querySelectorAll('.track-progress .is-passed').length`), 7);
      const finalTime = await evaluate(`document.getElementById('timer').textContent`);
      assert.equal(await evaluate(`document.querySelector('#gameWinOverlayBody strong').textContent`), finalTime);
      await new Promise(resolve => setTimeout(resolve, 150));
      assert.equal(await evaluate(`document.getElementById('timer').textContent`), finalTime, 'final timer kept running');
      await screenshot(`racer-win-${width}x${height}`);
      await evaluate(`document.querySelector('[data-overlay-dismiss]').click()`);
      await viewport(width === 320 ? 740 : 320, width === 320 ? 360 : 740, true);
      await new Promise(resolve => setTimeout(resolve, 400));
      contained(await measureCar(), 'finished car after rotation');
      await evaluate(`document.getElementById('resetBtn').click(); document.getElementById('startBtn').click()`);
      await new Promise(resolve => setTimeout(resolve, 400));
      contained(await measureCar(), 'replayed car');
      assert.equal((await measureCar()).progress, 0);
      assert.equal(await evaluate(`document.querySelectorAll('.track-progress .is-passed').length`), 0);
    }
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    try {
      assert.equal(await evaluate(`getComputedStyle(document.getElementById('car')).transitionProperty`), 'none');
    } finally {
      await send('Emulation.setEmulatedMedia', { features: [] });
    }
    assert.deepEqual(exceptions, []);
  });

  await t.test('Witch’s Word Brew completes both recipes with physical keys and real touch taps, preserves mistakes, resets and replays', async () => {
    const recipes = { little: ['cat', 'bat', 'web', 'moon', 'wand', 'star'], big: ['ghost', 'broom', 'spell', 'spider', 'pumpkin', 'magic'] };
    exceptions.length = 0;
    await send('Network.setBlockedURLs', { urls: ['https://*', 'http://actions.google.com/*'] });
    try {
      for (const touch of [false, true]) {
        for (const [level, words] of Object.entries(recipes)) {
          const width = touch ? (level === 'big' ? 320 : 390) : 1280;
          await viewport(width, touch ? 844 : 900, touch);
          await navigate('/games/witch-word-brew/');
          assert.equal(await evaluate(`document.querySelector('.brew-scene').complete && document.querySelector('.brew-scene').naturalWidth > 0`), true);
          assert.equal(await evaluate(`document.getElementById('brewSetup').hidden`), false);
          await screenshot(`witch-setup-${width}-${level}`);
          await evaluate(`document.getElementById('brewDifficulty').value = '${level}'; document.getElementById('startBtn').click()`);
          assert.equal(await evaluate(`getComputedStyle(document.querySelector('#letterRow .letter-box:not(.current)')).color`), 'rgb(85, 71, 103)');
          if (touch) {
            await until(`document.querySelector('#gameTouchControls.is-active')`);
            await until(`document.getElementById('gameTouchControls').getBoundingClientRect().bottom <= innerHeight + 1`);
          }
          await evaluate(`(() => {
            for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true }, { isComposing: true }]) {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: '${words[0][0]}', bubbles: true, ...options }));
            }
            document.getElementById('brewDifficulty').dispatchEvent(new KeyboardEvent('keydown', { key: '${words[0][0]}', bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
          })()`);
          assert.equal(await evaluate(`document.querySelectorAll('#letterRow .filled').length`), 0);
          assert.equal(await evaluate(`document.getElementById('progressCounter').textContent`), '0 / 6');
          assert.match(await evaluate(`document.getElementById('statusText').textContent`), /potion is safe/);
          if (touch) {
            await new Promise(resolve => setTimeout(resolve, 350));
            assert.equal(await evaluate(`(() => { const r = document.getElementById('status').getBoundingClientRect(); return r.width > 0 && r.height >= 40 && r.top >= 0 && r.bottom < document.getElementById('gameTouchControls').getBoundingClientRect().top; })()`), true, 'next-letter feedback is covered by the keyboard');
          }
          for (const [index, word] of words.entries()) {
            assert.equal(await evaluate(`document.getElementById('letterRow').textContent.toLowerCase()`), word);
            const geometry = await evaluate(`(() => {
              const row = document.getElementById('letterRow'), bounds = row.getBoundingClientRect();
              return [...row.children].map(el => { const r = el.getBoundingClientRect(); return { line: el.offsetTop, left: r.left, right: r.right, rowLeft: bounds.left, rowRight: bounds.right }; });
            })()`);
            assert.equal(new Set(geometry.map(tile => tile.line)).size, 1, `${word} wraps`);
            geometry.forEach(tile => assert.ok(tile.left >= tile.rowLeft - 1 && tile.right <= tile.rowRight + 1, `${word} clipped`));
            if (index === 4) await screenshot(`witch-long-word-${width}-${level}`);
            for (const [letterIndex, letter] of [...word].entries()) {
              const before = await evaluate(`document.getElementById('progressCounter').textContent + ':' + document.querySelectorAll('#letterRow .filled').length`);
              if (touch) {
                const point = await evaluate(`(() => { const r = document.querySelector('#gameTouchKeyboard [data-skbtn="${letter.toUpperCase()}"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
                await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
                await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
              } else {
                await send('Input.dispatchKeyEvent', { type: 'keyDown', key: letter.toUpperCase(), code: `Key${letter.toUpperCase()}` });
                await send('Input.dispatchKeyEvent', { type: 'keyUp', key: letter.toUpperCase(), code: `Key${letter.toUpperCase()}` });
              }
              await until(`GameCelebration.isOpen() || document.getElementById('progressCounter').textContent + ':' + document.querySelectorAll('#letterRow .filled').length !== ${JSON.stringify(before)}`);
              if (letterIndex < word.length - 1) assert.equal(await evaluate(`document.getElementById('progressCounter').textContent`), `${index} / 6`);
            }
            assert.equal(await evaluate(`document.querySelectorAll('#recipeShelf .is-added').length`), index + 1);
            assert.equal(await evaluate(`document.getElementById('brewProgress').value`), index + 1);
          }
          await until(`GameCelebration.isOpen()`);
          assert.equal(await evaluate(`document.getElementById('progressCounter').textContent`), '6 / 6');
          assert.match(await evaluate(`document.getElementById('gameWinOverlayBody').textContent`), /Moonlight, bottled/);
          await new Promise(resolve => setTimeout(resolve, 700));
          await screenshot(`witch-win-${width}-${level}`);
          await evaluate(`document.querySelector('[data-overlay-again]').click()`);
          await until(`!GameCelebration.isOpen() && document.getElementById('progressCounter').textContent === '0 / 6'`);
          assert.equal(await evaluate(`document.getElementById('letterRow').textContent.toLowerCase()`), words[0]);
          await evaluate(`document.getElementById('resetBtn').click()`);
          assert.equal(await evaluate(`document.getElementById('brewSetup').hidden`), false);
          assert.equal(await evaluate(`document.getElementById('brewDifficulty').value`), level);
          await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '${words[0][0]}', bubbles: true }))`);
          assert.equal(await evaluate(`document.getElementById('letterRow').children.length`), 0);
        }
      }
      await viewport(390, 844, true);
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await navigate('/games/witch-word-brew/');
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.brew-bubbles i')).animationName`), 'none');
      await evaluate(`document.getElementById('startBtn').click(); for (const letter of 'cat') document.dispatchEvent(new KeyboardEvent('keydown', { key: letter, bubbles: true }))`);
      assert.equal(await evaluate(`document.getElementById('flyingIngredient').hidden`), true);
      assert.equal(await evaluate(`document.getElementById('progressCounter').textContent`), '1 / 6');
      await viewport(740, 360, true);
      await navigate('/games/witch-word-brew/');
      await evaluate(`document.getElementById('startBtn').click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }))`);
      await until(`document.querySelector('#gameTouchControls.is-active')`);
      await new Promise(resolve => setTimeout(resolve, 650));
      const landscape = await evaluate(`(() => {
        const status = document.getElementById('status').getBoundingClientRect();
        const letter = document.querySelector('#letterRow .current').getBoundingClientRect();
        const keyboard = document.getElementById('gameTouchControls').getBoundingClientRect();
        return { statusTop: status.top, statusBottom: status.bottom, statusHeight: status.height,
          letterTop: letter.top, letterBottom: letter.bottom, keyboardTop: keyboard.top };
      })()`);
      assert.ok(landscape.statusHeight >= 40 && landscape.statusTop >= 0 && landscape.statusBottom < landscape.keyboardTop, 'landscape hint is covered');
      assert.ok(landscape.letterTop >= 0 && landscape.letterBottom < landscape.keyboardTop, 'landscape current letter is covered');
      await screenshot('witch-landscape-feedback');
      assert.deepEqual(exceptions, []);
    } finally {
      await send('Network.setBlockedURLs', { urls: [] });
      await send('Emulation.setEmulatedMedia', { features: [] });
    }
  });

  await t.test('original branding loads without cropping on desktop and phones, and the alphabet link works', async () => {
    for (const [width, height] of [[1280, 900], [320, 740], [390, 844], [740, 360]]) {
      await viewport(width, height, width < 1280);
      await navigate('/');
      const branding = await evaluate(`(() => {
        const banner = document.querySelector('.library-hero__banner');
        const icon = document.querySelector('.site-brand__icon');
        const bounds = banner.getBoundingClientRect();
        return { bannerLoaded: banner.complete && banner.naturalWidth > 0,
          iconLoaded: icon.complete && icon.naturalWidth > 0, source: new URL(banner.src).pathname,
          left: bounds.left, right: bounds.right, ratio: bounds.width / bounds.height,
          naturalRatio: banner.naturalWidth / banner.naturalHeight,
          h1: document.querySelector('h1').textContent, headingCount: document.querySelectorAll('h1').length,
          overflow: document.documentElement.scrollWidth > innerWidth };
      })()`);
      assert.equal(branding.bannerLoaded, true);
      assert.equal(branding.iconLoaded, true);
      assert.equal(branding.source, '/images/og.png');
      assert.ok(Math.abs(branding.ratio - branding.naturalRatio) < 0.01, `banner cropped or stretched at ${width}px`);
      assert.ok(branding.left >= 0 && branding.right <= width);
      assert.equal(branding.overflow, false);
      assert.equal(branding.headingCount, 1);
      assert.equal(branding.h1, 'Free Kids Typing Games');
      await screenshot(`branding-home-${width}x${height}`);
    }
    await evaluate(`document.querySelector('.library-cta').click()`);
    await until(`location.pathname === '/games/az/' && document.readyState === 'complete' && !!window.GameUI`);
    await evaluate(`document.querySelector('.site-brand').click()`);
    await until(`location.pathname === '/' && document.readyState === 'complete' && !!window.GameUI`);
  });

  await t.test('library filters show the right games and announce counts on both menus', async () => {
    for (const path of ['/', '/games/']) {
      await navigate(path);
      await until(`!document.querySelector('[data-game-filters]').hidden`);
      const counts = [];
      for (const skill of ['letters', 'words', 'challenge', 'all']) {
        counts.push(await evaluate(`(() => {
          document.querySelector('[data-game-filter="${skill}"]').click();
          const visible = [...document.querySelectorAll('[data-game-skill]')].filter(el => !el.hidden);
          return { count: visible.length, skills: [...new Set(visible.map(el => el.dataset.gameSkill))],
            announced: document.querySelector('[data-game-count]').textContent,
            selected: document.querySelectorAll('[data-game-filter][aria-pressed="true"]').length };
        })()`));
      }
      assert.deepEqual(counts.map(item => item.count), [3, 16, 5, 24]);
      counts.forEach(item => { assert.equal(item.selected, 1); assert.equal(item.announced, `${item.count} games to explore`); });
      assert.deepEqual(counts.slice(0, 3).map(item => item.skills), [['letters'], ['words'], ['challenge']]);
    }
  });

  await t.test('all games remain reachable when the library script fails to load', async () => {
    await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['*js/game/ui/library.js*'] });
    try {
      await navigate('/');
      assert.equal(await evaluate(`document.querySelector('[data-game-filters]').hidden`), true);
      assert.equal(await evaluate(`document.querySelectorAll('[data-game-skill]:not([hidden])').length`), 24);
    } finally {
      await send('Network.setBlockedURLs', { urls: [] });
    }
  });

  await t.test('every registered page loads at desktop and narrow mobile widths without script errors or horizontal overflow', async () => {
    const data = await readFile(new URL('../data/games.yaml', import.meta.url), 'utf8');
    const slugs = [...data.matchAll(/^- slug: (.+)$/gm)].map(match => match[1]);
    exceptions.length = 0;
    for (const width of [1280, 320]) {
      await viewport(width, 800, width === 320);
      for (const path of ['/', '/games/', '/about/', ...slugs.map(slug => `/games/${slug}/`)]) {
        await navigate(path);
        if (path === '/') await screenshot(`home-${width}`);
        assert.equal(await evaluate(`document.querySelectorAll('main').length`), 1, path);
        assert.equal(await evaluate(`!!document.querySelector('h1')`), true, path);
        assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), true, `${path} at ${width}px`);
        assert.equal(await evaluate(`!!document.querySelector('a[href="#mainContent"]') && !!document.getElementById('mainContent')`), true, path);
      }
    }
    assert.deepEqual(exceptions, []);
  });

  await t.test('shared keyboard has equal letter keys, uniform gaps and centered rows in every layout', async () => {
    const measure = () => evaluate(`(() => {
      const root = document.querySelector('#gameTouchKeyboard .simple-keyboard');
      const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
      return {
        root: rect(root), gap: parseFloat(getComputedStyle(root).gap),
        rows: [...root.children].map(row => ({ ...rect(row), kind: row.dataset.keyboardRow, keys: [...row.children].map(key => ({ ...rect(key), value: key.dataset.skbtn })) }))
      };
    })()`);
    const verify = (layout, context) => {
      const letters = layout.rows.filter(row => row.kind === 'letters').flatMap(row => row.keys);
      const keys = layout.rows.flatMap(row => row.keys);
      const near = (value, expected, label) => assert.ok(Math.abs(value - expected) < 0.1, `${context}: ${label}: ${value} vs ${expected}`);
      letters.forEach(key => near(key.width, letters[0].width, 'letter key width'));
      keys.forEach(key => near(key.height, letters[0].height, 'key height'));
      layout.rows.forEach((row, index) => {
        near((row.left + row.right) / 2, (layout.root.left + layout.root.right) / 2, 'row centering');
        if (index) near(row.top - layout.rows[index - 1].bottom, layout.gap, 'vertical gap');
        row.keys.slice(1).forEach((key, i) => near(key.left - row.keys[i].right, layout.gap, 'horizontal gap'));
        if (row.kind === 'space') {
          assert.equal(row.keys.length, 1, context);
          near(row.width, layout.root.width, 'Space row width');
          near(row.keys[0].width, layout.root.width, 'Space key width');
        }
      });
    };
    for (const [width, height] of [[320, 740], [375, 812], [390, 844], [740, 360]]) {
      await viewport(width, height, true);
      const layouts = {};
      for (const slug of ['az', 'quick-fox', 'phoneme-sound-lab', 'vampire-vowels']) {
        await navigate(`/games/${slug}/`);
        await evaluate(`document.getElementById('startBtn').click()`);
        await until(`document.getElementById('gameTouchControls').classList.contains('is-active') && document.getElementById('gameTouchControls').getBoundingClientRect().bottom <= innerHeight + 1`);
        const layout = await measure();
        verify(layout, `${slug} ${width}×${height}`);
        layouts[slug] = layout;
        if (slug === 'quick-fox') assert.deepEqual(layout.rows.map(row => row.keys.length), [10, 9, 7, 1]);
        if (slug === 'vampire-vowels') assert.deepEqual(layout.rows.map(row => row.keys.length), [5]);
        await evaluate(`document.querySelector('#gameTouchKeyboard button').click()`);
        verify(await measure(), `${slug} ${width}×${height} with key feedback`);
        await screenshot(`keyboard-${slug}-${width}x${height}`);
      }
      const widthOf = slug => layouts[slug].rows[0].keys[0].width;
      assert.ok(Math.abs(widthOf('az') - widthOf('quick-fox')) < 0.1, `Space changed letter widths at ${width}px`);
      assert.ok(Math.abs(widthOf('az') - widthOf('phoneme-sound-lab')) < 0.1, `Game theme changed letter widths at ${width}px`);
    }
  });

  await t.test('long emotion words stay together through phone rotation without shrinking tile height', async () => {
    await viewport(390, 844, true);
    await navigate('/games/emotion-journey/');
    await evaluate(`document.getElementById('startBtn').click()`);
    for (const word of ['happy', 'sad', 'angry', 'scared', 'confused']) {
      await evaluate(`(() => { for (const letter of ${JSON.stringify(word.toUpperCase())}) document.querySelector('#gameTouchKeyboard [data-skbtn="' + letter + '"]').click(); })()`);
    }
    await until(`document.getElementById('letterRow').textContent === 'DISGUSTED'`);
    const checkWord = async expected => {
      const row = await evaluate(`(() => {
        const el = document.getElementById('letterRow');
        const r = el.getBoundingClientRect();
        return { word: el.textContent, left: r.left, right: r.right, scroll: el.hasAttribute('data-word-scroll'),
          letters: [...el.children].map(child => { const box = child.getBoundingClientRect(); return {
            line: child.offsetTop, left: box.left, right: box.right, width: box.width, height: box.height,
            font: parseFloat(getComputedStyle(child).fontSize) }; }) };
      })()`);
      assert.equal(row.word, expected);
      assert.equal(row.scroll, false, `${expected} should fit without scrolling`);
      assert.equal(new Set(row.letters.map(letter => letter.line)).size, 1, `${expected} wraps`);
      row.letters.forEach(letter => {
        assert.ok(letter.left >= row.left - 1 && letter.right <= row.right + 1, `${expected} clipped`);
        assert.ok(letter.width >= 24 && letter.height >= 52 && letter.font >= 16, `${expected} became unreadable`);
      });
    };
    for (const [width, height] of [[320, 740], [375, 812], [390, 844], [740, 360], [320, 740]]) {
      await viewport(width, height, true);
      await new Promise(resolve => setTimeout(resolve, 650));
      await checkWord('DISGUSTED');
      await screenshot(`whole-word-disgusted-${width}x${height}`);
    }
    await evaluate(`(() => { for (const letter of 'DISGUSTED') document.querySelector('#gameTouchKeyboard [data-skbtn="' + letter + '"]').click(); })()`);
    await until(`document.getElementById('letterRow').textContent === 'SURPRISED'`);
    await new Promise(resolve => setTimeout(resolve, 150));
    await checkWord('SURPRISED');
  });

  await t.test('very long custom words stay on one readable line and follow the next letter', async () => {
    await viewport(320, 740, true);
    await navigate('/games/word-builder/');
    const word = 'pneumonoultramicroscopicsilicovolcanoconiosis';
    await evaluate(`document.getElementById('wordInput').value = ${JSON.stringify(word)}; document.getElementById('startBtn').click()`);
    await until(`document.getElementById('rowUpper').hasAttribute('data-word-scroll')`);
    await evaluate(`(() => { for (const letter of ${JSON.stringify(word.slice(0, 30).toUpperCase())}) document.querySelector('#gameTouchKeyboard [data-skbtn="' + letter + '"]').click(); })()`);
    await until(`document.getElementById('rowUpper').scrollLeft > 0`);
    const rows = await evaluate(`['rowUpper', 'rowLower'].map(id => {
      const row = document.getElementById(id), bounds = row.getBoundingClientRect();
      const current = row.querySelector('.ghost').getBoundingClientRect();
      return { lines: [...new Set([...row.children].map(el => el.offsetTop))], left: bounds.left, right: bounds.right,
        currentLeft: current.left, currentRight: current.right, font: parseFloat(getComputedStyle(row.children[0]).fontSize),
        width: row.children[0].offsetWidth, scrollable: row.scrollWidth > row.clientWidth };
    })`);
    rows.forEach(row => {
      assert.equal(row.lines.length, 1);
      assert.equal(row.scrollable, true);
      assert.ok(row.font >= 16 && row.width >= 24);
      assert.ok(row.currentLeft >= row.left && row.currentRight <= row.right);
    });
    await screenshot('whole-word-custom-scroll');
    await evaluate(`document.getElementById('actionBtn').click(); document.getElementById('wordInput').value = 'cat'; document.getElementById('startBtn').click()`);
    await until(`document.getElementById('rowUpper').textContent === 'CAT' && !document.getElementById('rowUpper').hasAttribute('data-word-fit')`);
    assert.equal(await evaluate(`document.getElementById('rowUpper').hasAttribute('data-word-scroll')`), false);
  });

  await t.test('every active game fits portrait and landscape phones, including after typing', async () => {
    const data = await readFile(new URL('../data/games.yaml', import.meta.url), 'utf8');
    const slugs = [...data.matchAll(/^- slug: (.+)$/gm)].map(match => match[1]);
    const audit = [];
    exceptions.length = 0;
    for (const [width, height] of [[320, 740], [390, 844], [740, 360]]) {
      await viewport(width, height, true);
      for (const slug of slugs) {
        await navigate(`/games/${slug}/`);
        await evaluate(`(() => {
          const input = document.getElementById('wordInput');
          if (input) { input.value = 'butterfly'; input.dispatchEvent(new Event('input', { bubbles: true })); }
          document.getElementById('startBtn').click();
        })()`);
        await new Promise(resolve => setTimeout(resolve, 650));
        const metrics = await evaluate(`(() => {
          const panel = document.querySelector('#gameTouchControls');
          const panelRect = panel.getBoundingClientRect();
          const rows = [...document.querySelectorAll('.letter-row, .boxes')].filter(el => el.getClientRects().length);
          const name = el => el.id || el.className;
          return {
            gameVisible: !!document.getElementById('gameArea').getClientRects().length,
            overflow: [...document.querySelectorAll('main *')].filter(el => {
              const r = el.getBoundingClientRect();
              return !el.closest('[aria-hidden="true"]') && r.width && r.height && (r.left < -2 || r.right > innerWidth + 2);
            }).map(el => ({ element: name(el), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right) })).slice(0, 12),
            rows: rows.map(el => ({ element: name(el), transform: getComputedStyle(el).transform, children: [...el.children].map(child => { const r = child.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), line: child.offsetTop }; }) })),
            clippedLabels: [...document.querySelectorAll('.chalice, .round-hint, .round-card .value')].filter(el => el.scrollWidth > el.clientWidth + 1).map(name),
            keyboardVisible: panel.classList.contains('is-active'),
            keyboardTop: Math.round(panelRect.top),
            current: (() => { const el = document.querySelector('.letter-box.current, .token.current, .candle.current, .segment-letter.current, #letterDisplay, #rowUpper .box.ghost'); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; })()
          };
        })()`);
        const verify = (result, stage) => {
          const context = `${slug} at ${width}×${height}, ${stage}`;
          assert.equal(result.gameVisible, true, context);
          assert.deepEqual(result.overflow, [], context);
          assert.deepEqual(result.clippedLabels, [], context);
          result.rows.forEach(row => {
            assert.ok(new Set(row.children.map(child => child.line)).size <= 1, `${context}: word wraps in ${row.element}`);
            row.children.forEach(child => {
              assert.ok(child.left >= -2 && child.right <= width + 2, `${context}: clipped letter in ${row.element}`);
              assert.ok(child.width >= 24, `${context}: unreadable letter in ${row.element}`);
            });
          });
          if (result.keyboardVisible && result.current) {
            assert.ok(result.current.top >= 0, `${context}: current letter above the screen`);
            assert.ok(result.current.bottom <= result.keyboardTop - 4, `${context}: current letter covered by keyboard`);
          }
        };
        audit.push({ slug, width, height, ...metrics });
        verify(metrics, 'after starting');
        const typed = await evaluate(`(() => {
          const current = document.querySelector('#gameArea .letter-box.current, #gameArea .candle.current .candle-letter, #gameArea .token.current .char, #gameArea .segment-letter.current, #rowUpper .box.ghost, #letterDisplay');
          const key = current?.textContent.trim().toUpperCase();
          const button = key && document.querySelector('#gameTouchKeyboard [data-skbtn="' + key + '"]');
          if (!button) return false;
          button.click();
          return true;
        })()`);
        if (typed) {
          await new Promise(resolve => setTimeout(resolve, 150));
          const current = await evaluate(`(() => {
            const el = document.querySelector('#gameArea .letter-box.current, #gameArea .candle.current, #gameArea .token.current, #gameArea .segment-letter.current, #rowUpper .box.ghost, #letterDisplay');
            const panel = document.querySelector('#gameTouchControls');
            if (!el || !panel.classList.contains('is-active')) return null;
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, keyboardTop: panel.getBoundingClientRect().top };
          })()`);
          if (current) {
            assert.ok(current.top >= 0 && current.bottom <= current.keyboardTop - 4, `${slug} at ${width}×${height}: next letter covered after typing`);
          }
        }
        if (width === 390) {
          await screenshot(`active-${slug}`);
          await evaluate(`GameTouchKeyboard.hide(); window.scrollTo({ top: document.getElementById('gameArea').offsetTop, behavior: 'instant' });`);
          await new Promise(resolve => setTimeout(resolve, 400));
          await screenshot(`area-${slug}`);
        } else if (width === 740) {
          await screenshot(`landscape-${slug}`);
        }
      }
    }
    if (process.env.TEST_SCREENSHOT_DIR) await writeFile(join(process.env.TEST_SCREENSHOT_DIR, 'mobile-audit.json'), JSON.stringify(audit, null, 2));
    assert.deepEqual(exceptions, []);
    assert.equal(audit.length, slugs.length * 3);
  });

  await t.test('Vampire Vowels shows all five vowels, completes five rounds with real touch taps, and replays', async () => {
    await viewport(390, 740, true);
    await navigate('/games/vampire-vowels/');
    await evaluate(`document.getElementById('startBtn').click()`);
    await until(`document.querySelector('#gameTouchControls.is-active')`);
    await until(`document.getElementById('gameTouchControls').getBoundingClientRect().bottom <= innerHeight + 1`);
    assert.equal(await evaluate(`document.querySelectorAll('#gameTouchKeyboard button').length`), 5);
    for (let letter = 0; letter < 25; letter += 1) {
      const before = await evaluate(`document.getElementById('roundCounter').textContent + ':' + document.querySelectorAll('#letterRow .filled').length`);
      const target = await evaluate(`(() => {
        const current = document.querySelector('#letterRow .current');
        const button = document.querySelector('#gameTouchKeyboard [data-skbtn="' + current.textContent + '"]');
        const r = button.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [target] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await until(`GameCelebration.isOpen() || document.getElementById('roundCounter').textContent + ':' + document.querySelectorAll('#letterRow .filled').length !== ${JSON.stringify(before)}`);
    }
    await until(`GameCelebration.isOpen()`);
    assert.equal(await evaluate(`document.getElementById('roundCounter').textContent`), '5 / 5');
    await new Promise(resolve => setTimeout(resolve, 700));
    await screenshot('vampire-win');
    await evaluate(`document.querySelector('[data-overlay-again]').click()`);
    await until(`document.querySelector('#gameTouchControls.is-active')`);
    assert.equal(await evaluate(`GameCelebration.isOpen()`), false);
    assert.equal(await evaluate(`document.querySelectorAll('#letterRow .letter-box').length`), 5);
    assert.equal(await evaluate(`document.getElementById('roundCounter').textContent`), '0 / 5');
  });

  await t.test('desktop letter fitting measures full content and keeps both ends inside a narrow card', async () => {
    await viewport(1280, 800);
    await navigate('/games/only-verbs/');
    const bounds = await evaluate(`(() => {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.style.width = '320px';
      const row = document.createElement('div'); row.className = 'letter-row';
      'BUTTERFLY'.split('').forEach(letter => { const box = document.createElement('span'); box.className = 'letter-box'; box.textContent = letter; row.appendChild(box); });
      card.appendChild(row); document.querySelector('.game-shell').appendChild(card);
      GameUI.fitLettersFor(row);
      const r = card.getBoundingClientRect();
      return { left: r.left, right: r.right, letters: [...row.children].map(el => { const rect = el.getBoundingClientRect(); return { left: rect.left, right: rect.right }; }) };
    })()`);
    bounds.letters.forEach(letter => assert.ok(letter.left >= bounds.left && letter.right <= bounds.right));
  });

  await t.test('alphabet play ignores shortcuts, held keys and form input, then wins and replays', async () => {
    await viewport(1280, 800);
    await navigate('/games/az/');
    await evaluate(`document.getElementById('startBtn').click()`);
    assert.equal(await evaluate(`document.getElementById('letterDisplay').textContent`), 'A');
    await evaluate(`(() => {
      for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { repeat: true }]) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, ...options }));
      }
      const select = document.createElement('select'); document.body.appendChild(select);
      select.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); select.remove();
    })()`);
    assert.equal(await evaluate(`document.getElementById('letterDisplay').textContent`), 'A');
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }))`);
    assert.equal(await evaluate(`document.getElementById('letterDisplay').textContent`), 'A');
    await evaluate(`'abcdefghijklmnopqrstuvwxyz'.split('').forEach(key => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))`);
    await until(`GameCelebration.isOpen()`);
    await evaluate(`document.querySelector('[data-overlay-again]').click()`);
    assert.equal(await evaluate(`GameCelebration.isOpen()`), false);
    assert.equal(await evaluate(`document.getElementById('letterDisplay').textContent`), 'A');
  });

  await t.test('celebration traps focus, isolates background, restores focus and preserves existing inert state', async () => {
    await navigate('/games/az/');
    await evaluate(`(() => {
      document.getElementById('startBtn').click();
      document.querySelector('footer').inert = true;
      document.getElementById('resetBtn').focus();
      window.replayCount = 0;
      GameCelebration.show({ content: '<h2>Well done!</h2>', onPlayAgain: () => window.replayCount++, initialFocus: 'playAgain', focusTarget: document.getElementById('resetBtn') });
    })()`);
    await until(`document.activeElement === document.querySelector('[data-overlay-again]')`);
    assert.equal(await evaluate(`document.querySelector('main').inert`), true);
    await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))`);
    assert.equal(await evaluate(`document.activeElement === document.querySelector('[data-overlay-dismiss]')`), true);
    await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))`);
    assert.equal(await evaluate(`document.activeElement === document.querySelector('[data-overlay-again]')`), true);
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
    await until(`document.activeElement === document.getElementById('resetBtn')`);
    assert.equal(await evaluate(`document.querySelector('main').inert`), false);
    assert.equal(await evaluate(`document.querySelector('footer').inert`), true);
    assert.equal(await evaluate(`window.replayCount`), 0);
  });

  await t.test('local touch keyboard works without external requests and survives rapid hide/reopen and cancellation', async () => {
    await viewport(390, 844, true);
    await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['*unpkg.com*', '*actions.google.com*'] });
    await navigate('/games/az/');
    await evaluate(`document.getElementById('startBtn').click()`);
    await until(`document.querySelector('#gameTouchControls.is-active')`);
    assert.equal(await evaluate(`document.querySelectorAll('#gameTouchKeyboard button').length`), 26);
    await evaluate(`document.querySelector('[aria-label="Letter A"]').click()`);
    assert.equal(await evaluate(`document.getElementById('letterDisplay').textContent`), 'B');
    await new Promise(resolve => setTimeout(resolve, 550));
    await screenshot('touch-keyboard');
    const values = await evaluate(`(async () => {
      const shell = document.querySelector('.game-shell');
      shell.style.setProperty('padding-bottom', '17px', 'important');
      GameTouchKeyboard.hide();
      await new Promise(resolve => setTimeout(resolve, 380));
      shell.style.setProperty('padding-bottom', '17px', 'important');
      window.pressed = [];
      window.testKeyboard = GameTouchKeyboard.attach({ layout: ['A B', 'Space'], onKeyPress: key => window.pressed.push(key) });
      testKeyboard.show(); testKeyboard.hide();
      await new Promise(resolve => setTimeout(resolve, 30));
      const canceled = document.getElementById('gameTouchControls').getAttribute('aria-hidden');
      testKeyboard.show(); await new Promise(resolve => setTimeout(resolve, 30));
      testKeyboard.hide(); testKeyboard.show();
      await new Promise(resolve => setTimeout(resolve, 420));
      const visible = getComputedStyle(document.getElementById('gameTouchControls')).display !== 'none';
      const cols = getComputedStyle(document.querySelector('#gameTouchKeyboard .hg-row')).gridTemplateColumns.split(' ').length;
      document.querySelector('[aria-label="Space key"]').click();
      testKeyboard.hide();
      return { canceled, visible, cols, pressed: window.pressed, padding: shell.style.getPropertyValue('padding-bottom'), priority: shell.style.getPropertyPriority('padding-bottom') };
    })()`);
    assert.deepEqual(values, { canceled: 'true', visible: true, cols: 2, pressed: [' '], padding: '17px', priority: 'important' });
    await navigate('/games/quick-fox/');
    await evaluate(`document.getElementById('startBtn').click()`);
    await until(`document.querySelector('#gameTouchControls.is-active')`);
    assert.equal(await evaluate(`document.querySelectorAll('#gameTouchKeyboard button').length`), 27);
    await evaluate(`['Letter T', 'Letter H', 'Letter E', 'Space key'].forEach(label => document.querySelector('#gameTouchKeyboard [aria-label="' + label + '"]').click())`);
    assert.equal(await evaluate(`document.querySelectorAll('#sentenceGrid .token.done').length`), 4);
    await send('Network.setBlockedURLs', { urls: [] });
  });

  await t.test('mute pauses active audio, blocks subsequent sounds, persists and tolerates unavailable storage', async () => {
    await navigate('/games/az/');
    const soundSource = await readFile(new URL('../static/js/game/ui/sound.js', import.meta.url), 'utf8');
    const result = await evaluate(`(() => {
      window.soundCalls = { play: 0, pause: 0 };
      const audio = { play: () => { soundCalls.play++; return Promise.resolve(); }, pause: () => soundCalls.pause++, addEventListener() {} };
      GameSound.setEnabled(true); GameSound.play(audio); GameSound.setEnabled(false); GameSound.play(audio);
      return { ...soundCalls, label: document.querySelector('[data-sound-toggle]').textContent };
    })()`);
    assert.deepEqual(result, { play: 1, pause: 1, label: 'Sound: Off' });
    await navigate('/games/rocket-run/');
    assert.equal(await evaluate(`GameSound.enabled`), false);
    assert.equal(await evaluate(`document.querySelector('[data-sound-toggle]').getAttribute('aria-pressed')`), 'false');
    await evaluate(`(() => { window.__gameSoundAttached__ = false; Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('Storage denied'); } }); })()`);
    await evaluate(soundSource);
    assert.equal(await evaluate(`GameSound.enabled`), true);
    await evaluate(`GameSound.setEnabled(false)`);
    assert.equal(await evaluate(`GameSound.enabled`), false);
  });

});
