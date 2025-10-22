import { gamepadControlState } from './modules/gamepad-handler.js';

// ============================================================================
// WEBSOCKET SENDER - ONLY PLACE GAMEPAD DATA IS SENT
// ============================================================================

// TUNABLE PARAMETERS
const GAMEPAD_MESSAGE_INTERVAL = 1000; // milliseconds (1000ms = 1 second)

document.addEventListener('DOMContentLoaded', () => {
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
            
            window.ws.send(JSON.stringify(message));
        }
    }, GAMEPAD_MESSAGE_INTERVAL);
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
    mo.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });

    redraw();
}

setupDocking('#helm-modal', { gap: 4 });
setupDocking('#auto-pilot-modal', { gap: 4 });

window.requestStatus = () => {}; // no-op placeholder