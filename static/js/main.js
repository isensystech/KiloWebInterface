// ============================================================================
// MODULE IMPORTS
// ============================================================================
import { gamepadControlState, initializeGamepadHandler } from './modules/gamepad-handler.js';
import { 
    initializeAPToggle, 
    initializeHelmToggle,
    initializeTrimTabModal,
    initializeAnchorModal
} from './modules/ui-modals.js';
import {
    initializeGaugePanelLogic,
    initializeDrawerTabs,
    initializeCommToggles,
    initializeSoloToggles,
    initializeSolo3Toggles,
    initializePumpLogic,
    initializeIgnitionButton,
    initializeHouseRelay,
    initializeStartLoaderButton,
    initializeMissionPlayer,
    initializePlayerToggle,
    initializeSafetyButtons,
    initializeSensorToggles
} from './modules/ui-telemetry.js';
import { 
    initializeSafetyCaps, 
    initializeButtons 
} from './modules/ui-buttons.js';
import { initializeNavigation } from './modules/ui-navigation.js';
import { 
    initializeThrottleSlider, 
    initializeRudderTrimBridge, 
    initializeRudderIndicator 
} from './modules/ui-panels.js';
import { 
    connectControlWebSocket,
    disconnectControlWebSocket,
    initializeControlClickHandlers
} from './websocket.js';


// ============================================================================
// CONFIGURATION
// ============================================================================
const MAIN_CONFIG = Object.freeze({
    // Pixel distance to scroll telemetry drawer per bumper press (50–400px keeps it usable)
    drawerScrollStepPx: 200,
    // CSS scroll behavior token applied to drawer scroll animations ('auto' or 'smooth')
    drawerScrollBehavior: 'smooth',
    // Milliseconds of inactivity before forcing the app back to the splash screen (range: 1–8 hr)
    idleTimeoutMs: 8 * 60 * 60 * 1000,
    // Label used anywhere we render the craft/vehicle name in overlays or modals
    vehicleName: 'Kilo #2',
    // Settings specific to the passive screensaver overlay
    screensaver: Object.freeze({
        // Delay before retrying the screensaver WebSocket connection (ms, keep >500)
        reconnectDelayMs: 2000,
        // Voltage bounds mapped onto the circular battery gauge (in volts)
        engineBatteryVoltageRange: Object.freeze({ min: 10, max: 16 }),
        // Percent bounds applied to the tank gauge (0–100% typical)
        fuelPercentRange: Object.freeze({ min: 0, max: 100 })
    })
});

// ============================================================================
// APPLICATION INITIALIZATION (MAIN ENTRY POINT)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Kilo UI Application Starting...");

    // Global height-based zoom (browser-like)
    (function applyHeightZoom() {
        const root = document.documentElement;
        const body = document.body;
        let supportsZoom = false;
        try {
            const prev = root.style.zoom;
            root.style.zoom = '1';
            supportsZoom = root.style.zoom === '1';
            root.style.zoom = prev;
        } catch (e) { supportsZoom = false; }

        const applyScale = () => {
            const scale = Math.max(0.7, Math.min(1, window.innerHeight / 910));
            root.style.setProperty('--height-scale', scale);

            if (supportsZoom) {
                root.style.zoom = scale;
                body.style.transform = '';
                body.style.transformOrigin = '';
                body.style.width = '';
                body.style.height = '';
            } else {
                root.style.zoom = '';
                body.style.transform = `scale(${scale})`;
                body.style.transformOrigin = 'top center';
                body.style.width = `${100 / scale}%`;
                body.style.height = `${100 / scale}%`;
            }
        };

        applyScale();
        window.addEventListener('resize', applyScale);
    })();

    // Initialize all UI modules
    try {
        // Initialize Modals
        initializeAPToggle();
        initializeHelmToggle();
        initializeTrimTabModal();
        initializeAnchorModal();

        // Initialize Telemetry/Drawer/Panel logic
        initializeGaugePanelLogic();
        initializeDrawerTabs();
        initializeCommToggles();
        initializeSoloToggles();
        initializeSolo3Toggles();
        initializePumpLogic();
        initializeIgnitionButton();
        initializeHouseRelay();
        initializeStartLoaderButton(); // Must be called AFTER initializeIgnitionButton
        initializeMissionPlayer();
        initializePlayerToggle();
        initializeSafetyButtons();
        initializeSensorToggles();
        
        // Initialize Payload Buttons
        initializeSafetyCaps();
        initializeButtons();

        // Initialize Navigation
        initializeNavigation();

        // Initialize Panels (Throttle, Rudder, etc.)
        initializeThrottleSlider();
        initializeRudderTrimBridge();
        initializeRudderIndicator();

        // Initialize Gamepad
        initializeGamepadHandler();

        // Control WebSocket + auth overlays
        initializeControlClickHandlers();
        initializeAppSessionFlow();


        console.log("✅ UI modules initialized.");
    } catch (error) {
        console.error("🔥 Failed to initialize UI modules:", error);
    }

    /*
    // ============================================================================
    // WEBSOCKET SENDER - ONLY PLACE GAMEPAD DATA IS SENT
    // ============================================================================
    
    // TUNABLE PARAMETERS
    const GAMEPAD_MESSAGE_INTERVAL = 1000; // milliseconds (1000ms = 1 second)

    console.log("🚀 Starting gamepad WebSocket sender");
    
    setInterval(() => {
        if (window.ws && window.ws.readyState === WebSocket.OPEN) {
            const message = {
                type: "gamepad.set",
                throttle: gamepadControlState.throttle,
                steering: gamepadControlState.steering,
                engine_trim: gamepadControlState.engine_trim,
                port_trim: gamepadControlState.port_trim,
                starboard_trim: gamepadControlState.starboard_trim
            };
            
            // **** THIS IS THE FIX: Added console.log ****
            console.log('Sending gamepad state:', message);
            window.ws.send(JSON.stringify(message));
        }
    }, GAMEPAD_MESSAGE_INTERVAL); */
});


// ============================================================================
// DRAWER PANEL SCROLLING WITH GAMEPAD (OPTIONAL)
// ============================================================================
let drawerScrollGamepadIndex = null;
let backButtonPressed = false;
let forwardButtonPressed = false;

window.addEventListener("gamepadconnected", (event) => {
    if (drawerScrollGamepadIndex === null) {
        drawerScrollGamepadIndex = event.gamepad.index;
    }
});

window.addEventListener("gamepaddisconnected", (event) => {
    if (event.gamepad.index === drawerScrollGamepadIndex) {
        drawerScrollGamepadIndex = null;
    }
});

function pollDrawerScroll() {
    if (drawerScrollGamepadIndex !== null) {
        const gamepad = navigator.getGamepads()[drawerScrollGamepadIndex];
        if (gamepad) {
            const backPressed = gamepad.buttons[8]?.pressed || false;
            const forwardPressed = gamepad.buttons[9]?.pressed || false;
            
            const drawerPanel = document.querySelector('.drawer-panel');
            if (drawerPanel) {
                if (backPressed && !backButtonPressed) {
                    drawerPanel.scrollBy({ 
                        left: -MAIN_CONFIG.drawerScrollStepPx, 
                        behavior: MAIN_CONFIG.drawerScrollBehavior 
                    });
                    backButtonPressed = true;
                } else if (!backPressed) {
                    backButtonPressed = false;
                }
                
                if (forwardPressed && !forwardButtonPressed) {
                    drawerPanel.scrollBy({ 
                        left: MAIN_CONFIG.drawerScrollStepPx, 
                        behavior: MAIN_CONFIG.drawerScrollBehavior 
                    });
                    forwardButtonPressed = true;
                } else if (!forwardPressed) {
                    forwardButtonPressed = false;
                }
            }
        }
    }

    requestAnimationFrame(pollDrawerScroll);
}

pollDrawerScroll();

// ============================================================================
// MODAL PANEL DOCKER
// ============================================================================
function dockModalToDrawer(modal, opts = {}){
    const drawer = document.querySelector(opts.drawerSelector ?? '.drawer-panel');
    if (!modal || !drawer) return;

    const gap = Number(opts.gap ?? 0);

    const dr = drawer.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    const bottom = Math.max(0, vh - dr.bottom);
    const placeToRight = dr.left <= vw / 2;

    modal.__docking = true;
    modal.classList.add('is-docked');
    modal.style.bottom = `${bottom}px`;
    modal.style.maxHeight = `${dr.height}px`;

    if (placeToRight){
        modal.style.left = `${Math.round(dr.right + gap)}px`;
        modal.style.right = 'auto';
    } else {
        modal.style.right = `${Math.round(vw - dr.left + gap)}px`;
        modal.style.left = 'auto';
    }
    modal.__docking = false;
}

function setupDocking(modalSelector, opts = {}){
    const modal = document.querySelector(modalSelector);
    if(!modal) return;

    let isApplyingDock = false;
    const redraw = () => {
        if (isApplyingDock) return;
        isApplyingDock = true;
        try {
            dockModalToDrawer(modal, opts);
        } finally {
            // allow mutation observers to settle before next run
            setTimeout(() => { isApplyingDock = false; }, 0);
        }
    };

    window.addEventListener('resize', redraw);

    const drawer = document.querySelector(opts.drawerSelector ?? '.drawer-panel');
    if (drawer && 'ResizeObserver' in window){
        const ro = new ResizeObserver(redraw);
        ro.observe(drawer);
    }

    const mo = new MutationObserver(() => {
        if (modal.__docking) return;
        if (modal.classList.contains('is-open')) redraw();
    });
    mo.observe(modal, { attributes: true, attributeFilter: ['class','style'] });

    redraw();
}

setupDocking('#helm-modal', { gap: 4 });
setupDocking('#auto-pilot-modal', { gap: 4 });

// This is a no-op placeholder. The real requestStatus is inside ui-buttons.js
// and is called automatically after a fetch button press.
// This global is here for legacy compatibility.
window.requestStatus = () => {};

// ============================================================================
// AUTH / STATE MACHINE / SPLASH & LEGAL FLOW
// ============================================================================

const APP_STATES = Object.freeze({
    SPLASH: 'SPLASH',
    KEYPAD: 'KEYPAD',
    MAIN: 'MAIN'
});

const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

const sessionState = { authenticated: false, legalAck: false };
let currentAppState = APP_STATES.SPLASH;
let splashTransitionPending = false;
let idleTimerId = null;
let keypadController = null;
let legalModalController = null;
let screensaverSocket = null;

function initializeAppSessionFlow() {
    if (window.__kiloSessionFlowInit) return;
    window.__kiloSessionFlowInit = true;

    keypadController = createKeypadController(handleLoginSubmit, () => setAppState(APP_STATES.SPLASH));
    legalModalController = createLegalModalController();

    bindSplashInteraction();
    bindSplashHotkeys();
    bindExitTrigger();
    initializeIdleTracking();
    initializeScreensaverSocket();
    updateOverlayVisibility();
    updateAuthorizationMask();
    refreshSessionState().then((status) => {
        if (status.authenticated) {
            setAppState(APP_STATES.MAIN);
        } else {
            setAppState(APP_STATES.SPLASH);
        }
    });
}

function bindSplashInteraction() {
    const layer = document.getElementById('screensaver-layer');
    if (!layer) return;

    layer.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleSplashInteraction();
    });

    const modal = document.getElementById('screensaverModal');
    modal?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSplashInteraction();
        }
    });
}

function bindSplashHotkeys() {
    document.addEventListener('keydown', (event) => {
        if (currentAppState !== APP_STATES.SPLASH) return;
        if (!shouldTriggerSplashShortcut(event)) return;
        event.preventDefault();
        handleSplashInteraction();
    });
}

function shouldTriggerSplashShortcut(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return false;
    const key = event.key || '';
    if (key === 'Tab' || key === 'Escape' || key === 'Shift') return false;
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') return true;
    return key.length === 1;
}

function bindExitTrigger() {
    const exitIcon = document.getElementById('exit-trigger');
    if (!exitIcon) return;
    exitIcon.style.cursor = 'pointer';
    exitIcon.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        logoutUser('manual');
    });
}

async function logoutUser(reason = 'manual') {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ reason })
        });
    } catch (err) {
        console.warn('Logout request failed:', err);
    } finally {
        clearSessionState();
        setAppState(APP_STATES.SPLASH);
    }
}

async function handleSplashInteraction() {
    if (splashTransitionPending) return;
    splashTransitionPending = true;
    try {
        const status = await refreshSessionState();
        if (status.authenticated) {
            setAppState(APP_STATES.MAIN);
        } else {
            setAppState(APP_STATES.KEYPAD);
        }
    } finally {
        splashTransitionPending = false;
    }
}

function setAppState(nextState) {
    if (!Object.values(APP_STATES).includes(nextState)) return;
    const previous = currentAppState;
    currentAppState = nextState;

    updateOverlayVisibility();
    updateAuthorizationMask();

    if (nextState === APP_STATES.MAIN) {
        resetIdleTimer();
    } else {
        clearIdleTimer();
    }

    if (nextState === APP_STATES.KEYPAD) {
        keypadController?.open();
    } else if (previous === APP_STATES.KEYPAD) {
        keypadController?.close();
    }

    updateControlChannel();
    maybeOpenLegalModal();
}

function updateOverlayVisibility() {
    const splashModal = document.getElementById('screensaverModal');
    if (splashModal) {
        splashModal.setAttribute('aria-hidden', currentAppState === APP_STATES.SPLASH ? 'false' : 'true');
    }
    const passcodeModal = document.getElementById('passcodeModal');
    if (passcodeModal) {
        passcodeModal.setAttribute('aria-hidden', currentAppState === APP_STATES.KEYPAD ? 'false' : 'true');
    }
}

function updateAuthorizationMask() {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;
    const allowMainView = currentAppState === APP_STATES.MAIN && sessionState.authenticated && sessionState.legalAck;
    overlay.hidden = allowMainView;
}

function updateControlChannel() {
    if (currentAppState === APP_STATES.MAIN && sessionState.authenticated && sessionState.legalAck) {
        connectControlWebSocket();
    } else {
        disconnectControlWebSocket();
    }
}

function initializeIdleTracking() {
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((evt) => document.addEventListener(evt, recordUserActivity, { passive: true }));
}

function recordUserActivity() {
    if (currentAppState !== APP_STATES.MAIN) return;
    resetIdleTimer();
}

function resetIdleTimer() {
    clearIdleTimer();
    idleTimerId = window.setTimeout(handleIdleTimeout, MAIN_CONFIG.idleTimeoutMs);
}

function clearIdleTimer() {
    if (idleTimerId) {
        clearTimeout(idleTimerId);
        idleTimerId = null;
    }
}

function handleIdleTimeout() {
    logoutUser('idle');
}

function applySessionStatus(status = {}) {
    sessionState.authenticated = Boolean(status.authenticated);
    sessionState.legalAck = Boolean(status.legal_ack);
    if (typeof window !== 'undefined') {
        window.__joystickSessionPrefs = status?.joystick_prefs ?? null;
        window.dispatchEvent(new CustomEvent('session:status', { detail: { ...status } }));
    }
    updateControlChannel();
    maybeOpenLegalModal();
    updateAuthorizationMask();
    return status;
}

function clearSessionState() {
    sessionState.authenticated = false;
    sessionState.legalAck = false;
    if (typeof window !== 'undefined') {
        window.__joystickSessionPrefs = null;
        window.dispatchEvent(new CustomEvent('session:status', { detail: {} }));
    }
    updateControlChannel();
    maybeOpenLegalModal();
    updateAuthorizationMask();
}

async function refreshSessionState() {
    try {
        const response = await fetch('/api/session', { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Session lookup failed');
        const data = await response.json();
        return applySessionStatus(data);
    } catch (err) {
        clearSessionState();
        setAppState(APP_STATES.SPLASH);
        return { authenticated: false, legal_ack: false };
    }
}

async function handleLoginSubmit(pin) {
    const body = { pin };
    let response;
    try {
        response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body)
        });
    } catch {
        throw new Error('Unable to reach server');
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.detail || 'Invalid PIN');
    }

    applySessionStatus(payload);
    setAppState(APP_STATES.MAIN);
}

function createKeypadController(onSubmit, onCancel) {
    const modal = document.getElementById('passcodeModal');
    if (!modal) return { open() {}, close() {} };

    const dialog = modal.querySelector('.passcode-dialog');
    const helper = modal.querySelector('#pc-helper');
    const PASSCODE_LENGTH = 4;
    const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
    const pointerEventName = supportsPointer ? 'pointerdown' : 'touchstart';
    let code = '';
    let active = false;
    let submitting = false;
    let lastFocused = null;
    const pinContainer = modal.querySelector('.pc-pin');

    function ensurePinDots() {
        if (!pinContainer) return;
        const current = pinContainer.querySelectorAll('.pc-dot').length;
        if (current === PASSCODE_LENGTH) return;
        pinContainer.innerHTML = '';
        for (let idx = 0; idx < PASSCODE_LENGTH; idx += 1) {
            const span = document.createElement('span');
            span.className = 'pc-dot';
            span.dataset.idx = String(idx);
            pinContainer.appendChild(span);
        }
    }

    function renderDots() {
        ensurePinDots();
        modal.querySelectorAll('.pc-dot').forEach((dot, idx) => {
            dot.classList.toggle('filled', idx < code.length);
        });
    }

    function setHelper(text) {
        if (helper) helper.textContent = text || '';
    }

    async function submitCode() {
        if (code.length < PASSCODE_LENGTH || submitting) {
            if (code.length < PASSCODE_LENGTH) setHelper(`Enter ${PASSCODE_LENGTH}-digit code`);
            return;
        }
        submitting = true;
        setHelper('Verifying...');
        try {
            await onSubmit(code);
        } catch (err) {
            setHelper(err?.message || 'Invalid PIN');
        } finally {
            submitting = false;
            code = '';
            renderDots();
        }
    }

    function processInteraction(target) {
        if (!target) return false;
        if (target.hasAttribute?.('data-pc-close')) {
            onCancel();
            return true;
        }

        const key = target.closest?.('.pc-key');
        if (!key || submitting) return false;

        const action = key.getAttribute('data-action');
        const digit = key.getAttribute('data-key');

        if (action === 'clear') {
            code = '';
            renderDots();
            setHelper('');
            return true;
        }

        if (action === 'enter') {
            submitCode();
            return true;
        }

        if (digit != null) {
            if (code.length >= PASSCODE_LENGTH) return true;
            code += digit;
            renderDots();
            setHelper('');
            return true;
        }

        return false;
    }

    function suppressNextClick(element) {
        if (!element) return;
        const once = (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
        };
        element.addEventListener('click', once, { capture: true, once: true });
    }

    function handlePointerDown(event) {
        if (!active) return;
        const target = event.target;
        const consumed = processInteraction(target);
        if (!consumed) return;

        if (event.type === 'touchstart' || event.pointerType === 'touch' || event.pointerType === 'pen') {
            event.preventDefault();
        }
        const interactive = target.closest?.('[data-pc-close], .pc-key') || target;
        suppressNextClick(interactive);
    }

    function handleClick(event) {
        // Allow keyboard activation (detail === 0) but skip pointer-triggered clicks.
        if (event.detail > 0) return;
        processInteraction(event.target);
    }

    function handleKeydown(event) {
        if (!active) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            submitCode();
            return;
        }
        if (/^\d$/.test(event.key)) {
            event.preventDefault();
            if (code.length < PASSCODE_LENGTH) {
                code += event.key;
                renderDots();
                setHelper('');
            }
            return;
        }
        if (event.key === 'Backspace') {
            event.preventDefault();
            code = code.slice(0, -1);
            renderDots();
        }
    }

    function trapFocus(event) {
        if (!active || !dialog) return;
        if (!dialog.contains(event.target)) {
            event.stopPropagation();
            dialog.focus({ preventScroll: true });
        }
    }

    return {
        open() {
            if (active) return;
            active = true;
            code = '';
            ensurePinDots();
            renderDots();
            setHelper('');
            lastFocused = document.activeElement;
            modal.setAttribute('aria-hidden', 'false');
            dialog?.setAttribute('tabindex', '-1');
            dialog?.focus({ preventScroll: true });
            modal.addEventListener(pointerEventName, handlePointerDown, { passive: false });
            modal.addEventListener('click', handleClick);
            document.addEventListener('keydown', handleKeydown);
            document.addEventListener('focus', trapFocus, true);
        },
        close() {
            if (!active) return;
            active = false;
            if (modal.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (_) {}
            }
            modal.setAttribute('aria-hidden', 'true');
            modal.removeEventListener(pointerEventName, handlePointerDown);
            modal.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleKeydown);
            document.removeEventListener('focus', trapFocus, true);
            if (lastFocused && document.contains(lastFocused)) {
                try { lastFocused.focus({ preventScroll: true }); } catch (_) {}
            }
        }
    };
}

function createLegalModalController() {
    const modal = document.getElementById('legal-modal');
    const backdrop = document.getElementById('legal-backdrop');
    const acceptBtn = document.getElementById('legal-accept');
    const helper = document.getElementById('legal-helper');
    let pending = false;

    function setError(message) {
        if (helper) helper.textContent = message || '';
    }

    function open() {
        if (!modal || !backdrop) return;
        backdrop.hidden = false;
        modal.hidden = false;
        setError('');
    }

    function close() {
        if (!modal || !backdrop) return;
        modal.hidden = true;
        backdrop.hidden = true;
        setError('');
    }

    const controller = { open, close, setError };

    async function handleAccept() {
        if (pending) return;
        pending = true;
        setError('');
        if (acceptBtn) acceptBtn.disabled = true;
        try {
            const response = await fetch('/api/legal-ack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin'
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.detail || 'Unable to accept terms');
            applySessionStatus(payload);
            controller.close();
        } catch (err) {
            setError(err?.message || 'Unable to accept terms');
        } finally {
            pending = false;
            if (acceptBtn) acceptBtn.disabled = false;
        }
    }

    acceptBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        handleAccept();
    });

    return controller;
}

function maybeOpenLegalModal() {
    if (!legalModalController) return;
    if (currentAppState === APP_STATES.MAIN && sessionState.authenticated && !sessionState.legalAck) {
        legalModalController.open();
    } else {
        legalModalController.close();
    }
}

function initializeScreensaverSocket() {
    if (screensaverSocket) {
        try { screensaverSocket.close(); } catch (_) {}
    }
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws/screensaver`;

    function connect() {
        screensaverSocket = new WebSocket(url);
        window.__kiloScreensaverSocket = screensaverSocket;
        window.__kiloScreensaverDebugUpdate = updateScreensaverGauges;
        screensaverSocket.onmessage = (evt) => {
            try {
                const payload = JSON.parse(evt.data);
                if (payload.type === 'screensaver') {
                    updateScreensaverGauges(payload);
                }
            } catch {
                // ignore malformed data
            }
        };
        screensaverSocket.onclose = () => {
            setTimeout(connect, MAIN_CONFIG.screensaver.reconnectDelayMs);
        };
        screensaverSocket.onerror = () => {
            try { screensaverSocket.close(); } catch (_) {}
        };
    }

    connect();
}

function updateScreensaverGauges(data) {
    const modal = document.getElementById('screensaverModal');
    if (!modal) return;

    const titleEl = modal.querySelector('#ss-title');
    if (titleEl) titleEl.textContent = MAIN_CONFIG.vehicleName;

    if (typeof data.engine_battery === 'number') {
        const voltageValue = modal.querySelector('#voltage-gauge-value');
        if (voltageValue) voltageValue.textContent = data.engine_battery.toFixed(1);
        const batteryGauge = modal.querySelector('#battery-gauge-10-6');
        if (batteryGauge) {
            const { min: minV, max: maxV } = MAIN_CONFIG.screensaver.engineBatteryVoltageRange;
            const span = Math.max(0.0001, maxV - minV);
            const percent = Math.max(0, Math.min(100, ((data.engine_battery - minV) / span) * 100));
            batteryGauge.style.setProperty('--pct', `${percent.toFixed(0)}%`);
        }
    }

    if (typeof data.fuel_level === 'number') {
        const { min: minFuel, max: maxFuel } = MAIN_CONFIG.screensaver.fuelPercentRange;
        const clamped = Math.max(minFuel, Math.min(maxFuel, data.fuel_level));
        const fuelValue = modal.querySelector('#fuel-gauge-value');
        if (fuelValue) fuelValue.textContent = clamped.toFixed(0);
        const fuelUnit = modal.querySelector('#fuel-gauge-unit');
        if (fuelUnit) fuelUnit.textContent = '%';
        modal.querySelectorAll('#fuel-gauge .fuel-gauge').forEach((el) => {
            el.style.setProperty('--pct', `${clamped.toFixed(0)}%`);
        });
    }
}






/* =========================== DEV_AUTH_BYPASS START ===========================
   Drop-in dev bypass for local work:
   - Forces MAIN state without PIN or server.
   - Hides auth overlay.
   - Disables control/screensaver sockets to avoid backend dependency.
   Remove this entire block (START..END) to restore normal auth behavior.
============================================================================= */
(() => {
  // Toggle: set to false or delete this block to restore normal auth.
  const ENABLE = true;
  if (!ENABLE) return;

  // 1) Pretend user is authenticated and legal terms accepted
  try {
    sessionState.authenticated = false;
    sessionState.legalAck = true;
  } catch (_e) { /* ignore if not yet defined */ }

  // 2) Patch overlay logic: allow MAIN view regardless of server flags
  try {
    const __updateAuthorizationMask = updateAuthorizationMask;
    updateAuthorizationMask = function devBypassUpdateAuthorizationMask() {
      const overlay = document.getElementById('auth-overlay');
      if (!overlay) return;
      const allowMainView = (currentAppState === APP_STATES.MAIN);
      overlay.hidden = allowMainView;
    };
  } catch (_e) { /* noop */ }

  // 3) Prevent backend socket connections during bypass
  try {
    const __updateControlChannel = updateControlChannel;
    updateControlChannel = function devBypassUpdateControlChannel() {
      if (typeof disconnectControlWebSocket === 'function') {
        try { disconnectControlWebSocket(); } catch (_) {}
      }
      // Intentionally do not call connectControlWebSocket
    };
  } catch (_e) { /* noop */ }

  try {
    const __initializeScreensaverSocket = initializeScreensaverSocket;
    initializeScreensaverSocket = function devBypassNoScreensaverSocket() {
      // No-op in dev bypass
    };
  } catch (_e) { /* noop */ }

  // 4) Skip keypad & server checks and jump to MAIN immediately
  try {
    const __handleSplashInteraction = handleSplashInteraction;
    handleSplashInteraction = async function devBypassHandleSplashInteraction() {
      setAppState(APP_STATES.MAIN);
    };
  } catch (_e) { /* noop */ }

  // 5) Short-circuit PIN submit to succeed instantly (in case keypad is shown)
  try {
    const __handleLoginSubmit = handleLoginSubmit;
    handleLoginSubmit = async function devBypassHandleLoginSubmit(_pin) {
      applySessionStatus({ authenticated: true, legal_ack: true });
      setAppState(APP_STATES.MAIN);
    };
  } catch (_e) { /* noop */ }

  // 6) If app is on SPLASH/KEYPAD right now, push it to MAIN
  try { setAppState(APP_STATES.MAIN); } catch (_e) { /* ignore */ }
})();
/* ============================ DEV_AUTH_BYPASS END =========================== */
