// ============================================================================
// GAMEPAD HANDLER MODULE - ACCUMULATIVE THROTTLE & STEERING
// ============================================================================

export const gamepadControlState = {
    throttle: 0,      // -100 to +100 (accumulative)
    steering: 0,      // -100 to +100 (accumulative)
    engine_trim: 0,   // 0 to 100
    port_trim: 0,     // 0 to 100
    starboard_trim: 0 // 0 to 100
};

let gamepadIndex = null;
let lastGearCrossing = null;
let gearCrossingLockout = false;
let lastThrottleAxis = 0;
let lastSteeringAxis = 0;

// Gear thresholds
const GEAR_NEUTRAL_MIN = -10;
const GEAR_NEUTRAL_MAX = 10;

// Deadzone and sensitivity
const DEADZONE = 0.15;
const THROTTLE_SENSITIVITY = 2.5; // units per frame when stick is pushed
const STEERING_SENSITIVITY = 3.0; // units per frame when stick is pushed

// Trim control rates
const TRIM_RATE = 1; // units per frame
const LISTING_RATE = 1; // units per frame

// Gamepad watchdog
let lastGamepadActivity = Date.now();
const WATCHDOG_TIMEOUT = 3000; // 3 seconds

// ============================================================================
// GAMEPAD CONNECTION HANDLERS
// ============================================================================
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
            }, 3000);
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
// HELPER FUNCTIONS
// ============================================================================

function applyDeadzone(value) {
    if (Math.abs(value) < DEADZONE) {
        return 0;
    }
    // Scale the value to account for deadzone
    const sign = Math.sign(value);
    const magnitude = (Math.abs(value) - DEADZONE) / (1 - DEADZONE);
    return sign * magnitude;
}

function getCurrentGear(throttle) {
    if (throttle >= GEAR_NEUTRAL_MIN && throttle <= GEAR_NEUTRAL_MAX) {
        return 'N';
    } else if (throttle > GEAR_NEUTRAL_MAX) {
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
        }, 500);
    }
}

function vibrateGamepad() {
    if (gamepadIndex === null) return;
    
    const gamepad = navigator.getGamepads()[gamepadIndex];
    if (gamepad && gamepad.vibrationActuator) {
        gamepad.vibrationActuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration: 200,
            weakMagnitude: 0.5,
            strongMagnitude: 0.5
        });
    }
}

// ============================================================================
// WATCHDOG
// ============================================================================
function checkGamepadWatchdog() {
    if (gamepadIndex !== null) {
        const now = Date.now();
        if (now - lastGamepadActivity > WATCHDOG_TIMEOUT) {
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
        
        // Set new timeout to collapse after 1 second
        throttleCollapseTimeout = setTimeout(() => {
            throttleWrapper.classList.remove('expanded');
        }, 1000);
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
    // THROTTLE - ACCUMULATIVE (Left Stick Vertical - Axis 1)
    // ========================================================================
    const leftStickY = applyDeadzone(gamepad.axes[1]); // Keep raw: UP = negative

    if (leftStickY !== 0) {
    const currentGear = getCurrentGear(gamepadControlState.throttle); // Define currentGear
    
    // Calculate new throttle value - double negative makes UP = positive
    const delta = -leftStickY * THROTTLE_SENSITIVITY; // Negate: UP becomes positive
    let newThrottle = gamepadControlState.throttle + delta;
    newThrottle = Math.max(-100, Math.min(100, newThrottle));
    
    const newGear = getCurrentGear(newThrottle);
    
    
        // Check for gear crossing
        if (currentGear !== newGear && currentGear !== 'N' && newGear !== 'N') {
            if (!gearCrossingLockout) {
                gearCrossingLockout = true;
                lastGearCrossing = Date.now();
                vibrateGamepad();
                console.log(`⚠️ Gear crossing detected! Release stick to ${newGear === 'F' ? 'forward' : 'reverse'}.`);
            }
        }
        
        // Check if lockout should be released
        if (gearCrossingLockout && Math.abs(leftStickY) < 0.1) {
            gearCrossingLockout = false;
            console.log(`✅ Gear lockout released`);
        }
        
        // Update throttle only if not in lockout
        if (!gearCrossingLockout) {
            gamepadControlState.throttle = Math.round(newThrottle);
            
            // Show gear popup if gear changed
            if (currentGear !== newGear) {
                showGearPopup(newGear);
            }
            
            updateThrottleUI(gamepadControlState.throttle);
        }
    }

    lastThrottleAxis = leftStickY;
    
    // ========================================================================
    // STEERING - ACCUMULATIVE (Right Stick Horizontal - Axis 2)
    // ========================================================================
    const rightStickX = applyDeadzone(gamepad.axes[2]);
    
    if (rightStickX !== 0) {
        const delta = rightStickX * STEERING_SENSITIVITY;
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
        gamepadControlState.engine_trim = Math.min(100, gamepadControlState.engine_trim + TRIM_RATE);
        updateEngineTrimUI(gamepadControlState.engine_trim);
        showTrimModal();
    }
    
    if (gamepad.buttons[13].pressed) {
        gamepadControlState.engine_trim = Math.max(0, gamepadControlState.engine_trim - TRIM_RATE);
        updateEngineTrimUI(gamepadControlState.engine_trim);
        showTrimModal();
    }
    
    // ========================================================================
    // LISTING (D-Pad Left/Right - Buttons 14/15)
    // ========================================================================
    if (gamepad.buttons[14].pressed) {
        // Left - tilt to port
        gamepadControlState.port_trim = Math.min(100, gamepadControlState.port_trim + LISTING_RATE);
        gamepadControlState.starboard_trim = Math.max(0, gamepadControlState.starboard_trim - LISTING_RATE);
        updateListingUI();
        showListingModal();
    }
    
    if (gamepad.buttons[15].pressed) {
        // Right - tilt to starboard
        gamepadControlState.starboard_trim = Math.min(100, gamepadControlState.starboard_trim + LISTING_RATE);
        gamepadControlState.port_trim = Math.max(0, gamepadControlState.port_trim - LISTING_RATE);
        updateListingUI();
        showListingModal();
    }
    
    requestAnimationFrame(pollGamepad);
}

function startGamepadPolling() {
    console.log("🎮 Starting gamepad polling loop");
    pollGamepad();
}

// ============================================================================
// UI UPDATE FUNCTIONS - AS PER YOUR SPECIFICATION
// ============================================================================

    function updateThrottleUI(throttle) {
        const gearFill = document.getElementById("gear-fill");
        const gearThumb = document.querySelector(".gear-thumb");
        const gearThumbText = document.querySelector(".gear-thumb-text");
        const gearLetterDisplay = document.getElementById("gear-letter-display");
        
        
    if (gearThumb) {
        // Update only the silver pill position based on commanded throttle
        const visualPercent = throttle / 100;
        const VISUAL_HALF = 47.5;
        const visualOffset = visualPercent * VISUAL_HALF;
        const thumbPos = 50 + visualOffset; // Changed from "50 - visualOffset"
        gearThumb.style.bottom = `${thumbPos}%`;
    }
        
    if (gearLetterDisplay) {
        const gearLetter = getCurrentGear(throttle);
        gearLetterDisplay.textContent = gearLetter;
    }
    
    // Expand throttle wrapper on use (auto-collapses after 1 second)
    expandThrottleWrapper();
}

function updateSteeringUI(steering) {
    const rudderPointer = document.getElementById("rudder-pointer");
    if (rudderPointer) {
        const degrees = (steering / 100) * 35;
        const visualAngle = -degrees;
        rudderPointer.setAttribute("transform", `rotate(${visualAngle}, 144, 0)`);
    }
    
    const rudderInput = document.getElementById("rudder-input");
    if (rudderInput) {
        const degrees = Math.round((steering / 100) * 35);
        rudderInput.value = degrees;
    }
    
    const steeringValue = document.getElementById("rudder-angle-value");
    if (steeringValue) {
        const degrees = Math.round((steering / 100) * 35);
        steeringValue.textContent = degrees;
        
        const boatStat = document.getElementById("boat-rudder-stat");
        if (boatStat) {
            boatStat.classList.add('updating');
            setTimeout(() => boatStat.classList.remove('updating'), 300);
        }
    }
}

function updateEngineTrimUI(trim) {
    const trimValue = document.getElementById("trim-value");
    if (trimValue) {
        trimValue.textContent = trim;
        
        const boatStat = document.getElementById("boat-trim-stat");
        if (boatStat) {
            boatStat.classList.add('updating');
            setTimeout(() => boatStat.classList.remove('updating'), 300);
        }
    }
    
    const trimFill = document.getElementById("trim-fill");
    if (trimFill) {
        trimFill.style.height = `${trim}%`;
    }
    
    const trimThumb = document.getElementById("trim-thumb");
    if (trimThumb) {
        const position = 100 - trim;
        trimThumb.style.top = `${position}%`;
    }
    
    const trimReadout = document.getElementById("trim-readout");
    if (trimReadout) {
        trimReadout.textContent = trim;
    }
    
    const trimPointer = document.querySelector(".trim-pointer-img");
    if (trimPointer) {
        // Reverse rotation: 0 = flat, 100 = tilted up
        const rotation = -((trim / 100) * 30); // Negative for correct direction
        trimPointer.style.transform = `rotate(${rotation}deg)`;
    }
}

function updateListingUI() {
    // This would update listing modal if it exists
    console.log(`Listing: Port=${gamepadControlState.port_trim}, Stbd=${gamepadControlState.starboard_trim}`);
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
    }, 500);
}

let listingModalTimeout = null;

function showListingModal() {
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
    }, 500);
}

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