(function attachGameTouchKeyboard(){
  if (typeof window === 'undefined') return;
  if (window.GameTouchKeyboard) return;

  const panel = document.getElementById('gameTouchControls');
  const labelEl = document.getElementById('gameTouchLabel');
  const keyboardWrapper = panel ? panel.querySelector('[data-virtual-keyboard]') : null;
  const keyboardRoot = panel ? panel.querySelector('[data-keyboard-root]') : null;
  const keyboardContainer = panel ? panel.querySelector('.simple-keyboard') : null;
  const closeBtn = panel ? panel.querySelector('[data-touch-close]') : null;

  const defaultLayout = [
    'Q W E R T Y U I O P',
    'A S D F G H J K L',
    'Z X C V B N M'
  ];

  const state = {
    isTouch: detectTouch(),
    active: null,
    pending: null,
    visible: false,
    hideTimer: null,
    resizeHandler: null,
    layoutObserver: null,
    targetObserver: null,
    paddingTarget: null,
    originalPadding: null,
    appliedThemeKeys: [],
    keyFlashTimers: new Map()
  };

  function detectTouch(){
    if (typeof window === 'undefined') return false;
    const hasTouchEvent = 'ontouchstart' in window || (window.DocumentTouch && document instanceof window.DocumentTouch);
    const hasTouchPoints = (navigator.maxTouchPoints || navigator.msMaxTouchPoints || 0) > 0;
    const coarsePointer = typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)').matches : false;
    return hasTouchEvent || hasTouchPoints || coarsePointer;
  }

  function computeKeys(rows){
    return rows
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function isLetterKey(key){
    return typeof key === 'string' && key.length === 1 && /[a-z]/i.test(key);
  }

  function isSpaceKey(key){
    return typeof key === 'string' && key.toLowerCase() === 'space';
  }

  function keyDisplayLabel(key){
    if(isSpaceKey(key)) return 'Space';
    if(isLetterKey(key)) return key.toUpperCase();
    return key;
  }

  function ariaLabelForKey(key){
    if(isSpaceKey(key)) return 'Space key';
    if(isLetterKey(key)) return `Letter ${key.toUpperCase()}`;
    return `Key ${key}`;
  }

  function normalizeVirtualKey(button){
    if(typeof button !== 'string') return null;
    if(isSpaceKey(button)) return { value: ' ', label: 'Space' };
    if(isLetterKey(button)) return { value: button.toLowerCase(), label: button };
    return null;
  }

  function ensureKeyboard(options = {}){
    if (!panel || !keyboardWrapper || !keyboardRoot || !keyboardContainer) {
      return Promise.resolve(null);
    }
    configureKeyboard(options);
    return Promise.resolve(keyboardContainer);
  }

  function configureKeyboard(options = {}){
    const layoutRows = Array.isArray(options.layout)
      ? options.layout
      : (options.layout && Array.isArray(options.layout.default))
        ? options.layout.default
        : defaultLayout;
    clearFlashTimers();
    const keysByRow = layoutRows.map(row => computeKeys([row]));
    const letterRows = keysByRow.map(keys => keys.filter(key => !isSpaceKey(key))).filter(keys => keys.length);
    const hasSpace = keysByRow.some(keys => keys.some(isSpaceKey));
    // Space has its own row and must not change the widths of the letter keys.
    const keyRows = hasSpace ? [...letterRows, ['Space']] : letterRows;
    const columns = Math.max(1, ...letterRows.map(keys => keys.length));
    keyboardContainer.style.setProperty('--keyboard-cols', String(columns));
    const rows = document.createDocumentFragment();
    keyRows.forEach(keys => {
      const rowEl = document.createElement('div');
      rowEl.className = 'hg-row';
      rowEl.dataset.keyboardRow = keys.every(isSpaceKey) ? 'space' : 'letters';
      rowEl.style.setProperty('--cols', String(keys.length));
      keys.forEach(key => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hg-button';
        button.dataset.skbtn = keyDisplayLabel(key);
        button.textContent = keyDisplayLabel(key);
        button.setAttribute('aria-label', ariaLabelForKey(key));
        button.addEventListener('pointerdown', event => event.preventDefault());
        button.addEventListener('click', () => handleVirtualKeyPress(key));
        rowEl.appendChild(button);
      });
      rows.appendChild(rowEl);
    });
    keyboardContainer.classList.add('hg-theme-default', 'game-touch-keyboard');
    keyboardContainer.replaceChildren(rows);
  }

  function applyTheme(theme){
    if (!panel) return;
    if (state.appliedThemeKeys.length) {
      state.appliedThemeKeys.forEach(key => panel.style.removeProperty(key));
      state.appliedThemeKeys = [];
    }
    if (!theme || typeof theme !== 'object') return;
    Object.entries(theme).forEach(([key, value]) => {
      if (!key) return;
      if (value == null) {
        panel.style.removeProperty(key);
        return;
      }
      panel.style.setProperty(key, value);
      state.appliedThemeKeys.push(key);
    });
  }

  function updateLabel(text){
    if (!labelEl) return;
    labelEl.textContent = text || 'Tap letters to play';
  }

  function updatePadding(connection){
    if (!state.visible || !panel) return;
    const paddingTarget = getPaddingTarget(connection);
    if (paddingTarget !== state.paddingTarget) {
      restorePadding();
      state.paddingTarget = paddingTarget || null;
      if (paddingTarget) {
        state.originalPadding = {
          value: paddingTarget.style.getPropertyValue('padding-bottom'),
          priority: paddingTarget.style.getPropertyPriority('padding-bottom')
        };
      }
    }
    if (!paddingTarget) return;
    const height = Math.round(panel.offsetHeight || 0);
    if (height > 0) {
      paddingTarget.style.paddingBottom = `${height + 36}px`;
    } else {
      paddingTarget.style.removeProperty('padding-bottom');
    }
  }

  function restorePadding(){
    if (state.paddingTarget) {
      const { value, priority } = state.originalPadding || {};
      if (value) state.paddingTarget.style.setProperty('padding-bottom', value, priority);
      else state.paddingTarget.style.removeProperty('padding-bottom');
    }
    state.paddingTarget = null;
    state.originalPadding = null;
  }

  function getPaddingTarget(connection){
    if (!connection) return document.querySelector('.game-shell');
    const { getPaddingTarget } = connection.options || {};
    if (typeof getPaddingTarget === 'function') {
      try {
        const target = getPaddingTarget();
        if (target instanceof HTMLElement) return target;
      } catch (_) {
        /* swallow */
      }
    }
    return document.querySelector('.game-shell');
  }

  function ensureVisible(connection, opts = {}){
    if (!state.visible || !panel || window.GameCelebration?.isOpen()) return;
    const anchor = opts.anchor || getViewportAnchor(connection);
    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return;
    // A multi-line word or phoneme board may be taller than the usable screen.
    // Keep the next letter visible rather than scrolling to the board's bottom.
    const current = anchor.querySelector?.('.letter-box.current, .candle.current, .segment-letter.current, .token.current, .box.ghost');
    const anchorRect = (current || anchor).getBoundingClientRect();
    if (!anchorRect.width || !anchorRect.height) return;
    const panelRect = panel.getBoundingClientRect();
    const top = (window.visualViewport?.offsetTop || 0) + 12;
    const bottom = panelRect.top - 16;
    let offset = 0;
    if (anchorRect.bottom > bottom) offset = anchorRect.bottom - bottom;
    if (anchorRect.top - offset < top) offset = anchorRect.top - top;
    if (offset) {
      window.scrollBy({ top: offset, behavior: 'auto' });
    }
  }

  function getViewportAnchor(connection){
    if (!connection) return null;
    const getter = connection.options?.getViewportTarget;
    if (typeof getter === 'function') {
      try {
        const el = getter();
        if (el instanceof HTMLElement) return el;
      } catch (_) {
        /* ignore */
      }
    }
    return null;
  }

  function handleVirtualKeyPress(button){
    if (!state.active) return;
    const normalized = normalizeVirtualKey(button);
    if (!normalized) return;
    state.active.options?.onKeyPress?.(normalized.value, { source: 'virtual', original: button });
    flashKey(normalized.value);
  }

  function flashKey(char){
    if (!state.visible || !keyboardWrapper) return;
    if (typeof char !== 'string' || char.length !== 1) return;
    if (char === ' ') {
      highlightKey('Space');
      return;
    }
    const letter = char.toUpperCase();
    if (!/[A-Z]/.test(letter)) return;
    highlightKey(letter);
  }

  function highlightKey(buttonId){
    if (!keyboardWrapper) return;
    const btn = keyboardWrapper.querySelector(`.hg-button[data-skbtn="${buttonId}"]`);
    if (!btn) return;
    btn.classList.add('is-flashing');
    const timers = state.keyFlashTimers;
    if (timers.has(buttonId)) {
      clearTimeout(timers.get(buttonId));
    }
    const timer = window.setTimeout(() => {
      btn.classList.remove('is-flashing');
      timers.delete(buttonId);
    }, 180);
    timers.set(buttonId, timer);
  }

  function clearFlashTimers(){
    state.keyFlashTimers.forEach(timer => window.clearTimeout(timer));
    state.keyFlashTimers.clear();
    if (keyboardWrapper) {
      keyboardWrapper.querySelectorAll('.hg-button.is-flashing').forEach(btn => btn.classList.remove('is-flashing'));
    }
  }

  function stopObservingLayout(){
    state.layoutObserver?.disconnect();
    state.targetObserver?.disconnect();
    state.layoutObserver = null;
    state.targetObserver = null;
  }

  function observeLayout(connection){
    stopObservingLayout();
    const ensureCurrent = () => requestAnimationFrame(() => {
      if (state.visible && state.active === connection) ensureVisible(connection);
    });
    const shell = getPaddingTarget(connection);
    if (shell && typeof ResizeObserver !== 'undefined') {
      state.layoutObserver = new ResizeObserver(ensureCurrent);
      state.layoutObserver.observe(shell);
    }
    const anchor = getViewportAnchor(connection);
    const target = anchor?.closest('.letter-row, .sentence-grid, .phoneme-row, .boxes') || anchor;
    if (target && typeof MutationObserver !== 'undefined') {
      state.targetObserver = new MutationObserver(ensureCurrent);
      state.targetObserver.observe(target, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    }
  }

  function activatePanel(connection){
    if (!panel) return;
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
    if (state.resizeHandler) {
      window.removeEventListener('resize', state.resizeHandler);
      window.removeEventListener('orientationchange', state.resizeHandler);
      window.visualViewport?.removeEventListener('resize', state.resizeHandler);
    }
    state.visible = true;
    panel.classList.remove('hidden');
    panel.style.removeProperty('display');
    panel.setAttribute('aria-hidden', 'false');
    if (keyboardWrapper) {
      keyboardWrapper.classList.remove('hidden');
      keyboardWrapper.style.removeProperty('display');
      keyboardWrapper.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('game-touch-keyboard-open');
    observeLayout(connection);
    requestAnimationFrame(() => {
      if (!state.visible || state.active !== connection) return;
      panel.classList.add('is-active');
      updatePadding(connection);
      window.setTimeout(() => {
        if (!state.visible || state.active !== connection) return;
        updatePadding(connection);
        ensureVisible(connection);
        window.GameUI?.fitAllLetterRows?.();
      }, 200);
    });

    state.resizeHandler = () => {
      updatePadding(connection);
      ensureVisible(connection);
    };
    window.addEventListener('resize', state.resizeHandler);
    window.addEventListener('orientationchange', state.resizeHandler);
    window.visualViewport?.addEventListener('resize', state.resizeHandler);
  }

  function deactivatePanel(connection){
    if (!panel) return;
    if (!state.visible) return;
    state.visible = false;
    stopObservingLayout();
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('is-active');
    document.body.classList.remove('game-touch-keyboard-open');
    if (state.resizeHandler) {
      window.removeEventListener('resize', state.resizeHandler);
      window.removeEventListener('orientationchange', state.resizeHandler);
      window.visualViewport?.removeEventListener('resize', state.resizeHandler);
      state.resizeHandler = null;
    }
    clearFlashTimers();
    restorePadding();
    window.GameUI?.fitAllLetterRows?.();
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
    }
    state.hideTimer = window.setTimeout(() => {
      state.hideTimer = null;
      if (state.visible) return;
      if (keyboardWrapper) {
        keyboardWrapper.classList.add('hidden');
        keyboardWrapper.style.display = 'none';
        keyboardWrapper.setAttribute('aria-hidden', 'true');
      }
      panel.classList.add('hidden');
      panel.style.display = 'none';
    }, 360);
    connection?.options?.onHide?.();
  }

  function mergeOptions(connection, overrides = {}){
    if (!connection || !overrides) return;
    connection.options = Object.assign({}, connection.options, overrides);
  }

  function show(connection, overrides = {}){
    if (!state.isTouch) return;
    if (!panel) return;
    mergeOptions(connection, overrides);
    if (state.active && state.active !== connection) {
      hide(state.active);
    }
    state.pending = connection;
    const { label, theme } = connection.options || {};
    updateLabel(label);
    applyTheme(theme);
    ensureKeyboard(connection.options).then(keyboard => {
      if (!keyboard) return;
      if (state.pending !== connection) return;
      state.active = connection;
      state.pending = null;
      activatePanel(connection);
      connection.options?.onShow?.();
    });
  }

  function hide(connection){
    if (!panel) return;
    if (connection && state.active && state.active !== connection) return;
    if (!connection || state.pending === connection) state.pending = null;
    if (!state.visible) {
      if (!connection || state.active === connection) {
        state.active = null;
      }
      return;
    }
    const active = state.active;
    state.active = null;
    state.pending = null;
    deactivatePanel(active);
  }

  function ensureAnchor(connection, anchor){
    if (!panel) return;
    ensureVisible(connection, { anchor });
  }

  function updateActiveOptions(connection){
    if (connection !== state.active) return;
    const { label, theme } = connection.options || {};
    updateLabel(label);
    applyTheme(theme);
    configureKeyboard(connection.options);
    updatePadding(connection);
  }

  function attach(options = {}){
    const connection = {
      id: options.id || `touch-keyboard-${Math.random().toString(36).slice(2, 8)}`,
      options: Object.assign({
        label: 'Tap letters to play',
        layout: defaultLayout,
        theme: null,
        onKeyPress: null,
        onShow: null,
        onHide: null,
        getPaddingTarget: null,
        getViewportTarget: null
      }, options || {})
    };

    return {
      isTouchDevice: () => state.isTouch,
      show(extra) {
        show(connection, extra);
      },
      hide() {
        hide(connection);
      },
      flashKey(char) {
        flashKey(char);
      },
      setLabel(text) {
        connection.options.label = text;
        updateActiveOptions(connection);
      },
      setTheme(theme) {
        connection.options.theme = theme || null;
        updateActiveOptions(connection);
      },
      ensureVisible(anchor) {
        ensureAnchor(connection, anchor);
      },
      update(extra) {
        mergeOptions(connection, extra);
        updateActiveOptions(connection);
      }
    };
  }

  window.GameTouchKeyboard = {
    attach,
    flashKey,
    hide: hide.bind(null, null),
    isTouchDevice: () => state.isTouch
  };

  panel?.addEventListener('transitionend', event => {
    if (event.target === panel && event.propertyName === 'transform' && state.visible) {
      updatePadding(state.active);
      ensureVisible(state.active);
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => hide());
  }
})();
