(function(){
    const overlay = document.getElementById('gameWinOverlay');
    if(!overlay) return;
    const panel = overlay.querySelector('.game-win-overlay__panel');
    const body = overlay.querySelector('#gameWinOverlayBody');
    const actions = overlay.querySelector('.game-win-overlay__actions');
    const againBtn = overlay.querySelector('[data-overlay-again]');
    const dismissers = overlay.querySelectorAll('[data-overlay-dismiss]');
    const supportsFixedPosition = checkFixedSupport();
    let lastActiveElement = null;
    let storedOptions = null;
    let playAgainHandler = null;
    let absoluteMode = false;
    let absoluteUpdateHandler = null;
    let openedAt = 0;
    let backgroundState = [];

    function cleanupPlayAgain(){
      if(playAgainHandler && againBtn){
        againBtn.removeEventListener('click', playAgainHandler);
        playAgainHandler = null;
      }
    }

    function focusableElements(){
      return Array.from(panel.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'))
        .filter(el => !el.disabled && !el.closest('[hidden], [inert]') && el.tabIndex >= 0 && el.getClientRects().length);
    }

    function handleKeydown(event){
      // Keep game shortcuts from consuming letters while the dialog is open.
      event.stopImmediatePropagation();
      if(event.key === 'Escape'){
        event.preventDefault();
        hide();
      } else if(event.key === 'Tab'){
        const targets = focusableElements();
        const first = targets[0] || panel;
        const last = targets[targets.length - 1] || panel;
        const active = document.activeElement;
        if(!targets.length || !targets.includes(active) || (event.shiftKey && active === first) || (!event.shiftKey && active === last)){
          event.preventDefault();
          safeFocus(event.shiftKey ? last : first, true);
        }
      }
    }

    function containFocus(event){
      if(!panel.contains(event.target)) safeFocus(panel, true);
    }

    function disableBackground(){
      if(backgroundState.length) return;
      backgroundState = Array.from(document.body.children)
        .filter(el => el !== overlay)
        .map(el => ({ el, inert: el.inert }));
      backgroundState.forEach(({ el }) => { el.inert = true; });
    }

    function restoreBackground(){
      backgroundState.forEach(({ el, inert }) => { el.inert = inert; });
      backgroundState = [];
    }

    function hide(opts = {}){
      if(!overlay.classList.contains('is-active')) return;
      const { focusTarget } = opts;
      overlay.classList.remove('is-active');
      disableAbsoluteOverlay();
      overlay.style.removeProperty('display');
      overlay.style.removeProperty('visibility');
      overlay.setAttribute('aria-hidden', 'true');
      panel.setAttribute('aria-hidden', 'true');
      body.innerHTML = '';
      document.body.classList.remove('game-has-overlay');
      document.removeEventListener('keydown', handleKeydown, true);
      document.removeEventListener('focusin', containFocus);
      restoreBackground();
      cleanupPlayAgain();
      openedAt = 0;

      const storedFocusTarget = storedOptions && storedOptions.focusTarget ? storedOptions.focusTarget : null;
      const target = focusTarget || storedFocusTarget || lastActiveElement;
      const onDismiss = storedOptions && storedOptions.onDismiss;

      storedOptions = null;
      lastActiveElement = null;

      if(typeof onDismiss === 'function'){
        onDismiss();
      }

      if(target && typeof target.focus === 'function'){
        requestAnimationFrame(()=>safeFocus(target, true));
      }
    }

    function checkFixedSupport(){
      if(typeof window === 'undefined' || typeof document === 'undefined') return true;
      if(!document.body || typeof document.body.appendChild !== 'function') return true;
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:10px;left:10px;width:10px;height:10px;z-index:-1;';
      document.body.appendChild(probe);
      let supported = true;
      if(typeof probe.getBoundingClientRect === 'function'){
        const rect = probe.getBoundingClientRect();
        supported = Math.abs(rect.top - 10) < 0.5;
      }
      document.body.removeChild(probe);
      return supported;
    }

    function updateAbsoluteOverlay(){
      if(!overlay) return;
      const docEl = document.documentElement || {};
      const bodyEl = document.body || {};

      let scrollY = 0;
      if(typeof window.pageYOffset === 'number'){
        scrollY = window.pageYOffset;
      } else if(typeof window.scrollY === 'number'){
        scrollY = window.scrollY;
      } else if(typeof docEl.scrollTop === 'number'){
        scrollY = docEl.scrollTop;
      } else if(typeof bodyEl.scrollTop === 'number'){
        scrollY = bodyEl.scrollTop;
      }

      let scrollX = 0;
      if(typeof window.pageXOffset === 'number'){
        scrollX = window.pageXOffset;
      } else if(typeof window.scrollX === 'number'){
        scrollX = window.scrollX;
      } else if(typeof docEl.scrollLeft === 'number'){
        scrollX = docEl.scrollLeft;
      } else if(typeof bodyEl.scrollLeft === 'number'){
        scrollX = bodyEl.scrollLeft;
      }

      const viewportHeight = typeof window.innerHeight === 'number'
        ? window.innerHeight
        : (docEl.clientHeight || bodyEl.clientHeight || overlay.offsetHeight || 0);
      const viewportWidth = typeof window.innerWidth === 'number'
        ? window.innerWidth
        : (docEl.clientWidth || bodyEl.clientWidth || overlay.offsetWidth || 0);
      overlay.style.top = `${scrollY}px`;
      overlay.style.left = `${scrollX}px`;
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
      overlay.style.width = viewportWidth ? `${viewportWidth}px` : '';
      overlay.style.height = viewportHeight ? `${viewportHeight}px` : '';
      if(panel){
        panel.style.marginLeft = 'auto';
        panel.style.marginRight = 'auto';
      }
      if(panel && viewportHeight){
        const panelHeight = panel.offsetHeight || 0;
        const padding = Math.max((viewportHeight - panelHeight) / 2, 24);
        overlay.style.paddingTop = `${padding}px`;
        overlay.style.paddingBottom = `${padding}px`;
        const maxPanelHeight = Math.max(viewportHeight - 48, 200);
        panel.style.maxHeight = `${maxPanelHeight}px`;
      }
    }

    function enableAbsoluteOverlay(){
      if(absoluteMode) return;
      absoluteMode = true;
      overlay.classList.add('overlay-no-fixed');
      overlay.style.position = 'absolute';
      overlay.style.display = 'block';
      updateAbsoluteOverlay();
      absoluteUpdateHandler = ()=>{
        updateAbsoluteOverlay();
      };
      window.addEventListener('scroll', absoluteUpdateHandler);
      window.addEventListener('resize', absoluteUpdateHandler);
    }

    function disableAbsoluteOverlay(){
      if(!absoluteMode) return;
      absoluteMode = false;
      overlay.classList.remove('overlay-no-fixed');
      if(absoluteUpdateHandler){
        window.removeEventListener('scroll', absoluteUpdateHandler);
        window.removeEventListener('resize', absoluteUpdateHandler);
        absoluteUpdateHandler = null;
      }
      overlay.style.removeProperty('position');
      overlay.style.removeProperty('top');
      overlay.style.removeProperty('left');
      overlay.style.removeProperty('right');
      overlay.style.removeProperty('bottom');
      overlay.style.removeProperty('width');
      overlay.style.removeProperty('height');
      overlay.style.removeProperty('padding-top');
      overlay.style.removeProperty('padding-bottom');
      if(panel){
        panel.style.removeProperty('margin-left');
        panel.style.removeProperty('margin-right');
        panel.style.removeProperty('max-height');
      }
    }

    function safeFocus(element, preventScroll){
      if(!element || typeof element.focus !== 'function') return;
      try {
        if(preventScroll){
          element.focus({ preventScroll: true });
          return;
        }
      } catch(_) {
        /* ignore option unsupported */
      }
      element.focus();
    }

    overlay.addEventListener('click', event=>{
      if(event.target === overlay){
        if(openedAt && Date.now() - openedAt < 240){
          return;
        }
        hide();
      }
    });

    for(let i = 0; i < dismissers.length; i++){
      const btn = dismissers[i];
      if(btn){
        btn.addEventListener('click', ()=>hide());
      }
    }

    function show(options = {}){
      if(!overlay.classList.contains('is-active')){
        lastActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      storedOptions = options;
      overlay.classList.add('is-active');
      openedAt = Date.now();
      overlay.style.display = supportsFixedPosition ? 'flex' : 'block';
      overlay.style.visibility = 'visible';
      overlay.setAttribute('aria-hidden', 'false');
      panel.setAttribute('aria-hidden', 'false');
      document.body.classList.add('game-has-overlay');
      body.innerHTML = options.content || '';

      const hasPlayAgain = typeof options.onPlayAgain === 'function';
      const playAgainLabel = options.playAgainLabel || 'Play again';
      if(hasPlayAgain && againBtn){
        if(actions) actions.style.display = '';
        againBtn.style.display = '';
        againBtn.textContent = playAgainLabel;
        cleanupPlayAgain();
        playAgainHandler = ()=>{
          hide({ focusTarget: options.focusTarget });
          options.onPlayAgain();
        };
        againBtn.addEventListener('click', playAgainHandler);
      } else {
        cleanupPlayAgain();
        if(againBtn) againBtn.style.display = 'none';
        if(actions) actions.style.display = 'none';
      }

      disableBackground();
      document.addEventListener('keydown', handleKeydown, true);
      document.addEventListener('focusin', containFocus);
      if(!supportsFixedPosition){
        enableAbsoluteOverlay();
      } else {
        disableAbsoluteOverlay();
      }
      requestAnimationFrame(()=>{
        if(!overlay.classList.contains('is-active')) return;
        if(!supportsFixedPosition){
          updateAbsoluteOverlay();
        }
        const usePlayAgain = options.initialFocus === 'playAgain' && hasPlayAgain && againBtn && againBtn.style.display !== 'none';
        if(usePlayAgain){
          safeFocus(againBtn, true);
        } else {
          safeFocus(panel, true);
        }
      });
    }

    window.GameCelebration = {
      show,
      hide,
      isOpen: ()=>overlay.classList.contains('is-active')
    };
  })();
