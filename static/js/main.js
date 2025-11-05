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
                    drawerPanel.scrollBy({ left: -200, behavior: 'smooth' });
                    backButtonPressed = true;
                } else if (!backPressed) {
                    backButtonPressed = false;
                }
                
                if (forwardPressed && !forwardButtonPressed) {
                    drawerPanel.scrollBy({ left: 200, behavior: 'smooth' });
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
}

function setupDocking(modalSelector, opts = {}){
    const modal = document.querySelector(modalSelector);
    if(!modal) return;

    const redraw = () => dockModalToDrawer(modal, opts);

    window.addEventListener('resize', redraw);

    const drawer = document.querySelector(opts.drawerSelector ?? '.drawer-panel');
    if (drawer && 'ResizeObserver' in window){
        const ro = new ResizeObserver(redraw);
        ro.observe(drawer);
    }

    const mo = new MutationObserver(() => { if (modal.classList.contains('is-open')) redraw(); });
    mo.observe(modal, { attributes: true, attributeFilter: ['class','style'] });

    redraw();
}

setupDocking('#helm-modal', { gap: 4 });
setupDocking('#auto-pilot-modal', { gap: 4 });

// This is a no-op placeholder. The real requestStatus is inside ui-buttons.js
// and is called automatically after a fetch button press.
// This global is here for legacy compatibility.
window.requestStatus = () => {};