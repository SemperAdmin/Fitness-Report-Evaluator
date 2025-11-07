// Utility Functions

function getGradeNumber(grade) {
    const gradeNumbers = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 0 };
    return gradeNumbers[grade];
}

function updateWordCount() {
    const textarea = document.getElementById('justificationText');
    const counter = document.getElementById('wordCount');
    
    if (!textarea || !counter) return;
    
    const words = textarea.value.trim().split(/\s+/).filter(word => word.length > 0);
    const count = words.length;
    
    counter.textContent = `${count} words`;
    counter.className = 'word-count';
    
    if (count < 20) {
        counter.classList.add('error');
    } else if (count < 30) {
        counter.classList.add('warning');
    }
}

function updateProgress() {
    const progress = (currentTraitIndex / allTraits.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    
    if (currentTraitIndex < allTraits.length) {
        const currentTrait = allTraits[currentTraitIndex];
        document.getElementById('progressText').textContent = 
            `${currentTrait.sectionTitle}: ${currentTrait.name} (${currentTraitIndex + 1} of ${allTraits.length})`;
    } else {
        document.getElementById('progressText').textContent = 'Directed Comments Selection';
    }
}

function calculateFitrepAverage() {
    // Excel-style aliases for the 13/14 attributes
    const traitAliases = {
        Perf: ['Performance'],
        Prof: ['Proficiency'],
        Courage: ['Courage'],
        Stress: ['Effectiveness Under Stress', 'Stress Tolerance'],
        Initiative: ['Initiative'],
        Leading: ['Leading Subordinates', 'Leading'],
        Develop: ['Developing Subordinates', 'Developing Others'],
        'Set Exp': ['Setting the Example'],
        'Well Being': ['Ensuring Well-being of Subordinates', 'Well-Being/Health', 'Well Being', 'Well-being'],
        'Comm Skill': ['Communication Skills'],
        PME: ['Professional Military Education (PME)', 'Professional Military Education', 'PME'],
        Decision: ['Decision Making Ability', 'Decision Making'],
        Judgement: ['Judgment', 'Judgement'],
        Evals: ['Evaluations'] // Section H
    };

    const items = Object.values(evaluationResults || {});
    const getGradeNum = (aliases) => {
        const found = items.find(t =>
            aliases.some(a => (t.trait || '').trim().toLowerCase() === a.toLowerCase())
        );
        return found ? (found.gradeNumber || 0) : 0;
    };

    const total =
        getGradeNum(traitAliases['Perf']) +
        getGradeNum(traitAliases['Prof']) +
        getGradeNum(traitAliases['Courage']) +
        getGradeNum(traitAliases['Stress']) +
        getGradeNum(traitAliases['Initiative']) +
        getGradeNum(traitAliases['Leading']) +
        getGradeNum(traitAliases['Develop']) +
        getGradeNum(traitAliases['Set Exp']) +
        getGradeNum(traitAliases['Well Being']) +
        getGradeNum(traitAliases['Comm Skill']) +
        getGradeNum(traitAliases['PME']) +
        getGradeNum(traitAliases['Decision']) +
        getGradeNum(traitAliases['Judgement']) +
        getGradeNum(traitAliases['Evals']);

    const hasSectionH =
        items.some(t =>
            (t.trait || '').trim().toLowerCase() === 'evaluations' ||
            (t.section || '').trim().toLowerCase() === 'fulfillment of evaluation responsibilities'
        );

    const denom = hasSectionH ? 14 : 13;
    const avg = denom > 0 ? (total / denom) : 0;

    return avg.toFixed(2);
}

function exportToClipboard() {
    const fitrepAverage = calculateFitrepAverage();
    let exportText = "USMC FITREP Evaluation Results\n";
    exportText += "================================\n\n";
    exportText += `Marine: ${evaluationMeta.marineName}\n`;
    exportText += `Period: ${evaluationMeta.fromDate} to ${evaluationMeta.toDate}\n`;
    exportText += `Reporting Senior: ${evaluationMeta.evaluatorName}\n`;
    exportText += `Completed: ${new Date().toLocaleDateString()}\n\n`;
    exportText += `FITREP Average: ${fitrepAverage}\n\n`;
    
    exportText += "TRAIT EVALUATIONS:\n";
    exportText += "==================\n";
    Object.keys(evaluationResults).forEach(key => {
        const result = evaluationResults[key];
        exportText += `${result.section}: ${result.trait}\n`;
        exportText += `Grade: ${result.grade} (Value: ${result.gradeNumber})\n`;
        exportText += `Justification: ${result.justification}\n\n`;
    });
    
    if (evaluationMeta.sectionIComments && evaluationMeta.sectionIComments.trim()) {
        exportText += "SECTION I - NARRATIVE COMMENTS:\n";
        exportText += "===============================\n";
        exportText += `${evaluationMeta.sectionIComments}\n\n`;
    }
    
    if (evaluationMeta.directedComments && evaluationMeta.directedComments.trim()) {
        exportText += "SECTION I - DIRECTED COMMENTS:\n";
        exportText += "==============================\n";
        exportText += `${evaluationMeta.directedComments}\n\n`;
    }
    
    navigator.clipboard.writeText(exportText).then(() => {
        alert('Results copied to clipboard!');
    });
}

function resetEvaluation() {
    if (confirm('Are you sure you want to start over? All progress will be lost.')) {
        // Reset all state variables
        currentTraitIndex = 0;
        currentEvaluationLevel = 'B';
        evaluationResults = {};
        allTraits = [];
        isReportingSenior = false;
        pendingEvaluation = null;
        evaluationMeta = {};
        selectedDirectedComments = [];
        directedCommentsData = {};
        generatedSectionI = '';
        currentGenerationStyle = 'comprehensive';
        
        location.reload();
    }
}

// --- Accessibility Helpers ---
// Lightweight utilities to support WCAG-compliant dialogs, focus, and announcements
const A11y = (function() {
    let liveRegionEl = null;
    function ensureLiveRegion() {
        if (liveRegionEl) return liveRegionEl;
        liveRegionEl = document.getElementById('srAnnouncements');
        if (!liveRegionEl) {
            liveRegionEl = document.createElement('div');
            liveRegionEl.id = 'srAnnouncements';
            liveRegionEl.setAttribute('aria-live', 'polite');
            liveRegionEl.setAttribute('role', 'status');
            liveRegionEl.style.position = 'absolute';
            liveRegionEl.style.width = '1px';
            liveRegionEl.style.height = '1px';
            liveRegionEl.style.padding = '0';
            liveRegionEl.style.margin = '-1px';
            liveRegionEl.style.overflow = 'hidden';
            liveRegionEl.style.clip = 'rect(0 0 0 0)';
            liveRegionEl.style.whiteSpace = 'nowrap';
            liveRegionEl.style.border = '0';
            document.body.appendChild(liveRegionEl);
        }
        return liveRegionEl;
    }

    function announce(message, politeness) {
        try {
            const el = ensureLiveRegion();
            if (politeness) el.setAttribute('aria-live', politeness);
            el.textContent = String(message || '');
        } catch (_) {}
    }

    function getFocusable(container) {
        const selectors = [
            'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ];
        return Array.from(container.querySelectorAll(selectors.join(',')))
            .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);
    }

    function trapFocus(modalEl) {
        function onKeyDown(e) {
            if (e.key !== 'Tab') return;
            const focusables = getFocusable(modalEl);
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (e.shiftKey) {
                if (active === first || !modalEl.contains(active)) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (active === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
        modalEl.__a11yTrap = onKeyDown;
        modalEl.addEventListener('keydown', onKeyDown);
    }

    function untrapFocus(modalEl) {
        const handler = modalEl.__a11yTrap;
        if (handler) modalEl.removeEventListener('keydown', handler);
        modalEl.__a11yTrap = null;
    }

    function openDialog(modalEl, opts = {}) {
        if (!modalEl) return;
        const { labelledBy, describedBy, focusFirst } = opts;
        // Dialog semantics
        modalEl.setAttribute('role', 'dialog');
        modalEl.setAttribute('aria-modal', 'true');
        if (labelledBy) modalEl.setAttribute('aria-labelledby', labelledBy);
        if (describedBy) modalEl.setAttribute('aria-describedby', describedBy);
        // Focus management
        modalEl.__lastFocused = document.activeElement;
        const target = focusFirst ? modalEl.querySelector(focusFirst) : getFocusable(modalEl)[0];
        try { if (target) target.focus(); } catch (_) {}
        trapFocus(modalEl);
        announce('Dialog opened');
    }

    function closeDialog(modalEl) {
        if (!modalEl) return;
        untrapFocus(modalEl);
        const last = modalEl.__lastFocused;
        modalEl.__lastFocused = null;
        try { if (last && typeof last.focus === 'function') last.focus(); } catch (_) {}
        announce('Dialog closed');
    }

    return { ensureLiveRegion, announce, openDialog, closeDialog };
})();

try { window.A11y = A11y; } catch (_) {}

function openHelpModal() {
    const modal = document.getElementById('helpModal');
    const trigger = document.getElementById('helpButton');
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    A11y.openDialog(modal, { labelledBy: 'helpModalTitle', focusFirst: '.help-close' });
}

function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    const trigger = document.getElementById('helpButton');
    if (!modal) return;
    A11y.closeDialog(modal);
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

// Global HTML escaping utilities for XSS safety
// Escapes special characters to prevent HTML injection when rendering user-provided content
function escapeHtml(str) {
    const s = String(str == null ? '' : str);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Converts newlines to <br> tags after escaping, preserving line breaks safely
function nl2br(str) {
    const s = escapeHtml(str);
    return s.replace(/\r\n|\n|\r/g, '<br>');
}

// Expose globally for use across modules loaded via script tags
try {
    window.escapeHtml = escapeHtml;
    window.nl2br = nl2br;
    // Global toast helper for user-facing messages across the app
    window.showToast = window.showToast || function(message, type) {
        try {
            let container = document.getElementById('toastContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toastContainer';
                // Minimal inline styles to avoid CSS dependency
                container.style.position = 'fixed';
                container.style.right = '16px';
                // Position at top-right (instead of bottom-right)
                container.style.top = '16px';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '8px';
                container.style.zIndex = '9999';
                document.body.appendChild(container);
            } else {
                // Ensure existing container is anchored top-right if previously bottom-right
                try {
                    container.style.top = '16px';
                    container.style.bottom = '';
                    container.style.right = '16px';
                } catch (_) { /* ignore */ }
            }

            const el = document.createElement('div');
            // Basic styling; match dark theme softly
            el.style.background = '#10141b';
            el.style.color = '#e5e7eb';
            el.style.border = '1px solid #2b3440';
            el.style.borderLeft = '4px solid ' + (type === 'success' ? '#16a34a' : (type === 'error' ? '#dc2626' : (type === 'warning' ? '#f59e0b' : '#3b82f6')));
            el.style.borderRadius = '6px';
            el.style.padding = '10px 12px';
            el.style.minWidth = '240px';
            el.style.boxShadow = '0 6px 14px rgba(0,0,0,0.3)';
            el.style.opacity = '0';
            el.style.transform = 'translateY(10px)';
            el.style.transition = 'opacity 150ms ease, transform 150ms ease';
            el.textContent = String(message || '');

            container.appendChild(el);
            // Force paint then show for transition
            requestAnimationFrame(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            });
            setTimeout(() => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(10px)';
                setTimeout(() => { try { el.remove(); } catch (_) {} }, 200);
            }, 4000);
        } catch (_) { /* ignore */ }
    };
 } catch (_) { /* ignore if window is not available */ }
