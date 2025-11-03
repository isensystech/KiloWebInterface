/* SCRIPT // FOOTER and NAVIGATION   */

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
    }

    // === Event Listeners ===

    // Arrows
    if (prevArrow) {
        prevArrow.addEventListener('click', () => {
            const prev = currentScreen === 1 ? 3 : currentScreen - 1;
            switchScreen(prev);
        });
    }

    if (nextArrow) {
        nextArrow.addEventListener('click', () => {
            const next = currentScreen === 3 ? 1 : currentScreen + 1;
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
}