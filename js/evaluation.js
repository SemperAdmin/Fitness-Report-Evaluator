// Core Evaluation Logic
let currentTraitIndex = 0;
let currentEvaluationLevel = 'B';
let evaluationResults = {};
let allTraits = [];
let isReportingSenior = false;
let pendingEvaluation = null;
let evaluationMeta = {};
let isInReviewMode = false;
let traitBeingReevaluated = null;
let reevaluationReturnTo = null;

// Safely split a composite trait key like "E_effectiveness_under_stress"
function splitTraitKey(compositeKey) {
    const idx = String(compositeKey).indexOf('_');
    if (idx === -1) return [String(compositeKey), ''];
    const sectionKey = compositeKey.slice(0, idx);
    const traitKeyPart = compositeKey.slice(idx + 1);
    return [sectionKey, traitKeyPart];
}

// Helper Functions (defined first)
function getSectionProgress(sectionKey) {
    const sectionTraits = allTraits.filter(trait => trait.sectionKey === sectionKey);
    const completedInSection = sectionTraits.filter((trait, index) => {
        const traitIndex = allTraits.findIndex(t => t.sectionKey === trait.sectionKey && t.traitKey === trait.traitKey);
        return traitIndex < currentTraitIndex;
    }).length;
    
    const currentInSection = sectionTraits.findIndex(trait => {
        const traitIndex = allTraits.findIndex(t => t.sectionKey === trait.sectionKey && t.traitKey === trait.traitKey);
        return traitIndex === currentTraitIndex;
    }) + 1;
    
    return {
        current: currentInSection,
        total: sectionTraits.length,
        completed: completedInSection
    };
}

function getSectionInfo(sectionKey) {
    const sectionDetails = {
        'D': {
            description: "Mission Accomplishment evaluates how effectively the Marine performs their primary duties and responsibilities.",
            importance: "This section focuses on technical competence and job performance - the foundation of military effectiveness."
        },
        'E': {
            description: "Individual Character assesses the Marine's personal integrity, moral courage, and resilience under pressure.",
            importance: "Character traits are fundamental to military service and leadership at every level."
        },
        'F': {
            description: "Leadership evaluates the Marine's ability to lead, develop, and care for subordinates while setting the example.",
            importance: "Leadership capabilities are essential for career progression and unit effectiveness."
        },
        'G': {
            description: "Intellect and Wisdom measures the Marine's decision-making ability, judgment, and commitment to professional development.",
            importance: "Intellectual growth and sound judgment are critical for increased responsibility and complex missions."
        },
        'H': {
            description: "Evaluation Responsibilities assesses how well this Marine conducts performance evaluations of their subordinates.",
            importance: "Fair and accurate evaluation of others is a key leadership responsibility for senior Marines."
        }
    };
    
    return sectionDetails[sectionKey] || { description: "", importance: "" };
}

function getGradeMeaning(grade) {
    const meanings = {
        'A': "Significantly below standards",
        'B': "Meets requirements and expectations", 
        'C': "Below average but acceptable",
        'D': "Consistently produces quality results",
        'E': "Above average performance",
        'F': "Results far surpass expectations",
        'G': "Exceptional, setting new standards"
    };
    
    return meanings[grade] || "";
}

function getRemainingsSections() {
    const remainingTraits = allTraits.slice(currentTraitIndex + 1);
    const sectionsLeft = [...new Set(remainingTraits.map(t => t.sectionTitle))];
    
    if (sectionsLeft.length === 0) {
        return "Final trait in evaluation";
    } else if (sectionsLeft.length === 1) {
        return `Next: ${sectionsLeft[0]}`;
    } else {
        return `Remaining: ${sectionsLeft.slice(0, 2).join(', ')}${sectionsLeft.length > 2 ? ` +${sectionsLeft.length - 2} more` : ''}`;
    }
}

function updateProgress() {
    const progress = (currentTraitIndex / allTraits.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    
    if (currentTraitIndex < allTraits.length && !isInReviewMode) {
        const currentTrait = allTraits[currentTraitIndex];
        const sectionProgress = getSectionProgress(currentTrait.sectionKey);
        document.getElementById('progressText').textContent = 
            `${currentTrait.sectionTitle}: ${currentTrait.name} (${sectionProgress.current} of ${sectionProgress.total} in section)`;
    } else if (isInReviewMode) {
        document.getElementById('progressText').textContent = 'Review and Edit Evaluations';
    } else {
        document.getElementById('progressText').textContent = 'Directed Comments Selection';
    }
}

// Main Functions
// startEvaluation()
function startEvaluation() {
    const marineName = document.getElementById('marineNameInput').value.trim();
    const fromDate = document.getElementById('fromDateInput').value;
    const toDate = document.getElementById('toDateInput').value;
    const selection = document.getElementById('reportingSeniorSelect').value;
    const evaluatorName = document.getElementById('evaluatorNameInput').value.trim();
    const marineRank = document.getElementById('marineRankSelect') ? document.getElementById('marineRankSelect').value : '';
    // New: capture occasion type selected in setup
    const occasionType = document.getElementById('evaluationOccasionSetup') 
        ? document.getElementById('evaluationOccasionSetup').value 
        : '';

    if (!marineName || !fromDate || !toDate || !selection || !evaluatorName) {
        alert('Please complete all required fields before beginning the evaluation.');
        return;
    }

    evaluationMeta = {
        marineName,
        marineRank, // capture selected rank
        fromDate,
        toDate,
        evaluatorName,
        // New: store occasion in evaluationMeta
        occasionType,
        // Track whether this eval was started from RS profile
        startedFromProfile: !!window.currentProfile
    };
    
    isReportingSenior = (selection === 'yes');
    initializeTraits();
    
    document.getElementById('setupCard').style.display = 'none';
    document.getElementById('howItWorksCard').style.display = 'none';
    document.getElementById('dataWarning').style.display = 'none';
    
    // Ensure the evaluation UI becomes visible
    try {
        if (typeof jumpToStep === 'function' && typeof STEPS !== 'undefined') {
            jumpToStep(STEPS.evaluation);
        } else {
            const container = document.getElementById('evaluationContainer');
            if (container) {
                container.style.display = 'block';
            }
            renderCurrentTrait();
        }
    } catch {
        const container = document.getElementById('evaluationContainer');
        if (container) container.style.display = 'block';
        renderCurrentTrait();
    }
    
    updateProgress();
    renderCurrentTrait();
}

function initializeTraits() {
    allTraits = [];
    
    // Debug logging
    console.log('firepData:', firepData);
    console.log('firepData.sections:', firepData.sections);
    
    ['D', 'E', 'F', 'G'].forEach(sectionKey => {
        const section = firepData.sections[sectionKey];
        console.log(`Section ${sectionKey}:`, section);
        
        if (section && section.traits) {
            Object.keys(section.traits).forEach(traitKey => {
                const trait = {
                    sectionKey,
                    traitKey,
                    sectionTitle: section.title,
                    ...section.traits[traitKey]
                };
                console.log(`Adding trait ${sectionKey}-${traitKey}:`, trait);
                allTraits.push(trait);
            });
        }
    });
    
    if (isReportingSenior) {
        const sectionH = firepData.sections.H;
        if (sectionH && sectionH.traits) {
            Object.keys(sectionH.traits).forEach(traitKey => {
                const trait = {
                    sectionKey: 'H',
                    traitKey,
                    sectionTitle: sectionH.title,
                    ...sectionH.traits[traitKey]
                };
                console.log(`Adding H trait ${traitKey}:`, trait);
                allTraits.push(trait);
            });
        }
    }
    
    console.log('All traits initialized:', allTraits);
    console.log('Total traits:', allTraits.length);
}

function renderCurrentTrait() {
    const container = document.getElementById('evaluationContainer');
    
    if (currentTraitIndex >= allTraits.length && !traitBeingReevaluated) {
        container.innerHTML = '';
        showReviewScreen();
        return;
    }

    const trait = traitBeingReevaluated || allTraits[currentTraitIndex];
    
    // Debug logging
    console.log('Current trait:', trait);
    console.log('Current evaluation level:', currentEvaluationLevel);
    console.log('Grade descriptions:', trait.gradeDescriptions);
    
    // Use trait-specific grade description, fallback to generic if not available
    let gradeDescription = '';
    if (trait.gradeDescriptions && trait.gradeDescriptions[currentEvaluationLevel]) {
        gradeDescription = trait.gradeDescriptions[currentEvaluationLevel];
    } else {
        // Fallback to generic descriptions
        gradeDescription = firepData.gradeDescriptions[currentEvaluationLevel]?.description || 'Grade description not available';
    }
    
    const isAtA = currentEvaluationLevel === 'A';
    const sectionProgress = getSectionProgress(trait.sectionKey);
    const sectionInfo = getSectionInfo(trait.sectionKey);

    const safeSectionTitle = escapeHtml(trait.sectionTitle);
    const safeSectionDesc = escapeHtml(sectionInfo.description);
    const safeSectionImportance = escapeHtml(sectionInfo.importance);
    const safeTraitName = escapeHtml(trait.name);
    const safeTraitDescription = escapeHtml(trait.description);
    const safeGradeDescription = escapeHtml(gradeDescription);

    container.innerHTML = `
        <div class="evaluation-card active">
            <div class="section-context">
                <div class="section-header">
                    <div class="section-title">${safeSectionTitle}</div>
                    <div class="section-progress">
                        <span class="section-progress-text">Trait ${sectionProgress.current} of ${sectionProgress.total}</span>
                        <div class="section-progress-bar">
                            <div class="section-progress-fill" style="width: ${(sectionProgress.completed / sectionProgress.total) * 100}%"></div>
                        </div>
                    </div>
                </div>
                <div class="section-description">${safeSectionDesc}</div>
                <div class="section-importance">${safeSectionImportance}</div>
            </div>
            
            <div class="trait-context">
                <div class="trait-header">
                    <div class="trait-subtitle">${safeTraitName}</div>
                    <div class="trait-description">${safeTraitDescription}</div>
                </div>
            </div>
            
            <div class="grade-display ${getGradeClass(currentEvaluationLevel)}">
                <div class="grade-description">${safeGradeDescription}</div>
            </div>
            
            <div class="evaluation-guidance">
                <div class="guidance-question">Does this Marine's performance in <strong>${safeTraitName}</strong> meet this standard?</div>
            </div>
            
            <div class="action-buttons">
                <button class="btn btn-does-not-meet" onclick="handleGradeAction('does-not-meet')" 
                        ${isAtA ? 'disabled' : ''}>
                    <span class="button-label">Does Not Meet</span>
                    <span class="button-description">Select lower standard</span>
                </button>
                <button class="btn btn-meets" onclick="handleGradeAction('meets')">
                    <span class="button-label">Meets</span>
                    <span class="button-description">Assign this grade</span>
                </button>
                <button class="btn btn-surpasses" onclick="handleGradeAction('surpasses')">
                    <span class="button-label">Surpasses</span>
                    <span class="button-description">Try higher standard</span>
                </button>
            </div>
            
            <div class="navigation-helper">
                <div class="overall-progress">
                    <span>Overall Progress: ${currentTraitIndex + 1} of ${allTraits.length} traits</span>
                    <div class="remaining-sections">${getRemainingsSections()}</div>
                </div>
            </div>
        </div>
    `;
}

function getGradeClass(grade) {
    const gradeClasses = {
        'A': 'adverse',
        'B': 'below-standards',
        'C': 'below-standards',
        'D': 'acceptable',
        'E': 'acceptable',
        'F': 'excellent',
        'G': 'excellent'
    };
    return gradeClasses[grade] || 'acceptable';
}

function handleGradeAction(action) {
    const trait = traitBeingReevaluated || allTraits[currentTraitIndex];
    let selectedGrade = currentEvaluationLevel;
    
    switch(action) {
        case 'does-not-meet':
            if (currentEvaluationLevel === 'B') selectedGrade = 'A';
            else if (currentEvaluationLevel === 'D') selectedGrade = 'C';
            else if (currentEvaluationLevel === 'F') selectedGrade = 'E';
            finalizeTrait(selectedGrade);
            break;
            
        case 'meets':
            finalizeTrait(currentEvaluationLevel);
            break;
            
        case 'surpasses':
            if (currentEvaluationLevel === 'B') {
                currentEvaluationLevel = 'D';
                renderCurrentTrait();
            } else if (currentEvaluationLevel === 'D') {
                currentEvaluationLevel = 'F';
                renderCurrentTrait();
            } else if (currentEvaluationLevel === 'F') {
                finalizeTrait('G');
            }
            break;
    }
}

function finalizeTrait(grade) {
    const trait = traitBeingReevaluated || allTraits[currentTraitIndex];
    
    pendingEvaluation = {
        trait: trait,
        grade: grade,
        gradeNumber: getGradeNumber(grade)
    };
    
    showJustificationModal();
}

function showJustificationModal() {
    const modal = document.getElementById('justificationModal');
    const trait = pendingEvaluation.trait;
    
    document.getElementById('justificationTitle').textContent = 
        `${trait.sectionTitle}: ${trait.name}`;
    
    // Pre-fill with existing justification if re-evaluating
    const existingKey = `${trait.sectionKey}_${trait.traitKey}`;
    const existingJustification = evaluationResults[existingKey]?.justification || '';
    document.getElementById('justificationText').value = existingJustification;
    
    // Reset tools
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        voiceBtn.classList.remove('active');
        voiceBtn.textContent = '🎤 Voice Input';
    }
    
    updateWordCount();
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    try {
        if (window.A11y) A11y.openDialog(modal, { labelledBy: 'justificationTitle', describedBy: 'justificationDesc', focusFirst: '#justificationText' });
    } catch (_) {}
    document.getElementById('justificationText').focus();
}

function saveJustification() {
    const justificationText = document.getElementById('justificationText').value.trim();
    
    if (!justificationText) {
        alert('Please provide justification for this marking before continuing.');
        return;
    }

    const trait = pendingEvaluation.trait;
    
    evaluationResults[`${trait.sectionKey}_${trait.traitKey}`] = {
        section: trait.sectionTitle,
        trait: trait.name,
        grade: pendingEvaluation.grade,
        gradeNumber: pendingEvaluation.gradeNumber,
        justification: justificationText
    };
    
    // Stop voice recording if active
    if (voiceRecognition) {
        voiceRecognition.stop();
    }
    
    // Reset voice button
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        voiceBtn.classList.remove('active');
        voiceBtn.textContent = '🎤 Voice Input';
    }
    
    const modal = document.getElementById('justificationModal');
    if (window.A11y) try { A11y.closeDialog(modal); } catch (_) {}
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    pendingEvaluation = null;
    
    // Handle post-save navigation
    if (traitBeingReevaluated) {
        const returnTo = reevaluationReturnTo || 'review';
        // Clear re-evaluation state
        traitBeingReevaluated = null;
        reevaluationReturnTo = null;
        currentEvaluationLevel = 'B';
        document.getElementById('evaluationContainer').innerHTML = '';

        // Route back to desired page
        if (returnTo === 'directedComments') {
            try {
                if (typeof jumpToStep === 'function' && typeof STEPS !== 'undefined') {
                    jumpToStep(STEPS.comments);
                } else {
                    showDirectedCommentsScreen();
                }
            } catch (_) {
                showDirectedCommentsScreen();
            }
        } else {
            showReviewScreen();
        }
    } else {
        // Continue with normal flow
        currentTraitIndex++;
        currentEvaluationLevel = 'B';
        updateProgress();
        renderCurrentTrait();
    }
}

function cancelJustification() {
    // Stop voice recording if active
    if (voiceRecognition) {
        voiceRecognition.stop();
    }
    
    // Reset voice button
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        voiceBtn.classList.remove('active');
        voiceBtn.textContent = '🎤 Voice Input';
    }
    
    const modal = document.getElementById('justificationModal');
    if (window.A11y) try { A11y.closeDialog(modal); } catch (_) {}
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    pendingEvaluation = null;
}

// showReviewScreen()
function showReviewScreen() {
    isInReviewMode = true;
    updateProgress();
    
    // Hide all other cards (remove active and inline display)
    document.querySelectorAll('.evaluation-card, .directed-comments-card, .section-i-generation-card, .summary-card').forEach(card => {
        card.classList.remove('active');
        card.style.display = 'none';
    });
    
    // Show review card
    const reviewCard = document.getElementById('reviewCard');
    reviewCard.classList.add('active');
    reviewCard.style.display = 'block';
    
    // Populate review content
    populateReviewScreen();
}

// populateReviewScreen()
function populateReviewScreen() {
    const reviewGrid = document.getElementById('reviewGrid');
    if (!reviewGrid) {
        console.warn('Review grid not found in DOM.');
        return;
    }

    // Group results by section
    const sectionGroups = {};
    Object.keys(evaluationResults).forEach(key => {
        const result = evaluationResults[key] || {};
        const sectionTitle = result.section || 'Unknown Section';
        if (!sectionGroups[sectionTitle]) sectionGroups[sectionTitle] = [];
        sectionGroups[sectionTitle].push({ key, ...result });
    });

    // Render
    reviewGrid.innerHTML = '';

    const sections = Object.keys(sectionGroups);
    if (sections.length === 0) {
        reviewGrid.innerHTML = `
            <div class="empty-state">
                <p>No completed trait evaluations yet.</p>
                <p>Finish evaluating traits to see an overview here.</p>
            </div>
        `;
        return;
    }

    sections.forEach(sectionTitle => {
        const traits = sectionGroups[sectionTitle];
        const traitsHTML = traits.map(trait => {
            const gradeDescription = getGradeDescription(trait.grade);
            const fullText = String(trait.justification || '').trim();

            const safeTraitName = escapeHtml(trait.trait);
            const safeGradeDesc = escapeHtml(gradeDescription);
            const safeJustification = fullText ? nl2br(fullText) : '<em>No justification provided</em>';

            return `
                <div class="review-trait-item" id="review-item-${trait.key}">
                    <div class="review-trait-header">
                        <div class="review-trait-name">${safeTraitName}</div>
                        <!-- Grade removed -->
                    </div>
                    <div class="review-trait-criteria">
                        <div class="criteria-meets">
                            <strong>Selected Standard:</strong> ${safeGradeDesc}
                        </div>
                    </div>
                    <div class="review-trait-justification" style="white-space: pre-line;">
                        ${safeJustification}
                    </div>
                    <div class="button-row" style="margin-top: 10px;">
                        <button class="btn btn-secondary" onclick="editJustification('${trait.key}')">Edit Justification</button>
                        <button class="btn btn-meets" onclick="editTrait('${trait.key}')">Re-evaluate Trait</button>
                    </div>
                </div>
            `;
        }).join('');

        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'review-section';
        const safeSectionTitle = escapeHtml(sectionTitle);
        sectionDiv.innerHTML = `
            <div class="review-section-title">${safeSectionTitle}</div>
            <div class="review-traits">${traitsHTML}</div>
        `;
        reviewGrid.appendChild(sectionDiv);
    });
}

function getGradeDescription(grade) {
    const descriptions = {
        'A': "Significantly below standards",
        'B': "Meets requirements and expectations", 
        'C': "Below average but acceptable",
        'D': "Consistently produces quality results",
        'E': "Above average performance",
        'F': "Results far surpass expectations",
        'G': "Exceptional, setting new standards"
    };
    return descriptions[grade] || "Grade description not available";
}

function editTrait(traitKey) {
    // Find the trait in allTraits
    const [sectionKey, traitKeyPart] = splitTraitKey(traitKey);
    const trait = allTraits.find(t => t.sectionKey === sectionKey && t.traitKey === traitKeyPart);
    
    if (!trait) {
        console.error('Trait not found:', traitKey);
        return;
    }
    
    // Show re-evaluation modal first
    showReevaluationModal(trait, traitKey);
}

function editJustification(traitKey) {
    // Parse keys and locate trait
    const [sectionKey, traitKeyPart] = splitTraitKey(String(traitKey));
    const trait = allTraits.find(t => t.sectionKey === sectionKey && t.traitKey === traitKeyPart);
    if (!trait) {
        console.error('Trait not found for editJustification:', traitKey);
        return;
    }
    const existing = evaluationResults[traitKey] || {};
    // Seed pendingEvaluation with current grade to reuse the justification modal
    pendingEvaluation = {
        trait,
        grade: existing.grade || 'B',
        gradeNumber: existing.gradeNumber || 0
    };
    // Ensure we return to review after saving
    traitBeingReevaluated = trait;
    showJustificationModal();
}

function showReevaluationModal(trait, traitKey) {
    const modal = document.getElementById('reevaluateModal');
    const currentResult = evaluationResults[traitKey];
    
    // Set modal content
    document.getElementById('reevaluateTitle').textContent = `${trait.sectionTitle}: ${trait.name}`;
    
    // Display current evaluation without showing the grade
    const currentEvalDisplay = document.getElementById('currentEvalDisplay');
    currentEvalDisplay.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; gap: 20px; margin: 15px 0;">
            <div class="grade-display ${getGradeClass(currentResult.grade)}" style="padding: 15px; margin: 0;">
                <strong>Current Evaluation</strong>
            </div>
        </div>
    `;
    
    // Display current criteria
    const currentEvalCriteria = document.getElementById('currentEvalCriteria');
    const gradeDescription = getGradeDescription(currentResult.grade);
    currentEvalCriteria.innerHTML = `
        <div class="criteria-meets">
            <strong>Selected Standard:</strong> ${gradeDescription}
        </div>
    `;
    
    // Display current justification
    const currentEvalJustification = document.getElementById('currentEvalJustification');
    currentEvalJustification.textContent = currentResult.justification;
    
    // Store trait info for re-evaluation
    modal.dataset.traitKey = traitKey;
    modal.dataset.sectionKey = trait.sectionKey;
    modal.dataset.traitKeyPart = trait.traitKey;
    
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    try {
        if (window.A11y) A11y.openDialog(modal, { labelledBy: 'reevaluateTitle', describedBy: 'reevaluateDesc', focusFirst: '.reevaluate-buttons .btn-meets' });
    } catch (_) {}
}

function cancelReevaluation() {
    const modal = document.getElementById('reevaluateModal');
    if (window.A11y) try { A11y.closeDialog(modal); } catch (_) {}
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function startReevaluation() {
    const modal = document.getElementById('reevaluateModal');
    const traitKey = modal.dataset.traitKey;
    const sectionKey = modal.dataset.sectionKey;
    const traitKeyPart = modal.dataset.traitKeyPart;
    
    // Find the trait
    const trait = allTraits.find(t => t.sectionKey === sectionKey && t.traitKey === traitKeyPart);
    
    if (!trait) {
        console.error('Trait not found for re-evaluation');
        return;
    }
    
    // Set up for re-evaluation: jump back to the trait's evaluation screen
    traitBeingReevaluated = trait;
    reevaluationReturnTo = 'review';

    // Prefer to start at the previously selected grade, fall back to 'B'
    const existing = evaluationResults[traitKey];
    currentEvaluationLevel = (existing && existing.grade) ? existing.grade : 'B';

    // Ensure we render the correct trait index
    const index = allTraits.findIndex(t => t.sectionKey === sectionKey && t.traitKey === traitKeyPart);
    if (index !== -1) currentTraitIndex = index;

    // Hide modal and review card, then show evaluation
    if (window.A11y) try { A11y.closeDialog(modal); } catch (_) {}
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    isInReviewMode = false;
    const reviewCard = document.getElementById('reviewCard');
    if (reviewCard) {
        reviewCard.classList.remove('active');
        reviewCard.style.display = 'none';
    }

    try {
        if (typeof jumpToStep === 'function' && typeof STEPS !== 'undefined') {
            jumpToStep(STEPS.evaluation);
        } else {
            const container = document.getElementById('evaluationContainer');
            if (container) container.style.display = 'block';
            renderCurrentTrait();
        }
    } catch (_) {
        const container = document.getElementById('evaluationContainer');
        if (container) container.style.display = 'block';
        renderCurrentTrait();
    }
}

// goBackToLastTrait()
function goBackToLastTrait() {
    if (currentTraitIndex > 0) {
        currentTraitIndex--;
        isInReviewMode = false;
        currentEvaluationLevel = 'B';
        document.getElementById('reviewCard').classList.remove('active');
        updateProgress();
        renderCurrentTrait();
    }
}

// proceedToDirectedComments()
function proceedToDirectedComments() {
    isInReviewMode = false;
    const reviewCard = document.getElementById('reviewCard');
    reviewCard.classList.remove('active');
    reviewCard.style.display = 'none';
    showDirectedCommentsScreen();
}

function showSummary() {
    // Hide all other cards
    document.querySelectorAll('.evaluation-card, .directed-comments-card, .section-i-generation-card, .review-card').forEach(card => {
        card.classList.remove('active');
        card.style.display = 'none';
    });

    // Ensure RS Dashboard is hidden while viewing Summary
    const dashboardCard = document.getElementById('profileDashboardCard');
    if (dashboardCard) {
        dashboardCard.classList.remove('active');
        dashboardCard.style.display = 'none';
    }

    // Extra guard: hide any rank/filter UI that might remain visible
    const rankBar = document.getElementById('rankFilterBar');
    if (rankBar) rankBar.style.display = 'none';
    const evalFilters = document.querySelector('.evaluation-filters');
    if (evalFilters) evalFilters.style.display = 'none';

    // Restore app chrome
    const header = document.querySelector('.header');
    const warning = document.getElementById('dataWarning');
    if (header) header.style.display = '';
    if (warning) warning.style.display = '';

    // Show summary card
    const summaryCard = document.getElementById('summaryCard');
    summaryCard.classList.add('active');
    summaryCard.style.display = 'block';

    const fitrepAverage = calculateFitrepAverage();
    document.getElementById('fitrepAverage').textContent = 
        `FITREP Average: ${fitrepAverage}`;

    const metaDiv = document.getElementById('evaluationMeta');
    const safeMarine = escapeHtml(evaluationMeta.marineName || '');
    const safeFrom = escapeHtml(evaluationMeta.fromDate || '');
    const safeTo = escapeHtml(evaluationMeta.toDate || '');
    const safeEvaluator = escapeHtml(evaluationMeta.evaluatorName || '');
    metaDiv.innerHTML = `
        <strong>Marine:</strong> ${safeMarine} | 
        <strong>Period:</strong> ${safeFrom} to ${safeTo} | 
        <strong>Reporting Senior:</strong> ${safeEvaluator} | 
        <strong>Completed:</strong> ${new Date().toLocaleDateString()}
    `;

    const summaryGrid = document.getElementById('summaryGrid');
    summaryGrid.innerHTML = '';

    // Toggle summary action buttons based on origin
    try {
        const rsBtn = document.getElementById('viewRsDashboardBtn');
        const startOverBtn = document.getElementById('startOverBtn');
        const fromProfile = !!(evaluationMeta && evaluationMeta.startedFromProfile);
        if (rsBtn) rsBtn.style.display = fromProfile ? '' : 'none';
        if (startOverBtn) startOverBtn.style.display = fromProfile ? 'none' : '';
    } catch (_) { /* ignore */ }
    
    // Add trait evaluations
    Object.keys(evaluationResults).forEach(key => {
        const result = evaluationResults[key];
        const item = document.createElement('div');
        item.className = 'summary-item';
        const safeSection = escapeHtml(result.section || '');
        const safeTrait = escapeHtml(result.trait || '');
        const safeGrade = escapeHtml(result.grade || '');
        const safeGradeNum = escapeHtml(String(result.gradeNumber || ''));
        const safeJust = nl2br(String(result.justification || ''));
        item.innerHTML = `
            <div class="summary-trait">${safeSection}: ${safeTrait}</div>
            <div class="summary-grade">Grade: ${safeGrade} (${safeGradeNum})</div>
            <div class="summary-justification">${safeJust}</div>
        `;
        summaryGrid.appendChild(item);
    });

    // Section I comments
    if (evaluationMeta.sectionIComments && evaluationMeta.sectionIComments.trim()) {
        const sectionIItem = document.createElement('div');
        sectionIItem.className = 'summary-item';
        sectionIItem.style.background = '#f9f9f9';
        const safeSectionI = nl2br(evaluationMeta.sectionIComments || '');
        sectionIItem.innerHTML = `
            <div class="summary-trait">Section I - Comments</div>
            <div class="summary-justification" style="max-height: none; font-size: 13px; line-height: 1.4; white-space: pre-line;">
                ${safeSectionI}
            </div>
        `;
        summaryGrid.appendChild(sectionIItem);
    }

    // Directed comments
    if (evaluationMeta.directedComments && evaluationMeta.directedComments.trim()) {
        const directedCommentsItem = document.createElement('div');
        directedCommentsItem.className = 'summary-item';
        directedCommentsItem.style.background = '#f0f7ff';
        const safeDirected = nl2br(evaluationMeta.directedComments || '');
        directedCommentsItem.innerHTML = `
            <div class="summary-trait">Section I - Directed Comments</div>
            <div class="summary-justification" style="max-height: none; font-size: 13px; line-height: 1.4; white-space: pre-line;">
                ${safeDirected}
            </div>
        `;
        summaryGrid.appendChild(directedCommentsItem);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Explicitly expose this implementation for other modules
window.evaluationShowSummary = showSummary;
