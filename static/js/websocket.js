/* WebSocket Connection */

// Dynamically determine the protocol and host
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${location.host}/ws`;

console.log(`Attempting to connect to WebSocket at: ${wsUrl}`);
const ws = new WebSocket(wsUrl);

// Make the connection globally accessible
window.ws = ws;

ws.onopen = () => {
  console.log('✅ WebSocket connection established.');
};

ws.onclose = () => {
  console.log('❌ WebSocket connection closed.');
};

ws.onerror = (error) => {
  console.error('WebSocket Error:', error);
};

// This object will store the last known state of our status icons
const indicatorStates = {};

/* == 1) Click handling for battery/relay controls == */
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
  const state = Number(btn.dataset.state);

  const payload = { type:'relay.set', bank, switch: sw, state };
  ws.send(JSON.stringify(payload));
  console.log('Sent:', payload);

  const group = btn.parentElement;
  group?.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

/* == 1b) M20 Relay Click Handling == */
document.addEventListener('click', (e) => {
  if (ws.readyState !== WebSocket.OPEN) return;

  // Standard M20 Relay Buttons
  const m20Button = e.target.closest('[data-m20-bank][data-m20-switch] > button[data-state]');
  if (m20Button) {
    const group = m20Button.parentElement;
    const bank = group.dataset.m20Bank;
    const switchNum = group.dataset.m20Switch;
    const state = m20Button.dataset.state;

    const payload = { type: 'm20relay.set', bank: parseInt(bank), switch: parseInt(switchNum), state: parseInt(state) };
    ws.send(JSON.stringify(payload));
    console.log('Sent:', payload);
    return;
  }

  // Special Handling for 3-Way Nav Lights
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

    const payload1 = { type: 'm20relay.set', bank: 1, switch: anchorSwitch, state: anchorState };
    const payload2 = { type: 'm20relay.set', bank: 1, switch: navSwitch, state: navState };
    
    ws.send(JSON.stringify(payload1));
    console.log('Sent:', payload1);
    ws.send(JSON.stringify(payload2));
    console.log('Sent:', payload2);
  }
});

/* Heartbeat framework */
(function () {
  if (window.__kiloHeartbeatInit) return;
  window.__kiloHeartbeatInit = true;

  const statusTextEl = document.querySelector('.status-text');
  const connEl = document.getElementById('connection-indicator');

  const hbState = { lastSig: null, repeats: 0, stalled: false };

  function arrowFromHeading(deg) {
    const arrows = ['↑','↗','→','↘','↓','↙','←','↖'];
    const idx = Math.floor(((deg % 360) + 360) % 360 / 45) % 8;
    return arrows[idx];
  }

  function renderStatusLine(msg) {
    const name = 'Kilo #2';
    const hdg = Number(msg.heading_deg ?? 0);
    const spd = Number(msg.gps_speed_ms ?? 0);
    const time = (msg.utc_time_str || '--:--:--').toString();
    const arr = arrowFromHeading(hdg);
    const eventTail = ' Buoy Release Safety Designated';
    return `${name} ${arr} ${Math.round(hdg)}° ${Math.round(spd)}m/s [${time}]${eventTail}`;
  }

  function setHeartbeatStalled(isStalled) {
    if (!connEl) return;
    if (isStalled) {
      connEl.classList.add('disconnected');
      connEl.classList.add('stalled');
      connEl.classList.remove('connected');
    } else {
      connEl.classList.remove('disconnected');
      connEl.classList.remove('stalled');
      connEl.classList.add('connected');
    }
  }

  function signatureOf(msg) {
    const r = (n, p=3) => (typeof n === 'number' ? n.toFixed(p) : String(n));
    return [
      msg.ap_connected,
      msg.ap_mode,
      r(msg.imu_roll_deg), r(msg.imu_pitch_deg), r(msg.imu_yaw_deg),
      r(msg.gps_lat_deg, 5), r(msg.gps_lng_deg, 5),
      r(msg.heading_deg, 1),
      r(msg.gps_speed_ms, 2),
      msg.utc_time_str
    ].join('|');
  }

  window.__kiloOnMavlinkState = function (msg) {
    if (statusTextEl) {
      statusTextEl.textContent = renderStatusLine(msg);
    }

    const sig = signatureOf(msg);
    if (hbState.lastSig === sig) {
      hbState.repeats += 1;
    } else {
      hbState.lastSig = sig;
      hbState.repeats = 1;
      if (hbState.stalled) {
        hbState.stalled = false;
        setHeartbeatStalled(false);
      }
    }

    if (!hbState.stalled && hbState.repeats >= 10) {
      hbState.stalled = true;
      setHeartbeatStalled(true);
    }

    if (!hbState.stalled) setHeartbeatStalled(false);
  };
})();

/* Helper function to manage status icons */
const handleStatusIndicator = (elementId, newStatus, okClass = 'connected', badClass = 'disconnected', timeout = 5000) => {
  const indicator = document.getElementById(elementId);
  if (!indicator) return;

  const previousStatus = indicatorStates[elementId];

  if (newStatus !== previousStatus) {
    if (newStatus) {
      indicator.style.display = 'inline-block';
      indicator.classList.remove(badClass);
      indicator.classList.add(okClass);
      setTimeout(() => {
        indicator.style.display = 'none';
      }, timeout);
    } else {
      indicator.style.display = 'inline-block';
      indicator.classList.remove(okClass);
      indicator.classList.add(badClass);
    }
  }

  indicatorStates[elementId] = newStatus;
};

/* == 2) Incoming messages -> update UI == */
ws.onmessage = (evt) => {
  let msg;
  try { 
    msg = JSON.parse(evt.data); 
    console.log('Received:', msg);
  } catch { 
    console.warn('Received non-JSON message:', evt.data);
    return; 
  }

  if (msg.type === 'control.state') {
    handleControlStateFeedback(msg);
    return;
  }

  if (msg.type === 'm20relay.state') {
    const bank = msg.bank;
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

    const navGroup = document.querySelector('[data-nav-lights]');
    if (navGroup) {
      const anchorState = msg.switch_3;
      const navState = msg.switch_5;
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

  if (msg.type === 'relay.voltage') {
    if (msg.bank === 10 && msg.stud === 6) {
      const gaugeEl = document.getElementById('battery-gauge-10-6');
      if (!gaugeEl) return;

      const voltage = msg.volts;
      const minVoltage = 11.0;
      const maxVoltage = 14.5;
      const lowVoltageThreshold = 12.0;

      const valueEl = gaugeEl.querySelector('.js-voltage');
      if (valueEl) {
        valueEl.textContent = voltage.toFixed(1);
      }

      let pct = ((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100;
      pct = Math.max(0, Math.min(100, pct));
      gaugeEl.style.setProperty('--pct', `${pct.toFixed(0)}%`);

      if (voltage < lowVoltageThreshold) {
        gaugeEl.classList.add('is-low');
      } else {
        gaugeEl.classList.remove('is-low');
      }
    }
  }

  if (msg.type === 'mavlink.state') {
    window.__kiloOnMavlinkState && window.__kiloOnMavlinkState(msg);

    const textFields = ['utc_time_str', 'gps_satellites', 'gps_lat_deg', 'gps_lng_deg'];
    textFields.forEach(key => {
      const el = document.getElementById(key);
      if (el && msg[key] !== undefined) {
        if (key === 'gps_lat_deg' || key === 'gps_lng_deg') {
          el.textContent = parseFloat(msg[key]).toFixed(6);
        } else {
          el.textContent = msg[key];
        }
      } else if (el) {
        el.textContent = '--';
      }
    });
    
    const apModeEl = document.getElementById('ap_mode');
    if (apModeEl) {
      apModeEl.textContent = msg.ap_mode || '--';
    }

    handleStatusIndicator('joystick-indicator', msg.joystick_connected);
    handleStatusIndicator('ap-indicator', msg.ap_connected);
    handleStatusIndicator('companion-indicator', msg.companion_connected);
    handleStatusIndicator(
      'system-status-indicator',
      (msg.system_status === 'ok' || msg.system_status === 1),
      'ok',
      'error'
    );
  }

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
};

function handleControlStateFeedback(msg) {
  // Throttle Feedback
  if (msg.throttle !== undefined) {
    const gearFill = document.getElementById("gear-fill");
    if (gearFill) {
        const visualPercent = msg.throttle / 100;
        const VISUAL_HALF = 47.5;
        const visualOffset = visualPercent * VISUAL_HALF;
        
        gearFill.style.height = `${Math.abs(visualOffset)}%`;
        if (visualOffset < 0) {
            gearFill.style.top = '50%';
            gearFill.style.bottom = 'auto';
        } else {
            gearFill.style.bottom = '50%';
            gearFill.style.top = 'auto';
        }
    }
    
    const gearThumbText = document.querySelector(".gear-thumb-text");
    if (gearThumbText) {
        const textN = gearThumbText.querySelector('.text-n');
        const textNeutral = gearThumbText.querySelector('.text-neutral');
        
        // Check if in neutral range (-10 to +10)
        if (msg.throttle >= -10 && msg.throttle <= 10) {
            if (textN) textN.textContent = 'N';
            if (textNeutral) textNeutral.textContent = 'NEUTRAL';
        } else {
            // Show percentage from feedback
            if (textN) textN.textContent = `${Math.abs(msg.throttle)}%`;
            if (textNeutral) textNeutral.textContent = msg.gear || (msg.throttle > 0 ? 'F' : 'R');
        }
    }
    
    const feedbackFill = document.querySelector(".throttle-feedback-fill");
    const throttleValueDisplay = document.getElementById("actual-throttle-value");
    if (throttleValueDisplay) {
      throttleValueDisplay.textContent = msg.throttle;
    }
  }
  
  // Gear Feedback
  if (msg.gear) {
    const gearLetterDisplay = document.getElementById("gear-letter-display");
    if (gearLetterDisplay) {
      gearLetterDisplay.textContent = msg.gear;
    }
  }
  
  // Steering Feedback
  if (msg.steering !== undefined) {
    const rudderPointer = document.getElementById("rudder-pointer");
    if (rudderPointer) {
      const degrees = (msg.steering / 100) * 35;
      const visualAngle = -degrees;
      rudderPointer.setAttribute("transform", `rotate(${visualAngle}, 144, 0)`);
    }
    
    const steeringValue = document.querySelector(".boat-stat__value #rudder-angle-value");
    if (steeringValue) {
      const degrees = Math.round((msg.steering / 100) * 35);
      steeringValue.textContent = degrees;
    }
  }
  
  // Engine Trim Feedback
  if (msg.engine_trim !== undefined) {
    const trimValue = document.getElementById("trim-value");
    if (trimValue) {
      trimValue.textContent = msg.engine_trim;
    }
    
    const trimSlider = document.querySelector(".trim-slider-wrapper .trim-fill");
    if (trimSlider) {
      trimSlider.style.height = `${msg.engine_trim}%`;
    }
    
    const trimImage = document.querySelector(".trim-image-wrapper img");
    if (trimImage) {
      const rotation = (msg.engine_trim / 100) * 30;
      trimImage.style.transform = `rotate(${rotation}deg)`;
    }
  }
  
  // Listing Feedback
  if (msg.port_trim !== undefined) {
    const portTrimDisplay = document.getElementById("port-trim-value");
    if (portTrimDisplay) {
      portTrimDisplay.textContent = msg.port_trim;
    }
    
    const portTrimGauge = document.querySelector(".port-trim-gauge .trim-fill");
    if (portTrimGauge) {
      portTrimGauge.style.height = `${msg.port_trim}%`;
    }
  }
  
  if (msg.starboard_trim !== undefined) {
    const starboardTrimDisplay = document.getElementById("starboard-trim-value");
    if (starboardTrimDisplay) {
      starboardTrimDisplay.textContent = msg.starboard_trim;
    }
    
    const starboardTrimGauge = document.querySelector(".starboard-trim-gauge .trim-fill");
    if (starboardTrimGauge) {
      starboardTrimGauge.style.height = `${msg.starboard_trim}%`;
    }
  }
  
  if (msg.port_trim !== undefined && msg.starboard_trim !== undefined) {
    const titterTotter = document.querySelector(".titter-totter-graphic");
    if (titterTotter) {
      const difference = msg.starboard_trim - msg.port_trim;
      const rotation = (difference / 100) * 15;
      titterTotter.style.transform = `rotate(${rotation}deg)`;
    }
  }
  
  // RPM Feedback
  if (msg.rpm !== undefined) {
    const rpmDisplay = document.querySelector(".rpm-gauge .value-lg");
    if (rpmDisplay) {
      rpmDisplay.textContent = msg.rpm;
    }
  }
  
if (msg.rpm_percent !== undefined) {
    const rpmGaugeFill = document.querySelector(".rpm-gauge .mini-gauge-fill");
    if (rpmGaugeFill) {
        rpmGaugeFill.style.width = `${msg.rpm_percent}%`;
        
        // Turn red if RPM is 90% or higher
        if (msg.rpm_percent >= 90) {
            rpmGaugeFill.style.backgroundColor = '#D0021B'; // Red
        } else {
            rpmGaugeFill.style.backgroundColor = '#ffffff'; // White
        }
    }
}
}