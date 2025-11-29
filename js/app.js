// Main Application Logic & Event Handlers

// Initialize application when DOM is loaded
// DOMContentLoaded initialization
document.addEventListener('DOMContentLoaded', () => {
    // Centralized UI constants with safe fallbacks
    const baseUI = (window.CONSTANTS && window.CONSTANTS.UI_SETTINGS)
        ? window.CONSTANTS.UI_SETTINGS
        : { DISPLAY: { BLOCK: 'block', NONE: 'none', FLEX: 'flex', INLINE_BLOCK: 'inline-block' }, CSS: { ACTIVE: 'active' } };
    const UI = { DISPLAY: Object.assign({}, baseUI.DISPLAY, { SHOW: baseUI.DISPLAY.BLOCK, HIDE: baseUI.DISPLAY.NONE }), CSS: baseUI.CSS };
    // Replace login-first boot with mode selection boot
    initializeVoiceRecognition();

    // Initialize persistence and enhanced auto-save
    try { if (typeof initializePersistence === 'function') initializePersistence(); } catch (_) {}

    const mode = document.getElementById('modeSelectionCard');
    const login = document.getElementById('profileLoginCard');
    const dashboard = document.getElementById('profileDashboardCard');
    const setup = document.getElementById('setupCard');

    if (mode) { mode.classList.add(UI.CSS.ACTIVE); mode.style.display = UI.DISPLAY.SHOW; }
    if (login) { login.classList.remove(UI.CSS.ACTIVE); login.style.display = UI.DISPLAY.HIDE; }
    if (dashboard) { dashboard.classList.remove(UI.CSS.ACTIVE); dashboard.style.display = UI.DISPLAY.HIDE; }
    if (setup) { setup.classList.remove(UI.CSS.ACTIVE); setup.style.display = UI.DISPLAY.HIDE; }

    setTimeout(() => {
        if (typeof showProfileDashboardOnLoad === 'function') {
            try { showProfileDashboardOnLoad(); } catch (e) { console.warn('showProfileDashboardOnLoad failed:', e); }
        }
    }, 0);

    // Set default dates
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    document.getElementById('fromDateInput').value = oneYearAgo.toISOString().split('T')[0];
    document.getElementById('toDateInput').value = today.toISOString().split('T')[0];

    // Word count tracking and modal handlers using lifecycle manager
    const addListener = (target, event, handler, options) => {
        if (typeof globalLifecycle !== 'undefined') {
            globalLifecycle.addEventListener(target, event, handler, options);
        } else {
            target.addEventListener(event, handler, options);
        }
    };

    addListener(document, 'input', function(e) {
        if (e.target.id === 'justificationText') {
            updateWordCount();
        } else if (e.target.id === 'sectionITextarea') {
            updateSectionIWordCount();
        }
    });

    // Close modal when clicking outside
    const justificationModal = document.getElementById('justificationModal');
    if (justificationModal) {
        addListener(justificationModal, 'click', function(e) {
            if (e.target === this) {
                cancelJustification();
            }
        });
    }

    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        addListener(helpModal, 'click', function(e) {
            if (e.target === this) {
                closeHelpModal();
            }
        });
    }

    // Attach dynamic tooltips for grid headers with title attributes
    try {
        const attachGridTooltips = () => {
            const headers = document.querySelectorAll('#profileGrid thead th[title]');
            headers.forEach((th) => {
                const text = th.getAttribute('title') || '';
                if (!text) return;
                th.addEventListener('mouseenter', (e) => showDynamicTooltip(e, text));
                th.addEventListener('mouseleave', () => hideDynamicTooltip());
                th.addEventListener('focus', (e) => showDynamicTooltip(e, text));
                th.addEventListener('blur', () => hideDynamicTooltip());
            });
        };
        attachGridTooltips();
    } catch (_) {}

    // Dev-only dispatch removed; production UI should not expose workflow controls here
});

// Add Single Evaluation entrypoint used by index.html button
function startStandaloneMode() {
    // Clear any RS-session flag and profile context
    try { sessionStorage.removeItem('login_source'); } catch (_) {}
    window.currentProfile = null;

    const mode = document.getElementById('modeSelectionCard');
    const login = document.getElementById('profileLoginCard');
    const dashboard = document.getElementById('profileDashboardCard');
    const UI = (window.CONSTANTS && window.CONSTANTS.UI_SETTINGS)
        ? window.CONSTANTS.UI_SETTINGS
        : { DISPLAY: { SHOW: 'block', HIDE: 'none' }, CSS: { ACTIVE: 'active' } };
    [mode, login, dashboard].forEach(el => {
        if (el) { el.classList.remove(UI.CSS.ACTIVE); el.style.display = UI.DISPLAY.HIDE; }
    });

    const setup = document.getElementById('setupCard');
    if (setup) { setup.classList.add(UI.CSS.ACTIVE); setup.style.display = UI.DISPLAY.SHOW; }

    // Ensure RS display/input reflect standalone mode (no profile)
    try { if (typeof updateRSSetupDisplay === 'function') updateRSSetupDisplay(); } catch (_) {}

    // Align navigation state if available
    try {
        if (typeof jumpToStep === 'function' && typeof STEPS !== 'undefined') {
            jumpToStep(STEPS.setup);
        }
    } catch (_) {}

    window.scrollTo({ top: 0, behavior: 'auto' });
}

// Login-first routing helper
function showRSLoginFirst() {
    // Ensure global header chrome is visible on the login card
    try { document.body.classList.remove('auth-login'); document.body.classList.remove('home-mode'); } catch (_) {}
    const login = document.getElementById('profileLoginCard');
    const loginFields = document.getElementById('loginFields');
    const createSection = document.getElementById('createAccountSection');
    const typewriter = login ? login.querySelector('.typewriter-wrapper') : null;
    const header = document.querySelector('.header');
    const warning = document.getElementById('dataWarning');
    const mode = document.getElementById('modeSelectionCard');
    const cards = [
        'profileDashboardCard', // ensure dashboard is hidden
        'setupCard','howItWorksCard','evaluationContainer',
        'reviewCard','sectionIGenerationCard','directedCommentsCard','summaryCard'
    ];

    const UI = (window.CONSTANTS && window.CONSTANTS.UI_SETTINGS)
        ? window.CONSTANTS.UI_SETTINGS
        : { DISPLAY: { SHOW: 'block', HIDE: 'none' }, CSS: { ACTIVE: 'active' } };
    if (header) header.style.display = UI.DISPLAY.SHOW;
    if (warning) warning.style.display = UI.DISPLAY.HIDE;
    if (mode) { mode.classList.remove(UI.CSS.ACTIVE); mode.style.display = UI.DISPLAY.HIDE; }

    cards.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove(UI.CSS.ACTIVE);
        el.style.display = UI.DISPLAY.HIDE;
    });

    // Centralize the swap between Mode Selection and Login card
    try { if (window.UIStates && typeof window.UIStates.toggleExclusive === 'function') { window.UIStates.toggleExclusive('profileLoginCard','modeSelectionCard'); } } catch (_) {}

    if (login) {
        login.classList.add(UI.CSS.ACTIVE);
        login.style.display = UI.DISPLAY.SHOW;

        // Ensure a clean login state: show fields, hide create-account and animation
    if (typewriter) typewriter.style.display = UI.DISPLAY.HIDE;
    if (createSection) createSection.style.display = UI.DISPLAY.HIDE;
    if (loginFields) loginFields.style.display = UI.DISPLAY.SHOW;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
}

// --- Global Tooltip Helpers ---
let __tooltipHideTimer = null;

function showTooltip(event, tooltipId) {
    try {
        const tip = document.getElementById(tooltipId);
        if (!tip) return;
        // Position near the triggering element
        const target = event.currentTarget || event.target;
        const rect = target.getBoundingClientRect();
        // Using fixed positioning; viewport-relative coords
        const top = rect.bottom + 8;
        const left = rect.left;
        tip.classList.remove('tooltip-centered');
        tip.style.top = `${top}px`;
        tip.style.left = `${left}px`;
        const UI = (window.CONSTANTS && window.CONSTANTS.UI_SETTINGS)
            ? window.CONSTANTS.UI_SETTINGS
            : { DISPLAY: { SHOW: 'block', HIDE: 'none' }, CSS: { ACTIVE: 'active' } };
        if (tip.parentNode !== document.body) {
            document.body.appendChild(tip);
        }
        tip.style.zIndex = '100000';
        tip.classList.add('active');
        tip.style.display = UI.DISPLAY.SHOW;

        if (event && event.type === 'click') {
            tip.classList.add('tooltip-centered');
        }

        // Clear previous timer and set a new auto-hide
        if (__tooltipHideTimer) clearTimeout(__tooltipHideTimer);
        __tooltipHideTimer = setTimeout(() => hideTooltip(tooltipId), 5000);

        // Hide when clicking anywhere else
        const dismiss = (e) => {
            if (!tip.contains(e.target) && e.target !== target) {
                hideTooltip(tooltipId);
                document.removeEventListener('click', dismiss);
            }
        };
        document.addEventListener('click', dismiss);
    } catch (err) {
        console.warn('showTooltip error:', err);
    }
}

function hideTooltip(tooltipId) {
    const tip = document.getElementById(tooltipId);
    const UI = (window.CONSTANTS && window.CONSTANTS.UI_SETTINGS)
        ? window.CONSTANTS.UI_SETTINGS
        : { DISPLAY: { SHOW: 'block', HIDE: 'none' }, CSS: { ACTIVE: 'active' } };
    if (tip) {
        tip.classList.remove('active');
        tip.classList.remove('tooltip-centered');
        tip.style.display = UI.DISPLAY.HIDE;
    }
    if (__tooltipHideTimer) {
        clearTimeout(__tooltipHideTimer);
        __tooltipHideTimer = null;
    }
}

// Dynamic tooltip utilities for elements with inline title text
function showDynamicTooltip(event, text) {
    try {
        let tip = document.getElementById('gridTooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'gridTooltip';
            tip.className = 'tooltip-content';
            document.body.appendChild(tip);
        }
        tip.textContent = text;
        const target = event.currentTarget || event.target;
        const rect = target.getBoundingClientRect();
        const top = rect.bottom + 8;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - 320));
        tip.style.top = `${top}px`;
        tip.style.left = `${left}px`;
        tip.style.zIndex = '100000';
        tip.classList.add('active');
        tip.style.display = 'block';
        if (__tooltipHideTimer) clearTimeout(__tooltipHideTimer);
        __tooltipHideTimer = setTimeout(() => hideDynamicTooltip(), 5000);
    } catch (_) {}
}

function hideDynamicTooltip() {
    try {
        const tip = document.getElementById('gridTooltip');
        if (tip) {
            tip.classList.remove('active');
            tip.style.display = 'none';
        }
        if (__tooltipHideTimer) {
            clearTimeout(__tooltipHideTimer);
            __tooltipHideTimer = null;
        }
    } catch (_) {}
}

// Backward-compat alias for legacy/cached markup
function showProfileLogin() {
    return showRSLoginFirst();
}
