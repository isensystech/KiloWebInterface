// ============================================================================
// GAMEPAD HANDLER MODULE - JOYSTICK SCHEMAS & PILOT HOLD
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================
const GAMEPAD_CONFIG = Object.freeze({
    gearNeutralBand: { min: -10, max: 10 },
    gearReleaseDeadzone: 0.05,
    deadzone: 0.15,
    throttleSensitivity: 2.5,
    steeringSensitivity: 3.0,
    trimRate: 1,
    listingRate: 1,
    watchdogTimeoutMs: 3000,
    joystickIndicatorHideMs: 3000,
    gearPopupDurationMs: 500,
    vibration: {
        durationMs: 200,
        weakMagnitude: 0.5,
        strongMagnitude: 0.5
    },
    throttleCollapseDelayMs: 1000,
    trimModalTimeoutMs: 1500,
    listingModalTimeoutMs: 500
});

const JOYSTICK_SCHEMA_CONFIG = Object.freeze({
    throttle: 'pilot_hold', // 'springy' | 'sticky' | 'pilot_hold'
    steering: 'pilot_hold'
});

const PILOT_HOLD_BUTTONS = Object.freeze({
    throttle: 10, // Left stick press (L3)
    steering: 11  // Right stick press (R3)
});

const PILOT_HOLD_BASE_SCHEMA = Object.freeze({
    throttle: 'springy',
    steering: 'springy'
});

const SPRINGY_SCHEMA_CONFIG = Object.freeze({
    gearShiftHoldMs: 500,
    gearShiftThreshold: 0.07
});

const AXIS_RAMP_MS = Object.freeze({
    throttle: 3000,
    steering: 3000
});

export const gamepadControlState = {
    throttle: 0,
    steering: 0,
    engine_trim: 0,
    port_trim: 0,
    starboard_trim: 0
};

const pilotHoldState = {
    throttle: { isHeld: false, heldValue: 0 },
    steering: { isHeld: false, heldValue: 0 }
};

let gamepadIndex = null;
let gearCrossingLockout = false;
let enteredNeutralFrom = null;
let lastThrottleAxis = 0;
let lastSteeringAxis = 0;

const previousButtonStates = new Map();

let springyThrottleGear = 'N';
let springyShiftCandidate = null;
let springyRequiresRecenter = false;

let lastGamepadActivity = Date.now();
let lastPollTimestamp = null;

// ============================================================================
// INITIALIZATION
// ============================================================================
export function initializeGamepadHandler() {
    window.addEventListener('gamepadconnected', (event) => {
        if (gamepadIndex === null) {
            gamepadIndex = event.gamepad.index;
            lastGamepadActivity = Date.now();
            console.log('✅ Gamepad connected at index', gamepadIndex);

            const indicator = document.getElementById('joystick-indicator');
            if (indicator) {
                indicator.style.display = 'inline-block';
                indicator.classList.remove('disconnected');
                indicator.classList.add('connected');
                setTimeout(() => (indicator.style.display = 'none'), GAMEPAD_CONFIG.joystickIndicatorHideMs);
            }

            startGamepadPolling();
        }
    });

    window.addEventListener('gamepaddisconnected', (event) => {
        if (event.gamepad.index === gamepadIndex) {
            console.log('❌ Gamepad disconnected');
            gamepadIndex = null;
            resetSpringyThrottleState();
            gamepadControlState.throttle = 0;
            gamepadControlState.steering = 0;

            const indicator = document.getElementById('joystick-indicator');
            if (indicator) {
                indicator.style.display = 'inline-block';
                indicator.classList.remove('connected');
                indicator.classList.add('disconnected');
            }
        }
    });

    if (navigator.getGamepads) {
        const pads = navigator.getGamepads();
        for (let i = 0; i < pads.length; i++) {
            if (pads[i]) {
                gamepadIndex = i;
                console.log('✅ Gamepad already connected at index', i);
                startGamepadPolling();
                break;
            }
        }
    }
}

// ============================================================================
// HELPERS
// ============================================================================
function applyDeadzone(value) {
    if (Math.abs(value) < GAMEPAD_CONFIG.deadzone) return 0;
    const sign = Math.sign(value);
    const magnitude = (Math.abs(value) - GAMEPAD_CONFIG.deadzone) / (1 - GAMEPAD_CONFIG.deadzone);
    return sign * magnitude;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function formatAxisValue(value) {
    const rounded = Math.round(value);
    return `${rounded > 0 ? '+' : ''}${rounded}`;
}

function getAxisRampDelta(axis, deltaMs) {
    const rampMs = AXIS_RAMP_MS[axis];
    if (!rampMs || rampMs <= 0 || !deltaMs) return Infinity;
    return Math.max(0.5, (deltaMs / rampMs) * 100);
}

function applySpringyCommand(axis, desiredValue, deltaMs) {
    desiredValue = clamp(Math.round(desiredValue), -100, 100);
    const currentValue = gamepadControlState[axis];
    const deltaLimit = getAxisRampDelta(axis, deltaMs);

    let nextValue;
    if (!isFinite(deltaLimit)) {
        nextValue = desiredValue;
    } else {
        const diff = desiredValue - currentValue;
        nextValue = Math.abs(diff) <= deltaLimit ? desiredValue : currentValue + Math.sign(diff) * deltaLimit;
    }

    nextValue = Math.round(clamp(nextValue, -100, 100));
    if (nextValue === currentValue) return;

    gamepadControlState[axis] = nextValue;
    if (axis === 'throttle') {
        updateThrottleUI(gamepadControlState.throttle);
    } else if (axis === 'steering') {
        updateSteeringUI(gamepadControlState.steering);
    }
}

function getConfiguredSchema(axis) {
    return JOYSTICK_SCHEMA_CONFIG[axis] ?? 'sticky';
}

function resolveAxisBehavior(axis) {
    const schema = getConfiguredSchema(axis);
    if (schema === 'pilot_hold') {
        return PILOT_HOLD_BASE_SCHEMA[axis] ?? 'sticky';
    }
    return schema;
}

function axisSupportsPilotHold(axis) {
    return getConfiguredSchema(axis) === 'pilot_hold';
}

function isPilotHoldActive(axis) {
    return axisSupportsPilotHold(axis) && pilotHoldState[axis]?.isHeld;
}

function togglePilotHold(axis) {
    const state = pilotHoldState[axis];
    if (!state) return;
    state.isHeld = !state.isHeld;
    if (state.isHeld) {
        state.heldValue = gamepadControlState[axis] ?? 0;
        console.log(`Pilot Hold: ${axis} locked at ${formatAxisValue(state.heldValue)}`);
    } else {
        console.log(`Pilot Hold: ${axis} released`);
    }

    if (axis === 'steering') {
        updatePilotHoldIndicator();
    }
}

function handleAxisButtons(gamepad, axisInputs) {
    Object.entries(PILOT_HOLD_BUTTONS).forEach(([axis, index]) => {
        const key = `${axis}-${index}`;
        const buttonState = gamepad.buttons[index];
        const isPressed = !!buttonState?.pressed;
        const wasPressed = previousButtonStates.get(key) || false;
        const axisValue = axisInputs[axis] ?? 0;

        if (isPressed && !wasPressed) {
            if (axisSupportsPilotHold(axis)) {
                const state = pilotHoldState[axis];
                if (!state.isHeld) {
                    togglePilotHold(axis);
                } else if (Math.abs(axisValue) <= GAMEPAD_CONFIG.gearReleaseDeadzone) {
                    togglePilotHold(axis);
                } else {
                    console.log(`Pilot Hold: ${axis} release requires centering the stick`);
                }
            } else if (resolveAxisBehavior(axis) === 'sticky') {
                if (axis === 'throttle') {
                    gamepadControlState.throttle = 0;
                    gearCrossingLockout = false;
                    enteredNeutralFrom = null;
                    updateThrottleUI(gamepadControlState.throttle);
                } else if (axis === 'steering') {
                    gamepadControlState.steering = 0;
                    updateSteeringUI(gamepadControlState.steering);
                }
                console.log(`Sticky reset: ${axis} forced to 0 via stick press`);
            }
        }

        previousButtonStates.set(key, isPressed);
    });
}

function ensurePilotHoldIndicatorStyles() {
    if (document.getElementById('pilot-hold-style')) return;
    const style = document.createElement('style');
    style.id = 'pilot-hold-style';
    style.textContent = `
        #rudder-pointer.pilot-hold-active,
        #rudder-pointer.pilot-hold-active * {
            stroke: #ff3333 !important;
            fill: #ff3333 !important;
            stroke-width: 3px !important;
        }
    `;
    document.head.appendChild(style);
}

function updatePilotHoldIndicator() {
    const rudderPointer = document.getElementById('rudder-pointer');
    if (!rudderPointer) return;
    const active = axisSupportsPilotHold('steering') && !!pilotHoldState.steering?.isHeld;
    ensurePilotHoldIndicatorStyles();
    rudderPointer.classList.toggle('pilot-hold-active', active);
}

function getGearFromValue(throttle) {
    const { min, max } = GAMEPAD_CONFIG.gearNeutralBand;
    if (throttle >= min && throttle <= max) return 'N';
    if (throttle > max) return 'F';
    return 'R';
}

function getDisplayedThrottleGear() {
    if (resolveAxisBehavior('throttle') === 'springy') {
        return springyThrottleGear;
    }
    return getGearFromValue(gamepadControlState.throttle);
}

export function getThrottleGearState() {
    return getDisplayedThrottleGear();
}

function showGearPopup(gear) {
    const indicator = document.getElementById('throttle-indicator');
    const indicatorText = indicator?.querySelector('.throttle-char');
    if (!indicator || !indicatorText) return;

    delete indicator.dataset.gearHold;
    indicatorText.textContent = gear;
    indicator.style.opacity = '';
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), GAMEPAD_CONFIG.gearPopupDurationMs);
}

function renderGearShiftProgress(gear, progress) {
    const indicator = document.getElementById('throttle-indicator');
    const indicatorText = indicator?.querySelector('.throttle-char');
    if (!indicator || !indicatorText) return;

    indicator.dataset.gearHold = 'true';
    indicatorText.textContent = gear;
    indicator.classList.add('show');
    indicator.style.opacity = `${clamp(progress, 0, 1)}`;
}

function clearGearShiftProgress() {
    const indicator = document.getElementById('throttle-indicator');
    if (!indicator) return;
    indicator.style.opacity = '';
    if (indicator.dataset.gearHold === 'true') {
        delete indicator.dataset.gearHold;
        indicator.classList.remove('show');
    }
}

function vibrateGamepad() {
    if (gamepadIndex === null) return;
    const gamepad = navigator.getGamepads()[gamepadIndex];
    if (gamepad && gamepad.vibrationActuator) {
        gamepad.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: GAMEPAD_CONFIG.vibration.durationMs,
            weakMagnitude: GAMEPAD_CONFIG.vibration.weakMagnitude,
            strongMagnitude: GAMEPAD_CONFIG.vibration.strongMagnitude
        });
    }
}

function resetSpringyThrottleState() {
    springyThrottleGear = 'N';
    springyShiftCandidate = null;
    springyRequiresRecenter = false;
    clearGearShiftProgress();
}

// ============================================================================
// WATCHDOG
// ============================================================================
function checkGamepadWatchdog() {
    if (gamepadIndex !== null) {
        const now = Date.now();
        if (now - lastGamepadActivity > GAMEPAD_CONFIG.watchdogTimeoutMs) {
            console.warn('⚠️ Gamepad watchdog timeout - attempting reconnect');
            const pads = navigator.getGamepads();
            let found = false;
            for (let i = 0; i < pads.length; i++) {
                if (pads[i]) {
                    gamepadIndex = i;
                    lastGamepadActivity = now;
                    found = true;
                    console.log('✅ Gamepad reconnected at index', i);
                    break;
                }
            }

            if (!found) {
                console.error('❌ Gamepad watchdog - failsafe activated');
                gamepadControlState.throttle = 0;
                gamepadControlState.steering = 0;
                resetSpringyThrottleState();
                gamepadIndex = null;
            }
        }
    }
}

// ============================================================================
// THROTTLE WRAPPER
// ============================================================================
let throttleCollapseTimeout = null;

function expandThrottleWrapper() {
    const wrapper = document.querySelector('.throttle-wrapper');
    if (!wrapper) return;
    wrapper.classList.add('expanded');
    if (throttleCollapseTimeout) clearTimeout(throttleCollapseTimeout);
    throttleCollapseTimeout = setTimeout(() => wrapper.classList.remove('expanded'), GAMEPAD_CONFIG.throttleCollapseDelayMs);
}

// ============================================================================
// POLLING
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

    const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const deltaMs = lastPollTimestamp === null ? 16 : Math.max(1, nowPerf - lastPollTimestamp);
    lastPollTimestamp = nowPerf;
    lastGamepadActivity = Date.now();

    const leftStickY = applyDeadzone(gamepad.axes[1]);
    const rightStickX = applyDeadzone(gamepad.axes[2]);

    handleAxisButtons(gamepad, { throttle: leftStickY, steering: rightStickX });

    processThrottleAxis(leftStickY, deltaMs);
    lastThrottleAxis = leftStickY;

    processSteeringAxis(rightStickX, deltaMs);
    lastSteeringAxis = rightStickX;

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

    if (gamepad.buttons[14].pressed) {
        gamepadControlState.port_trim = Math.min(100, gamepadControlState.port_trim + GAMEPAD_CONFIG.listingRate);
        gamepadControlState.starboard_trim = Math.max(0, gamepadControlState.starboard_trim - GAMEPAD_CONFIG.listingRate);
        updateListingUI(gamepadControlState.port_trim, gamepadControlState.starboard_trim);
        showListingModal();
    }

    if (gamepad.buttons[15].pressed) {
        gamepadControlState.starboard_trim = Math.min(100, gamepadControlState.starboard_trim + GAMEPAD_CONFIG.listingRate);
        gamepadControlState.port_trim = Math.max(0, gamepadControlState.port_trim - GAMEPAD_CONFIG.listingRate);
        updateListingUI(gamepadControlState.port_trim, gamepadControlState.starboard_trim);
        showListingModal();
    }

    requestAnimationFrame(pollGamepad);
}

function startGamepadPolling() {
    console.log('🎮 Starting gamepad polling loop');
    pollGamepad();
}

// ============================================================================
// AXIS PROCESSING
// ============================================================================
function processThrottleAxis(leftStickY, deltaMs) {
    if (axisSupportsPilotHold('throttle') && isPilotHoldActive('throttle')) {
        const heldValue = Math.round(pilotHoldState.throttle.heldValue ?? 0);
        if (gamepadControlState.throttle !== heldValue) {
            gamepadControlState.throttle = heldValue;
            updateThrottleUI(gamepadControlState.throttle);
        }
        return;
    }

    const schema = resolveAxisBehavior('throttle');
    if (schema === 'springy') {
        updateThrottleSpringy(leftStickY, deltaMs);
    } else {
        updateThrottleSticky(leftStickY, deltaMs);
    }
}

function processSteeringAxis(rightStickX, deltaMs) {
    if (axisSupportsPilotHold('steering') && isPilotHoldActive('steering')) {
        const heldValue = Math.round(pilotHoldState.steering.heldValue ?? 0);
        if (gamepadControlState.steering !== heldValue) {
            gamepadControlState.steering = heldValue;
            updateSteeringUI(gamepadControlState.steering);
        }
        return;
    }

    const schema = resolveAxisBehavior('steering');
    if (schema === 'springy') {
        updateSteeringSpringy(rightStickX, deltaMs);
    } else {
        updateSteeringSticky(rightStickX, deltaMs);
    }
}

function updateThrottleSticky(leftStickY, deltaMs) {
    const currentValue = gamepadControlState.throttle;
    const currentGear = getGearFromValue(currentValue);

    if (gearCrossingLockout && Math.abs(leftStickY) < GAMEPAD_CONFIG.gearReleaseDeadzone) {
        gearCrossingLockout = false;
        enteredNeutralFrom = null;
        console.log('✅ Gear lockout RELEASED - stick returned to center');
    }

    if (leftStickY === 0 || gearCrossingLockout) return;

    const deltaLimit = getAxisRampDelta('throttle', deltaMs);
    const delta = clamp(-leftStickY * GAMEPAD_CONFIG.throttleSensitivity, -deltaLimit, deltaLimit);
    let newThrottle = clamp(currentValue + delta, -100, 100);
    const newGear = getGearFromValue(newThrottle);

    if (currentGear !== 'N' && newGear === 'N') {
        enteredNeutralFrom = currentGear;
        console.log(`ℹ️ Entered NEUTRAL from ${currentGear}`);
    }

    if (currentGear === 'N' && newGear !== 'N' && enteredNeutralFrom && enteredNeutralFrom !== newGear) {
        gearCrossingLockout = true;
        vibrateGamepad();
        console.log(`⚠️ GEAR CROSSING BLOCKED! Entered neutral from ${enteredNeutralFrom}, attempting ${newGear}. Release stick to center to shift.`);
        return;
    }

    gamepadControlState.throttle = Math.round(newThrottle);

    if (currentGear !== newGear) {
        showGearPopup(newGear);
    }

    if (currentGear === 'N' && newGear !== 'N' && enteredNeutralFrom === newGear) {
        enteredNeutralFrom = null;
    }

    updateThrottleUI(gamepadControlState.throttle);
}

function updateThrottleSpringy(leftStickY, deltaMs) {
    const normalized = clamp(-leftStickY, -1, 1);
    const scaled = clamp(Math.round(normalized * 100), -100, 100);

    handleSpringyGearLifecycle(normalized, Date.now());

    let desiredCommand = 0;
    if (!springyShiftCandidate && !springyRequiresRecenter) {
        if (springyThrottleGear === 'F') {
            desiredCommand = Math.max(0, scaled);
        } else if (springyThrottleGear === 'R') {
            desiredCommand = Math.min(0, scaled);
        }
    }

    applySpringyCommand('throttle', desiredCommand, deltaMs);
}

function handleSpringyGearLifecycle(normalizedValue, timestamp) {
    const magnitude = Math.abs(normalizedValue);
    const deadzone = GAMEPAD_CONFIG.gearReleaseDeadzone;
    const threshold = SPRINGY_SCHEMA_CONFIG.gearShiftThreshold;
    const direction = magnitude === 0 ? 0 : normalizedValue > 0 ? 1 : -1;

    if (springyRequiresRecenter) {
        if (magnitude <= deadzone) {
            springyRequiresRecenter = false;
            updateThrottleUI(gamepadControlState.throttle);
        } else {
            return;
        }
    }

    if (direction === 0) {
        if (springyShiftCandidate) {
            clearGearShiftProgress();
            springyShiftCandidate = null;
            updateThrottleUI(gamepadControlState.throttle);
        }
        return;
    }

    const target = getSpringyShiftTarget(direction);
    if (!target) {
        if (springyShiftCandidate) {
            clearGearShiftProgress();
            springyShiftCandidate = null;
            updateThrottleUI(gamepadControlState.throttle);
        }
        return;
    }

    if (!springyShiftCandidate) {
        if (magnitude >= threshold) {
            springyShiftCandidate = { target, startedAt: timestamp };
            renderGearShiftProgress(target, 0);
            updateThrottleUI(gamepadControlState.throttle);
        }
        return;
    }

    if (springyShiftCandidate.target !== target) {
        springyShiftCandidate = null;
        clearGearShiftProgress();
        updateThrottleUI(gamepadControlState.throttle);
        return;
    }

    if (magnitude <= deadzone) {
        springyShiftCandidate = null;
        clearGearShiftProgress();
        updateThrottleUI(gamepadControlState.throttle);
        return;
    }

    if (magnitude < threshold) {
        springyShiftCandidate.startedAt = timestamp;
        renderGearShiftProgress(target, 0);
        updateThrottleUI(gamepadControlState.throttle);
        return;
    }

    const elapsed = timestamp - springyShiftCandidate.startedAt;
    const holdMs = SPRINGY_SCHEMA_CONFIG.gearShiftHoldMs;
    const progress = clamp(elapsed / holdMs, 0, 1);
    renderGearShiftProgress(target, progress);

    if (elapsed >= holdMs) {
        clearGearShiftProgress();
        if (springyThrottleGear !== target) {
            springyThrottleGear = target;
            showGearPopup(target);
            updateThrottleUI(gamepadControlState.throttle);
        } else {
            showGearPopup(target);
        }
        springyShiftCandidate = null;
        springyRequiresRecenter = true;
        updateThrottleUI(gamepadControlState.throttle);
    }
}

function getSpringyShiftTarget(direction) {
    if (springyThrottleGear === 'N') return direction > 0 ? 'F' : 'R';
    if (springyThrottleGear === 'F' && direction < 0) return 'N';
    if (springyThrottleGear === 'R' && direction > 0) return 'N';
    return null;
}

function updateSteeringSticky(rightStickX, deltaMs) {
    if (rightStickX === 0) return;
    const delta = rightStickX * GAMEPAD_CONFIG.steeringSensitivity;
    const deltaLimit = getAxisRampDelta('steering', deltaMs);
    const limitedDelta = clamp(delta, -deltaLimit, deltaLimit);

    let newSteering = clamp(gamepadControlState.steering + limitedDelta, -100, 100);
    gamepadControlState.steering = Math.round(newSteering);
    updateSteeringUI(gamepadControlState.steering);
}

function updateSteeringSpringy(rightStickX, deltaMs) {
    const scaled = clamp(Math.round(rightStickX * 100), -100, 100);
    applySpringyCommand('steering', scaled, deltaMs);
}

// ============================================================================
// UI EXPORTS
// ============================================================================
export function updateThrottleUI(throttle) {
    const displayThrottle = getThrottleDisplayValue(throttle);

    const gearFill = document.getElementById('gear-fill');
    if (gearFill) {
        const visualPercent = displayThrottle / 100;
        const VISUAL_HALF = 47.5;
        const visualOffset = visualPercent * VISUAL_HALF;
        gearFill.style.height = `${Math.abs(visualOffset)}%`;
        if (visualOffset > 0) {
            gearFill.style.bottom = '50%';
            gearFill.style.top = 'auto';
        } else {
            gearFill.style.top = '50%';
            gearFill.style.bottom = 'auto';
        }
    }

    const gearThumb = document.querySelector('.gear-thumb');
    if (gearThumb) {
        const visualPercent = displayThrottle / 100;
        const VISUAL_HALF = 47.5;
        const visualOffset = visualPercent * VISUAL_HALF;
        const thumbPos = 50 + visualOffset;
        gearThumb.style.bottom = `${thumbPos}%`;
    }

    const gearThumbText = gearThumb?.querySelector('.gear-thumb-text');
    const textN = gearThumbText?.querySelector('.text-n');
    const textNeutral = gearThumbText?.querySelector('.text-neutral');

    if (textN && textNeutral) {
        const gearLetter = resolveAxisBehavior('throttle') === 'springy' ? springyThrottleGear : getGearFromValue(throttle);
        const percentValue = Math.round(Math.abs(throttle));
        if (gearLetter === 'N') {
            textN.textContent = 'N';
            textNeutral.textContent = 'NEUTRAL';
        } else {
            textN.textContent = gearLetter;
            textNeutral.textContent = `${percentValue}%`;
        }
    }

    expandThrottleWrapper();
}

function getThrottleDisplayValue(throttle) {
    if (resolveAxisBehavior('throttle') !== 'springy') {
        return throttle;
    }

    const neutralEdge = GAMEPAD_CONFIG.gearNeutralBand.max;

    if (springyShiftCandidate) {
        return springyShiftCandidate.target === 'F' ? neutralEdge : -neutralEdge;
    }

    if (springyThrottleGear === 'F' && Math.abs(throttle) < neutralEdge) {
        return neutralEdge;
    }

    if (springyThrottleGear === 'R' && Math.abs(throttle) < neutralEdge) {
        return -neutralEdge;
    }

    return throttle;
}

export function updateSteeringUI(steering) {
    const degrees = (steering / 100) * 35;
    const rudderPointer = document.getElementById('rudder-pointer');
    if (rudderPointer) {
        const visualAngle = -degrees;
        rudderPointer.setAttribute('transform', `rotate(${visualAngle}, 144, 0)`);
    }

    const rudderInput = document.getElementById('rudder-input');
    if (rudderInput) {
        rudderInput.value = Math.round(degrees);
    }

    const steeringValue = document.getElementById('rudder-angle-value');
    if (steeringValue) {
        steeringValue.textContent = Math.round(degrees);
        const boatStat = document.getElementById('boat-rudder-stat');
        if (boatStat) {
            boatStat.classList.add('updating');
            setTimeout(() => boatStat.classList.remove('updating'), 300);
        }
    }

    updatePilotHoldIndicator();
}

export function updateEngineTrimUI(trim) {
    const trimValue = Math.round(Math.max(0, Math.min(100, trim)));

    const trimValueEl = document.getElementById('trim-value');
    if (trimValueEl) {
        trimValueEl.textContent = trimValue;
        const boatStat = document.getElementById('boat-trim-stat');
        if (boatStat) {
            boatStat.classList.add('updating');
            setTimeout(() => boatStat.classList.remove('updating'), 300);
        }
    }

    const trimFill = document.getElementById('trim-fill');
    if (trimFill) {
        trimFill.style.height = `${trimValue}%`;
    }

    const trimThumb = document.getElementById('trim-thumb');
    if (trimThumb && trimThumb.parentElement) {
        const parentHeight = trimThumb.parentElement.offsetHeight;
        const thumbHeight = trimThumb.offsetHeight;
        if (parentHeight > 0 && thumbHeight > 0) {
            const travelRange = parentHeight - thumbHeight;
            const positionPercent = 1 - trimValue / 100;
            const thumbTop = travelRange * positionPercent + thumbHeight / 2;
            trimThumb.style.top = `${thumbTop}px`;
        }
    }

    const trimReadout = document.getElementById('trim-readout');
    if (trimReadout) {
        trimReadout.textContent = trimValue;
    }

    const trimPointer = document.querySelector('.trim-pointer-img');
    if (trimPointer) {
        const BASE = -15;
        const SPAN = 30;
        const rotation = BASE + SPAN - (trimValue / 100) * SPAN;
        trimPointer.style.transform = `rotate(${rotation}deg)`;
    }
}

export function updateListingUI(portTrim, starboardTrim) {
    gamepadControlState.port_trim = portTrim;
    gamepadControlState.starboard_trim = starboardTrim;
    console.log(`Listing Updated: Port=${portTrim}, Stbd=${starboardTrim}`);
}

// ============================================================================
// MODALS
// ============================================================================
let trimModalTimeout = null;

function showTrimModal() {
    const backdrop = document.getElementById('trim-modal-backdrop');
    const container = document.getElementById('trim-modal-container');
    if (backdrop && container) {
        backdrop.style.display = 'block';
        container.style.display = 'block';
    }

    if (trimModalTimeout) clearTimeout(trimModalTimeout);
    trimModalTimeout = setTimeout(() => {
        if (backdrop && container) {
            backdrop.style.display = 'none';
            container.style.display = 'none';
        }
    }, GAMEPAD_CONFIG.trimModalTimeoutMs);
}

let listingModalTimeout = null;

function showListingModal() {
    const backdrop = document.getElementById('listing-modal-backdrop');
    const container = document.getElementById('listing-modal-container');
    if (backdrop && container) {
        backdrop.style.display = 'block';
        container.style.display = 'block';
    }

    if (listingModalTimeout) clearTimeout(listingModalTimeout);
    listingModalTimeout = setTimeout(() => {
        if (backdrop && container) {
            backdrop.style.display = 'none';
            container.style.display = 'none';
        }
    }, GAMEPAD_CONFIG.listingModalTimeoutMs);
}
