// Main Application Logic & Event Handlers

// Initialize application when DOM is loaded
// DOMContentLoaded initialization
document.addEventListener('DOMContentLoaded', () => {
    // Replace login-first boot with mode selection boot
    initializeVoiceRecognition();

    // Initialize persistence and enhanced auto-save
    try { if (typeof initializePersistence === 'function') initializePersistence(); } catch (_) {}

    const mode = document.getElementById('modeSelectionCard');
    const login = document.getElementById('profileLoginCard');
    const dashboard = document.getElementById('profileDashboardCard');
    const setup = document.getElementById('setupCard');

    if (mode) { mode.classList.add('active'); mode.style.display = 'block'; }
    if (login) { login.classList.remove('active'); login.style.display = 'none'; }
    if (dashboard) { dashboard.classList.remove('active'); dashboard.style.display = 'none'; }
    if (setup) { setup.classList.remove('active'); setup.style.display = 'none'; }

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

    // Word count tracking and modal handlers remain
    document.addEventListener('input', function(e) {
        if (e.target.id === 'justificationText') {
            updateWordCount();
        } else if (e.target.id === 'sectionITextarea') {
            updateSectionIWordCount();
        }
    });

    // Close modal when clicking outside
    document.getElementById('justificationModal').addEventListener('click', function(e) {
        if (e.target === this) {
            cancelJustification();
        }
    });

    document.getElementById('helpModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeHelpModal();
        }
    });

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
    [mode, login, dashboard].forEach(el => {
        if (el) { el.classList.remove('active'); el.style.display = 'none'; }
    });

    const setup = document.getElementById('setupCard');
    if (setup) { setup.classList.add('active'); setup.style.display = 'block'; }

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

    if (header) header.style.display = 'none';
    if (warning) warning.style.display = 'none';
    if (mode) { mode.classList.remove('active'); mode.style.display = 'none'; }

    cards.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('active');
        el.style.display = 'none';
    });

    if (login) {
        login.classList.add('active');
        login.style.display = 'block'; // show the login card only when RS Dashboard is chosen

        // Ensure a clean login state: show fields, hide create-account and animation
        if (typewriter) typewriter.style.display = 'none';
        if (createSection) createSection.style.display = 'none';
        if (loginFields) loginFields.style.display = 'block';
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
        const top = rect.bottom + window.scrollY + 8;
        const left = rect.left + window.scrollX;
        tip.style.top = `${top}px`;
        tip.style.left = `${left}px`;
        tip.style.display = 'block';

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
    if (tip) tip.style.display = 'none';
    if (__tooltipHideTimer) {
        clearTimeout(__tooltipHideTimer);
        __tooltipHideTimer = null;
    }
}

// Backward-compat alias for legacy/cached markup
function showProfileLogin() {
    return showRSLoginFirst();
}
