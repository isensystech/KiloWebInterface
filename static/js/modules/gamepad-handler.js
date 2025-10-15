/*
 * gamepad-handler.js
 *
 * Responsibilities:
 * - Detect gamepad connection/disconnection.
 * - Continuously poll the connected gamepad for its state (axes and buttons).
 * - Maintain a single state object for all controls.
 * - This file does NOT send data; it only updates the global state.
 */

// This object will be exported to be used by other modules if needed,
// but its primary purpose is to be read by the sender interval in main.js

export const gamepadControlState = {
    type: "gamepad.set",
    throttle: 0,
    steering: 0,
    engine_trim: 0,
    port_trim: 0,
    starboard_trim: 0,
    button_a: 0,
    button_b: 0,
    button_x: 0,
    button_y: 0,
    button_lt: 0,
    button_rt: 0,
    button_lb: 0,
    button_rb: 0,
    button_start: 0,
    button_back: 0
};

let gamepadIndex = null;

/**
 * The main polling loop. This runs continuously using requestAnimationFrame
 * to efficiently read gamepad input and update the state object.
 */
function pollGamepad() {
    if (gamepadIndex === null) {
        return; // Stop the loop if the gamepad disconnects
    }

    const gamepad = navigator.getGamepads()[gamepadIndex];
    if (!gamepad) {
        requestAnimationFrame(pollGamepad); // Wait for the next frame
        return;
    }

    // --- Throttle (Left Stick Y-axis) ---
    // Directly maps stick position to throttle value, fixing the accumulator bug.
    const throttleRaw = gamepad.axes[1]; // -1 is up, +1 is down
    const throttleDeadzone = 0.10;
    if (Math.abs(throttleRaw) > throttleDeadzone) {
        // Multiply by -100 because "up" (-1) should be positive throttle.
        gamepadControlState.throttle = Math.round(throttleRaw * -100);
    } else {
        gamepadControlState.throttle = 0; // Snap to zero when in deadzone
    }

    // --- Steering (Right Stick X-axis) ---
    // Directly maps stick position to steering value.
    const steeringRaw = gamepad.axes[2]; // -1 is left, +1 is right
    const steeringDeadzone = 0.10;
    if (Math.abs(steeringRaw) > steeringDeadzone) {
        gamepadControlState.steering = Math.round(steeringRaw * 35);
    } else {
        gamepadControlState.steering = 0; // Snap to zero
    }

    // --- Engine Trim (D-Pad Up/Down) ---
    // This is a simple implementation that increments/decrements on each frame.
    // A more advanced version might use button press events to avoid rapid changes.
    const dpadUp = gamepad.buttons[12].pressed;
    const dpadDown = gamepad.buttons[13].pressed;
    if (dpadUp) {
        gamepadControlState.engine_trim = Math.min(100, gamepadControlState.engine_trim + 0.5);
    } else if (dpadDown) {
        gamepadControlState.engine_trim = Math.max(0, gamepadControlState.engine_trim - 0.5);
    }

    // Loop on the next available screen refresh
    requestAnimationFrame(pollGamepad);
}

// --- Event Listeners for Gamepad Connection ---
window.addEventListener("gamepadconnected", (event) => {
    if (gamepadIndex === null) {
        gamepadIndex = event.gamepad.index;
        console.log(`✅ Gamepad connected at index ${gamepadIndex}. Starting poll loop.`);
        pollGamepad(); // Start the loop
    }
});

window.addEventListener("gamepaddisconnected", (event) => {
    if (event.gamepad.index === gamepadIndex) {
        gamepadIndex = null;
        console.log("❌ Gamepad disconnected. Resetting controls to neutral.");
        // Reset controls to a safe state
        gamepadControlState.throttle = 0;
        gamepadControlState.steering = 0;
    }
});