/* SCRIPT // BUTTONS   */

// ============================================================================
// MODULE SCOPED VARIABLES
// ============================================================================

// DOM Element references
const controllerHeartbeat = document.getElementById('controller-heartbeat');
const deviceHeartbeats = document.getElementById('device-heartbeats');
const connectionIndicator = document.getElementById('connection-indicator');

// Module-scoped state
// Initialize with a default structure to prevent errors on first load
let deviceStates = {
    '0x550': [0, 0, 0, 0],
    '0x551': [0, 0, 0, 0],
    '0x552': [0, 0, 0, 0]
};

// ============================================================================
// EXPORTED INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initializes all safety cap click listeners.
 */
export function initializeSafetyCaps() {
    const safetyCaps = document.querySelectorAll('.safety-cap');
    
    safetyCaps.forEach(cap => {
        const controlButton = cap.closest('.control-button');
        if (!controlButton) return;
        const deviceName = controlButton.dataset.device;
        
        cap.addEventListener('click', function () {
            // Assume editMode is a global variable
            if (window.editMode) return; // Block in editMode
            this.classList.toggle('open');
            updateButtonArmedState(deviceName);
        });
    });
}

/**
 * Initializes all payload button click listeners.
 */
export function initializeButtons() {
    const buttons = document.querySelectorAll('.control-button button');
    
    buttons.forEach(button => {
        const controlButton = button.closest('.control-button');
        if (!controlButton) return;
        const deviceName = controlButton.dataset.device;
        
        // Initialize the button state based on safety cap
        updateButtonArmedState(deviceName);
        
        button.addEventListener('click', () => {
            // Assume editMode is a global variable
            if (window.editMode) {
                // openEditModal(deviceName); // Assuming openEditModal is defined elsewhere
                console.log('Edit mode: opening modal for', deviceName);
            } else {
                handleButtonClick(deviceName);
            }
        });

    });
}

// ============================================================================
// EXPORTED STATE AND UI UPDATE FUNCTIONS (for WebSocket)
// ============================================================================

/**
 * Public function to update the device states from an external source (like WebSocket).
 * @param {object} newStates - The new device states object.
 */
export function setDeviceStates(newStates) {
    if (newStates) {
        deviceStates = newStates;
        // After updating state, refresh all UI elements that depend on it
        updateAllButtonStates();
        updateAllLedStates();
        updateHeartbeatDisplay();
    }
}

/**
 * Update all button armed/active states.
 */
export function updateAllButtonStates() {
    document.querySelectorAll('.control-button').forEach(controlButton => {
        const deviceName = controlButton.dataset.device;
        if (deviceName) {
            updateButtonArmedState(deviceName);
        }
    });
}

/**
 * Update all LED/on-state indicators.
 */
export function updateAllLedStates() {
    document.querySelectorAll('.control-button').forEach(controlButton => {
        const deviceName = controlButton.dataset.device;
        const button = controlButton.querySelector('button');

        if (!button || !deviceName) return;

        const id = button.dataset.id;
        const bit = parseInt(button.dataset.bit);
        
        if (!deviceStates[id]) return; // Guard against missing state data

        let state = 0;
        if (bit < 8) {
            state = (deviceStates[id][0] >> bit) & 1;
        } else {
            const byteIndex = Math.floor(bit / 8);
            const bitInByte = bit % 8;
            if (deviceStates[id][byteIndex] !== undefined) {
                state = (deviceStates[id][byteIndex] >> bitInByte) & 1;
            }
        }

        if (state === 1) {
            button.classList.add('on');
        } else {
            button.classList.remove('on');
        }
    });
}

/**
 * Update the heartbeat debug displays.
 */
export function updateHeartbeatDisplay() {
    if (!controllerHeartbeat || !deviceHeartbeats) return;
    
    // Controller heartbeat display
    let controllerText = '';
    if (deviceStates['0x550']) {
        controllerText += `0x550: ${deviceStates['0x550'].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
    }
    if (deviceStates['0x551']) {
        controllerText += `0x551: ${deviceStates['0x551'].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
    }
    if (deviceStates['0x552']) {
        controllerText += `0x552: ${deviceStates['0x552'].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
    }
    controllerHeartbeat.textContent = controllerText || 'No controller heartbeats';
    
    // Device heartbeat display (placeholder)
    deviceHeartbeats.textContent = 'No device heartbeats received'; // This seems to be a placeholder
}

// ============================================================================
// INTERNAL HELPER FUNCTIONS
// ============================================================================

/**
 * Update the armed state of a single button based on safety cap and connection.
 * @param {string} deviceName - The data-device name.
 */
function updateButtonArmedState(deviceName) {
    const controlButton = document.querySelector(`[data-device="${deviceName}"]`);
    if (!controlButton) return;

    const button = controlButton.querySelector('button');
    const safetyCap = controlButton.querySelector('.safety-cap');
    if (!button || !safetyCap) return;

    // Get current state
    const id = button.dataset.id;
    const bit = parseInt(button.dataset.bit);

    if (!deviceStates[id]) return; // Guard against missing state data

    let state = 0;
    if (bit < 8) {
        state = (deviceStates[id][0] >> bit) & 1;
    } else {
        const byteIndex = Math.floor(bit / 8);
        const bitInByte = bit % 8;
        if (deviceStates[id][byteIndex] !== undefined) {
            state = (deviceStates[id][byteIndex] >> bitInByte) & 1;
        }
    }

    // only if there is a connection
    const isConnected = document.body.classList.contains('connected');

    // Update button appearance
    if (safetyCap.classList.contains('open') && isConnected) {
        if (state === 1) {
            button.classList.add('active');
            button.classList.remove('armed');
        } else {
            button.classList.add('armed');
            button.classList.remove('active');
        }
    } else {
        button.classList.remove('armed', 'active');
    }
}

/**
 * Handle button click logic.
 * @param {string} deviceName - The data-device name.
 */
function handleButtonClick(deviceName) {
    const controlButton = document.querySelector(`[data-device="${deviceName}"]`);
    if (!controlButton) return;
    
    const button = controlButton.querySelector('button');
    const safetyCap = controlButton.querySelector('.safety-cap');
    
    // Check if safety cap is open
    if (!safetyCap || !safetyCap.classList.contains('open')) {
        console.log('Safety cap is closed. Cannot activate button.');
        return;
    }
    
    const id = button.dataset.id;
    const bit = button.dataset.bit;
    
    // Send CAN button command
    CANbutton(id, bit);
}

/**
 * Main CAN button handler (via old FETCH method).
 */
function CANbutton(id, loc) {
    console.log(`Button click: ${id}, bit ${loc}`);
    
    // Don't update local state yet - wait for server confirmation
    
    // Send message to Teensy
    let msg = 'STARTMSG' + id + ',' + loc + "ENDMSG";
    
    // Use relative URL instead of hardcoded IP
    fetch("/button-click", {
        method: "POST",
        headers: {"Content-Type": "text/plain"},
        body: msg
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(data => {
        console.log('Response:', data);
        // Request status update after button press
        requestStatus();
    })
    .catch(error => {
        console.error('Error sending button command:', error);
        if (connectionIndicator) {
            connectionIndicator.classList.add('disconnected');
        }
        alert('Failed to send command to device');
    });
}

/**
 * Request status from Teensy (via old FETCH method).
 */
function requestStatus() {
    fetch("/status")
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.states) {
            // Use the new setter function to update state and UI
            setDeviceStates(data.states);
            
            if (connectionIndicator) {
                connectionIndicator.classList.remove('disconnected');
            }
            // Add class connected to <body>
            document.body.classList.add('connected');
            document.body.classList.remove('disconnected');
        }
    })
    .catch(error => {
        console.error('Error fetching status:', error);
        if (connectionIndicator) {
            connectionIndicator.classList.add('disconnected');
        }
        // Switching to mode disconnected
        document.body.classList.add('disconnected');
        document.body.classList.remove('connected');
    });
}

// Note: The duplicate gamepad sender has been removed as it's in main.js