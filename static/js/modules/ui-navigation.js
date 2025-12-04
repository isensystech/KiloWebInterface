/* SCRIPT // FOOTER and NAVIGATION   */

// ============================================================================
// CONFIGURATION
// ============================================================================
import { invalidateMovingMapSize } from '../map-layer.js';

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
    const cameraStage = document.getElementById('camera-feed-stage');
    const movingMapLayer = document.getElementById('moving-map-layer');
    const mapPipControls = document.getElementById('map-pip-controls');
    const modeButtons = Array.from(document.querySelectorAll('[data-camera-mode-btn]'));
    const zoomButtons = Array.from(document.querySelectorAll('[data-camera-zoom-btn]'));
    const recordButtons = Array.from(document.querySelectorAll('[data-camera-record-btn]'));
    const modeLabels = modeButtons.map(btn => btn.querySelector('.camera-btn-label') || btn);
    const zoomLabels = zoomButtons.map(btn => btn.querySelector('.camera-btn-label') || btn);
    const recordLabels = recordButtons.map(btn => btn.querySelector('.camera-btn-label') || btn);

    const cameraState = {
        primary: 'map',
        zoom: false,
        mode: 'eo',
        recording: false
    };

    function applyCameraLayout() {
        const body = document.body;
        if (!body) return;

        const isCameraView = currentScreen === 3;
        const cameraPrimary = isCameraView && cameraState.primary === 'camera';

        body.classList.toggle('fpv-camera-primary', cameraPrimary);
        body.classList.toggle('fpv-map-primary', isCameraView && cameraState.primary === 'map');
        body.classList.toggle('fpv-pip-zoomed', isCameraView && cameraState.zoom);

        if (cameraOverlay) {
            cameraOverlay.classList.toggle('is-recording', isCameraView && cameraState.recording);
        }

        if (cameraFeedImg) {
            cameraFeedImg.src = cameraState.mode === 'ir' ? CAMERA_MEDIA.night : CAMERA_MEDIA.normal;
        }

        modeButtons.forEach(btn => btn.setAttribute('aria-pressed', cameraState.mode === 'ir' ? 'true' : 'false'));
        modeLabels.forEach(label => { label.textContent = cameraState.mode === 'ir' ? 'EO' : 'IR'; });

        zoomButtons.forEach(btn => btn.setAttribute('aria-pressed', cameraState.zoom ? 'true' : 'false'));
        zoomLabels.forEach(label => { label.textContent = cameraState.zoom ? 'X1' : 'X2'; });

        recordButtons.forEach(btn => btn.setAttribute('aria-pressed', cameraState.recording ? 'true' : 'false'));
        recordLabels.forEach(label => { label.textContent = cameraState.recording ? 'Stop' : 'Rec'; });

        if (movingMapLayer) {
            movingMapLayer.classList.toggle('is-pip', cameraPrimary);
            movingMapLayer.classList.toggle('is-pip-zoomed', cameraPrimary && cameraState.zoom);
            if (!cameraPrimary) {
                movingMapLayer.removeAttribute('style');
            }
            invalidateMovingMapSize();
        }

        if (mapPipControls) {
            const isVisible = cameraPrimary && currentScreen === 3;
            mapPipControls.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
            mapPipControls.classList.toggle('is-zoomed', cameraPrimary && cameraState.zoom);
        }
    }

    function setCameraMode(mode) {
        cameraState.mode = mode === 'ir' ? 'ir' : 'eo';
        applyCameraLayout();
    }

    function toggleZoom() {
        cameraState.zoom = !cameraState.zoom;
        applyCameraLayout();
    }

    function toggleRecording() {
        cameraState.recording = !cameraState.recording;
        applyCameraLayout();
    }

    function swapFeeds() {
        cameraState.primary = cameraState.primary === 'camera' ? 'map' : 'camera';
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

        if (cameraOverlay) {
            const isCamera = screenNumber === 3;
            cameraOverlay.setAttribute('aria-hidden', isCamera ? 'false' : 'true');
        }

        if (screenNumber !== 3) {
            body.classList.remove('fpv-camera-primary', 'fpv-map-primary', 'fpv-pip-zoomed');
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

    if (cameraStage) {
        cameraStage.addEventListener('click', () => {
            if (currentScreen === 3 && cameraState.primary === 'map') {
                swapFeeds();
            }
        });
    }

    zoomButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleZoom();
        });
    });

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextMode = cameraState.mode === 'eo' ? 'ir' : 'eo';
            setCameraMode(nextMode);
        });
    });

    recordButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleRecording();
        });
    });

    if (movingMapLayer) {
        movingMapLayer.addEventListener('click', () => {
            if (currentScreen === 3 && cameraState.primary === 'camera') {
                swapFeeds();
            }
        });
    }

    applyOverlayState(currentScreen);
}
