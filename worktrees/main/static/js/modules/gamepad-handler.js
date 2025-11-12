// ============================================================================
// GAMEPAD HANDLER MODULE - ACCUMULATIVE THROTTLE & STEERING
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================
const GAMEPAD_CONFIG = Object.freeze({
    // Range at which throttle counts as neutral (prevents flickering)
    gearNeutralBand: { min: -10, max: 10 },
    // Stick magnitude required to clear a gear-crossing lockout
    gearReleaseDeadzone: 0.05,
    // Generic stick deadzone before any movement is registered
    deadzone: 0.15,
    // Rate (units/frame) to accumulate throttle changes
    throttleSensitivity: 2.5,
    // Rate (units/frame) to accumulate steering changes
    steeringSensitivity: 3.0,
    // Rate (units/frame) for engine trim adjustments
    trimRate: 1,
    // Rate (units/frame) for hull listing adjustments
    listingRate: 1,
    // Milliseconds before watchdog declares the gamepad stale
    watchdogTimeoutMs: 3000,
    // Duration to keep the joystick indicator visible after connect
    joystickIndicatorHideMs: 3000,
    // How long the gear popup stays on screen
    gearPopupDurationMs: 500,
    vibration: {
        // Haptic effect duration and intensity
        durationMs: 200,
        weakMagnitude: 0.5,
        strongMagnitude: 0.5
    },
    // Delay before the throttle column collapses back down
    throttleCollapseDelayMs: 1000,
    // Auto-hide delays for the trim and listing overlays
    trimModalTimeoutMs: 1500,
    listingModalTimeoutMs: 500
});

export const gamepadControlState = {
    throttle: 0,      // -100 to +100 (accumulative)
    steering: 0,      // -100 to +100 (accumulative)
    engine_trim: 0,   // 0 to 100
    port_trim: 0,     // 0 to 100
    starboard_trim: 0 // 0 to 100
};

let gamepadIndex = null;
let gearCrossingLockout = false;
let enteredNeutralFrom = null; // Track which gear we entered neutral from ('F' or 'R')
let lastThrottleAxis = 0;
let lastSteeringAxis = 0;

// Gamepad watchdog
let lastGamepadActivity = Date.now();

// ============================================================================
// EXPORTED INITIALIZATION FUNCTION
// ============================================================================

/**
 * Attaches all gamepad event listeners and checks for existing gamepads.
 */
export function initializeGamepadHandler() {
    window.addEventListener("gamepadconnected", (event) => {
        if (gamepadIndex === null) {
            gamepadIndex = event.gamepad.index;
            console.log("✅ Gamepad connected at index", gamepadIndex);
            lastGamepadActivity = Date.now();
            
            const indicator = document.getElementById('joystick-indicator');
            if (indicator) {
                indicator.style.display = 'inline-block';
                indicator.classList.remove('disconnected');
                indicator.classList.add('connected');
                
                setTimeout(() => {
                    indicator.style.display = 'none';
                }, GAMEPAD_CONFIG.joystickIndicatorHideMs);
            }
            
            startGamepadPolling();
        }
    });
    
    window.addEventListener("gamepaddisconnected", (event) => {
        if (event.gamepad.index === gamepadIndex) {
            gamepadIndex = null;
            console.log("❌ Gamepad disconnected");
            
            const indicator = document.getElementById('joystick-indicator');
            if (indicator) {
                indicator.style.display = 'inline-block';
                indicator.classList.remove('connected');
                indicator.classList.add('disconnected');
            }
        }
    });

    // ============================================================================
    // AUTO-START
    // ============================================================================
    if (navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                gamepadIndex = i;
                console.log("✅ Gamepad already connected at index", i);
                startGamepadPolling();
                break;
            }
        }
    }
}


// ============================================================================
// HELPER FUNCTIONS (MODULE-PRIVATE)
// ============================================================================

function applyDeadzone(value) {
    if (Math.abs(value) < GAMEPAD_CONFIG.deadzone) {
        return 0;
    }
    // Scale the value to account for deadzone
    const sign = Math.sign(value);
    const magnitude = (Math.abs(value) - GAMEPAD_CONFIG.deadzone) / (1 - GAMEPAD_CONFIG.deadzone);
    return sign * magnitude;
}

function getCurrentGear(throttle) {
    const { min, max } = GAMEPAD_CONFIG.gearNeutralBand;
    if (throttle >= min && throttle <= max) {
        return 'N';
    } else if (throttle > max) {
        return 'F';
    } else {
        return 'R';
    }
}

function showGearPopup(gear) {
    const indicator = document.getElementById('throttle-indicator');
    const indicatorText = indicator?.querySelector('.throttle-char');
    
    if (indicator && indicatorText) {
        indicatorText.textContent = gear;
        indicator.classList.add('show');
        
        setTimeout(() => {
            indicator.classList.remove('show');
        }, GAMEPAD_CONFIG.gearPopupDurationMs);
    }
}

function vibrateGamepad() {
    if (gamepadIndex === null) return;
    
    const gamepad = navigator.getGamepads()[gamepadIndex];
    if (gamepad && gamepad.vibrationActuator) {
        gamepad.vibrationActuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration: GAMEPAD_CONFIG.vibration.durationMs,
            weakMagnitude: GAMEPAD_CONFIG.vibration.weakMagnitude,
            strongMagnitude: GAMEPAD_CONFIG.vibration.strongMagnitude
        });
    }
}

// ============================================================================
// WATCHDOG
// ============================================================================
function checkGamepadWatchdog() {
    if (gamepadIndex !== null) {
        const now = Date.now();
        if (now - lastGamepadActivity > GAMEPAD_CONFIG.watchdogTimeoutMs) {
            console.warn("⚠️ Gamepad watchdog timeout - attempting reconnect");
            
            // Try to find gamepad again
            const gamepads = navigator.getGamepads();
            let found = false;
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i]) {
                    gamepadIndex = i;
                    lastGamepadActivity = now;
                    found = true;
                    console.log("✅ Gamepad reconnected at index", i);
                    break;
                }
            }
            
            if (!found) {
                console.error("❌ Gamepad watchdog - failsafe activated");
                gamepadControlState.throttle = 0;
                gamepadControlState.steering = 0;
                gamepadIndex = null;
            }
        }
    }
}

// ============================================================================
// AUTO-COLLAPSE THROTTLE WRAPPER
// ============================================================================
let throttleCollapseTimeout = null;

function expandThrottleWrapper() {
    const throttleWrapper = document.querySelector('.throttle-wrapper');
    if (throttleWrapper) {
        throttleWrapper.classList.add('expanded');
        
        // Clear existing timeout
        if (throttleCollapseTimeout) {
            clearTimeout(throttleCollapseTimeout);
        }
        
        // Set new timeout to collapse after configured delay
        throttleCollapseTimeout = setTimeout(() => {
            throttleWrapper.classList.remove('expanded');
        }, GAMEPAD_CONFIG.throttleCollapseDelayMs);
    }
}


// ============================================================================
// MAIN GAMEPAD POLLING FUNCTION
// ============================================================================
function pollGamepad() {
    checkGamepadWatchdog();
    
    if (gamepadIndex === null) {
        requestAnimationFrame(pollGamepad);
        return;
    }
    
    const gamepad = navigator.getGamepads()[gamepadIndex];
    if (!gamepad) {
        requestAnimationFrame(pollGamepad);
        return;
    }
    
    lastGamepadActivity = Date.now();
        
    // ========================================================================
    // THROTTLE - ACCUMULATIVE WITH GEAR CROSSING PROTECTION
    // ========================================================================
    const leftStickY = applyDeadzone(gamepad.axes[1]); // UP = negative

    const currentGear = getCurrentGear(gamepadControlState.throttle);

    // CRITICAL: Check lockout release FIRST - stick must return to center
    if (gearCrossingLockout && Math.abs(leftStickY) < GAMEPAD_CONFIG.gearReleaseDeadzone) {
        gearCrossingLockout = false;
        enteredNeutralFrom = null;
        console.log(`✅ Gear lockout RELEASED - stick returned to center`);
    }

    if (leftStickY !== 0 && !gearCrossingLockout) {
        // Calculate proposed new throttle
        const delta = -leftStickY * GAMEPAD_CONFIG.throttleSensitivity;
        let newThrottle = gamepadControlState.throttle + delta;
        newThrottle = Math.max(-100, Math.min(100, newThrottle));
        
        const newGear = getCurrentGear(newThrottle);
        
        // Track which gear we entered neutral from
        if (currentGear !== 'N' && newGear === 'N') {
            enteredNeutralFrom = currentGear;
            console.log(`ℹ️ Entered NEUTRAL from ${currentGear}`);
        }
        
        // Check for illegal gear crossing: trying to exit neutral into opposite gear
        if (currentGear === 'N' && newGear !== 'N' && enteredNeutralFrom !== null) {
            if (enteredNeutralFrom !== newGear) {
                // BLOCK: Trying to go from F→N→R or R→N→F without releasing stick
                gearCrossingLockout = true;
                vibrateGamepad();
                console.log(`⚠️ GEAR CROSSING BLOCKED! Entered neutral from ${enteredNeutralFrom}, attempting ${newGear}. Release stick to center to shift.`);
                
                requestAnimationFrame(pollGamepad);
                return; // Skip this frame entirely
            }
        }
        
        // Safe to update throttle
        gamepadControlState.throttle = Math.round(newThrottle);
        
        // Show gear popup if gear changed
        if (currentGear !== newGear) {
            showGearPopup(newGear);
        }
        
        // Clear enteredNeutralFrom if we exit neutral in the same direction
        if (currentGear === 'N' && newGear !== 'N' && enteredNeutralFrom === newGear) {
            enteredNeutralFrom = null;
        }
        
        updateThrottleUI(gamepadControlState.throttle);
    }

    lastThrottleAxis = leftStickY;
    
    // ========================================================================
    // STEERING - ACCUMULATIVE (Right Stick Horizontal - Axis 2)
    // ========================================================================
    const rightStickX = applyDeadzone(gamepad.axes[2]);
    
    if (rightStickX !== 0) {
        const delta = rightStickX * GAMEPAD_CONFIG.steeringSensitivity;
        let newSteering = gamepadControlState.steering + delta;
        newSteering = Math.max(-100, Math.min(100, newSteering));
        
        gamepadControlState.steering = Math.round(newSteering);
        updateSteeringUI(gamepadControlState.steering);
    }
    
    lastSteeringAxis = rightStickX;
    
    // ========================================================================
    // ENGINE TRIM (D-Pad Up/Down - Buttons 12/13)
    // ========================================================================
    if (gamepad.buttons[12].pressed) {
        gamepadControlState.engine_trim = Math.min(100, gamepadControlState.engine_trim + GAMEPAD_CONFIG.trimRate);
        updateEngineTrimUI(gamepadControlState.engine_trim);
        showTrimModal();
    }
    
    if (gamepad.buttons[13].pressed) {
        gamepadControlState.engine_trim = Math.max(0, gamepadControlState.engine_trim - GAMEPAD_CONFIG.trimRate);
        updateEngineTrimUI(gamepadControlState.engine_trim);
        showTrimModal();
    }
    
    // ========================================================================
    // LISTING (D-Pad Left/Right - Buttons 14/15)
    // ========================================================================
    if (gamepad.buttons[14].pressed) {
        // Left - tilt to port
        gamepadControlState.port_trim = Math.min(100, gamepadControlState.port_trim + GAMEPAD_CONFIG.listingRate);
        gamepadControlState.starboard_trim = Math.max(0, gamepadControlState.starboard_trim - GAMEPAD_CONFIG.listingRate);
        updateListingUI(gamepadControlState.port_trim, gamepadControlState.starboard_trim);
        showListingModal();
    }
    
    if (gamepad.buttons[15].pressed) {
        // Right - tilt to starboard
        gamepadControlState.starboard_trim = Math.min(100, gamepadControlState.starboard_trim + GAMEPAD_CONFIG.listingRate);
        gamepadControlState.port_trim = Math.max(0, gamepadControlState.port_trim - GAMEPAD_CONFIG.listingRate);
        updateListingUI(gamepadControlState.port_trim, gamepadControlState.starboard_trim);
        showListingModal();
    }
    
    requestAnimationFrame(pollGamepad);
}

function startGamepadPolling() {
    console.log("🎮 Starting gamepad polling loop");
    pollGamepad();
}

// ============================================================================
// UI UPDATE FUNCTIONS (NOW EXPORTED)
// ============================================================================

export function updateThrottleUI(throttle) {
    // This function now ONLY updates the COMMAND bar and THUMB POSITION.
    
    // Update the "commanded" fill (silver)
    const gearFill = document.getElementById("gear-fill");
    if (gearFill) {
        const visualPercent = throttle / 100;
        const VISUAL_HALF = 47.5; // 95% total range / 2
        const visualOffset = visualPercent * VISUAL_HALF;

        gearFill.style.height = `${Math.abs(visualOffset)}%`;
        
        // This is the correct logic
        if (visualOffset > 0) { // Forward
            gearFill.style.bottom = '50%';
            gearFill.style.top = 'auto';
        } else { // Reverse
            gearFill.style.top = '50%';
            gearFill.style.bottom = 'auto';
        }
    }

    // Update the thumb position
    const gearThumb = document.querySelector(".gear-thumb");
    if (gearThumb) {
        const visualPercent = throttle / 100;
        const VISUAL_HALF = 47.5;
        const visualOffset = visualPercent * VISUAL_HALF;
        const thumbPos = 50 + visualOffset; // 50% is center
        gearThumb.style.bottom = `${thumbPos}%`;
    }
    
    // **** THIS IS THE FIX ****
    // We update the text content, not replace the innerHTML
    const gearThumbText = gearThumb?.querySelector(".gear-thumb-text");
    const textN = gearThumbText?.querySelector('.text-n'); // Collapsed text
    const textNeutral = gearThumbText?.querySelector('.text-neutral'); // Expanded text

    if (textN && textNeutral) {
        const gearLetter = getCurrentGear(throttle);
        const percentValue = Math.round(Math.abs(throttle));

        if (gearLetter === 'N') {
            textN.textContent = 'N';
            textNeutral.textContent = 'NEUTRAL';
        } else {
            textN.textContent = gearLetter; // F or R
            textNeutral.textContent = `${percentValue}%`; // Commanded %
        }
    }
    
    expandThrottleWrapper();
}

export function updateSteeringUI(steering) {
    // This function now handles feedback from both gamepad and WebSocket
    const degrees = (steering / 100) * 35;

    // Update the main SVG pointer
    const rudderPointer = document.getElementById("rudder-pointer");
    if (rudderPointer) {
        const visualAngle = -degrees;
        rudderPointer.setAttribute("transform", `rotate(${visualAngle}, 144, 0)`);
    }
    
    // Update the number input box
    const rudderInput = document.getElementById("rudder-input");
    if (rudderInput) {
        rudderInput.value = Math.round(degrees);
    }
    
    // Update the text readout under the boat
    const steeringValue = document.getElementById("rudder-angle-value");
    if (steeringValue) {
        steeringValue.textContent = Math.round(degrees);
        
        const boatStat = document.getElementById("boat-rudder-stat");
        if (boatStat) {
            boatStat.classList.add('updating');
            setTimeout(() => boatStat.classList.remove('updating'), 300);
        }
    }
}

export function updateEngineTrimUI(trim) {
    // This function now handles feedback from both gamepad and WebSocket
    const trimValue = Math.round(Math.max(0, Math.min(100, trim)));

    // Update text readout under the boat
    const trimValueEl = document.getElementById("trim-value");
    if (trimValueEl) {
        trimValueEl.textContent = trimValue;
        
        const boatStat = document.getElementById("boat-trim-stat");
        if (boatStat) {
            boatStat.classList.add('updating');
            setTimeout(() => boatStat.classList.remove('updating'), 300);
        }
    }
    
    // Update trim modal fill bar
    const trimFill = document.getElementById("trim-fill");
    if (trimFill) {
        trimFill.style.height = `${trimValue}%`;
    }
    
    // Update trim modal thumb position
    const trimThumb = document.getElementById("trim-thumb");
    if (trimThumb && trimThumb.parentElement) {
        const parentHeight = trimThumb.parentElement.offsetHeight;
        const thumbHeight = trimThumb.offsetHeight;
        
        // Ensure we have valid numbers before calculating
        if (parentHeight > 0 && thumbHeight > 0) {
            const travelRange = parentHeight - thumbHeight; // The full range the thumb can move
            const positionPercent = 1 - (trimValue / 100); // 0 trim = bottom (100%), 100 trim = top (0%)
            const thumbTop = (travelRange * positionPercent) + (thumbHeight / 2);
            trimThumb.style.top = `${thumbTop}px`;
        }
    }
    
    // Update trim modal text readout
    const trimReadout = document.getElementById("trim-readout");
    if (trimReadout) {
        trimReadout.textContent = trimValue;
    }
    
    // Update trim modal pointer graphic
    const trimPointer = document.querySelector(".trim-pointer-img");
    if (trimPointer) {
        const BASE = -15;   // deg: where value=0 should point (start of scale)
        const SPAN = 30;    // deg: total sweep from 0 to 100
        const rotation = (BASE + SPAN) - (trimValue / 100) * SPAN;
        trimPointer.style.transform = `rotate(${rotation}deg)`;
    }
}

export function updateListingUI(portTrim, starboardTrim) {
    // This function can now be called by WebSocket feedback
    gamepadControlState.port_trim = portTrim;
    gamepadControlState.starboard_trim = starboardTrim;
    console.log(`Listing Updated: Port=${portTrim}, Stbd=${starboardTrim}`);
    // TODO: Add UI update logic here if/when listing modal is implemented
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

let trimModalTimeout = null;

function showTrimModal() {
    const backdrop = document.getElementById("trim-modal-backdrop");
    const container = document.getElementById("trim-modal-container");
    
    if (backdrop && container) {
        backdrop.style.display = "block";
        container.style.display = "block";
    }
    
    if (trimModalTimeout) clearTimeout(trimModalTimeout);
    
    trimModalTimeout = setTimeout(() => {
        if (backdrop && container) {
            backdrop.style.display = "none";
            container.style.display = "none";
        }
    }, GAMEPAD_CONFIG.trimModalTimeoutMs);
}

let listingModalTimeout = null;

function showListingModal() {
    // Note: index.html does not have "listing-modal-backdrop" or "listing-modal-container"
    // This function will not do anything until those elements are added.
    const backdrop = document.getElementById("listing-modal-backdrop");
    const container = document.getElementById("listing-modal-container");
    
    if (backdrop && container) {
        backdrop.style.display = "block";
        container.style.display = "block";
    }
    
    if (listingModalTimeout) clearTimeout(listingModalTimeout);
    
    listingModalTimeout = setTimeout(() => {
        if (backdrop && container) {
            backdrop.style.display = "none";
            container.style.display = "none";
        }
    }, GAMEPAD_CONFIG.listingModalTimeoutMs);
}
