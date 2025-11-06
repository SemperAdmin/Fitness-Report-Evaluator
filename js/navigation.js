// Navigation System with Back Buttons and Step Management
let navigationHistory = [];
let currentStep = 'setup';

const STEPS = {
    setup: 'setup',
    evaluation: 'evaluation', 
    comments: 'comments',
    sectionI: 'sectionI',
    summary: 'summary'
};

// Navigation Functions
function updateNavigationState(step) {
    currentStep = step;
    navigationHistory.push(step);
    
    // Update back button visibility
    const backBtn = document.getElementById('backBtn');
    if (navigationHistory.length > 1) {
        backBtn.style.display = 'block';
    } else {
        backBtn.style.display = 'none';
    }
    
    // Update navigation menu states
    updateNavigationMenu();
    
    // Update progress bar
    updateNavigationProgress();
}

function goBack() {
    if (navigationHistory.length <= 1) return;
    
    // Remove current step from history
    navigationHistory.pop();
    
    // Get previous step
    const previousStep = navigationHistory[navigationHistory.length - 1];
    
    // Navigate to previous step
    switch(previousStep) {
        case STEPS.setup:
            showSetupCard();
            break;
        case STEPS.evaluation:
            showEvaluationStep();
            break;
        case STEPS.comments:
            showDirectedCommentsScreen();
            break;
        case STEPS.sectionI:
            showSectionIGeneration();
            break;
        case STEPS.summary:
            showSummary();
            break;
    }
    
    currentStep = previousStep;
    updateNavigationState(previousStep);
}

function jumpToStep(step) {
    // Validate if step is accessible
    if (!isStepAccessible(step)) {
        showToast('Please complete previous steps first', 'warning');
        return;
    }
    
    // Navigate to step
    switch(step) {
        case STEPS.setup:
            showSetupCard();
            break;
        case STEPS.evaluation:
            showEvaluationStep();
            break;
        case STEPS.comments:
            showDirectedCommentsScreen();
            break;
        case STEPS.sectionI:
            showSectionIGeneration();
            break;
        case STEPS.summary:
            showSummary();
            break;
    }
    
    updateNavigationState(step);
    toggleMenu(); // Close menu after navigation
}

function isStepAccessible(step) {
    switch(step) {
        case STEPS.setup:
            return true;
        case STEPS.evaluation:
            return evaluationMeta.marineName; // Setup completed
        case STEPS.comments:
            return Object.keys(evaluationResults).length > 0; // Some evaluations completed
        case STEPS.sectionI:
            return currentTraitIndex >= allTraits.length; // All evaluations completed
        case STEPS.summary:
            return evaluationMeta.sectionIComments !== undefined; // Section I completed
        default:
            return false;
    }
}

function updateNavigationMenu() {
    const navItems = {
        navSetup: STEPS.setup,
        navEvaluation: STEPS.evaluation,
        navComments: STEPS.comments,
        navSectionI: STEPS.sectionI,
        navSummary: STEPS.summary
    };
    
    Object.keys(navItems).forEach(navId => {
        const navItem = document.getElementById(navId);
        const step = navItems[navId];
        
        if (isStepAccessible(step)) {
            navItem.disabled = false;
            navItem.classList.remove('disabled');
            
            if (step === currentStep) {
                navItem.classList.add('active');
            } else {
                navItem.classList.remove('active');
            }
        } else {
            navItem.disabled = true;
            navItem.classList.add('disabled');
            navItem.classList.remove('active');
        }
    });
}

function updateNavigationProgress() {
    const stepOrder = [STEPS.setup, STEPS.evaluation, STEPS.comments, STEPS.sectionI, STEPS.summary];
    const currentIndex = stepOrder.indexOf(currentStep);
    const progress = ((currentIndex + 1) / stepOrder.length) * 100;
    
    const progressFill = document.getElementById('navProgressFill');
    const progressText = document.getElementById('navProgressText');
    
    if (progressFill) {
        progressFill.style.width = progress + '%';
    }
    
    if (progressText) {
        const stepNames = {
            setup: 'Setup',
            evaluation: 'Evaluation',
            comments: 'Directed Comments',
            sectionI: 'Section I',
            summary: 'Summary'
        };
        progressText.textContent = stepNames[currentStep] || 'Unknown';
    }
}

function toggleMenu() {
    const overlay = document.getElementById('navMenuOverlay');
    overlay.classList.toggle('active');
    
    // Prevent body scroll when menu is open
    if (overlay.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

// Step Navigation Functions
function showSetupCard() {
    hideAllCards();
    const setupCard = document.getElementById('setupCard');
    if (setupCard) {
        setupCard.classList.add('active');
        setupCard.style.display = 'block';
        // Sync RS display/input visibility based on profile context or restored meta
        if (typeof updateRSSetupDisplay === 'function') {
            try { updateRSSetupDisplay(); } catch (_) {}
        }
    }
}

// Ensure RS name display on setup reflects whether we launched from the RS profile
function updateRSSetupDisplay() {
    const rsDisplay = document.getElementById('rsProfileDisplay');
    const evaluatorInput = document.getElementById('evaluatorNameInput');
    const returnBtn = document.getElementById('returnToDashboardBtn');
    let profile = window.currentProfile || null;
    let hasProfile = !!(profile && profile.rsName);

    // Fallback: hydrate profile from storage if session lost but a profile exists
    if (!hasProfile) {
        try {
            const hasProfileFlag = localStorage.getItem('has_profile') === 'true';
            if (hasProfileFlag && typeof loadProfileFromStorage === 'function') {
                const stored = loadProfileFromStorage();
                if (stored && stored.rsName) {
                    window.currentProfile = {
                        rsName: stored.rsName,
                        rsEmail: stored.rsEmail,
                        rsRank: stored.rsRank,
                        totalEvaluations: (stored.evaluations || []).length,
                        lastUpdated: stored.lastUpdated || new Date().toISOString()
                    };
                    profile = window.currentProfile;
                    hasProfile = true;
                }
            }
        } catch (_) {}
    }

    if (hasProfile) {
        if (rsDisplay) {
            const rank = profile.rsRank ? profile.rsRank + ' ' : '';
            rsDisplay.textContent = `Reporting Senior: ${rank}${profile.rsName}`;
            rsDisplay.style.display = 'block';
        }
        if (evaluatorInput) {
            evaluatorInput.value = profile.rsName || '';
            evaluatorInput.style.display = 'none';
        }
        if (returnBtn) {
            // Force visible display when launched from a profile
            returnBtn.style.display = 'block';
        }
    } else {
        if (rsDisplay) {
            rsDisplay.textContent = '';
            rsDisplay.style.display = 'none';
        }
        if (evaluatorInput) {
            // Preserve restored name if present
            const restoredName = (typeof evaluationMeta === 'object' && evaluationMeta && evaluationMeta.evaluatorName) ? evaluationMeta.evaluatorName : '';
            if (restoredName && !evaluatorInput.value) {
                evaluatorInput.value = restoredName;
            }
            evaluatorInput.style.display = '';
        }
        if (returnBtn) {
            returnBtn.style.display = 'none';
        }
    }
}

function showEvaluationStep() {
    hideAllCards();
    const container = document.getElementById('evaluationContainer');
    if (container) {
        container.style.display = 'block';
        renderCurrentTrait();
    }
}

function showDirectedCommentsStep() {
    hideAllCards();
    const card = document.getElementById('directedCommentsCard');
    if (card) {
        card.classList.add('active');
        card.style.display = 'block';
    }
}

function showSectionIStep() {
    hideAllCards();
    const card = document.getElementById('sectionIGenerationCard');
    if (card) {
        card.classList.add('active');
        card.style.display = 'block';
    }
}

function showSummaryStep() {
    hideAllCards();
    const card = document.getElementById('summaryCard');
    if (card) {
        card.classList.add('active');
        card.style.display = 'block';
    }
}

// Delegate to the single implementation in evaluation.js
function showSummary() {
    if (typeof window.evaluationShowSummary === 'function') {
        return window.evaluationShowSummary();
    }
    // Fallback if evaluation.js not ready
    showSummaryStep();
}

function hideAllCards() {
    const cards = [
        'setupCard', 'howItWorksCard', 'evaluationContainer', 
        'directedCommentsCard', 'sectionIGenerationCard', 'summaryCard'
    ];
    
    cards.forEach(cardId => {
        const card = document.getElementById(cardId);
        if (card) {
            card.classList.remove('active');
            card.style.display = 'none';
        }
    });
}

function jumpToStep(step) {
    // Validate if step is accessible
    if (!isStepAccessible(step)) {
        showToast('Please complete previous steps first', 'warning');
        return;
    }
    
    // Navigate to step
    switch(step) {
        case STEPS.setup:
            showSetupCard();
            break;
        case STEPS.evaluation:
            showEvaluationStep();
            break;
        case STEPS.comments:
            showDirectedCommentsStep();
            break;
        case STEPS.sectionI:
            showSectionIStep();
            break;
        case STEPS.summary:
            showSummaryStep();
            break;
    }
    
    updateNavigationState(step);
    toggleMenu(); // Close menu after navigation
}

// Update the original functions to use the new step functions
function showDirectedCommentsScreen() {
    showDirectedCommentsStep();
    renderDirectedCommentsGrid();
}

function showSectionIGeneration() {
    showSectionIStep();
    
    // Update progress indicator
    document.getElementById('progressText').textContent = 'Section I Comment Generation';
    
    // Initialize the analysis
    const analysis = analyzeTraitEvaluations();
    updateAnalysisDisplay(analysis);
}

function showSummary() {
    showSummaryStep();
    
    const fitrepAverage = calculateFitrepAverage();
    document.getElementById('fitrepAverage').textContent = 
        `FITREP Average: ${fitrepAverage}`;
    
    const metaDiv = document.getElementById('evaluationMeta');
    metaDiv.innerHTML = `
        <strong>Marine:</strong> ${evaluationMeta.marineName} | 
        <strong>Period:</strong> ${evaluationMeta.fromDate} to ${evaluationMeta.toDate} | 
        <strong>Reporting Senior:</strong> ${evaluationMeta.evaluatorName} | 
        <strong>Completed:</strong> ${new Date().toLocaleDateString()}
    `;
    
    const summaryGrid = document.getElementById('summaryGrid');
    summaryGrid.innerHTML = '';
    
    // Add trait evaluations
    Object.keys(evaluationResults).forEach(key => {
        const result = evaluationResults[key];
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.innerHTML = `
            <div class="summary-trait">${result.section}: ${result.trait}</div>
            <div class="summary-grade">Grade: ${result.grade} (${result.gradeNumber})</div>
            <div class="summary-justification">${result.justification}</div>
        `;
        summaryGrid.appendChild(item);
    });
    
    // Add Section I comments if present
    if (evaluationMeta.sectionIComments && evaluationMeta.sectionIComments.trim()) {
        const sectionIItem = document.createElement('div');
        sectionIItem.className = 'summary-item';
        sectionIItem.style.gridColumn = '1 / -1'; // Span full width
        sectionIItem.style.background = '#e8f5e8';
        sectionIItem.innerHTML = `
            <div class="summary-trait">Section I - Narrative Comments</div>
            <div class="summary-justification" style="max-height: none; font-size: 13px; line-height: 1.4; white-space: pre-line;">
                ${evaluationMeta.sectionIComments}
            </div>
        `;
        summaryGrid.appendChild(sectionIItem);
    }
    
    // Add directed comments if present
    if (evaluationMeta.directedComments && evaluationMeta.directedComments.trim()) {
        const directedCommentsItem = document.createElement('div');
        directedCommentsItem.className = 'summary-item';
        directedCommentsItem.style.gridColumn = '1 / -1'; // Span full width
        directedCommentsItem.style.background = '#f0f7ff';
        directedCommentsItem.innerHTML = `
            <div class="summary-trait">Section I - Directed Comments</div>
            <div class="summary-justification" style="max-height: none; font-size: 13px; line-height: 1.4; white-space: pre-line;">
                ${evaluationMeta.directedComments}
            </div>
        `;
        summaryGrid.appendChild(directedCommentsItem);
    }
}

// Edit Functions
function editPreviousEvaluations() {
    if (confirm('This will take you back to edit your trait evaluations. Continue?')) {
        // Save current progress
        saveProgressToStorage();
        
        // Reset to evaluation step
        currentTraitIndex = 0;
        currentEvaluationLevel = 'B';
        
        jumpToStep(STEPS.evaluation);
        showToast('You can now edit your evaluations. Use navigation to jump between completed traits.', 'info');
    }
}

function editSummaryEvaluation() {
    if (confirm('This will take you back to the beginning to edit this evaluation. Continue?')) {
        // Save current progress first
        saveProgressToStorage();
        
        // Reset to setup but keep the data for easy restoration
        jumpToStep(STEPS.setup);
        showToast('You can now edit your evaluation from the beginning.', 'info');
    }
}

function editEvaluation() {
    editSummaryEvaluation();
}

// Mobile-friendly touch handlers
function initializeTouchHandlers() {
    // Add touch feedback to buttons
    const buttons = document.querySelectorAll('.btn, .tool-btn, .nav-btn');
    
    buttons.forEach(button => {
        button.addEventListener('touchstart', function() {
            this.classList.add('touch-active');
        });
        
        button.addEventListener('touchend', function() {
            setTimeout(() => {
                this.classList.remove('touch-active');
            }, 150);
        });
    });
    
    // Close menu on outside touch
    document.addEventListener('touchstart', function(e) {
        const overlay = document.getElementById('navMenuOverlay');
        const menuBtn = document.getElementById('menuBtn');
        
        if (overlay.classList.contains('active') && 
            !overlay.contains(e.target) && 
            !menuBtn.contains(e.target)) {
            toggleMenu();
        }
    });
}

// Keyboard navigation
function initializeKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        // ESC to close modals/menus
        if (e.key === 'Escape') {
            const overlay = document.getElementById('navMenuOverlay');
            const justificationModal = document.getElementById('justificationModal');
            const helpModal = document.getElementById('helpModal');
            
            if (overlay.classList.contains('active')) {
                toggleMenu();
            } else if (justificationModal.classList.contains('active')) {
                cancelJustification();
            } else if (helpModal.classList.contains('active')) {
                closeHelpModal();
            }
        }
        
        // Ctrl+S to save progress
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveProgress();
            showToast('Progress saved!', 'success');
        }
        
        // Arrow keys for navigation (when appropriate)
        if (currentStep === STEPS.evaluation && !document.querySelector('.justification-modal.active')) {
            if (e.key === 'ArrowLeft' && navigationHistory.length > 1) {
                goBack();
            }
        }
    });
}

// Initialize navigation system
function initializeNavigation() {
    initializeTouchHandlers();
    initializeKeyboardNavigation();
    updateNavigationState(STEPS.setup);
}
