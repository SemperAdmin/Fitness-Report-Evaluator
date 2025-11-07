// Validation and Error Prevention Functions
let validationWarnings = [];

// Validation rules and thresholds
const VALIDATION_RULES = {
    MIN_JUSTIFICATION_LENGTH: 30,
    RECOMMENDED_JUSTIFICATION_LENGTH: 50,
    GRADE_CONSISTENCY_THRESHOLD: 1.5, // Standard deviation threshold
    HIGH_GRADE_THRESHOLD: 5.0, // F+ grades
    LOW_GRADE_THRESHOLD: 3.0, // C- grades
    TOP_PERFORMER_MIN_AVERAGE: 4.5,
    DEVELOPING_PERFORMER_MAX_AVERAGE: 3.5
};

function validateEvaluation() {
    validationWarnings = [];
    
    // Only validate if we have evaluation results
    if (Object.keys(evaluationResults).length === 0) {
        return validationWarnings;
    }
    
    // Run all validation checks
    validateGradeConsistency();
    validatePromotionConsistency();
    validateJustificationQuality();
    validatePerformanceTierConsistency();
    validateGradeInflation();
    
    return validationWarnings;
}

function validateGradeConsistency() {
    const grades = Object.values(evaluationResults).map(r => r.gradeNumber);
    const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
    const variance = grades.reduce((sum, grade) => sum + Math.pow(grade - average, 2), 0) / grades.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Check for unusual grade patterns
    const highGrades = grades.filter(g => g >= VALIDATION_RULES.HIGH_GRADE_THRESHOLD).length;
    const lowGrades = grades.filter(g => g <= VALIDATION_RULES.LOW_GRADE_THRESHOLD).length;
    const totalGrades = grades.length;
    
    // Flag inconsistent grading patterns
    if (standardDeviation > VALIDATION_RULES.GRADE_CONSISTENCY_THRESHOLD) {
        const highPercentage = ((highGrades / totalGrades) * 100).toFixed(0);
        const lowPercentage = ((lowGrades / totalGrades) * 100).toFixed(0);
        
        if (highGrades > 0 && lowGrades > 0) {
            addWarning('consistency', 'warning', 
                `Mixed Performance Pattern: ${highPercentage}% high grades (E-G) and ${lowPercentage}% low grades (A-C). Consider reviewing for consistency.`,
                'Review trait evaluations to ensure they reflect a coherent performance picture.'
            );
        }
    }
    
    // Flag potential grade inflation
    if (highGrades / totalGrades > 0.6) {
        addWarning('inflation', 'warning',
            `Potential Grade Inflation: ${((highGrades / totalGrades) * 100).toFixed(0)}% of grades are E-G. Ensure justifications support high markings.`,
            'High grades should be reserved for truly exceptional performance with strong supporting evidence.'
        );
    }
    
    // Flag unusually low performance
    if (lowGrades / totalGrades > 0.5) {
        addWarning('low-performance', 'info',
            `Low Performance Pattern: ${((lowGrades / totalGrades) * 100).toFixed(0)}% of grades are C or below. Consider if counseling or development programs are needed.`,
            'Consistent low performance may require additional documentation or adverse reporting procedures.'
        );
    }
}

function validatePromotionConsistency() {
    if (!evaluationMeta.sectionIComments) return;
    
    const grades = Object.values(evaluationResults).map(r => r.gradeNumber);
    const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
    const analysis = analyzeTraitEvaluations();
    const sectionIText = evaluationMeta.sectionIComments.toLowerCase();
    
    // Check for promotion recommendation vs. performance mismatch
    if (sectionIText.includes('absolute must') || sectionIText.includes('highest recommendation')) {
        if (average < 4.5) {
            addWarning('promotion-mismatch', 'error',
                `Promotion Mismatch: "Must promote" language used with ${average.toFixed(1)} average. Strong promotion language requires exceptional performance.`,
                'Consider moderating promotion language or reviewing grade justifications for consistency.'
            );
        }
    }
    
    if (sectionIText.includes('promote.') && !sectionIText.includes('highly') && !sectionIText.includes('strongly')) {
        if (average > 4.0) {
            addWarning('promotion-weak', 'warning',
                `Weak Promotion Language: Simple "Promote." with ${average.toFixed(1)} average. Consider stronger endorsement language.`,
                'Performance above 4.0 average typically warrants more enthusiastic promotion recommendations.'
            );
        }
    }
    
    // Check tier vs. promotion consistency
    if (analysis.tier === 'developing' && (sectionIText.includes('highly recommended') || sectionIText.includes('absolute must'))) {
        addWarning('tier-promotion-mismatch', 'error',
            `Classification Mismatch: "Developing Performer" tier with strong promotion language. These should align.`,
            'Developing performers typically receive moderate promotion endorsements like "Promote" or "Promote with peers".'
        );
    }
    
    if (analysis.tier === 'top' && sectionIText.includes('promote.') && !sectionIText.includes('highly')) {
        addWarning('tier-promotion-weak', 'warning',
            `Missed Opportunity: "Top Performer" classification with weak promotion endorsement.`,
            'Top performers should receive strong promotion recommendations to maximize competitive advantage.'
        );
    }
}

function validateJustificationQuality() {
    const shortJustifications = [];
    const emptyJustifications = [];
    const repetitiveJustifications = [];
    const justificationTexts = [];
    
    Object.values(evaluationResults).forEach(result => {
        const wordCount = result.justification.trim().split(/\s+/).filter(word => word.length > 0).length;
        const text = result.justification.toLowerCase().trim();
        
        // Check length
        if (wordCount === 0) {
            emptyJustifications.push(result.trait);
        } else if (wordCount < VALIDATION_RULES.MIN_JUSTIFICATION_LENGTH) {
            shortJustifications.push({
                trait: result.trait,
                wordCount: wordCount,
                grade: result.grade
            });
        }
        
        // Check for repetitive content
        if (justificationTexts.includes(text)) {
            repetitiveJustifications.push(result.trait);
        }
        justificationTexts.push(text);
        
        // Check justification quality vs. grade
        if (result.gradeNumber >= 5 && wordCount < VALIDATION_RULES.RECOMMENDED_JUSTIFICATION_LENGTH) {
            addWarning('justification-grade-mismatch', 'warning',
                `High Grade, Short Justification: ${result.trait} marked ${result.grade} but justification has only ${wordCount} words.`,
                'High grades (E-G) require substantial justification with specific examples and evidence.'
            );
        }
        
        // Check for generic/weak justifications with high grades
        if (result.gradeNumber >= 5 && isGenericJustification(result.justification)) {
            addWarning('generic-justification', 'warning',
                `Generic Justification: ${result.trait} marked ${result.grade} but justification lacks specific examples.`,
                'High grades require detailed, specific accomplishments and evidence.'
            );
        }
    });
    
    // Report short justifications
    if (shortJustifications.length > 0) {
        const traits = shortJustifications.map(j => `${j.trait} (${j.wordCount} words, Grade ${j.grade})`).join(', ');
        addWarning('short-justifications', 'warning',
            `Short Justifications: ${shortJustifications.length} trait(s) have fewer than ${VALIDATION_RULES.MIN_JUSTIFICATION_LENGTH} words: ${traits}`,
            'Consider adding specific examples, accomplishments, and evidence to strengthen justifications.'
        );
    }
    
    // Report repetitive justifications
    if (repetitiveJustifications.length > 0) {
        addWarning('repetitive-justifications', 'warning',
            `Duplicate Justifications: ${repetitiveJustifications.join(', ')} have identical or very similar text.`,
            'Each trait should have unique justification reflecting specific performance in that area.'
        );
    }
    
    // Report empty justifications
    if (emptyJustifications.length > 0) {
        addWarning('empty-justifications', 'error',
            `Missing Justifications: ${emptyJustifications.join(', ')} have no justification text.`,
            'All trait markings require supporting justification.'
        );
    }
}

function validatePerformanceTierConsistency() {
    if (!evaluationMeta.sectionIComments) return;
    
    const grades = Object.values(evaluationResults).map(r => r.gradeNumber);
    const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
    const analysis = analyzeTraitEvaluations();
    const sectionIText = evaluationMeta.sectionIComments.toLowerCase();
    
    // Check if performance tier matches grades
    if (analysis.tier === 'top' && average < VALIDATION_RULES.TOP_PERFORMER_MIN_AVERAGE) {
        addWarning('tier-grade-mismatch', 'warning',
            `Performance Tier Mismatch: "Top Performer" classification with ${average.toFixed(1)} average (below ${VALIDATION_RULES.TOP_PERFORMER_MIN_AVERAGE}).`,
            'Top performer classification typically requires sustained high performance across multiple traits.'
        );
    }
    
    if (analysis.tier === 'developing' && average > VALIDATION_RULES.DEVELOPING_PERFORMER_MAX_AVERAGE) {
        addWarning('tier-grade-high', 'warning',
            `Performance Tier Mismatch: "Developing Performer" classification with ${average.toFixed(1)} average (above ${VALIDATION_RULES.DEVELOPING_PERFORMER_MAX_AVERAGE}).`,
            'Consider upgrading to "Middle Performer" or "Top Performer" classification.'
        );
    }
    
    // Check narrative tone vs. performance
    const hasPositiveLanguage = sectionIText.includes('exceptional') || sectionIText.includes('outstanding') || 
                               sectionIText.includes('immensely talented') || sectionIText.includes('superior');
    const hasNegativeLanguage = sectionIText.includes('requires development') || sectionIText.includes('needs improvement') ||
                                sectionIText.includes('room for improvement');
    
    if (hasPositiveLanguage && analysis.tier === 'developing') {
        addWarning('narrative-tier-mismatch', 'warning',
            `Narrative Mismatch: Using exceptional/outstanding language for "Developing Performer".`,
            'Narrative tone should match performance classification for consistency.'
        );
    }
    
    if (hasNegativeLanguage && analysis.tier === 'top') {
        addWarning('narrative-tier-negative', 'warning',
            `Narrative Mismatch: Using developmental language for "Top Performer".`,
            'Top performers should have positive, achievement-focused narratives.'
        );
    }
}

function validateGradeInflation() {
    const grades = Object.values(evaluationResults).map(r => r.gradeNumber);
    const highGradeCount = grades.filter(g => g >= 6).length; // F and G grades
    const totalGrades = grades.length;
    const highGradePercentage = (highGradeCount / totalGrades) * 100;
    
    // Check for potential inflation patterns
    if (highGradePercentage > 70) {
        addWarning('grade-inflation-high', 'error',
            `Potential Grade Inflation: ${highGradePercentage.toFixed(0)}% of grades are F-G. This is unusually high.`,
            'F-G grades should be reserved for truly exceptional performance. Review justifications carefully.'
        );
    } else if (highGradePercentage > 50) {
        addWarning('grade-inflation-moderate', 'warning',
            `High Grade Distribution: ${highGradePercentage.toFixed(0)}% of grades are F-G. Ensure this reflects actual performance.`,
            'High grades should be supported by specific, exceptional accomplishments.'
        );
    }
    
    // Check for "all high" pattern
    if (grades.every(g => g >= 4)) {
        addWarning('all-high-grades', 'warning',
            `All High Grades: Every trait marked D or higher. Verify this accurately reflects performance across all areas.`,
            'Consider if any traits show room for improvement or development opportunities.'
        );
    }
}

function isGenericJustification(text) {
    const genericPhrases = [
        'performs well', 'does a good job', 'meets expectations', 'adequate performance',
        'satisfactory work', 'completes tasks', 'good marine', 'hard worker'
    ];
    
    const lowerText = text.toLowerCase();
    return genericPhrases.some(phrase => lowerText.includes(phrase)) && 
           !lowerText.includes('led') && !lowerText.includes('managed') && 
           !lowerText.includes('achieved') && !lowerText.includes('implemented');
}

function addWarning(id, type, message, recommendation) {
    validationWarnings.push({
        id: id,
        type: type, // 'error', 'warning', 'info'
        message: message,
        recommendation: recommendation,
        timestamp: new Date()
    });
}

function displayValidationWarnings() {
    const container = document.getElementById('validationWarnings');
    if (!container) return;
    
    const warnings = validateEvaluation();
    
    if (warnings.length === 0) {
        container.innerHTML = `
            <div class="validation-success">
                <div class="validation-icon">✓</div>
                <div class="validation-message">
                    <strong>Validation Passed</strong><br>
                    No consistency issues detected.
                </div>
            </div>
        `;
        container.classList.add('active');
        return;
    }
    
    // Group warnings by type
    const errors = warnings.filter(w => w.type === 'error');
    const warningItems = warnings.filter(w => w.type === 'warning');
    const infoItems = warnings.filter(w => w.type === 'info');
    
    let html = '<div class="validation-results">';
    
    // Display summary
    html += `
        <div class="validation-summary">
            <h4>Validation Results</h4>
            <div class="validation-counts">
                ${errors.length > 0 ? `<span class="error-count">${errors.length} Error${errors.length !== 1 ? 's' : ''}</span>` : ''}
                ${warningItems.length > 0 ? `<span class="warning-count">${warningItems.length} Warning${warningItems.length !== 1 ? 's' : ''}</span>` : ''}
                ${infoItems.length > 0 ? `<span class="info-count">${infoItems.length} Info</span>` : ''}
            </div>
        </div>
    `;
    
    // Display warnings by type
    [
        { items: errors, label: 'Errors', class: 'error' },
        { items: warningItems, label: 'Warnings', class: 'warning' },
        { items: infoItems, label: 'Information', class: 'info' }
    ].forEach(group => {
        if (group.items.length > 0) {
            html += `<div class="validation-group ${group.class}">`;
            html += `<h5>${group.label}</h5>`;
            group.items.forEach(item => {
                html += `
                    <div class="validation-item ${item.type}">
                        <div class="validation-message">${nl2br(escapeHtml(String(item.message || '')))}</div>
                        <div class="validation-recommendation">${nl2br(escapeHtml(String(item.recommendation || '')))}</div>
                    </div>
                `;
            });
            html += `</div>`;
        }
    });
    
    html += '</div>';
    container.innerHTML = html;
    container.classList.add('active');
}
