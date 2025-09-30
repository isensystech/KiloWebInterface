      // SCRIPT // FOOTER and NAVIGATION   //
  
               // === Initial State ===
                let currentScreen = 1;
                let deviceStates = {
                '0x550': Array(8).fill(0),
                '0x551': Array(8).fill(0),
                '0x552': Array(8).fill(0)
                };

                // === DOM Elements ===
                const connectionIndicator = document.getElementById('connection-indicator');
                const statusBar = document.getElementById('status-bar');
                const debugPanel = document.getElementById('debug-panel');
                const controllerHeartbeat = document.getElementById('controller-heartbeat');
                const deviceHeartbeats = document.getElementById('device-heartbeats');

                // === Screen Navigation Logic ===
                function switchScreen(screenNumber) {
                // Deactivate all screens
                document.querySelectorAll('.screen').forEach(screen => {
                    screen.classList.remove('active');
                });
                const targetScreen = document.getElementById(`screen-${screenNumber}`);
                if (targetScreen) targetScreen.classList.add('active');

                // Update indicator dots
                document.querySelectorAll('.indicator-dot').forEach(dot => {
                    dot.classList.remove('active');
                });
                const activeDot = document.querySelector(`.indicator-dot[data-screen="${screenNumber}"]`);
                if (activeDot) activeDot.classList.add('active');

                // Update carousel title
                document.querySelectorAll('.carousel-title').forEach(title => {
                    title.classList.remove('active');
                });
                const visibleTitle = document.querySelector(`.carousel-title[data-screen="${screenNumber}"]`);
                if (visibleTitle) visibleTitle.classList.add('active');

                currentScreen = screenNumber;
                }

                // === Event Listeners ===

                // Arrows
                document.getElementById('prev-screen')?.addEventListener('click', () => {
                const prev = currentScreen === 1 ? 3 : currentScreen - 1;
                switchScreen(prev);
                });

                document.getElementById('next-screen')?.addEventListener('click', () => {
                const next = currentScreen === 3 ? 1 : currentScreen + 1;
                switchScreen(next);
                });

                // Dots
                document.querySelectorAll('.indicator-dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    const screenNumber = parseInt(dot.dataset.screen);
                    switchScreen(screenNumber);
                });
                });

                // Toggle debug panel
                statusBar?.addEventListener('click', () => {
                debugPanel.classList.toggle('open');
                });


 

      // SCRIPT // BUTTONS
  

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


 

      // SCRIPT // MODAL EDIT BUTTON   //
  

        // OPEN EDIT MODAL //

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOM loaded, initializing application');
            
            // Initialize UI components
            initializeSafetyCaps();
            initializeButtons();
            
            // Update initial state
            updateAllButtonStates();
            updateAllLedStates();
            updateHeartbeatDisplay();
            
            // Request status every 500ms
            setInterval(requestStatus, 500);

            // --- Live UTC Clock ---
            const timeElement = document.getElementById('utc-time');

            function updateUtcTime() {
                if (!timeElement) return; // Stop if the element doesn't exist

                const now = new Date();
                const hours = String(now.getUTCHours()).padStart(2, '0');
                const minutes = String(now.getUTCMinutes()).padStart(2, '0');
                const seconds = String(now.getUTCSeconds()).padStart(2, '0');

                timeElement.textContent = `${hours}:${minutes}:${seconds}`;
            }

            // Update the time every second
            setInterval(updateUtcTime, 1000);

            // And run it once immediately on load
            updateUtcTime();

            // --- Joystick Connection Indicator ---
            const joystickIndicator = document.getElementById('joystick-indicator');
            let hideJoystickTimeout;

            function updateJoystickStatus() {
                if (!joystickIndicator) return;

                // Check if any gamepads are connected
                const gamepads = navigator.getGamepads();
                const isConnected = gamepads && Array.from(gamepads).some(g => g !== null);

                if (isConnected) {
                    joystickIndicator.classList.add('connected');
                    joystickIndicator.classList.remove('disconnected');
                    joystickIndicator.classList.remove('hidden');

                    // Set a timer to hide the icon after 10 seconds
                    clearTimeout(hideJoystickTimeout); // Clear any previous timer
                    hideJoystickTimeout = setTimeout(() => {
                        joystickIndicator.classList.add('hidden');
                    }, 10000); // 10 seconds

                } else {
                    joystickIndicator.classList.add('disconnected');
                    joystickIndicator.classList.remove('connected');
                    joystickIndicator.classList.remove('hidden');
                    clearTimeout(hideJoystickTimeout); // Cancel the hide timer if it was running
                }
            }

            // Listen for gamepad connection events
            window.addEventListener("gamepadconnected", updateJoystickStatus);
            window.addEventListener("gamepaddisconnected", updateJoystickStatus);

            // Also, check the status once on page load
            updateJoystickStatus();
        });

        // Gear icon click — enter EDIT MODE
        document.addEventListener('DOMContentLoaded', () => {
            const editIcon = document.querySelector('.options-icon[alt="Settings"]');
            if (editIcon) {
                editIcon.addEventListener('click', () => {
                    // Close the debug panel
                    document.getElementById('debug-panel').classList.remove('open');

                    // Activate edit mode
                    editMode = true;

                    // Close all safety caps when entering edit mode
                    document.querySelectorAll('.safety-cap').forEach(cap => {
                        cap.classList.remove('open');
                    });

                        updateAllButtonStates(); // Recalculate states after closing
                        document.body.classList.add('editing-mode');
                        console.log('Entered EDIT MODE');
                });
            }
        });






    // EDIT MODE // 

            let editMode = false;

            function applySettingsToButton(settings) {
                const container = document.getElementById('edit-modal-container');
                container.style.display = 'none';
                document.body.classList.remove('editing-mode');
                editMode = false;

                // Find the button being edited (stored in a variable)
                if (currentEditingDevice && settings) {
                    const control = document.querySelector(`[data-device="${currentEditingDevice}"]`);
                    if (control) {

                        // Apply icon to button
                        const icon = control.querySelector('.button-icon');
                        if (icon) {                            icon.style.display = "none";

                            if (settings.icon && settings.icon.trim() !== "") {
                                icon.src = settings.icon;
                                icon.alt = "Icon";
                                icon.style.display = "block";
                            }
                        }

                        // Apply icon to safety cap
                        const capIcon = control.querySelector('.safety-cap img');
                        if (capIcon) {                            capIcon.style.display = "none";

                            if (settings.icon && settings.icon.trim() !== "") {
                                capIcon.src = settings.icon;
                                capIcon.alt = "Icon";
                                capIcon.style.display = "block";
                            }
                        }

                        // Apply label
                        const label = control.querySelector('.button-label');
                        if (label) label.textContent = settings.label;

                        // Apply safety cap visibility (on/off)
                        const cap = control.querySelector('.safety-cap');
                        if (cap) {
                            cap.style.display = settings.safetyCap ? 'flex' : 'none';
                        }

                        console.log(`Applied settings to "${currentEditingDevice}":`, settings);
                    }
                }

                currentEditingDevice = null; // Reset the tracking variable
            }


    // Close Edit Modal //
            function closeEditModal() {
                document.getElementById('edit-modal-container').style.display = 'none';
                document.getElementById('modal-backdrop').style.display = 'none';
                document.body.classList.remove('editing-mode');
                editMode = false;
                currentEditingDevice = null;
            }

            let currentEditingDevice = null;


    // Reading all the required data using the selected button //

            function openEditModal(deviceName) {
                currentEditingDevice = deviceName;

                const control = document.querySelector(`[data-device="${deviceName}"]`);
                const iconEl = control.querySelector('.button-icon');
                const icon = iconEl && iconEl.style.display !== "none" ? iconEl.getAttribute("src") : "";
                const cap = control.querySelector('.safety-cap');
                const label = control.querySelector('.button-label')?.textContent?.trim() || "Label";

                // New: determine mode from saved data-mode (if available)
                const mode = control.getAttribute("data-mode") || "disabled";

                // New: timer, if available

                const timer = control.getAttribute("data-timer") || "300";

                const safetyCap = cap?.style.display !== 'none';

                const settings = {
                    icon,
                    label,
                    safetyCap,
                    mode,
                    timer
                };

                insertModalHTML(settings); // pass the settings
            }

            // ↓ define the function separately
            function insertModalHTML(settings) {
                const container = document.getElementById('edit-modal-container');

                const icon = settings.icon !== "" ? settings.icon : "images/disabled.svg";
                const label = settings.label || "Label";
                const safetyCap = settings.safetyCap;
                const mode = settings.mode || "disabled";
                const timer = settings.timer || "300";

                container.innerHTML = 
                `<div class="editor-modal-backdrop">
                            <div class="editor-modal-window ${mode === "timer" ? "timer-active" : ""}">
                                <h2 class="editor-modal-title">Button edit</h2>
                                <div class="editor-modal-content">
                                      // Preview button area
                                    <div class="editor-preview-frame">
                                        <div class="editor-preview-content">
                                            <div class="editor-control-button preview-position" data-device="preview_button">
                                                  // Cap state container
                                                <div class="editor-cap-container ${safetyCap ? "state-safety" : "state-no-cap"}" onclick="toggleCapState(this)">
                                                    <div class="editor-safety-cap">
                                                        <img src="${icon}" alt="Icon on cap" class="editor-cap-icon">
                                                    </div>
                                                    <div class="editor-no-safety-cap"></div>
                                                    <div class="editor-safety-cap-hover"></div>
                                                </div>

                                                  // Button with icon   //
                                                <button class="editor-preview-button" data-id="0x999" data-bit="0">
                                                    <img src="${icon}" alt="Icon" class="editor-button-icon icon-selected">
                                                </button>

                                                  // Label below button   //
                                                <div class="editor-button-label edited" contenteditable="true">${label}</div>
                                            </div>
                                        </div>
                                    </div>

                            

                                  // Change Preview Button Icon   //

                                        <div class="editor-icon-picker-modal" id="iconPicker">
                                            <div class="editor-icon-grid">
                                                <img src="/static/images/disabled.svg" alt="Disabled" onclick="selectIcon(this)">
                                                <img src="/static/images/vtol.svg" alt="VTOL" onclick="selectIcon(this)">
                                                <img src="/static/images/helicopter.svg" alt="Helicopter" onclick="selectIcon(this)">
                                                <img src="/static/images/fpv.svg" alt="FPV Drone" onclick="selectIcon(this)">
                                                <img src="/static/images/uav.svg" alt="UAV Drone" onclick="selectIcon(this)">
                                                <img src="/static/images/torpedo.svg" alt="Torpedo" onclick="selectIcon(this)">
                                                <img src="/static/images/boat.svg" alt="Boat" onclick="selectIcon(this)">
                                                <img src="/static/images/mako.svg" alt="MAKO" onclick="selectIcon(this)">
                                                <img src="/static/images/kilo-icon.svg" alt="Kilo" onclick="selectIcon(this)">
                                                <img src="/static/images/catamaran.svg" alt="Catamaran" onclick="selectIcon(this)">
                                                <img src="/static/images/drift-buoy.svg" alt="VTOL" onclick="selectIcon(this)">
                                                <img src="/static/images/picsea.svg" alt="Picsea" onclick="selectIcon(this)">
                                                <img src="/static/images/6drov.svg" alt="6DROV" onclick="selectIcon(this)">
                                                <img src="/static/images/rov.svg" alt="ROV" onclick="selectIcon(this)">
                                                <img src="/static/images/tether.svg" alt="Tether" onclick="selectIcon(this)">                    
                                                <img src="/static/images/component-hardware.svg" alt="Hardware component" onclick="selectIcon(this)">
                                                <img src="/static/images/camera.svg" alt="Camera" onclick="selectIcon(this)">
                                                <img src="/static/images/robo-dog.svg" alt="Robo-dog" onclick="selectIcon(this)">
                                                <img src="/static/images/headquarters.svg" alt="Headquarters" onclick="selectIcon(this)">
                                                <img src="/static/images/satellite.svg" alt="Satellite" onclick="selectIcon(this)">
                                                <img src="/static/images/tower.svg" alt="Tower" onclick="selectIcon(this)">
                                                <img src="/static/images/scan-forward.svg" alt="Scan-forward" onclick="selectIcon(this)">
                                                <img src="/static/images/scan-side.svg" alt="Scan-side" onclick="selectIcon(this)">
                                                <img src="/static/images/dvl.svg" alt="DVL" onclick="selectIcon(this)">
                                                <img src="/static/images/12vchg.svg" alt="12 vchg" onclick="selectIcon(this)">
                                                <img src="/static/images/24vchg.svg" alt="24 vchg" onclick="selectIcon(this)">
                                                <img src="/static/images/actuator.svg" alt="Actuator" onclick="selectIcon(this)">
                                                <img src="/static/images/asterisk.svg" alt="Asterisk" onclick="selectIcon(this)">
                                                <img src="/static/images/atak.svg" alt="ATAK" onclick="selectIcon(this)">
                                                <img src="/static/images/bilge.svg" alt="Bilge" onclick="selectIcon(this)">
                                                <img src="/static/images/blower.svg" alt="Blower" onclick="selectIcon(this)">
                                                <img src="/static/images/engine.svg" alt="engine" onclick="selectIcon(this)">
                                                <img src="/static/images/gear.svg" alt="Gear" onclick="selectIcon(this)">                    
                                                <img src="/static/images/latch.svg" alt="Latch" onclick="selectIcon(this)">
                                                <img src="/static/images/radar.svg" alt="Radar" onclick="selectIcon(this)">
                                                <img src="/static/images/starter.svg" alt="Starter" onclick="selectIcon(this)">
                                                <img src="/static/images/timer.svg" alt="Timer" onclick="selectIcon(this)">
                                                <img src="/static/images/toggle.svg" alt="Toggle" onclick="selectIcon(this)">
                                            </div>
                                        </div>


                                  // Function button area   //
                                        <div class="editor-options-row">
                                            <div class="editor-option-wrapper" data-mode="disabled" onclick="selectMode(this)">
                                                <div class="editor-option-block">
                                                    <img src="/static/images/disabled.svg" alt="Disabled">
                                                </div>
                                                <span class="editor-option-label">Disabled</span>
                                            </div>

                                            <div class="editor-option-wrapper" data-mode="latch" onclick="selectMode(this)">
                                                <div class="editor-option-block">
                                                    <img src="/static/images/latch.svg" alt="Latch">
                                                </div>
                                                <span class="editor-option-label">One Shot</span>
                                            </div>

                                            <div class="editor-option-wrapper" data-mode="toggle" onclick="selectMode(this)">
                                                <div class="editor-option-block">
                                                    <img src="/static/images/toggle.svg" alt="Toggle">
                                                </div>
                                                <span class="editor-option-label">Momentary</span>
                                            </div>

                                            <div class="editor-option-wrapper" data-mode="timer" onclick="selectMode(this)">
                                                <div class="editor-option-block">
                                                    <img src="/static/images/timer.svg" alt="Timer">
                                                </div>
                                                <span class="editor-option-label">Timer</span>
                                            </div>
                                        </div>

                                        
                                          // Timer value box BELOW all buttons   //
                                        <div class="editor-value-box-wrapper">
                                            <div class="editor-value-box">
                                                <div class="editor-arrow-controls">
                                                    <button type="button" class="arrow-up" onclick="changeTimerValue(50)">▲</button>
                                                    <button type="button" class="arrow-down" onclick="changeTimerValue(-50)">▼</button>
                                                </div>
                                                <input type="number" min="100" max="9900" step="50" value="300" class="editor-value-input" />
                                                <span class="editor-unit-label">ms</span>
                                            </div>
                                        </div>



                                          // input output value   //
                                        <div class="editor-custom-input-row">
                                        <label class="editor-custom-label">CAN</label>

                                          // Первый блок: 0x 3 numbers   //
                                            <div class="editor-prefixed-wrapper bn-wrapper">
                                                <span class="editor-prefix">0x</span>
                                                <input type="text" maxlength="3" class="editor-prefixed-input" placeholder="###">
                                            </div>

                                          // Второй блок: длинное значение   //
                                            <div class="editor-prefixed-wrapper hex-wrapper">
                                                <input type="text" maxlength="23" class="editor-custom-input long-input" placeholder="00 00 00 00 00 00 00 00">
                                            </div>
                                        </div>




                                        <div class="editor-custom-input-row">
                                        <label class="editor-custom-label">Next Command</label>
                                        <select class="editor-select">
                                            <option value="none">NONE</option>
                                            <option value="start">1-1 Actuator</option>
                                            <option value="stop">1-2 Engine</option>
                                            <option value="reset">1-3 12V</option>
                                        </select>
                                        </div>





                                          // Cancel Apply buttons   //
                                        <div class="editor-modal-actions">
                                            <button class="editor-cancel-button">Cancel</button>
                                            <button class="editor-apply-button">Apply</button>
                                        </div>
                                    </div>
                            </div>
                </div>`;
                container.style.display = 'block';

            bindEditorEvents(); // event binding
        }

        // Modal inside //
        
                function selectIcon(element) {
                    let newSrc = element.getAttribute("src");
                    if (newSrc.includes("disabled.svg")) {
                        newSrc = "images/no-icon.svg";
                    }

                    const icon = document.querySelector(".editor-button-icon");
                    const capIcon = document.querySelector(".editor-cap-icon");

                    if (icon) {
                        icon.src = newSrc;
                        icon.style.display = "block";
                    }

                    if (capIcon) {
                        capIcon.src = newSrc;
                        capIcon.style.display = "block";
                    }

                    const iconPicker = document.getElementById("iconPicker");
                    if (iconPicker) iconPicker.style.display = "none";
                }


                function bindEditorEvents() {


            // Initialize Safety Cap state
            const cap = document.querySelector(".editor-cap-container");
            if (cap) {
                cap.classList.add("state-safety");

                cap.addEventListener("click", () => {
                    if (cap.classList.contains("state-safety")) {
                        cap.classList.remove("state-safety");
                        cap.classList.add("state-no-cap");
                    } else {
                        cap.classList.remove("state-no-cap");
                        cap.classList.add("state-safety");
                    }
                });
            }

            // Select mode (disabled, latch, toggle, timer)
            document.querySelectorAll(".editor-option-wrapper").forEach(wrapper => {
                wrapper.addEventListener("click", () => {
                    document.querySelectorAll(".editor-option-wrapper").forEach(item => {
                        item.classList.remove("active");
                    });
                    wrapper.classList.add("active");

                    const selectedMode = wrapper.getAttribute("data-mode");
                    const modalWindow = document.querySelector(".editor-modal-window");
                    const input = document.querySelector(".editor-value-input");

                    if (selectedMode === "timer") {
                        modalWindow.classList.add("timer-active");
                        input.removeAttribute("disabled");
                    } else {
                        modalWindow.classList.remove("timer-active");
                        input.setAttribute("disabled", true);
                    }
                });
            });

            // Timer: arrow up/down buttons
            document.querySelectorAll(".editor-arrow-controls button").forEach(btn => {
                btn.addEventListener("click", () => {
                    const delta = btn.classList.contains("arrow-up") ? 50 : -50;
                    const input = document.querySelector(".editor-value-input");
                    let value = parseInt(input.value) || 0;
                    value += delta;
                    if (value < 100) value = 100;
                    if (value > 9900) value = 9900;
                    input.value = value;
                });
            });

                // Editable label
                const label = document.querySelector(".editor-button-label");
                if (label) {
            
                    // Character limit (18 max)
                    label.addEventListener("input", () => {
                        if (label.textContent.length > 18) {
                            label.textContent = label.textContent.slice(0, 18);
                            placeCaretAtEnd(label); // keep cursor from jumping
                        }
                    });

                    label.addEventListener("keydown", (e) => {
                        if (e.key === "Enter") {
                            e.preventDefault(); // prevent line break
                        }
                    });


                    label.addEventListener("blur", () => {
                        if (label.textContent.trim() !== "") {
                            label.classList.add("edited");
                        } else {
                            label.classList.remove("edited");
                        }
                    });
                }

                // Icon picker popup
                const iconPicker = document.getElementById("iconPicker");
                const iconBtn = document.querySelector(".editor-preview-button");
                if (iconBtn && iconPicker) {
                    iconBtn.addEventListener("click", () => {
                        iconPicker.style.display = "block";
                    });
                }

                

            // Cancel button — reset everything
            const modalWindow = document.querySelector(".editor-modal-window");
            const cancelBtn = modalWindow?.querySelector(".editor-cancel-button");


            if (cancelBtn) {
                cancelBtn.addEventListener("click", () => {
                    document.querySelectorAll(".editor-option-wrapper").forEach(item => {
                        item.classList.remove("active");
                    });
                    const defaultMode = document.querySelector('.editor-option-wrapper[data-mode="disabled"]');
                    if (defaultMode) defaultMode.classList.add("active");

                    const label = document.querySelector(".editor-button-label");
                    if (label) {
                        label.textContent = " Label ";
                        label.classList.remove("edited");
                    }

                    const icon = document.querySelector(".editor-button-icon");
                    if (icon) {
                        icon.src = "images/unknown.svg";
                        icon.style.display = "block";
                        icon.style.filter = "";
                    }

                    const cap = document.querySelector(".editor-cap-container");
                    if (cap) {
                        cap.classList.remove("state-no-cap");
                        cap.classList.add("state-safety");
                    }

                    const input = document.querySelector(".editor-value-input");
                    if (input) {
                        input.value = "300";
                        input.setAttribute("disabled", true);
                    }

                    const modalWindow = document.querySelector(".editor-modal-window");
                    modalWindow.classList.remove("timer-active");

                    closeEditModal();
                });
            }

            // Apply button — return the current settings
            const applyBtn = document.querySelector(".editor-apply-button");
            if (applyBtn) {
                applyBtn.addEventListener("click", () => {
                    const mode = document.querySelector(".editor-option-wrapper.active")?.getAttribute("data-mode") || "none";
                    const label = document.querySelector(".editor-button-label")?.textContent.trim() || "";
                    const icon = document.querySelector(".editor-button-icon")?.getAttribute("src") || "";
                    const hasCap = document.querySelector(".editor-cap-container")?.classList.contains("state-safety") || false;
                    const timerValue = document.querySelector(".editor-value-input")?.value || "0";

                    const result = { mode, label, icon, safetyCap: hasCap, timer: timerValue };

                    console.log("Settings applied:", result);

                    applySettingsToButton(result);
                });
            }
        }

        // Character limit (18 max) //

        function placeCaretAtEnd(el) {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(el);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }



 

      // SCRIPT // MODAL TRIM   //
  

                function openTrimModal() {
                    document.getElementById("trim-modal-container").style.display = "block";


                                    const thumb = document.getElementById('trim-thumb');
                                    const fill = document.getElementById('trim-fill');
                                    const pointer = document.querySelector('.trim-pointer-img');
        const readout = document.getElementById('trim-readout');
                                    const sliderWrapper = document.querySelector('.trim-slider-wrapper');

                                    if (thumb && fill && pointer && sliderWrapper) {
                                    thumb.onmousedown = function (e) {
                                        e.preventDefault();
                                        document.onmousemove = function (e) {
                                        const rect = sliderWrapper.getBoundingClientRect();
                                        const minY = rect.top;
                                        const maxY = rect.bottom;




                                        
                                        let posY = e.clientY;

                                        posY = Math.max(minY, Math.min(posY, maxY));

                                        const percent = (posY - minY) / (maxY - minY);
                                        const thumbY = percent * sliderWrapper.offsetHeight;

                                        thumb.style.top = `${thumbY}px`;
                                        fill.style.height = `${(1 - percent) * 100}%`;

                                        const angle = -15 + percent * 30;
                                pointer.style.transform = `rotate(${angle}deg)`;
                                if (readout) {
                                    const scaled = (1 - percent) * 1.5;
                                    let value = Math.floor(scaled * 15);
                                    if (value > 15) value = 'UP';
                                    else if (value < 0) value = 0;
                                    readout.textContent = value;
                                }
                                if (readout) {
                                }
                                        };

                                        document.onmouseup = function () {
                                        document.onmousemove = null;
                                        };
                                    };
                                    }


                    document.getElementById("trim-modal-backdrop").style.display = "block";
                    

                }

                function closeTrimModal() {
                    document.getElementById("trim-modal-container").style.display = "none";
                    document.getElementById("trim-modal-backdrop").style.display = "none";
                }

                function applyTrimSettings() {
                    console.log("Apply Trim pressed");
                    closeTrimModal();
                }



                // SLIDER
                const thumb = document.getElementById('trim-thumb');
                const fill = document.getElementById('trim-fill');
                const pointer = document.querySelector('.trim-pointer-img');
                    thumb.onmousedown = function (e) {
                        e.preventDefault();
                        document.onmousemove = function (e) {
                            const slider = document.querySelector('.trim-slider-wrapper');
                            const rect = slider.getBoundingClientRect();
                            const minY = rect.top;
                            const maxY = rect.bottom;
                            let posY = e.clientY;

                            if (posY < minY) posY = minY;
                            if (posY > maxY) posY = maxY;

                            const percent = 1 - (posY - minY) / (maxY - minY);
                            const newTop = percent * 100;
                            thumb.style.top = `${percent * 100}%`;
                            fill.style.height = `${percent * 100}%`;

                            const angle = Math.round((percent * 30) - 15); // from -15° to +15°
                            if (pointer) {
                                    pointer.style.transform = `rotate(${angle}deg)`;
                                    if (readout) {
                                        const raw = Math.round((1 - percent) * 14) + 1;
                                        readout.textContent = raw > 15 ? 'UP' : (raw < 1 ? 1 : raw);

                                    }
                if (readout) {
                }
                            }
                            };
                        document.onmouseup = () => {
                        document.onmousemove = null;
                    };
                };




// SLIDER button //

                window.onload = function () {
                        const thumb = document.getElementById('trim-thumb');
                        const fill = document.getElementById('trim-fill');
                        const pointer = document.querySelector('.trim-pointer-img');
                        const sliderWrapper = document.querySelector('.trim-slider-wrapper');
                        const readout = document.getElementById('trim-readout'); // DEFINED HERE

                        if (!thumb || !fill || !pointer || !sliderWrapper || !readout) {
                            console.warn("Missing slider element(s)");
                            return;
                        }
                        
                        const edgeOffset = 16; // Top and bottom 
                        
                        thumb.onmousedown = function (e) {
                            e.preventDefault();

                            document.onmousemove = function (e) {
                                    const rect = sliderWrapper.getBoundingClientRect();
                                    const fullHeight = rect.height;
                                    const usableHeight = fullHeight - edgeOffset * 2;
                                    let mouseY = e.clientY - rect.top - edgeOffset;

                                    // Clamp inside the usable range
                                    mouseY = Math.max(0, Math.min(mouseY, usableHeight));

                                    // Update thumb position
                                    thumb.style.top = `${mouseY + edgeOffset}px`;

                                    // Update fill bar
                                    const percent = mouseY / usableHeight;
                                    fill.style.height = `${(1 - percent) * 100}%`;

                                    // Rotate pointer
                                    const angle = -60 + percent * 30;
                                    pointer.style.transform = `rotate(${angle}deg)`;
                                    if (readout) {
                                        const raw = Math.round((1 - percent) * 14) + 1;
                                        readout.textContent = raw > 15 ? 'UP' : (raw < 1 ? 1 : raw);
                                    }
                                    // Update readout value
                            };
                        };

                        document.onmouseup = function () {
                            document.onmousemove = null;
                        };
                };
                
 

      // SCRIPT // MODAL THROTTLE
  
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











    
 

      // BOAT // Rudder & Trim GAUGE row   //
  
        // BOAT // Rudder & Trim data bindings
        // - Non-invasive bridge: reads existing DOM state and mirrors it to the new row.
        // - No changes to existing logic elsewhere.

        // eslint-disable no-undef //
        (function () {
        // Cache DOM nodes once
        const rudderEl   = document.getElementById('rudder-angle-value');
        const trimEl     = document.getElementById('trim-value');
        const rudderWrap = document.getElementById('boat-rudder-stat');
        const trimWrap   = document.getElementById('boat-trim-stat');

        // Format number for display (integer, keep sign)
        function fmtInt(n) {
            const v = Math.round(Number(n) || 0);
            return v.toString();
        }

        // Brief visual tick to indicate fresh data
        function blip(el) {
            el && el.classList.add('updating');
            setTimeout(() => el && el.classList.remove('updating'), 120);
        }

        // Public: update Rudder Angle in degrees
        window.updateRudderAngle = function(angleDeg) {
            if (rudderEl) {
            rudderEl.textContent = fmtInt(angleDeg);
            blip(rudderWrap);
            }
        };

        // Public: update Trim in degrees //
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

        // Read current rudder angle from DOM without touching existing logic //
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

        // Read current trim angle from existing readout ".trim-readout" //
        function readTrimDeg() {
            if (!trimReadout) return null;
            const txt = (trimReadout.textContent || '').trim();
            // Accept forms like "-7", "-7°", " -7 deg " etc.
            const m = txt.match(/-?\d+/);
            if (m) return Number(m[0]);
            return null;
        }

        // Push to public updaters only when value actually changed //
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
 

      // SCRIPT // MODAL RULE RUDDER ANGLE INDICATOR   //
  
            function setRudderAngle(angle) {
            const pointer = document.getElementById("rudder-pointer");
            const centerX = 144;
            const centerY = 0;

            // 0° points down, +angle = starboard, -angle = port
            const visualAngle = -angle;

            pointer.setAttribute("transform", `rotate(${visualAngle}, ${centerX}, ${centerY})`);
            }


            //
            // Reads the angle from the input field and applies it to the pointer.
            // Ensures the angle stays within the allowed range (-35 to +35).
             //
            function updateRudderFromInput() {
            const input = document.getElementById("rudder-input");
            let angle = parseInt(input.value, 10);

            // Validate and clamp value
            if (isNaN(angle)) angle = 0;
            angle = Math.max(-35, Math.min(35, angle));

            setRudderAngle(angle);
            }

            // Automatically initialize the pointer when the page loads //
            
            window.addEventListener("DOMContentLoaded", () => {
            updateRudderFromInput();
            });



 

      // SCRIPT // Logitech F310   //

              // Left/Right Screen   //
          
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
         

              // Trim Modal   //
          
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
         
                        
              // Rudder Angle  //
          
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
         

              // Throttle  //
              // SCRIPT // MODAL THROTTLE  //
          
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
                    renderSlider(logicalPercent); // raw не нужен тут
                    requestAnimationFrame(pollThrottleControl);
                    return;
                }

                const prevValue = logicalPercent;
                logicalPercent -= raw * 0.02;
                logicalPercent = Math.max(-1, Math.min(1, logicalPercent));

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
         

// =======================
// MODAL GAUGES PANEL
// =======================

// === Safety block smart placement ===
// Moves .safety-block to the right of .gauges-panel if it overlaps the footer.
document.addEventListener('DOMContentLoaded', () => {
  const parent = document.querySelector('.gauges-button-panel');
  if (!parent) return;

  const panel  = parent.querySelector('.gauges-panel');
  const safety = parent.querySelector('.safety-block');
  const footer = document.querySelector('footer, .footer, #footer'); // common footer hooks

  // If any of required nodes are missing, bail out *only* from this feature
  if (!panel || !safety || !footer) return;

  // Ensure absolute children position relative to this parent
  // (if CSS forgot to make it positioned).
  if (getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative'; // safe fallback for absolute positioning
  }

  // Check viewport overlap between safety-block and footer
  const overlapsFooter = () => {
    const s = safety.getBoundingClientRect();
    const f = footer.getBoundingClientRect();
    // vertical intersection check
    return s.bottom > f.top && s.top < f.bottom;
  };

  // Place safety under the panel (default stacked layout)
  const placeStacked = () => {
    parent.classList.remove('side-safety');
    safety.style.position = ''; // back to normal flow
    safety.style.top = '';
    safety.style.left = '';
    safety.style.marginTop = 'auto';
  };

  // Place safety to the right of the panel, bottom-aligned to panel
  const placeSide = () => {
    parent.classList.add('side-safety');

    // Compute coordinates relative to the parent box
    const parentRect = parent.getBoundingClientRect();
    const panelRect  = panel.getBoundingClientRect();

    const leftPx = panelRect.width + 12; // 12px gap to the right of the panel
    const topPx  = (panelRect.bottom - parentRect.top) - safety.offsetHeight;

    safety.style.position = 'absolute';
    safety.style.left = `${leftPx}px`;
    safety.style.top  = `${topPx}px`;
    safety.style.marginTop = '0';
  };

  const update = () => {
    // Start from stacked to measure true overlap
    placeStacked();
    // Next frame, evaluate overlap and possibly move aside
    requestAnimationFrame(() => {
      if (overlapsFooter()) placeSide();
    });
  };

  // Recalculate on resize/scroll (footer visibility/position changes)
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('scroll',  update, { passive: true });

  // React to panel size changes (fonts/UI scale)
  if ('ResizeObserver' in window) {
    new ResizeObserver(update).observe(panel);
  }

  update();
});


// =======================
// ENGINE TEMPERATURE GAUGE
// =======================

// > 90% => var(--gauge-red), < 10% => var(--gauge-blue), else => white.
// === Engine temperature gauge: toggle classes to drive --bar-color ===
document.addEventListener('DOMContentLoaded', () => {
  const gauge = document.getElementById('engine-temperature-gauge');
  if (!gauge) return;

  // Read --pct (inline first, then computed)
  const readPct = () => {
    let raw = gauge.style.getPropertyValue('--pct');
    if (!raw) raw = getComputedStyle(gauge).getPropertyValue('--pct');
    const m = String(raw).match(/-?\d+(\.\d+)?/); // extract number
    return m ? parseFloat(m[0]) : 0;
  };

  const applyState = () => {
    const pct = readPct();
    // Clear previous state
    gauge.classList.remove('is-hot', 'is-cold');
    // Set new state
    if (pct > 90)      gauge.classList.add('is-hot');
    else if (pct < 10) gauge.classList.add('is-cold');
    // else neutral → token not set → fallback to white
  };

  // Initial
  applyState();

  // Re-apply when inline style (with --pct) changes
  new MutationObserver(applyState).observe(gauge, {
    attributes: true,
    attributeFilter: ['style']
  });
});

// === Fuel gauge color: <20% => var(--gauge-red) via --bar-color token ===
document.addEventListener('DOMContentLoaded', () => {
  const gauge = document.getElementById('fuel-gauge');
  if (!gauge) return;

  // Read --pct from inline style first, then computed style
  const readPct = () => {
    let raw = gauge.style.getPropertyValue('--pct');
    if (!raw) raw = getComputedStyle(gauge).getPropertyValue('--pct');
    const m = String(raw).match(/-?\d+(\.\d+)?/); // extract number
    const n = m ? parseFloat(m[0]) : 0;
    return Math.max(0, Math.min(100, n)); // clamp to 0..100
  };

  const apply = () => {
    const pct = readPct();
    // < 20% => add .is-low to drive --bar-color; otherwise remove it
    gauge.classList.toggle('is-low', pct < 20);
  };

  // Initial state
  apply();

  // Re-apply when inline style (with --pct) changes
  new MutationObserver(apply).observe(gauge, {
    attributes: true,
    attributeFilter: ['style']
  });

  // Optional: if layout code rewrites CSS vars during resize
  window.addEventListener('resize', apply, { passive: true });
});




      // MODAL DRAWER PANEL   //
  
    // Drawer tabs switching (data-tab = 1..8)
        (function () {
            const tabsRoot = document.getElementById('drawerTabs');      // tabs container
            const contentRoot = document.getElementById('drawerContent'); // panes container
            if (!tabsRoot || !contentRoot) return;

            const tabs  = Array.from(tabsRoot.querySelectorAll('.drawer-tab'));
            const panes = Array.from(contentRoot.querySelectorAll('.tab-pane'));

            // Activate a tab/pane by number
            function activate(n) {
            // 1) switch tab visuals
            tabs.forEach(t => t.classList.remove('active'));
            const tab = tabs.find(t => Number(t.dataset.tab) === n);
            if (tab) tab.classList.add('active');

            // 2) switch content panes
            panes.forEach(p => p.classList.remove('active'));
            const pane = panes.find(p => Number(p.dataset.tab) === n);
            if (pane) pane.classList.add('active');
            }

            // Click handlers for each tab
            tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const n = Number(tab.dataset.tab);
                activate(n);
            });
            // Accessibility: keyboard support
            tab.setAttribute('tabindex', '0');
            tab.setAttribute('role', 'tab');
            tab.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate(Number(tab.dataset.tab));
                }
            });
            });

            // Ensure initial state matches the HTML (active on load)
            const initial = tabs.find(t => t.classList.contains('active'));
            activate(initial ? Number(initial.dataset.tab) : 1);
        })();
 

          // TAB 1: Boat Control  //
      
                // Communication toggle: updates display from button data attributes
                    document.addEventListener('DOMContentLoaded', () => {
                    document.querySelectorAll('.comm-block').forEach(block => {
                        const displaySignal = block.querySelector('[data-key="signal"]');
                        const displayDbm    = block.querySelector('[data-key="dbm"]');
                        const buttons       = block.querySelectorAll('.comm-toggle .comm-btn');

                        // helper: apply values from a button
                        const applyFromBtn = (btn) => {
                        if (displaySignal) displaySignal.textContent = btn.dataset.signal ?? '--';
                        if (displayDbm)    displayDbm.textContent    = btn.dataset.dbm ?? '--';
                        };

                        // init: set from the pre-active button
                        const active = block.querySelector('.comm-btn.active') || buttons[0];
                        if (active) applyFromBtn(active);

                        // click handling
                        block.querySelector('.comm-toggle').addEventListener('click', (e) => {
                        const btn = e.target.closest('.comm-btn');
                        if (!btn) return;
                        buttons.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        applyFromBtn(btn);
                        });
                    });
                    });


            // === SOLO toggle styles (scoped) === //
                // JS scoped only to .solo-toggle to avoid collisions with existing handlers
                document.addEventListener('DOMContentLoaded', () => {
                document.querySelectorAll('.solo-toggle').forEach(group => {
                    group.addEventListener('click', (e) => {
                    const btn = e.target.closest('.solo-btn');
                    if (!btn || !group.contains(btn)) return;

                    // clear and set active within this isolated group
                    group.querySelectorAll('.solo-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    // No display to update here; extend later if needed
                    });
                });
                });


            // === SOLO3 toggle styles (scoped) === //
                // Scoped JS only for .solo3-toggle
                document.addEventListener('DOMContentLoaded', () => {
                document.querySelectorAll('.solo3-toggle').forEach(group => {
                    group.addEventListener('click', (e) => {
                    const btn = e.target.closest('.solo3-btn');
                    if (!btn || !group.contains(btn)) return;

                    // Clear and set active
                    group.querySelectorAll('.solo3-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Example: log or later update display if needed
                    console.log("Selected:", btn.textContent, btn.dataset.value);
                    });
                });
                });

            // === Pump === //
                document.addEventListener('DOMContentLoaded', () => {
                    document.querySelectorAll('.half-relay').forEach(group => {
                    const autoBtn = group.querySelector('.relay-btn.auto');
                    const onBtn   = group.querySelector('.relay-btn.on');

                    const clearStates = () => {
                        [autoBtn, onBtn].forEach(b => {
                        b.classList.remove('active');
                        b.classList.remove('live');
                        });
                    };

                    const getAutoLiveTarget = () => {
                        return (group.dataset.liveDefault || 'on').toLowerCase() === 'on' ? onBtn : autoBtn;
                    };

                    const setMode = (mode) => {
                        clearStates();

                        if (mode === 'auto') {
                        autoBtn.classList.add('active');
                        getAutoLiveTarget().classList.add('live');
                        } else if (mode === 'on') {
                        onBtn.classList.add('active');
                        onBtn.classList.add('live');
                        }

                        group.dataset.mode = mode;
                    };

                    // Инициализация: Auto по умолчанию
                    setMode(group.dataset.mode || 'auto');

                    // Обработчики кликов
                    autoBtn.addEventListener('click', () => setMode('auto'));
                    onBtn.addEventListener('click', () => setMode('on'));

                    // Внешнее обновление (например, по телеметрии)
                    group.updateLive = (isOn) => {
                        if ((group.dataset.mode || 'auto') !== 'auto') return;
                        autoBtn.classList.remove('live');
                        onBtn.classList.remove('live');
                        (isOn ? onBtn : autoBtn).classList.add('live');
                    };

                    // Сейчас: live = On
                    onBtn.classList.add('live');
                    });
                });

     

          // TAB 2: Payload Control  //
      
            // === Control of drawer display state ===
            // All comments in English.

            function setDrawerDisplay(state) {
            // state should be either "authorized" or "prohibited"
            const display = document.getElementById("drawer-display");
            if (!display) return;

            const icon = display.querySelector(".display-icon");
            const text = display.querySelector(".display-value");

            if (state === "authorized") {
                icon.src = "images/unlock-icon.svg";
                icon.alt = "Unlock";
                text.textContent = "Release Authorized";
            } else if (state === "prohibited") {
                icon.src = "images/lock-icon.svg";
                icon.alt = "Lock";
                text.textContent = "Release Prohibited";
            }
            }

            // Example: default is "authorized"
            // Later you can call setDrawerDisplay("prohibited") when external signal arrives
     


          // TAB 4: Battery Status   //
      
            document.addEventListener('DOMContentLoaded', () => {
            const btn = document.getElementById('ignitionBtn');

            const setState = (n) => btn.setAttribute('data-state', String(n));

            // Клик по всей кнопке в состояниях 1 и 3 -> переход в сплит (2)
            btn.addEventListener('click', (e) => {
                const s = Number(btn.getAttribute('data-state') || 1);
                if (s === 1 || s === 3) setState(2);
            });

            // Обработчики половинок в состоянии 2
            btn.querySelector('.half-off').addEventListener('click', (e) => {
                e.stopPropagation();           // не пускаем событие вверх
                setState(1);                   // Off -> назад в 1
            });
            btn.querySelector('.half-start').addEventListener('click', (e) => {
                e.stopPropagation();
                setState(3);                   // Start -> в 3 (зелёный)
            });
            });
     

          // TAB 4: ENGINE. House Relay   //
      
        // 3-way relay control: Off / Auto / On
        document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.drawer-button-relay').forEach(group => {
            const offBtn  = group.querySelector('.relay-btn.off');
            const autoBtn = group.querySelector('.relay-btn.auto');
            const onBtn   = group.querySelector('.relay-btn.on');

            // Find paired display within the same relay-controls block
            const displayValue = group.closest('.relay-controls')?.querySelector('.display-value');

            // Helpers
            const clearStates = () => {
            [offBtn, autoBtn, onBtn].forEach(b => {
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
                offBtn.classList.add('active');
                offBtn.classList.add('live');         // real state = Off
            } else if (mode === 'on') {
                onBtn.classList.add('active');
                onBtn.classList.add('live');          // real state = On
            } else { // 'auto'
                autoBtn.classList.add('active');      // manual selection is Auto (gray fill)
                getAutoLiveTarget().classList.add('live'); // real state decided externally (default here)
            }

            updateDisplayForMode(mode);
            group.dataset.mode = mode;
            };

            // Init — start from existing data-mode or 'auto'
            setMode(group.dataset.mode || 'auto');

            // Click handlers
            offBtn.addEventListener('click',  () => setMode('off'));
            onBtn.addEventListener('click',   () => setMode('on'));
            autoBtn.addEventListener('click', () => setMode('auto'));

            // Public hook for telemetry: switch the live outline in AUTO without changing gray selection
            group.updateLive = (isOn) => {
            if ((group.dataset.mode || 'auto') !== 'auto') return;
            offBtn.classList.remove('live');
            onBtn.classList.remove('live');
            (isOn ? onBtn : offBtn).classList.add('live');
            if (displayValue) displayValue.textContent = isOn ? (onBtn.dataset.value || '--') : '--';
            };
        });
        });
     

          // TAB 4: ENGINE. ANIMATION LOAD   //
      
        // All comments in English.

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
        if(!btn) return;

        // keep existing handlers...
        const setState = (n) => btn.setAttribute('data-state', String(n));

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
     

          // TAB 4: BATTERY LINES   //

          // TAB 5: Mission Pleer   //
      

            // === Minimal timeline logic: evenly space waypoints and move the yellow cursor ===
            (function(){
            // scope to the first mission-pleer on the page
            const pleer = document.querySelector('.mission-pleer');
            if(!pleer) return;

            const track = pleer.querySelector('.timeline-track');
            const points = [...pleer.querySelectorAll('.mission-waypoint')];
            const cursor = pleer.querySelector('.mission-cursor');
            const prevBtn = pleer.querySelector('.js-prev');
            const nextBtn = pleer.querySelector('.js-next');

            let idx = 0; // current waypoint index

            // Position waypoints evenly across the track
            const layoutPoints = () => {
                const n = points.length;
                points.forEach((p, i) => {
                const pct = (n === 1) ? 50 : (i/(n-1))*100;
                p.style.left = pct + '%';
                });
            };

            // Move cursor to waypoint by index
            const updateCursor = () => {
                const target = points[idx];
                if(!target) return;
                cursor.style.left = target.style.left || '0%';
                // enable/disable nav buttons
                prevBtn && (prevBtn.disabled = (idx === 0));
                nextBtn && (nextBtn.disabled = (idx === points.length - 1));
            };

            // Nav handlers
            prevBtn && prevBtn.addEventListener('click', () => { if(idx>0){ idx--; updateCursor(); } });
            nextBtn && nextBtn.addEventListener('click', () => { if(idx<points.length-1){ idx++; updateCursor(); } });

            // Re-layout on resize
            window.addEventListener('resize', layoutPoints);

            layoutPoints();
            updateCursor();
            })();




            
            // Toggle Play/Pause icon and title
            document.addEventListener('DOMContentLoaded', () => {
            const btn = document.querySelector('.pleer-buttons .js-play-toggle');
            if (!btn) return;

            // SVG icons (stroke uses currentColor)
            const ICONS = {
                pause: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6v12M16 6v12"/></svg>',
                play:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z"/></svg>'
            };

            // Initial state = "pause" (matches current icon)
            btn.dataset.state = 'pause';
            btn.setAttribute('aria-pressed', 'false');

            function render() {
                const st = btn.dataset.state;          // "pause" | "play"
                btn.innerHTML = st === 'pause' ? ICONS.pause : ICONS.play;
                btn.title = st === 'pause' ? 'Pause' : 'Play';
                btn.setAttribute('aria-label', btn.title);
                btn.setAttribute('aria-pressed', st === 'play' ? 'true' : 'false');
            }

            btn.addEventListener('click', () => {
                btn.dataset.state = btn.dataset.state === 'pause' ? 'play' : 'pause';
                render();
                // TODO: dispatch your real player command here if needed
                // e.g., player.pause() / player.play()
            });

            render();
            });

     

          // TAB 6: Safety   //
      
            document.addEventListener("DOMContentLoaded", () => {
            const bigButtons = document.querySelectorAll(".big-drawer-button");

            bigButtons.forEach((button) => {
                const label = button.querySelector(".button-drawer-label");
                const originalText = label.textContent;

                button.addEventListener("click", () => {
                button.classList.toggle("active");

                if (button.classList.contains("active")) {
                    if (originalText.includes("Silent Mode")) {
                    // special case for Silent Mode
                    label.textContent = "Silent Mode On";
                    } else {
                    // default case for other Kill-buttons
                    label.textContent = originalText.replace("Kill", "").trim() + " Killed";
                    }
                } else {
                    label.textContent = originalText;
                }
                });
            });
            });
     

          // TAB 8: Sensors   //
      
            document.addEventListener("DOMContentLoaded", () => {
            const toggles = document.querySelectorAll(".drawer-button-toggle");

            toggles.forEach(toggle => {
                const buttons = toggle.querySelectorAll(".toggle-btn");
                const display = toggle.parentElement.querySelector(".drawer-button-display");
                const valueEl = display.querySelector(".display-value");

                buttons.forEach(btn => {
                btn.addEventListener("click", () => {
                    // remove active from all
                    buttons.forEach(b => b.classList.remove("active"));
                    // set active
                    btn.classList.add("active");

                    // update only value (unit stays the same)
                    const value = btn.dataset.value || "--";
                    valueEl.textContent = value;
                });
                });
            });
            });
     



      // MODAL ACTIVE HELM PANEL  //
      
        document.addEventListener("DOMContentLoaded", () => {
            const toggleBtn = document.getElementById("helm-toggle");                 // The main button that opens the modal
            const modal = document.getElementById("helm-modal");                     // The modal element
            const modeButtons = modal.querySelectorAll(".ap-mode-btn");             // All mode buttons inside the modal
            const helmValues = modal.querySelectorAll(".helm-display-value");       // All display value elements in the modal

            // When the main button is clicked → open the modal
            toggleBtn.addEventListener("click", () => {
                modal.style.display = "block";                                       // Show the modal

                const currentMode = toggleBtn.dataset.currentMode;                   // Get the current mode (stored in dataset)

                // Highlight the active mode button
                modeButtons.forEach(btn => {
                    if (btn.dataset.mode === currentMode) {
                        btn.classList.add("active");
                    } else {
                        btn.classList.remove("active");
                    }
                });
            });


            // Default to "Robot" on first load if no mode set yet
            if (!toggleBtn.dataset.currentMode) {
            toggleBtn.dataset.currentMode = 'Auto';   // "Auto" is treated as "Robot"
            toggleBtn.textContent = 'Robot';          // reflect on the toggle button

            // highlight "Robot" row in the modal
            helmValues.forEach(el => {
                const isRobot = el.textContent.trim() === 'Robot';
                el.style.color = isRobot ? '#ffffff' : '#757575';
                el.style.fontWeight = isRobot ? '600' : '500';
            });
            }



            // When a mode button is clicked inside the modal
            modeButtons.forEach(btn => {
                btn.addEventListener("click", () => {
                    const selectedMode = btn.dataset.mode;
                    const isRobot = selectedMode === "Auto";                         // Treat "Auto" as "Robot"

                    // Update the main button text based on selected mode
                    toggleBtn.textContent = isRobot ? "Robot" : selectedMode;
                    toggleBtn.dataset.currentMode = selectedMode;                    // Store selected mode in the main button

                    // Update display block appearance: highlight "Robot" only
                    helmValues.forEach(el => {
                        if (isRobot && el.textContent.trim() === "Robot") {
                            el.style.color = "#ffffff";
                            el.style.fontWeight = "600";
                        } else {
                            el.style.color = "#757575";
                            el.style.fontWeight = "500";
                        }
                    });

                    // Update the active button style
                    modeButtons.forEach(button => {
                        button.classList.remove("active");                           // Remove previous active state
                    });
                    btn.classList.add("active");                                     // Set active class to clicked button

                    // Close the modal
                    modal.style.display = "none";
                });
            });
        });
     

      // MODAL AUTO PILOT PANEL   //
      
        // Auto-Pilot modal wiring (fixed for #auto-pilot-modal)
        document.addEventListener('DOMContentLoaded', () => {
        const toggleBtn = document.getElementById('ap-toggle');          // main button
        const modal = document.getElementById('auto-pilot-modal');       // modal window

        if (!toggleBtn || !modal) return; // guard if markup not present

        const modeButtons = modal.querySelectorAll('.ap-mode-btn');

        function openModal(){
            modal.style.display = 'block';
            const currentMode = toggleBtn.dataset.currentMode;
            modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === currentMode));
        }
        function closeModal(){ modal.style.display = 'none'; }

        toggleBtn.addEventListener('click', openModal);

        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
            const selectedMode = btn.dataset.mode;
            toggleBtn.textContent = selectedMode;
            toggleBtn.dataset.currentMode = selectedMode;
            closeModal();
            });
        });

        // Optional niceties: click backdrop or ESC to close (safe to keep)
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
        });
     


      // Close MODAL PANEL   //
      
            // === Click-outside & Esc close for HELM and AUTOPILOT modals ===
            document.addEventListener("DOMContentLoaded", () => {
            // Get references to toggle buttons and modals
            const helmToggle   = document.getElementById("helm-toggle");
            const helmModal    = document.getElementById("helm-modal");
            const helmContent  = helmModal?.querySelector(".status-modal-content");

            const apToggle     = document.getElementById("ap-toggle");
            const apModal      = document.getElementById("status-modal");
            const apContent    = apModal?.querySelector(".status-modal-content");

            // Helper: close a modal safely
            const closeModal = (el) => {
                if (!el) return;
                el.style.display = "none";
            };

            // Close on click outside: we listen on document to catch all clicks
            document.addEventListener("click", (e) => {
                // --- HELM ---
                if (helmModal && helmModal.style.display === "block") {
                const clickedOutsideHelm =
                    helmContent && !helmContent.contains(e.target) && e.target !== helmToggle && !helmToggle?.contains(e.target);
                if (clickedOutsideHelm) closeModal(helmModal);
                }

                // --- AUTOPILOT ---
                if (apModal && apModal.style.display === "block") {
                const clickedOutsideAp =
                    apContent && !apContent.contains(e.target) && e.target !== apToggle && !apToggle?.contains(e.target);
                if (clickedOutsideAp) closeModal(apModal);
                }
            });

            // Close on Esc for both
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                if (helmModal && helmModal.style.display === "block") closeModal(helmModal);
                if (apModal   && apModal.style.display === "block")   closeModal(apModal);
                }
            });
            });
     

      // MODAL PANEL DOCKER  //
      
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
        
        