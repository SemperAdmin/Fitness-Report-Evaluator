/**
 * Rank and unit data for military personnel
 */

const MilitaryData = {
    // Marine Corps Ranks
    USMC: {
        enlisted: [
            { value: 'Pvt', label: 'Private (Pvt)' },
            { value: 'PFC', label: 'Private First Class (PFC)' },
            { value: 'LCpl', label: 'Lance Corporal (LCpl)' },
            { value: 'Cpl', label: 'Corporal (Cpl)' },
            { value: 'Sgt', label: 'Sergeant (Sgt)' },
            { value: 'SSgt', label: 'Staff Sergeant (SSgt)' },
            { value: 'GySgt', label: 'Gunnery Sergeant (GySgt)' },
            { value: 'MSgt', label: 'Master Sergeant (MSgt)' },
            { value: 'MGySgt', label: 'Master Gunnery Sergeant (MGySgt)' },
            { value: 'SgtMaj', label: 'Sergeant Major (SgtMaj)' }
        ],
        officer: [
            { value: '2ndLt', label: 'Second Lieutenant (2ndLt)' },
            { value: '1stLt', label: 'First Lieutenant (1stLt)' },
            { value: 'Capt', label: 'Captain (Capt)' },
            { value: 'Maj', label: 'Major (Maj)' },
            { value: 'LtCol', label: 'Lieutenant Colonel (LtCol)' },
            { value: 'Col', label: 'Colonel (Col)' },
            { value: 'BGen', label: 'Brigadier General (BGen)' },
            { value: 'MajGen', label: 'Major General (MajGen)' },
            { value: 'LtGen', label: 'Lieutenant General (LtGen)' },
            { value: 'Gen', label: 'General (Gen)' }
        ],
        warrant: [
            { value: 'WO1', label: 'Warrant Officer 1 (WO1)' },
            { value: 'CWO2', label: 'Chief Warrant Officer 2 (CWO2)' },
            { value: 'CWO3', label: 'Chief Warrant Officer 3 (CWO3)' },
            { value: 'CWO4', label: 'Chief Warrant Officer 4 (CWO4)' },
            { value: 'CWO5', label: 'Chief Warrant Officer 5 (CWO5)' }
        ]
    },

    // Army Ranks
    USA: {
        enlisted: [
            { value: 'PV1', label: 'Private (PV1)' },
            { value: 'PV2', label: 'Private (PV2)' },
            { value: 'PFC', label: 'Private First Class (PFC)' },
            { value: 'SPC', label: 'Specialist (SPC)' },
            { value: 'CPL', label: 'Corporal (CPL)' },
            { value: 'SGT', label: 'Sergeant (SGT)' },
            { value: 'SSG', label: 'Staff Sergeant (SSG)' },
            { value: 'SFC', label: 'Sergeant First Class (SFC)' },
            { value: 'MSG', label: 'Master Sergeant (MSG)' },
            { value: '1SG', label: 'First Sergeant (1SG)' },
            { value: 'SGM', label: 'Sergeant Major (SGM)' },
            { value: 'CSM', label: 'Command Sergeant Major (CSM)' }
        ],
        officer: [
            { value: '2LT', label: 'Second Lieutenant (2LT)' },
            { value: '1LT', label: 'First Lieutenant (1LT)' },
            { value: 'CPT', label: 'Captain (CPT)' },
            { value: 'MAJ', label: 'Major (MAJ)' },
            { value: 'LTC', label: 'Lieutenant Colonel (LTC)' },
            { value: 'COL', label: 'Colonel (COL)' },
            { value: 'BG', label: 'Brigadier General (BG)' },
            { value: 'MG', label: 'Major General (MG)' },
            { value: 'LTG', label: 'Lieutenant General (LTG)' },
            { value: 'GEN', label: 'General (GEN)' }
        ],
        warrant: [
            { value: 'WO1', label: 'Warrant Officer 1 (WO1)' },
            { value: 'CW2', label: 'Chief Warrant Officer 2 (CW2)' },
            { value: 'CW3', label: 'Chief Warrant Officer 3 (CW3)' },
            { value: 'CW4', label: 'Chief Warrant Officer 4 (CW4)' },
            { value: 'CW5', label: 'Chief Warrant Officer 5 (CW5)' }
        ]
    },

    // Navy Ranks
    USN: {
        enlisted: [
            { value: 'SR', label: 'Seaman Recruit (SR)' },
            { value: 'SA', label: 'Seaman Apprentice (SA)' },
            { value: 'SN', label: 'Seaman (SN)' },
            { value: 'PO3', label: 'Petty Officer Third Class (PO3)' },
            { value: 'PO2', label: 'Petty Officer Second Class (PO2)' },
            { value: 'PO1', label: 'Petty Officer First Class (PO1)' },
            { value: 'CPO', label: 'Chief Petty Officer (CPO)' },
            { value: 'SCPO', label: 'Senior Chief Petty Officer (SCPO)' },
            { value: 'MCPO', label: 'Master Chief Petty Officer (MCPO)' }
        ],
        officer: [
            { value: 'ENS', label: 'Ensign (ENS)' },
            { value: 'LTJG', label: 'Lieutenant Junior Grade (LTJG)' },
            { value: 'LT', label: 'Lieutenant (LT)' },
            { value: 'LCDR', label: 'Lieutenant Commander (LCDR)' },
            { value: 'CDR', label: 'Commander (CDR)' },
            { value: 'CAPT', label: 'Captain (CAPT)' },
            { value: 'RDML', label: 'Rear Admiral Lower Half (RDML)' },
            { value: 'RADM', label: 'Rear Admiral (RADM)' },
            { value: 'VADM', label: 'Vice Admiral (VADM)' },
            { value: 'ADM', label: 'Admiral (ADM)' }
        ],
        warrant: [
            { value: 'WO1', label: 'Warrant Officer 1 (WO1)' },
            { value: 'CWO2', label: 'Chief Warrant Officer 2 (CWO2)' },
            { value: 'CWO3', label: 'Chief Warrant Officer 3 (CWO3)' },
            { value: 'CWO4', label: 'Chief Warrant Officer 4 (CWO4)' },
            { value: 'CWO5', label: 'Chief Warrant Officer 5 (CWO5)' }
        ]
    },

    // Air Force Ranks
    USAF: {
        enlisted: [
            { value: 'AB', label: 'Airman Basic (AB)' },
            { value: 'Amn', label: 'Airman (Amn)' },
            { value: 'A1C', label: 'Airman First Class (A1C)' },
            { value: 'SrA', label: 'Senior Airman (SrA)' },
            { value: 'SSgt', label: 'Staff Sergeant (SSgt)' },
            { value: 'TSgt', label: 'Technical Sergeant (TSgt)' },
            { value: 'MSgt', label: 'Master Sergeant (MSgt)' },
            { value: 'SMSgt', label: 'Senior Master Sergeant (SMSgt)' },
            { value: 'CMSgt', label: 'Chief Master Sergeant (CMSgt)' }
        ],
        officer: [
            { value: '2d Lt', label: 'Second Lieutenant (2d Lt)' },
            { value: '1st Lt', label: 'First Lieutenant (1st Lt)' },
            { value: 'Capt', label: 'Captain (Capt)' },
            { value: 'Maj', label: 'Major (Maj)' },
            { value: 'Lt Col', label: 'Lieutenant Colonel (Lt Col)' },
            { value: 'Col', label: 'Colonel (Col)' },
            { value: 'Brig Gen', label: 'Brigadier General (Brig Gen)' },
            { value: 'Maj Gen', label: 'Major General (Maj Gen)' },
            { value: 'Lt Gen', label: 'Lieutenant General (Lt Gen)' },
            { value: 'Gen', label: 'General (Gen)' }
        ],
        warrant: []
    },

    // Coast Guard Ranks (same as Navy)
    USCG: {
        enlisted: [
            { value: 'SR', label: 'Seaman Recruit (SR)' },
            { value: 'SA', label: 'Seaman Apprentice (SA)' },
            { value: 'SN', label: 'Seaman (SN)' },
            { value: 'PO3', label: 'Petty Officer Third Class (PO3)' },
            { value: 'PO2', label: 'Petty Officer Second Class (PO2)' },
            { value: 'PO1', label: 'Petty Officer First Class (PO1)' },
            { value: 'CPO', label: 'Chief Petty Officer (CPO)' },
            { value: 'SCPO', label: 'Senior Chief Petty Officer (SCPO)' },
            { value: 'MCPO', label: 'Master Chief Petty Officer (MCPO)' }
        ],
        officer: [
            { value: 'ENS', label: 'Ensign (ENS)' },
            { value: 'LTJG', label: 'Lieutenant Junior Grade (LTJG)' },
            { value: 'LT', label: 'Lieutenant (LT)' },
            { value: 'LCDR', label: 'Lieutenant Commander (LCDR)' },
            { value: 'CDR', label: 'Commander (CDR)' },
            { value: 'CAPT', label: 'Captain (CAPT)' },
            { value: 'RDML', label: 'Rear Admiral Lower Half (RDML)' },
            { value: 'RADM', label: 'Rear Admiral (RADM)' },
            { value: 'VADM', label: 'Vice Admiral (VADM)' },
            { value: 'ADM', label: 'Admiral (ADM)' }
        ],
        warrant: [
            { value: 'WO1', label: 'Warrant Officer 1 (WO1)' },
            { value: 'CWO2', label: 'Chief Warrant Officer 2 (CWO2)' },
            { value: 'CWO3', label: 'Chief Warrant Officer 3 (CWO3)' },
            { value: 'CWO4', label: 'Chief Warrant Officer 4 (CWO4)' }
        ]
    },

    // Space Force Ranks (same as Air Force)
    USSF: {
        enlisted: [
            { value: 'Spc1', label: 'Specialist 1 (Spc1)' },
            { value: 'Spc2', label: 'Specialist 2 (Spc2)' },
            { value: 'Spc3', label: 'Specialist 3 (Spc3)' },
            { value: 'Spc4', label: 'Specialist 4 (Spc4)' },
            { value: 'Sgt', label: 'Sergeant (Sgt)' },
            { value: 'TSgt', label: 'Technical Sergeant (TSgt)' },
            { value: 'MSgt', label: 'Master Sergeant (MSgt)' },
            { value: 'SMSgt', label: 'Senior Master Sergeant (SMSgt)' },
            { value: 'CMSgt', label: 'Chief Master Sergeant (CMSgt)' }
        ],
        officer: [
            { value: '2d Lt', label: 'Second Lieutenant (2d Lt)' },
            { value: '1st Lt', label: 'First Lieutenant (1st Lt)' },
            { value: 'Capt', label: 'Captain (Capt)' },
            { value: 'Maj', label: 'Major (Maj)' },
            { value: 'Lt Col', label: 'Lieutenant Colonel (Lt Col)' },
            { value: 'Col', label: 'Colonel (Col)' },
            { value: 'Brig Gen', label: 'Brigadier General (Brig Gen)' },
            { value: 'Maj Gen', label: 'Major General (Maj Gen)' },
            { value: 'Lt Gen', label: 'Lieutenant General (Lt Gen)' },
            { value: 'Gen', label: 'General (Gen)' }
        ],
        warrant: []
    },

    // Maintain backward compatibility
    marineCorps: null, // Will be set below

    // Common military branches
    branches: [
        { value: 'USMC', label: 'United States Marine Corps' },
        { value: 'USA', label: 'United States Army' },
        { value: 'USN', label: 'United States Navy' },
        { value: 'USAF', label: 'United States Air Force' },
        { value: 'USCG', label: 'United States Coast Guard' },
        { value: 'USSF', label: 'United States Space Force' },
        { value: 'Civilian', label: 'Civilian' },
        { value: 'Other', label: 'Other' }
    ],

    // Get ranks for a specific branch
    getRanksForBranch(branchValue) {
        const branchData = this[branchValue];
        if (!branchData) return [];

        const ranks = [];
        if (branchData.officer && branchData.officer.length > 0) {
            ranks.push(...branchData.officer);
        }
        if (branchData.warrant && branchData.warrant.length > 0) {
            ranks.push(...branchData.warrant);
        }
        if (branchData.enlisted && branchData.enlisted.length > 0) {
            ranks.push(...branchData.enlisted);
        }
        return ranks;
    },

    // Get all ranks combined (from all branches)
    // Get all ranks combined (from all branches)
    getAllRanks() {
        const all = [];
        ['USMC', 'USA', 'USN', 'USAF', 'USCG', 'USSF'].forEach(branch => {
            if (this[branch]) {
                if (this[branch].enlisted) all.push(...this[branch].enlisted);
                if (this[branch].officer) all.push(...this[branch].officer);
                if (this[branch].warrant) all.push(...this[branch].warrant);
            }
        });
        return all;
    },

    // Get rank display with proper formatting
    formatRank(rankValue) {
        // Search all branches for the rank
        for (const branchKey of ['USMC', 'USA', 'USN', 'USAF', 'USCG', 'USSF']) {
            const branchData = this[branchKey];
            if (branchData) {
                const allRanks = [
                    ...(branchData.enlisted || []),
                    ...(branchData.officer || []),
                    ...(branchData.warrant || [])
                ];
                const rank = allRanks.find(r => r.value === rankValue);
                if (rank) return rank.label;
            }
        }
        return rankValue;
    },

    // Sort RSVPs by rank (protocol order)
    sortByRank(rsvps) {
        const rankOrder = this.getAllRanks().map(r => r.value);

        return rsvps.sort((a, b) => {
            const aIndex = rankOrder.indexOf(a.rank);
            const bIndex = rankOrder.indexOf(b.rank);

            // If ranks not in our list, put them at the end
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;

            // Higher ranks (lower index) come first
            return aIndex - bIndex;
        });
    }
};

// Maintain backward compatibility
MilitaryData.marineCorps = MilitaryData.USMC;

// Make available globally or export module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MilitaryData;
} else {
    window.MilitaryData = MilitaryData;
}
