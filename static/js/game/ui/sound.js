(function attachGameSound(){
  if (typeof window === 'undefined') return;
  if (window.__gameSoundAttached__) return;
  window.__gameSoundAttached__ = true;

  const STORAGE_KEY = 'gameSoundEnabled';
  const playing = new Set();
  const observed = new WeakSet();

  function getInitialEnabled(){
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) return true;
      return raw === 'true';
    } catch (e) {
      return true;
    }
  }

  const state = {
    enabled: getInitialEnabled()
  };

  function setEnabled(next){
    state.enabled = Boolean(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(state.enabled));
    } catch (e) {}
    if (!state.enabled) {
      playing.forEach(audioEl => {
        try { audioEl.pause(); } catch (_) {}
      });
      playing.clear();
    }
    syncButtons();
  }

  function toggle(){
    setEnabled(!state.enabled);
  }

  function play(audioEl){
    if (!state.enabled) return;
    if (!audioEl || typeof audioEl.play !== 'function') return;
    try {
      if (!observed.has(audioEl)) {
        observed.add(audioEl);
        audioEl.addEventListener('ended', () => playing.delete(audioEl));
        audioEl.addEventListener('pause', () => playing.delete(audioEl));
      }
      playing.add(audioEl);
      const result = audioEl.play();
      if (result && typeof result.catch === 'function') result.catch(() => playing.delete(audioEl));
    } catch (e) {
      playing.delete(audioEl);
    }
  }

  function labelFor(enabled){
    return enabled ? 'Sound: On' : 'Sound: Off';
  }

  function syncButtons(){
    const buttons = document.querySelectorAll('[data-sound-toggle]');
    buttons.forEach((btn) => {
      btn.setAttribute('aria-pressed', state.enabled ? 'true' : 'false');
      btn.textContent = labelFor(state.enabled);
    });
  }

  function attachButtonHandlers(){
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest?.('[data-sound-toggle]');
      if (!btn) return;
      event.preventDefault();
      toggle();
    });
  }

  window.GameSound = {
    get enabled(){ return state.enabled; },
    setEnabled,
    toggle,
    play
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      syncButtons();
      attachButtonHandlers();
    }, { once: true });
  } else {
    syncButtons();
    attachButtonHandlers();
  }
})();

