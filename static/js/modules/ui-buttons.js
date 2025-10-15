
      /* SCRIPT // BUTTONS   */
  

            // Safety cap functionality
            function initializeSafetyCaps() {
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
            function initializeButtons() {
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
                const led = document.getElementById(`led-${deviceName}`);
                
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
                    connectionIndicator.classList.add('disconnected');
                    alert('Failed to send command to device');
                });
            }

            // Update all button states
            function updateAllButtonStates() {
                document.querySelectorAll('.control-button').forEach(controlButton => {
                    const deviceName = controlButton.dataset.device;
                    updateButtonArmedState(deviceName);
                });
            }

            // Update all LED indicators
            function updateAllLedStates() {
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
            function updateHeartbeatDisplay() {
                // Controller heartbeat display
                let controllerText = '';
                controllerText += `0x550: ${deviceStates['0x550'].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
                controllerText += `0x551: ${deviceStates['0x551'].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
                controllerText += `0x552: ${deviceStates['0x552'].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
                controllerHeartbeat.textContent = controllerText || 'No controller heartbeats';
                
                // Device heartbeat display (would show actual device states from CAN responses)
                deviceHeartbeats.textContent = 'No device heartbeats received';
            }


            // Request status from Teensy
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
                    deviceStates = data.states;
                    updateAllButtonStates();
                    updateAllLedStates();
                    updateHeartbeatDisplay();
                    connectionIndicator.classList.remove('disconnected');

                    // Add class connected to <body>
                    document.body.classList.add('connected');
                    document.body.classList.remove('disconnected');
                }
            })
            .catch(error => {
                console.error('Error fetching status:', error);
                connectionIndicator.classList.add('disconnected');

                // Switching to mode disconnected
                document.body.classList.add('disconnected');
                document.body.classList.remove('connected');
            });
            }


        /* SCRIPT // Gamepad WebSocket Integration */

        // 1. This object will hold the current state of all gamepad controls.
        // We are only focusing on 'throttle' right now, but the others are here for the next steps.
        const gamepadControlState = {
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

        // 2. This function sends the current state to the server via WebSocket.
        // The global 'ws' object is created and managed in your websocket.js file.
        function sendGamepadState() {
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                window.ws.send(JSON.stringify(gamepadControlState));
            }
        }

        // 3. Once the page is loaded, we'll start a timer to send the gamepad state every 20ms.
        document.addEventListener('DOMContentLoaded', () => {
            console.log("Starting gamepad WebSocket sender (20ms interval).");
            setInterval(sendGamepadState, 20);
        }); 
