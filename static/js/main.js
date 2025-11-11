// ============================================================================
// MODULE IMPORTS
// ============================================================================
import { gamepadControlState, initializeGamepadHandler } from './modules/gamepad-handler.js';
import { initializeAPToggle, initializeHelmToggle } from './modules/ui-modals.js';
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
    // Pixel distance to scroll telemetry drawer per bumper press
    drawerScrollStepPx: 200,
    // CSS scroll behavior for drawer movement
    drawerScrollBehavior: 'smooth'
});

const VEHICLE_NAME = 'Kilo #2';

// ============================================================================
// APPLICATION INITIALIZATION (MAIN ENTRY POINT)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Kilo UI Application Starting...");
    
    // Initialize all UI modules
    try {
        // Initialize Modals
        initializeAPToggle();
        initializeHelmToggle();

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

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

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
    idleTimerId = window.setTimeout(handleIdleTimeout, IDLE_TIMEOUT_MS);
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
    updateControlChannel();
    maybeOpenLegalModal();
    updateAuthorizationMask();
    return status;
}

function clearSessionState() {
    sessionState.authenticated = false;
    sessionState.legalAck = false;
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

    function handleClick(event) {
        const target = event.target;
        if (target?.hasAttribute?.('data-pc-close')) {
            onCancel();
            return;
        }

        const key = target.closest?.('.pc-key');
        if (!key || submitting) return;

        const action = key.getAttribute('data-action');
        const digit = key.getAttribute('data-key');

        if (action === 'clear') {
            code = '';
            renderDots();
            setHelper('');
            return;
        }

        if (action === 'enter') {
            submitCode();
            return;
        }

        if (digit != null) {
            if (code.length >= PASSCODE_LENGTH) return;
            code += digit;
            renderDots();
            setHelper('');
        }
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
            setTimeout(connect, 2000);
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
    if (titleEl) titleEl.textContent = VEHICLE_NAME;

    if (typeof data.engine_battery === 'number') {
        const voltageValue = modal.querySelector('#voltage-gauge-value');
        if (voltageValue) voltageValue.textContent = data.engine_battery.toFixed(1);
        const batteryGauge = modal.querySelector('#battery-gauge-10-6');
        if (batteryGauge) {
            const percent = Math.max(0, Math.min(100, ((data.engine_battery - 10) / 6) * 100));
            batteryGauge.style.setProperty('--pct', `${percent.toFixed(0)}%`);
        }
    }

    if (typeof data.fuel_level === 'number') {
        const clamped = Math.max(0, Math.min(100, data.fuel_level));
        const fuelValue = modal.querySelector('#fuel-gauge-value');
        if (fuelValue) fuelValue.textContent = clamped.toFixed(0);
        const fuelUnit = modal.querySelector('#fuel-gauge-unit');
        if (fuelUnit) fuelUnit.textContent = '%';
        modal.querySelectorAll('#fuel-gauge .fuel-gauge').forEach((el) => {
            el.style.setProperty('--pct', `${clamped.toFixed(0)}%`);
        });
    }
}

// Kill blur right now to verify the culprit visually
document.documentElement.style.setProperty('--__debug_no_blur', '1');
const css = `
  .passcode-backdrop, .screensaver-backdrop, #auth-overlay,
  .passcode-modal, .screensaver-modal {
    filter: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
`;
const style = Object.assign(document.createElement('style'), { textContent: css });
document.head.appendChild(style);
