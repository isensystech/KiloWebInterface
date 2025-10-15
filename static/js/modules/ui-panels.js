      /* SCRIPT // MODAL THROTTLE   */
  
    document.addEventListener("DOMContentLoaded", () => {
        const gearTrack = document.querySelector(".gear-track");
        const gearThumb = document.querySelector(".gear-thumb");
        const gearFill = document.getElementById("gear-fill");
        const thumbText = gearThumb?.querySelector(".gear-thumb-text");

        if (!gearTrack || !gearThumb || !gearFill) return;

        const VISUAL_MAX = 95;       // maximum visual range (%)
        const VISUAL_HALF = VISUAL_MAX / 2;
        const EDGE_PADDING = 12;
        const STEP = 0.5;

        let logicalPercent = 0;      // value from -1 to +1
        let isDragging = false;

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
            const centerY = rect.height / 2;
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
            isDragging = true;
            updateSliderFromMouse(e.clientY);
            e.preventDefault();
        });

        // Update while dragging
        document.addEventListener("mousemove", (e) => {
            if (isDragging) updateSliderFromMouse(e.clientY);
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
        });

        // ▲▼ control buttons
        function moveThrottle(up = true) {
            logicalPercent += (up ? -1 : 1) * (STEP / VISUAL_HALF);
            logicalPercent = Math.max(-1, Math.min(1, logicalPercent));
            renderSlider(logicalPercent);
        }

        document.querySelector(".throttle-up")?.addEventListener("click", () => moveThrottle(true));
        document.querySelector(".throttle-down")?.addEventListener("click", () => moveThrottle(false));
    });











    
 

      /* BOAT // Rudder & Trim GAUGE row   */
  
        // BOAT // Rudder & Trim data bindings
        // - Non-invasive bridge: reads existing DOM state and mirrors it to the new row.
        // - No changes to existing logic elsewhere.

        /* eslint-disable no-undef */
        (function () {
        // Cache DOM nodes once
        const rudderEl   = document.getElementById('rudder-angle-value');
        const trimEl     = document.getElementById('trim-value');
        const rudderWrap = document.getElementById('boat-rudder-stat');
        const trimWrap   = document.getElementById('boat-trim-stat');

        /** Format number for display (integer, keep sign) */
        function fmtInt(n) {
            const v = Math.round(Number(n) || 0);
            return v.toString();
        }

        /** Brief visual tick to indicate fresh data */
        function blip(el) {
            el && el.classList.add('updating');
            setTimeout(() => el && el.classList.remove('updating'), 120);
        }

        /** Public: update Rudder Angle in degrees */
        window.updateRudderAngle = function(angleDeg) {
            if (rudderEl) {
            rudderEl.textContent = fmtInt(angleDeg);
            blip(rudderWrap);
            }
        };

        /** Public: update Trim in degrees */
        window.updateTrim = function(trimDeg) {
            if (trimEl) {
            trimEl.textContent = fmtInt(trimDeg);
            blip(trimWrap);
            }
        };

        // ------------------------------
        // Auto-bridges (no logic changes)
        // ------------------------------

        // Rudder sources we can read from (whichever exists)
        const rudderInput   = document.getElementById('rudder-input');     // text/number field
        const rudderPointer = document.getElementById('rudder-pointer');   // SVG pointer with rotate()

        // Trim source: existing readout near the slider (text content with degrees)
        const trimReadout = document.querySelector('.trim-readout');

        // Last pushed values to avoid redundant DOM writes
        let lastRudderDeg = null;
        let lastTrimDeg   = null;

        /** Read current rudder angle from DOM without touching existing logic */
        function readRudderDeg() {
            // 1) Prefer explicit input value if present
            if (rudderInput && rudderInput.value !== '') {
            const v = Number(rudderInput.value);
            if (!Number.isNaN(v)) return v;
            }
            // 2) Else derive from pointer's transform rotate(A, cx, cy)
            if (rudderPointer) {
            const tr = rudderPointer.getAttribute('transform') || '';
            // Expect pattern like: rotate(XX, 144, 0)
            const m = tr.match(/rotate\(\s*(-?\d+(?:\.\d+)?)\s*,/);
            if (m) {
                const visual = Number(m[1]);      // visual angle
                // In many setups pointer rotates opposite sign to logical rudder.
                // If your UI uses inverted rotate, flip the sign here:
                return -visual;
            }
            }
            return null;
        }

        /** Read current trim angle from existing readout ".trim-readout" */
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
            ['input','change','keyup'].forEach(evt =>
            rudderInput.addEventListener(evt, syncOnce, { passive: true })
            );
        }

        // Cleanup on unload
        window.addEventListener('beforeunload', () => {
            if (rafId) cancelAnimationFrame(rafId);
        });
        })();
 

      /* SCRIPT // MODAL RULE RUDDER ANGLE INDICATOR   */
  
            function setRudderAngle(angle) {
            const pointer = document.getElementById("rudder-pointer");
            const centerX = 144;
            const centerY = 0;

            // 0° points down, +angle = starboard, -angle = port
            const visualAngle = -angle;

            pointer.setAttribute("transform", `rotate(${visualAngle}, ${centerX}, ${centerY})`);
            }


            /**
             * Reads the angle from the input field and applies it to the pointer.
             * Ensures the angle stays within the allowed range (-35 to +35).
             */
            function updateRudderFromInput() {
            const input = document.getElementById("rudder-input");
            let angle = parseInt(input.value, 10);

            // Validate and clamp value
            if (isNaN(angle)) angle = 0;
            angle = Math.max(-35, Math.min(35, angle));

            setRudderAngle(angle);
            }

            /**
             * Automatically initialize the pointer when the page loads.
             */
            window.addEventListener("DOMContentLoaded", () => {
            updateRudderFromInput();
            });

