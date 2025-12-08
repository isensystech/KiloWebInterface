/* SCRIPT // MODAL THROTTLE   */

// ============================================================================
// CONFIGURATION
// ============================================================================
const PANELS_CONFIG = Object.freeze({
    // Maximum percent (both directions) that the visual slider represents
    throttleVisualMaxPercent: 95,
    // Pixel padding at the top/bottom of the throttle track to avoid clipping
    throttleEdgePaddingPx: 12,
    // Percent delta applied when using the nudge buttons
    throttleStepPercent: 0.5,
    // Duration of the subtle “data updated” animation blip
    blipDurationMs: 120,
    // Absolute steering angle allowed from the manual input field
    rudderClampDeg: 35
});

export function initializeThrottleSlider() {
    const gearTrack = document.querySelector(".gear-track");
    const gearThumb = document.querySelector(".gear-thumb");
    const gearFill = document.getElementById("gear-fill");
    const thumbText = gearThumb?.querySelector(".gear-thumb-text");
    const throttleWrapper = document.querySelector(".throttle-wrapper");

    if (!gearTrack || !gearThumb || !gearFill) return;

    const VISUAL_MAX = PANELS_CONFIG.throttleVisualMaxPercent;       // maximum visual range (%)
    const VISUAL_HALF = VISUAL_MAX / 2;
    const EDGE_PADDING = PANELS_CONFIG.throttleEdgePaddingPx;
    const STEP = PANELS_CONFIG.throttleStepPercent;

    let logicalPercent = 0;      // value from -1 to +1
    let isDragging = false;
    let isMouseLockedByJoystick = false;

    function setMouseLockState(nextLocked) {
        isMouseLockedByJoystick = Boolean(nextLocked);
        throttleWrapper?.classList.toggle('joystick-locked', isMouseLockedByJoystick);
    }

    function guardIfLocked(event, { whileDraggingOnly = false } = {}) {
        if (!isMouseLockedByJoystick) return false;
        if (whileDraggingOnly && !isDragging) return false;
        isDragging = false;
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        return true;
    }

    const initialLock =
        typeof document !== 'undefined' && document.body?.dataset?.joystickConnected === '1';
    setMouseLockState(initialLock);
    window.addEventListener('joystick:connection-changed', (event) => {
        setMouseLockState(Boolean(event?.detail?.connected));
    });

    function renderSlider(logical) {
        const clamped = Math.max(-1, Math.min(1, logical));
        const visualOffset = clamped * VISUAL_HALF;
        const visualBottom = 50 - visualOffset;

        // Move thumb
        gearThumb.style.bottom = `${visualBottom}%`;

        // Fill
        gearFill.style.height = `${Math.abs(visualOffset)}%`;
        if (visualOffset >= 0) {
            gearFill.style.top = '50%';
            gearFill.style.bottom = 'auto';
        } else {
            gearFill.style.bottom = '50%';
            gearFill.style.top = 'auto';
        }

        // Label
        if (thumbText) {
            const percentValue = Math.round(Math.abs(clamped) * 100);
            if (Math.abs(clamped) < 0.1) {
                thumbText.textContent = 'NEUTRAL';
            } else {
                thumbText.textContent = `${percentValue}%`;
            }
        }
    }

    function updateSliderFromMouse(clientY) {
        const rect = gearTrack.getBoundingClientRect();
        // const centerY = rect.height / 2; // This variable was unused
        const minY = rect.top + EDGE_PADDING;
        const maxY = rect.bottom - EDGE_PADDING;

        const usableHeight = maxY - minY;
        const posY = Math.max(minY, Math.min(clientY, maxY)) - minY;
        const offset = posY - usableHeight / 2;
        logicalPercent = offset / (usableHeight / 2);

        renderSlider(logicalPercent);
    }

    // Start dragging
    gearThumb.addEventListener("mousedown", (e) => {
        if (guardIfLocked(e)) return;
        isDragging = true;
        updateSliderFromMouse(e.clientY);
        e.preventDefault();
    });

    // Update while dragging
    document.addEventListener("mousemove", (e) => {
        if (guardIfLocked(e, { whileDraggingOnly: true })) return;
        if (isDragging) updateSliderFromMouse(e.clientY);
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
    });

    // ▲▼ control buttons
    function moveThrottle(up = true) {
        if (guardIfLocked()) return;
        logicalPercent += (up ? -1 : 1) * (STEP / VISUAL_HALF);
        logicalPercent = Math.max(-1, Math.min(1, logicalPercent));
        renderSlider(logicalPercent);
    }

    document.querySelector(".throttle-up")?.addEventListener("click", () => moveThrottle(true));
    document.querySelector(".throttle-down")?.addEventListener("click", () => moveThrottle(false));
}


/* BOAT // Rudder & Trim GAUGE row   */

/** Public: update Rudder Angle in degrees */
export function updateRudderAngle(angleDeg) {
    const rudderEl = document.getElementById('rudder-angle-value');
    const rudderWrap = document.getElementById('boat-rudder-stat');
    
    if (rudderEl) {
        rudderEl.textContent = fmtInt(angleDeg);
        blip(rudderWrap);
    }
}
// Attach to window for compatibility with other modules
window.updateRudderAngle = updateRudderAngle;

/** Public: update Trim in degrees */
export function updateTrim(trimDeg) {
    const trimEl = document.getElementById('trim-value');
    const trimWrap = document.getElementById('boat-trim-stat');

    if (trimEl) {
        trimEl.textContent = fmtInt(trimDeg);
        blip(trimWrap);
    }
}
// Attach to window for compatibility with other modules
window.updateTrim = updateTrim;


// BOAT // Rudder & Trim data bindings
// - Non-invasive bridge: reads existing DOM state and mirrors it to the new row.
export function initializeRudderTrimBridge() {
    // Rudder sources we can read from (whichever exists)
    const rudderInput = document.getElementById('rudder-input');     // text/number field
    const rudderPointer = document.getElementById('rudder-pointer');   // SVG pointer with rotate()
    const rudderFeedbackPointer = document.getElementById('rudder-feedback-pointer'); // feedback pointer

    // Trim source: existing readout near the slider (text content with degrees)
    // CORRECTED: Use getElementById
    const trimReadout = document.getElementById('trim-readout');

    // Last pushed values to avoid redundant DOM writes
    let lastRudderDeg = null;
    let lastTrimDeg = null;

    function parsePointerDeg(pointer) {
        if (!pointer) return null;
        const tr = pointer.getAttribute('transform') || '';
        const m = tr.match(/rotate\(\s*(-?\d+(?:\.\d+)?)\s*,/);
        if (m) {
            const visual = Number(m[1]);
            if (!Number.isNaN(visual)) {
                return -visual;
            }
        }
        return null;
    }

    /** Read current rudder angle from DOM without touching existing logic */
    function readRudderDeg() {
        const hasFeedback = rudderFeedbackPointer?.dataset.feedbackActive === 'true';
        if (hasFeedback) {
            const feedbackDeg = parsePointerDeg(rudderFeedbackPointer);
            if (feedbackDeg !== null) return feedbackDeg;
        }
        // 1) Prefer explicit input value if present
        if (rudderInput && rudderInput.value !== '') {
            const v = Number(rudderInput.value);
            if (!Number.isNaN(v)) return v;
        }
        // 2) Else derive from pointer's transform rotate(A, cx, cy)
        const pointerDeg = parsePointerDeg(rudderPointer);
        if (pointerDeg !== null) return pointerDeg;

        const fallbackFeedbackDeg = parsePointerDeg(rudderFeedbackPointer);
        if (fallbackFeedbackDeg !== null) return fallbackFeedbackDeg;
        return null;
    }

    /** Read current trim angle from existing readout "#trim-readout" */
    function readTrimDeg() {
        if (!trimReadout) return null;
        const txt = (trimReadout.textContent || '').trim();
        // Accept forms like "-7", "-7°", " -7 deg " etc.
        const m = txt.match(/-?\d+/);
        if (m) return Number(m[0]);
        return null;
    }

    /** Push to public updaters only when value actually changed */
    function syncOnce() {
        const r = readRudderDeg();
        if (r !== null && r !== lastRudderDeg) {
            lastRudderDeg = r;
            window.updateRudderAngle(r);
        }
        const t = readTrimDeg();
        if (t !== null && t !== lastTrimDeg) {
            lastTrimDeg = t;
            window.updateTrim(t);
        }
    }

    // Use rAF loop for smooth, non-blocking sync with existing animations/dragging
    let rafId;
    function loop() {
        syncOnce();
        rafId = window.requestAnimationFrame(loop);
    }
    loop();

    // Also observe textual changes in trim readout (extra safety)
    if (trimReadout && 'MutationObserver' in window) {
        const mo = new MutationObserver(syncOnce);
        mo.observe(trimReadout, { childList: true, characterData: true, subtree: true });
    }

    // If rudder input exists and user types manually, reflect immediately
    if (rudderInput) {
        ['input', 'change', 'keyup'].forEach(evt =>
            rudderInput.addEventListener(evt, syncOnce, { passive: true })
        );
    }

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        if (rafId) cancelAnimationFrame(rafId);
    });
}

/** Format number for display (integer, keep sign) */
function fmtInt(n) {
    const v = Math.round(Number(n) || 0);
    return v.toString();
}

/** Brief visual tick to indicate fresh data */
function blip(el) {
    el && el.classList.add('updating');
    setTimeout(() => el && el.classList.remove('updating'), PANELS_CONFIG.blipDurationMs);
}


/* SCRIPT // MODAL RULE RUDDER ANGLE INDICATOR   */

export function setRudderAngle(angle) {
    const pointer = document.getElementById("rudder-pointer");
    if (!pointer) return;
    
    const centerX = 144;
    const centerY = 0;

    // 0° points down, +angle = starboard, -angle = port
    const visualAngle = -angle;

    pointer.setAttribute("transform", `rotate(${visualAngle}, ${centerX}, ${centerY})`);
}
// Attach to window for compatibility with other modules
window.setRudderAngle = setRudderAngle;

/**
 * Reads the angle from the input field and applies it to the pointer.
 * Ensures the angle stays within the allowed range (-35 to +35).
 */
export function updateRudderFromInput() {
    const input = document.getElementById("rudder-input");
    if (!input) return;
    
    let angle = parseInt(input.value, 10);

    // Validate and clamp value
    if (isNaN(angle)) angle = 0;
    angle = Math.max(-PANELS_CONFIG.rudderClampDeg, Math.min(PANELS_CONFIG.rudderClampDeg, angle));
    
    // Update the input field value in case it was clamped
    input.value = angle;

    setRudderAngle(angle);
}
// Attach to window for compatibility with `onchange=""` attribute
window.updateRudderFromInput = updateRudderFromInput;


/**
 * Automatically initialize the pointer when the page loads.
 */
export function initializeRudderIndicator() {
    updateRudderFromInput();
}
