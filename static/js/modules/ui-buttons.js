/* SCRIPT // BUTTONS */

// Initialize device states
let deviceStates = {
    '0x550': [0, 0, 0, 0, 0, 0, 0, 0],
    '0x551': [0, 0, 0, 0, 0, 0, 0, 0],
    '0x552': [0, 0, 0, 0, 0, 0, 0, 0]
};

let editMode = false;

// Safety cap functionality
export function initializeSafetyCaps() {
    const safetyCaps = document.querySelectorAll('.safety-cap');
    
    safetyCaps.forEach(cap => {
        const controlButton = cap.closest('.control-button');
        const deviceName = controlButton.dataset.device;
        
        cap.addEventListener('click', function () {
            if (editMode) return; // Block in editMode
            this.classList.toggle('open');
            updateButtonArmedState(deviceName);
        });
    });
}

// Initialize button event listeners
export function initializeButtons() {
    const buttons = document.querySelectorAll('.control-button button');
    
    buttons.forEach(button => {
        const controlButton = button.closest('.control-button');
        const deviceName = controlButton.dataset.device;
        
        // Initialize the button state based on safety cap
        updateButtonArmedState(deviceName);
        
        button.addEventListener('click', () => {
            if (editMode) {
                openEditModal(deviceName);
            } else {
                handleButtonClick(deviceName);
            }
        });
    });
}

// Update the armed state of a button based on safety cap and connection
function updateButtonArmedState(deviceName) {
    const controlButton = document.querySelector(`[data-device="${deviceName}"]`);
    if (!controlButton) return;

    const button = controlButton.querySelector('button');
    const safetyCap = controlButton.querySelector('.safety-cap');

    // Get current state
    const id = button.dataset.id;
    const bit = parseInt(button.dataset.bit);

    let state = 0;
    if (bit < 8) {
        state = (deviceStates[id][0] >> bit) & 1;
    } else {
        const byteIndex = Math.floor(bit / 8);
        const bitInByte = bit % 8;
        state = (deviceStates[id][byteIndex] >> bitInByte) & 1;
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

// Handle button click
function handleButtonClick(deviceName) {
    const controlButton = document.querySelector(`[data-device="${deviceName}"]`);
    if (!controlButton) return;
    
    const button = controlButton.querySelector('button');
    const safetyCap = controlButton.querySelector('.safety-cap');
    
    // Check if safety cap is open
    if (!safetyCap.classList.contains('open')) {
        console.log('Safety cap is closed. Cannot activate button.');
        return;
    }
    
    const id = button.dataset.id;
    const bit = button.dataset.bit;
    
    // Send CAN button command
    CANbutton(id, bit);
}

// Main CAN button handler
function CANbutton(id, loc) {
    console.log(`Button click: ${id}, bit ${loc}`);
    
    let msg = 'STARTMSG' + id + ',' + loc + "ENDMSG";
    
    fetch("/button-click", {
        method: "POST",
        headers: {"Content-Type": "text/plain"},
        body: msg
    })
    .then(data => {
        if (data.states) {
            deviceStates = data.states;
            updateAllButtonStates();
            updateAllLedStates();
            updateHeartbeatDisplay();
            
            const connectionIndicator = document.getElementById('connection-indicator');
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
        const connectionIndicator = document.getElementById('connection-indicator');
        if (connectionIndicator) {
            connectionIndicator.classList.add('disconnected');
        }

        // Switching to mode disconnected
        document.body.classList.add('disconnected');
        document.body.classList.remove('connected');
    });
}

// Placeholder for edit modal (if you have one)
function openEditModal(deviceName) {
    console.log('Edit modal for:', deviceName);
    // Implement your edit modal logic here
}(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(data => {
        console.log('Response:', data);
        requestStatus();
    })
    .catch(error => {
        console.error('Error sending button command:', error);
        const connectionIndicator = document.getElementById('connection-indicator');
        if (connectionIndicator) {
            connectionIndicator.classList.add('disconnected');
        }
        alert('Failed to send command to device');
    });


// Update all button states
export function updateAllButtonStates() {
    document.querySelectorAll('.control-button').forEach(controlButton => {
        const deviceName = controlButton.dataset.device;
        updateButtonArmedState(deviceName);
    });
}

// Update all LED indicators
export function updateAllLedStates() {
    document.querySelectorAll('.control-button').forEach(controlButton => {
        const deviceName = controlButton.dataset.device;
        const button = controlButton.querySelector('button');

        if (!button) return;

        const id = button.dataset.id;
        const bit = parseInt(button.dataset.bit);

        let state = 0;
        if (bit < 8) {
            state = (deviceStates[id][0] >> bit) & 1;
        } else {
            const byteIndex = Math.floor(bit / 8);
            const bitInByte = bit % 8;
            state = (deviceStates[id][byteIndex] >> bitInByte) & 1;
        }

        if (state === 1) {
            button.classList.add('on');
        } else {
            button.classList.remove('on');
        }
    });
}

// Update the heartbeat displays
export function updateHeartbeatDisplay() {
    const controllerHeartbeat = document.getElementById('controller-heartbeat');
    const deviceHeartbeats = document.getElementById('device-heartbeats');
    
    if (!controllerHeartbeat || !deviceHeartbeats) return;
    
    let controllerText = '';
    controllerText += `0x550: ${deviceStates['0x550'].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
    controllerText += `0x551: ${deviceStates['0x551'].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
    controllerText += `0x552: ${deviceStates['0x552'].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
    controllerHeartbeat.textContent = controllerText || 'No controller heartbeats';
    
    deviceHeartbeats.textContent = 'No device heartbeats received';
}

// Request status from Teensy
export function requestStatus() {
    fetch("/status")
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.states) {
            deviceStates = data.states;
            updateAllButtonStates();
            updateAllLedStates();
            updateHeartbeatDisplay();
            
            const connectionIndicator = document.getElementById('connection-indicator');
            if (connectionIndicator) {
                connectionIndicator.classList.remove('disconnected');
            }

            document.body.classList.add('connected');
            document.body.classList.remove('disconnected');
        }
    })
    .catch(error => {
        console.error('Error fetching status:', error);
        const connectionIndicator = document.getElementById('connection-indicator');
        if (connectionIndicator) {
            connectionIndicator.classList.add('disconnected');
        }

        document.body.classList.add('disconnected');
        document.body.classList.remove('connected');
    });
}

