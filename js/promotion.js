// Promotion Endorsement Functions
let promotionRecommendation = null;
let competitiveCategory = null;
let ranking = null;
let totalPopulation = null;

// Promotion recommendation templates based on performance tier and selection
const promotionTemplates = {
    accelerated: {
        statement: "I recommend that the MRO be considered for promotion ahead of contemporaries.",
        requiresAddendum: true,
        availableForTiers: ['top']
    },
    mustPromote: {
        statements: [
            "An absolute must for promotion",
            "My highest recommendation for promotion"
        ],
        availableForTiers: ['top']
    },
    highlyRecommended: {
        statements: [
            "Highly recommended for promotion",
            "Promote at first opportunity", 
            "Strongly recommended for promotion"
        ],
        availableForTiers: ['top', 'middle']
    },
    recommended: {
        statements: [
            "Recommended for promotion",
            "Promote with peers",
            "Promote"
        ],
        availableForTiers: ['middle', 'developing']
    },
    notRecommended: {
        statements: [
            "I recommend that the MRO not be considered for promotion with contemporaries.",
            "I recommend that the MRO not be considered for promotion at any time."
        ],
        availableForTiers: ['developing'],
        makesAdverse: true
    }
};

function showPromotionEndorsement() {
    document.getElementById('promotionEndorsementCard').classList.add('active');
    
    // Update progress indicator
    document.getElementById('progressText').textContent = 'Promotion Endorsement';
    
    // Initialize promotion options based on performance tier
    const analysis = analyzeTraitEvaluations();
    renderPromotionOptions(analysis.tier);
}

function renderPromotionOptions(performanceTier) {
    const optionsContainer = document.getElementById('promotionOptions');
    const tierDisplay = document.getElementById('promotionTierInfo');
    
    // Display current performance classification
    tierDisplay.innerHTML = `
        <div class="promotion-tier-info">
            <span class="tier-label">Current Performance Classification:</span>
            <span class="performance-tier-display tier-${performanceTier}">
                ${performanceTier.charAt(0).toUpperCase() + performanceTier.slice(1)} Performer
            </span>
        </div>
    `;
    
    optionsContainer.innerHTML = '';
    
    // Generate promotion recommendation options based on performance tier
    Object.keys(promotionTemplates).forEach(key => {
        const template = promotionTemplates[key];
        
        if (template.availableForTiers.includes(performanceTier)) {
            const option = document.createElement('div');
            option.className = `promotion-option ${template.makesAdverse ? 'adverse' : ''}`;
            option.onclick = () => selectPromotionRecommendation(key, template);
            
            let description = '';
            if (key === 'accelerated') {
                description = 'Accelerated Promotion (Ahead of Peers)';
            } else if (key === 'mustPromote') {
                description = 'Must Promote (Top Performer)';
            } else if (key === 'highlyRecommended') {
                description = 'Highly Recommended (Strong Performer)';
            } else if (key === 'recommended') {
                description = 'Recommended (Average Performer)';
            } else if (key === 'notRecommended') {
                description = 'Not Recommended (Makes Report Adverse)';
            }
            
            option.innerHTML = `
                <div class="promotion-option-title">${description}</div>
                <div class="promotion-option-examples">
                    ${template.statements ? template.statements.slice(0, 2).map(s => `<div class="example-statement">"${s}"</div>`).join('') : 
                      `<div class="example-statement">"${template.statement}"</div>`}
                </div>
                ${template.requiresAddendum ? '<div class="addendum-notice">⚠️ Requires addendum page justification</div>' : ''}
                ${template.makesAdverse ? '<div class="adverse-notice">⚠️ Makes report adverse</div>' : ''}
            `;
            
            optionsContainer.appendChild(option);
        }
    });
}

function selectPromotionRecommendation(type, template) {
    // Clear previous selections
    document.querySelectorAll('.promotion-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Select current option
    event.currentTarget.classList.add('selected');
    
    promotionRecommendation = { type, template };
    
    // Show competitive category section for non-accelerated promotions
    if (type !== 'accelerated') {
        showCompetitiveCategorySection();
    } else {
        hideCompetitiveCategorySection();
        showPromotionPreview();
    }
}

function showCompetitiveCategorySection() {
    const section = document.getElementById('competitiveCategorySection');
    section.classList.add('active');
    
    // Populate competitive category options
    const select = document.getElementById('competitiveCategorySelect');
    select.innerHTML = `
        <option value="">Select competitive category...</option>
        <option value="all_grade">All Marines of this grade</option>
        <option value="all_mos">All Marines of this grade in this MOS</option>
        <option value="all_unit">All Marines of this grade in this unit</option>
        <option value="custom">Custom category</option>
    `;
}

function hideCompetitiveCategorySection() {
    const section = document.getElementById('competitiveCategorySection');
    section.classList.remove('active');
}

function handleCategoryChange() {
    const select = document.getElementById('competitiveCategorySelect');
    const customInput = document.getElementById('customCategoryInput');
    const rankingSection = document.getElementById('rankingSection');
    
    competitiveCategory = select.value;
    
    if (competitiveCategory === 'custom') {
        customInput.style.display = 'block';
    } else {
        customInput.style.display = 'none';
    }
    
    if (competitiveCategory) {
        rankingSection.classList.add('active');
    } else {
        rankingSection.classList.remove('active');
    }
}

function handleCustomCategoryInput() {
    const input = document.getElementById('customCategoryText');
    competitiveCategory = input.value.trim();
    
    if (competitiveCategory) {
        updatePromotionPreview();
    }
}

function handleRankingInput() {
    const rankingInput = document.getElementById('rankingInput');
    const totalInput = document.getElementById('totalPopulationInput');
    
    ranking = parseInt(rankingInput.value);
    totalPopulation = parseInt(totalInput.value);
    
    if (ranking && totalPopulation) {
        updatePromotionPreview();
    }
}

function updatePromotionPreview() {
    if (promotionRecommendation && (promotionRecommendation.type === 'accelerated' || 
        (competitiveCategory && ranking && totalPopulation))) {
        showPromotionPreview();
    }
}

function showPromotionPreview() {
    const previewSection = document.getElementById('promotionPreviewSection');
    const previewText = document.getElementById('promotionPreviewText');
    
    let promotionStatement = '';
    
    if (promotionRecommendation.type === 'accelerated') {
        promotionStatement = promotionRecommendation.template.statement;
    } else {
        // Select random statement from available options
        const statements = promotionRecommendation.template.statements;
        const selectedStatement = statements[Math.floor(Math.random() * statements.length)];
        
        // Add competitive category and ranking context
        let categoryText = '';
        if (competitiveCategory === 'all_grade') {
            categoryText = 'all Marines of this grade';
        } else if (competitiveCategory === 'all_mos') {
            categoryText = 'all Marines of this grade in this MOS';
        } else if (competitiveCategory === 'all_unit') {
            categoryText = 'all Marines of this grade in this unit';
        } else {
            categoryText = competitiveCategory;
        }
        
        promotionStatement = `${selectedStatement}. Ranks #${ranking} of ${totalPopulation} among ${categoryText}.`;
    }
    
    previewText.textContent = promotionStatement;
    previewSection.classList.add('active');
    
    // Store the final statement
    evaluationMeta.promotionEndorsement = promotionStatement;
}

function regeneratePromotionStatement() {
    if (promotionRecommendation && promotionRecommendation.template.statements) {
        showPromotionPreview();
    }
}

function skipPromotionEndorsement() {
    if (confirm('Promotion endorsement is required for FITREP completion. Are you sure you want to skip?')) {
        evaluationMeta.promotionEndorsement = '';
        document.getElementById('promotionEndorsementCard').classList.remove('active');
        showSummary();
    }
}

function finalizePromotionEndorsement() {
    if (!promotionRecommendation) {
        alert('Please select a promotion recommendation before continuing.');
        return;
    }
    
    if (promotionRecommendation.type !== 'accelerated') {
        if (!competitiveCategory || !ranking || !totalPopulation) {
            alert('Please complete all promotion endorsement fields before continuing.');
            return;
        }
        
        if (ranking > totalPopulation) {
            alert('Ranking cannot be higher than total population.');
            return;
        }
    }
    
    // Append promotion endorsement to Section I comments
    if (evaluationMeta.sectionIComments) {
        evaluationMeta.sectionIComments += '\n\n' + evaluationMeta.promotionEndorsement;
    } else {
        evaluationMeta.sectionIComments = evaluationMeta.promotionEndorsement;
    }
    
    // Check if accelerated promotion requires addendum notice
    if (promotionRecommendation.type === 'accelerated') {
        evaluationMeta.requiresAddendum = true;
        evaluationMeta.addendumNotice = 'Note: Accelerated promotion recommendation requires addendum page justification per MCO 1610.7B, paragraph 4.g.(4).';
    }
    
    // Mark as adverse if not recommended
    if (promotionRecommendation.template.makesAdverse) {
        evaluationMeta.isAdverse = true;
    }
    
    document.getElementById('promotionEndorsementCard').classList.remove('active');
    showSummary();
}