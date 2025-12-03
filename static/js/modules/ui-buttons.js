/* SCRIPT // BUTTONS   */

// ============================================================================
// CONFIGURATION
// ============================================================================
const BUTTONS_CONFIG = Object.freeze({
    // Legacy fetch endpoints used by the CAN relay
    buttonClickEndpoint: '/button-click',
    statusEndpoint: '/status',
    // Copy to show when no downstream devices report in
    heartbeatPlaceholderText: 'No device heartbeats received',
    // CAN IDs we always expect so UI renders with safe defaults
    defaultDeviceIds: ['0x550', '0x551', '0x552']
});

// ============================================================================
// MODULE SCOPED VARIABLES
// ============================================================================

// DOM Element references
const controllerHeartbeat = document.getElementById('controller-heartbeat');
const deviceHeartbeats = document.getElementById('device-heartbeats');
const connectionIndicator = document.getElementById('connection-indicator');

// Module-scoped state
// Initialize with a default structure to prevent errors on first load
let deviceStates = BUTTONS_CONFIG.defaultDeviceIds.reduce((acc, id) => {
    acc[id] = [0, 0, 0, 0];
    return acc;
}, {});

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
                if (window.buttonEditor?.openEditorForDevice) {
                    window.buttonEditor.openEditorForDevice(deviceName);
                }
                return;
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
    deviceHeartbeats.textContent = BUTTONS_CONFIG.heartbeatPlaceholderText; // This seems to be a placeholder
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
    fetch(BUTTONS_CONFIG.buttonClickEndpoint, {
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
    fetch(BUTTONS_CONFIG.statusEndpoint)
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







        // TAB 1: ENGINE. House Relay   //
        // 3-way relay control: Off / Auto / On
        document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.drawer-button-relay').forEach(group => {
            const offBtn  = group.querySelector('.toggle-btn.off');
            const autoBtn = group.querySelector('.toggle-btn.auto');
            const onBtn   = group.querySelector('.toggle-btn.on');

            // Find paired display within the same relay-controls block
            const displayValue = group.closest('.relay-controls')?.querySelector('.display-value');

            // Helpers
            const clearStates = () => {
            [offBtn, autoBtn, onBtn].filter(Boolean).forEach(b => {
                b.classList.remove('active'); // gray fill (manual selection)
                b.classList.remove('live');   // white outline (actual state)
            });
            };

            const getAutoLiveTarget = () => {
            // Default: 'on'. Switch to 'off' by setting data-live-default="off" on the group.
            return (group.dataset.liveDefault || 'on').toLowerCase() === 'off' ? offBtn : onBtn;
            };

            const updateDisplayForMode = (mode) => {
            if (!displayValue) return;

            if (mode === 'on') {
                // Show value from the ON button
                displayValue.textContent = onBtn.dataset.value || '--';
            } else if (mode === 'auto') {
                // Mirror the current live target in AUTO (default is ON)
                const liveTarget = getAutoLiveTarget();
                displayValue.textContent = liveTarget.dataset.value || '--';
            } else {
                // OFF -> placeholder
                displayValue.textContent = '--';
            }
            };

            const setMode = (mode) => {
            clearStates();

            if (mode === 'off') {
                offBtn?.classList.add('active');
                offBtn?.classList.add('live');         // real state = Off
            } else if (mode === 'on') {
                onBtn?.classList.add('active');
                onBtn?.classList.add('live');          // real state = On
            } else { // 'auto'
                autoBtn?.classList.add('active');      // manual selection is Auto (gray fill)
                getAutoLiveTarget()?.classList.add('live'); // real state decided externally (default here)
            }

            updateDisplayForMode(mode);
            group.dataset.mode = mode;
            };

            // Init — start from existing data-mode or 'auto'
            setMode(group.dataset.mode || 'auto');

            // Click handlers
            offBtn?.addEventListener('click',  () => setMode('off'));
            onBtn?.addEventListener('click',   () => setMode('on'));
            autoBtn?.addEventListener('click', () => setMode('auto'));

            // Public hook for telemetry: switch the live outline in AUTO without changing gray selection
            group.updateLive = (isOn) => {
            if ((group.dataset.mode || 'auto') !== 'auto') return;
            offBtn?.classList.remove('live');
            onBtn?.classList.remove('live');
            (isOn ? onBtn : offBtn)?.classList.add('live');
            if (displayValue) displayValue.textContent = isOn ? (onBtn?.dataset.value || '--') : '--';
            };
        });
        });
     

        // ENGINE. ANIMATION LOAD   //
        // Get loader element once */
        const getStartLoaderEl = () => document.getElementById('start-loader');

            // Show overlay with optional auto-hide //
            function showStartLoader(durationMs = 1200){
            // guard: the element must exist
            const el = getStartLoaderEl();
            if(!el) return;

            // prevent click-through interactions
            el.style.pointerEvents = 'auto';

            // show
            el.classList.add('show');

            // clear previous timers if any
            if (el._hideTimer) clearTimeout(el._hideTimer);

            // auto-hide after duration (we can remove this once real animation controls the lifecycle)
            el._hideTimer = setTimeout(() => hideStartLoader(), durationMs);
            }

            // Hide overlay //
            function hideStartLoader(){
            const el = getStartLoaderEl();
            if(!el) return;
            el.classList.remove('show');
            el.style.pointerEvents = 'none';
            }

            // Hook into existing ignition half buttons //
            document.addEventListener('DOMContentLoaded', () => {
            const btn = document.getElementById('ignitionBtn');
            if(!btn || btn.dataset.ignitionInit === '1') return;
            btn.dataset.ignitionInit = '1';

            const setState = (n) => btn.setAttribute('data-state', String(n));

            btn.addEventListener('click', (e) => {
                const currentState = Number(btn.getAttribute('data-state') || 1);
                if (currentState === 1 || currentState === 3) {
                    e.preventDefault();
                    setState(2);
                }
            });




            // left half remains the same
            const halfOff = btn.querySelector('.half-off');
            if (halfOff){
                halfOff.addEventListener('click', (e) => {
                e.stopPropagation();
                setState(1);
                // If loader was shown previously, ensure it is hidden
                hideStartLoader();
                });
            }

            // right half: now also trigger loader
            const halfStart = btn.querySelector('.half-start');
            if (halfStart){
                halfStart.addEventListener('click', (e) => {
                e.stopPropagation();
                setState(3);             // your existing green state
                showStartLoader();       // show loader overlay (auto hides)
                });
            }
            });
     
        
      
            function mountStartPower(opts = {}){
            const slot = document.querySelector('#start-loader .loader-slot');
            if (!slot) return;

            const fillMs = Number(opts.fillMs ?? 2000);
            const lineMs = Number(opts.lineMs ?? 1000);

            // Inject SVG (unit circumference via pathLength="1")
            slot.setAttribute('role', 'img');
            slot.setAttribute('aria-label', 'Starting…');
            slot.innerHTML = `
                <div class="start-power" style="--fill-ms:${fillMs}ms; --line-ms:${lineMs}ms" aria-hidden="true">
                <svg viewBox="0 0 100 100" focusable="false" aria-hidden="true">
                    <circle class="start-power__track" cx="50" cy="50" r="45"/>
                    <circle class="start-power__progress" id="startPowerProgress"
                            cx="50" cy="50" r="45" pathLength="1"
                            style="--start-frac:0.0833333; --sweep-frac:0.8333333;"/>
                    <line class="start-power__line" x1="50" y1="5.7" x2="50" y2="35"/>
                </svg>
                </div>
            `;

            const root = slot.querySelector('.start-power');
            const progress = slot.querySelector('#startPowerProgress');

            // Enforce jitter inline so cascade can't override it
            root.classList.add('is-booting');
            root.style.willChange = 'transform, filter';
            root.style.animation = `startPowerJitter ${fillMs}ms ease-in-out 0s 1 both`;

            if (progress){
                progress.addEventListener('animationend', () => {
                root.classList.remove('is-booting');
                root.style.animation = 'none';
                root.classList.add('is-filled');
                setTimeout(() => {
                    hideStartLoader();
                    const s = document.querySelector('#start-loader .loader-slot');
                    if (s) s.innerHTML = '';
                }, lineMs);
                }, { once: true });
            }
            }

            // Keep overlay visible for the whole run
            (function attachPowerToLoader(){
            const _origShow = window.showStartLoader;
            window.showStartLoader = function(){
                mountStartPower({ fillMs: 2000, lineMs: 1000 });
                if (typeof _origShow === 'function') _origShow(2000 + 1000 + 150);
            };
        })();
     
