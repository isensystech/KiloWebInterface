




 

      /* SCRIPT // Logitech F310   */

              /* Left/Right Screen   */
          
                let screenGamepadIndex = null;
                let wasPressedLeft = false;
                let wasPressedRight = false;

                window.addEventListener("gamepadconnected", (event) => {
                    if (screenGamepadIndex === null) {
                    screenGamepadIndex = event.gamepad.index;
                    console.log("Screen nav connected at index", screenGamepadIndex);
                    }
                });

                window.addEventListener("gamepaddisconnected", () => {
                    screenGamepadIndex = null;
                });

                function pollScreenNavigation() {
                    if (screenGamepadIndex !== null) {
                    const gamepad = navigator.getGamepads()[screenGamepadIndex];
                    if (gamepad) {
                        // Left (B4)
                        if (gamepad.buttons[4].pressed && !wasPressedLeft) {
                        document.getElementById("prev-screen").click();
                        wasPressedLeft = true;
                        } else if (!gamepad.buttons[4].pressed) {
                        wasPressedLeft = false;
                        }

                        // Right (B5)
                        if (gamepad.buttons[5].pressed && !wasPressedRight) {
                        document.getElementById("next-screen").click();
                        wasPressedRight = true;
                        } else if (!gamepad.buttons[5].pressed) {
                        wasPressedRight = false;
                        }
                    }
                    }
                    requestAnimationFrame(pollScreenNavigation);
                }

                pollScreenNavigation();
         

              /* Trim Modal   */
          
            let trimGamepadIndex = null;
            let isTrimOpen = false;
            let trimHideTimeout = null;
            let wasPressedUp = false;
            let wasPressedDown = false;

            window.addEventListener("gamepadconnected", (event) => {
                if (trimGamepadIndex === null) {
                trimGamepadIndex = event.gamepad.index;
                console.log("Trim control connected at index", trimGamepadIndex);
                }
            });

            window.addEventListener("gamepaddisconnected", () => {
                trimGamepadIndex = null;
            });

            function showTrimModal() {
                if (!isTrimOpen) {
                document.getElementById("trim-modal-backdrop").style.display = "block";
                document.getElementById("trim-modal-container").style.display = "block";
                isTrimOpen = true;
                }
                if (trimHideTimeout) clearTimeout(trimHideTimeout);
            }

            function hideTrimModalDelayed() {
                trimHideTimeout = setTimeout(() => {
                document.getElementById("trim-modal-backdrop").style.display = "none";
                document.getElementById("trim-modal-container").style.display = "none";
                isTrimOpen = false;
                }, 1500);
            }

            function moveTrimThumb(direction) {
                const thumb = document.getElementById("trim-thumb");
                const currentTop = parseFloat(thumb.style.top || "50");
                let newTop = currentTop + direction;
                newTop = Math.max(0, Math.min(100, newTop));
                thumb.style.top = newTop + "%";
            }

            function pollTrimControl() {
                if (trimGamepadIndex !== null) {
                const gamepad = navigator.getGamepads()[trimGamepadIndex];
                if (gamepad) {
                    const upPressed = gamepad.buttons[12].pressed;
                    const downPressed = gamepad.buttons[13].pressed;

                    // UP (B12)
                    if (upPressed && !wasPressedUp) {
                    showTrimModal();
                    moveTrimThumb(-5);
                    wasPressedUp = true;
                    } else if (!upPressed) {
                    if (wasPressedUp && !downPressed) hideTrimModalDelayed();
                    wasPressedUp = false;
                    }

                    // DOWN (B13)
                    if (downPressed && !wasPressedDown) {
                    showTrimModal();
                    moveTrimThumb(5);
                    wasPressedDown = true;
                    } else if (!downPressed) {
                    if (wasPressedDown && !upPressed) hideTrimModalDelayed();
                    wasPressedDown = false;
                    }
                }
                }

                requestAnimationFrame(pollTrimControl);
            }

            pollTrimControl();
         
                        
              /* Rudder Angle   */
          
            let rudderGamepadIndex = null;
            let rudderAngle = 0; // value in degrees, -35 to +35

            window.addEventListener("gamepadconnected", (event) => {
                if (rudderGamepadIndex === null) {
                    rudderGamepadIndex = event.gamepad.index;
                    console.log("Rudder control connected at index", rudderGamepadIndex);
                }
            });

            window.addEventListener("gamepaddisconnected", () => {
                rudderGamepadIndex = null;
            });

            function updateRudderPointer(angle) {
                const pointer = document.getElementById("rudder-pointer");
                if (pointer) {
                    const visualAngle = -angle; // inverted for SVG
                    pointer.setAttribute("transform", `rotate(${visualAngle}, 144, 0)`);
                }

                const input = document.getElementById("rudder-input");
                if (input) {
                    input.value = Math.round(angle);
                }
            }

            function pollRudderControl() {
                if (rudderGamepadIndex !== null) {
                    const gamepad = navigator.getGamepads()[rudderGamepadIndex];
                    if (gamepad) {
                        const raw = gamepad.axes[2]; // AXIS 2
                        const deadzone = 0.1;

                        if (Math.abs(raw) > deadzone) {
                            // Accumulate angle over time
                            rudderAngle += raw * 0.8; // Speed of change — adjust if needed
                            rudderAngle = Math.max(-35, Math.min(35, rudderAngle));
                        }

                        updateRudderPointer(rudderAngle);
                    }
                }

                requestAnimationFrame(pollRudderControl);
            }

            pollRudderControl();

            function updateRudderFromInput() {
                const input = document.getElementById("rudder-input");
                if (!input) return;

                let value = parseInt(input.value);
                if (isNaN(value)) value = 0;
                rudderAngle = Math.max(-35, Math.min(35, value));

                updateRudderPointer(rudderAngle);
            }
         

              /* Throttle   */
              /* SCRIPT // MODAL THROTTLE   */
          
            document.addEventListener("DOMContentLoaded", () => {
            const gearTrack = document.querySelector(".gear-track");
            const gearThumb = document.querySelector(".gear-thumb");
            const gearFill = document.getElementById("gear-fill");
            const thumbText = gearThumb?.querySelector(".gear-thumb-text");
            const wrapper = document.querySelector(".throttle-wrapper");
            const indicator = document.getElementById("throttle-indicator");
            const indicatorText = indicator?.querySelector(".throttle-char");

            if (!gearTrack || !gearThumb || !gearFill || !wrapper || !thumbText || !indicatorText) return;

            const VISUAL_MAX = 95;
            const VISUAL_HALF = VISUAL_MAX / 2;
            const EDGE_PADDING = 12;
            const STEP = 0.5;
            const STICKY_ZONE = 0.1;
            const RESET_ZONE = 0.2;

            let logicalPercent = 0;
            let isDragging = false;
            let throttleExpandTimeout = null;
            let stickyBarrierActive = false;
            let stickyNeutralActive = false;
            let wasZone = "neutral";

            function expandThrottleUI() {
                wrapper.classList.add("expanded");
                if (throttleExpandTimeout) clearTimeout(throttleExpandTimeout);
                throttleExpandTimeout = setTimeout(() => {
                wrapper.classList.remove("expanded");
                }, 1000);
            }


            function renderSlider(logical) {
            const clamped = Math.max(-1, Math.min(1, logical));
            const visualOffset = clamped * VISUAL_HALF;
            const visualBottom = 50 + visualOffset;

            gearThumb.style.bottom = `${visualBottom}%`;
            gearFill.style.height = `${Math.abs(visualOffset)}%`;
            gearFill.style.top = visualOffset < 0 ? '50%' : 'auto';
            gearFill.style.bottom = visualOffset >= 0 ? '50%' : 'auto';

            if (Math.abs(clamped) < STICKY_ZONE) {
                thumbText.innerHTML = `
                <span class="text-n">N</span>
                <span class="text-neutral">NEUTRAL</span>
                `;
            } else {
                thumbText.textContent = `${Math.round(Math.abs(clamped) * 100)}%`;
            }
            }


  

            function showThrottleIndicator(letter) {
                indicatorText.textContent = letter;
                indicator.classList.add("show");
                setTimeout(() => {
                indicator.classList.remove("show");
                }, 500);
            }

            function updateSliderFromMouse(clientY) {
                const rect = gearTrack.getBoundingClientRect();
                const minY = rect.top + EDGE_PADDING;
                const maxY = rect.bottom - EDGE_PADDING;
                const usableHeight = maxY - minY;
                const posY = Math.max(minY, Math.min(clientY, maxY)) - minY;
                const offset = usableHeight / 2 - posY;

                logicalPercent = offset / (usableHeight / 2);
                logicalPercent = Math.max(-1, Math.min(1, logicalPercent));

                renderSlider(logicalPercent);
            }

            gearThumb.addEventListener("mousedown", (e) => {
                isDragging = true;
                updateSliderFromMouse(e.clientY);
                e.preventDefault();
            });

            document.addEventListener("mousemove", (e) => {
                if (isDragging) updateSliderFromMouse(e.clientY);
            });

            document.addEventListener("mouseup", () => {
                isDragging = false;
            });

            function moveThrottle(up = true) {
                logicalPercent += (up ? 1 : -1) * (STEP / VISUAL_HALF);
                logicalPercent = Math.max(-1, Math.min(1, logicalPercent));
                renderSlider(logicalPercent);
            }

            document.querySelector(".throttle-up")?.addEventListener("click", () => moveThrottle(true));
            document.querySelector(".throttle-down")?.addEventListener("click", () => moveThrottle(false));

            let throttleGamepadIndex = null;

            window.addEventListener("gamepadconnected", (event) => {
                if (throttleGamepadIndex === null) {
                throttleGamepadIndex = event.gamepad.index;
                console.log("Throttle connected at index", throttleGamepadIndex);
                }
            });

            window.addEventListener("gamepaddisconnected", () => {
                throttleGamepadIndex = null;
            });




            function determineThrottleLetter(prevValue, currentValue, raw) {
            const isNeutralNow = Math.abs(currentValue) <= STICKY_ZONE;
            const wasNeutral = Math.abs(prevValue) <= STICKY_ZONE;

            if (wasNeutral && currentValue > STICKY_ZONE && raw > 0) return "F";
            if (wasNeutral && currentValue < -STICKY_ZONE && raw < 0) return "R";
            if (!wasNeutral && isNeutralNow) return "N";
            if (currentValue > STICKY_ZONE && raw > 0) return "F";
            if (currentValue < -STICKY_ZONE && raw < 0) return "R";
            if (isNeutralNow && Math.abs(raw) < STICKY_ZONE) return "N";

            return null;
            }



            function pollThrottleControl() {
            if (throttleGamepadIndex !== null) {
                const gamepad = navigator.getGamepads()[throttleGamepadIndex];
                if (gamepad) {
                const raw = gamepad.axes[1];
                const deadzone = 0.1;

                // Reset sticky flags if in center zone
                if (Math.abs(raw) < RESET_ZONE) {
                    stickyBarrierActive = false;
                    stickyNeutralActive = false;
                }

                // If joystick is mostly centered, don't update
                if (Math.abs(raw) <= deadzone) {
                    renderSlider(logicalPercent); // raw not needed here
                    requestAnimationFrame(pollThrottleControl);
                    return;
                }

                const prevValue = logicalPercent;
                logicalPercent -= raw * 0.02;
                logicalPercent = Math.max(-1, Math.min(1, logicalPercent));
                gamepadControlState.throttle = Math.round(logicalPercent * -100); // We convert the UI's logical value (-1 to 1) to the required integer range (-100 to 100).



                const fromAbove = prevValue > STICKY_ZONE && logicalPercent <= STICKY_ZONE;
                const intoForward = prevValue < STICKY_ZONE && logicalPercent >= STICKY_ZONE;
                const fromBelow = prevValue < -STICKY_ZONE && logicalPercent >= -STICKY_ZONE;
                const intoReverse = prevValue > -STICKY_ZONE && logicalPercent <= -STICKY_ZONE;

                // If latch is active — hold at boundary and show N
                if (stickyBarrierActive) {
                    logicalPercent = prevValue > 0 ? STICKY_ZONE : -STICKY_ZONE;
                    showThrottleIndicator("N");
                    renderSlider(logicalPercent, raw);
                    requestAnimationFrame(pollThrottleControl);
                    return;
                }

                // Snap into forward/reverse barrier
                if (fromAbove || intoForward) {
                    logicalPercent = STICKY_ZONE;
                    stickyBarrierActive = true;
                    showThrottleIndicator("N");
                } else if (fromBelow || intoReverse) {
                    logicalPercent = -STICKY_ZONE;
                    stickyBarrierActive = true;
                    showThrottleIndicator("N");
                }

                const crossedNeutral =
                    (prevValue > 0 && logicalPercent < 0) ||
                    (prevValue < 0 && logicalPercent > 0);

                // Center snap
                if (stickyNeutralActive) {
                    logicalPercent = 0;
                    showThrottleIndicator("N");
                    renderSlider(logicalPercent, raw);
                    requestAnimationFrame(pollThrottleControl);
                    return;
                }

                if (crossedNeutral) {
                    logicalPercent = 0;
                    stickyNeutralActive = true;
                    showThrottleIndicator("N");
                }

                // Show indicators based on direction
                if (Math.abs(logicalPercent) <= STICKY_ZONE && raw < 0) {
                    console.log("NEUTRAL zone — joystick forward");
                    showThrottleIndicator("F");
                } else if (logicalPercent > STICKY_ZONE && raw < 0) {
                    console.log("Zone: FORWARD", "logical:", logicalPercent.toFixed(2), "raw:", raw.toFixed(2));
                    showThrottleIndicator("F");
                } else if (logicalPercent < -STICKY_ZONE && raw > 0) {
                    console.log("Zone: REVERSE", "logical:", logicalPercent.toFixed(2), "raw:", raw.toFixed(2));
                    showThrottleIndicator("R");
                }







                    

            // NEUTRAL zone — touching FORWARD edge
            if (Math.abs(logicalPercent) <= STICKY_ZONE && logicalPercent > 0) {
            console.log("NEUTRAL zone — touching FORWARD edge");
            showThrottleIndicator("F");
            }




            if (logicalPercent > STICKY_ZONE && raw < 0) {
            console.log("Zone: FORWARD", "logical:", logicalPercent.toFixed(2), "raw:", raw.toFixed(2));
            showThrottleIndicator("F");
            } else if (logicalPercent < -STICKY_ZONE && raw > 0) {
            console.log("Zone: REVERSE", "logical:", logicalPercent.toFixed(2), "raw:", raw.toFixed(2));
            showThrottleIndicator("R");
            }






                    expandThrottleUI();
                    renderSlider(logicalPercent);
                }
                }

                requestAnimationFrame(pollThrottleControl);
            }

            pollThrottleControl();
            });
         

    

      /* MODAL PANEL DOCKER  */
      
        // Dock a modal flush to .drawer-panel and align bottoms
        function dockModalToDrawer(modal, opts = {}){
        const drawer = document.querySelector(opts.drawerSelector ?? '.drawer-panel');
        if (!modal || !drawer) return;

        const gap = Number(opts.gap ?? 0); // px between drawer and modal, 0 = flush

        const dr = drawer.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;

        // Align bottoms: distance from viewport bottom to drawer's bottom
        const bottom = Math.max(0, vh - dr.bottom);

        // Decide side: if drawer near left edge -> modal to the right; else to the left
        const placeToRight = dr.left <= vw / 2;

        // Apply docking styles
        modal.classList.add('is-docked');
        modal.style.bottom = `${bottom}px`;
        modal.style.maxHeight = `${dr.height}px`;   // keep within drawer height

        if (placeToRight){
            // Drawer at left → modal on its right edge
            modal.style.left = `${Math.round(dr.right + gap)}px`;
            modal.style.right = 'auto';
        } else {
            // Drawer at right → modal on its left edge
            modal.style.right = `${Math.round(vw - dr.left + gap)}px`;
            modal.style.left = 'auto';
        }
        }

        // Helper: set up docking + keep it on resize/drawer resize
        function setupDocking(modalSelector, opts = {}){
        const modal = document.querySelector(modalSelector);
        if(!modal) return;

        const redraw = () => dockModalToDrawer(modal, opts);

        // Recompute on resize
        window.addEventListener('resize', redraw);

        // Recompute when drawer size/position changes
        const drawer = document.querySelector(opts.drawerSelector ?? '.drawer-panel');
        if (drawer && 'ResizeObserver' in window){
            const ro = new ResizeObserver(redraw);
            ro.observe(drawer);
        }

        // If your "open modal" toggles a class, re-dock on show
        // Example: when .status-modal gets .is-open → dock
        const mo = new MutationObserver(() => { if (modal.classList.contains('is-open')) redraw(); });
        mo.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });

        // Initial (in case modal is already visible)
        redraw();
        }

        // Attach for both modals
        setupDocking('#helm-modal');
        setupDocking('#auto-pilot-modal');

        // Dock both modals with a 10px gap from the drawer
        setupDocking('#helm-modal',   { gap: 4 });  // 10px spacer
        setupDocking('#auto-pilot-modal', { gap: 4 });  // 10px spacer
     









        window.requestStatus = () => {}; // no-op
        

        import { gamepadControlState } from './modules/gamepad-handler.js';
        // This interval is solely responsible for sending the state over the network.
        // It is decoupled from the gamepad polling loop.
        setInterval(() => {
            // The global 'ws' object is created in websocket.js
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                window.ws.send(JSON.stringify(gamepadControlState));
            }
        }, 20); // Send every 20ms
        







// ===== ANIMATION INFO MODAL =====
// Transparent 1x1 pixel placeholder (keeps layout without showing anything)
const INFO_PLACEHOLDER_SRC =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

// Play GIF once when modal opens, then smoothly fade to poster (SVG)
function playGifOnce(){
  const img = document.getElementById('info-gif');
  if (!img) return;

  const gifUrl   = img.dataset.gif;
  const poster   = img.dataset.poster;
  const duration = img.dataset.gifDuration ? parseInt(img.dataset.gifDuration, 10) : null;

  // Clean previous timers/listeners
  clearTimeout(img._stopTimer);
  if (img._onLoadOnce) {
    img.removeEventListener('load', img._onLoadOnce);
    img._onLoadOnce = null;
  }

  // Ensure we have a transition; you can also put this in CSS
  // (Avoid visibility to keep layout stable; rely on aspect-ratio in CSS)
  img.style.transition = img.style.transition || 'opacity .35s ease';

  // Start hidden but reserving space (opacity doesn't affect layout)
  img.style.opacity = '0';

  // Restart GIF with cache-busting
  const busted = `${gifUrl}?t=${Date.now()}`;
  img._onLoadOnce = function onLoadOnce(){
    // Decode before showing to avoid first-frame flash
    img.decode?.().catch(()=>{}).finally(() => {
      // Fade GIF in
      requestAnimationFrame(() => { img.style.opacity = '1'; });

      // If we know the duration, schedule smooth cross-fade to poster
      if (duration && poster) {
        clearTimeout(img._stopTimer);
        img._stopTimer = setTimeout(() => {
          // Fade GIF out
          img.style.opacity = '0';

          // After fade-out completes, swap to poster and fade back in
          const FADE_MS = 350; // must match CSS/inline transition duration
          setTimeout(() => {
            // Swap src to poster
            img.src = poster;

            // Wait for poster to load, then fade in
            const onPosterLoad = () => {
              img.decode?.().catch(()=>{}).finally(() => {
                requestAnimationFrame(() => { img.style.opacity = '1'; });
              });
              img.removeEventListener('load', onPosterLoad);
            };
            img.addEventListener('load', onPosterLoad, { once:true });
          }, FADE_MS);
        }, duration);
      }
    });

    img.removeEventListener('load', onLoadOnce);
    img._onLoadOnce = null;
  };
  img.addEventListener('load', img._onLoadOnce, { once:true });

  // Kick off loading
  img.src = busted;
}

// ===== INFO MODAL =====
(() => {
  const trigger  = document.getElementById('info-trigger');    // Info icon
  const modal    = document.getElementById('info-modal');      // Modal window
  const backdrop = document.getElementById('info-backdrop');   // Backdrop
  const closeBtn = modal ? modal.querySelector('.info-modal-close') : null;

  if (!trigger || !modal || !backdrop || !closeBtn) {
    console.warn('[InfoModal] Missing required elements.');
    return;
  }

  // Timer for delayed GIF start
  let infoGifDelayTimer = null;

  function openModal(){
    modal.hidden = false;
    backdrop.hidden = false;
    closeBtn.focus({ preventScroll:true });

    // Prepare image: placeholder + hidden (opacity=0)
    const img = document.getElementById('info-gif');
    if (img) {
      clearTimeout(img._stopTimer);
      if (img._onLoadOnce) {
        img.removeEventListener('load', img._onLoadOnce);
        img._onLoadOnce = null;
      }
      img.src = INFO_PLACEHOLDER_SRC; // clean start
      img.style.opacity = '0';        // keep space, no flicker
    }

    // Delayed GIF start (500ms after opening)
    clearTimeout(infoGifDelayTimer);
    infoGifDelayTimer = setTimeout(() => {
      playGifOnce();
    }, 500);
  }

  function closeModal(){
    modal.hidden = true;
    backdrop.hidden = true;

    clearTimeout(infoGifDelayTimer);

    // Reset image to placeholder and hidden
    const img = document.getElementById('info-gif');
    if (img) {
      clearTimeout(img._stopTimer);
      if (img._onLoadOnce) {
        img.removeEventListener('load', img._onLoadOnce);
        img._onLoadOnce = null;
      }
      img.src = INFO_PLACEHOLDER_SRC;
      img.style.opacity = '0';
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
