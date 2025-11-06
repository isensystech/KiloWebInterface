
// ============================================================================
// ======== Import required functions from ui-buttons
// ======== import { initializeSafetyCaps, initializeButtons } from './ui-buttons.js';

// ======= console.log('DOM loaded, initializing application');

// ======= document.addEventListener('DOMContentLoaded', () => {
    
// ======= console.log('Initializing safety caps and buttons');
// =======   initializeSafetyCaps();
// =======  initializeButtons();
    
    // Initialize AP toggle modal
// =======   initializeAPToggle();
    
    // Initialize Helm toggle modal
// =======   initializeHelmToggle();
// ======= }); 








console.log('DOM loaded, initializing application');

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing modals');

  initializeAPToggle();
  initializeHelmToggle();
});





// ============================================================================
// MODAL ACTIVE HELM PANEL //
// ============================================================================

        document.addEventListener("DOMContentLoaded", () => {
            const toggleBtn = document.getElementById("helm-toggle");                 // The main button that opens the modal
            const modal = document.getElementById("helm-modal");                     // The modal element
            const modeButtons = modal.querySelectorAll(".ap-mode-btn");             // All mode buttons inside the modal
            const helmValues = modal.querySelectorAll(".helm-display-value");       // All display value elements in the modal

            // When the main button is clicked → open the modal
            toggleBtn.addEventListener("click", () => {
                modal.style.display = "block";                                       // Show the modal

                const currentMode = toggleBtn.dataset.currentMode;                   // Get the current mode (stored in dataset)

                // Highlight the active mode button
                modeButtons.forEach(btn => {
                    if (btn.dataset.mode === currentMode) {
                        btn.classList.add("active");
                    } else {
                        btn.classList.remove("active");
                    }
                });
            });


            // Default to "Robot" on first load if no mode set yet
            if (!toggleBtn.dataset.currentMode) {
            toggleBtn.dataset.currentMode = 'Auto';   // "Auto" is treated as "Robot"
            toggleBtn.textContent = 'Robot';          // reflect on the toggle button

            // highlight "Robot" row in the modal
            helmValues.forEach(el => {
                const isRobot = el.textContent.trim() === 'Robot';
                el.style.color = isRobot ? '#ffffff' : '#757575';
                el.style.fontWeight = isRobot ? '600' : '500';
            });
            }



            // When a mode button is clicked inside the modal
            modeButtons.forEach(btn => {
                btn.addEventListener("click", () => {
                    const selectedMode = btn.dataset.mode;
                    const isRobot = selectedMode === "Auto";                         // Treat "Auto" as "Robot"

                    // Update the main button text based on selected mode
                    toggleBtn.textContent = isRobot ? "Robot" : selectedMode;
                    toggleBtn.dataset.currentMode = selectedMode;                    // Store selected mode in the main button

                    // Update display block appearance: highlight "Robot" only
                    helmValues.forEach(el => {
                        if (isRobot && el.textContent.trim() === "Robot") {
                            el.style.color = "#ffffff";
                            el.style.fontWeight = "600";
                        } else {
                            el.style.color = "#757575";
                            el.style.fontWeight = "500";
                        }
                    });

                    // Update the active button style
                    modeButtons.forEach(button => {
                        button.classList.remove("active");                           // Remove previous active state
                    });
                    btn.classList.add("active");                                     // Set active class to clicked button

                    // Close the modal
                    modal.style.display = "none";
                });
            });
        });


// ============================================================================
// MODAL AUTO PILOT PANEL (id-only logic)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('ap-toggle');          // main AP toggle button
  const modal     = document.getElementById('auto-pilot-modal');    // AP modal window
  if (!toggleBtn || !modal) return; // guard

  // Collect buttons by explicit ids; classes are only for styling
  const modes = [
    { id: 'ap-mode-manual', el: null, mode: 'Manual' },
    { id: 'ap-mode-hold',   el: null, mode: 'Hold'   },
    { id: 'ap-mode-auto',   el: null, mode: 'Auto'   },
    { id: 'ap-mode-loiter', el: null, mode: 'Loiter' },
    { id: 'ap-mode-acro',   el: null, mode: 'Acro'   },
    { id: 'ap-mode-rtl',    el: null, mode: 'RTL'    },
  ];

  // Resolve elements by id
  modes.forEach(m => { m.el = document.getElementById(m.id); });

  // Helper: mark active by class for visuals (logic still uses ids)
  function setActiveMode(modeName) {
    modes.forEach(m => m.el && m.el.classList.toggle('active', m.mode === modeName));
  }

  // Open/close modal (keep your working display logic)
  function openModal() {
    modal.style.display = 'block';
    const current = toggleBtn.dataset.currentMode || toggleBtn.textContent.trim();
    setActiveMode(current);
  }
  function closeModal() {
    modal.style.display = 'none';
  }

  // Open modal from main button
  toggleBtn.addEventListener('click', openModal);

  // Bind clicks to each mode button via its id
  modes.forEach(m => {
    if (!m.el) return;
    m.el.addEventListener('click', () => {
      const selected = m.mode;

      // Update main button text + data
      toggleBtn.textContent = selected;
      toggleBtn.dataset.currentMode = selected;

      // Visual state
      setActiveMode(selected);

      // Close modal
      closeModal();
    });
  });

  // Backdrop & ESC close
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
});







// ============================================================================
// TRIM MODAL (Manual open/close - gamepad controls content)
// ============================================================================
window.openTrimModal = function() {
    const backdrop = document.getElementById("trim-modal-backdrop");
    const container = document.getElementById("trim-modal-container");
    
    if (backdrop && container) {
        backdrop.style.display = "block";
        container.style.display = "block";
    }
};

window.applyTrimSettings = function() {
    const backdrop = document.getElementById("trim-modal-backdrop");
    const container = document.getElementById("trim-modal-container");
    
    if (backdrop && container) {
        backdrop.style.display = "none";
        container.style.display = "none";
    }
};






// ============================================================================
// INFO MODAL
// ============================================================================


// = ANIMATION INFO = //

// Delay after modal opens before starting GIF
const START_DELAY_MS       = 500;   // start delay
// Fallback GIF duration if data-gif-duration is missing
const GIF_DURATION_FALLBACK= 4800;  // full GIF length in ms
// How much earlier SVG starts fading in before GIF ends
const CROSSFADE_OVERLAP_MS = 600;   // overlap window (bigger = earlier SVG)
// Fade duration for both layers (keep in sync with CSS if set there)
const FADE_MS              = 600;   // crossfade duration
// Small safety lead to start fade slightly before theoretical end
const EXTRA_TAIL_MS        = 120;   // compensates decode/refresh jitter

// = ANIMATION (GIF + SVG layered crossfade) =
const INFO_PLACEHOLDER_SRC =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

function ensureFadeTransitions(gifEl, logoEl){
  const t = `opacity ${FADE_MS}ms ease`;
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
  const GIF_MS  = Number.isFinite(dataDur) ? dataDur : GIF_DURATION_FALLBACK;

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
      const startAt = Math.max(0, GIF_MS - CROSSFADE_OVERLAP_MS - EXTRA_TAIL_MS);
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
      gifEl.src = INFO_PLACEHOLDER_SRC; // placeholder keeps layout
      gifEl.style.opacity = '0';
    }
    if (logoEl){
      logoEl.style.opacity = '0';
    }

    clearTimeout(startDelayTimer);
    startDelayTimer = setTimeout(() => {
      playGifWithCrossfade();
    }, START_DELAY_MS);
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
      gifEl.src = INFO_PLACEHOLDER_SRC;
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
// HELP MODAL (stable build)
// ============================================================================

/* Config: external tooltip document */
const COACH_DATA_URL = 'tooltips.html';

/* State */
let TOUR_STEPS = [];          // populated from tooltips.html
let coachDataReady = null;    // single-flight guard

// Load + parse tooltips.html into TOUR_STEPS
async function loadCoachSteps() {
  if (coachDataReady) return coachDataReady;
  coachDataReady = (async () => {
    const res = await fetch(COACH_DATA_URL, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Failed to load ${COACH_DATA_URL}: ${res.status}`);
    const html = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const entries = Array.from(doc.querySelectorAll('#coach-data [data-coach-for]'));

    const steps = entries.map(el => {
      // title (prefer .coach-title, fallback h1–h6)
      const titleEl = el.querySelector('.coach-title') || el.querySelector('h1,h2,h3,h4,h5,h6');
      const title   = (titleEl?.textContent || '').trim();

      // BODY (HTML): take all .coach-text blocks as is
      const bodyHtmlParts = Array.from(el.querySelectorAll('.coach-text'))
        .map(n => n.outerHTML.trim())
        .filter(Boolean);
      const bodyHtml = bodyHtmlParts.join('\n');

      // TEXT fallback (for screen readers, etc.)
      const bodyTextParts = Array.from(el.querySelectorAll('.coach-text'))
        .map(n => n.textContent.trim())
        .filter(Boolean);
      const bodyText = bodyTextParts.join('\n\n');

      const text = title && bodyText ? `${title}\n\n${bodyText}` : (title || bodyText);

      // FINAL HTML that will be injected into tooltip
      const htmlContent = [
        titleEl ? `<div class="coach-title">${titleEl.textContent.trim()}</div>` : '',
        bodyHtml
      ].filter(Boolean).join('\n');

      return {
        selector: el.getAttribute('data-coach-for') || '',
        text,                 // plain text (fallback)
        html: htmlContent,    // rich HTML (preferred)
        placement: el.getAttribute('data-coach-placement') || 'bottom',
        allowInteract: (el.getAttribute('data-coach-interact') || 'false') === 'true',
        order: Number(el.getAttribute('data-coach-order') || '0'),
      };
    });

    steps.sort((a, b) => (a.order - b.order) || a.selector.localeCompare(b.selector));
    TOUR_STEPS = steps;
  })();
  return coachDataReady;
}



/* Allow-list (click-through) */
const COACH_GLOBAL_ALLOW_SELECTORS = [
  '.status-bar',
  '.drawer-tab',
  '.boat-image',
];

/* Check if element (or ancestor) is allowed to receive clicks */
function isCoachAllowedTarget(el) {
  if (!el || !el.closest) return false;

  const viaAttr = el.closest('[data-coach-allow]');
  if (viaAttr) {
    const mode = (viaAttr.getAttribute('data-coach-allow') || 'click').toLowerCase();
    return mode === 'click' || mode === 'all';
  }
  for (const sel of COACH_GLOBAL_ALLOW_SELECTORS) {
    if (el.closest(sel)) return true;
  }
  return false;
}

/* Synthesize a full click sequence */
function synthesizeClickSequence(target, originEvent) {
  const base = { bubbles: true, cancelable: true, view: window };
  const opts = originEvent
    ? { ...base, clientX: originEvent.clientX, clientY: originEvent.clientY }
    : base;
  target.dispatchEvent(new MouseEvent('mousedown', opts));
  target.dispatchEvent(new MouseEvent('mouseup',   opts));
  target.dispatchEvent(new MouseEvent('click',     opts));
}

/* === Runtime === */
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
  let activeEl = null;      // active step target
  let hoverEl  = null;      // hovered step target
  let rafHoverId = 0;       // rAF throttle
  let combinedSelectors = '';

  /* Spotlight helpers (CSS variables drive the mask hole) */
  function setSpotlightByRect(r){
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;
    const rad = Math.sqrt(r.width*r.width + r.height*r.height) / 2 + 16;
    mask.style.setProperty('--x', `${cx}px`);
    mask.style.setProperty('--y', `${cy}px`);
    mask.style.setProperty('--r', `${rad}px`);
  }
  function setSpotlightForElement(el){
    if (!el) return;
    setSpotlightByRect(el.getBoundingClientRect());
  }

  /* Hit-test under overlay; ignore tooltip box if present */
  function elementUnderPoint(x, y){
    const prevOverlay = overlay.style.pointerEvents;
    const prevMask    = mask?.style.pointerEvents;
    const prevTip     = tip ? tip.style.pointerEvents : null;
    try{
      overlay.style.pointerEvents = 'none';
      if (mask) mask.style.pointerEvents = 'none';
      if (tip)  tip.style.pointerEvents  = 'none';
      return document.elementFromPoint(x, y);
    } finally {
      overlay.style.pointerEvents = prevOverlay;
      if (mask) mask.style.pointerEvents = prevMask || '';
      if (tip && prevTip !== null) tip.style.pointerEvents = prevTip;
    }
  }

  function matchStepIndexByElement(el){
    if (!el || !el.closest) return -1;
    for (let i = 0; i < TOUR_STEPS.length; i++){
      if (el.closest(TOUR_STEPS[i].selector)) return i;
    }
    return -1;
  }




  // --- Add near your runtime vars (reuse existing 'overlay' and 'tip') ---
let coachPeWasDisabled = false;

// --- NEW: pointerdown-capture handler that opens a "gate" through the tooltip ---
function onOverlayPointerDownCapture(e) {
  // 1) Allow tooltip controls to work normally
  if (e.target.closest('.coach-controls, .coach-close')) return;

  // 2) If pointer is inside the tooltip box (not on controls) — open pass-through gate
  if (tip) {
    const r = tip.getBoundingClientRect();
    const insideTip = (e.clientX >= r.left && e.clientX <= r.right &&
                       e.clientY >= r.top  && e.clientY <= r.bottom);
    if (insideTip) {
      // Temporarily disable overlay pointer-events until pointerup/click
      if (!coachPeWasDisabled) {
        coachPeWasDisabled = true;
        overlay.style.pointerEvents = 'none'; // let native events go through
        // Restore on the first pointerup or click (whichever happens)
        const restore = () => {
          overlay.style.pointerEvents = '';
          coachPeWasDisabled = false;
          window.removeEventListener('pointerup', restore, true);
          window.removeEventListener('click', restore, true);
        };
        window.addEventListener('pointerup', restore, true);
        window.addEventListener('click', restore, true);
      }
      return;
    }
  }
}







  /* Place tooltip near the given element */
  function placeTooltip(anchorEl, placement, text){
    if (!anchorEl) return;
    tipText.innerHTML  = text;

    const r = anchorEl.getBoundingClientRect();
    const gap = 32;
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
    tx = Math.max(12, Math.min(vw - tw - 12, tx));
    ty = Math.max(12, Math.min(vh - th - 12, ty));
    tip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
  }



async function renderStep(){
  if (!TOUR_STEPS.length) return;
  const step = TOUR_STEPS[idx];
  const target = document.querySelector(step.selector);
  if (!target){
    idx = (idx + 1) % TOUR_STEPS.length;
    return renderStep();
  }

  // --- NEW: make sure any parent modal for this target is visible
  await ensureParentModalVisible(target);

  // Give the browser a frame to compute correct rects after modal opens
  await new Promise(r => requestAnimationFrame(r));

  if (activeEl && activeEl !== hoverEl) activeEl.classList.remove('coach-glow');
  activeEl = target;
  activeEl.classList.add('coach-glow');

  setSpotlightForElement(activeEl);
  mask.classList.remove('hole-clickthrough'); // keep Help non-interactive by default

  placeTooltip(activeEl, step.placement, step.html);

  btnPrev.disabled = (TOUR_STEPS.length <= 1);
  btnNext.textContent = 'Next';
}






  /* Render active step (tooltip + spotlight on active only) */
  function renderStep(){
    if (!TOUR_STEPS.length) return;
    const step = TOUR_STEPS[idx];
    const target = document.querySelector(step.selector);
    if (!target){
      idx = (idx + 1) % TOUR_STEPS.length;
      return renderStep();
    }

    if (activeEl && activeEl !== hoverEl) activeEl.classList.remove('coach-glow');
    activeEl = target;
    activeEl.classList.add('coach-glow');

    setSpotlightForElement(activeEl);
    mask.classList.remove('hole-clickthrough'); // no click-through in Help

    placeTooltip(activeEl, step.placement, step.html);

    btnPrev.disabled = (TOUR_STEPS.length <= 1);
    btnNext.textContent = 'Next';
  }

  function next(){ idx = (idx + 1) % TOUR_STEPS.length; renderStep(); }
  function prev(){ idx = (idx - 1 + TOUR_STEPS.length) % TOUR_STEPS.length; renderStep(); }

  /* Hover: pointer on allow-list OR tour targets; tooltip stays on active */
  function onOverlayMouseMove(e){
    if (rafHoverId) return;
    rafHoverId = requestAnimationFrame(() => {
      rafHoverId = 0;
      if (overlay.hidden) return;

      const under = elementUnderPoint(e.clientX, e.clientY);
      const candidate = combinedSelectors ? under?.closest?.(combinedSelectors) : null;

      const allowed = isCoachAllowedTarget(under) || !!candidate;
      if (mask) mask.style.cursor = allowed ? 'pointer' : '';

      if (!TOUR_STEPS.length || !combinedSelectors) return;

      const activeStep = TOUR_STEPS[idx];
      const currentActive = document.querySelector(activeStep.selector);
      if (!currentActive) return;

      if (candidate){
        if (hoverEl && hoverEl !== candidate) hoverEl.classList.remove('coach-glow');
        if (candidate !== currentActive) {
          candidate.classList.add('coach-glow');
          hoverEl = candidate;
        } else {
          if (hoverEl && hoverEl !== currentActive) hoverEl.classList.remove('coach-glow');
          hoverEl = null;
        }
        placeTooltip(currentActive, activeStep.placement, activeStep.html);
        return;
      }

      if (hoverEl && hoverEl !== currentActive) hoverEl.classList.remove('coach-glow');
      hoverEl = null;
      placeTooltip(currentActive, activeStep.placement, activeStep.html);
    });
  }


  
  /* Click: pass-through for allow-list; otherwise step selection */
  function onOverlayClick(e){
    if (e.target.closest('.coach-tooltip')) return;

    const under = elementUnderPoint(e.clientX, e.clientY);

    if (isCoachAllowedTarget(under)) {
      synthesizeClickSequence(under, e);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const newIdx = matchStepIndexByElement(under);
    if (newIdx >= 0){
      if (hoverEl && hoverEl !== activeEl) hoverEl.classList.remove('coach-glow');
      hoverEl = null;
      idx = newIdx;
      renderStep();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
  }

  /* Keyboard */
  function onKey(e){
    if (e.key === 'Escape') return closeTour();
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n') return next();
    if (e.key === 'ArrowLeft'  || e.key.toLowerCase() === 'p') return prev();
  }

  /* Open/Close */
  async function openTour(startIndex=0){
    await loadCoachSteps();
    combinedSelectors = TOUR_STEPS.map(s => s.selector).join(',');

    idx = (startIndex >= 0 && startIndex < TOUR_STEPS.length) ? startIndex : 0;
    overlay.hidden = false;
    renderStep();

    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', renderStep);
    overlay.addEventListener('mousemove', onOverlayMouseMove);
    overlay.addEventListener('click', onOverlayClick);
    overlay.addEventListener('pointerdown', onOverlayPointerDownCapture, true); // capture phase

  }

function closeTour(){
  overlay.hidden = true;
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', renderStep);
  overlay.removeEventListener('mousemove', onOverlayMouseMove);
  overlay.removeEventListener('click', onOverlayClick);

  if (rafHoverId) { cancelAnimationFrame(rafHoverId); rafHoverId = 0; }

  if (hoverEl && hoverEl !== activeEl) hoverEl.classList.remove('coach-glow');
  if (activeEl) activeEl.classList.remove('coach-glow');
  hoverEl = null; activeEl = null;

  // --- NEW: restore any modals we force-opened
  if (coachForcedOpenModals.has('#trim-modal-container')) {
    const container = document.getElementById('trim-modal-container');
    const backdrop  = document.getElementById('trim-modal-backdrop');
    if (container) container.style.display = 'none';
    if (backdrop)  backdrop.style.display  = 'none';
    coachForcedOpenModals.delete('#trim-modal-container');
  }
}


  /* Warm cache after DOM ready (optional) */
  document.addEventListener('DOMContentLoaded', () => {
    loadCoachSteps().catch(() => {});
  });

  trigger.addEventListener('click', () => openTour(0));
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);
  btnClose.addEventListener('click', closeTour);

  
 

})();
