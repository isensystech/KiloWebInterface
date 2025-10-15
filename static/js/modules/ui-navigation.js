      /* SCRIPT // FOOTER and NAVIGATION   */
  
               // === Initial State ===
                let currentScreen = 1;
                let deviceStates = {
                '0x550': Array(8).fill(0),
                '0x551': Array(8).fill(0),
                '0x552': Array(8).fill(0)
                };

                // === DOM Elements ===
                const connectionIndicator = document.getElementById('connection-indicator');
                const statusBar = document.getElementById('status-bar');
                const debugPanel = document.getElementById('debug-panel');
                const controllerHeartbeat = document.getElementById('controller-heartbeat');
                const deviceHeartbeats = document.getElementById('device-heartbeats');

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
                document.getElementById('prev-screen')?.addEventListener('click', () => {
                const prev = currentScreen === 1 ? 3 : currentScreen - 1;
                switchScreen(prev);
                });

                document.getElementById('next-screen')?.addEventListener('click', () => {
                const next = currentScreen === 3 ? 1 : currentScreen + 1;
                switchScreen(next);
                });

                // Dots
                document.querySelectorAll('.indicator-dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    const screenNumber = parseInt(dot.dataset.screen);
                    switchScreen(screenNumber);
                });
                });

                // Toggle debug panel
                statusBar?.addEventListener('click', () => {
                debugPanel.classList.toggle('open');
                });


 
