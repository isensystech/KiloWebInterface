/* MODAL GAUGES PANEL   */

// ============================================================================
// CONFIGURATION
// ============================================================================
const TELEMETRY_CONFIG = Object.freeze({
  // Horizontal offset applied when safety block shifts beside the gauges
  gaugeSafetySideOffsetPx: 12,
  startLoader: {
    // Duration of the circular fill animation
    fillMs: 2000,
    // Time allotted for the follow-up line animation
    lineMs: 1000,
    // Extra buffer before hiding the loader after animations finish
    hideBufferMs: 150,
    // Minimum time the overlay remains visible once triggered
    overlayTimeoutMs: 1200
  },
  // How long status indicators stay visible after a healthy update
  statusIndicatorHideTimeoutMs: 5000,
  batteryGauge: {
    // Voltage range mapped onto the gauge arc
    minVoltage: 11.0,
    maxVoltage: 14.5,
    // Threshold at which the gauge flips into the warning style
    lowVoltageThreshold: 12.0
  }
});

// === Safety block smart placement ===
export function initializeGaugePanelLogic() {
  const parent = document.querySelector('.gauges-button-panel');
  const panel = parent?.querySelector('.gauges-panel');
  const safety = parent?.querySelector('.safety-block');
  const footer = document.getElementById('footer');

  if (!parent || !panel || !safety || !footer) return;

  const overlapsFooter = () => {
    const s = safety.getBoundingClientRect();
    const f = footer.getBoundingClientRect();
    return s.bottom > f.top && s.top < f.bottom;
  };

  const placeStacked = () => {
    parent.classList.remove('side-safety');
    safety.style.position = '';
    safety.style.top = '';
    safety.style.left = '';
    safety.style.marginTop = 'auto';
  };

  const placeSide = () => {
    parent.classList.add('side-safety');
    const leftPx = panel.offsetWidth + TELEMETRY_CONFIG.gaugeSafetySideOffsetPx;
    const topPx = (panel.offsetTop + panel.offsetHeight) - safety.offsetHeight;
    safety.style.position = 'absolute';
    safety.style.left = `${leftPx}px`;
    safety.style.top = `${topPx}px`;
    safety.style.marginTop = '0';
  };

  const update = () => {
    placeStacked();
    requestAnimationFrame(() => {
      if (overlapsFooter()) placeSide();
    });
  };

  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('scroll', update, { passive: true });
  update();
}


/* MODAL DRAWER PANEL   */
export function initializeDrawerTabs() {
  const tabsRoot = document.getElementById('drawerTabs');
  const contentRoot = document.getElementById('drawerContent');
  if (!tabsRoot || !contentRoot) return;

  const tabs = Array.from(tabsRoot.querySelectorAll('.drawer-tab'));
  const panes = Array.from(contentRoot.querySelectorAll('.tab-pane'));

  function activate(n) {
    tabs.forEach(t => t.classList.remove('active'));
    const tab = tabs.find(t => Number(t.dataset.tab) === n);
    if (tab) tab.classList.add('active');

    panes.forEach(p => p.classList.remove('active'));
    const pane = panes.find(p => Number(p.dataset.tab) === n);
    if (pane) pane.classList.add('active');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const n = Number(tab.dataset.tab);
      activate(n);
    });
    tab.setAttribute('tabindex', '0');
    tab.setAttribute('role', 'tab');
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(Number(tab.dataset.tab));
      }
    });
  });

  const initial = tabs.find(t => t.classList.contains('active'));
  activate(initial ? Number(initial.dataset.tab) : 1);
}


/* TAB 1: Boat Control   */
export function initializeCommToggles() {
  document.querySelectorAll('.comm-block').forEach(block => {
    const displaySignal = block.querySelector('[data-key="signal"]');
    const displayDbm = block.querySelector('[data-key="dbm"]');
    const buttons = block.querySelectorAll('.comm-toggle .comm-btn');
    const applyFromBtn = (btn) => {
      if (displaySignal) displaySignal.textContent = btn.dataset.signal ?? '--';
      if (displayDbm) displayDbm.textContent = btn.dataset.dbm ?? '--';
    };
    const active = block.querySelector('.comm-btn.active') || buttons[0];
    if (active) applyFromBtn(active);
    block.querySelector('.comm-toggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.comm-btn');
      if (!btn) return;
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFromBtn(btn);
    });
  });
}

export function initializeSoloToggles() {
  document.querySelectorAll('.solo-toggle').forEach(group => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.solo-btn');
      if (!btn || !group.contains(btn)) return;
      group.querySelectorAll('.solo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

export function initializeSolo3Toggles() {
  document.querySelectorAll('.solo3-toggle').forEach(group => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.solo3-btn');
      if (!btn || !group.contains(btn)) return;
      group.querySelectorAll('.solo3-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

export function initializePumpLogic() {
  document.querySelectorAll('.half-relay').forEach(group => {
    const autoBtn = group.querySelector('.relay-btn.auto');
    const onBtn = group.querySelector('.relay-btn.on');
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
    setMode(group.dataset.mode || 'auto');
    autoBtn.addEventListener('click', () => setMode('auto'));
    onBtn.addEventListener('click', () => setMode('on'));
    group.updateLive = (isOn) => {
      if ((group.dataset.mode || 'auto') !== 'auto') return;
      autoBtn.classList.remove('live');
      onBtn.classList.remove('live');
      (isOn ? onBtn : autoBtn).classList.add('live');
    };
    onBtn.classList.add('live');
  });
}


/* TAB 2: Payload Control   */
export function setDrawerDisplay(state) {
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


/* TAB 4: Battery Status   */
export function initializeIgnitionButton() {
  const btn = document.getElementById('ignitionBtn');
  if (!btn) return;
  const setState = (n) => btn.setAttribute('data-state', String(n));
  btn.addEventListener('click', (e) => {
    const s = Number(btn.getAttribute('data-state') || 1);
    if (s === 1 || s === 3) setState(2);
  });
  btn.querySelector('.half-off').addEventListener('click', (e) => {
    e.stopPropagation();
    setState(1);
  });
  btn.querySelector('.half-start').addEventListener('click', (e) => {
    e.stopPropagation();
    setState(3);
  });
}

export function initializeHouseRelay() {
  document.querySelectorAll('.drawer-button-relay').forEach(group => {
    const offBtn = group.querySelector('.relay-btn.off');
    const autoBtn = group.querySelector('.relay-btn.auto');
    const onBtn = group.querySelector('.relay-btn.on');
    const displayValue = group.closest('.relay-controls')?.querySelector('.display-value');
    const clearStates = () => {
      [offBtn, autoBtn, onBtn].forEach(b => {
        b.classList.remove('active');
        b.classList.remove('live');
      });
    };
    const getAutoLiveTarget = () => {
      return (group.dataset.liveDefault || 'on').toLowerCase() === 'off' ? offBtn : onBtn;
    };
    const updateDisplayForMode = (mode) => {
      if (!displayValue) return;
      if (mode === 'on') {
        displayValue.textContent = onBtn.dataset.value || '--';
      } else if (mode === 'auto') {
        const liveTarget = getAutoLiveTarget();
        displayValue.textContent = liveTarget.dataset.value || '--';
      } else {
        displayValue.textContent = '--';
      }
    };
    const setMode = (mode) => {
      clearStates();
      if (mode === 'off') {
        offBtn.classList.add('active');
        offBtn.classList.add('live');
      } else if (mode === 'on') {
        onBtn.classList.add('active');
        onBtn.classList.add('live');
      } else { // 'auto'
        autoBtn.classList.add('active');
        getAutoLiveTarget().classList.add('live');
      }
      updateDisplayForMode(mode);
      group.dataset.mode = mode;
    };
    setMode(group.dataset.mode || 'auto');
    offBtn.addEventListener('click',  () => setMode('off'));
    onBtn.addEventListener('click',   () => setMode('on'));
    autoBtn.addEventListener('click', () => setMode('auto'));
    group.updateLive = (isOn) => {
      if ((group.dataset.mode || 'auto') !== 'auto') return;
      offBtn.classList.remove('live');
      onBtn.classList.remove('live');
      (isOn ? onBtn : offBtn).classList.add('live');
      if (displayValue) displayValue.textContent = isOn ? (onBtn.dataset.value || '--') : '--';
    };
  });
}


/* TAB 4: ENGINE. ANIMATION LOAD   */
const getStartLoaderEl = () => document.getElementById('start-loader');
export function hideStartLoader() {
  const el = getStartLoaderEl();
  if (!el) return;
  el.classList.remove('show');
  el.style.pointerEvents = 'none';
}
function _showStartLoader(durationMs = TELEMETRY_CONFIG.startLoader.overlayTimeoutMs) {
  const el = getStartLoaderEl();
  if (!el) return;
  el.style.pointerEvents = 'auto';
  el.classList.add('show');
  if (el._hideTimer) clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => hideStartLoader(), durationMs);
}
function mountStartPower(opts = {}) {
  const slot = document.querySelector('#start-loader .loader-slot');
  if (!slot) return;
  const fillMs = Number(opts.fillMs ?? TELEMETRY_CONFIG.startLoader.fillMs);
  const lineMs = Number(opts.lineMs ?? TELEMETRY_CONFIG.startLoader.lineMs);
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
  root.classList.add('is-booting');
  root.style.willChange = 'transform, filter';
  root.style.animation = `startPowerJitter ${fillMs}ms ease-in-out 0s 1 both`;
  if (progress) {
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
export function showStartLoader() {
  const { fillMs, lineMs, hideBufferMs } = TELEMETRY_CONFIG.startLoader;
  mountStartPower({ fillMs, lineMs });
  _showStartLoader(fillMs + lineMs + hideBufferMs);
}
export function initializeStartLoaderButton() {
  const btn = document.getElementById('ignitionBtn');
  if (!btn) return;
  const halfOff = btn.querySelector('.half-off');
  if (halfOff) {
    halfOff.addEventListener('click', (e) => {
      hideStartLoader();
    });
  }
  const halfStart = btn.querySelector('.half-start');
  if (halfStart) {
    halfStart.addEventListener('click', (e) => {
      showStartLoader();
    });
  }
}

/* TAB 5: Mission Pleer   */
export function initializeMissionPlayer() {
  const pleer = document.querySelector('.mission-pleer');
  if(!pleer) return;
  const track = pleer.querySelector('.timeline-track');
  const points = [...pleer.querySelectorAll('.mission-waypoint')];
  const cursor = pleer.querySelector('.mission-cursor');
  const prevBtn = pleer.querySelector('.js-prev');
  const nextBtn = pleer.querySelector('.js-next');
  let idx = 0;
  const layoutPoints = () => {
      const n = points.length;
      points.forEach((p, i) => {
      const pct = (n === 1) ? 50 : (i / (n - 1)) * 100;
      p.style.left = pct + '%';
      });
  };
  const updateCursor = () => {
      const target = points[idx];
      if(!target) return;
      cursor.style.left = target.style.left || '0%';
      prevBtn && (prevBtn.disabled = (idx === 0));
      nextBtn && (nextBtn.disabled = (idx === points.length - 1));
  };
  prevBtn && prevBtn.addEventListener('click', () => { if (idx > 0) { idx--; updateCursor(); } });
  nextBtn && nextBtn.addEventListener('click', () => { if (idx < points.length - 1) { idx++; updateCursor(); } });
  window.addEventListener('resize', layoutPoints);
  layoutPoints();
  updateCursor();
}
export function initializePlayerToggle() {
  const btn = document.querySelector('.pleer-buttons .js-play-toggle');
  if (!btn) return;
  const ICONS = {
    pause: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6v12M16 6v12"/></svg>',
    play:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z"/></svg>'
  };
  btn.dataset.state = 'pause';
  btn.setAttribute('aria-pressed', 'false');
  function render() {
      const st = btn.dataset.state;
      btn.innerHTML = st === 'pause' ? ICONS.pause : ICONS.play;
      btn.title = st === 'pause' ? 'Pause' : 'Play';
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-pressed', st === 'play' ? 'true' : 'false');
  }
  btn.addEventListener('click', () => {
      btn.dataset.state = btn.dataset.state === 'pause' ? 'play' : 'pause';
      render();
  });
  render();
}

/* TAB 6: Safety   */
export function initializeSafetyButtons() {
  const bigButtons = document.querySelectorAll(".big-drawer-button");
  bigButtons.forEach((button) => {
    const label = button.querySelector(".button-drawer-label");
    const originalText = label.textContent;
    button.addEventListener("click", () => {
      button.classList.toggle("active");
      if (button.classList.contains("active")) {
        if (originalText.includes("Silent Mode")) {
          label.textContent = "Silent Mode On";
        } else {
          label.textContent = originalText.replace("Kill", "").trim() + " Killed";
        }
      } else {
        label.textContent = originalText;
      }
    });
  });
}

/* TAB 8: Sensors   */
export function initializeSensorToggles() {
  const toggles = document.querySelectorAll(".drawer-button-toggle");
  toggles.forEach(toggle => {
    const buttons = toggle.querySelectorAll(".toggle-btn");
    const display = toggle.closest('.button-display-row, .sensor-controls')?.querySelector(".drawer-button-display");
    if (!display) return;
    const valueEl = display.querySelector(".display-value");
    if (!valueEl) return;
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const value = btn.dataset.value || "--";
        valueEl.textContent = value;
      });
    });
  });
}


// ============================================================================
// NEW FUNCTIONS FOR WEBSOCKET
// ============================================================================

const indicatorStates = {};
// **** THIS IS THE FIX: Added 'export' back. ****
export const handleStatusIndicator = (
  elementId,
  newStatus,
  okClass = 'connected',
  badClass = 'disconnected',
  timeout = TELEMETRY_CONFIG.statusIndicatorHideTimeoutMs
) => {
  const indicator = document.getElementById(elementId);
  if (!indicator) return;
  const previousStatus = indicatorStates[elementId];
  if (newStatus !== previousStatus) {
    if (newStatus) {
      indicator.style.display = 'inline-block';
      indicator.classList.remove(badClass);
      indicator.classList.add(okClass);
      setTimeout(() => {
        indicator.style.display = 'none';
      }, timeout);
    } else {
      indicator.style.display = 'inline-block';
      indicator.classList.remove(okClass);
      indicator.classList.add(badClass);
    }
  }
  indicatorStates[elementId] = newStatus;
};

export function updateTelemetryValue(key, value, toFixed) {
  const el = document.getElementById(key);
  if (el) {
    if (value === undefined || value === null) {
      el.textContent = '--';
    } else if (typeof value === 'number' && toFixed !== undefined) {
      el.textContent = value.toFixed(toFixed);
    } else {
      el.textContent = value;
    }
  }
}

export function updateRpmGauge(rpm, percent) {
  const rpmDisplay = document.getElementById("rpm-gauge-value");
  if (rpmDisplay) {
    rpmDisplay.textContent = rpm;
  }
  const rpmGaugeFill = document.getElementById("rpm-gauge-fill");
  if (rpmGaugeFill) {
    rpmGaugeFill.style.width = `${percent}%`;
    if (percent >= 90) {
        rpmGaugeFill.style.backgroundColor = '#D0021B'; // Red
    } else {
        rpmGaugeFill.style.backgroundColor = '#ffffff'; // White
    }
  }
}

/**
 * **** FIX for Bug 2 ****
 * Updates ANY voltage display based on data-bank and data-stud (for Tab 4)
 * AND updates the main left-side gauge (for bank 10, stud 6).
 */
export function updateRelayVoltage(msg) {
  const { bank, stud, volts } = msg;
  if (volts === undefined) return;

  // 1. Update the generic display in Tab 4
  // Selects: <span class="display-value" data-bank="7" data-stud="6">--</span>
  const valueEl = document.querySelector(`.display-value[data-bank="${bank}"][data-stud="${stud}"]`);
  if (valueEl) {
    valueEl.textContent = volts.toFixed(1);
  }

  // 2. Update the main battery gauge on the left panel
  if (bank === 10 && stud === 6) {
    const gaugeEl = document.getElementById('battery-gauge-10-6');
    if (!gaugeEl) return;

    const { minVoltage, maxVoltage, lowVoltageThreshold } = TELEMETRY_CONFIG.batteryGauge;

    // This is the text value *inside* the gauge
    const gaugeValueEl = gaugeEl.querySelector('.js-voltage');
    if (gaugeValueEl) {
      gaugeValueEl.textContent = volts.toFixed(1);
    }

    let pct = ((volts - minVoltage) / (maxVoltage - minVoltage)) * 100;
    pct = Math.max(0, Math.min(100, pct));
    gaugeEl.style.setProperty('--pct', `${pct.toFixed(0)}%`);

    if (volts < lowVoltageThreshold) {
      gaugeEl.classList.add('is-low');
    } else {
      gaugeEl.classList.remove('is-low');
    }
  }
}

/**
 * **** NEW FUNCTION for M20 Relay Current ****
 * Updates a display in Tab 4 with current data.
 */
export function updateM20RelayCurrent(msg) {
    const { bank, switch: switchNum, current } = msg;
    if (current === undefined) return;

    // Find the display associated with this M20 switch in Tab 4
    // Note: Your HTML for Tab 4 uses `data-bank` and `data-switch` for CZone.
    // We will assume for now this message is for a DIFFERENT set of displays.
    //
    // **** LETS ASSUME this message is for the displays in TAB 8 (Communication) ****
    // e.g., <div id="btn-sat" ... data-m20-bank="1" data-m20-switch="16"> ...
    //         <div class="drawer-display">
    //           <span class="display-value">...</span>
    //
    const displayEl = document.querySelector(`[data-m20-bank="${bank}"][data-m20-switch="${switchNum}"] .display-value`);
    if (displayEl) {
        displayEl.textContent = current.toFixed(1); // Show Amps
        const unitEl = displayEl.closest('.drawer-button-display')?.querySelector('.display-unit');
        if (unitEl) unitEl.textContent = 'A';
    }
}
