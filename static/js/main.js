import { gamepadControlState } from './modules/gamepad-handler.js';

// ============================================================================
// WEBSOCKET SENDER - ONLY PLACE GAMEPAD DATA IS SENT
// ============================================================================

// TUNABLE PARAMETERS
const GAMEPAD_MESSAGE_INTERVAL = 1000; // milliseconds (1000ms = 1 second)

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Starting gamepad WebSocket sender");
    
    setInterval(() => {
        if (window.ws && window.ws.readyState === WebSocket.OPEN) {
            const message = {
                type: "gamepad.set",
                throttle: gamepadControlState.throttle,
                steering: gamepadControlState.steering,
                engine_trim: gamepadControlState.engine_trim,
                port_trim: gamepadControlState.port_trim,
                starboard_trim: gamepadControlState.starboard_trim
            };
            
            window.ws.send(JSON.stringify(message));
        }
    }, GAMEPAD_MESSAGE_INTERVAL);
});

// ============================================================================
// DRAWER PANEL SCROLLING WITH GAMEPAD (OPTIONAL)
// ============================================================================
let drawerScrollGamepadIndex = null;
let backButtonPressed = false;
let forwardButtonPressed = false;

window.addEventListener("gamepadconnected", (event) => {
    if (drawerScrollGamepadIndex === null) {
        drawerScrollGamepadIndex = event.gamepad.index;
    }
});

window.addEventListener("gamepaddisconnected", (event) => {
    if (event.gamepad.index === drawerScrollGamepadIndex) {
        drawerScrollGamepadIndex = null;
    }
});

function pollDrawerScroll() {
    if (drawerScrollGamepadIndex !== null) {
        const gamepad = navigator.getGamepads()[drawerScrollGamepadIndex];
        if (gamepad) {
            const backPressed = gamepad.buttons[8]?.pressed || false;
            const forwardPressed = gamepad.buttons[9]?.pressed || false;
            
            const drawerPanel = document.querySelector('.drawer-panel');
            if (drawerPanel) {
                if (backPressed && !backButtonPressed) {
                    drawerPanel.scrollBy({ left: -200, behavior: 'smooth' });
                    backButtonPressed = true;
                } else if (!backPressed) {
                    backButtonPressed = false;
                }
                
                if (forwardPressed && !forwardButtonPressed) {
                    drawerPanel.scrollBy({ left: 200, behavior: 'smooth' });
                    forwardButtonPressed = true;
                } else if (!forwardPressed) {
                    forwardButtonPressed = false;
                }
            }
        }
    }

    requestAnimationFrame(pollDrawerScroll);
}

pollDrawerScroll();

// ============================================================================
// MODAL PANEL DOCKER
// ============================================================================
function dockModalToDrawer(modal, opts = {}){
    const drawer = document.querySelector(opts.drawerSelector ?? '.drawer-panel');
    if (!modal || !drawer) return;

    const gap = Number(opts.gap ?? 0);

    const dr = drawer.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    const bottom = Math.max(0, vh - dr.bottom);
    const placeToRight = dr.left <= vw / 2;

    modal.classList.add('is-docked');
    modal.style.bottom = `${bottom}px`;
    modal.style.maxHeight = `${dr.height}px`;

    if (placeToRight){
        modal.style.left = `${Math.round(dr.right + gap)}px`;
        modal.style.right = 'auto';
    } else {
        modal.style.right = `${Math.round(vw - dr.left + gap)}px`;
        modal.style.left = 'auto';
    }
}

function setupDocking(modalSelector, opts = {}){
    const modal = document.querySelector(modalSelector);
    if(!modal) return;

    const redraw = () => dockModalToDrawer(modal, opts);

    window.addEventListener('resize', redraw);

    const drawer = document.querySelector(opts.drawerSelector ?? '.drawer-panel');
    if (drawer && 'ResizeObserver' in window){
        const ro = new ResizeObserver(redraw);
        ro.observe(drawer);
    }

    const mo = new MutationObserver(() => { if (modal.classList.contains('is-open')) redraw(); });
    mo.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });

    redraw();
}

setupDocking('#helm-modal', { gap: 4 });
setupDocking('#auto-pilot-modal', { gap: 4 });

window.requestStatus = () => {}; // no-op placeholder

// ===== ANIMATION INFO MODAL ===== //

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

// ===== ANIMATION (GIF + SVG layered crossfade) =====
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


// ===== INFO MODAL =====
// ===== INFO MODAL (hooks) =====
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






// ===== HELP MODAL ===== //


// === DATA-DRIVEN TOUR ===
// Each step points to an existing UI element by CSS selector
const TOUR_STEPS = [
  {
    selector: '#info-trigger',
    text: 'Open the Info modal to see vessel details.',
    placement: 'right',         // top|right|bottom|left
    allowInteract: true         // allow click on the target (e.g., open modal)
  },
  {
    selector: '#help-trigger',
    text: 'This toggles Help mode with tips across screens.',
    placement: 'bottom',
    allowInteract: false
  },
  {
    selector: '#helm-toggle',   // пример существующей кнопки
    text: 'Helm panel: manual/autopilot switching.',
    placement: 'top',
    allowInteract: true
  }
];

// === RUNTIME ===
(() => {
  const trigger = document.getElementById('help-trigger');
  const overlay = document.getElementById('coach-overlay');
  const mask    = overlay.querySelector('.coach-mask');
  const tip     = overlay.querySelector('.coach-tooltip');
  const tipText = overlay.querySelector('.coach-text');
  const btnPrev = overlay.querySelector('.coach-prev');
  const btnNext = overlay.querySelector('.coach-next');
  const btnClose= overlay.querySelector('.coach-close');

  if (!trigger || !overlay) return;

  let idx = 0;

  // Open the tour
  function openTour(startIndex=0){
    idx = startIndex;
    overlay.hidden = false;
    renderStep();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', renderStep);
  }

  // Close the tour
  function closeTour(){
    overlay.hidden = true;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', renderStep);
  }

  // Keyboard navigation
  function onKey(e){
    if (e.key === 'Escape') return closeTour();
    if (e.key.toLowerCase() === 'n' || e.key === 'ArrowRight') next();
    if (e.key.toLowerCase() === 'p' || e.key === 'ArrowLeft')  prev();
  }

  function next(){ if (idx < TOUR_STEPS.length - 1){ idx++; renderStep(); } else { closeTour(); } }
  function prev(){ if (idx > 0){ idx--; renderStep(); } }

  // Core: position spotlight + tooltip near the target
  function renderStep(){
    const step = TOUR_STEPS[idx];
    const target = document.querySelector(step.selector);
    if (!target){
      // If missing, skip to next
      console.warn('[Tour] Target not found:', step.selector);
      return next();
    }

    const r = target.getBoundingClientRect();

    // Spotlight center + radius
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const rad = Math.sqrt((r.width*r.width + r.height*r.height))/2 + 16; // padding

    // Set CSS vars for the mask
    mask.style.setProperty('--x', `${cx}px`);
    mask.style.setProperty('--y', `${cy}px`);
    mask.style.setProperty('--r', `${rad}px`);

    // Allow/deny clicking through the hole
    mask.classList.toggle('hole-clickthrough', !!step.allowInteract);

    // Tooltip text
    tipText.textContent = step.text;

    // Place tooltip around the target
    const gap = 12; // distance from target
    const tw = tip.offsetWidth || 300;  // rough width before first paint
    const th = tip.offsetHeight || 80;  // rough height
    let tx = cx, ty = cy;

    // Simple placement logic
    switch(step.placement){
      case 'top':    tx = cx - tw/2; ty = r.top - th - gap;      break;
      case 'right':  tx = r.right + gap; ty = cy - th/2;         break;
      case 'bottom': tx = cx - tw/2; ty = r.bottom + gap;        break;
      case 'left':   tx = r.left - tw - gap; ty = cy - th/2;     break;
      default:       tx = cx - tw/2; ty = r.bottom + gap;
    }

    // Keep inside viewport (basic clamping)
    const vw = window.innerWidth, vh = window.innerHeight;
    tx = Math.max(12, Math.min(vw - tw - 12, tx));
    ty = Math.max(12, Math.min(vh - th - 12, ty));

    tip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;

    // Controls state
    btnPrev.disabled = idx === 0;
    btnNext.textContent = (idx === TOUR_STEPS.length - 1) ? 'Finish' : 'Next';
  }

  // Wire up
  trigger.addEventListener('click', () => openTour(0));
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);
  btnClose.addEventListener('click', closeTour);

  // Optional: close when clicking dark area (not the hole/tooltip)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTour();
  });
})();
