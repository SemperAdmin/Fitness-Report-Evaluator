// Section I Comment Generation Functions
let generatedSectionI = '';
let currentGenerationStyle = 'comprehensive';

// Section I Comment Templates
const sectionITemplates = {
    top: {
        openings: [
            "An immensely talented and effective Marine who operates at a level beyond the grasp of peers.",
            "A highly motivated and technically proficient Marine whose performance significantly exceeds expectations.",
            "An exceptional Marine who consistently demonstrates outstanding performance across all areas of responsibility.",
            "A superior performer whose dedication to excellence and professional competence set the standard for others."
        ],
        performance: [
            "Hand selected to assume critical billets, MRO completely outperformed peers in every season.",
            "Demonstrates exceptional technical and tactical proficiency in all assigned duties.",
            "A superb technician with impressive MOS and professional skills.",
            "Consistently produces quality results while measurably improving unit performance."
        ],
        leadership: [
            "Demonstrates impeccable moral character and matchless ability among peers to lead and inspire Marines and Sailors.",
            "Provides inspirational leadership that motivates subordinates to achieve their highest potential.",
            "An absolute technical expert whose professional skill rivals that of an officer.",
            "Serves as an exemplary role model, consistently demonstrating Marine Corps values."
        ],
        character: [
            "The Corps could not find a finer ambassador for recruiting duty.",
            "Demonstrates unwavering integrity and embodies Marine Corps values in all actions.",
            "Shows exceptional courage and moral strength in challenging situations.",
            "Maintains the highest standards of personal and professional conduct."
        ],
        promotion: [
            "An absolute must for promotion.",
            "My highest recommendation for promotion.",
            "Highly recommended for any officer commissioning program.",
            "Recommended for promotion without reservation and selection for advanced training opportunities."
        ]
    },
    middle: {
        openings: [
            "A talented Marine whose performance during the period was outstanding.",
            "A mature and dedicated Marine who performs duties with professionalism and attention to detail.",
            "A conscientious Marine who demonstrates solid performance and commitment to mission accomplishment.",
            "A dependable Marine who maintains appropriate standards and contributes positively to unit effectiveness."
        ],
        performance: [
            "MRO quickly mastered section responsibilities and guided section to superior results.",
            "A superb technician with impressive MOS and professional skills, MRO directed the various administrative and training requirements of the unit with impressive precision.",
            "Maintains required standards and contributes effectively to unit mission accomplishment.",
            "Exhibits reliable performance and adaptability in various operational environments."
        ],
        leadership: [
            "A mature and dedicated leader who provides a guiding and steadying influence on Marines and Sailors.",
            "Shows sound judgment in routine situations and handles responsibilities competently.",
            "Provides adequate supervision and guidance to assigned personnel.",
            "Maintains professional demeanor and sets a positive example for junior Marines."
        ],
        character: [
            "Maintains high standards of personal conduct and demonstrates Marine Corps values.",
            "Shows good moral character and makes sound ethical decisions.",
            "Demonstrates reliability and commitment to Marine Corps standards."
        ],
        promotion: [
            "Highly recommended for promotion and billets of increased responsibility.",
            "Ready for promotion and additional responsibilities commensurate with grade.",
            "Recommend for continued professional development and promotion consideration.",
            "Suitable for promotion and assignment to positions of increased responsibility."
        ]
    },
    developing: {
        openings: [
            "An effective Marine who operates at a level expected of a Marine with rank and experience.",
            "A developing Marine who shows improvement and commitment to professional growth.",
            "A Marine who operates at the level expected for rank but has room for improvement.",
            "A Marine who demonstrates basic competency but needs additional mentoring and development."
        ],
        performance: [
            "Demonstrates the leadership and technical skills required to accomplish assigned billet responsibilities.",
            "Shows understanding of fundamental duties but needs improvement in execution.",
            "Performs routine tasks adequately but requires supervision for complex assignments.",
            "Directs the various administrative and training requirements of the unit with limited guidance."
        ],
        leadership: [
            "Demonstrates basic leadership potential but requires continued development.",
            "Shows improvement in supervisory skills but needs additional mentoring.",
            "Exhibits potential for leadership growth with proper guidance and experience.",
            "Requires continued development in decision-making and problem-solving abilities."
        ],
        character: [
            "Shows commitment to Marine Corps values and personal development.",
            "Demonstrates basic understanding of professional standards.",
            "Shows potential for growth in personal and professional conduct."
        ],
        promotion: [
            "Promote.",
            "Suitable for promotion with additional training and mentoring.",
            "Recommend for professional development programs and promotion when due.",
            "Requires continued growth but shows potential for future advancement."
        ]
    }
};

// Section I Analysis and Generation Functions
function analyzeTraitEvaluations() {
    const grades = Object.values(evaluationResults).map(r => r.gradeNumber);
    const total = grades.length;
    const average = grades.reduce((sum, grade) => sum + grade, 0) / total;
    const highGrades = grades.filter(g => g >= 6).length; // F and G grades
    const midGrades = grades.filter(g => g >= 4 && g <= 5).length; // D and E grades
    const lowGrades = grades.filter(g => g <= 3).length; // A, B, C grades
    const aGrades = grades.filter(g => g === 1).length; // A grades only
    const bcGrades = grades.filter(g => g >= 2 && g <= 3).length; // B and C grades
    
    // Determine performance tier
    let tier = 'middle';
    if (average >= 5.5 && highGrades >= total * 0.4) {
        tier = 'top';
    } else if (average <= 3.5 || lowGrades >= total * 0.3) {
        tier = 'developing';
    }
    
    return {
        tier,
        average: average.toFixed(2),
        total,
        highGrades,
        midGrades,
        lowGrades,
        aGrades,
        bcGrades,
        percentageHigh: ((highGrades / total) * 100).toFixed(1),
        percentageMid: ((midGrades / total) * 100).toFixed(1),
        percentageLow: ((lowGrades / total) * 100).toFixed(1)
    };
}

function extractKeyAccomplishments() {
    const accomplishments = [];
    
    Object.values(evaluationResults).forEach(result => {
        if (result.gradeNumber >= 4) { // D grade or higher
            const justification = result.justification;
            // Extract meaningful sentences with better patterns
            const sentences = justification.split(/[.!?]+/);
            const meaningful = sentences.find(s => 
                s.trim().length > 20 && 
                (s.toLowerCase().includes('led') || 
                 s.toLowerCase().includes('achieved') ||
                 s.toLowerCase().includes('improved') ||
                 s.toLowerCase().includes('exceeded') ||
                 s.toLowerCase().includes('completed') ||
                 s.toLowerCase().includes('managed') ||
                 s.toLowerCase().includes('developed') ||
                 s.toLowerCase().includes('implemented') ||
                 s.toLowerCase().includes('organized') ||
                 s.toLowerCase().includes('trained') ||
                 s.toLowerCase().includes('supervised') ||
                 s.toLowerCase().includes('coordinated'))
            );
            
            if (meaningful) {
                accomplishments.push({
                    section: result.section,
                    trait: result.trait,
                    grade: result.grade,
                    gradeNumber: result.gradeNumber,
                    accomplishment: meaningful.trim(),
                    sectionKey: getTraitSectionKey(result.section)
                });
            }
        }
    });
    
    // Sort by grade (highest first) and return top accomplishments
    return accomplishments.sort((a, b) => b.gradeNumber - a.gradeNumber);
}

function getTraitSectionKey(sectionTitle) {
    const sectionMap = {
        'Mission Accomplishment': 'mission',
        'Individual Character': 'character',
        'Leadership': 'leadership',
        'Intellect and Wisdom': 'intellect',
        'Fulfillment of Evaluation Responsibilities': 'evaluation'
    };
    return sectionMap[sectionTitle] || 'general';
}

function analyzePerformancePatterns() {
    const results = Object.values(evaluationResults);
    const patterns = {
        strongestAreas: [],
        developmentAreas: [],
        consistentPerformer: false,
        standoutTraits: [],
        leadershipFocus: false,
        technicalExcellence: false
    };
    
    // Identify strongest performing areas
    const sectionAverages = {};
    const sectionCounts = {};
    
    results.forEach(result => {
        const section = getTraitSectionKey(result.section);
        if (!sectionAverages[section]) {
            sectionAverages[section] = 0;
            sectionCounts[section] = 0;
        }
        sectionAverages[section] += result.gradeNumber;
        sectionCounts[section]++;
    });
    
    // Calculate section averages
    Object.keys(sectionAverages).forEach(section => {
        sectionAverages[section] = sectionAverages[section] / sectionCounts[section];
    });
    
    // Find strongest areas (above 4.5 average)
    patterns.strongestAreas = Object.keys(sectionAverages)
        .filter(section => sectionAverages[section] >= 4.5)
        .sort((a, b) => sectionAverages[b] - sectionAverages[a]);
    
    // Find development areas (below 3.5 average)
    patterns.developmentAreas = Object.keys(sectionAverages)
        .filter(section => sectionAverages[section] <= 3.5);
    
    // Check for consistency (standard deviation < 1.0)
    const allGrades = results.map(r => r.gradeNumber);
    const avg = allGrades.reduce((sum, grade) => sum + grade, 0) / allGrades.length;
    const variance = allGrades.reduce((sum, grade) => sum + Math.pow(grade - avg, 2), 0) / allGrades.length;
    patterns.consistentPerformer = Math.sqrt(variance) < 1.0;
    
    // Identify standout traits (grade 6+)
    patterns.standoutTraits = results
        .filter(r => r.gradeNumber >= 6)
        .map(r => ({ trait: r.trait, grade: r.grade }));
    
    // Check for leadership focus
    patterns.leadershipFocus = sectionAverages.leadership >= 4.5;
    
    // Check for technical excellence
    patterns.technicalExcellence = sectionAverages.mission >= 5.0;
    
    return patterns;
}

function generateSectionIComment() {
    const analysis = analyzeTraitEvaluations();
    const accomplishments = extractKeyAccomplishments();
    const patterns = analyzePerformancePatterns();
    const templates = sectionITemplates[analysis.tier];
    
    updateAnalysisDisplay(analysis);
    
    let comment = '';
    
    // Opening statement - enhanced based on patterns
    let opening = getRandomTemplate(templates.openings);
    if (patterns.consistentPerformer && analysis.tier === 'top') {
        opening = "An immensely talented and effective Marine who operates at a level beyond the grasp of peers.";
    } else if (patterns.technicalExcellence) {
        opening = "A highly motivated and technically proficient Marine whose performance significantly exceeds expectations.";
    }
    comment += opening + ' ';
    
    // Performance section with specific accomplishments
    if (patterns.strongestAreas.includes('mission') && accomplishments.length > 0) {
        const missionAccomplishments = accomplishments.filter(a => a.sectionKey === 'mission');
        if (missionAccomplishments.length > 0) {
            comment += `MRO ${missionAccomplishments[0].accomplishment.toLowerCase()}. `;
        } else {
            comment += getRandomTemplate(templates.performance) + ' ';
        }
    } else {
        comment += getRandomTemplate(templates.performance) + ' ';
    }
    
    // Leadership section - enhanced based on leadership performance
    if (patterns.leadershipFocus || currentGenerationStyle === 'comprehensive' || analysis.tier === 'top') {
        const leadershipAccomplishments = accomplishments.filter(a => a.sectionKey === 'leadership');
        if (leadershipAccomplishments.length > 0 && currentGenerationStyle !== 'concise') {
            comment += `${leadershipAccomplishments[0].accomplishment}. `;
        } else {
            comment += getRandomTemplate(templates.leadership) + ' ';
        }
    }
    
    // Character section - adapt based on character grades
    if (patterns.strongestAreas.includes('character')) {
        comment += "Demonstrates impeccable moral character and matchless ability among peers to lead and inspire Marines and Sailors. ";
    } else {
        comment += getRandomTemplate(templates.character) + ' ';
    }
    
    // Add specific standout traits for comprehensive style
    if (currentGenerationStyle === 'comprehensive' && patterns.standoutTraits.length > 0) {
        const traitText = patterns.standoutTraits.map(t => `${t.trait.toLowerCase()} (${t.grade})`).slice(0, 2).join(' and ');
        comment += `Particularly noteworthy performance in ${traitText}. `;
    }
    
    // Add multiple accomplishments for comprehensive comments
    if (currentGenerationStyle === 'comprehensive' && accomplishments.length > 1) {
        const topAccomplishments = accomplishments.slice(0, 3);
        const achievementTexts = topAccomplishments.map(a => a.accomplishment.toLowerCase());
        
        if (achievementTexts.length === 2) {
            comment += `Key accomplishments include: ${achievementTexts[0]} and ${achievementTexts[1]}. `;
        } else if (achievementTexts.length >= 3) {
            comment += `Key accomplishments include: ${achievementTexts[0]}, ${achievementTexts[1]}, and ${achievementTexts[2]}. `;
        }
    }
    
    // Generate promotion recommendation with enhanced logic
    const promotionEndorsement = generateEnhancedPromotionEndorsement(analysis.tier, patterns);
    comment += promotionEndorsement;
    
    // Clean up the comment
    comment = comment.replace(/\s+/g, ' ').trim();
    
    // Set the generated comment
    document.getElementById('sectionITextarea').value = comment;
    generatedSectionI = comment;
    updateSectionIWordCount();
}

function generateEnhancedPromotionEndorsement(performanceTier, patterns) {
    let promotionStatement = '';
    
    // Generate promotion recommendation based on performance tier and patterns
    if (performanceTier === 'top') {
        if (patterns.technicalExcellence && patterns.leadershipFocus) {
            promotionStatement = "An absolute must for promotion.";
        } else if (patterns.standoutTraits.length >= 3) {
            promotionStatement = "My highest recommendation for promotion.";
        } else {
            const topStatements = [
                "Highly recommended for promotion.",
                "Promote at first opportunity.",
                "An absolute must for promotion."
            ];
            promotionStatement = getRandomFromArray(topStatements);
        }
        
        // Add additional endorsements for exceptional performers
        if (patterns.consistentPerformer && patterns.strongestAreas.length >= 3) {
            promotionStatement += " Highly recommended for any officer commissioning program.";
        }
        
    } else if (performanceTier === 'middle') {
        if (patterns.strongestAreas.length >= 2) {
            const middleStatements = [
                "Highly recommended for promotion and billets of increased responsibility.",
                "Strongly recommended for promotion."
            ];
            promotionStatement = getRandomFromArray(middleStatements);
        } else {
            const standardStatements = [
                "Highly recommended for promotion.",
                "Promote at first opportunity."
            ];
            promotionStatement = getRandomFromArray(standardStatements);
        }
        
    } else if (performanceTier === 'developing') {
        if (patterns.developmentAreas.length > 2) {
            promotionStatement = "Promote.";
        } else {
            const developingStatements = [
                "Recommended for promotion.",
                "Promote with peers.",
                "Promote."
            ];
            promotionStatement = getRandomFromArray(developingStatements);
        }
    }
    
    return promotionStatement;
}

function getRandomFromArray(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomTemplate(templates) {
    return templates[Math.floor(Math.random() * templates.length)];
}

function updateAnalysisDisplay(analysis) {
    const statsContainer = document.getElementById('analysisStats');
    const tierDisplay = document.getElementById('performanceTierDisplay');
    
    statsContainer.innerHTML = `
        <div class="stat-box">
            <div class="stat-value">${analysis.average}</div>
            <div class="stat-label">Average Grade</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${analysis.highGrades}</div>
            <div class="stat-label">F/G Grades</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${analysis.midGrades}</div>
            <div class="stat-label">D/E Grades</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${analysis.total}</div>
            <div class="stat-label">Total Traits</div>
        </div>
    `;
    
    tierDisplay.textContent = analysis.tier.charAt(0).toUpperCase() + analysis.tier.slice(1) + ' Performer';
    tierDisplay.className = `performance-tier-display tier-${analysis.tier}`;
    
    // Update the detailed grade groups display
    updateGradeGroupsDisplay(analysis);
    
    // Display validation warnings
    displayValidationWarnings();
}

function updateGradeGroupsDisplay(analysis) {
    const gradeGroupsContainer = document.getElementById('gradeGroupsContainer');
    if (!gradeGroupsContainer) return;
    
    // Get grade details for each group
    const gradeGroups = getGradeGroups();
    
    gradeGroupsContainer.innerHTML = `
        <h4 style="color: #1e3c72; margin-bottom: 15px;">Grade Distribution by Category</h4>
        <div class="grade-groups-grid">
            <div class="grade-group ${gradeGroups.fgGrades.length > 0 ? 'has-grades' : 'no-grades'}">
                <div class="grade-group-header">
                    <span class="grade-group-title">F/G Grades (${gradeGroups.fgGrades.length})</span>
                    <span class="grade-group-subtitle">Outstanding Performance</span>
                </div>
                <div class="grade-group-content">
                    ${gradeGroups.fgGrades.length > 0 ? 
                        gradeGroups.fgGrades.map(item => `
                            <div class="grade-item">
                                <span class="grade-badge grade-${item.grade.toLowerCase()}">${item.grade}</span>
                                <span class="trait-name">${item.section}: ${item.trait}</span>
                            </div>
                        `).join('') : 
                        '<div class="no-grades-message">No grades in this category</div>'
                    }
                </div>
            </div>
            
            <div class="grade-group ${gradeGroups.deGrades.length > 0 ? 'has-grades' : 'no-grades'}">
                <div class="grade-group-header">
                    <span class="grade-group-title">D/E Grades (${gradeGroups.deGrades.length})</span>
                    <span class="grade-group-subtitle">Above Average Performance</span>
                </div>
                <div class="grade-group-content">
                    ${gradeGroups.deGrades.length > 0 ? 
                        gradeGroups.deGrades.map(item => `
                            <div class="grade-item">
                                <span class="grade-badge grade-${item.grade.toLowerCase()}">${item.grade}</span>
                                <span class="trait-name">${item.section}: ${item.trait}</span>
                            </div>
                        `).join('') : 
                        '<div class="no-grades-message">No grades in this category</div>'
                    }
                </div>
            </div>
            
            <div class="grade-group ${gradeGroups.bcGrades.length > 0 ? 'has-grades' : 'no-grades'}">
                <div class="grade-group-header">
                    <span class="grade-group-title">B/C Grades (${gradeGroups.bcGrades.length})</span>
                    <span class="grade-group-subtitle">Average Performance</span>
                </div>
                <div class="grade-group-content">
                    ${gradeGroups.bcGrades.length > 0 ? 
                        gradeGroups.bcGrades.map(item => `
                            <div class="grade-item">
                                <span class="grade-badge grade-${item.grade.toLowerCase()}">${item.grade}</span>
                                <span class="trait-name">${item.section}: ${item.trait}</span>
                            </div>
                        `).join('') : 
                        '<div class="no-grades-message">No grades in this category</div>'
                    }
                </div>
            </div>
            
            <div class="grade-group ${gradeGroups.aGrades.length > 0 ? 'has-grades' : 'no-grades'}">
                <div class="grade-group-header">
                    <span class="grade-group-title">A Grades (${gradeGroups.aGrades.length})</span>
                    <span class="grade-group-subtitle">Below Standards</span>
                </div>
                <div class="grade-group-content">
                    ${gradeGroups.aGrades.length > 0 ? 
                        gradeGroups.aGrades.map(item => `
                            <div class="grade-item">
                                <span class="grade-badge grade-${item.grade.toLowerCase()}">${item.grade}</span>
                                <span class="trait-name">${item.section}: ${item.trait}</span>
                            </div>
                        `).join('') : 
                        '<div class="no-grades-message">No grades in this category</div>'
                    }
                </div>
            </div>
        </div>
    `;
}

function getGradeGroups() {
    const groups = {
        fgGrades: [], // F and G grades
        deGrades: [], // D and E grades  
        bcGrades: [], // B and C grades
        aGrades: []   // A grades
    };
    
    Object.values(evaluationResults).forEach(result => {
        const item = {
            section: result.section,
            trait: result.trait,
            grade: result.grade,
            gradeNumber: result.gradeNumber
        };
        
        if (result.gradeNumber >= 6) { // F and G
            groups.fgGrades.push(item);
        } else if (result.gradeNumber >= 4 && result.gradeNumber <= 5) { // D and E
            groups.deGrades.push(item);
        } else if (result.gradeNumber >= 2 && result.gradeNumber <= 3) { // B and C
            groups.bcGrades.push(item);
        } else if (result.gradeNumber === 1) { // A
            groups.aGrades.push(item);
        }
    });
    
    return groups;
}

function regenerateWithStyle(style) {
    currentGenerationStyle = style;
    generateSectionIComment();
}

function updateSectionIWordCount() {
    const textarea = document.getElementById('sectionITextarea');
    const counter = document.getElementById('sectionIWordCount');
    
    if (!textarea || !counter) return;
    
    const words = textarea.value.trim().split(/\s+/).filter(word => word.length > 0);
    const count = words.length;
    
    counter.textContent = `${count} words (Recommended: 200-400 words)`;
    counter.className = 'word-count-display';
    
    if (count >= 200 && count <= 400) {
        counter.classList.add('good');
    } else if (count > 400 || count < 150) {
        counter.classList.add('warning');
    }
}

// skipSectionI()
function skipSectionI() {
    if (generatedSectionI && confirm('You have generated a Section I comment. Are you sure you want to skip it?')) {
        generatedSectionI = '';
    }
    
    evaluationMeta.sectionIComments = '';
    const sectionICard = document.getElementById('sectionIGenerationCard');
    sectionICard.classList.remove('active');
    sectionICard.style.display = 'none';
    showSummary();
}

// finalizeSectionI()
function finalizeSectionI() {
    const sectionIText = document.getElementById('sectionITextarea').value.trim();
    
    if (sectionIText) {
        evaluationMeta.sectionIComments = sectionIText;
    } else {
        evaluationMeta.sectionIComments = '';
    }
    
    // Update progress indicator
    document.getElementById('progressText').textContent = 'Evaluation Complete';
    const sectionICard = document.getElementById('sectionIGenerationCard');
    sectionICard.classList.remove('active');
    sectionICard.style.display = 'none';
    showSummary();
}

// showSectionIGeneration()
function showSectionIGeneration() {
    // Hide other cards
    document.querySelectorAll('.evaluation-card, .directed-comments-card, .review-card, .summary-card').forEach(card => {
        card.classList.remove('active');
        card.style.display = 'none';
    });

    const sectionICard = document.getElementById('sectionIGenerationCard');
    sectionICard.classList.add('active');
    sectionICard.style.display = 'block';

    // Update progress indicator
    document.getElementById('progressText').textContent = 'Section I Comment Generation';

    // Initialize the analysis
    const analysis = analyzeTraitEvaluations();
    updateAnalysisDisplay(analysis);
}