// ================= SCREENSAVER MODAL LOGIC (no fetch) =================
// Assumes the HTML block #screensaverModal is already in the page.
// Exit icon (#exit-trigger) opens this modal.
// Clicking anywhere inside the dialog opens the login modal (if available).

(function () {
  // ---- Boot ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    // 1) Bind Exit icon to open the screensaver modal
    const exitIcon = document.getElementById('exit-trigger');
    if (exitIcon) {
      exitIcon.style.cursor = 'pointer';
      exitIcon.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        openScreensaverModal();
      });
    }

    // 2) Expose API
    window.openScreensaverModal  = openScreensaverModal;
    window.closeScreensaverModal = closeScreensaverModal;
  }

  // ---- API ----
  function openScreensaverModal() {
    const modal  = document.getElementById('screensaverModal');
    if (!modal) { console.error('[screensaver-modal] #screensaverModal not found'); return; }

    const dialog = modal.querySelector('.screensaver-dialog');
    if (!dialog) { console.error('[screensaver-modal] .screensaver-dialog missing'); return; }

    modal.setAttribute('aria-hidden', 'false');
    dialog.setAttribute('tabindex', '-1');
    dialog.focus({ preventScroll: true });

    // While open, clicks inside the dialog open the login modal
    dialog.addEventListener('click', openLoginFromScreensaver);
    // Global listeners
    modal.addEventListener('click', onAnyClick);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('focus', trapFocus, true);
  }

  function closeScreensaverModal() {
    const modal  = document.getElementById('screensaverModal');
    if (!modal) return;

    const dialog = modal.querySelector('.screensaver-dialog');
    modal.setAttribute('aria-hidden', 'true');

    // Detach listeners
    dialog?.removeEventListener('click', openLoginFromScreensaver);
    modal.removeEventListener('click', onAnyClick);
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('focus', trapFocus, true);
  }

  // ---- Handlers ----
  function onAnyClick(e) {
    const modal = document.getElementById('screensaverModal');
    if (!modal || modal.getAttribute('aria-hidden') === 'true') return;
    const target = e.target;

    // Close on backdrop or [x]
    if (target.hasAttribute('data-ss-close')) {
      closeScreensaverModal();
    }
  }

  function onKeydown(e) {
    const modal = document.getElementById('screensaverModal');
    if (!modal || modal.getAttribute('aria-hidden') === 'true') return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeScreensaverModal();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openLoginFromScreensaver();
    }
  }

  function trapFocus(e) {
    const modal = document.getElementById('screensaverModal');
    if (!modal || modal.getAttribute('aria-hidden') === 'true') return;
    const dialog = modal.querySelector('.screensaver-dialog');
    if (dialog && !dialog.contains(e.target)) {
      e.stopPropagation();
      dialog.focus({ preventScroll: true });
    }
  }

  function openLoginFromScreensaver() {
    // Close screensaver first
    closeScreensaverModal();

    // Then open login modal if available
    if (typeof window.openPasscodeModal === 'function') {
      window.openPasscodeModal({
        length: 6,
        title: 'Exit — Passcode',
        hint: 'Enter 6-digit code',
      });
    } else {
      console.warn('[screensaver-modal] window.openPasscodeModal is not available.');
    }
  }
})();
