# USV Kilo UI V 1.0

A web-based control and monitoring dashboard for Kilo, a USV (Uncrewed Surface Vehicle) platform. The UI focuses on a dark, “tactical” control surface with true toggles, clear state feedback, and room for expansion into engine controls, relay banks, and autopilot/MAVLink integrations. Current code organizes a static front-end served by a lightweight Python entry point, with the intent to wire it to live CAN/MAVLink backends as modules mature. “Kilo USV Control Dashboard” is the canonical project label in the repository.
## Features

### Today

* Clean, dark UI foundation ready for control surfaces and telemetry.
* Static assets (HTML/CSS/JS) organized for quick iteration.
* Python entry point (```app.py```) to serve the interface locally.
### Near-term
* Persist screen/tab state across reloads using localStorage (unique tab IDs + stored layout/selection) as already noted in the repo’s feature list. 

### Planned & Not-Yet-Hooked-Up UI Elements

The repository lists several functional integrations that are visible in the UI plan but not yet wired to live backends:

* M20 Functions – panel & actions to control M20-class modules. 
* EGES Functions – UI elements for EGES subsystem control. 
* MAVLink Functions – basic autopilot state, arming, modes, waypoint actions. 
* Dometic Functions – drive/throttle system interactions via an adapter layer. 
* OXE Functions – OXE engine control/telemetry surfaces. 
* Session Persistence – remember active tab/screen and key toggles via localStorage.

### Architecture
* Front-end: Plain HTML/CSS/JS (no heavy framework), optimized for kiosk-style control UIs.
* Server (dev/local): Minimal Python app (see app.py) to serve static files. Intended to be swapped or augmented with:
  -  WebSocket or REST adapters to CAN/MAVLink bridges
  -  Module adapters for engine/drive systems (Dometic, OXE)
  -  General I/O (relays, sensors) endpoints

### Design Goals

* Zero-friction local run for UI iteration.
* Clear separation between UI components and hardware/protocol adapters.
* Safe defaults: UI can run without connected hardware for layout/UX work.

## Getting Started
### Prerequisites
* Python 3.10+ (recommended)
* pip (or uv/pipx if you prefer)
* Python dependencies:
  ```bash
  pip install fastapi uvicorn
  # (rospy is optional unless you are running the ROS bridge on the same host)
  ```

Install & Run (Local)
```
# clone
git clone https://github.com/isensystech/KiloWebInterface.git
cd KiloWebInterface

# (optional) create a venv
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# install dependencies
pip install fastapi uvicorn

# run
python app.py
# open your browser at the printed URL (commonly http://127.0.0.1:5000/)

```

### Configuration
Right now the UI is static and runs without configuration.
When you wire backends, consider these environment variables:
* ``` KILO_BIND ``` – host:port to serve the UI (default ``0.0.0.0:5000``)
* ``` KILO_RELOAD ``` – set to `1`/`true` to enable uvicorn reload mode during local dev
* ``` KILO_LOG_LEVEL ``` – override uvicorn's log level (default `info`)
* ``` KILO_CONTROL_TOKEN ``` – optional shared secret for headless/ROS WebSocket clients (`ws://host/ws?token=...`)
* ``` KILO_CONTROL_WHITELIST ``` – comma-separated list of IPs that may connect to `/ws` without cookies or a token (e.g., `192.168.0.130`)
* ``` KILO_ALLOW_ANON_CONTROL_WS ``` – set to `1` to temporarily allow legacy unauthenticated WebSocket clients (not recommended for exposed deployments)
* ``` KILO_BACKEND_URL ``` – base URL for the control API (REST or WS)
* ``` KILO_PROFILE ``` – dev / prod to toggle logging & hot-reload
Add a .env.example to the repo if you standardize these.

#### Generating a control token
Use Python’s secrets module to mint a URL-safe token and share it with the ROS team:

```bash
python - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
```
Set `KILO_CONTROL_TOKEN` to the printed value on the server, and have the ROS client append `?token=<value>` when opening `ws://host/ws`.

### Development Workflow
* Fast UI iteration: edit files in static/ and refresh.
* State retention (to implement): define stable IDs for tabs/panels; on load, restore from localStorage. (This is explicitly listed in the repo as a feature request.) 
* Adapters: create thin modules for each hardware/protocol (MAVLink, Dometic, OXE, etc.). Keep UI messages consistent (e.g., toggle_relay, set_throttle, mode_change) and translate in the adapter layer.

### Recommended Dev Conventions
* Use semantic class names for toggles and indicators (.toggle--armed, .indicator--fault).
* Keep all network calls centralized in a single JS module (e.g., ```static/js/api.js```).
* Provide mock backends for UI work (/mock/* JSON routes or an in-browser “demo mode”).

## Project Structure
```
KiloWebInterface/
├─ static/
│  ├─ css/
│  │  ├─ main.css          # Base layout & components
│  │  └─ theme.css         # Dark theme / variables
│  ├─ images/              # UI icons & assets
│  └─ js/
│     ├─ main.js           # UI logic, handlers, state
│     └─ websocket.js      # WS client (telemetry/control wiring point)
├─ static/index.html       # Dashboard HTML shell
├─ app.py                  # Minimal server to host static UI
├─ .gitignore
└─ README.md


```
### Roadmap

- [ ] Persist tab/screen state across reloads (```localStorage```)
- [x] Wire M20 control surface to backend
- [x] Wire EGES control surface to backend
- [x] Add MAVLink telemetry & basic commands (arm/disarm, mode, go-to)
- [x] Add Dometic drive controls & indicators
- [x] Add OXE engine controls & gauges
- [x] Introduce a mock backend and “Demo Mode” for UI-only testing
- [x] Basic auth/session for protected controls
- [ ] Packaging for deployment on a Raspberry Pi or container
- [ ] Collective Power Trim Tab Joystick binding

```
### To_do backend
- [ ] Fix slow login screen.
- [ ] Fix Steering gauge to -30 to +30
- [x] Introduce "Springy", "Pilot hold" control schema
- [x] Inroduce Gear datapoint in WS message.
- [x] Fix screensave default values
- [ ] Joystick dash icon should start in red
- [x] "Crewed" mode to AP Modes 

```
### To-Do Frontend MVP
- [ ] Rework id="debug-panel"
- [ ] Debrand Nompanion off "Kilo" 
- [ ] Make Gear Popups with progress bar
- [x] Fix Engine button
- [ ] Improve Trim Tab & Gyroscope feedback modal
- [ ] Improve Anchor Control modal
- [ ] Fix Payload contlols safety-caps opening
- [ ] Add Battery status dot path
- [ ] Fill tooltips for 1-8 tabs drawer
- [ ] Create a new PS dash error icon
- [ ] Add meaning to carousel-titles
- [ ] Make minimal size 1366 x 768, check other resolutions
- [ ] Adapt to keyboard


```
### To-Do Frontend 
- [ ] Unify fonts
- [ ] Unify colors
- [ ] Adapt to tablet THIS IS NOT NEEDED!!!!!
- [ ] Unify classes and name it with ID
- [ ] Configure and unify all hover functions
- [ ] Configure all modals correctly and unify it
- [ ] Configure all modal-backdrops correctly and unify it
- [ ] Unify all objects (buttons, titles, sliders, displays, ect.)
- [ ] Configure animation in legal-modal, add kilo-logo.svg
- [ ] Repaint the central boat picture
