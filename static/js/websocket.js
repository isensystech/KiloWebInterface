          /* WebSocket Localhost   */





  /* == 0) Connect to the real WebSocket server == */
  // Dynamically determine the protocol and host to connect to the server
  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${location.host}/ws`;

  console.log(`Attempting to connect to WebSocket at: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  // Make the connection globally accessible for other scripts or debugging
  window.ws = ws;

  ws.onopen = () => {
    console.log('✅ WebSocket connection established.');
    // You could also update a UI element here to show "Connected"
  };

  ws.onclose = () => {
    console.log('❌ WebSocket connection closed.');
    // Here you might want to show a "Disconnected" message in the UI
  };

  ws.onerror = (error) => {
    console.error('WebSocket Error:', error);
  };

  /* == 1) Click handling (delegation) - This part remains the same == */
  const root = document.querySelector('.battery-block');
  root?.addEventListener('click', (e) => {
    const btn = e.target.closest('button.toggle-btn, button.relay-btn');
    if (!btn) return;
    if (ws.readyState !== WebSocket.OPEN) { 
      alert('WebSocket is not connected yet'); 
      return; 
    }

    const block = btn.closest('.battery-button-block');
    const bank  = Number(block?.dataset.bank);
    const sw    = Number(block?.dataset.switch);
    const state = Number(btn.dataset.state); // 0/1/2...

    const payload = { type:'relay.set', bank, switch: sw, state };
    ws.send(JSON.stringify(payload));
    console.log('Sent:', payload);

    // Optional: local visual mark in the clicked group
    const group = btn.parentElement;
    group?.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // This object will store the last known state of our status icons
  const indicatorStates = {};

  /* == 1b) M20 Relay Click Handling == */
  document.addEventListener('click', (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      // Standard M20 Relay Buttons (Pumps, Radar, etc.)
      const m20Button = e.target.closest('[data-m20-bank][data-m20-switch] > button[data-state]');
      if (m20Button) {
          const group = m20Button.parentElement;
          const bank = group.dataset.m20Bank;
          const switchNum = group.dataset.m20Switch;
          const state = m20Button.dataset.state;

          const payload = { type: 'm20relay.set', bank: parseInt(bank), switch: parseInt(switchNum), state: parseInt(state) };
          ws.send(JSON.stringify(payload));
          console.log('Sent:', payload);
          return; // Stop further processing
      }

      // Special Handling for 3-Way Nav Lights Button
      const navButton = e.target.closest('[data-nav-lights] > button[data-nav-mode]');
      if (navButton) {
          const mode = navButton.dataset.navMode;
          const anchorSwitch = 3;
          const navSwitch = 5;
          let anchorState = 0;
          let navState = 0;

          if (mode === 'anchor') {
              anchorState = 1;
          } else if (mode === 'nav') {
              anchorState = 1;
              navState = 1;
          }

          // Send two separate commands
          const payload1 = { type: 'm20relay.set', bank: 1, switch: anchorSwitch, state: anchorState };
          const payload2 = { type: 'm20relay.set', bank: 1, switch: navSwitch, state: navState };
          
          ws.send(JSON.stringify(payload1));
          console.log('Sent:', payload1);
          ws.send(JSON.stringify(payload2));
          console.log('Sent:', payload2);
      }
  });


  /* == 2) Incoming messages -> update UI - This part also remains the same == */
  ws.onmessage = (evt) => {
    let msg;
    try { 
      msg = JSON.parse(evt.data); 
      console.log('Received:', msg);
    } catch { 
      console.warn('Received non-JSON message:', evt.data);
      return; 
    }

    // ... inside ws.onmessage = (evt) => { ...

    // c) m20relay.state: Update all relevant buttons
    if (msg.type === 'm20relay.state') {
        const bank = msg.bank;

        // --- Handle simple toggle buttons (Radar, Pumps) ---
        for (let i = 0; i < 20; i++) {
            const key = `switch_${i}`;
            if (msg[key] !== undefined) {
                const state = msg[key];
                const group = document.querySelector(`[data-m20-bank="${bank}"][data-m20-switch="${i}"]`);
                if (group) {
                    group.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                    const activeBtn = group.querySelector(`button[data-state="${state}"]`);
                    if (activeBtn) {
                        activeBtn.classList.add('active');
                    }
                }
            }
        }

        // --- Handle special 3-way Nav Lights ---
        const navGroup = document.querySelector('[data-nav-lights]');
        if (navGroup) {
            const anchorState = msg.switch_3; // Anchor is switch 3
            const navState = msg.switch_5;    // Nav is switch 5
            let activeMode = 'off';

            if (anchorState === 1 && navState === 1) {
                activeMode = 'nav';
            } else if (anchorState === 1) {
                activeMode = 'anchor';
            }

            navGroup.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            const activeNavBtn = navGroup.querySelector(`button[data-nav-mode="${activeMode}"]`);
            if (activeNavBtn) {
                activeNavBtn.classList.add('active');
            }
        }
    }

  // =================== NEW MAVLINK HANDLER START ===================

  // Helper function to manage status icons (now with state-tracking)
  const handleStatusIndicator = (elementId, newStatus, okClass = 'connected', badClass = 'disconnected', timeout = 5000) => {
      const indicator = document.getElementById(elementId);
      if (!indicator) return;

      const previousStatus = indicatorStates[elementId];

      // Only act if the status has changed
      if (newStatus !== previousStatus) {
          if (newStatus) { // State changed to GOOD (e.g., false -> true)
              indicator.style.display = 'inline-block';
              indicator.classList.remove(badClass);
              indicator.classList.add(okClass);
              // Hide after timeout for positive feedback
              setTimeout(() => {
                  indicator.style.display = 'none';
              }, timeout);
          } else { // State changed to BAD (e.g., true -> false)
              indicator.style.display = 'inline-block';
              indicator.classList.remove(okClass);
              indicator.classList.add(badClass);
          }
      }

      // Always update the state for the next message
      indicatorStates[elementId] = newStatus;
  };
      // b) relay.voltage: put volts into matching spans
          if (msg.type === 'relay.voltage') {
            
              // Only handle the specific gauge for bank 10, stud 6
              if (msg.bank === 10 && msg.stud === 6) {
                  const gaugeEl = document.getElementById('battery-gauge-10-6');
                  if (!gaugeEl) return; // Exit if the element isn't found

                  const voltage = msg.volts;
                  const minVoltage = 11.0;
                  const maxVoltage = 14.5;
                  const lowVoltageThreshold = 12.0;

                  // 1. Update the numeric value
                  const valueEl = gaugeEl.querySelector('.js-voltage');
                  if (valueEl) {
                      valueEl.textContent = voltage.toFixed(1);
                  }

                  // 2. Calculate and set the gauge percentage
                  let pct = ((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100;
                  // Clamp the value between 0 and 100
                  pct = Math.max(0, Math.min(100, pct));
                  gaugeEl.style.setProperty('--pct', `${pct.toFixed(0)}%`);

                  // 3. Set the color state
                  if (voltage < lowVoltageThreshold) {
                      gaugeEl.classList.add('is-low');
                  } else {
                      gaugeEl.classList.remove('is-low');
                  }
              }
          }
      // Check if the message is a mavlink.state update
      if (msg.type === 'mavlink.state') {
          // --- 1. Update Text Values ---
          const textFields = ['utc_time_str', 'gps_satellites', 'gps_lat_deg', 'gps_lng_deg'];
          textFields.forEach(key => {
              const el = document.getElementById(key);
              if (el && msg[key] !== undefined) {
                  // For lat/lng, format to 6 decimal places
                  if (key === 'gps_lat_deg' || key === 'gps_lng_deg') {
                      el.textContent = parseFloat(msg[key]).toFixed(6);
                  } else {
                      el.textContent = msg[key];
                  }
              } else if (el) {
                  el.textContent = '--'; // Fallback value
              }
          });
          document.getElementById('ap_mode').textContent = msg.ap_mode || '--';

          // --- 2. Update Status Icons ---
          handleStatusIndicator('joystick-indicator', msg.joystick_connected);
          handleStatusIndicator('ap-indicator', msg.ap_connected);
          handleStatusIndicator('companion-indicator', msg.companion_connected);

          // System status is special ('ok' vs 'error')
          handleStatusIndicator(
              'system-status-indicator',
              (msg.system_status === 'ok' || msg.system_status === 1), // The condition for "good" status
              'ok',       // CSS class for good status
              'error'     // CSS class for bad status
          );
      }

    // =================== NEW MAVLINK HANDLER END ===================


      // a) relay.state: highlight proper button
      if (msg.type === 'relay.state') {
        const block = document.querySelector(`.battery-button-block[data-bank="${msg.bank}"][data-switch="${msg.switch}"]`);
        if (block) {
          const group = block.querySelector('.drawer-button-toggle, .drawer-button-relay');
          if (group) {
            group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            const btn = group.querySelector(`button[data-state="${msg.state}"]`);
            if (btn) btn.classList.add('active');
          }
        }
      }

      // b) relay.voltage: put volts into matching spans
      if (msg.type === 'relay.voltage') {
        document
          .querySelectorAll(`.display-value[data-bank="${msg.bank}"][data-stud="${msg.stud}"]`)
          .forEach(el => el.textContent = Number(msg.volts).toFixed(1));
      }
    };

  