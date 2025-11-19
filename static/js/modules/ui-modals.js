import { gamepadControlState } from './gamepad-handler.js';

const AP_MODE_VALUES = Object.freeze(['Manual', 'Crewed', 'Hold', 'Auto', 'Loiter', 'Acro', 'RTH']);
const AP_MODE_ALIASES = Object.freeze({ rtl: 'RTH' });

function normalizeApMode(mode) {
    if (typeof mode !== 'string') return null;
    const trimmed = mode.trim();
    if (!trimmed) return null;
    const alias = AP_MODE_ALIASES[trimmed.toLowerCase()];
    if (alias) return alias;
    const matched = AP_MODE_VALUES.find(
        (value) => value.toLowerCase() === trimmed.toLowerCase()
    );
    return matched || trimmed;
}

// Attach a transient outside-click handler that closes a modal until the modal deactivates
function queueOutsideDismiss(modalEl, triggerEl, getCurrentDetach, setDetach, onDismiss) {
    if (!modalEl || typeof onDismiss !== 'function') return;
    if (typeof getCurrentDetach === 'function') {
        const existing = getCurrentDetach();
        if (typeof existing === 'function') existing();
    }

    const handler = (event) => {
        const target = event.target;
        // Ignore if click is inside modal or on its trigger
        if (modalEl.contains(target) || target === triggerEl) return;
        onDismiss();
    };

    // Capture early so we catch clicks that might stop propagation later
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('touchstart', handler, true);

    setDetach(() => {
        document.removeEventListener('mousedown', handler, true);
        document.removeEventListener('touchstart', handler, true);
    });
}

// ============================================================================
// CONFIGURATION
// ============================================================================
const MODAL_CONFIG = Object.freeze({
    infoStartDelayMs: 500, // ms between opening the info modal and replaying the GIF
    infoGifDurationFallbackMs: 4800, // fallback GIF length when metadata is missing (ms)
    infoCrossfadeOverlapMs: 600, // lead time before GIF end to start SVG fade (ms)
    infoFadeMs: 600, // duration of the crossfade transition (ms)
    infoExtraTailMs: 120, // buffer to ensure fade starts before GIF completes (ms)
    infoPlaceholderDataUri: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", // transparent placeholder image
    coachTooltipGapPx: 32, // px gap between spotlight and tooltip card
    coachTooltipMarginPx: 12, // px margin around tooltip container
    coachSpotlightPaddingPx: 16 // px padding inside spotlight mask
});

// ============================================================================
// AP (AUTOPILOT) TOGGLE MODAL
// ============================================================================
export function initializeAPToggle() {
    const apToggleBtn = document.getElementById('ap-toggle');
    const apModal = document.getElementById('auto-pilot-modal');
    const apModeButtons = apModal?.querySelectorAll('.ap-mode-btn');
    let detachOutsideListener = null;
    
    if (!apToggleBtn || !apModal) {
        console.warn('AP toggle elements not found');
        return;
    }

    const openModal = () => {
        apModal.removeAttribute('hidden');
        apModal.style.display = 'block';
        apModal.classList.add('is-open');
        queueOutsideDismiss(apModal, apToggleBtn, () => detachOutsideListener, (cleanup) => { detachOutsideListener = cleanup; }, closeModal);
    };

    const closeModal = () => {
        apModal.setAttribute('hidden', '');
        apModal.style.display = 'none';
        apModal.classList.remove('is-open');
        if (typeof detachOutsideListener === 'function') {
            detachOutsideListener();
            detachOutsideListener = null;
        }
    };
    
    const updateApModeDisplay = (mode) => {
        const normalizedMode = normalizeApMode(mode) || normalizeApMode(apToggleBtn?.dataset.currentMode) || 'Manual';

        if (apToggleBtn && normalizedMode) {
            apToggleBtn.textContent = normalizedMode;
            apToggleBtn.dataset.currentMode = normalizedMode;
        }

        apModeButtons?.forEach(btn => {
            const btnMode = normalizeApMode(btn.dataset.mode);
            const isActive = normalizedMode && btnMode && btnMode === normalizedMode;
            btn.classList.toggle('active', Boolean(isActive));
        });
    };

    window.__kiloSetApModeDisplay = updateApModeDisplay;

    const initialMode = normalizeApMode(window.__kiloLatestApMode) 
        || normalizeApMode(apToggleBtn.dataset.currentMode) 
        || normalizeApMode(apToggleBtn.textContent);
    updateApModeDisplay(initialMode);

    apToggleBtn.addEventListener('click', openModal);
    
    apModeButtons?.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedMode = btn.dataset.mode;
            updateApModeDisplay(selectedMode);
            
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                const message = {
                    type: "apstatus.set",
                    mode: selectedMode
                };
                window.ws.send(JSON.stringify(message));
                console.log('Sent AP mode:', selectedMode);
            }
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
    let detachOutsideListener = null;
    
    if (!helmToggleBtn || !helmModal) {
        console.warn('Helm toggle elements not found');
        return;
    }

    const openModal = () => {
        helmModal.removeAttribute('hidden');
        helmModal.style.display = 'block';
        helmModal.classList.add('is-open');
        queueOutsideDismiss(helmModal, helmToggleBtn, () => detachOutsideListener, (cleanup) => { detachOutsideListener = cleanup; }, closeModal);
    };

    const closeModal = () => {
        helmModal.setAttribute('hidden', '');
        helmModal.style.display = 'none';
        helmModal.classList.remove('is-open');
        if (typeof detachOutsideListener === 'function') {
            detachOutsideListener();
            detachOutsideListener = null;
        }
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
  const PREF_ENDPOINT = '/api/joystick-prefs';

  // --- storage helpers ---
  function normalizeMode(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.toLowerCase().replace(/_/g, '-');
    return ALLOWED.has(normalized) ? normalized : null;
  }

  function readLocalPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const throttle = normalizeMode(obj?.throttle);
      const steering = normalizeMode(obj?.steering);
      if (!throttle && !steering) return null;
      return {
        throttle: throttle || DEFAULTS.throttle,
        steering: steering || DEFAULTS.steering
      };
    } catch {
      return null;
    }
  }

  function sanitizeSessionPrefs(raw) {
    if (!raw) return null;
    const throttle = normalizeMode(raw.throttle);
    const steering = normalizeMode(raw.steering);
    if (!throttle && !steering) return null;
    return {
      throttle: throttle || DEFAULTS.throttle,
      steering: steering || DEFAULTS.steering
    };
  }

  function loadPrefs() {
    const local = readLocalPrefs();
    if (local) return { ...local };
    const sessionPrefs = sanitizeSessionPrefs(window.__joystickSessionPrefs);
    if (sessionPrefs) return { ...sessionPrefs };
    return { ...DEFAULTS };
  }

  function savePrefs(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
  }
  function emitChanged(p) {
    window.dispatchEvent(new CustomEvent('joystick:configChanged', { detail: { ...p } }));
  }
  function syncPrefsToServer(p) {
    if (typeof fetch !== 'function') return;
    try {
      fetch(PREF_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(p)
      }).catch(() => {});
    } catch {
      // Ignore network errors
    }
  }
  function persistPrefs(p, { syncServer = true } = {}) {
    const payload = {
      throttle: normalizeMode(p.throttle) || DEFAULTS.throttle,
      steering: normalizeMode(p.steering) || DEFAULTS.steering
    };
    savePrefs(payload);
    emitChanged(payload);
    if (syncServer) syncPrefsToServer(payload);
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
      const value = normalizeMode(btn.dataset.mode);
      if (!value) return;
      prefs[key] = value;
      persistPrefs(prefs);
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

  window.addEventListener('session:status', (event) => {
    const sessionPrefs = sanitizeSessionPrefs(event?.detail?.joystick_prefs);
    if (!sessionPrefs) return;
    if (readLocalPrefs()) return;
    persistPrefs(sessionPrefs, { syncServer: false });
    applyToUI(sessionPrefs);
  });

  // Optional: expose a getter for other modules
  window.getJoystickPrefs = function getJoystickPrefs() { return loadPrefs(); };
})();





// ============================================================================
// TRIM TAB & ANCHOR MODALS
// ============================================================================
function ensureModalDetachedFromDrawer(backdrop, container) {
    if (!backdrop && !container) return;
    const fragment = document.createDocumentFragment();
    if (backdrop && backdrop.parentElement !== document.body) {
        fragment.appendChild(backdrop);
    }
    if (container && container.parentElement !== document.body) {
        fragment.appendChild(container);
    }
    if (fragment.childNodes.length) {
        document.body.appendChild(fragment);
    }
}

export function initializeTrimTabModal() {
    const trigger = document.getElementById('trimtab-modal');
    const backdrop = document.getElementById('trimtab-modal-backdrop');
    const container = document.getElementById('trimtab-modal-container');
    const modalWindow = container?.querySelector('.editor-modal-window');

    if (!trigger || !backdrop || !container || !modalWindow) {
        console.warn('Trim Tab modal elements not found');
        return;
    }

    ensureModalDetachedFromDrawer(backdrop, container);

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

    ensureModalDetachedFromDrawer(backdrop, container);

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
    const clampValue = (value) => Math.max(-100, Math.min(100, Math.round(value ?? 0)));
        const clampPct = (pct) => Math.max(0, Math.min(100, pct));
        const pctFromValue = (value) => clampPct(50 - clampValue(value) / 2);
        const valueFromPct = (pct) => clampValue((50 - pct) * 2);
    const registerSetter = (side, setter) => {
        window.__kiloTrimtabSetters = window.__kiloTrimtabSetters || {};
        window.__kiloTrimtabSetters[side] = setter;
    };

    overlays.forEach((root) => {
        const track = root.querySelector('.trimtab-track-bg');
        const fill = root.querySelector('.trimtab-track-fill');
        const thumb = root.querySelector('.trimtab-thumb');
        const upButton = root.querySelector('.throttle-up');
        const downButton = root.querySelector('.throttle-down');
        const trimSide = root.dataset.trimtab === 'starboard' ? 'starboard' : 'port';
        const stateKey = trimSide === 'starboard' ? 'starboard_trim' : 'port_trim';
        if (!track || !fill || !thumb) return;

        fill.style.top = '50%';
        fill.style.bottom = 'auto';
        fill.style.height = '0';

        const applyFromTopPct = (pct, opts = {}) => {
            const clamped = clampPct(pct);
            thumb.style.top = clamped + '%';
            const distance = Math.abs(50 - clamped);
            const start = Math.min(clamped, 50);
            fill.style.top = `${start}%`;
            fill.style.height = `${distance}%`;
            fill.classList.toggle('fill-up', clamped < 50);
            fill.classList.toggle('fill-down', clamped > 50);
            if (!opts.silent) {
                const value = valueFromPct(clamped);
                if (gamepadControlState[stateKey] !== value) {
                    gamepadControlState[stateKey] = value;
                }
            }
        };

        const getTopPct = () => {
            const value = parseFloat(thumb.style.top);
            return Number.isFinite(value) ? value : pctFromValue(gamepadControlState[stateKey] ?? 0);
        };

        const setFromValue = (value, opts = {}) => {
            const pct = pctFromValue(value);
            applyFromTopPct(pct, opts);
        };

        registerSetter(trimSide, (value) => setFromValue(value, { silent: true }));

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

        setFromValue(gamepadControlState[stateKey] ?? 0, { silent: true });
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

    const formatAngleLabel = (value) => {
        const rounded = Math.round(value);
        const sign = rounded >= 0 ? '+' : '-';
        const padded = String(Math.abs(rounded)).padStart(2, '0');
        return `${sign}${padded}°`;
    };

    const applyAngle = () => {
        boat.style.transform = `rotate(${angle}deg)`;
        angleLabel.textContent = formatAngleLabel(angle);
    };

    const setAngle = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return;
        angle = clamp(numeric);
        applyAngle();
    };

    const adjustAngle = (delta) => {
        angle = clamp(angle + delta);
        applyAngle();
    };

    const startHold = (direction) => {
        if (startHold.timer) return;
        startHold.timer = setInterval(() => {
            adjustAngle(direction * STEP);
        }, 60);
    };

    const stopHold = () => {
        clearInterval(startHold.timer);
        startHold.timer = null;
    };

    leftButton.addEventListener('click', (event) => {
        event.preventDefault();
        adjustAngle(-STEP);
    });
    rightButton.addEventListener('click', (event) => {
        event.preventDefault();
        adjustAngle(STEP);
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
            adjustAngle(-STEP);
        }
        if (event.key === 'ArrowRight') {
            adjustAngle(STEP);
        }
    });

    window.__kiloSetGyroRoll = (value) => {
        if (value === undefined || value === null) return;
        setAngle(value);
    };

    if (window.__kiloLatestRoll !== undefined) {
        window.__kiloSetGyroRoll(window.__kiloLatestRoll);
    } else {
        applyAngle();
    }
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








// ============================================================================
// HELP MODAL 
// ============================================================================

/* Config: external tooltip document */
const COACH_DATA_URL = '/static/tooltips.html';

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

    // --- DEBUG: expose to window for console inspection ---
    if (typeof window !== 'undefined') {
      window.TOUR_STEPS = TOUR_STEPS; // debug only
    }

  })();
  return coachDataReady;
}



/* Allow-list (click-through) */
const COACH_GLOBAL_ALLOW_SELECTORS = [
  '.status-bar',
  '.drawer-tab',
  /*'.boat-image', */
  '.time-utc',
  '.satellite-numbers'
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

  function hitTestCoachTarget(x, y){
    const under = elementUnderPoint(x, y);
    let candidate = combinedSelectors ? under?.closest?.(combinedSelectors) : null;
    let hitIdx = matchStepIndexByElement(candidate || under);

    // Fallback: geometry-based hit-test in case elementFromPoint stops at a wrapper
    if (hitIdx < 0 && TOUR_STEPS.length){
      for (let i = 0; i < TOUR_STEPS.length; i++){
        const el = document.querySelector(TOUR_STEPS[i].selector);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
          candidate = el;
          hitIdx = i;
          break;
        }
      }
    }

    if (hitIdx >= 0 && !candidate) {
      const stepSel = TOUR_STEPS[hitIdx]?.selector;
      candidate = stepSel ? under?.closest?.(stepSel) || document.querySelector(stepSel) : null;
    }

    return { under, candidate, hitIdx };
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

      const { under, candidate, hitIdx } = hitTestCoachTarget(e.clientX, e.clientY);

      const allowed = isCoachAllowedTarget(under) || hitIdx >= 0;
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

    const { under, hitIdx } = hitTestCoachTarget(e.clientX, e.clientY);

    if (hitIdx >= 0){
      if (hoverEl && hoverEl !== activeEl) hoverEl.classList.remove('coach-glow');
      hoverEl = null;
      idx = hitIdx;
      renderStep();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (isCoachAllowedTarget(under)) {
      synthesizeClickSequence(under, e);
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
