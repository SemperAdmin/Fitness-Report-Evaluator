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
} catch (_) { /* ignore if window is not available */ }
