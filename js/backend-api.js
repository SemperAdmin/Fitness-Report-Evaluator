class BackendAPI {
    constructor() {
        this.owner = 'SemperAdmin';
        // Target the current repo hosting the workflows
        this.repo = 'Fitness-Report-Evaluator';
        this.apiBase = 'https://api.github.com';
    }

    async triggerWorkflow(eventType, payload) {
        const url = this.apiBase + '/repos/' + this.owner + '/' + this.repo + '/dispatches';

        // Get token from GITHUB_CONFIG
        const token = window.GITHUB_CONFIG && window.GITHUB_CONFIG.token ? window.GITHUB_CONFIG.token : null;

        if (!token) {
            throw new Error('GitHub token not available for workflow trigger');
        }

        try {
            console.log('Triggering workflow:', eventType);
            console.log('Payload size:', JSON.stringify(payload).length, 'bytes');

            // Shape client_payload to match workflow expectations
            let clientPayload;
            if (eventType === 'save-user-data') {
                clientPayload = { userData: payload };
            } else if (eventType === 'create-user') {
                // Accept either {user} or plain user object
                clientPayload = { user: payload.user ? payload.user : payload };
            } else {
                // Default wrapper for other events
                clientPayload = { data: payload, sentAt: Date.now(), source: 'Fitrep-App' };
            }

            const requestBody = {
                event_type: eventType,
                client_payload: clientPayload
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                // Try to get error details from response
                let errorMessage = 'Workflow dispatch failed: ' + response.status;
                try {
                    const errorData = await response.json();
                    console.error('GitHub API Error Details:', errorData);
                    errorMessage = errorData.message || errorMessage;
                    if (errorData.errors) {
                        console.error('Validation Errors:', errorData.errors);
                        errorMessage += ' - ' + JSON.stringify(errorData.errors);
                    }
                } catch (parseError) {
                    console.error('Could not parse error response');
                }
                throw new Error(errorMessage);
            }

            console.log('✅ Workflow triggered successfully');
            return { success: true };

        } catch (error) {
            console.error('Workflow trigger error:', error);
            throw error;
        }
    }

    /**
     * Dispatch save-user-data workflow (dev/testing helper)
     * Matches server fallback event_type 'save-user-data'
     * @param {Object} userData - user profile and evaluations
     */
    async saveUserDataViaWorkflow(userData) {
        return this.triggerWorkflow('save-user-data', userData);
    }

    /**
     * Dispatch create-user workflow (dev/testing helper)
     * NOTE: Server normally handles hashing; use this only when
     * workflows are designed to hash or when providing a pre-hashed value.
     * @param {Object} user - { rsName, rsEmail, rsRank, passwordHash? }
     */
    async createUserViaWorkflow(user) {
        return this.triggerWorkflow('create-user', user);
    }

    async submitRSVP(rsvpData) {
        console.log('Submitting RSVP with data:', rsvpData);

        // Pass through all RSVP data - the backend/GitHub Action will handle sanitization
        // This ensures we don't lose any fields during submission
        const payload = {
            eventId: String(rsvpData.eventId || '').trim(),
            rsvpId: rsvpData.rsvpId || '',
            name: String(rsvpData.name || '').trim(),
            email: String(rsvpData.email || '').trim().toLowerCase(),
            phone: String(rsvpData.phone || '').trim(),
            attending: rsvpData.attending,
            guestCount: parseInt(rsvpData.guestCount, 10) || 0,
            reason: String(rsvpData.reason || '').trim(),
            rank: String(rsvpData.rank || '').trim(),
            unit: String(rsvpData.unit || '').trim(),
            branch: String(rsvpData.branch || '').trim(),
            dietaryRestrictions: rsvpData.dietaryRestrictions || [],
            allergyDetails: String(rsvpData.allergyDetails || '').trim(),
            customAnswers: rsvpData.customAnswers || {},
            timestamp: rsvpData.timestamp || Date.now(),
            validationHash: rsvpData.validationHash || '',
            submissionMethod: rsvpData.submissionMethod || 'secure_backend',
            userAgent: rsvpData.userAgent || '',
            checkInToken: rsvpData.checkInToken || '',
            editToken: rsvpData.editToken || '',
            isUpdate: rsvpData.isUpdate || false,
            lastModified: rsvpData.lastModified || null
        };

        if (!payload.eventId || !payload.name || !payload.email) {
            throw new Error('Missing required fields: eventId, name, or email');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
            throw new Error('Invalid email format');
        }

        console.log('Submitting RSVP payload with guestCount:', payload.guestCount);

        // Try workflow dispatch first, fall back to GitHub Issues if it fails
        try {
            return await this.triggerWorkflow('submit_rsvp', payload);
        } catch (workflowError) {
            console.warn('Workflow dispatch failed, trying GitHub Issues fallback:', workflowError.message);
            return await this.submitRSVPViaIssue(payload);
        }
    }

    async submitRSVPViaIssue(rsvpData) {
        console.log('Submitting RSVP via GitHub Issue...');

        const token = window.GITHUB_CONFIG && window.GITHUB_CONFIG.token ? window.GITHUB_CONFIG.token : null;

        if (!token) {
            throw new Error('GitHub token not available');
        }

        // Format RSVP data for issue body
        const issueTitle = `RSVP: ${rsvpData.name} - ${rsvpData.attending ? 'Attending' : 'Not Attending'}`;
        const issueBody = `
## RSVP Submission

**Event ID:** ${rsvpData.eventId}
**RSVP ID:** ${rsvpData.rsvpId}
**Name:** ${rsvpData.name}
**Email:** ${rsvpData.email}
**Phone:** ${rsvpData.phone || 'Not provided'}
**Attending:** ${rsvpData.attending ? '✅ Yes' : '❌ No'}
**Guest Count:** ${rsvpData.guestCount}

${rsvpData.rank || rsvpData.unit || rsvpData.branch ? `### Military Information
${rsvpData.rank ? `**Rank:** ${rsvpData.rank}\n` : ''}${rsvpData.unit ? `**Unit:** ${rsvpData.unit}\n` : ''}${rsvpData.branch ? `**Branch:** ${rsvpData.branch}\n` : ''}` : ''}

${rsvpData.reason ? `**Reason:** ${rsvpData.reason}\n\n` : ''}${rsvpData.allergyDetails ? `**Allergy Details:** ${rsvpData.allergyDetails}\n\n` : ''}
---
**Timestamp:** ${new Date(rsvpData.timestamp).toISOString()}
**Validation Hash:** ${rsvpData.validationHash}
**Submission Method:** github_issue_fallback

\`\`\`json
${JSON.stringify(rsvpData, null, 2)}
\`\`\`
`;

        try {
            const response = await fetch(`${this.apiBase}/repos/${this.owner}/${this.repo}/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: issueTitle,
                    body: issueBody,
                    labels: ['rsvp', 'automated', rsvpData.attending ? 'attending' : 'not-attending']
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('GitHub Issue creation failed:', errorData);
                throw new Error(`GitHub Issue creation failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
            }

            const issueData = await response.json();
            console.log('✅ RSVP submitted via GitHub Issue:', issueData.number);

            return {
                success: true,
                method: 'github_issue',
                issueNumber: issueData.number,
                issueUrl: issueData.html_url
            };

        } catch (error) {
            console.error('Failed to submit RSVP via GitHub Issue:', error);
            throw error;
        }
    }

    async createEvent(eventData) {
        console.log('Creating event via workflow...');

        // Get manager token and info
        const token = window.GITHUB_CONFIG && window.GITHUB_CONFIG.token ? window.GITHUB_CONFIG.token : null;
        const managerEmail = window.managerAuth && window.managerAuth.getCurrentManager()
            ? window.managerAuth.getCurrentManager().email
            : 'unknown';

        if (!token) {
            throw new Error('Manager token required to create event');
        }

        // Prepare event payload for workflow
        const payload = {
        id: eventData.id,
        title: String(eventData.title || '').trim(),
        description: String(eventData.description || '').trim().substring(0, 500),
        date: String(eventData.date || '').trim(),
        time: String(eventData.time || '').trim(),
        location: String(eventData.location || '').trim().substring(0, 200),
        coverImage: eventData.coverImage ? 'yes' : 'no',
        askReason: Boolean(eventData.askReason),
        allowGuests: Boolean(eventData.allowGuests),
        requiresMealChoice: Boolean(eventData.requiresMealChoice),
        customQuestionsCount: (eventData.customQuestions || []).length,
        managerEmail: managerEmail,
        createdBy: managerEmail,
        createdByName: eventData.createdByName || managerEmail.split('@')[0],
        created: eventData.created || Date.now(),
        status: 'active'
    };

        if (!payload.title || !payload.date || !payload.time) {
            throw new Error('Missing required event fields');
        }

        return await this.triggerWorkflow('create_event', payload);
    }
}

if (typeof window !== 'undefined') {
    window.BackendAPI = new BackendAPI();
    console.log('Backend API loaded (Secure)');
}

