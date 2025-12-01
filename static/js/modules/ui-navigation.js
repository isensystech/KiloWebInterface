/* SCRIPT // FOOTER and NAVIGATION   */

// ============================================================================
// CONFIGURATION
// ============================================================================
const NAVIGATION_CONFIG = Object.freeze({
    // Number of carousel screens (used to wrap arrow navigation)
    screenCount: 3
});

const CAMERA_MEDIA = Object.freeze({
    normal: '/static/images/DummyCameraFeed.jpg',
    night: '/static/images/DummyIRCameraFeed.jpeg'
});

/**
 * Initializes all screen navigation (arrows, dots) and the debug panel toggle.
 */
export function initializeNavigation() {

    // === Module-Scoped State ===
    let currentScreen = 1;

    // === DOM Elements ===
    const statusBar = document.getElementById('status-bar');
    const debugPanel = document.getElementById('debug-panel');
    const prevArrow = document.getElementById('prev-screen');
    const nextArrow = document.getElementById('next-screen');
    const cameraOverlay = document.getElementById('camera-feed-overlay');
    const cameraFeedImg = cameraOverlay?.querySelector('.camera-feed-img');
    const cameraFullscreenBtn = document.getElementById('camera-fullscreen-btn');
    const cameraZoomBtn = document.getElementById('camera-zoom-btn');
    const cameraModeBtn = document.getElementById('camera-mode-btn');
    const movingMapLayer = document.getElementById('moving-map-layer');

    const cameraState = {
        fullscreen: false,
        zoom: false,
        night: false
    };

    const fullscreenLabel = cameraFullscreenBtn?.querySelector('.camera-btn-label');
    const zoomLabel = cameraZoomBtn?.querySelector('.camera-btn-label') || cameraZoomBtn;
    const modeLabel = cameraModeBtn?.querySelector('.camera-btn-label') || cameraModeBtn;

    function applyCameraLayout() {
        const body = document.body;
        if (!body) return;

        const isCameraView = currentScreen === 3;
        const fullscreenActive = isCameraView && cameraState.fullscreen;
        const zoomActive = isCameraView && cameraState.zoom;

        body.classList.toggle('camera-fullscreen', fullscreenActive);
        body.classList.toggle('camera-zoomed', zoomActive);

        if (cameraFullscreenBtn) {
            cameraFullscreenBtn.setAttribute('aria-pressed', fullscreenActive ? 'true' : 'false');
        }
        if (fullscreenLabel) {
            fullscreenLabel.textContent = fullscreenActive ? 'Exit Full Screen' : 'Full Screen';
        }

        if (cameraZoomBtn) {
            cameraZoomBtn.setAttribute('aria-pressed', zoomActive ? 'true' : 'false');
        }
        if (zoomLabel) {
            zoomLabel.textContent = zoomActive ? 'X1' : 'X2';
        }

        if (cameraModeBtn) {
            cameraModeBtn.setAttribute('aria-pressed', cameraState.night ? 'true' : 'false');
        }
        if (modeLabel) {
            modeLabel.textContent = cameraState.night ? 'Normal Camera' : 'Night Vision';
        }

        if (movingMapLayer) {
            if (fullscreenActive) {
                movingMapLayer.style.setProperty('position', 'fixed', 'important');
                movingMapLayer.style.setProperty('right', '24px', 'important');
                movingMapLayer.style.setProperty('bottom', 'auto', 'important');
                const topValue = Math.max(0, window.innerHeight - 220 - 24);
                movingMapLayer.style.setProperty('top', `${topValue}px`, 'important');
                movingMapLayer.style.setProperty('left', 'auto', 'important');
                movingMapLayer.style.setProperty('inset', 'auto', 'important');
                movingMapLayer.style.setProperty('width', '360px', 'important');
                movingMapLayer.style.setProperty('height', '220px', 'important');
                movingMapLayer.style.setProperty('pointer-events', 'auto', 'important');
                movingMapLayer.style.setProperty('z-index', '1400', 'important');
            } else {
                movingMapLayer.removeAttribute('style');
            }
        }
    }

    function setCameraMode(nightOn) {
        cameraState.night = nightOn;
        if (cameraFeedImg) {
            cameraFeedImg.src = nightOn ? CAMERA_MEDIA.night : CAMERA_MEDIA.normal;
        }
        applyCameraLayout();
    }

    function toggleFullscreen() {
        cameraState.fullscreen = !cameraState.fullscreen;
        applyCameraLayout();
    }

    function toggleZoom() {
        cameraState.zoom = !cameraState.zoom;
        applyCameraLayout();
    }

    function applyOverlayState(screenNumber) {
        const body = document.body;
        if (!body) return;

        body.classList.remove('view-map', 'view-camera');

        if (screenNumber === 2) {
            body.classList.add('view-map');
        } else if (screenNumber === 3) {
            body.classList.add('view-camera');
        }

        if (screenNumber !== 3) {
            body.classList.remove('camera-fullscreen', 'camera-zoomed');
        }

        if (cameraOverlay) {
            const isCamera = screenNumber === 3;
            cameraOverlay.setAttribute('aria-hidden', isCamera ? 'false' : 'true');
        }

        applyCameraLayout();
    }

    // === Screen Navigation Logic ===
    function switchScreen(screenNumber) {
        // Deactivate all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const targetScreen = document.getElementById(`screen-${screenNumber}`);
        if (targetScreen) targetScreen.classList.add('active');

        // Update indicator dots
        document.querySelectorAll('.indicator-dot').forEach(dot => {
            dot.classList.remove('active');
        });
        const activeDot = document.querySelector(`.indicator-dot[data-screen="${screenNumber}"]`);
        if (activeDot) activeDot.classList.add('active');

        // Update carousel title
        document.querySelectorAll('.carousel-title').forEach(title => {
            title.classList.remove('active');
        });
        const visibleTitle = document.querySelector(`.carousel-title[data-screen="${screenNumber}"]`);
        if (visibleTitle) visibleTitle.classList.add('active');

        currentScreen = screenNumber;
        applyOverlayState(screenNumber);
    }

    // === Event Listeners ===

    // Arrows
    if (prevArrow) {
        prevArrow.addEventListener('click', () => {
            const prev = currentScreen === 1 ? NAVIGATION_CONFIG.screenCount : currentScreen - 1;
            switchScreen(prev);
        });
    }

    if (nextArrow) {
        nextArrow.addEventListener('click', () => {
            const next = currentScreen === NAVIGATION_CONFIG.screenCount ? 1 : currentScreen + 1;
            switchScreen(next);
        });
    }

    // Dots
    document.querySelectorAll('.indicator-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const screenNumber = parseInt(dot.dataset.screen);
            switchScreen(screenNumber);
        });
    });

    // Toggle debug panel
    if (statusBar) {
        statusBar.addEventListener('click', () => {
            if (debugPanel) {
                debugPanel.classList.toggle('open');
            }
        });
    }

    if (cameraFullscreenBtn) {
        cameraFullscreenBtn.addEventListener('click', () => {
            toggleFullscreen();
        });
    }

    if (cameraZoomBtn) {
        cameraZoomBtn.addEventListener('click', () => {
            toggleZoom();
        });
    }

    if (cameraModeBtn) {
        cameraModeBtn.addEventListener('click', () => {
            setCameraMode(!cameraState.night);
        });
    }

    if (movingMapLayer) {
        movingMapLayer.addEventListener('click', () => {
            if (cameraState.fullscreen && currentScreen === 3) {
                cameraState.fullscreen = false;
                applyCameraLayout();
            }
        });
    }

    applyOverlayState(currentScreen);
}
