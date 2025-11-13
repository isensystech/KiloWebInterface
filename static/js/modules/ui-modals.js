// ============================================================================
// CONFIGURATION
// ============================================================================
const MODAL_CONFIG = Object.freeze({
    // Delay between opening the info modal and replaying the GIF
    infoStartDelayMs: 500,
    // Fallback GIF length when no duration metadata exists
    infoGifDurationFallbackMs: 4800,
    // How early the SVG overlay begins fading in before GIF end
    infoCrossfadeOverlapMs: 600,
    // Crossfade transition duration for GIF/SVG layers
    infoFadeMs: 600,
    // Safety pad so the fade starts just before the theoretical GIF end
    infoExtraTailMs: 120,
    // Transparent data URI used so layout does not jump while GIF reloads
    infoPlaceholderDataUri: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
    // Geometry for the coach overlay tooltip + spotlight
    coachTooltipGapPx: 32,
    coachTooltipMarginPx: 12,
    coachSpotlightPaddingPx: 16
});

// ============================================================================
// AP (AUTOPILOT) TOGGLE MODAL
// ============================================================================
export function initializeAPToggle() {
    const apToggleBtn = document.getElementById('ap-toggle');
    const apModal = document.getElementById('auto-pilot-modal');
    const apModeButtons = apModal?.querySelectorAll('.ap-mode-btn');
    
    if (!apToggleBtn || !apModal) {
        console.warn('AP toggle elements not found');
        return;
    }

    const openModal = () => {
        apModal.removeAttribute('hidden');
        apModal.style.display = 'block';
        apModal.classList.add('is-open');
    };

    const closeModal = () => {
        apModal.setAttribute('hidden', '');
        apModal.style.display = 'none';
        apModal.classList.remove('is-open');
    };
    
    apToggleBtn.addEventListener('click', openModal);
    
    apModeButtons?.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedMode = btn.dataset.mode;
            
            apToggleBtn.textContent = selectedMode;
            apToggleBtn.dataset.currentMode = selectedMode;
            
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                const message = {
                    type: "ap.set_mode",
                    mode: selectedMode
                };
                window.ws.send(JSON.stringify(message));
                console.log('Sent AP mode:', selectedMode);
            }
            
            apModeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            closeModal();
        });
    });
    
    apModal.addEventListener('click', (e) => {
        if (e.target === apModal) {
            closeModal();
        }
    });
}

// ============================================================================
// HELM TOGGLE MODAL
// ============================================================================
export function initializeHelmToggle() {
    const helmToggleBtn = document.getElementById('helm-toggle');
    const helmModal = document.getElementById('helm-modal');
    const helmDisplays = helmModal?.querySelectorAll('.helm-display');
    
    if (!helmToggleBtn || !helmModal) {
        console.warn('Helm toggle elements not found');
        return;
    }

    const openModal = () => {
        helmModal.removeAttribute('hidden');
        helmModal.style.display = 'block';
        helmModal.classList.add('is-open');
    };

    const closeModal = () => {
        helmModal.setAttribute('hidden', '');
        helmModal.style.display = 'none';
        helmModal.classList.remove('is-open');
    };
    
    helmToggleBtn.addEventListener('click', openModal);
    
    helmDisplays?.forEach(display => {
        display.addEventListener('click', () => {
            const label = display.querySelector('.helm-display-value');
            if (!label) return;
            const selectedHelm = label.textContent.trim();
            
            helmToggleBtn.textContent = selectedHelm;
            helmToggleBtn.dataset.selectedHelm = selectedHelm;
            
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                const message = {
                    type: "helm.set",
                    helm: selectedHelm
                };
                window.ws.send(JSON.stringify(message));
                console.log('Sent Helm selection:', selectedHelm);
            }
            
            closeModal();
        });
    });
    
    helmModal.addEventListener('click', (e) => {
        if (e.target === helmModal) {
            closeModal();
        }
    });
}

// ============================================================================
// TRIM MODAL (Manual open/close - gamepad controls content)
// ============================================================================
export function openTrimModal() {
    const backdrop = document.getElementById("trim-modal-backdrop");
    const container = document.getElementById("trim-modal-container");
    
    if (backdrop && container) {
        backdrop.style.display = "block";
        container.style.display = "block";
    }
};
// Still attaching to window for legacy onclick="" in index.html
window.openTrimModal = openTrimModal;

export function applyTrimSettings() {
    const backdrop = document.getElementById("trim-modal-backdrop");
    const container = document.getElementById("trim-modal-container");
    
    if (backdrop && container) {
        backdrop.style.display = "none";
        container.style.display = "none";
    }
};
// Still attaching to window for legacy onclick="" in index.html
window.applyTrimSettings = applyTrimSettings;


// ============================================================================
// INFO MODAL
// ============================================================================


function ensureFadeTransitions(gifEl, logoEl){
  const t = `opacity ${MODAL_CONFIG.infoFadeMs}ms ease`;
  // Set inline transitions only if none defined in CSS
  if (gifEl && !gifEl.style.transition)  gifEl.style.transition  = t;
  if (logoEl && !logoEl.style.transition) logoEl.style.transition = t;
}

function playGifWithCrossfade(){
  const gifEl  = document.getElementById('info-gif');
  const logoEl = document.getElementById('info-logo');
  if (!gifEl || !logoEl) return;

  // Read duration from data-attribute, fallback if absent
  const dataDur = gifEl.dataset.gifDuration ? parseInt(gifEl.dataset.gifDuration, 10) : null;
  const GIF_MS  = Number.isFinite(dataDur) ? dataDur : MODAL_CONFIG.infoGifDurationFallbackMs;

  // Cleanup any previous timers/listeners
  clearTimeout(gifEl._xfadeTimer);
  clearTimeout(gifEl._startTimer);
  gifEl.onload = null;

  // Initial visual states
  gifEl.style.opacity  = '0'; // hidden (space reserved by CSS aspect-ratio)
  logoEl.style.opacity = '0'; // svg hidden, will fade in later

  // Make sure both layers have the same fade timing
  ensureFadeTransitions(gifEl, logoEl);

  // Bust cache to truly restart GIF
  const busted = `${gifEl.dataset.gif}?t=${Date.now()}`;
  gifEl.onload = () => {
    // Wait for decode to avoid flash of first frame
    gifEl.decode?.().catch(()=>{}).finally(() => {
      // Fade GIF in
      requestAnimationFrame(() => { gifEl.style.opacity = '1'; });

      // Schedule crossfade: start SVG before GIF "ends"
      const startAt = Math.max(0, GIF_MS - MODAL_CONFIG.infoCrossfadeOverlapMs - MODAL_CONFIG.infoExtraTailMs);
      gifEl._xfadeTimer = setTimeout(() => {
        // Overlap: SVG fades in while GIF fades out
        requestAnimationFrame(() => {
          logoEl.style.opacity = '1'; // fade in svg (top layer)
          gifEl.style.opacity  = '0'; // fade out gif (bottom layer)
        });
      }, startAt);
    });
  };

  // Kick off GIF loading
  gifEl.src = busted;
}


// = INFO MODAL (hooks) =
(function(){
  const trigger  = document.getElementById('info-trigger');
  const modal    = document.getElementById('info-modal');
  const backdrop = document.getElementById('info-backdrop');
  const closeBtn = modal ? modal.querySelector('.info-modal-close') : null;

  if (!trigger || !modal || !backdrop || !closeBtn) {
    console.warn('[InfoModal] Missing required elements.');
    return;
  }

  let startDelayTimer = null;

  function openModal(){
    modal.hidden = false;
    backdrop.hidden = false;
    closeBtn.focus({ preventScroll:true });

    const gifEl  = document.getElementById('info-gif');
    const logoEl = document.getElementById('info-logo');

    // Reset to a clean state each open
    if (gifEl){
      clearTimeout(gifEl._xfadeTimer);
      clearTimeout(gifEl._startTimer);
      gifEl.src = MODAL_CONFIG.infoPlaceholderDataUri; // placeholder keeps layout
      gifEl.style.opacity = '0';
    }
    if (logoEl){
      logoEl.style.opacity = '0';
    }

    clearTimeout(startDelayTimer);
    startDelayTimer = setTimeout(() => {
      playGifWithCrossfade();
    }, MODAL_CONFIG.infoStartDelayMs);
  }

  function closeModal(){
    modal.hidden = true;
    backdrop.hidden = true;

    clearTimeout(startDelayTimer);

    const gifEl  = document.getElementById('info-gif');
    const logoEl = document.getElementById('info-logo');
    if (gifEl){
      clearTimeout(gifEl._xfadeTimer);
      clearTimeout(gifEl._startTimer);
      gifEl.src = MODAL_CONFIG.infoPlaceholderDataUri;
      gifEl.style.opacity = '0';
    }
    if (logoEl){
      logoEl.style.opacity = '0';
    }

    trigger?.focus({ preventScroll:true });
  }

  trigger.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (!modal.hidden && e.key === 'Escape') closeModal();
  });
})();








// ============================================================================
// HELP MODAL
// ============================================================================


// = DATA-DRIVEN TOUR =
// Each step points to an existing UI element by CSS selector
// Automatically collect all elements with data-coach-text
const TOUR_STEPS = Array.from(document.querySelectorAll('[data-coach-text]')).map(el => ({
  selector: `#${el.id}`,
  text: el.dataset.coachText,
  placement: el.dataset.coachPlacement || 'bottom',
  allowInteract: el.dataset.coachInteract === 'true'
}));


// === RUNTIME ===
(() => {
  const trigger = document.getElementById('help-trigger');
  const overlay = document.getElementById('coach-overlay');
  const mask    = overlay?.querySelector('.coach-mask');
  const tip     = overlay?.querySelector('.coach-tooltip');
  const tipText = overlay?.querySelector('.coach-text');
  const btnPrev = overlay?.querySelector('.coach-prev');
  const btnNext = overlay?.querySelector('.coach-next');
  const btnClose= overlay?.querySelector('.coach-close');

  if (!trigger || !overlay || !mask || !tip || !tipText || !btnPrev || !btnNext || !btnClose) return;

  let idx = 0;

  // Track elements separately for active step vs. hover preview
  let activeEl = null;
  let hoverEl  = null;
  const coachForcedOpenModals = new Set();

  // Spotlight geometry
  let holeCx = 0, holeCy = 0, holeR = 0;

  const combinedSelectors = TOUR_STEPS.map(s => s.selector).join(',');

  // --- spotlight helpers ---
  function setSpotlightByRect(r){
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;
    const rad = Math.sqrt(r.width*r.width + r.height*r.height) / 2 + MODAL_CONFIG.coachSpotlightPaddingPx;
    holeCx = cx; holeCy = cy; holeR = rad;
    mask.style.setProperty('--x', `${cx}px`);
    mask.style.setProperty('--y', `${cy}px`);
    mask.style.setProperty('--r', `${rad}px`);
  }
  function setSpotlightForElement(el){
    if (!el) return;
    setSpotlightByRect(el.getBoundingClientRect());
  }

  // --- safe hit-test under overlay+mask ---
  function elementUnderPoint(x, y){
    const prevOverlay = overlay.style.pointerEvents;
    const prevMask    = mask.style.pointerEvents;
    try{
      overlay.style.pointerEvents = 'none';
      mask.style.pointerEvents    = 'none';
      return document.elementFromPoint(x, y);
    } finally {
      overlay.style.pointerEvents = prevOverlay;
      mask.style.pointerEvents    = prevMask;
    }
  }

  function matchStepIndexByElement(el){
    if (!el || !el.closest) return -1;
    for (let i = 0; i < TOUR_STEPS.length; i++){
      if (el.closest(TOUR_STEPS[i].selector)) return i;
    }
    return -1;
  }

  function isElementHidden(el){
    if (!el) return true;
    if (el.hidden) return true;
    const computedDisplay = window.getComputedStyle(el).display;
    return computedDisplay === 'none';
  }

  function ensureParentModalVisible(target){
    let openedModal = false;
    const trimContainer = document.getElementById('trim-modal-container');
    if (trimContainer && trimContainer.contains(target) && isElementHidden(trimContainer)) {
      coachForcedOpenModals.add('#trim-modal-container');
      if (typeof openTrimModal === 'function') {
        openTrimModal();
      } else {
        const trimBackdrop = document.getElementById('trim-modal-backdrop');
        if (trimBackdrop) trimBackdrop.style.display = 'block';
        trimContainer.style.display = 'block';
      }
      openedModal = true;
    }
    return openedModal;
  }

  // --- render active step (tooltip + spotlight on active only) ---
  async function renderStep(){
    const step = TOUR_STEPS[idx];
    const target = document.querySelector(step.selector);
    if (!target){
      idx = (idx + 1) % TOUR_STEPS.length;
      return renderStep();
    }

    const parentOpened = ensureParentModalVisible(target);
    if (parentOpened) {
      await new Promise(r => requestAnimationFrame(r));
    }

    // Update active glow (keep hover glow separate)
    if (activeEl && activeEl !== hoverEl) activeEl.classList.remove('coach-glow');
    activeEl = target;
    activeEl.classList.add('coach-glow');

    // Spotlight locks to ACTIVE step here
    setSpotlightForElement(activeEl);
    mask.classList.remove('hole-clickthrough'); // no click-through in Help

    placeTooltip(activeEl, step.placement, step.text);
    btnPrev.disabled = (TOUR_STEPS.length <= 1);
    btnNext.textContent = 'Next'; // always loops
  }

  // --- navigation (loop) ---
  function next(){ idx = (idx + 1) % TOUR_STEPS.length; renderStep(); }
  function prev(){ idx = (idx - 1 + TOUR_STEPS.length) % TOUR_STEPS.length; renderStep(); }

 // --- hover: move ONLY tooltip to hovered candidate; spotlight stays on active ---
let rafHover = 0;
function onOverlayMouseMove(e){
  if (rafHover) return;
  rafHover = requestAnimationFrame(() => {
    rafHover = 0;

    const under      = elementUnderPoint(e.clientX, e.clientY);
    const candidate  = under?.closest?.(combinedSelectors) || null;
    const activeStep = TOUR_STEPS[idx];
    const activeEl   = document.querySelector(activeStep.selector);

    if (candidate){
      const candIdx = matchStepIndexByElement(candidate);
      const step    = candIdx >= 0 ? TOUR_STEPS[candIdx] : null;

      // optional: soft glow on hover 
      if (hoverEl && hoverEl !== candidate) hoverEl.classList.remove('coach-glow');
      if (candidate !== activeEl) { candidate.classList.add('coach-glow'); hoverEl = candidate; }
      else { if (hoverEl && hoverEl !== activeEl) hoverEl.classList.remove('coach-glow'); hoverEl = null; }

      // move ONLY tooltip to hovered element; keep current step text or show hovered text
      const text = step ? step.text : tipText.textContent;
      placeTooltip(candidate, step ? step.placement : activeStep.placement, text);
      return;
    }

    // no candidate under cursor: restore tooltip to ACTIVE element
    if (hoverEl && hoverEl !== activeEl) hoverEl.classList.remove('coach-glow');
    hoverEl = null;
    placeTooltip(activeEl, activeStep.placement, activeStep.text);
    // spotlight remains where renderStep
  });
}

function placeTooltip(element, placement, text) {
  if (!element || !tip || !tipText) return;
  tipText.textContent = text;
  
  const r = element.getBoundingClientRect();
  const gap = MODAL_CONFIG.coachTooltipGapPx;
  const tw = tip.offsetWidth || 300;
  const th = tip.offsetHeight || 80;
  const cx = r.left + r.width / 2;
  const cy = r.top  + r.height / 2;
  
  let tx, ty;
  switch(placement){
    case 'top':    tx = cx - tw/2; ty = r.top - th - gap;  break;
    case 'right':  tx = r.right + gap; ty = cy - th/2;     break;
    case 'bottom': tx = cx - tw/2; ty = r.bottom + gap;    break;
    case 'left':   tx = r.left - tw - gap; ty = cy - th/2; break;
    default:       tx = cx - tw/2; ty = r.bottom + gap;
  }
  
  const vw = innerWidth, vh = innerHeight;
  const margin = MODAL_CONFIG.coachTooltipMarginPx;
  tx = Math.max(margin, Math.min(vw - tw - margin, tx));
  ty = Math.max(margin, Math.min(vh - th - margin, ty));
  tip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
}


  // --- click: activate hovered candidate (do NOT forward click) ---
  function onOverlayClick(e){
    if (e.target.closest('.coach-tooltip')) return; // ignore UI

    const under  = elementUnderPoint(e.clientX, e.clientY);
    const newIdx = matchStepIndexByElement(under);
    if (newIdx >= 0){
      // clear transient hover glow (active will re-add its own)
      if (hoverEl && hoverEl !== activeEl) hoverEl.classList.remove('coach-glow');
      hoverEl = null;

      idx = newIdx;
      renderStep(); // tooltip + spotlight jump to the selected step
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // empty area: block underlying
    e.preventDefault();
    e.stopPropagation();
  }

  // --- keyboard ---
  function onKey(e){
    if (e.key === 'Escape') return closeTour();
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n') return next();
    if (e.key === 'ArrowLeft'  || e.key.toLowerCase() === 'p') return prev();
  }

  // --- open/close ---
  function openTour(startIndex=0){
    idx = (startIndex >= 0 && startIndex < TOUR_STEPS.length) ? startIndex : 0;
    overlay.hidden = false;
    renderStep();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', renderStep);
    overlay.addEventListener('mousemove', onOverlayMouseMove);
    overlay.addEventListener('click', onOverlayClick);
  }

  function closeTour(){
    overlay.hidden = true;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', renderStep);
    overlay.removeEventListener('mousemove', onOverlayMouseMove);
    overlay.removeEventListener('click', onOverlayClick);
    if (hoverEl && hoverEl !== activeEl) hoverEl.classList.remove('coach-glow');
    if (activeEl) activeEl.classList.remove('coach-glow');
    hoverEl = null; activeEl = null;

    if (coachForcedOpenModals.has('#trim-modal-container')) {
      applyTrimSettings();
      coachForcedOpenModals.delete('#trim-modal-container');
    }
  }

  trigger.addEventListener('click', () => openTour(0));
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);
  btnClose.addEventListener('click', closeTour);
})();








// ============================================================================
// JOYSTICK MODAL 
// ============================================================================

(function initJoystickModal() {
  // Guard double init
  if (window.__joystickModalInit) return;
  window.__joystickModalInit = true;

  // Grab elements
  const trigger   = document.getElementById('joystick-trigger');
  const modal     = document.getElementById('joystick-modal');
  const backdrop  = document.getElementById('joystick-backdrop');
  const closeBtn  = modal?.querySelector('.info-modal-close');
  if (!trigger || !modal || !backdrop || !closeBtn) return;

  let lastFocused = null;

  // Utility: get focusable nodes inside dialog
  function getFocusable(container) {
    // Keep the list tight to avoid surprises
    const sel = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(container.querySelectorAll(sel))
      .filter(el => el.offsetParent !== null || el === container);
  }

  // Open modal
  function openModal() {
    // Save last focused element to restore later
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Show elements
    backdrop.hidden = false;
    modal.hidden = false;

    // ARIA flags
    modal.setAttribute('aria-hidden', 'false');

    // Prevent page scroll while modal is open
    document.documentElement.style.overflow = 'hidden';

    // Focus first focusable, else dialog itself
    const focusables = getFocusable(modal);
    const first = focusables[0] || modal;
    // Ensure dialog can receive focus
    if (modal.getAttribute('tabindex') == null) modal.setAttribute('tabindex', '-1');
    first.focus({ preventScroll: true });

    // Attach listeners
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('focus', trapFocus, true);
  }

  // Close modal
  function closeModal() {
    // Hide elements
    modal.hidden = true;
    backdrop.hidden = true;

    // ARIA flags
    modal.setAttribute('aria-hidden', 'true');

    // Restore page scroll
    document.documentElement.style.overflow = '';

    // Detach listeners
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('focus', trapFocus, true);

    // Restore focus to trigger
    if (lastFocused && document.contains(lastFocused)) {
      try { lastFocused.focus({ preventScroll: true }); } catch (_) {}
    } else {
      try { trigger.focus({ preventScroll: true }); } catch (_) {}
    }
  }

  // Keyboard handlers
  function onKeydown(e) {
    // ESC to close
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    // Basic Tab focus trap
    if (e.key === 'Tab') {
      const focusables = getFocusable(modal);
      if (focusables.length === 0) {
        e.preventDefault();
        modal.focus();
        return;
      }
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Focus trap for clicks that move focus out
  function trapFocus(e) {
    if (modal.hidden) return;
    if (!modal.contains(e.target)) {
      e.stopPropagation();
      const focusables = getFocusable(modal);
      (focusables[0] || modal).focus({ preventScroll: true });
    }
  }

  // Wire up triggers
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  });

  // Close by backdrop click
  backdrop.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });

  // Close button
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });

  // Optional: open with Enter/Space when trigger is focused (img may not be focusable by default)
  if (trigger.getAttribute('tabindex') == null) trigger.setAttribute('tabindex', '0');
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal();
    }
  });

  // Expose API in case other modules want to control it
  window.openJoystickModal = openModal;   // eslint-disable-line no-attach
  window.closeJoystickModal = closeModal; // eslint-disable-line no-attach
})();



// ============================================================================
// JOYSTICK BUTTON SETTINGS (solo3-style)
// - Mirrors your solo3 buttons UI
// - Persists to localStorage
// - Restores on modal open
// - Emits 'joystick:configChanged' on change
// ============================================================================

(function initJoystickButtonSettings() {
  // Prevent double init
  if (window.__joystickButtonSettingsInit) return;
  window.__joystickButtonSettingsInit = true;

  const STORAGE_KEY = 'joystickPrefs';
  const ALLOWED = new Set(['springy', 'sticky', 'pilot-hold']);
  const DEFAULTS = { throttle: 'springy', steering: 'springy' };

  // --- storage helpers ---
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const obj = JSON.parse(raw);
      const throttle = ALLOWED.has(obj?.throttle) ? obj.throttle : DEFAULTS.throttle;
      const steering = ALLOWED.has(obj?.steering) ? obj.steering : DEFAULTS.steering;
      return { throttle, steering };
    } catch {
      return { ...DEFAULTS };
    }
  }
  function savePrefs(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
  }
  function emitChanged(p) {
    window.dispatchEvent(new CustomEvent('joystick:configChanged', { detail: { ...p } }));
  }

  // --- UI helpers ---
  function setActive(groupEl, mode) {
    if (!groupEl) return;
    const btns = groupEl.querySelectorAll('.solo3-btn');
    btns.forEach(b => b.classList.remove('active'));
    const target = Array.from(btns).find(b => b.dataset.mode === mode) || btns[0];
    if (target) target.classList.add('active');
  }
  function getActive(groupEl) {
    const active = groupEl?.querySelector('.solo3-btn.active');
    const mode = active?.dataset.mode;
    return ALLOWED.has(mode) ? mode : null;
  }

  // --- apply prefs to UI ---
  function applyToUI(prefs) {
    setActive(document.getElementById('js-throttle-toggle'), prefs.throttle);
    setActive(document.getElementById('js-steering-toggle'), prefs.steering);
  }

  // --- bind click logic (scoped to our groups) ---
  function bindGroup(groupId, key) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.solo3-btn');
      if (!btn || !group.contains(btn)) return;
      // Update active styles
      group.querySelectorAll('.solo3-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Persist & broadcast
      const prefs = loadPrefs();
      prefs[key] = btn.dataset.mode;
      savePrefs(prefs);
      emitChanged(prefs);
    });
  }

  // --- ensure UI refresh on modal open ---
  function hookModalOpen() {
    const applyOnOpen = () => applyToUI(loadPrefs());
    if (typeof window.openJoystickModal === 'function') {
      const orig = window.openJoystickModal;
      window.openJoystickModal = function patchedOpen() {
        applyOnOpen();
        return orig.apply(this, arguments);
      };
    } else {
      // Fallback: watch hidden attribute
      const modal = document.getElementById('joystick-modal');
      if (modal) {
        const obs = new MutationObserver(() => {
          if (modal.hidden === false) applyOnOpen();
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['hidden'] });
      }
    }
  }

  // --- init once ---
  bindGroup('js-throttle-toggle', 'throttle');
  bindGroup('js-steering-toggle', 'steering');
  applyToUI(loadPrefs());
  hookModalOpen();

  // Optional: expose a getter for other modules
  window.getJoystickPrefs = function getJoystickPrefs() { return loadPrefs(); };
})();





// ============================================================================
// TRIM TAB & ANCHOR MODALS
// ============================================================================
export function initializeTrimTabModal() {
    const trigger = document.getElementById('trimtab-modal');
    const backdrop = document.getElementById('trimtab-modal-backdrop');
    const container = document.getElementById('trimtab-modal-container');
    const modalWindow = container?.querySelector('.editor-modal-window');

    if (!trigger || !backdrop || !container || !modalWindow) {
        console.warn('Trim Tab modal elements not found');
        return;
    }

    const open = () => {
        backdrop.style.display = 'block';
        container.style.display = 'block';
    };
    const close = () => {
        backdrop.style.display = 'none';
        container.style.display = 'none';
    };

    trigger.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    container.addEventListener('click', (event) => {
        if (!modalWindow.contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && container.style.display === 'block') close();
    });

    window.trimTabApplySettings = function trimTabApplySettings() {
        close();
    };

    initializeTrimtabSliders();
    initializeTrimtabGyro();
}

export function initializeAnchorModal() {
    const trigger = document.getElementById('anchor-modal');
    const backdrop = document.getElementById('anchor-modal-backdrop');
    const container = document.getElementById('anchor-modal-container');
    const modalWindow = container?.querySelector('.editor-modal-window');

    if (!trigger || !backdrop || !container || !modalWindow) {
        console.warn('Anchor modal elements not found');
        return;
    }

    const open = () => {
        backdrop.style.display = 'block';
        container.style.display = 'block';
    };
    const close = () => {
        backdrop.style.display = 'none';
        container.style.display = 'none';
    };

    trigger.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    container.addEventListener('click', (event) => {
        if (!modalWindow.contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && container.style.display === 'block') close();
    });

    window.anchorApplySettings = function anchorApplySettings() {
        close();
    };

    initializeAnchorSlider();
}

let trimtabSlidersInitialized = false;
function initializeTrimtabSliders() {
    if (trimtabSlidersInitialized) return;
    const overlays = document.querySelectorAll('.trimtab-slider-overlay');
    if (!overlays.length) return;
    trimtabSlidersInitialized = true;

    const STEP = 5;
    overlays.forEach((root) => {
        const track = root.querySelector('.trimtab-track-bg');
        const fill = root.querySelector('.trimtab-track-fill');
        const thumb = root.querySelector('.trimtab-thumb');
        const upButton = root.querySelector('.throttle-up');
        const downButton = root.querySelector('.throttle-down');
        if (!track || !fill || !thumb) return;

        fill.style.top = '0';
        fill.style.bottom = 'auto';

        const applyFromTopPct = (pct) => {
            const clamped = Math.max(0, Math.min(100, pct));
            thumb.style.top = clamped + '%';
            fill.style.height = clamped + '%';
        };

        const getTopPct = () => {
            const value = parseFloat(thumb.style.top);
            return Number.isFinite(value) ? value : 50;
        };

        const moveUp = () => applyFromTopPct(getTopPct() - STEP);
        const moveDown = () => applyFromTopPct(getTopPct() + STEP);

        upButton?.addEventListener('click', (event) => {
            event.preventDefault();
            moveUp();
        });
        downButton?.addEventListener('click', (event) => {
            event.preventDefault();
            moveDown();
        });

        const pointToTopPct = (clientY) => {
            const rect = track.getBoundingClientRect();
            let rel = (clientY - rect.top) / rect.height;
            rel = Math.max(0, Math.min(1, rel));
            return rel * 100;
        };

        const onMoveMouse = (event) => applyFromTopPct(pointToTopPct(event.clientY));
        const onMoveTouch = (event) => {
            event.preventDefault();
            applyFromTopPct(pointToTopPct(event.touches[0].clientY));
        };

        const endDrag = () => {
            document.removeEventListener('mousemove', onMoveMouse);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchmove', onMoveTouch);
            document.removeEventListener('touchend', endDrag);
        };

        const startDrag = (event) => {
            event.preventDefault();
            if (event.touches) {
                onMoveTouch(event);
            } else {
                onMoveMouse(event);
            }
            document.addEventListener('mousemove', onMoveMouse);
            document.addEventListener('mouseup', endDrag, { once: true });
            document.addEventListener('touchmove', onMoveTouch, { passive: false });
            document.addEventListener('touchend', endDrag, { once: true });
        };

        thumb.addEventListener('mousedown', startDrag);
        thumb.addEventListener('touchstart', startDrag, { passive: false });
        track.addEventListener('mousedown', startDrag);
        track.addEventListener('touchstart', startDrag, { passive: false });

        applyFromTopPct(getTopPct());
    });
}

let trimtabGyroInitialized = false;
function initializeTrimtabGyro() {
    if (trimtabGyroInitialized) return;
    const boat = document.getElementById('gyro-boat');
    const leftButton = document.getElementById('gyro-left');
    const rightButton = document.getElementById('gyro-right');
    const angleLabel = document.getElementById('gyro-angle');
    if (!boat || !leftButton || !rightButton || !angleLabel) return;
    trimtabGyroInitialized = true;

    const clamp = (value) => Math.max(-35, Math.min(35, value));
    let angle = 0;
    const STEP = 1;

    const applyAngle = () => {
        boat.style.transform = `rotate(${angle}deg)`;
        angleLabel.textContent = `${angle}°`;
    };

    const startHold = (direction) => {
        if (startHold.timer) return;
        startHold.timer = setInterval(() => {
            angle = clamp(angle + direction * STEP);
            applyAngle();
        }, 60);
    };

    const stopHold = () => {
        clearInterval(startHold.timer);
        startHold.timer = null;
    };

    leftButton.addEventListener('click', (event) => {
        event.preventDefault();
        angle = clamp(angle - STEP);
        applyAngle();
    });
    rightButton.addEventListener('click', (event) => {
        event.preventDefault();
        angle = clamp(angle + STEP);
        applyAngle();
    });

    leftButton.addEventListener('mousedown', () => startHold(-1));
    rightButton.addEventListener('mousedown', () => startHold(1));
    document.addEventListener('mouseup', stopHold);

    leftButton.addEventListener('touchstart', (event) => {
        event.preventDefault();
        startHold(-1);
    }, { passive: false });
    rightButton.addEventListener('touchstart', (event) => {
        event.preventDefault();
        startHold(1);
    }, { passive: false });
    document.addEventListener('touchend', stopHold);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
            angle = clamp(angle - STEP);
            applyAngle();
        }
        if (event.key === 'ArrowRight') {
            angle = clamp(angle + STEP);
            applyAngle();
        }
    });

    applyAngle();
}

let anchorSliderInitialized = false;
function initializeAnchorSlider() {
    if (anchorSliderInitialized) return;
    const thumb = document.getElementById('anchor-thumb');
    const fill = document.getElementById('anchor-fill');
    const readout = document.getElementById('anchor-readout');
    const track = document.querySelector('.anchor-track-bg');
    const upButton = document.getElementById('anchor-throttle-up');
    const downButton = document.getElementById('anchor-throttle-down');
    if (!thumb || !fill || !track) return;
    anchorSliderInitialized = true;

    fill.style.bottom = 'auto';
    fill.style.top = '0';

    const applyFromTopPct = (value) => {
        const pct = Math.max(0, Math.min(100, value));
        thumb.style.top = `${pct}%`;
        fill.style.height = `${pct}%`;

        const percent = 1 - (pct / 100);
        if (readout) {
            const raw = Math.round((1 - percent) * 14) + 1;
            readout.textContent = Math.max(1, Math.min(15, raw));
        }
    };

    const getTopPct = () => {
        const value = parseFloat(thumb.style.top);
        return Number.isFinite(value) ? value : 50;
    };

    const STEP = 5;
    const moveUp = () => applyFromTopPct(getTopPct() - STEP);
    const moveDown = () => applyFromTopPct(getTopPct() + STEP);

    upButton?.addEventListener('click', (event) => {
        event.preventDefault();
        moveUp();
    });
    downButton?.addEventListener('click', (event) => {
        event.preventDefault();
        moveDown();
    });

    const pointToTopPct = (clientY) => {
        const rect = track.getBoundingClientRect();
        let rel = (clientY - rect.top) / rect.height;
        rel = Math.max(0, Math.min(1, rel));
        return rel * 100;
    };

    const onMoveMouse = (event) => applyFromTopPct(pointToTopPct(event.clientY));
    const onMoveTouch = (event) => {
        event.preventDefault();
        applyFromTopPct(pointToTopPct(event.touches[0].clientY));
    };

    const stopDrag = () => {
        document.removeEventListener('mousemove', onMoveMouse);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onMoveTouch);
        document.removeEventListener('touchend', stopDrag);
    };

    const startDrag = (event) => {
        event.preventDefault();
        if (event.touches) {
            onMoveTouch(event);
        } else {
            onMoveMouse(event);
        }
        document.addEventListener('mousemove', onMoveMouse);
        document.addEventListener('mouseup', stopDrag, { once: true });
        document.addEventListener('touchmove', onMoveTouch, { passive: false });
        document.addEventListener('touchend', stopDrag, { once: true });
    };

    thumb.addEventListener('mousedown', startDrag);
    thumb.addEventListener('touchstart', startDrag, { passive: false });
    track.addEventListener('mousedown', startDrag);
    track.addEventListener('touchstart', startDrag, { passive: false });

    applyFromTopPct(getTopPct());
}

