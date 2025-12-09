/* MODAL GAUGES PANEL   */

// ============================================================================
// CONFIGURATION
// ============================================================================
const TELEMETRY_CONFIG = Object.freeze({
  gaugeSafetySideOffsetPx: 12, // px offset applied when safety block docks beside gauges
  startLoader: {
    fillMs: 2000, // duration of the circular fill animation (ms)
    lineMs: 1000, // duration of the line trace animation (ms)
    hideBufferMs: 150, // buffer before hiding after animations finish (ms)
    overlayTimeoutMs: 1200 // minimum time the overlay remains visible (ms)
  },
  statusIndicatorHideTimeoutMs: 5000, // ms after last healthy update before we hide an indicator
  batteryGauge: {
    minVoltage: 11.0, // lower bound of voltage range mapped to gauge (volts)
    maxVoltage: 14.5, // upper bound of voltage range mapped to gauge (volts)
    lowVoltageThreshold: 12.0 // voltage threshold that triggers warning styling (volts)
  },
  rpmGauge: Object.freeze({
    maxRpm: 6000, // used to derive percent when only RPM is provided
    redlinePercent: 90, // percent of max RPM that triggers the redline style
    redlineColor: '#D0021B', // fill color while at/above redline
    nominalColor: '#ffffff' // fill color while below redline
  }),
  engineTemperatureGauge: Object.freeze({
    maxCelsius: 150, // upper bound used to derive percent fill
    hotThresholdCelsius: 121 // values at/above this trigger red styling
  }),
  speedGauge: Object.freeze({
    maxKnots: 60 // upper bound used to derive percent fill on the speed mini-gauge
  }),
  fuelGauge: Object.freeze({
    capacityGallons: 135 // total capacity used to derive gallons from percentage
  }),
  relayGaugePrimary: Object.freeze({
    bank: 10, // source bank ID mirrored onto the hero voltage gauge
    stud: 6 // source stud ID mirrored onto the hero voltage gauge
  })
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
    window.dispatchEvent(new CustomEvent('drawer:tab-changed', { detail: { tab: n } }));
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
const joystickIndicatorStatus = {
  hasConnected: false,
  lastState: 'never'
};
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

  if (elementId === 'joystick-indicator') {
    const nextState = newStatus
      ? 'connected'
      : (joystickIndicatorStatus.hasConnected ? 'disconnected' : 'never-connected');

    if (joystickIndicatorStatus.lastState === nextState) return;

    indicator.style.display = 'inline-flex';
    indicator.classList.remove('connected', 'disconnected', 'never-connected');
    indicator.classList.add(nextState);

    const isConnected = nextState === 'connected';
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.joystickConnected = isConnected ? '1' : '0';
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('joystick:connection-changed', { detail: { connected: isConnected } })
      );
    }

    joystickIndicatorStatus.lastState = nextState;
    if (newStatus) joystickIndicatorStatus.hasConnected = true;
    return;
  }

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

const ENGINE_PARAM_FIELD_MAP = Object.freeze({
  engine_coolant_temp: 'coolant-temperature',
  engine_oil_temp: 'oil-temperature',
  engine_oil_pressure: 'oil-pressure',
  exhaust_gas_temp: 'gas-temperature',
  manifold_air_pressur: 'manifold-air-pressure',
  manifold_air_temp: 'manifold-air-temperature',
  gearbox_oil_pressure: 'gearbox-oil-pressure',
  fuel_rate_avg_time: 'fuel-rate-avg',
  fuel_rate_avg_dist: 'fuel-distance',
  propeller_speed_low: 'propeller-speed-low',
  fuel_used: 'fuel-used',
  traveled_distance: 'traveled-distance',
  max_speed: 'max-speed',
  engine_hrs: 'engine-hrs'
});

const clampPercent = (pct) => {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
};

const msToKnots = (ms) => (Number.isFinite(ms) ? ms * 1.94384 : null);

const deriveRpmPercent = (rpmValue, percentValue) => {
  if (percentValue !== undefined && percentValue !== null) {
    const pctNumber = Number(percentValue);
    if (Number.isFinite(pctNumber)) {
      return clampPercent(pctNumber);
    }
  }

  const rpmNumber = Number(rpmValue);
  const maxRpm = TELEMETRY_CONFIG.rpmGauge.maxRpm;
  if (!Number.isFinite(rpmNumber) || !Number.isFinite(maxRpm) || maxRpm <= 0) return 0;

  return clampPercent((rpmNumber / maxRpm) * 100);
};

const formatEngineParamValue = (key, value) => {
  if (value === undefined || value === null) return '--';
  if (key === 'propeller_speed_low' && (typeof value === 'boolean' || typeof value === 'number')) {
    return value ? 'LOW' : 'OK';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  }
  return String(value);
};

export function updateRpmGauge(rpm, percent) {
  const rpmNumber = Number(rpm);
  const pct = deriveRpmPercent(rpmNumber, percent);
  const pctCss = `${pct.toFixed(1)}%`;

  const rpmDisplay = document.getElementById("rpm-gauge-value");
  if (rpmDisplay) {
    rpmDisplay.textContent = Number.isFinite(rpmNumber) ? rpmNumber : '--';
  }

  Array.from(document.querySelectorAll('.rpm-gauge.gauge-block'))
    .filter((el) => !el.closest('#screensaverModal'))
    .forEach((el) => el.style.setProperty('--pct', pctCss));

  const rpmGaugeFill = document.getElementById("rpm-gauge-fill");
  if (rpmGaugeFill) {
    rpmGaugeFill.style.width = pctCss;
    const { redlinePercent, redlineColor, nominalColor } = TELEMETRY_CONFIG.rpmGauge;
    rpmGaugeFill.style.backgroundColor = pct >= redlinePercent ? redlineColor : nominalColor;
  }

  const miniGauge = document.getElementById("mini-gauge-rpm");
  if (miniGauge) {
    miniGauge.setAttribute('aria-label', `RPM level ${Number.isFinite(rpmNumber) ? rpmNumber : '--'}`);
  }
}

const avgSpeedState = {
  sumKnots: 0,
  count: 0
};

function updateAverageSpeed(knots) {
  if (!Number.isFinite(knots)) return;
  avgSpeedState.sumKnots += knots;
  avgSpeedState.count += 1;
  const avg = avgSpeedState.sumKnots / avgSpeedState.count;

  const avgValueEl = document.getElementById('avg-gauge-value');
  if (avgValueEl) {
    avgValueEl.textContent = avg.toFixed(1);
  }

  const avgUnitEl = document.getElementById('avg-gauge-unit');
  if (avgUnitEl) {
    avgUnitEl.textContent = 'kt';
  }
}

export function updateSpeedGauge(speedMs) {
  const speedNumber = Number(speedMs);
  const knots = msToKnots(speedNumber);
  const { maxKnots } = TELEMETRY_CONFIG.speedGauge;
  const pct = (Number.isFinite(knots) && Number.isFinite(maxKnots) && maxKnots > 0)
    ? clampPercent((knots / maxKnots) * 100)
    : 0;
  const pctCss = `${pct.toFixed(1)}%`;

  const speedValueEl = document.getElementById('groundspeed_ms');
  if (speedValueEl) {
    speedValueEl.textContent = Number.isFinite(knots) ? knots.toFixed(1) : '--';
  }

  const speedUnitEl = document.getElementById('speed-gauge-unit');
  if (speedUnitEl) {
    speedUnitEl.textContent = 'kt';
  }

  Array.from(document.querySelectorAll('.speed-avg-gauge.gauge-block'))
    .filter((el) => !el.closest('#screensaverModal'))
    .forEach((el) => el.style.setProperty('--pct', pctCss));

  const fillEl = document.getElementById('gauge-fill-speed');
  if (fillEl) {
    fillEl.style.width = pctCss;
  }

  const miniGauge = document.getElementById('gauge-speed');
  if (miniGauge) {
    miniGauge.setAttribute('aria-label', `Speed ${Number.isFinite(knots) ? knots.toFixed(1) : '--'} knots`);
  }

  updateAverageSpeed(knots);
}

export function updateEngineTempGauge(tempC) {
  const tempNumber = Number(tempC);
  const { maxCelsius, hotThresholdCelsius } = TELEMETRY_CONFIG.engineTemperatureGauge;
  const pct = (Number.isFinite(tempNumber) && Number.isFinite(maxCelsius) && maxCelsius > 0)
    ? clampPercent((tempNumber / maxCelsius) * 100)
    : 0;
  const pctCss = `${pct.toFixed(1)}%`;

  const gaugeBlock = document.querySelector('#engine-temp-gauge .engine-temperature-gauge');
  if (gaugeBlock) {
    gaugeBlock.style.setProperty('--pct', pctCss);
    gaugeBlock.classList.remove('hot', 'warm', 'cold', 'norm');
    if (Number.isFinite(tempNumber) && tempNumber >= hotThresholdCelsius) {
      gaugeBlock.classList.add('hot');
    } else {
      gaugeBlock.classList.add('norm');
    }
  }

  const valueEl = document.getElementById('engine-temperature-gauge-value');
  if (valueEl) {
    valueEl.textContent = Number.isFinite(tempNumber) ? tempNumber.toFixed(1) : '--';
  }

  const miniGauge = document.getElementById('engine-temperature-mini-gauge');
  if (miniGauge) {
    miniGauge.setAttribute('aria-label', `Engine temperature ${Number.isFinite(tempNumber) ? tempNumber.toFixed(1) : '--'} °C`);
  }
}

export function updateEngineParameters(state = {}) {
  Object.entries(ENGINE_PARAM_FIELD_MAP).forEach(([key, elementId]) => {
    const valueEl = document.querySelector(`#${elementId} .status-display-value`);
    if (!valueEl) return;
    valueEl.textContent = formatEngineParamValue(key, state[key]);
  });

  updateEngineTempGauge(state.engine_oil_temp);

  const fuelBurnValueEl = document.getElementById('fuel-burn-gauge-value');
  if (fuelBurnValueEl) {
    const burn = Number(state.fuel_rate_avg_time);
    fuelBurnValueEl.textContent = Number.isFinite(burn) ? burn.toFixed(1) : '--';
  }

  const fuelBurnUnitEl = document.getElementById('fuel-burn-gauge-unit');
  if (fuelBurnUnitEl) {
    fuelBurnUnitEl.textContent = 'G/Hr';
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
  if (bank === TELEMETRY_CONFIG.relayGaugePrimary.bank && stud === TELEMETRY_CONFIG.relayGaugePrimary.stud) {
    const gaugeCandidates = Array.from(document.querySelectorAll('#battery-gauge-10-6'));
    const gaugeEl = gaugeCandidates.find(el => !el.closest('#screensaverModal'));
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
 * Updates the left fuel gauge using websocket percentage data.
 */
export function updateFuelGauge(percentage) {
  const pct = Number(percentage);
  if (!Number.isFinite(pct)) return;

  const clampedPct = Math.max(0, Math.min(100, pct));
  const pctCss = `${clampedPct.toFixed(2)}%`;
  const pctDisplay = clampedPct.toFixed(2);
  const gallons = (clampedPct / 100) * TELEMETRY_CONFIG.fuelGauge.capacityGallons;
  const gallonsDisplay = gallons.toFixed(2);
  const fillColor = clampedPct < 10 ? 'var(--gauge-red)' : 'var(--color-white)';
  const isVisibleGauge = (el) => !el.closest('#screensaverModal');

  Array.from(document.querySelectorAll('.fuel-gauge.gauge-block'))
    .filter(isVisibleGauge)
    .forEach((block) => block.style.setProperty('--pct', pctCss));

  Array.from(document.querySelectorAll('#fuel-mini-gauge-fill'))
    .filter(isVisibleGauge)
    .forEach((fill) => {
      fill.style.width = pctCss;
      fill.style.backgroundColor = fillColor;
    });

  Array.from(document.querySelectorAll('#fuel-gauge-value'))
    .filter(isVisibleGauge)
    .forEach((el) => { el.textContent = gallonsDisplay; });

  Array.from(document.querySelectorAll('#fuel-gauge-unit'))
    .filter(isVisibleGauge)
    .forEach((el) => { el.textContent = 'gal'; });

  Array.from(document.querySelectorAll('#fuel-mini-gauge'))
    .filter(isVisibleGauge)
    .forEach((el) => el.setAttribute('aria-label', `Fuel level ${pctDisplay}%`));
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
