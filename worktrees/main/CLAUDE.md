# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kilo USV Control Dashboard** - A web-based control and monitoring interface for Kilo, an Uncrewed Surface Vehicle (USV) platform. The system provides a dark, tactical control surface for boat operations, telemetry monitoring, payload control, and engine management.

## Architecture

### Backend (FastAPI + WebSocket)
- **Entry point**: `app.py` - FastAPI server serving static files and WebSocket connections
- **WebSocket endpoint**: `/ws` - Bidirectional communication for control commands and telemetry
- **Button handler**: `/button-click` - POST endpoint for button interactions (currently minimal)

### Frontend (Vanilla JS + Modules)
The UI is plain HTML/CSS/JS with no framework dependencies, organized into:

- **`static/index.html`** - Main SPA entry point with all UI markup
- **`static/css/`**
  - `main.css` - Base layout, components, and tactical dark theme
  - `theme.css` - CSS variables and theme customization
- **`static/js/`**
  - `main.js` - Legacy gamepad polling, throttle/rudder/trim controls, modal docking
  - `websocket.js` - WebSocket client, message routing, heartbeat framework, relay/M20/MAVLink handlers
  - **`modules/`** (ES6 modules):
    - `gamepad-handler.js` - Gamepad state management (throttle, steering, trim) - exports `gamepadControlState`
    - `ui-navigation.js` - Screen carousel navigation (3 screens), indicator dots, debug panel toggle
    - `ui-buttons.js` - Button interactions and state management
    - `ui-modals.js` - Modal window controls
    - `ui-panels.js` - Drawer panel tab switching
    - `ui-telemetry.js` - Telemetry display updates

### Key Communication Patterns

**WebSocket Message Types** (sent from client):
- `relay.set` - Control relay banks (battery, power distribution)
- `m20relay.set` - M20 module relay control (pumps, radar, nav lights, etc.)
- `gamepad.set` - Gamepad state (throttle, steering, trim) sent every 20ms from `main.js`

**WebSocket Message Types** (received by client):
- `relay.state` - Relay state updates for battery/power controls
- `relay.voltage` - Voltage readings for battery studs
- `m20relay.state` - M20 relay bank state (switches 0-19)
- `mavlink.state` - Autopilot telemetry (GPS, IMU, heading, speed, UTC time, connection status)

### Gamepad Integration

**Two gamepad systems coexist**:
1. **`gamepad-handler.js`** (modern): Manages `gamepadControlState` object, sends via WebSocket every 20ms
2. **`main.js`** (legacy): Direct gamepad polling for screen navigation (B4/B5), throttle (axis 1), rudder (axis 2), trim (D-pad)

**Important**: Throttle uses accumulated position in `main.js` but direct mapping in `gamepad-handler.js` - these may conflict.

### Heartbeat & Connection Monitoring

**Stall detection** (`websocket.js:105-184`):
- Monitors `mavlink.state` messages for repeated identical signatures
- After 10 identical messages → marks connection as "stalled"
- Updates status bar and connection indicator CSS classes

**Status indicators** track state changes:
- Joystick, autopilot, companion computer connection status
- Only show/animate on state transitions (prevents flicker)

## Development Commands

### Run the development server
```bash
python app.py
# Or with uvicorn directly:
uvicorn app:app --reload --host 0.0.0.0 --port 5000
```

### No build/test commands
This project has no build step, linters, or test suite. Changes to `static/` files are live on refresh.

## Common Development Patterns

### Adding a new relay control
1. Add button HTML in `index.html` with `data-bank` and `data-switch` attributes
2. Click handling is automatic via event delegation in `websocket.js:32-55` (battery relays) or `:60-103` (M20 relays)
3. Backend receives `relay.set` or `m20relay.set` WebSocket message

### Adding new telemetry fields
1. Update `websocket.js:306-341` in the `mavlink.state` handler
2. Add corresponding HTML element with matching ID (e.g., `id="gps_satellites"`)
3. Data binding is automatic via `document.getElementById()`

### Updating status indicators
Use `handleStatusIndicator()` helper (`websocket.js:245-271`) to show/hide icons only on state changes:
```javascript
handleStatusIndicator('joystick-indicator', msg.joystick_connected);
```

### M20 Relay Special Cases
- **Nav Lights** (3-way button): Controls TWO switches (anchor=3, nav=5) with custom logic (`websocket.js:78-102`)
- State updates require special handling to reconstruct 3-way mode from two binary switches (`websocket.js:222-240`)

### Modal Docking
Modals dock flush to the `.drawer-panel` using `dockModalToDrawer()` in `main.js:463-527`. This auto-adjusts on window resize and drawer changes via `ResizeObserver` and `MutationObserver`.

## Hardware Integration (Not Yet Implemented)

The UI is designed to connect to:
- **CAN bus** adapters for engine telemetry (OXE)
- **MAVLink** bridge for autopilot state
- **M20 modules** for relay banks and power distribution
- **Dometic drive systems** for throttle/engine control

Currently, all controls send WebSocket messages but backend does not forward to hardware. Backend logic should be added in `app.py` to bridge WebSocket → CAN/MAVLink/serial.

## File Organization Principles

- **Single HTML file** (`index.html`) contains all markup - no template system
- **CSS** uses semantic class names (`.toggle--armed`, `.indicator--fault`)
- **JS modules** are self-contained - import what you need, export state objects
- **WebSocket messages** are the single source of truth for state - UI is presentation layer only

## Critical Implementation Notes

1. **Gamepad state is sent every 20ms** from `main.js:543-548` - this interval is separate from the polling loop
2. **Heartbeat detection** uses signature comparison, not timestamps - identical telemetry triggers stall warning
3. **Modal positioning** recalculates on multiple events - be careful with performance when adding new modals
4. **Battery voltage gauge** is hardcoded for bank 10, stud 6 (`websocket.js:273-304`) - generalize if adding more gauges
5. **WebSocket reconnection** is not implemented - page refresh required on disconnect
