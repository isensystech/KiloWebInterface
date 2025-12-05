/* WebSocket Connection */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

import {
    gamepadControlState,
    getThrottleGearState,
    // updateThrottleUI, // We DO NOT call this from WS
    updateSteeringUI,
    updateEngineTrimUI,
    updateListingUI
} from './modules/gamepad-handler.js';
import { 
    handleStatusIndicator, 
    updateTelemetryValue, 
    updateRpmGauge, 
    updateRelayVoltage,  // <-- Handles CZone voltage (Tab 4) AND Left Gauge
    updateM20RelayCurrent, // <-- Handles M20 current (Tab 8)
    updateFuelGauge
} from './modules/ui-telemetry.js';
import { updateMapFromMavlink } from './map-layer.js';

// ============================================================================
// CONFIGURATION
// ============================================================================
const WEBSOCKET_CONFIG = Object.freeze({
  // Interval for sending joystick heartbeat packets to the server (ms, 100–500 recommended)
  gamepadHeartbeatIntervalMs: 200,
  // Bank/switch mapping for the three-way nav-light helper (depends on wiring harness)
  navLightsBank: 1,
  navLightsAnchorSwitch: 3,
  navLightsNavSwitch: 5
});

const HEARTBEAT_CONFIG = Object.freeze({
  // Number of identical MAVLink payloads before flagging the feed as stalled
  stallRepeatThreshold: 10,
  // Size of each directional wedge when converting heading to arrows (degrees)
  headingSliceDeg: 45
});

const STATUS_LINE_CONFIG = Object.freeze({
  // Vessel name rendered in the footer heartbeat line
  vesselName: 'Kilo #2',
  // Static suffix appended to the heartbeat text for situational awareness
  eventTailText: ' Buoy Release Safety Designated'
});

const THROTTLE_FEEDBACK_CONFIG = Object.freeze({
  // Half-span of the visual throttle bar (% of control track)
  visualHalfPercent: 47.5,
  // Percentage offset that represents neutral (typically 50%)
  neutralCenterPercent: 50
});

const RECONNECT_DELAY_MS = 3000; // delay between reconnection attempts if socket closes (ms)

let gamepadHeartbeatTimer = null;
let controlSocket = null;
let reconnectTimer = null;
let shouldMaintainConnection = false;
let clickHandlersReady = false;

function startGamepadHeartbeat() {
    if (gamepadHeartbeatTimer !== null) {
      clearInterval(gamepadHeartbeatTimer);
    }

    gamepadHeartbeatTimer = setInterval(() => {
      if (!window.ws || window.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const message = {
        type: 'gamepad.set',
        throttle: gamepadControlState.throttle,
        gear: getThrottleGearState(),
        steering: gamepadControlState.steering,
        engine_trim: gamepadControlState.engine_trim,
        port_trim: gamepadControlState.port_trim,
        starboard_trim: gamepadControlState.starboard_trim
      };

      console.log('Sending gamepad heartbeat:', message);
      window.ws.send(JSON.stringify(message));
    }, WEBSOCKET_CONFIG.gamepadHeartbeatIntervalMs);
}

function stopGamepadHeartbeat() {
    if (gamepadHeartbeatTimer !== null) {
      clearInterval(gamepadHeartbeatTimer);
      gamepadHeartbeatTimer = null;
    }
}


function scheduleReconnect() {
  if (reconnectTimer || !shouldMaintainConnection) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (shouldMaintainConnection) {
      openControlWebSocket();
    }
  }, RECONNECT_DELAY_MS);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function applyRelayStateToUi(bank, sw, state) {
  const block = document.querySelector(`.battery-button-block[data-bank="${bank}"][data-switch="${sw}"]`);
  if (!block) return;
  const group = block.querySelector('.drawer-button-toggle, .drawer-button-relay');
  if (!group) return;
  group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  const btn = group.querySelector(`button[data-state="${state}"]`);
  if (btn) btn.classList.add('active');
}

function handleIncomingMessage(evt) {
  let msg;
  try { 
    msg = JSON.parse(evt.data); 
    console.log('Received:', msg);
  } catch { 
    console.warn('Received non-JSON message:', evt.data);
    return; 
  }

  switch (msg.type) {
    case 'control.state':
      handleControlStateFeedback(msg);
      break;
    case 'mavlink.state':
      window.__kiloOnMavlinkState?.(msg);
      break;
    case 'relay.voltage':
    case 'relay_voltage':
      updateRelayVoltage(msg);
      break;
    case 'fuel_gauge':
      updateFuelGauge(msg.percentage);
      break;
    case 'relay.state':
    case 'relay.set':
    case 'relay_state':
    case 'relay_set':
      applyRelayStateToUi(msg.bank, msg.switch, msg.state);
      break;
    case 'm20relay.state':
      const m20_bank = msg.bank;
      for (let i = 0; i < 20; i++) {
        const key = `switch_${i}`;
        if (msg[key] !== undefined) {
          const state = msg[key];
          const group = document.querySelector(`[data-m20-bank="${m20_bank}"][data-m20-switch="${i}"]`);
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
        const anchorState = msg[`switch_${WEBSOCKET_CONFIG.navLightsAnchorSwitch}`];
        const navState = msg[`switch_${WEBSOCKET_CONFIG.navLightsNavSwitch}`];
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
      break;
    case 'm20relay.current':
      updateM20RelayCurrent(msg);
      break;
    default:
      // ignore unknown types
  }
}

if (typeof window !== 'undefined' && !window.__kiloControlDebugMessage) {
  window.__kiloControlDebugMessage = function(payload) {
    try {
      handleIncomingMessage({ data: JSON.stringify(payload) });
    } catch (err) {
      console.error('Failed to inject debug payload', err);
    }
  };
}

function openControlWebSocket() {
  if (!shouldMaintainConnection) {
    return null;
  }
  if (controlSocket && (controlSocket.readyState === WebSocket.OPEN || controlSocket.readyState === WebSocket.CONNECTING)) {
    return controlSocket;
  }

  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${location.host}/ws`;
  console.log(`Attempting to connect to WebSocket at: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);
  controlSocket = ws;
  window.ws = ws;

  ws.onopen = () => {
    console.log('✅ WebSocket connection established.');
    startGamepadHeartbeat();
  };

  ws.onclose = () => {
    console.log('❌ WebSocket connection closed.');
    stopGamepadHeartbeat();
    if (controlSocket === ws) {
      controlSocket = null;
      window.ws = null;
    }
    scheduleReconnect();
  };

  ws.onerror = (error) => {
    console.error('WebSocket Error:', error);
  };

  ws.onmessage = handleIncomingMessage;
  return ws;
}

// ============================================================================
// OUTGOING MESSAGES (CLICK HANDLERS)
// ============================================================================

function bindClickHandlers() {
    /* == 1) Click handling for CZone battery/relay controls (Tab 4) == */
    const root = document.querySelector('.battery-block');
    root?.addEventListener('click', (e) => {
      const btn = e.target.closest('button.toggle-btn, button.relay-btn');
      if (!btn) return;
      if (!window.ws || window.ws.readyState !== WebSocket.OPEN) { 
        alert('WebSocket is not connected yet'); 
        return; 
      }

      const block = btn.closest('.battery-button-block');
      const bank  = Number(block?.dataset.bank);
      const sw    = Number(block?.dataset.switch);
      const state = Number(btn.dataset.state);
      if (!Number.isFinite(bank) || !Number.isFinite(sw) || !block) return;

      // This is for Tab 4, which you said should be CZone
      const payload = { type:'relay.set', bank, switch: sw, state };
      window.ws.send(JSON.stringify(payload));
      console.log('Sent:', payload);

      // Optimistic UI update
      const group = btn.parentElement;
      group?.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    /* == 1b) M20 Relay Click Handling (Tab 8, etc.) == */
    document.addEventListener('click', (e) => {
      if (!window.ws || window.ws.readyState !== WebSocket.OPEN) return;

      // Standard M20 Relay Buttons (uses data-m20-bank)
      const m20Button = e.target.closest('[data-m20-bank][data-m20-switch] > button[data-state]');
      if (m20Button) {
        const group = m20Button.parentElement;
        const bank = group.dataset.m20Bank;
        const switchNum = group.dataset.m20Switch;
        const state = m20Button.dataset.state;

        // This is for Tab 8, which is M20
        const payload = { type: 'm20relay.set', bank: parseInt(bank), switch: parseInt(switchNum), state: parseInt(state) };
        window.ws.send(JSON.stringify(payload));
        console.log('Sent:', payload);
        
        // Optimistic UI update
        group.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        m20Button.classList.add('active');
        return;
      }

      // Special Handling for 3-Way Nav Lights (also M20)
      const navButton = e.target.closest('[data-nav-lights] > button[data-nav-mode]');
      if (navButton) {
        const mode = navButton.dataset.navMode;
        const anchorSwitch = WEBSOCKET_CONFIG.navLightsAnchorSwitch;
        const navSwitch = WEBSOCKET_CONFIG.navLightsNavSwitch;
        let anchorState = 0;
        let navState = 0;

        if (mode === 'anchor') {
          anchorState = 1;
        } else if (mode === 'nav') {
          anchorState = 1;
          navState = 1;
        }

        const payload1 = { type: 'm20relay.set', bank: WEBSOCKET_CONFIG.navLightsBank, switch: anchorSwitch, state: anchorState };
        const payload2 = { type: 'm20relay.set', bank: WEBSOCKET_CONFIG.navLightsBank, switch: navSwitch, state: navState };
        
        window.ws.send(JSON.stringify(payload1));
        console.log('Sent:', payload1);
        window.ws.send(JSON.stringify(payload2));
        console.log('Sent:', payload2);

        // Optimistic UI update
        navButton.parentElement.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        navButton.classList.add('active');
      }
    });
}

// ============================================================================
// HEARTBEAT & FEEDBACK HANDLERS
// ============================================================================

/* Heartbeat framework */
(function () {
  if (window.__kiloHeartbeatInit) return;
  window.__kiloHeartbeatInit = true;

  const statusTextEl = document.querySelector('.status-text');
  const connEl = document.getElementById('connection-indicator');
  const hbState = { lastSig: null, repeats: 0, stalled: false };

  function arrowFromHeading(deg) {
    const arrows = ['↑','↗','→','↘','↓','↙','←','↖'];
    const slice = Math.max(1, HEARTBEAT_CONFIG.headingSliceDeg);
    const idx = Math.floor(((deg % 360) + 360) % 360 / slice) % arrows.length;
    return arrows[idx];
  }

  function renderStatusLine(msg) {
    const hdg = Number(msg.heading_deg ?? 0);
    const spd = Number(msg.gps_speed_ms ?? 0);
    const time = (msg.utc_time_str || '--:--:--').toString();
    const arr = arrowFromHeading(hdg);
    const eventTail = STATUS_LINE_CONFIG.eventTailText;
    return `${STATUS_LINE_CONFIG.vesselName} ${arr} ${Math.round(hdg)}° ${Math.round(spd)}m/s [${time}]${eventTail}`;
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
    if (!hbState.stalled && hbState.repeats >= HEARTBEAT_CONFIG.stallRepeatThreshold) {
      hbState.stalled = true;
      setHeartbeatStalled(true);
    }
    if (!hbState.stalled) setHeartbeatStalled(false);
    
    updateTelemetryValue('utc-time', msg.utc_time_str);
    updateTelemetryValue('gps_satellites', msg.gps_satellites);
    updateTelemetryValue('gps_lat_deg', msg.gps_lat_deg, 6);
    updateTelemetryValue('gps_lng_deg', msg.gps_lng_deg, 6);
    updateMapFromMavlink(msg);
    updateTelemetryValue('ap_mode', msg.ap_mode || '--');
    if (msg.ap_mode) {
      window.__kiloLatestApMode = msg.ap_mode;
      window.__kiloSetApModeDisplay?.(msg.ap_mode);
    }
    
    if (msg.imu_roll_deg !== undefined) {
      window.__kiloLatestRoll = msg.imu_roll_deg;
      window.__kiloSetGyroRoll?.(msg.imu_roll_deg);
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
  };
})();

/**
 * Handles feedback for all joystick-controlled elements.
 */
function handleControlStateFeedback(msg) {
  
  if (msg.throttle !== undefined) {
    handleThrottleFeedback(msg.throttle, msg.gear, msg.rpm_percent);
  }
  if (msg.steering !== undefined) {
    updateSteeringUI(msg.steering);
  }
  if (msg.engine_trim !== undefined) {
    updateEngineTrimUI(msg.engine_trim);
  }
  if (msg.port_trim !== undefined && msg.starboard_trim !== undefined) {
    updateListingUI(msg.port_trim, msg.starboard_trim);
  }
  if (msg.rpm !== undefined && msg.rpm_percent !== undefined) {
    updateRpmGauge(msg.rpm, msg.rpm_percent);
  }
}

/**
 * Updates ONLY the throttle FEEDBACK elements
 */
function handleThrottleFeedback(throttle, gear, rpm_percent) {
  // Update the FEEDBACK bar (yellow)
  const feedbackFill = document.getElementById("throttle-feedback-fill");
  if (feedbackFill) {
      const visualPercent = throttle / 100;
      const visualOffset = visualPercent * THROTTLE_FEEDBACK_CONFIG.visualHalfPercent;
      
      feedbackFill.style.height = `${Math.abs(visualOffset)}%`;
      if (visualOffset > 0) { // Forward
          feedbackFill.style.bottom = `${THROTTLE_FEEDBACK_CONFIG.neutralCenterPercent}%`;
          feedbackFill.style.top = 'auto';
      } else { // Reverse
          feedbackFill.style.top = `${THROTTLE_FEEDBACK_CONFIG.neutralCenterPercent}%`;
          feedbackFill.style.bottom = 'auto';
      }
  }

  // **** THIS IS THE FIX: Update the thumb text based on feedback ****
  const gearThumb = document.querySelector(".gear-thumb");
  const gearThumbText = gearThumb?.querySelector(".gear-thumb-text");
  if (gearThumbText) {
    const textN = gearThumbText.querySelector('.text-n'); // Collapsed text
    const textNeutral = gearThumbText.querySelector('.text-neutral'); // Expanded text
    
    if (gear === 'N') {
        if(textN) textN.textContent = 'N';
        if(textNeutral) textNeutral.textContent = 'NEUTRAL';
    } else {
        const percent = rpm_percent ?? 0;
        if(textN) textN.textContent = gear; // F or R
        if(textNeutral) textNeutral.textContent = `${percent}%`;
    }
  }

  // **** THIS IS THE FIX: Also update the THUMB POSITION to match feedback ****
  if (gearThumb) {
      const visualPercent = throttle / 100;
      const visualOffset = visualPercent * THROTTLE_FEEDBACK_CONFIG.visualHalfPercent;
      const thumbPos = THROTTLE_FEEDBACK_CONFIG.neutralCenterPercent + visualOffset;
      gearThumb.style.bottom = `${thumbPos}%`;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function initializeControlClickHandlers() {
  if (clickHandlersReady) return;
  clickHandlersReady = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindClickHandlers, { once: true });
  } else {
    bindClickHandlers();
  }
}

export function connectControlWebSocket() {
  shouldMaintainConnection = true;
  clearReconnectTimer();
  return openControlWebSocket();
}

export function disconnectControlWebSocket() {
  shouldMaintainConnection = false;
  clearReconnectTimer();
  stopGamepadHeartbeat();
  if (controlSocket) {
    try { controlSocket.close(1000, 'Auth revoked'); } catch (_) {}
  }
  controlSocket = null;
  window.ws = null;
}
