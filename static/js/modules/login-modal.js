// ================= PASSCODE MODAL LOGIC =================
// login-modal.js (robust version)
// - Resolves fragment URL relative to this JS file
// - Falls back to embedded template if fetch fails
// - Wires #exit-trigger to open the modal

(function () {
  // --- Resolve fragment URL next to this JS file ---
  /** @returns {string} absolute url to login-modal.html */
  function resolveFragmentURL() {
    // Try to infer from current script src
    const here =
      (document.currentScript && document.currentScript.src) ||
      (function () {
        // last <script> with src (fallback)
        const s = Array.from(document.scripts).reverse().find(x => x.src);
        return s ? s.src : window.location.href;
      })();

    try {
      // Put login-modal.html in the same folder as this JS
      const url = new URL('login-modal.html', here);
      return url.toString();
    } catch (e) {
      // Last resort: assume /static/html/
      return '/static/html/login-modal.html';
    }
  }

  const FRAGMENT_URL = resolveFragmentURL();
  let modalLoaded = false;

  // Public API placeholders (queue until loaded)
  window.openPasscodeModal  = window.openPasscodeModal  || function(opts){ queue(() => openImpl(opts)); };
  window.closePasscodeModal = window.closePasscodeModal || function(){ queue(() => closeImpl()); };

  const callQueue = [];
  function queue(fn){ callQueue.push(fn); }
  function flushQueue(){
    while (callQueue.length) { try { callQueue.shift()(); } catch(e){ console.error(e); } }
  }

  // Boot
  onReady(init);
  function onReady(cb){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb, { once: true });
    } else cb();
  }

  async function init(){
    console.info('[login-modal] init; fragment:', FRAGMENT_URL);

    const exitIcon = document.getElementById('exit-trigger');
    if (exitIcon) {
      exitIcon.style.cursor = 'pointer';
      exitIcon.addEventListener('click', onExitClick, { passive: false });
    } else {
      console.warn('[login-modal] #exit-trigger not found at init');
    }

    // Preload quietly (optional)
    ensureModal().catch(err => console.warn('[login-modal] preload failed:', err));

    // Test helper for console: __pc_testOpen()
    window.__pc_testOpen = async () => { await ensureModal(); window.openPasscodeModal({ title: 'Test Passcode', hint: 'Enter 6 digits' }); };
  }

  async function onExitClick(e){
    e.preventDefault(); e.stopPropagation();
    await ensureModal();
    window.openPasscodeModal({
      length: 6,
      title: 'Exit — Passcode',
      hint: 'Enter 6-digit code'
    });
  }

  async function ensureModal(){
    if (document.getElementById('passcodeModal')) {
      if (!modalLoaded) { bindLogic(); modalLoaded = true; flushQueue(); }
      return;
    }

    // Try to fetch external fragment
    let injected = false;
    try {
      const res = await fetch(FRAGMENT_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      injectHTML(html);
      injected = true;
      console.info('[login-modal] fragment loaded');
    } catch (err) {
      console.error('[login-modal] failed to load fragment, using inline fallback:', err);
      // Inline fallback template (kept minimal but functional)
      injectHTML(INLINE_TEMPLATE);
      injected = true;
    }

    if (injected) {
      bindLogic();
      modalLoaded = true;
      flushQueue();
    }
  }

  function injectHTML(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    document.body.appendChild(tpl.content);
  }

  // ===== Behavior =====
  let code = '';
  let maxLen = 6;
  let lastFocused = null;

  function bindLogic(){
    const modal  = document.getElementById('passcodeModal');
    if (!modal) { console.error('[login-modal] #passcodeModal missing'); return; }

    const dialog = modal.querySelector('.passcode-dialog');
    const helper = modal.querySelector('#pc-helper');
    const titleEl= modal.querySelector('#pc-title');

    // Re-bind public API now that DOM exists
    window.openPasscodeModal = function(opts = {}) {
      maxLen = Number.isInteger(opts.length) ? Math.max(1, opts.length) : 6;
      if (opts.title) titleEl.textContent = String(opts.title);
      helper.textContent = opts.hint ? String(opts.hint) : '';

      // Ensure dots count matches
      const pin = modal.querySelector('.pc-pin');
      const cur = pin.querySelectorAll('.pc-dot').length;
      if (cur !== maxLen) {
        pin.innerHTML = '';
        for (let i=0;i<maxLen;i++){
          const s = document.createElement('span');
          s.className = 'pc-dot';
          s.dataset.idx = String(i);
          pin.appendChild(s);
        }
      }

      code = '';
      renderDots();

      lastFocused = document.activeElement;
      modal.setAttribute('aria-hidden', 'false');
      dialog.setAttribute('tabindex', '-1');
      dialog.focus({ preventScroll: true });

      modal.addEventListener('click', onAnyClick);
      document.addEventListener('keydown', onKeydown);
      document.addEventListener('focus', trapFocus, true);
    };

    window.closePasscodeModal = function() {
      modal.setAttribute('aria-hidden', 'true');
      modal.removeEventListener('click', onAnyClick);
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('focus', trapFocus, true);
      if (lastFocused && document.contains(lastFocused)) {
        try { lastFocused.focus({ preventScroll: true }); } catch {}
      }
      dispatch('passcode:close', {});
    };

    function renderDots(){
      const dots = modal.querySelectorAll('.pc-dot');
      dots.forEach((d, i) => d.classList.toggle('filled', i < code.length));
    }

    function trapFocus(e){
      if (modal.getAttribute('aria-hidden') === 'true') return;
      if (!dialog.contains(e.target)) { e.stopPropagation(); dialog.focus({ preventScroll: true }); }
    }

    function onAnyClick(e){
      const target = e.target;

      if (target.hasAttribute('data-pc-close')) {
        window.closePasscodeModal();
        return;
      }

      const key = target.closest('.pc-key');
      if (!key) return;

      e.preventDefault();
      const action = key.getAttribute('data-action');
      const digit  = key.getAttribute('data-key');

      if (action === 'clear') { code = ''; renderDots(); helper.textContent = ''; return; }
      if (action === 'enter') {
        if (code.length < maxLen) { helper.textContent = `Enter ${maxLen}-digit code`; return; }
        dispatch('passcode:submit', { code }); window.closePasscodeModal(); return;
      }
      if (digit != null) {
        if (code.length >= maxLen) return;
        code += String(digit);
        renderDots();
        helper.textContent = '';
      }
    }

    function onKeydown(e){
      if (modal.getAttribute('aria-hidden') === 'true') return;

      if (/^\d$/.test(e.key)) { e.preventDefault(); if (code.length < maxLen){ code += e.key; renderDots(); } return; }
      if (e.key === 'Backspace') { e.preventDefault(); if (code.length){ code = code.slice(0,-1); renderDots(); } return; }
      if (e.key === 'Enter')    { e.preventDefault();
        if (code.length < maxLen) { helper.textContent = `Enter ${maxLen}-digit code`; return; }
        dispatch('passcode:submit', { code }); window.closePasscodeModal(); return;
      }
      if (e.key === 'Escape')   { e.preventDefault(); window.closePasscodeModal(); }
    }

    function dispatch(name, detail){ window.dispatchEvent(new CustomEvent(name, { detail })); }
  }

  // Local wrappers before bind
  function openImpl(opts){ window.openPasscodeModal(opts); }
  function closeImpl(){ window.closePasscodeModal(); }

  // --- Inline fallback HTML fragment (used if fetch fails) ---
  const INLINE_TEMPLATE = `
  <div class="passcode-modal" id="passcodeModal" aria-hidden="true">
    <div class="passcode-backdrop" data-pc-close></div>
    <div class="passcode-dialog" role="dialog" aria-modal="true" aria-labelledby="pc-title">
      <header class="passcode-header">
        <div class="pc-title-row">
          <svg class="pc-lock" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 116 0v3H9z"/>
          </svg>
          <h2 id="pc-title" class="pc-title">Enter Passcode</h2>
        </div>
        <button class="pc-close" type="button" aria-label="Close" data-pc-close>&times;</button>
      </header>
      <div class="passcode-body">
        <div class="pc-pin" aria-live="polite" aria-label="Passcode input">
          <span class="pc-dot" data-idx="0"></span>
          <span class="pc-dot" data-idx="1"></span>
          <span class="pc-dot" data-idx="2"></span>
          <span class="pc-dot" data-idx="3"></span>
          <span class="pc-dot" data-idx="4"></span>
          <span class="pc-dot" data-idx="5"></span>
        </div>
        <div class="pc-keypad" role="group" aria-label="Keypad">
          <button class="pc-key" data-key="1">1</button>
          <button class="pc-key" data-key="2">2</button>
          <button class="pc-key" data-key="3">3</button>
          <button class="pc-key" data-key="4">4</button>
          <button class="pc-key" data-key="5">5</button>
          <button class="pc-key" data-key="6">6</button>
          <button class="pc-key" data-key="7">7</button>
          <button class="pc-key" data-key="8">8</button>
          <button class="pc-key" data-key="9">9</button>
          <button class="pc-key pc-secondary" data-action="clear">CLR</button>
          <button class="pc-key" data-key="0">0</button>
          <button class="pc-key pc-primary" data-action="enter">OK</button>
        </div>
        <div class="pc-helper" id="pc-helper" aria-live="polite"></div>
      </div>
    </div>
  </div>`;
})();
