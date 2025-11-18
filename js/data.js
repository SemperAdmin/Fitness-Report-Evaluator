// FITREP Trait Data Model with Complete MCO 1610.7B Descriptions and Specific Grade Criteria
const firepData = {
    sections: {
        D: {
            title: "Mission Accomplishment",
            traits: {
                performance: {
                    name: "Performance",
                    description: "Results achieved during the reporting period. How well those duties inherent to a Marine's billet, plus all additional duties, formally and informally assigned, were carried out. Reflects a Marine's aptitude, competence, and commitment to the unit's success above personal reward. Indicators are time and resource management, task prioritization, and tenacity to achieve positive ends consistently.",
                    gradeDescriptions: {
                        B: "Meets requirements of billet and additional duties. Aptitude, commitment, and competence meet expectations. Results maintain status quo.",
                        D: "Consistently produces quality results while measurably improving unit performance. Habitually makes effective use of time and resources; improves billet procedures and products. Positive impact extends beyond billet expectations.",
                        F: "Results far surpass expectations. Recognizes and exploits new resources; creates opportunities. Emulated; sought after as an expert with influence beyond unit. Impact significant; innovative approaches to problems produce significant gains in quality and efficiency."
                    }
                },
                proficiency: {
                    name: "Proficiency", 
                    description: "Demonstrates technical knowledge and practical skill in the execution of the Marine's overall duties. Combines training, education, and experience. Translates skills into actions which contribute to accomplishing tasks and missions. Imparts knowledge to others. Grade dependent.",
                    gradeDescriptions: {
                        B: "Competent. Possesses the requisite range of skills and knowledge commensurate with grade and experience. Understands and articulates basic functions related to mission accomplishment.",
                        D: "Demonstrates mastery of all required skills. Expertise, education and experience consistently enhance mission accomplishment. Innovative troubleshooter and problem solver. Effectively imparts skills to subordinates.",
                        F: "True expert in field. Knowledge and skills impact far beyond those of peers. Translates broad-based education and experience into forward thinking, innovative actions. Makes immeasurable impact on mission accomplishment. Peerless teacher, selflessly imparts expertise to subordinates, peers, and seniors."
                    }
                }
            }
        },
        E: {
            title: "Individual Character",
            traits: {
                courage: {
                    name: "Courage",
                    description: "Moral and physical strength to overcome danger, fear, difficulty or anxiety. Personal acceptance of responsibility and accountability, placing conscience over competing interests regardless of consequences. Conscious, overriding decision to risk bodily harm or death to accomplish the mission or save others. The will to persevere despite uncertainty.",
                    gradeDescriptions: {
                        B: "Demonstrates inner strength and acceptance of responsibility commensurate with scope of duties and experience. Willing to face moral or physical challenges in pursuit of mission accomplishment.",
                        D: "Guided by conscience in all actions. Proven ability to overcome danger, fear, difficulty or anxiety. Exhibits bravery in the face of adversity and uncertainty. Not deterred by morally difficult situations or hazardous responsibilities.",
                        F: "Uncommon bravery and capacity to overcome obstacles and inspire others in the face of moral dilemma or life-threatening danger. Demonstrated under the most adverse conditions. Selfless. Always places conscience over competing interests regardless of physical or personal consequences."
                    }
                },
                effectiveness_under_stress: {
                    name: "Effectiveness Under Stress",
                    description: "Thinking, functioning, and leading effectively under conditions of physical and/or mental pressure. Maintaining composure appropriate for the situation, while displaying steady purpose of action, enabling one to inspire others while continuing to lead under adverse conditions. Physical and emotional strength, resilience, and endurance are elements.",
                    gradeDescriptions: {
                        B: "Exhibits discipline and stability under pressure. Judgment and effective problem-solving skills are evident.",
                        D: "Consistently demonstrates maturity, mental agility and willpower during periods of adversity. Provides order to chaos through the application of intuition, problem-solving skills, and leadership. Composure reassures others.",
                        F: "Demonstrates seldom-matched presence of mind under the most demanding circumstances. Stabilizes any situation through the resolute and timely application of direction, focus and personal presence."
                    }
                },
                initiative: {
                    name: "Initiative",
                    description: "Action in the absence of specific direction. Seeing what needs to be done and acting without prompting. The instinct to begin a task and follow through energetically on one's own accord. Being creative, proactive and decisive. Transforming opportunity into action.",
                    gradeDescriptions: {
                        B: "Demonstrates willingness to take action in the absence of specific direction. Acts commensurate with grade, training and experience.",
                        D: "Self-motivated and action-oriented. Foresight and energy consistently transform opportunity into action. Develops and pursues creative, innovative solutions. Acts without prompting. Self-starter.",
                        F: "Highly motivated and proactive. Displays exceptional awareness of surroundings and environment. Uncanny ability to anticipate mission requirements and quickly formulate original, far-reaching solutions. Always takes decisive, effective action."
                    }
                }
            }
        },
        F: {
            title: "Leadership",
            traits: {
                leading_subordinates: {
                    name: "Leading Subordinates",
                    description: "The inseparable relationship between leader and led. The application of leadership principles to provide direction and motivate subordinates. Using authority, persuasion, and personality to influence subordinates to accomplish assigned tasks. Sustaining motivation and morale while maximizing subordinates' performance.",
                    gradeDescriptions: {
                        B: "Engaged; provides instructions and directs execution. Seeks to accomplish mission in ways that sustain motivation and morale. Actions contribute to unit effectiveness.",
                        D: "Achieves a highly effective balance between direction and delegation. Effectively tasks subordinates and clearly delineates standards expected. Enhances performance through constructive supervision. Fosters motivation and enhances morale. Builds and sustains teams that successfully meet mission requirements. Encourages initiative and candor among subordinates.",
                        F: "Promotes creativity and energy among subordinates by striking the ideal balance of direction and delegation. Achieves highest levels of performance from subordinates by encouraging individual initiative. Engenders willing subordination, loyalty, and trust that allow subordinates to overcome their perceived limitations. Personal leadership fosters highest levels of motivation and morale, ensuring mission accomplishment even in the most difficult circumstances."
                    }
                },
                developing_subordinates: {
                    name: "Developing Subordinates",
                    description: "Commitment to train, educate, and challenge all Marines regardless of race, religion, ethnic background, or gender. Mentorship. Cultivating professional and personal development of subordinates. Developing team players and esprit de corps. Ability to combine teaching and coaching. Creating an atmosphere tolerant of mistakes in the course of learning.",
                    gradeDescriptions: {
                        B: "Maintains an environment that allows personal and professional development. Ensures subordinates participate in all mandated development programs.",
                        D: "Develops and institutes innovative programs, to include PME, that emphasize personal and professional development of subordinates. Challenges subordinates to exceed their perceived potential thereby enhancing unit morale and effectiveness. Creates an environment where all Marines are confident to learn through trial and error. As a mentor, prepares subordinates for increased responsibilities and duties.",
                        F: "Widely recognized and emulated as a teacher, coach and leader. Any Marine would desire to serve with this Marine because they know they will grow personally and professionally. Subordinate and unit performance far surpassed expected results due to MRO's mentorship and team building talents. Attitude toward subordinate development is infectious, extending beyond the unit."
                    }
                },
                setting_example: {
                    name: "Setting the Example",
                    description: "The most visible facet of leadership: how well a Marine serves as a role model for all others. Personal action demonstrates the highest standards of conduct, appearance, and fitness. Bearing, demeanor, and self-discipline are elements.",
                    gradeDescriptions: {
                        B: "Maintains Marine Corps standards for appearance, weight, and uniform wear. Sustains required level of physical fitness. Adheres to the tenets of the Marine Corps core values.",
                        D: "Personal conduct on and off duty reflects highest Marine Corps standards of integrity, bearing and appearance. Character is exceptional. Actively seeks self-improvement in wide-ranging areas. Dedication to duty and professional example encourage others' self-improvement efforts.",
                        F: "Model Marine, frequently emulated. Exemplary conduct, behavior, and actions are tone-setting. An inspiration to subordinates, peers, and seniors. Remarkable dedication to improving self and others."
                    }
                },
                ensuring_wellbeing: {
                    name: "Ensuring Well-being of Subordinates",
                    description: "Genuine interest in the well-being of Marines. Efforts enhance subordinates' ability to concentrate/focus on unit mission accomplishment. Concern for family readiness is inherent. The importance placed on welfare of subordinates is based on the belief that Marines take care of their own.",
                    gradeDescriptions: {
                        B: "Deals confidently with issues pertinent to subordinate welfare and recognizes suitable courses of action that support subordinates' well-being. Applies available resources, allowing subordinates to effectively concentrate on the mission.",
                        D: "Instills and/or reinforces a sense of responsibility among junior Marines for themselves and their subordinates. Actively fosters the development of and uses support systems for subordinates which improve their ability to contribute to unit mission accomplishment. Efforts to enhance subordinate welfare improve the unit's ability to accomplish its mission.",
                        F: "Noticeably enhances subordinates well-being, resulting in a measurable increase in unit effectiveness. Maximizes unit and base resources to provide subordinates with the best support available. Proactive approach serves to energize unit members to 'take care of their own,' thereby correcting potential problems before they can hinder subordinates' effectiveness. Widely recognized for techniques and policies that produce results and build morale. Builds strong family atmosphere. Puts motto Mission first, Marines always, into action."
                    }
                },
                communication_skills: {
                    name: "Communication Skills",
                    description: "The efficient transmission and receipt of thoughts and ideas that enable and enhance leadership. Equal importance given to listening, speaking, writing, and critical reading skills. Interactive, allowing one to perceive problems and situations, provide concise guidance, and express complex ideas in a form easily understood by everyone. Allows subordinates to ask questions, raise issues and concerns and venture opinions. Contributes to a leader's ability to motivate as well as counsel.",
                    gradeDescriptions: {
                        B: "Skilled in receiving and conveying information. Communicates effectively in performance of duties.",
                        D: "Clearly articulates thoughts and ideas, verbally and in writing. Communication in all forms is accurate, intelligent, concise, and timely. Communicates with clarity and verve, ensuring understanding of intent or purpose. Encourages and considers the contributions of others.",
                        F: "Highly developed facility in verbal communication. Adept in composing written documents of the highest quality. Combines presence and verbal skills which engender confidence and achieve understanding irrespective of the setting, situation, or size of the group addressed. Displays an intuitive sense of when and how to listen."
                    }
                }
            }
        },
        G: {
            title: "Intellect and Wisdom",
            traits: {
                pme: {
                    name: "Professional Military Education (PME)",
                    description: "Commitment to intellectual growth in ways beneficial to the Marine Corps. Increases the breadth and depth of warfighting and leadership aptitude. Resources include resident schools; professional qualifications and certification processes; non-resident and other extension courses; civilian educational institution coursework; a personal reading program that includes selections from the Commandant's Reading List; participation in discussion groups and military societies; and involvement in learning through new technologies.",
                    gradeDescriptions: {
                        B: "Maintains currency in required military skills and related developments. Has completed or is enrolled in appropriate level of PME for grade and level of experience. Recognizes and understands new and creative approaches to service issues. Remains abreast of contemporary concepts and issues.",
                        D: "PME outlook extends beyond MOS and required education. Develops and follows a comprehensive personal program which includes broadened professional reading and/or academic course work; advances new concepts and ideas.",
                        F: "Dedicated to life-long learning. As a result of active and continuous efforts, widely recognized as an intellectual leader in professionally related topics. Makes time for study and takes advantage of all resources and programs. Introduces new and creative approaches to services issues. Engages in a broad spectrum of forums and dialogues."
                    }
                },
                decision_making: {
                    name: "Decision Making Ability",
                    description: "Viable and timely problem solution. Contributing elements are judgment and decisiveness. Decisions reflect the balance between an optimal solution and a satisfactory, workable solution that generates tempo. Decisions are made within the context of the commander's established intent and the goal of mission accomplishment. Anticipation, mental agility, intuition, and success are inherent.",
                    gradeDescriptions: {
                        B: "Makes sound decisions leading to mission accomplishment. Actively collects and evaluates information and weighs alternatives to achieve timely results. Confidently approaches problems; accepts responsibility for outcomes.",
                        D: "Demonstrates mental agility; effectively prioritizes and solves multiple complex problems. Analytical abilities enhanced by experience, education, and intuition. Anticipates problems and implements viable, long-term solutions. Steadfast, willing to make difficult decisions.",
                        F: "Widely recognized and sought after to resolve the most critical, complex problems. Seldom matched analytical and intuitive abilities; accurately foresees unexpected problems and arrives at well-timed decisions despite fog and friction. Completely confident approach to all problems. Masterfully strikes a balance between the desire for perfect knowledge and greater tempo."
                    }
                },
                judgment: {
                    name: "Judgment",
                    description: "The discretionary aspect of decision making. Draws on core values, knowledge, and personal experience to make wise choices. Comprehends the consequences of contemplated courses of action.",
                    gradeDescriptions: {
                        B: "Majority of judgments are measured, circumspect, relevant and correct.",
                        D: "Decisions are consistent and uniformly correct, tempered by consideration of their consequences. Able to identify, isolate and assess relevant factors in the decision making process. Opinions sought by others. Subordinates personal interest in favor of impartiality.",
                        F: "Decisions reflect exceptional insight and wisdom beyond this Marine's experience. Counsel sought by all; often an arbiter. Consistent, superior judgment inspires the confidence of seniors."
                    }
                }
            }
        },
        H: {
            title: "Fulfillment of Evaluation Responsibilities",
            traits: {
                evaluations: {
                    name: "Evaluations",
                    description: "The extent to which this officer serving as a reporting official conducted, or required others to conduct, accurate, uninflated, and timely evaluations.",
                    gradeDescriptions: {
                        B: "Occasionally submitted untimely or administratively incorrect evaluations. As RS, submitted one or more reports that contained inflated markings. As RO, concurred with one or more reports from subordinates that were returned by HQMC for inflated marking.",
                        D: "Prepared uninflated evaluations which were consistently submitted on time. Evaluations accurately described performance and character. Evaluations contained no inflated markings. No reports returned by RO or HQMC for inflated marking. No subordinates' reports returned by HQMC for inflated marking. Few, if any, reports were returned by RO or HQMC for administrative errors. Section Cs were void of superlatives. Justifications were specific, verifiable, substantive, and where possible, quantifiable and supported the markings given.",
                        F: "No reports submitted late. No reports returned by either RO or HQMC for administrative correction or inflated markings. No subordinates' reports returned by HQMC for administrative correction or inflated markings. Returned procedurally or administratively incorrect reports to subordinates for correction. As RO nonconcurred with all inflated reports."
                    }
                }
            }
        }
    },
    
    gradeDescriptions: {
        A: {
            description: "Performance is significantly below standards and requires immediate corrective action. Does not meet basic requirements of the billet.",
            class: "adverse"
        },
        B: {
            description: "Meets requirements of billet and additional duties. Aptitude, commitment, and competence meet expectations. Results maintain status quo.",
            class: "below-standards"
        },
        D: {
            description: "Consistently produces quality results while measurably improving unit performance. Habitually makes effective use of time and resources; improves billet procedures and products. Positive impact extends beyond billet expectations.",
            class: "acceptable"
        },
        F: {
            description: "Results far surpass expectations. Recognizes and exploits new resources; creates opportunities. Emulated; sought after as an expert with influence beyond unit. Impact significant; innovative approaches to problems produce significant gains in quality and efficiency.",
            class: "excellent"
        }
    }
};

// Enhanced FITREP Data with Examples
const enhancedFirepData = {
    ...firepData,
    examples: {
        D: {
            performance: {
                A: "Failed to complete assigned tasks, required constant supervision, consistently missed deadlines",
                B: "Completed all assigned duties adequately, met basic expectations and deadlines consistently",
                C: "Completed most duties with minimal supervision but showed limited initiative beyond requirements",
                D: "Exceeded expectations in daily tasks, improved unit procedures, and mentored junior Marines effectively",
                E: "Strong performance in most areas but occasionally fell short of exceptional standards",
                F: "Exceptional performance leading major initiatives, recognized by senior leadership for innovative solutions",
                G: "Outstanding performance exceeding all expectations, set new standards for unit excellence"
            },
            proficiency: {
                A: "Lacks basic technical skills required for position, requires extensive retraining",
                B: "Demonstrates competent technical knowledge and skills appropriate for grade and experience",
                C: "Shows basic proficiency with room for improvement in complex technical areas",
                D: "Strong technical expertise, effectively trains others and troubleshoots complex problems",
                E: "Good technical skills but not consistently at expert level in all required areas",
                F: "Technical expert sought after for complex problems, develops innovative solutions",
                G: "Exceptional technical mastery, recognized as subject matter expert by peers and seniors"
            }
        }
    }
};

// Data verification function
function verifyFirepData() {
    console.log('=== FITREP Data Verification ===');
    console.log('firepData object:', firepData);
    console.log('Number of sections:', Object.keys(firepData.sections).length);
    
    Object.keys(firepData.sections).forEach(sectionKey => {
        const section = firepData.sections[sectionKey];
        console.log(`Section ${sectionKey} (${section.title}):`, section);
        console.log(`  Traits in section ${sectionKey}:`, Object.keys(section.traits).length);
        
        Object.keys(section.traits).forEach(traitKey => {
            const trait = section.traits[traitKey];
            console.log(`    Trait ${traitKey}:`, trait.name);
            console.log(`      Has gradeDescriptions:`, !!trait.gradeDescriptions);
            if (trait.gradeDescriptions) {
                console.log(`      Grade levels available:`, Object.keys(trait.gradeDescriptions));
            }
        });
    });
    
    return firepData;
}

// Run verification when file loads
console.log('data.js loaded successfully');
verifyFirepData();