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

function openHelpModal() {
    document.getElementById('helpModal').classList.add('active');
}

function closeHelpModal() {
    document.getElementById('helpModal').classList.remove('active');
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
                container.style.bottom = '16px';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '8px';
                container.style.zIndex = '9999';
                document.body.appendChild(container);
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
