(function attachGlobalFitLetters(){
  if (typeof window === 'undefined') return;
  if (window.__fitLettersAttached__) return;
  window.__fitLettersAttached__ = true;

  function prefersReducedMotion() {
    if (typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function scrollBehavior() {
    return prefersReducedMotion() ? 'auto' : 'smooth';
  }

  function measureAndScale(el) {
    if (!el) return;
    el.style.transform = 'none';
    el.style.whiteSpace = 'nowrap';
    el.style.removeProperty('--letter-fit-gap');
    const parent = el.parentElement;
    if (!parent) return;
    const available = parent.getBoundingClientRect().width || 0;
    let actual = el.scrollWidth || 0;
    if (!available || !actual) return;
    const childCount = el.children ? el.children.length : 0;
    if (childCount > 1 && actual > available) {
      const style = window.getComputedStyle(el);
      const baseGap = parseFloat(style.columnGap || style.gap || '0') || 0;
      if (baseGap > 0) {
        const overflow = actual - available;
        const adjust = overflow / (childCount - 1);
        const targetGap = Math.max(baseGap * 0.4, baseGap - adjust);
        if (targetGap < baseGap) {
          el.style.setProperty('--letter-fit-gap', `${targetGap}px`);
          actual = el.scrollWidth || actual;
        }
      }
    }
    const scale = Math.min(1, available / actual);
    el.style.transform = scale < 1 ? `scale(${scale})` : 'none';
  }

  function fitLettersFor(el) {
    if (!el) return;
    measureAndScale(el);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => measureAndScale(el));
    }
  }

  function fitAllLetterRows() {
    document.querySelectorAll('.letter-row').forEach(fitLettersFor);
  }

  window.GameUI = window.GameUI || {};
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
