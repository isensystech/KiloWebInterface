      /* SCRIPT // MODAL EDIT BUTTON   */
  

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
                                      /* Preview button area   */
                                    <div class="editor-preview-frame">
                                        <div class="editor-preview-content">
                                            <div class="editor-control-button preview-position" data-device="preview_button">
                                                  /* Cap state container   */
                                                <div class="editor-cap-container ${safetyCap ? "state-safety" : "state-no-cap"}" onclick="toggleCapState(this)">
                                                    <div class="editor-safety-cap">
                                                        <img src="${icon}" alt="Icon on cap" class="editor-cap-icon">
                                                    </div>
                                                    <div class="editor-no-safety-cap"></div>
                                                    <div class="editor-safety-cap-hover"></div>
                                                </div>

                                                  /* Button with icon   */
                                                <button class="editor-preview-button" data-id="0x999" data-bit="0">
                                                    <img src="${icon}" alt="Icon" class="editor-button-icon icon-selected">
                                                </button>

                                                  /* Label below button   */
                                                <div class="editor-button-label edited" contenteditable="true">${label}</div>
                                            </div>
                                        </div>
                                    </div>

                            

                                  /* Change Preview Button Icon   */

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


                                  /* Function button area   */
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

                                        
                                          /* Timer value box BELOW all buttons   */
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



                                          /* input output value   */
                                        <div class="editor-custom-input-row">
                                        <label class="editor-custom-label">CAN</label>

                                          /* Первый блок: 0x 3 numbers   */
                                            <div class="editor-prefixed-wrapper bn-wrapper">
                                                <span class="editor-prefix">0x</span>
                                                <input type="text" maxlength="3" class="editor-prefixed-input" placeholder="###">
                                            </div>

                                          /* Второй блок: длинное значение   */
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





                                          /* Cancel Apply buttons   */
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



 

      /* SCRIPT // MODAL TRIM   */
  

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



                /* SLIDER */
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




/* SLIDER button */

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
                
   /* MODAL ACTIVE HELM PANEL   */
      
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
     

      /* MODAL AUTO PILOT PANEL   */
      
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
     


      /* Close MODAL PANEL   */
      
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
     