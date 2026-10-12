(function attachGlobalFitLetters(){
  if (typeof window === 'undefined') return;
  if (window.__fitLettersAttached__) return;
  window.__fitLettersAttached__ = true;
  const main = document.getElementById('mainContent');
  if (main && !main.hasAttribute('tabindex')) main.tabIndex = -1;

  function prefersReducedMotion() {
    if (typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function scrollBehavior() {
    return prefersReducedMotion() ? 'auto' : 'smooth';
  }

  function fitWord(el) {
    if (!el || !el.getClientRects().length) return;
    el.style.transform = 'none';
    el.style.removeProperty('justify-content');
    el.style.removeProperty('gap');
    el.style.removeProperty('--letter-fit-gap');
    el.removeAttribute('data-word-fit');
    el.removeAttribute('data-word-scroll');
    const style = window.getComputedStyle(el);
    if (style.flexWrap !== 'nowrap') {
      el.style.removeProperty('white-space');
      return;
    }
    el.style.whiteSpace = 'nowrap';
    // Leave room for the current letter's slightly enlarged highlight.
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const available = el.clientWidth - padding - 4;
    const children = Array.from(el.children);
    if (available <= 0 || !children.length) return;
    let gap = parseFloat(style.columnGap) || 0;
    const widths = children.reduce((total, child) => total + child.offsetWidth, 0);
    let actual = widths + gap * (children.length - 1);
    if (children.length > 1 && actual > available && gap > 0) {
      gap = Math.max(Math.min(2, gap), gap - (actual - available) / (children.length - 1));
      el.style.setProperty('--letter-fit-gap', `${gap}px`);
      el.style.gap = `${gap}px`;
      actual = widths + gap * (children.length - 1);
    }
    if (actual > available) {
      const size = Math.max(24, (available - gap * (children.length - 1)) / children.length);
      const glyph = children[0].querySelector('.candle-letter') || children[0];
      const font = Math.min(parseFloat(getComputedStyle(glyph).fontSize), Math.max(16, size * 0.72));
      el.style.setProperty('--word-fit-size', `${size}px`);
      el.style.setProperty('--word-fit-font', `${font}px`);
      el.setAttribute('data-word-fit', '');
      // Exceptionally long custom words stay readable in a single scrollable row.
      if (size * children.length + gap * (children.length - 1) > available + 1) {
        el.setAttribute('data-word-scroll', '');
        const current = el.querySelector('.current, .ghost');
        if (current) {
          const rowBounds = el.getBoundingClientRect();
          const bounds = current.getBoundingClientRect();
          if (bounds.left < rowBounds.left + 4) el.scrollLeft += bounds.left - rowBounds.left - 4;
          else if (bounds.right > rowBounds.right - 4) el.scrollLeft += bounds.right - rowBounds.right + 4;
        }
      } else {
        el.scrollLeft = 0;
      }
    } else {
      el.scrollLeft = 0;
    }
  }

  function fitLettersFor(el) {
    if (!el) return;
    fitWord(el);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => fitWord(el));
    }
  }

  function fitAllLetterRows() {
    document.querySelectorAll('.letter-row').forEach(fitLettersFor);
  }

  window.GameUI = window.GameUI || {};
  window.GameUI.shouldHandleGameKey = (event, { allowRepeat = false } = {}) => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.repeat && !allowRepeat) return false;
    if (window.GameCelebration?.isOpen()) return false;
    const target = event.target;
    if (target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return false;
    if ((event.key === ' ' || event.key === 'Enter') && target?.closest?.('button, a[href], summary')) return false;
    return true;
  };
  window.GameUI.fitLettersFor = fitLettersFor;
  window.GameUI.fitAllLetterRows = fitAllLetterRows;
  window.GameUI.prefersReducedMotion = prefersReducedMotion;
  window.GameUI.scrollBehavior = scrollBehavior;
  window.GameUI.scrollToTop = () => window.scrollTo({ top: 0, behavior: scrollBehavior() });
  window.GameUI.safeScrollTo = (opts = {}) => {
    const next = Object.assign({}, opts);
    if ('behavior' in next) {
      next.behavior = scrollBehavior();
    } else {
      next.behavior = scrollBehavior();
    }
    window.scrollTo(next);
  };

  let rafId = null;
  function scheduleReflow() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      fitAllLetterRows();
    });
  }

  window.addEventListener('resize', scheduleReflow, { passive: true });
  window.addEventListener('orientationchange', scheduleReflow);

  const roSupported = typeof ResizeObserver !== 'undefined';
  if (roSupported) {
    const ro = new ResizeObserver(() => scheduleReflow());
    const observed = new WeakSet();

    const observeTargets = () => {
      document.querySelectorAll('.letter-row').forEach(el => {
        if (!observed.has(el)) {
          ro.observe(el);
          observed.add(el);
        }
        const parent = el.parentElement;
        if (parent && !observed.has(parent)) {
          ro.observe(parent);
          observed.add(parent);
        }
      });
    };

    observeTargets();

    const mo = new MutationObserver(() => {
      observeTargets();
      scheduleReflow();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    const mo = new MutationObserver(scheduleReflow);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fitAllLetterRows, { once: true });
  } else {
    fitAllLetterRows();
  }
})();
