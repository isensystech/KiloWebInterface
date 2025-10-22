// Import required functions from ui-buttons
import { initializeSafetyCaps, initializeButtons } from './ui-buttons.js';

console.log('DOM loaded, initializing application');

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing safety caps and buttons');
    initializeSafetyCaps();
    initializeButtons();
    
    // Initialize AP toggle modal
    initializeAPToggle();
    
    // Initialize Helm toggle modal
    initializeHelmToggle();
});

// ============================================================================
// AP (AUTOPILOT) TOGGLE MODAL
// ============================================================================
function initializeAPToggle() {
    const apToggleBtn = document.getElementById('ap-toggle');
    const apModal = document.getElementById('auto-pilot-modal');
    const apModeButtons = apModal?.querySelectorAll('.ap-mode-btn');
    
    if (!apToggleBtn || !apModal) {
        console.warn('AP toggle elements not found');
        return;
    }
    
    // Show modal on button click
    apToggleBtn.addEventListener('click', () => {
        apModal.style.display = 'block';
        apModal.classList.add('is-open');
    });
    
    // Handle mode selection
    apModeButtons?.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedMode = btn.dataset.mode;
            
            // Update button text
            apToggleBtn.textContent = selectedMode;
            
            // Send command via WebSocket
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                const message = {
                    type: "ap.set_mode",
                    mode: selectedMode
                };
                window.ws.send(JSON.stringify(message));
                console.log('Sent AP mode:', selectedMode);
            }
            
            // Update button states
            apModeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Close modal
            apModal.style.display = 'none';
            apModal.classList.remove('is-open');
        });
    });
    
    // Close modal when clicking outside
    apModal.addEventListener('click', (e) => {
        if (e.target === apModal) {
            apModal.style.display = 'none';
            apModal.classList.remove('is-open');
        }
    });
}

// ============================================================================
// HELM TOGGLE MODAL
// ============================================================================
function initializeHelmToggle() {
    const helmToggleBtn = document.getElementById('helm-toggle');
    const helmModal = document.getElementById('helm-modal');
    const helmDisplays = helmModal?.querySelectorAll('.helm-display');
    
    if (!helmToggleBtn || !helmModal) {
        console.warn('Helm toggle elements not found');
        return;
    }
    
    // Show modal on button click
    helmToggleBtn.addEventListener('click', () => {
        helmModal.style.display = 'block';
        helmModal.classList.add('is-open');
    });
    
    // Handle helm selection
    helmDisplays?.forEach(display => {
        display.addEventListener('click', () => {
            const selectedHelm = display.querySelector('.helm-display-value').textContent;
            
            // Update button text
            helmToggleBtn.textContent = selectedHelm;
            
            // Send command via WebSocket
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                const message = {
                    type: "helm.set",
                    helm: selectedHelm
                };
                window.ws.send(JSON.stringify(message));
                console.log('Sent Helm selection:', selectedHelm);
            }
            
            // Close modal
            helmModal.style.display = 'none';
            helmModal.classList.remove('is-open');
        });
    });
    
    // Close modal when clicking outside
    helmModal.addEventListener('click', (e) => {
        if (e.target === helmModal) {
            helmModal.style.display = 'none';
            helmModal.classList.remove('is-open');
        }
    });
}

// ============================================================================
// TRIM MODAL (Manual open/close - gamepad controls content)
// ============================================================================
window.openTrimModal = function() {
    const backdrop = document.getElementById("trim-modal-backdrop");
    const container = document.getElementById("trim-modal-container");
    
    if (backdrop && container) {
        backdrop.style.display = "block";
        container.style.display = "block";
    }
};

window.applyTrimSettings = function() {
    const backdrop = document.getElementById("trim-modal-backdrop");
    const container = document.getElementById("trim-modal-container");
    
    if (backdrop && container) {
        backdrop.style.display = "none";
        container.style.display = "none";
    }
};