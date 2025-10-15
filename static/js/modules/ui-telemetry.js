
      /* MODAL GAUGES PANEL   */
  
    // === Safety block smart placement ===
    // Moves safety-block to the right of gauges-panel if it overlaps the footer.

    document.addEventListener('DOMContentLoaded', () => {
    const parent  = document.querySelector('.gauges-button-panel');
    const panel   = parent?.querySelector('.gauges-panel');
    const safety  = parent?.querySelector('.safety-block');
    const footer  = document.querySelector('footer, .footer, #footer'); // try common footer hooks

    if (!parent || !panel || !safety || !footer) return;

    // Check viewport overlap between safety-block and footer
    const overlapsFooter = () => {
        const s = safety.getBoundingClientRect();
        const f = footer.getBoundingClientRect();
        return s.bottom > f.top && s.top < f.bottom; // vertical intersection
    };

    // Place safety under the panel (default stacked layout)
    const placeStacked = () => {
        parent.classList.remove('side-safety');
        safety.style.position = '';    // back to normal flow
        safety.style.top = '';
        safety.style.left = '';
        safety.style.marginTop = 'auto';
    };

    // Place safety to the right of the panel, bottom-aligned to panel
    const placeSide = () => {
        parent.classList.add('side-safety');

        // Compute coordinates relative to the parent
        const leftPx = panel.offsetWidth + 12; // 12px gap to the right of the panel
        const topPx  = (panel.offsetTop + panel.offsetHeight) - safety.offsetHeight;

        safety.style.position = 'absolute';
        safety.style.left = `${leftPx}px`;
        safety.style.top  = `${topPx}px`;
        safety.style.marginTop = '0';
    };

    const update = () => {
        // Start from stacked to measure true overlap
        placeStacked();
        // Next frame, evaluate overlap and possibly move aside
        requestAnimationFrame(() => {
        if (overlapsFooter()) placeSide();
        });
    };

    // Recalculate on resize/scroll (footer visibility/position changes)
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('scroll',  update, { passive: true });

    update();
    });
 




      /* MODAL DRAWER PANEL   */
  
    // Drawer tabs switching (data-tab = 1..8)
        (function () {
            const tabsRoot = document.getElementById('drawerTabs');      // tabs container
            const contentRoot = document.getElementById('drawerContent'); // panes container
            if (!tabsRoot || !contentRoot) return;

            const tabs  = Array.from(tabsRoot.querySelectorAll('.drawer-tab'));
            const panes = Array.from(contentRoot.querySelectorAll('.tab-pane'));

            // Activate a tab/pane by number
            function activate(n) {
            // 1) switch tab visuals
            tabs.forEach(t => t.classList.remove('active'));
            const tab = tabs.find(t => Number(t.dataset.tab) === n);
            if (tab) tab.classList.add('active');

            // 2) switch content panes
            panes.forEach(p => p.classList.remove('active'));
            const pane = panes.find(p => Number(p.dataset.tab) === n);
            if (pane) pane.classList.add('active');
            }

            // Click handlers for each tab
            tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const n = Number(tab.dataset.tab);
                activate(n);
            });
            // Accessibility: keyboard support
            tab.setAttribute('tabindex', '0');
            tab.setAttribute('role', 'tab');
            tab.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate(Number(tab.dataset.tab));
                }
            });
            });

            // Ensure initial state matches the HTML (active on load)
            const initial = tabs.find(t => t.classList.contains('active'));
            activate(initial ? Number(initial.dataset.tab) : 1);
        })();
 

          /* TAB 1: Boat Control   */
      
                // Communication toggle: updates display from button data attributes
                    document.addEventListener('DOMContentLoaded', () => {
                    document.querySelectorAll('.comm-block').forEach(block => {
                        const displaySignal = block.querySelector('[data-key="signal"]');
                        const displayDbm    = block.querySelector('[data-key="dbm"]');
                        const buttons       = block.querySelectorAll('.comm-toggle .comm-btn');

                        // helper: apply values from a button
                        const applyFromBtn = (btn) => {
                        if (displaySignal) displaySignal.textContent = btn.dataset.signal ?? '--';
                        if (displayDbm)    displayDbm.textContent    = btn.dataset.dbm ?? '--';
                        };

                        // init: set from the pre-active button
                        const active = block.querySelector('.comm-btn.active') || buttons[0];
                        if (active) applyFromBtn(active);

                        // click handling
                        block.querySelector('.comm-toggle').addEventListener('click', (e) => {
                        const btn = e.target.closest('.comm-btn');
                        if (!btn) return;
                        buttons.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        applyFromBtn(btn);
                        });
                    });
                    });


            /* === SOLO toggle styles (scoped) === */
                // JS scoped only to .solo-toggle to avoid collisions with existing handlers
                document.addEventListener('DOMContentLoaded', () => {
                document.querySelectorAll('.solo-toggle').forEach(group => {
                    group.addEventListener('click', (e) => {
                    const btn = e.target.closest('.solo-btn');
                    if (!btn || !group.contains(btn)) return;

                    // clear and set active within this isolated group
                    group.querySelectorAll('.solo-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    // No display to update here; extend later if needed
                    });
                });
                });


            /* === SOLO3 toggle styles (scoped) === */
                // Scoped JS only for .solo3-toggle
                document.addEventListener('DOMContentLoaded', () => {
                document.querySelectorAll('.solo3-toggle').forEach(group => {
                    group.addEventListener('click', (e) => {
                    const btn = e.target.closest('.solo3-btn');
                    if (!btn || !group.contains(btn)) return;

                    // Clear and set active
                    group.querySelectorAll('.solo3-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Example: log or later update display if needed
                    console.log("Selected:", btn.textContent, btn.dataset.value);
                    });
                });
                });

            /* === Pump === */
                document.addEventListener('DOMContentLoaded', () => {
                    document.querySelectorAll('.half-relay').forEach(group => {
                    const autoBtn = group.querySelector('.relay-btn.auto');
                    const onBtn   = group.querySelector('.relay-btn.on');

                    const clearStates = () => {
                        [autoBtn, onBtn].forEach(b => {
                        b.classList.remove('active');
                        b.classList.remove('live');
                        });
                    };

                    const getAutoLiveTarget = () => {
                        return (group.dataset.liveDefault || 'on').toLowerCase() === 'on' ? onBtn : autoBtn;
                    };

                    const setMode = (mode) => {
                        clearStates();

                        if (mode === 'auto') {
                        autoBtn.classList.add('active');
                        getAutoLiveTarget().classList.add('live');
                        } else if (mode === 'on') {
                        onBtn.classList.add('active');
                        onBtn.classList.add('live');
                        }

                        group.dataset.mode = mode;
                    };

                    // Инициализация: Auto по умолчанию
                    setMode(group.dataset.mode || 'auto');

                    // Обработчики кликов
                    autoBtn.addEventListener('click', () => setMode('auto'));
                    onBtn.addEventListener('click', () => setMode('on'));

                    // Внешнее обновление (например, по телеметрии)
                    group.updateLive = (isOn) => {
                        if ((group.dataset.mode || 'auto') !== 'auto') return;
                        autoBtn.classList.remove('live');
                        onBtn.classList.remove('live');
                        (isOn ? onBtn : autoBtn).classList.add('live');
                    };

                    // Сейчас: live = On
                    onBtn.classList.add('live');
                    });
                });

     

          /* TAB 2: Payload Control   */
      
            // === Control of drawer display state ===
            // All comments in English.

            function setDrawerDisplay(state) {
            // state should be either "authorized" or "prohibited"
            const display = document.getElementById("drawer-display");
            if (!display) return;

            const icon = display.querySelector(".display-icon");
            const text = display.querySelector(".display-value");

            if (state === "authorized") {
                icon.src = "images/unlock-icon.svg";
                icon.alt = "Unlock";
                text.textContent = "Release Authorized";
            } else if (state === "prohibited") {
                icon.src = "images/lock-icon.svg";
                icon.alt = "Lock";
                text.textContent = "Release Prohibited";
            }
            }

            // Example: default is "authorized"
            // Later you can call setDrawerDisplay("prohibited") when external signal arrives
     


          /* TAB 4: Battery Status   */
      
            document.addEventListener('DOMContentLoaded', () => {
            const btn = document.getElementById('ignitionBtn');

            const setState = (n) => btn.setAttribute('data-state', String(n));

            // Клик по всей кнопке в состояниях 1 и 3 -> переход в сплит (2)
            btn.addEventListener('click', (e) => {
                const s = Number(btn.getAttribute('data-state') || 1);
                if (s === 1 || s === 3) setState(2);
            });

            // Обработчики половинок в состоянии 2
            btn.querySelector('.half-off').addEventListener('click', (e) => {
                e.stopPropagation();           // не пускаем событие вверх
                setState(1);                   // Off -> назад в 1
            });
            btn.querySelector('.half-start').addEventListener('click', (e) => {
                e.stopPropagation();
                setState(3);                   // Start -> в 3 (зелёный)
            });
            });
     

          /* TAB 4: ENGINE. House Relay   */
      
        // 3-way relay control: Off / Auto / On
        document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.drawer-button-relay').forEach(group => {
            const offBtn  = group.querySelector('.relay-btn.off');
            const autoBtn = group.querySelector('.relay-btn.auto');
            const onBtn   = group.querySelector('.relay-btn.on');

            // Find paired display within the same relay-controls block
            const displayValue = group.closest('.relay-controls')?.querySelector('.display-value');

            // Helpers
            const clearStates = () => {
            [offBtn, autoBtn, onBtn].forEach(b => {
                b.classList.remove('active'); // gray fill (manual selection)
                b.classList.remove('live');   // white outline (actual state)
            });
            };

            const getAutoLiveTarget = () => {
            // Default: 'on'. Switch to 'off' by setting data-live-default="off" on the group.
            return (group.dataset.liveDefault || 'on').toLowerCase() === 'off' ? offBtn : onBtn;
            };

            const updateDisplayForMode = (mode) => {
            if (!displayValue) return;

            if (mode === 'on') {
                // Show value from the ON button
                displayValue.textContent = onBtn.dataset.value || '--';
            } else if (mode === 'auto') {
                // Mirror the current live target in AUTO (default is ON)
                const liveTarget = getAutoLiveTarget();
                displayValue.textContent = liveTarget.dataset.value || '--';
            } else {
                // OFF -> placeholder
                displayValue.textContent = '--';
            }
            };

            const setMode = (mode) => {
            clearStates();

            if (mode === 'off') {
                offBtn.classList.add('active');
                offBtn.classList.add('live');         // real state = Off
            } else if (mode === 'on') {
                onBtn.classList.add('active');
                onBtn.classList.add('live');          // real state = On
            } else { // 'auto'
                autoBtn.classList.add('active');      // manual selection is Auto (gray fill)
                getAutoLiveTarget().classList.add('live'); // real state decided externally (default here)
            }

            updateDisplayForMode(mode);
            group.dataset.mode = mode;
            };

            // Init — start from existing data-mode or 'auto'
            setMode(group.dataset.mode || 'auto');

            // Click handlers
            offBtn.addEventListener('click',  () => setMode('off'));
            onBtn.addEventListener('click',   () => setMode('on'));
            autoBtn.addEventListener('click', () => setMode('auto'));

            // Public hook for telemetry: switch the live outline in AUTO without changing gray selection
            group.updateLive = (isOn) => {
            if ((group.dataset.mode || 'auto') !== 'auto') return;
            offBtn.classList.remove('live');
            onBtn.classList.remove('live');
            (isOn ? onBtn : offBtn).classList.add('live');
            if (displayValue) displayValue.textContent = isOn ? (onBtn.dataset.value || '--') : '--';
            };
        });
        });
     

          /* TAB 4: ENGINE. ANIMATION LOAD   */
      
        // All comments in English.

        /** Get loader element once */
        const getStartLoaderEl = () => document.getElementById('start-loader');

        /** Show overlay with optional auto-hide */
        function showStartLoader(durationMs = 1200){
        // guard: the element must exist
        const el = getStartLoaderEl();
        if(!el) return;

        // prevent click-through interactions
        el.style.pointerEvents = 'auto';

        // show
        el.classList.add('show');

        // clear previous timers if any
        if (el._hideTimer) clearTimeout(el._hideTimer);

        // auto-hide after duration (we can remove this once real animation controls the lifecycle)
        el._hideTimer = setTimeout(() => hideStartLoader(), durationMs);
        }

        /** Hide overlay */
        function hideStartLoader(){
        const el = getStartLoaderEl();
        if(!el) return;
        el.classList.remove('show');
        el.style.pointerEvents = 'none';
        }

        /** Hook into existing ignition half buttons */
        document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('ignitionBtn');
        if(!btn) return;

        // keep existing handlers...
        const setState = (n) => btn.setAttribute('data-state', String(n));

        // left half remains the same
        const halfOff = btn.querySelector('.half-off');
        if (halfOff){
            halfOff.addEventListener('click', (e) => {
            e.stopPropagation();
            setState(1);
            // If loader was shown previously, ensure it is hidden
            hideStartLoader();
            });
        }

        // right half: now also trigger loader
        const halfStart = btn.querySelector('.half-start');
        if (halfStart){
            halfStart.addEventListener('click', (e) => {
            e.stopPropagation();
            setState(3);             // your existing green state
            showStartLoader();       // show loader overlay (auto hides)
            });
        }
        });
     
        
      
        function mountStartPower(opts = {}){
        const slot = document.querySelector('#start-loader .loader-slot');
        if (!slot) return;

        const fillMs = Number(opts.fillMs ?? 2000);
        const lineMs = Number(opts.lineMs ?? 1000);

        // Inject SVG (unit circumference via pathLength="1")
        slot.setAttribute('role', 'img');
        slot.setAttribute('aria-label', 'Starting…');
        slot.innerHTML = `
            <div class="start-power" style="--fill-ms:${fillMs}ms; --line-ms:${lineMs}ms" aria-hidden="true">
            <svg viewBox="0 0 100 100" focusable="false" aria-hidden="true">
                <circle class="start-power__track" cx="50" cy="50" r="45"/>
                <circle class="start-power__progress" id="startPowerProgress"
                        cx="50" cy="50" r="45" pathLength="1"
                        style="--start-frac:0.0833333; --sweep-frac:0.8333333;"/>
                <line class="start-power__line" x1="50" y1="5.7" x2="50" y2="35"/>
            </svg>
            </div>
        `;

        const root = slot.querySelector('.start-power');
        const progress = slot.querySelector('#startPowerProgress');

        // Enforce jitter inline so cascade can't override it
        root.classList.add('is-booting');
        root.style.willChange = 'transform, filter';
        root.style.animation = `startPowerJitter ${fillMs}ms ease-in-out 0s 1 both`;

        if (progress){
            progress.addEventListener('animationend', () => {
            root.classList.remove('is-booting');
            root.style.animation = 'none';
            root.classList.add('is-filled');
            setTimeout(() => {
                hideStartLoader();
                const s = document.querySelector('#start-loader .loader-slot');
                if (s) s.innerHTML = '';
            }, lineMs);
            }, { once: true });
        }
        }

        // Keep overlay visible for the whole run
        (function attachPowerToLoader(){
        const _origShow = window.showStartLoader;
        window.showStartLoader = function(){
            mountStartPower({ fillMs: 2000, lineMs: 1000 });
            if (typeof _origShow === 'function') _origShow(2000 + 1000 + 150);
        };
        })();
     

          /* TAB 4: BATTERY LINES   */

          /* TAB 5: Mission Pleer   */
      

            // === Minimal timeline logic: evenly space waypoints and move the yellow cursor ===
            (function(){
            // scope to the first mission-pleer on the page
            const pleer = document.querySelector('.mission-pleer');
            if(!pleer) return;

            const track = pleer.querySelector('.timeline-track');
            const points = [...pleer.querySelectorAll('.mission-waypoint')];
            const cursor = pleer.querySelector('.mission-cursor');
            const prevBtn = pleer.querySelector('.js-prev');
            const nextBtn = pleer.querySelector('.js-next');

            let idx = 0; // current waypoint index

            // Position waypoints evenly across the track
            const layoutPoints = () => {
                const n = points.length;
                points.forEach((p, i) => {
                const pct = (n === 1) ? 50 : (i/(n-1))*100;
                p.style.left = pct + '%';
                });
            };

            // Move cursor to waypoint by index
            const updateCursor = () => {
                const target = points[idx];
                if(!target) return;
                cursor.style.left = target.style.left || '0%';
                // enable/disable nav buttons
                prevBtn && (prevBtn.disabled = (idx === 0));
                nextBtn && (nextBtn.disabled = (idx === points.length - 1));
            };

            // Nav handlers
            prevBtn && prevBtn.addEventListener('click', () => { if(idx>0){ idx--; updateCursor(); } });
            nextBtn && nextBtn.addEventListener('click', () => { if(idx<points.length-1){ idx++; updateCursor(); } });

            // Re-layout on resize
            window.addEventListener('resize', layoutPoints);

            layoutPoints();
            updateCursor();
            })();




            
            // Toggle Play/Pause icon and title
            document.addEventListener('DOMContentLoaded', () => {
            const btn = document.querySelector('.pleer-buttons .js-play-toggle');
            if (!btn) return;

            // SVG icons (stroke uses currentColor)
            const ICONS = {
                pause: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6v12M16 6v12"/></svg>',
                play:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z"/></svg>'
            };

            // Initial state = "pause" (matches current icon)
            btn.dataset.state = 'pause';
            btn.setAttribute('aria-pressed', 'false');

            function render() {
                const st = btn.dataset.state;          // "pause" | "play"
                btn.innerHTML = st === 'pause' ? ICONS.pause : ICONS.play;
                btn.title = st === 'pause' ? 'Pause' : 'Play';
                btn.setAttribute('aria-label', btn.title);
                btn.setAttribute('aria-pressed', st === 'play' ? 'true' : 'false');
            }

            btn.addEventListener('click', () => {
                btn.dataset.state = btn.dataset.state === 'pause' ? 'play' : 'pause';
                render();
                // TODO: dispatch your real player command here if needed
                // e.g., player.pause() / player.play()
            });

            render();
            });

     

          /* TAB 6: Safety   */
      
            document.addEventListener("DOMContentLoaded", () => {
            const bigButtons = document.querySelectorAll(".big-drawer-button");

            bigButtons.forEach((button) => {
                const label = button.querySelector(".button-drawer-label");
                const originalText = label.textContent;

                button.addEventListener("click", () => {
                button.classList.toggle("active");

                if (button.classList.contains("active")) {
                    if (originalText.includes("Silent Mode")) {
                    // special case for Silent Mode
                    label.textContent = "Silent Mode On";
                    } else {
                    // default case for other Kill-buttons
                    label.textContent = originalText.replace("Kill", "").trim() + " Killed";
                    }
                } else {
                    label.textContent = originalText;
                }
                });
            });
            });
     

          /* TAB 8: Sensors   */
      
            document.addEventListener("DOMContentLoaded", () => {
            const toggles = document.querySelectorAll(".drawer-button-toggle");

            toggles.forEach(toggle => {
                const buttons = toggle.querySelectorAll(".toggle-btn");
                const display = toggle.parentElement.querySelector(".drawer-button-display");
                const valueEl = display.querySelector(".display-value");

                buttons.forEach(btn => {
                btn.addEventListener("click", () => {
                    // remove active from all
                    buttons.forEach(b => b.classList.remove("active"));
                    // set active
                    btn.classList.add("active");

                    // update only value (unit stays the same)
                    const value = btn.dataset.value || "--";
                    valueEl.textContent = value;
                });
                });
            });
            });
     


