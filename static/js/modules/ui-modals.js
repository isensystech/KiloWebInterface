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
