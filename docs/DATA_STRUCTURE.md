# Complete Evaluation Data Structure

## Overview

This document details the complete data structure saved to GitHub for each user profile and evaluation. All fields mentioned in the requirements are captured and persisted.

## GitHub Repository File Structure

```
SemperAdmin/Fitness-Report-Evaluator-Data/
└── users/
    ├── john_smith.json
    ├── jane_doe.json
    └── ...
```

## Complete User Data File Format

### Root Structure

```json
{
  "version": "1.0",
  "lastUpdated": "2025-01-15T10:30:00.000Z",
  "profile": { /* Profile metadata */ },
  "evaluations": [ /* Array of evaluation objects */ ],
  "metadata": { /* Export metadata */ }
}
```

### Profile Object

```json
"profile": {
  "rsName": "Smith, John A",
  "rsEmail": "john.smith@usmc.mil",
  "rsRank": "Capt",
  "totalEvaluations": 5
}
```

### Evaluation Object (Complete)

Each evaluation in the `evaluations` array contains:

```json
{
  "evaluationId": "eval-2025-01-15T12-00-00",

  // Reporting Senior Information
  "rsInfo": {
    "name": "Smith, John A",
    "email": "john.smith@usmc.mil",
    "rank": "Capt"
  },

  // Marine Being Evaluated
  "marineInfo": {
    "name": "Doe, Jane M",              // ✓ Marine Name
    "rank": "SSgt",                      // ✓ Marine Rank
    "evaluationPeriod": {
      "from": "2023-06-01",
      "to": "2024-05-31"                 // ✓ Ending Date
    }
  },

  // Evaluation Details
  "occasion": "annual",                  // ✓ Occasion Type
  "completedDate": "2024-01-15T12:00:00.000Z",
  "fitrepAverage": "4.85",               // Calculated (not stored separately)

  // Trait Evaluations with Grades and Justifications
  "traitEvaluations": {
    "D_performance": {
      "section": "Mission Accomplishment",
      "trait": "Performance",            // ✓ Trait Name
      "grade": "D",                      // ✓ Letter Grade
      "gradeNumber": 4,                  // ✓ Numeric Grade
      "justification": "Consistently exceeded expectations in all assigned duties. Led team of 12 Marines in successful completion of..."
                                         // ✓ Detailed Justification
    },
    "D_proficiency": {
      "section": "Mission Accomplishment",
      "trait": "Proficiency",            // ✓ Proficiency
      "grade": "F",
      "gradeNumber": 5,
      "justification": "Demonstrated exceptional technical expertise..."
    },
    "E_courage": {
      "section": "Individual Character",
      "trait": "Courage",                // ✓ Courage
      "grade": "D",
      "gradeNumber": 4,
      "justification": "Displayed moral courage by..."
    },
    "E_effectiveness_under_stress": {
      "section": "Individual Character",
      "trait": "Effectiveness Under Stress", // ✓ Stress Tolerance
      "grade": "D",
      "gradeNumber": 4,
      "justification": "Maintained composure during..."
    },
    "E_initiative": {
      "section": "Individual Character",
      "trait": "Initiative",             // ✓ Initiative
      "grade": "F",
      "gradeNumber": 5,
      "justification": "Proactively identified and resolved..."
    },
    "F_leading_subordinates": {
      "section": "Leadership",
      "trait": "Leading Subordinates",   // ✓ Leading
      "grade": "D",
      "gradeNumber": 4,
      "justification": "Effectively led squad of 8 Marines..."
    },
    "F_developing_subordinates": {
      "section": "Leadership",
      "trait": "Developing Subordinates", // ✓ Developing Others
      "grade": "D",
      "gradeNumber": 4,
      "justification": "Mentored junior Marines, resulting in..."
    },
    "F_setting_example": {
      "section": "Leadership",
      "trait": "Setting the Example",    // ✓ Setting Example
      "grade": "F",
      "gradeNumber": 5,
      "justification": "Model Marine in appearance, conduct..."
    },
    "F_ensuring_wellbeing": {
      "section": "Leadership",
      "trait": "Ensuring Well-being of Subordinates", // ✓ Well-Being
      "grade": "D",
      "gradeNumber": 4,
      "justification": "Prioritized Marine welfare..."
    },
    "F_communication_skills": {
      "section": "Leadership",
      "trait": "Communication Skills",   // ✓ Communication Skills
      "grade": "D",
      "gradeNumber": 4,
      "justification": "Clear and concise in written and verbal..."
    },
    "G_pme": {
      "section": "Intellect and Wisdom",
      "trait": "Professional Military Education (PME)", // ✓ PME
      "grade": "D",
      "gradeNumber": 4,
      "justification": "Completed required PME ahead of schedule..."
    },
    "G_decision_making": {
      "section": "Intellect and Wisdom",
      "trait": "Decision Making Ability", // ✓ Decision Making
      "grade": "D",
      "gradeNumber": 4,
      "justification": "Made sound tactical decisions under pressure..."
    },
    "G_judgment": {
      "section": "Intellect and Wisdom",
      "trait": "Judgment",               // ✓ Judgement
      "grade": "F",
      "gradeNumber": 5,
      "justification": "Exceptional judgment in complex situations..."
    },
    "H_evaluations": {                   // Optional Section H
      "section": "Fulfillment of Evaluation Responsibilities",
      "trait": "Evaluations",
      "grade": "D",
      "gradeNumber": 4,
      "justification": "Submitted accurate, timely evaluations..."
    }
  },

  // Section I Comments
  "sectionIComments": "SSgt Doe is an outstanding Marine who consistently demonstrates exceptional leadership and technical proficiency. Her dedication to mission accomplishment and subordinate development make her a valuable asset to the unit. Strongly recommended for promotion and increased responsibility.",
                                         // ✓ Section I Comments

  // Directed Comments (if applicable)
  "directedComments": "Combat deployment to [location] from [date] to [date]...",

  // Metadata
  "savedToProfile": true,
  "syncStatus": "synced"
}
```

## Field Mapping to Requirements

### Required Data Fields (All Captured ✓)

| Requirement | Location in Data Structure | Example Value |
|-------------|---------------------------|---------------|
| Marine Name | `marineInfo.name` | "Doe, Jane M" |
| Marine Rank | `marineInfo.rank` | "SSgt" |
| Occasion | `occasion` | "annual" |
| Ending Date | `marineInfo.evaluationPeriod.to` | "2024-05-31" |
| Performance | `traitEvaluations.D_performance.grade` | "D" |
| Proficiency | `traitEvaluations.D_proficiency.grade` | "F" |
| Courage | `traitEvaluations.E_courage.grade` | "D" |
| Stress Tolerance | `traitEvaluations.E_effectiveness_under_stress.grade` | "D" |
| Initiative | `traitEvaluations.E_initiative.grade` | "F" |
| Leading | `traitEvaluations.F_leading_subordinates.grade` | "D" |
| Developing Others | `traitEvaluations.F_developing_subordinates.grade` | "D" |
| Setting Example | `traitEvaluations.F_setting_example.grade` | "F" |
| Well-Being | `traitEvaluations.F_ensuring_wellbeing.grade` | "D" |
| Communication Skills | `traitEvaluations.F_communication_skills.grade` | "D" |
| PME | `traitEvaluations.G_pme.grade` | "D" |
| Decision Making | `traitEvaluations.G_decision_making.grade` | "D" |
| Judgement | `traitEvaluations.G_judgment.grade` | "F" |
| Section I Comments | `sectionIComments` | "SSgt Doe is an outstanding..." |
| Justifications | `traitEvaluations[trait].justification` | "Consistently exceeded expectations..." |

### Calculated Fields (Not Stored)

These fields are calculated on-demand from the stored data:

| Field | Calculation Method | Source Data |
|-------|-------------------|-------------|
| # (Rank) | `COUNTIFS(Cum RV > current) + 1` | All evaluations' Cumulative RV |
| Avg | `SUM(gradeNumbers) / COUNT(traits)` | `traitEvaluations[].gradeNumber` |
| RV | Relative Value formula | All evaluations' averages |
| Cum RV | Running average of RVs | Historical RV values |

## Trait Evaluation Detail Structure

Each trait evaluation contains:

```json
{
  "section": "Section Name",           // E.g., "Mission Accomplishment"
  "trait": "Trait Name",                // E.g., "Performance"
  "grade": "Letter Grade",              // A, B, C, D, E, F, G
  "gradeNumber": "Numeric Value",       // 1-7 scale
  "justification": "Detailed text..."   // Specific examples and evidence
}
```

## Complete Example File

```json
{
  "version": "1.0",
  "lastUpdated": "2025-01-15T10:30:00.000Z",
  "profile": {
    "rsName": "Smith, John A",
    "rsEmail": "john.smith@usmc.mil",
    "rsRank": "Capt",
    "totalEvaluations": 5
  },
  "evaluations": [
    {
      "evaluationId": "eval-2025-01-15T12-00-00",
      "rsInfo": {
        "name": "Smith, John A",
        "email": "john.smith@usmc.mil",
        "rank": "Capt"
      },
      "marineInfo": {
        "name": "Doe, Jane M",
        "rank": "SSgt",
        "evaluationPeriod": {
          "from": "2023-06-01",
          "to": "2024-05-31"
        }
      },
      "occasion": "annual",
      "completedDate": "2024-01-15T12:00:00.000Z",
      "fitrepAverage": "4.85",
      "traitEvaluations": {
        "D_performance": {
          "section": "Mission Accomplishment",
          "trait": "Performance",
          "grade": "D",
          "gradeNumber": 4,
          "justification": "Consistently exceeded expectations in all assigned duties. Led team of 12 Marines in successful completion of unit training objectives, achieving 98% proficiency rate. Streamlined maintenance procedures, reducing equipment downtime by 30%. Managed $2.5M in equipment with zero losses."
        },
        "D_proficiency": {
          "section": "Mission Accomplishment",
          "trait": "Proficiency",
          "grade": "F",
          "gradeNumber": 5,
          "justification": "Demonstrated exceptional technical expertise across all MOS requirements. Qualified expert on all unit weapon systems. Served as primary instructor for junior Marines, achieving 100% qualification rate. Recognized as SME by senior leadership."
        }
        // ... (all 13-14 traits with complete data)
      },
      "sectionIComments": "SSgt Doe is an outstanding Marine who consistently demonstrates exceptional leadership and technical proficiency. Her dedication to mission accomplishment and subordinate development make her a valuable asset to the unit. During this reporting period, she led numerous critical operations and mentored 8 junior Marines to successful promotion. Strongly recommended for promotion to GySgt and assignment to positions of increased responsibility.",
      "directedComments": "",
      "savedToProfile": true,
      "syncStatus": "synced"
    }
    // ... (more evaluations)
  ],
  "metadata": {
    "exportedAt": "2025-01-15T10:30:00.000Z",
    "exportedBy": "Smith, John A",
    "applicationVersion": "1.0"
  }
}
```

## Data Access Examples

### Accessing Marine Information

```javascript
const marine = evaluation.marineInfo;
console.log(marine.name);                    // "Doe, Jane M"
console.log(marine.rank);                    // "SSgt"
console.log(marine.evaluationPeriod.to);     // "2024-05-31"
```

### Accessing Trait Grades

```javascript
const traits = evaluation.traitEvaluations;

// Get Performance grade
console.log(traits.D_performance.grade);              // "D"
console.log(traits.D_performance.gradeNumber);        // 4
console.log(traits.D_performance.justification);      // Full text

// Iterate all traits
Object.values(traits).forEach(trait => {
    console.log(`${trait.trait}: ${trait.grade} - ${trait.justification}`);
});
```

### Accessing Section I Comments

```javascript
console.log(evaluation.sectionIComments);
// "SSgt Doe is an outstanding Marine..."
```

## Data Integrity Verification

### All Required Fields Present

✅ Marine Name (`marineInfo.name`)
✅ Marine Rank (`marineInfo.rank`)
✅ Occasion (`occasion`)
✅ Ending Date (`marineInfo.evaluationPeriod.to`)
✅ All 13-14 Trait Grades (`traitEvaluations[].grade`)
✅ All Trait Justifications (`traitEvaluations[].justification`)
✅ Section I Comments (`sectionIComments`)

### Calculated Fields

These are computed on-demand, not stored:

- **#** (Rank): Calculated from Cumulative RV comparison
- **Avg**: Calculated from `SUM(gradeNumbers) / COUNT(traits)`
- **RV**: Calculated using relative value formula
- **Cum RV**: Calculated as running average of RVs

## Summary

**All required data fields are captured and persisted to GitHub:**

1. ✅ **Marine Identification**: Name and Rank
2. ✅ **Evaluation Context**: Occasion and Ending Date
3. ✅ **All 13-14 Traits**: Complete grade data (letter and numeric)
4. ✅ **Justifications**: Detailed text for each trait
5. ✅ **Section I Comments**: Narrative evaluation summary
6. ✅ **Directed Comments**: When applicable

**Calculated fields (Avg, RV, Cum RV, Rank #) are computed from stored data and do not need to be saved separately.**

The data structure is comprehensive, complete, and ready for long-term storage and analysis.
