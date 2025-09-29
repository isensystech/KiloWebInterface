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

# install minimal deps if required (currently none beyond stdlib for static serving)
# if you add Flask or similar later:
# pip install -r requirements.txt

# run
python app.py
# open your browser at the printed URL (commonly http://127.0.0.1:5000/)

```

### Configuration
Right now the UI is static and runs without configuration.
When you wire backends, consider these environment variables:
* ``` KILO_BIND ``` – host:port to serve the UI (e.g., 0.0.0.0:5000)
* ``` KILO_BACKEND_URL ``` – base URL for the control API (REST or WS)
* ``` KILO_PROFILE ``` – dev / prod to toggle logging & hot-reload
Add a .env.example to the repo if you standardize these.

### Development Workflow
* Fast UI iteration: edit files in static/ and refresh.
* State retention (to implement): define stable IDs for tabs/panels; on load, restore from localStorage. (This is explicitly listed in the repo as a feature request.) 
* Adapters: create thin modules for each hardware/protocol (MAVLink, Dometic, OXE, etc.). Keep UI messages consistent (e.g., toggle_relay, set_throttle, mode_change) and translate in the adapter layer.

### Recommended Dev Conventions
* Use semantic class names for toggles and indicators (.toggle--armed, .indicator--fault).
* Keep all network calls centralized in a single JS module (e.g., static/js/api.js).
* Provide mock backends for UI work (/mock/* JSON routes or an in-browser “demo mode”).

## Project Structure
```
KiloWebInterface/
├─ app.py              # Minimal Python entry point to serve UI
├─ static/             # Front-end (HTML/CSS/JS, icons, fonts)
├─ .gitignore
└─ README.md

```
### Roadmap
- [ ] Persist tab/screen state across reloads (localStorage)
- [ ] Wire M20 control surface to backend
- [x] Wire EGES control surface to backend
- [ ] Add MAVLink telemetry & basic commands (arm/disarm, mode, go-to)
- [ ] Add Dometic drive controls & indicators
- [ ] Add OXE engine controls & gauges
- [ ] Introduce a mock backend and “Demo Mode” for UI-only testing
- [ ] Basic auth/session for protected controls
- [ ] Packaging for deployment on a Raspberry Pi or container