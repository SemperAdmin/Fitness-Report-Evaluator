// Profile Management System
let currentProfile = null;
let profileEvaluations = [];
let syncQueue = [];

// Profile Authentication
async function profileLogin() {
    const rank = document.getElementById('rsRankInput').value.trim();
    const name = document.getElementById('rsNameInput').value.trim();
    const email = document.getElementById('rsEmailInput').value.trim();

    if (!rank || !name || !email) {
        alert('Complete all fields to access your profile.');
        return;
    }

    const profileKey = generateProfileKey(name, email);

    // Load local first
    let profile = loadProfileFromLocal(profileKey);
    let localEvaluations = loadEvaluationsFromLocal(profileKey);

    // Try remote; merge and persist for offline-first UX
    const { profile: mergedProfile, evaluations: mergedEvaluations } =
        await tryLoadRemoteProfile(email, name, rank, profileKey, profile, localEvaluations);

    profile = mergedProfile;
    localEvaluations = mergedEvaluations;

    // Create new profile if none exists
    if (!profile) {
        profile = {
            rsName: name,
            rsEmail: email,
            rsRank: rank,
            createdDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            totalEvaluations: Array.isArray(localEvaluations) ? localEvaluations.length : 0,
            evaluationFiles: []
        };
    }

    currentProfile = profile;
    profileEvaluations = localEvaluations;

    // Persist snapshot for auto-load
    localStorage.setItem('current_profile', JSON.stringify(currentProfile));
    localStorage.setItem('current_evaluations', JSON.stringify(profileEvaluations));
    localStorage.setItem('has_profile', 'true');
    
    // Session-only: mark that the user explicitly logged in this session
    sessionStorage.setItem('login_source', 'form');

    showProfileDashboard();
}

// Create Account -> sends rank, name, email, password to backend
async function createAccount() {
    const rank = document.getElementById('caRankInput')?.value.trim();
    const name = document.getElementById('caNameInput')?.value.trim();
    const email = document.getElementById('caEmailInput')?.value.trim();
    const password = document.getElementById('caPasswordInput')?.value;

    if (!rank || !name || !email || !password) {
        alert('Please enter Rank, Name, Email, and Password.');
        return;
    }

    try {
        const res = await postJson('/api/account/create', { rank, name, email, password });
        if (!res || !res.ok) {
            const msg = res && res.error ? res.error : 'Account creation failed.';
            alert(msg);
            return;
        }

        // Optionally hydrate local profile for immediate UX
        const profileKey = generateProfileKey(name, email);
        const profile = {
            rsName: name,
            rsEmail: email,
            rsRank: rank,
            createdDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            totalEvaluations: 0,
            evaluationFiles: []
        };
        saveProfileToLocal(profileKey, profile);
        currentProfile = profile;
        profileEvaluations = [];
        localStorage.setItem('current_profile', JSON.stringify(currentProfile));
        localStorage.setItem('current_evaluations', JSON.stringify(profileEvaluations));
        localStorage.setItem('has_profile', 'true');
        sessionStorage.setItem('login_source', 'form');

        alert('Account created. You are now signed in.');
        showProfileDashboard();
    } catch (err) {
        console.error('createAccount error:', err);
        alert('Account creation failed due to a network error.');
    }
}

// Account Login -> email + password
async function accountLogin() {
    const email = document.getElementById('loginEmailInput')?.value.trim();
    const password = document.getElementById('loginPasswordInput')?.value;
    if (!email || !password) {
        alert('Please enter Email and Password.');
        return;
    }

    try {
        const res = await postJson('/api/account/login', { email, password });
        if (!res || !res.ok) {
            const msg = res && res.error ? res.error : 'Login failed.';
            alert(msg);
            return;
        }

        const profile = res.profile || {
            rsName: res.rsName,
            rsEmail: email,
            rsRank: res.rsRank,
            totalEvaluations: (res.evaluations || []).length,
            lastUpdated: new Date().toISOString(),
            evaluationFiles: []
        };

        const profileKey = generateProfileKey(profile.rsName, profile.rsEmail);
        saveProfileToLocal(profileKey, profile);
        currentProfile = profile;
        profileEvaluations = res.evaluations || [];
        localStorage.setItem('current_profile', JSON.stringify(currentProfile));
        localStorage.setItem('current_evaluations', JSON.stringify(profileEvaluations));
        localStorage.setItem('has_profile', 'true');
        sessionStorage.setItem('login_source', 'form');

        showProfileDashboard();
    } catch (err) {
        console.error('accountLogin error:', err);
        alert('Login failed due to a network error.');
    }
}

// Small helper for backend POST
async function postJson(url, body) {
    const base = (typeof window !== 'undefined' && window.API_BASE_URL)
        ? window.API_BASE_URL
        : window.location.origin;

    // Resolve against base and enforce allowlisted origins
    const resolvedUrl = new URL(url, base);
    const baseOrigin = new URL(base).origin;
    const allowedOrigins = Array.isArray(window.API_ALLOWED_ORIGINS)
        ? window.API_ALLOWED_ORIGINS
        : [baseOrigin];
    if (!allowedOrigins.includes(resolvedUrl.origin)) {
        throw new Error('Requests to untrusted origins are blocked.');
    }
    const endpoint = resolvedUrl.toString();
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!resp.ok) {
        let error = `Request failed (${resp.status})`;
        try { const data = await resp.json(); error = data.error || error; } catch (_) {}
        return { ok: false, error, status: resp.status };
    }
    try {
        const data = await resp.json();
        return { ok: true, ...data };
    } catch (_) {
        return { ok: true };
    }
}

// UI toggles for Create Account
function showCreateAccount() {
    const loginFields = document.getElementById('loginFields');
    const createSection = document.getElementById('createAccountSection');
    if (loginFields) { loginFields.style.display = 'none'; }
    if (createSection) { createSection.style.display = 'block'; }
    window.scrollTo({ top: 0, behavior: 'auto' });
}

function hideCreateAccount() {
    const loginFields = document.getElementById('loginFields');
    const createSection = document.getElementById('createAccountSection');
    if (createSection) { createSection.style.display = 'none'; }
    if (loginFields) { loginFields.style.display = 'block'; }
    window.scrollTo({ top: 0, behavior: 'auto' });
}

// Skip -> show main app
function skipProfileLogin() {
    currentProfile = null;

    const login = document.getElementById('profileLoginCard');
    if (login) {
        login.classList.remove('active');
        login.style.display = 'none'; // ensure login card is hidden
    }

    const header = document.querySelector('.header');
    const warning = document.getElementById('dataWarning');
    if (header) header.style.display = '';
    if (warning) warning.style.display = '';

    const setup = document.getElementById('setupCard');
    if (setup) {
        setup.style.display = 'block';
        setup.classList.add('active');
    }

    // Ensure other cards remain hidden
    ['howItWorksCard','evaluationContainer','reviewCard','sectionIGenerationCard','directedCommentsCard','summaryCard']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('active'); el.style.display = 'none'; }
        });
}

// Show Dashboard -> keep app chrome hidden
// In showProfileDashboard(), initialize the rank button state to "All"
// State: selected rank on dashboard
let selectedRankFilter = '';

// New function to apply rank filter from summary table and open grid view
function applyRankFromSummary(rank) {
    setRankFilter(rank);
    toggleGridView(true);
}

// Show RS Summary (main page) and clear any active rank filter
function showRankSummaryView() {
    // Clear the selected rank filter
    setRankFilter('');

    // Ensure the list (RS Summary) is shown and grid is hidden
    toggleGridView(false);

    // Re-render the summary list to reflect full dataset
    renderEvaluationsList();

    // Optional: scroll to top for dashboard feel
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show Dashboard -> initialize and hide filters until a rank is chosen
function showProfileDashboard() {
    const login = document.getElementById('profileLoginCard');
    if (login) {
        login.classList.remove('active');
        login.style.display = 'none'; // Hide RS Login after login
    }

    const dash = document.getElementById('profileDashboardCard');
    if (dash) {
        dash.style.display = 'block';
        dash.classList.add('active');
    }

    const header = document.querySelector('.header');
    const warning = document.getElementById('dataWarning');
    if (header) header.style.display = 'none';
    if (warning) warning.style.display = 'none';

    // Hide all app cards while in Dashboard
    ['setupCard','howItWorksCard','evaluationContainer','reviewCard','sectionIGenerationCard','directedCommentsCard','summaryCard']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('active'); el.style.display = 'none'; }
        });

    renderProfileHeader();
    renderEvaluationsList();
    // Initialize button bar to "All" and update visibility
    setRankFilter('');
}

function renderProfileHeader() {
    const nameEl = document.getElementById('profileHeaderName');
    const emailEl = document.getElementById('profileHeaderEmail');
    const totalEl = document.getElementById('totalEvaluations');
    const pendingEl = document.getElementById('pendingSync');

    if (nameEl && currentProfile) {
        nameEl.textContent = `${currentProfile.rsRank} ${currentProfile.rsName}`;
    }
    if (emailEl && currentProfile) {
        emailEl.textContent = currentProfile.rsEmail;
    }
    if (totalEl) {
        totalEl.textContent = String(profileEvaluations.length);
    }

    const pending = profileEvaluations.filter(e => e.syncStatus !== 'synced').length;
    if (pendingEl) {
        pendingEl.textContent = String(pending);
    }
}

// Set rank summary sort preference
function setRankSummarySort(key) {
    window.rankSummarySort = key || 'reports';
    renderEvaluationsList();
}

function renderEvaluationsList() {
    const container = document.getElementById('evaluationsList');
    container.innerHTML = '';

    if (profileEvaluations.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No evaluations saved yet.</p>
                <button class="btn btn-meets" onclick="startNewEvaluation()">
                    Create Your First Evaluation
                </button>
            </div>
        `;
        return;
    }

    // Aggregate across ALL evaluations by rank
    const rankStats = new Map();
    profileEvaluations.forEach(e => {
        const rawRank = String(e.marineInfo?.rank || '').trim();
        if (!rawRank) return;

        const rank = normalizeRankLabel(rawRank);
        const avgNum = parseFloat(e.fitrepAverage || '0');
        if (!Number.isFinite(avgNum)) return;

        const s = rankStats.get(rank) || { sum: 0, count: 0, high: 0, low: Infinity };
        s.sum += avgNum;
        s.count += 1;
        s.high = Math.max(s.high, avgNum);
        s.low = Math.min(s.low, avgNum);
        rankStats.set(rank, s);
    });

    // Compute global bounds for progress bars
    const allAvgs = [];
    rankStats.forEach(s => {
        if (s.count) allAvgs.push(s.sum / s.count);
    });
    const globalHigh = allAvgs.length ? Math.max(...allAvgs) : 0;
    const globalLow = allAvgs.length ? Math.min(...allAvgs) : 0;
    const spread = Math.max(0.01, globalHigh - globalLow);

    // Only show ranks that have reports
    const orderedRanks = [
        'SGT','SSGT','GYSGT','MSGT','1STSGT',
        'WO','CWO2','CWO3','CWO4','CWO5',
        '2NDLT','1STLT','CAPT','MAJ','LTCOL','COL'
    ];

    // Prepare rows
    const rows = [];
    orderedRanks.forEach(rank => {
        if (!rankStats.has(rank)) return;
        const s = rankStats.get(rank);
        const avg = s.count ? s.sum / s.count : 0;
        rows.push({
            rank,
            avg,
            count: s.count,
            high: s.count ? s.high : 0,
            low: s.count && Number.isFinite(s.low) ? s.low : 0
        });
    });

    // Sorting
    const key = window.rankSummarySort || 'reports';
    if (key === 'avg') {
        rows.sort((a, b) => b.avg - a.avg || a.rank.localeCompare(b.rank));
    } else {
        rows.sort((a, b) => b.count - a.count || a.rank.localeCompare(b.rank));
    }

    // Toolbar
    const toolbarHtml = `
        <div class="summary-toolbar" role="toolbar" aria-label="Rank Summary controls">
            <span class="summary-title">Rank Summary</span>
            <div class="toolbar-spacer"></div>
            <span class="sort-label">Sort:</span>
            <button class="btn btn-secondary sort-btn ${key === 'reports' ? 'active' : ''}" onclick="setRankSummarySort('reports')">Reports</button>
            <button class="btn btn-secondary sort-btn ${key === 'avg' ? 'active' : ''}" onclick="setRankSummarySort('avg')">Average</button>
        </div>
    `;

    // Cards
    const cardsHtml = rows.map(r => {
        const pct = Math.round(((r.avg - globalLow) / spread) * 100);
        return `
            <button class="rank-summary-card" onclick="applyRankFromSummary('${r.rank}')" title="Open ${r.rank} grid">
                <div class="rank-chip">${r.rank}</div>
                <div class="metric-group">
                    <div class="metric">
                        <span class="metric-label">Avg</span>
                        <span class="metric-value">${r.avg.toFixed(2)}</span>
                    </div>
                    <div class="metric-bar" aria-label="Average relative bar">
                        <div class="bar-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="metric-row">
                        <span class="pill">Reports ${r.count}</span>
                        <span class="pill">High ${r.high.toFixed(2)}</span>
                        <span class="pill">Low ${r.low.toFixed(2)}</span>
                    </div>
                </div>
            </button>
        `;
    }).join('');

    container.innerHTML = toolbarHtml + `<div class="rank-summary-grid">${cardsHtml}</div>`;
}

function createEvaluationListItem(evaluation) {
    const div = document.createElement('div');
    div.className = 'evaluation-item';
    div.dataset.evalId = evaluation.evaluationId;

    div.innerHTML = `
        <div class="eval-header" onclick="toggleEvaluation(this)">
            <div class="eval-summary">
                <div class="eval-marine-info">
                    <span class="marine-rank">${evaluation.marineInfo.rank}</span>
                    <span class="marine-name">${evaluation.marineInfo.name}</span>
                </div>
                <div class="eval-meta">
                    <span class="eval-occasion">${evaluation.occasion}</span>
                    <span class="eval-dates">${evaluation.marineInfo.evaluationPeriod.from} to ${evaluation.marineInfo.evaluationPeriod.to}</span>
                    <span class="eval-average">Avg: ${evaluation.fitrepAverage}</span>
                </div>
            </div>
            <div class="eval-actions">
                <span class="sync-status ${evaluation.syncStatus || 'pending'}">
                    ${evaluation.syncStatus === 'synced' ? '✓ Synced' : '⏳ Pending'}
                </span>
                <button class="icon-btn" onclick="event.stopPropagation(); deleteEvaluation('${evaluation.evaluationId}')">
                    🗑️
                </button>
                <span class="expand-icon">▼</span>
            </div>
        </div>
        <div class="eval-details" style="display: none;">
            ${renderEvaluationDetails(evaluation)}
        </div>
    `;

    return div;
}

function renderEvaluationDetails(evaluation) {
    let justificationsHTML = '';
    Object.values(evaluation.traitEvaluations).forEach(trait => {
        justificationsHTML += `
            <div class="justification-item">
                <strong>${trait.trait} (${trait.grade}):</strong>
                <p>${trait.justification}</p>
            </div>
        `;
    });

    return `
        <div class="eval-details-grid">
            <div class="detail-section">
                <h4>Section I Comments</h4>
                <div class="comments-text">${evaluation.sectionIComments || 'No comments provided'}</div>
            </div>
            <div class="detail-section full-width">
                <h4>Justifications</h4>
                <div class="justifications-list">${justificationsHTML}</div>
            </div>
        </div>
        <div class="eval-detail-actions">
            <button class="btn btn-secondary" onclick="exportEvaluation('${evaluation.evaluationId}')">
                Export This Evaluation
            </button>
            <button class="btn btn-secondary" onclick="duplicateEvaluation('${evaluation.evaluationId}')">
                Use as Template
            </button>
        </div>
    `;
}

function toggleEvaluation(header) {
    const item = header.closest('.evaluation-item');
    const details = item.querySelector('.eval-details');

    if (details.style.display === 'none') {
        details.style.display = 'block';
        item.classList.add('expanded');
    } else {
        details.style.display = 'none';
        item.classList.remove('expanded');
    }
}

// Save Evaluation to Profile
function showSaveToProfilePrompt() {
    document.getElementById('saveProfileModal').classList.add('active');

    // Populate preview
    document.getElementById('savePreviewMarine').textContent = evaluationMeta.marineName;
    document.getElementById('savePreviewPeriod').textContent =
        `${evaluationMeta.fromDate} to ${evaluationMeta.toDate}`;
    document.getElementById('savePreviewAverage').textContent = calculateFitrepAverage();

    // New: prefill occasion from setup if available
    const occSel = document.getElementById('evaluationOccasion');
    if (occSel && evaluationMeta.occasionType) {
        occSel.value = evaluationMeta.occasionType;
    }
}

async function confirmSaveToProfile() {
    const occasionEl = document.getElementById('evaluationOccasion');
    const occasion = occasionEl ? occasionEl.value : (evaluationMeta?.occasionType || '');

    const githubEl = document.getElementById('saveGitHub');
    const shouldSyncToGitHub = !!(githubEl && githubEl.checked);

    // If not logged in, create a local offline profile to persist the evaluation
    if (!currentProfile) {
        const offlineName = evaluationMeta.evaluatorName || 'Anonymous RS';
        currentProfile = {
            rsName: offlineName,
            rsEmail: 'offline@local',
            rsRank: 'Unknown',
            evaluations: []
        };
        const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
        const existing = loadEvaluationsFromLocal(profileKey) || [];
        profileEvaluations = Array.isArray(existing) ? existing : [];
        saveProfileToLocal(profileKey, currentProfile);
    }

    const evaluationId = `eval-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

    const evaluation = {
        evaluationId,
        rsInfo: {
            name: currentProfile ? currentProfile.rsName : evaluationMeta.evaluatorName,
            email: currentProfile ? currentProfile.rsEmail : 'offline@local',
            rank: currentProfile ? currentProfile.rsRank : 'Unknown'
        },
        marineInfo: {
            name: evaluationMeta.marineName,
            rank: evaluationMeta.marineRank || 'Unknown', // use captured rank
            evaluationPeriod: {
                from: evaluationMeta.fromDate,
                to: evaluationMeta.toDate
            }
        },
        occasion,
        completedDate: new Date().toISOString(),
        fitrepAverage: calculateFitrepAverage(),
        traitEvaluations: evaluationResults,
        sectionIComments: evaluationMeta.sectionIComments || '',
        directedComments: evaluationMeta.directedComments || '',
        savedToProfile: true,
        syncStatus: shouldSyncToGitHub ? 'pending' : 'local-only'
    };

    // Save to localStorage
    const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
    profileEvaluations.push(evaluation);
    saveEvaluationsToLocal(profileKey, profileEvaluations);

    currentProfile.totalEvaluations = profileEvaluations.length;
    currentProfile.lastUpdated = new Date().toISOString();
    saveProfileToLocal(profileKey, currentProfile);

    // NEW: update session snapshot so Dashboard can detect the saved profile
    localStorage.setItem('current_profile', JSON.stringify(currentProfile));
    localStorage.setItem('current_evaluations', JSON.stringify(profileEvaluations));
    localStorage.setItem('has_profile', 'true');
    // IMPORTANT: mark this as an offline save, not a form login
    localStorage.setItem('login_source', 'offline');

    // Optional: sync to GitHub when online and logged in
    if (shouldSyncToGitHub && navigator.onLine) {
        const synced = await syncEvaluationToGitHub(evaluation);
        if (synced) {
            evaluation.syncStatus = 'synced';
        }
    }

    // Hide modal safely
    const modal = document.getElementById('saveProfileModal');
    if (modal) {
        modal.classList.remove('active');
    }
    alert('Evaluation saved to your profile!');
}

function skipSaveToProfile() {
    document.getElementById('saveProfileModal').classList.remove('active');
}

// New: Save and immediately return to RS Dashboard
async function confirmSaveToProfileAndReturn() {
    await confirmSaveToProfile();
    // Navigate to RS Dashboard to view the saved evaluation
    if (typeof showProfileDashboard === 'function') {
        showProfileDashboard();
    }
}

// Sync Operations
async function syncAllEvaluations() {
    if (!navigator.onLine) {
        alert('You are offline. Connect to the internet to sync evaluations.');
        return;
    }

    const pending = profileEvaluations.filter(e => e.syncStatus !== 'synced');

    if (pending.length === 0) {
        alert('All evaluations already synced!');
        return;
    }

    const btn = document.activeElement && document.activeElement.tagName === 'BUTTON' ? document.activeElement : null;
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Syncing...';
    }

    for (const evaluation of pending) {
        await syncEvaluationToGitHub(evaluation);
    }

    const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
    saveEvaluationsToLocal(profileKey, profileEvaluations);

    if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 Sync to GitHub';
    }

    renderEvaluationsList();
    alert('Sync complete!');
}

// Utility Functions
function startNewEvaluation() {
    const dash = document.getElementById('profileDashboardCard');
    if (dash) {
        dash.classList.remove('active');
        dash.style.display = 'none';
    }

    // Also hide login card if visible (skip flow)
    const login = document.getElementById('profileLoginCard');
    if (login) {
        login.classList.remove('active');
        login.style.display = 'none';
    }

    // Restore app chrome hidden by the dashboard
    const header = document.querySelector('.header');
    const warning = document.getElementById('dataWarning');
    if (header) header.style.display = '';
    if (warning) warning.style.display = '';

    // Show setup card
    const setup = document.getElementById('setupCard');
    if (setup) {
        setup.classList.add('active');
        setup.style.display = 'block';
    }

    // Prefill RS name from profile when logged in
    const evaluatorInput = document.getElementById('evaluatorNameInput');
    if (evaluatorInput && window.currentProfile?.rsName) {
        evaluatorInput.value = window.currentProfile.rsName;
    }

    // Align navigation state if available
    try {
        if (typeof jumpToStep === 'function' && typeof STEPS !== 'undefined') {
            jumpToStep(STEPS.setup);
        }
    } catch (e) {
        // no-op if navigation is not initialized
    }
}

function deleteEvaluation(evalId) {
    if (!confirm('Delete this evaluation? This cannot be undone.')) {
        return;
    }

    profileEvaluations = profileEvaluations.filter(e => e.evaluationId !== evalId);

    const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
    saveEvaluationsToLocal(profileKey, profileEvaluations);

    renderEvaluationsList();
}

function exportEvaluation(evalId) {
    const evaluation = profileEvaluations.find(e => e.evaluationId === evalId);
    if (!evaluation) return;

    const json = JSON.stringify(evaluation, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${evalId}.json`;
    a.click();
}

function exportProfile() {
    const exportData = {
        profile: currentProfile,
        evaluations: profileEvaluations
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profile-${currentProfile.rsName.replace(/[^a-z0-9]/gi, '-')}.json`;
    a.click();
}

function logoutProfile() {
    if (confirm('Log out? Unsaved changes will remain in local storage.')) {
        currentProfile = null;
        profileEvaluations = [];
        
        // Clear session snapshot and login flags
        localStorage.removeItem('current_profile');
        localStorage.removeItem('current_evaluations');
        localStorage.removeItem('has_profile');
        localStorage.removeItem('login_source');
        
        // Hide dashboard
        const dash = document.getElementById('profileDashboardCard');
        if (dash) {
            dash.classList.remove('active');
            dash.style.display = 'none';
        }
        
        // Route back to the login page (hide setup, hide app chrome)
        if (typeof showRSLoginFirst === 'function') {
            showRSLoginFirst();
        } else {
            const login = document.getElementById('profileLoginCard');
            const setup = document.getElementById('setupCard');
            const header = document.querySelector('.header');
            const warning = document.getElementById('dataWarning');

            if (header) header.style.display = 'none';
            if (warning) warning.style.display = 'none';
            if (setup) {
                setup.classList.remove('active');
                setup.style.display = 'none';
            }
            if (login) {
                login.classList.add('active');
                login.style.display = 'block';
            }
            window.scrollTo({ top: 0, behavior: 'auto' });
        }
    }
}

// Connection Status
function updateConnectionStatus() {
    const indicator = document.getElementById('connectionStatus');
    const dot = document.querySelector('.status-dot');

    if (navigator.onLine) {
        indicator.textContent = 'Connected - Sync available';
        dot.classList.add('online');
        dot.classList.remove('offline');
    } else {
        indicator.textContent = 'Offline - Changes saved locally';
        dot.classList.add('offline');
        dot.classList.remove('online');
    }
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
window.addEventListener('load', updateConnectionStatus);

// Helper stubs for functions referenced from evaluation.js
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

    // Sum all 13 core traits + optional Section H (Evals)
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

    // Denominator: 14 if Section H present; else 13
    const hasSectionH =
        items.some(t =>
            (t.trait || '').trim().toLowerCase() === 'evaluations' ||
            (t.section || '').trim().toLowerCase() === 'fulfillment of evaluation responsibilities'
        );

    const denom = hasSectionH ? 14 : 13;
    const avg = denom > 0 ? (total / denom) : 0;

    return avg.toFixed(2);
}

function duplicateEvaluation(evalId) {
    const original = profileEvaluations.find(e => e.evaluationId === evalId);
    if (!original) return;
    const copy = JSON.parse(JSON.stringify(original));
    copy.evaluationId = `eval-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    copy.completedDate = new Date().toISOString();
    copy.syncStatus = 'pending';
    profileEvaluations.unshift(copy);
    const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
    saveEvaluationsToLocal(profileKey, profileEvaluations);
    renderEvaluationsList();
}


// Add: sorting state and setter
let gridSort = 'DateDesc';

function setGridSort(value) {
    gridSort = value;
    renderProfileGrid();
}


// Helpers for grid view
/* Removed duplicate getTraitGrades (older version). Using the later, refactored version defined further below. */

/* Removed duplicate computeRvValues (older version). Using the later, unified ranking version defined below. */

/* Removed duplicate computeCumulativeRv (older version). Using the later, simplified cumulative average version defined below. */

/* Removed duplicate badgeForRv (older version). Using the later version defined below. */

// New: Rank Summary bar (Excel-style)
// High = MAX(T:T)
// Avg = AVERAGEIF(R:R,"<>H",T:T)  -> average of fitrepAverage where fitrepAverage > 0
// Low = MINIFS(T:T,R:R,"<>H")     -> minimum of fitrepAverage where fitrepAverage > 0
// # Rpts = COUNTA(C:C) - COUNTIF(R:R,"H") - 1 -> total - zeros - 1
function renderRankSummary(evals) {
    const container = document.getElementById('profileGridContainer');
    if (!container) return;

    let summaryEl = document.getElementById('rankSummaryBar');
    if (!summaryEl) {
        summaryEl = document.createElement('div');
        summaryEl.id = 'rankSummaryBar';
        summaryEl.style.display = 'flex';
        summaryEl.style.justifyContent = 'flex-end';
        summaryEl.style.gap = '10px';
        summaryEl.style.margin = '8px 0';
        summaryEl.style.padding = '8px';
        summaryEl.style.border = '2px solid #c2185b';
        summaryEl.style.borderRadius = '6px';
        summaryEl.style.background = '#fff';
        summaryEl.style.alignItems = 'center'; // center badges vertically
        // Insert just above the table
        const actions = container.querySelector('.profile-grid-actions');
        if (actions && actions.nextSibling) {
            container.insertBefore(summaryEl, actions.nextSibling);
        } else {
            container.appendChild(summaryEl);
        }
    }

    const scores = (evals || [])
        .map(e => parseFloat(e.fitrepAverage || '0'))
        .filter(n => Number.isFinite(n));
    const nonZero = scores.filter(n => n > 0);
    const high = scores.length ? Math.max(...scores) : 0;
    const avg = nonZero.length ? (nonZero.reduce((s, x) => s + x, 0) / nonZero.length) : 0;
    const low = nonZero.length ? Math.min(...nonZero) : 0;
    const zeroCount = scores.filter(n => n === 0).length;
    const rpts = Math.max(0, scores.length - zeroCount);

    const fmt = (n) => Number.isFinite(n) ? n.toFixed(2) : '0.00';
    const pill = (label, value, color) =>
        `<span style="background:${color};color:#fff;padding:4px 8px;border-radius:14px;font-weight:700;">${label}: ${value}</span>`;

    summaryEl.innerHTML = [
        pill('High', fmt(high), '#2e7d32'),
        pill('Avg', fmt(avg), '#1565c0'),
        pill('Low', fmt(low), '#c62828'),
        pill('# Rpts', rpts, '#6a1b9a')
    ].join(' ');
    
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setText('rankHighVal', high.toFixed(2));
    setText('rankAvgVal', avg.toFixed(2));
    setText('rankLowVal', low.toFixed(2));
    setText('rankRptsVal', rpts);
}

// Compute High / Avg / Low / # Rpts from the table's Avg column
function renderRankSummaryFromDom() {
    const tbody = document.querySelector('#profileGrid tbody');
    if (!tbody) return;

    const container = document.getElementById('profileGridContainer');
    if (!container) return;

    let summaryEl = document.getElementById('rankSummaryBar');
    if (!summaryEl) {
        summaryEl = document.createElement('div');
        summaryEl.id = 'rankSummaryBar';
        summaryEl.style.display = 'flex';
        summaryEl.style.justifyContent = 'flex-end';
        summaryEl.style.gap = '10px';
        summaryEl.style.margin = '8px 0';
        summaryEl.style.padding = '8px';
        summaryEl.style.border = '2px solid #c2185b';
        summaryEl.style.borderRadius = '6px';
        summaryEl.style.background = '#fff';
        summaryEl.style.alignItems = 'center'; // center badges vertically
        // Insert just above the table
        const actions = container.querySelector('.profile-grid-actions');
        if (actions && actions.nextSibling) {
            container.insertBefore(summaryEl, actions.nextSibling);
        } else {
            container.appendChild(summaryEl);
        }
    }

    const avgCells = Array.from(tbody.querySelectorAll('.avg-cell'));
    const values = avgCells.map(cell => {
        const v = parseFloat((cell.textContent || '').trim().replace(/[^\d.-]/g, ''));
        return Number.isFinite(v) ? v : 0;
    });

    const nonZero = values.filter(n => n > 0);
    const high = values.length ? Math.max(...values) : 0;
    const avg = nonZero.length ? (nonZero.reduce((s, x) => s + x, 0) / nonZero.length) : 0;
    const low = nonZero.length ? Math.min(...nonZero) : 0;
    const zeroCount = values.filter(n => n === 0).length;
    const rpts = Math.max(0, values.length - zeroCount);

    const fmt = (n) => Number.isFinite(n) ? n.toFixed(2) : '0.00';
    const pill = (label, value, color) =>
        `<span style="background:${color};color:#fff;padding:4px 8px;border-radius:14px;font-weight:700;">${label}: ${value}</span>`;

    summaryEl.innerHTML = [
        pill('High', fmt(high), '#2e7d32'),
        pill('Avg', fmt(avg), '#1565c0'),
        pill('Low', fmt(low), '#c62828'),
        pill('# Rpts', rpts, '#6a1b9a')
    ].join(' ');
    
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setText('rankHighVal', high.toFixed(2));
    setText('rankAvgVal', avg.toFixed(2));
    setText('rankLowVal', low.toFixed(2));
    setText('rankRptsVal', rpts);
    
    // Also update alternative element IDs if they exist
    const highEl = document.getElementById('rankHighValue');
    const avgEl = document.getElementById('rankAvgValue');
    const lowEl = document.getElementById('rankLowValue');
    const rptsEl = document.getElementById('rankReportsValue');

    if (highEl) highEl.textContent = high.toFixed(2);
    if (avgEl) avgEl.textContent = avg.toFixed(2);
    if (lowEl) lowEl.textContent = low.toFixed(2);
    if (rptsEl) rptsEl.textContent = String(rpts);
}

/* Removed duplicate capitalize (older version). Using the later version defined below. */

// Add: CSV export based on current render order
/* Removed duplicate exportProfileGridCsv (older version). Using the later version defined below. */


// Auto-open Dashboard on load if a profile exists
function showProfileDashboardOnLoad() {
    const loginCard = document.getElementById('profileLoginCard');
    const dashboardCard = document.getElementById('profileDashboardCard');
    const modeCard = document.getElementById('modeSelectionCard');
    if (!loginCard || !dashboardCard) return;

    // Only auto-open if the user explicitly logged in in THIS SESSION
    const hasProfile = localStorage.getItem('has_profile') === 'true';
    const loginSource = sessionStorage.getItem('login_source'); // session-scoped, not persistent
    if (!hasProfile || loginSource !== 'form') {
        // Default to Mode Selection on initial load
        if (modeCard) { modeCard.classList.add('active'); modeCard.style.display = 'block'; }
        loginCard.classList.remove('active');
        loginCard.style.display = 'none';
        dashboardCard.classList.remove('active');
        dashboardCard.style.display = 'none';
        
        const setupCard = document.getElementById('setupCard');
        if (setupCard) {
            setupCard.classList.remove('active');
            setupCard.style.display = 'none';
        }
        return;
    }

    const stored = loadProfileFromStorage();
    if (!stored) return;

    window.currentProfile = {
        rsName: stored.rsName,
        rsEmail: stored.rsEmail,
        rsRank: stored.rsRank,
        totalEvaluations: (stored.evaluations || []).length,
        lastUpdated: stored.lastUpdated || new Date().toISOString()
    };
    window.profileEvaluations = stored.evaluations || [];

    showProfileDashboard();

    // Prefer showing Dashboard instead of login/setup when a profile exists
    loginCard.style.display = 'none';
    dashboardCard.style.display = 'block';

    const setupCard = document.getElementById('setupCard');
    if (setupCard) setupCard.style.display = 'none';
}

// Profile persistence helpers and GitHub stubs (added)
function loadProfileFromStorage() {
    try {
        const profJson = localStorage.getItem('current_profile');
        if (!profJson) return null;
        const evalsJson = localStorage.getItem('current_evaluations');
        const profile = JSON.parse(profJson);
        const evaluations = evalsJson ? JSON.parse(evalsJson) : [];
        return { ...profile, evaluations };
    } catch (e) {
        console.warn('loadProfileFromStorage failed:', e);
        return null;
    }
}

function generateProfileKey(name, email) {
    const n = String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const e = String(email || '').toLowerCase().trim();
    return `rs:${n}|${e}`;
}

function loadProfileFromLocal(profileKey) {
    try {
        return JSON.parse(localStorage.getItem(`profile:${profileKey}`) || 'null');
    } catch (err) {
        console.warn('loadProfileFromLocal failed:', err);
        return null;
    }
}

function saveProfileToLocal(profileKey, profile) {
    try {
        localStorage.setItem(`profile:${profileKey}`, JSON.stringify(profile));
    } catch (err) {
        console.warn('saveProfileToLocal failed:', err);
    }
}

function loadEvaluationsFromLocal(profileKey) {
    try {
        return JSON.parse(localStorage.getItem(`evaluations:${profileKey}`) || '[]');
    } catch (err) {
        console.warn('loadEvaluationsFromLocal failed:', err);
        return [];
    }
}

function saveEvaluationsToLocal(profileKey, evaluations) {
    try {
        localStorage.setItem(`evaluations:${profileKey}`, JSON.stringify(evaluations));
    } catch (err) {
        console.warn('saveEvaluationsToLocal failed:', err);
    }
}

// Optional GitHub integration stubs (safe no-ops)
async function fetchProfileFromGitHub(profileKey) {
    // No GitHub configured; return null to keep app fully offline-capable
    return null;
}

function mergeProfiles(local, remote) {
    if (!local) return remote || null;
    if (!remote) return local;
    return {
        ...local,
        ...remote,
        evaluationFiles: Array.from(new Set([...(local.evaluationFiles || []), ...(remote.evaluationFiles || [])])),
        totalEvaluations: Math.max(local.totalEvaluations || 0, remote.totalEvaluations || 0),
        lastUpdated: new Date().toISOString()
    };
}

async function syncEvaluationToGitHub(evaluation) {
    try {
        // Validate user email (required for per-user file path)
        const userEmail = (currentProfile && currentProfile.rsEmail) || (evaluation?.rsInfo?.email) || '';
        if (!userEmail || userEmail === 'offline@local') {
            console.warn('GitHub sync skipped: no valid user email');
            return false;
        }

        // Obtain token from environment/backend; fallback to optional local dev config
        let token = null;
        try {
            token = await githubService.getTokenFromEnvironment?.();
        } catch (e) {
            console.warn('Token retrieval failed:', e);
        }
        if (!token && typeof window !== 'undefined' && window.GITHUB_CONFIG?.token) {
            token = window.GITHUB_CONFIG.token; // Dev-only fallback
        }
        if (!token) {
            console.warn('GitHub sync unavailable: token not found');
            return false;
        }

        // Initialize and verify connection
        githubService.initialize(token);
        const connected = await githubService.verifyConnection?.();
        if (!connected) {
            console.warn('GitHub connection failed; check token scopes and repo access');
            return false;
        }

        // Persist evaluation via service
        const result = await githubService.saveEvaluation(evaluation, userEmail);
        if (result?.success) {
            evaluation.syncStatus = 'synced';
            console.log('Evaluation synced to GitHub:', result.message);
            return true;
        }

        evaluation.syncStatus = 'error';
        console.error('GitHub sync failed:', result?.error || result);
        return false;
    } catch (error) {
        console.error('Error during GitHub sync:', error);
        return false;
    }
}

// Helper function to merge evaluations with conflict resolution
function mergeEvaluations(localEvaluations = [], remoteEvaluations = []) {
    const byId = new Map();

    const put = (ev) => {
        if (!ev) return;
        // Use a stronger composite key when evaluationId is missing to reduce collisions
        const id = ev.evaluationId || `composite:${
            (ev.marineInfo?.name || '').trim()
        }|${
            (ev.marineInfo?.rank || '').trim()
        }|${
            (ev.occasion || '').trim()
        }|${
            (ev.marineInfo?.evaluationPeriod?.from || '').slice(0,10)
        }|${
            (ev.marineInfo?.evaluationPeriod?.to || '').slice(0,10)
        }|${
            (ev.createdAt || ev.lastUpdated || ev.completedDate || '')
        }`;
        const prev = byId.get(id);
        const ts = new Date(ev.lastUpdated || ev.completedDate || 0).getTime();
        const prevTs = prev ? new Date(prev.lastUpdated || prev.completedDate || 0).getTime() : -1;
        if (!prev || ts >= prevTs) {
            byId.set(id, ev);
        }
    };

    localEvaluations.forEach(put);
    remoteEvaluations.forEach(put);

    return Array.from(byId.values());
}

// Helper function to try loading remote profile data
async function tryLoadRemoteProfile(email, name, rank, profileKey, localProfile, localEvaluations) {
    if (!navigator.onLine || typeof githubService === 'undefined') {
        return { profile: localProfile, evaluations: localEvaluations };
    }

    try {
        const token = await githubService.getTokenFromEnvironment?.();
        if (!token) return { profile: localProfile, evaluations: localEvaluations };

        githubService.initialize(token);
        const connected = await githubService.verifyConnection?.();
        if (!connected) return { profile: localProfile, evaluations: localEvaluations };

        const remote = await githubService.loadUserData(email);
        if (!remote) return { profile: localProfile, evaluations: localEvaluations };

        const remoteProfile = {
            rsName: remote.profile?.rsName || name,
            rsEmail: email,
            rsRank: remote.profile?.rsRank || rank,
            totalEvaluations: Array.isArray(remote.evaluations) ? remote.evaluations.length : (localProfile?.totalEvaluations || 0),
            lastUpdated: new Date().toISOString(),
            evaluationFiles: (localProfile?.evaluationFiles || [])
        };

        const mergedProfile = mergeProfiles(localProfile, remoteProfile);
        const mergedEvaluations = mergeEvaluations(
            Array.isArray(localEvaluations) ? localEvaluations : [],
            Array.isArray(remote.evaluations) ? remote.evaluations : []
        );

        // Persist merged result locally for offline-first UX
        saveProfileToLocal(profileKey, mergedProfile);
        saveEvaluationsToLocal(profileKey, mergedEvaluations);

        return { profile: mergedProfile, evaluations: mergedEvaluations };
    } catch (error) {
        console.warn('GitHub load on login failed; continuing with local data:', error);
        return { profile: localProfile, evaluations: localEvaluations };
    }
}

// Control visibility of dashboard filters and Grid View based on rank selection
function updateDashboardFiltersVisibility() {
    const filters = document.querySelector('.evaluation-filters');
    const gridBtn = document.getElementById('gridViewBtn');
    const rankBar = document.getElementById('rankFilterBar');
    const shouldShow = !!selectedRankFilter;
    
    // Always show filters for the RS Summary list
    if (filters) {
        filters.style.display = '';
    }
    
    // RS Summary View button should always be enabled and visible
    if (gridBtn) {
        gridBtn.disabled = false;
        gridBtn.style.display = '';
        gridBtn.textContent = '📊 RS Summary View';
    }
    
    // Hide legacy rank filter bar (we use summary Grade buttons now)
    if (rankBar) {
        rankBar.style.display = 'none';
    }
}

// New: rank filter setter wired to button bar and dropdown
function setRankFilter(rank) {
    selectedRankFilter = rank || '';

    // Sync dropdown value (even if hidden)
    const rankSelect = document.getElementById('filterByRank');
    if (rankSelect) rankSelect.value = selectedRankFilter;

    // Update button visual state
    const bar = document.getElementById('rankFilterBar');
    if (bar) {
        bar.querySelectorAll('button').forEach(btn => {
            const isActive = (btn.dataset.rank || '') === selectedRankFilter;
            btn.classList.toggle('btn-meets', isActive);
            btn.classList.toggle('btn-secondary', !isActive);
        });
    }

    // Update visibility for filters and Grid View
    updateDashboardFiltersVisibility();

    // Close grid if rank cleared
    const grid = document.getElementById('profileGridContainer');
    if (!selectedRankFilter && grid && grid.style.display === 'block') {
        toggleGridView(false);
    }

    // Re-render list with filters scoped by rank
    renderEvaluationsList();
}

// Only allow opening grid when a rank is selected
function toggleGridView(show) {
    if (show && !selectedRankFilter) {
        alert('Select a rank first to open Grid View.');
        return;
    }
    const list = document.getElementById('evaluationsList');
    const grid = document.getElementById('profileGridContainer');
    if (!list || !grid) return;
    if (show) {
        list.style.display = 'none';
        grid.style.display = 'block';
        renderProfileGrid();
    } else {
        grid.style.display = 'none';
        list.style.display = 'flex';
    }
}

// Apply filters: rank always required to show filters; others applied only when rank selected
function getFilteredEvaluations() {
    const rankVal = selectedRankFilter || '';
    const filtersVisible = !!selectedRankFilter;

    // Base filter by rank (normalize both sides to avoid label mismatches)
    let list = profileEvaluations.filter(e => {
        const evalRankRaw = String(e.marineInfo?.rank || '');
        const evalRank = normalizeRankLabel(evalRankRaw);
        const selected = normalizeRankLabel(rankVal);
        return selected ? evalRank === selected : true;
    });

    if (!filtersVisible) return list;

    // Additional filters (only after a rank is selected)
    const nameVal = (document.getElementById('filterByName')?.value || '').trim().toLowerCase();
    const occasionVal = (document.getElementById('filterByOccasion')?.value || '').trim().toLowerCase();
    const yearVal = (document.getElementById('filterByYear')?.value || '').trim();
    const gradeVal = (document.getElementById('filterByGrade')?.value || '').trim().toUpperCase();

    return list.filter(e => {
        const nameOk = nameVal ? (e.marineInfo?.name || '').toLowerCase().includes(nameVal) : true;
        const occasionOk = occasionVal ? (String(e.occasion || '').toLowerCase() === occasionVal) : true;
        const endDateStr = (e.marineInfo?.evaluationPeriod?.to || '').slice(0, 10);
        const yearOk = yearVal ? (endDateStr && new Date(endDateStr).getFullYear().toString() === yearVal) : true;
        const gradeOk = gradeVal
            ? Object.values(e.traitEvaluations || {}).some(t => String(t.grade || '').toUpperCase() === gradeVal)
            : true;
        return nameOk && occasionOk && yearOk && gradeOk;
    });
}

// Keep renderEvaluationsList and renderProfileGrid using getFilteredEvaluations()
function renderProfileGrid() {
    const tbody = document.querySelector('#profileGrid tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const rvMap = computeRvValues(profileEvaluations);
    const cumRvMap = computeCumulativeRv(profileEvaluations, rvMap);

    // Define evals, apply filters, then sort
    const evals = [...getFilteredEvaluations()];
    evals.sort((a, b) => {
        const avgA = parseFloat(a.fitrepAverage || '0');
        const avgB = parseFloat(b.fitrepAverage || '0');
        const rvA = rvMap.get(a.evaluationId) ?? 0;
        const rvB = rvMap.get(b.evaluationId) ?? 0;
        const dateA = new Date(a.marineInfo?.evaluationPeriod?.to || 0).getTime();
        const dateB = new Date(b.marineInfo?.evaluationPeriod?.to || 0).getTime();
        switch (gridSort) {
            case 'AvgAsc': return avgA - avgB;
            case 'AvgDesc': return avgB - avgA;
            case 'RvAsc': return rvA - rvB;
            case 'RvDesc': return rvB - rvA;
            case 'DateAsc': return dateA - dateB;
            case 'DateDesc':
            default: return dateB - dateA;
        }
    });
    
    // Precompute Cum RV list for rank calculation (Excel-style)
    const cumValuesById = new Map(
        evals.map(e => [e.evaluationId, (cumRvMap.get(e.evaluationId) ?? (rvMap.get(e.evaluationId) ?? 0))])
    );
    const cumList = Array.from(cumValuesById.values());
    
    // Compute column count for details row spanning
    const headerRow = document.querySelector('#profileGrid thead tr');
    const colCount = headerRow ? headerRow.children.length : 20;

    evals.forEach((evaluation, idx) => {
        const row = document.createElement('tr');
        const traitGrades = getTraitGrades(evaluation);
        const rv = rvMap.get(evaluation.evaluationId) ?? 0;
        const cumRv = cumValuesById.get(evaluation.evaluationId) ?? rv;
        const avg = parseFloat(evaluation.fitrepAverage || '0').toFixed(2);
        
        // Excel-style rank by Cum RV
        const rankPos = 1 + cumList.filter(v => v > cumRv).length;
        
        row.setAttribute('data-eval-id', evaluation.evaluationId);
        row.innerHTML = `
            <td>${rankPos}</td>
            <td style="text-align: left;">${evaluation.marineInfo?.name || '-'}</td>
            <td>${capitalize(evaluation.occasion || '-')}</td>
            <td>${(evaluation.marineInfo?.evaluationPeriod?.to || '').slice(0, 10) || '-'}</td>
            <td class="grade-cell">${traitGrades['Performance'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Proficiency'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Courage'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Stress Tolerance'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Initiative'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Leading'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Developing Others'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Setting the Example'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Well-Being/Health'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Communication Skills'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Professional Military Education'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Decision Making'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Judgement'] || '-'}</td>
            <td class="grade-cell">${traitGrades['Evals']}</td>
            <td class="avg-cell">${avg}</td>
            <td>${badgeForRv(rv)}</td>
            <td>${badgeForRv(cumRv)}</td>
            <td class="actions-cell" style="text-align:right;">
                <span class="sync-status ${evaluation.syncStatus || 'pending'}">
                    ${evaluation.syncStatus === 'synced' ? '✓ Synced' : '⏳ Pending'}
                </span>
                <button class="icon-btn" onclick="deleteEvaluation('${evaluation.evaluationId}')">🗑️</button>
                <span class="expand-icon" onclick="toggleGridDetails(this)">▼</span>
            </td>
        `;
        tbody.appendChild(row);
        
        // Details row (hidden by default, reused content from list view)
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'grid-details-row';
        detailsRow.style.display = 'none';
        detailsRow.setAttribute('data-eval-id', evaluation.evaluationId);
        detailsRow.innerHTML = `
            <td colspan="${colCount}">
                ${renderEvaluationDetails(evaluation)}
            </td>
        `;
        tbody.appendChild(detailsRow);
    });
    
    // Update summary from the Avg column cells that were just rendered
    renderRankSummaryFromDom();}

// Helpers for grid view
function getTraitGrades(evaluation) {
    const columnAliases = {
        'Performance': ['Performance'],
        'Proficiency': ['Proficiency'],
        'Courage': ['Courage'],
        'Stress Tolerance': ['Effectiveness Under Stress', 'Stress Tolerance'],
        'Initiative': ['Initiative'],
        'Leading': ['Leading Subordinates', 'Leading'],
        'Developing Others': ['Developing Subordinates', 'Developing Others'],
        'Setting the Example': ['Setting the Example'],
        'Well-Being/Health': [
            'Ensuring Well-being of Subordinates',
            'Ensuring Well-being',
            'Well-Being/Health',
            'Well Being',
            'Well-being'
        ],
        'Communication Skills': ['Communication Skills'],
        'Professional Military Education': [
            'Professional Military Education (PME)',
            'Professional Military Education',
            'PME'
        ],
        'Decision Making': ['Decision Making Ability', 'Decision Making'],
        'Judgement': ['Judgment', 'Judgement'],
        // Section H aliases
        'Evals': [
            'Evaluations',
            'Evaluation',
            'Eval',
            'Evals',
            'Fulfillment of Evaluation Responsibilities',
            'Evaluation Responsibilities',
            'Fulfillment of Eval Responsibilities',
            'Section H'
        ]
    };

    const items = Object.values(evaluation.traitEvaluations || {});
    const map = {};
    Object.keys(columnAliases).forEach(colName => {
        const synonyms = columnAliases[colName].map(s => s.toLowerCase());
        let findPredicate;
        let defaultValue;

        if (colName === 'Evals') {
            findPredicate = t =>
                synonyms.includes((t.trait || '').trim().toLowerCase()) ||
                synonyms.includes((t.section || '').trim().toLowerCase());
            defaultValue = 'H';
        } else {
            findPredicate = t =>
                synonyms.includes((t.trait || '').trim().toLowerCase());
            defaultValue = '-';
        }

        const found = items.find(findPredicate);
        map[colName] = found ? (found.grade || defaultValue) : defaultValue;
    });
    return map;
}

function computeRvValues(evals) {
    const sorted = [...evals].sort((a, b) => parseFloat(b.fitrepAverage || '0') - parseFloat(a.fitrepAverage || '0'));
    const n = sorted.length;
    const rvMap = new Map();
    if (n === 0) return rvMap;
    if (n === 1) {
        rvMap.set(sorted[0].evaluationId, 100);
        return rvMap;
    }
    sorted.forEach((e, i) => {
        const rv = Math.round(100 - (i * 100 / (n - 1)));
        rvMap.set(e.evaluationId, rv);
    });
    return rvMap;
}

function computeCumulativeRv(evals, rvMap) {
    // Cumulative RV: running average over numeric RVs only; "N/A" until any numeric RV present.
    const byDate = [...evals].sort((a, b) => new Date(a.completedDate || 0) - new Date(b.completedDate || 0));
    const cumMap = new Map();
    let sum = 0;
    let count = 0;
    byDate.forEach(e => {
        const rv = rvMap.get(e.evaluationId);
        if (typeof rv === 'number' && Number.isFinite(rv)) {
            sum += rv;
            count += 1;
            cumMap.set(e.evaluationId, Math.round(sum / count));
        } else {
            // Still no numeric RVs — show N/A
            cumMap.set(e.evaluationId, count > 0 ? Math.round(sum / count) : 'N/A');
        }
    });
    return cumMap;
}

function badgeForRv(rv) {
    if (rv === 'N/A' || !Number.isFinite(rv)) {
        return `<span class="rv-badge rv-mid">N/A</span>`;
    }
    const cls = rv >= 90 ? 'rv-high' : rv >= 75 ? 'rv-mid' : 'rv-low';
    return `<span class="rv-badge ${cls}">${rv}</span>`;
}

function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Add: CSV export based on current render order
function exportProfileGridCsv() {
    const rvMap = computeRvValues(profileEvaluations);
    const cumRvMap = computeCumulativeRv(profileEvaluations, rvMap);

    const evals = [...profileEvaluations];
    evals.sort((a, b) => {
        const avgA = parseFloat(a.fitrepAverage || '0');
        const avgB = parseFloat(b.fitrepAverage || '0');
        const rvA = rvMap.get(a.evaluationId) ?? 0;
        const rvB = rvMap.get(b.evaluationId) ?? 0;
        const dateA = new Date(a.marineInfo?.evaluationPeriod?.to || 0).getTime();
        const dateB = new Date(b.marineInfo?.evaluationPeriod?.to || 0).getTime();
        switch (gridSort) {
            case 'AvgAsc': return avgA - avgB;
            case 'AvgDesc': return avgB - avgA;
            case 'RvAsc': return rvA - rvB;
            case 'RvDesc': return rvB - rvA;
            case 'DateAsc': return dateA - dateB;
            case 'DateDesc':
            default: return dateB - dateA;
        }
    });

    const headers = [
        'Rank','Marine','Occasion','Ending Date',
        'Performance','Proficiency','Courage','Stress Tolerance','Initiative','Leading','Developing Others',
        'Setting the Example','Well-Being/Health','Communication Skills','PME','Decision Making','Judgement','Evals',
        'Avg','RV','Cum RV'
    ];

    const rows = evals.map((e, i) => {
        const traits = getTraitGrades(e);
        const avg = parseFloat(e.fitrepAverage || '0').toFixed(2);
        const rv = (rvMap.get(e.evaluationId) ?? 0);
        const cumRv = (cumRvMap.get(e.evaluationId) ?? rv);
        const endDate = (e.marineInfo?.evaluationPeriod?.to || '').slice(0, 10) || '-';
        return [
            i + 1,
            e.marineInfo?.name || '-',
            capitalize(e.occasion || '-'),
            endDate,
            traits['Performance'] || '-',
            traits['Proficiency'] || '-',
            traits['Courage'] || '-',
            traits['Stress Tolerance'] || '-',
            traits['Initiative'] || '-',
            traits['Leading'] || '-',
            traits['Developing Others'] || '-',
            traits['Setting the Example'] || '-',
            traits['Well-Being/Health'] || '-',
            traits['Communication Skills'] || '-',
            traits['Professional Military Education'] || '-',
            traits['Decision Making'] || '-',
            traits['Judgement'] || '-',
            traits['Evals'],
            avg,
            rv,
            cumRv
        ];
    });

    const csv = [headers, ...rows]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `RS_Profile_Grid_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function toggleGridDetails(btn) {
    const row = btn.closest('tr');
    if (!row) return;
    const detailsRow = row.nextElementSibling;
    if (!detailsRow || !detailsRow.classList.contains('grid-details-row')) return;

    const isHidden = detailsRow.style.display === 'none' || !detailsRow.style.display;
    detailsRow.style.display = isHidden ? 'table-row' : 'none';
    btn.textContent = isHidden ? 'Details ▲' : 'Details ▼';
}

function normalizeRankLabel(rank) {
    // Map common rank inputs to the desired display labels
    const map = {
        // Enlisted
        'sgt': 'SGT',
        'ssgt': 'SSGT',
        'gysgt': 'GYSGT',
        'msgt': 'MSGT',
        '1stsgt': '1STSGT',
        '1st sgt': '1STSGT',
        // Warrant
        'wo': 'WO',
        'cwo2': 'CWO2',
        'cwo3': 'CWO3',
        'cwo4': 'CWO4',
        'cwo5': 'CWO5',
        // Officer
        '2ndlt': '2NDLT',
        '2nd lt': '2NDLT',
        '1stlt': '1STLT',
        '1st lt': '1STLT',
        'capt': 'CAPT',
        'maj': 'MAJ',
        'ltcol': 'LTCOL',
        'col': 'COL'
    };
    const key = rank.replace(/\./g, '').replace(/\s+/g, '').toLowerCase();
    return map[key] || rank.toUpperCase();
}

// Show Dashboard directly from the login card
function openProfileDashboardFromLogin() {
    const loginCard = document.getElementById('profileLoginCard');
    const dashboardCard = document.getElementById('profileDashboardCard');

    if (!loginCard || !dashboardCard) {
        console.warn('Profile cards not found in DOM.');
        return;
    }

    const stored = loadProfileFromStorage();
    if (!stored) {
        alert('No saved RS profile found. Please login first or save an evaluation.');
        return;
    }

    // Hydrate session from storage snapshot
    window.currentProfile = {
        rsName: stored.rsName,
        rsEmail: stored.rsEmail,
        rsRank: stored.rsRank,
        totalEvaluations: (stored.evaluations || []).length,
        lastUpdated: stored.lastUpdated || new Date().toISOString()
    };
    window.profileEvaluations = stored.evaluations || [];

    // Render consistently via the dashboard entrypoint
    showProfileDashboard();
}

// Auto-open Dashboard on load if a profile exists
function showProfileDashboardOnLoad() {
    const loginCard = document.getElementById('profileLoginCard');
    const dashboardCard = document.getElementById('profileDashboardCard');
    const modeCard = document.getElementById('modeSelectionCard');
    if (!loginCard || !dashboardCard) return;

    // Only auto-open if the user explicitly logged in in THIS SESSION
    const hasProfile = localStorage.getItem('has_profile') === 'true';
    const loginSource = sessionStorage.getItem('login_source'); // session-scoped, not persistent
    if (!hasProfile || loginSource !== 'form') {
        // Default to Mode Selection on initial load
        if (modeCard) { modeCard.classList.add('active'); modeCard.style.display = 'block'; }
        loginCard.classList.remove('active');
        loginCard.style.display = 'none';
        dashboardCard.classList.remove('active');
        dashboardCard.style.display = 'none';
        
        const setupCard = document.getElementById('setupCard');
        if (setupCard) {
            setupCard.classList.remove('active');
            setupCard.style.display = 'none';
        }
        return;
    }

    const stored = loadProfileFromStorage();
    if (!stored) return;

    window.currentProfile = {
        rsName: stored.rsName,
        rsEmail: stored.rsEmail,
        rsRank: stored.rsRank,
        totalEvaluations: (stored.evaluations || []).length,
        lastUpdated: stored.lastUpdated || new Date().toISOString()
    };
    window.profileEvaluations = stored.evaluations || [];

    showProfileDashboard();

    // Prefer showing Dashboard instead of login/setup when a profile exists
    loginCard.style.display = 'none';
    dashboardCard.style.display = 'block';

    const setupCard = document.getElementById('setupCard');
    if (setupCard) setupCard.style.display = 'none';
}

// Profile persistence helpers and GitHub stubs (added)
function generateProfileKey(name, email) {
    const n = String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const e = String(email || '').toLowerCase().trim();
    return `rs:${n}|${e}`;
}

function loadProfileFromLocal(profileKey) {
    try {
        return JSON.parse(localStorage.getItem(`profile:${profileKey}`) || 'null');
    } catch (err) {
        console.warn('loadProfileFromLocal failed:', err);
        return null;
    }
}

function saveProfileToLocal(profileKey, profile) {
    try {
        localStorage.setItem(`profile:${profileKey}`, JSON.stringify(profile));
    } catch (err) {
        console.warn('saveProfileToLocal failed:', err);
    }
}

function loadEvaluationsFromLocal(profileKey) {
    try {
        return JSON.parse(localStorage.getItem(`evaluations:${profileKey}`) || '[]');
    } catch (err) {
        console.warn('loadEvaluationsFromLocal failed:', err);
        return [];
    }
}

function saveEvaluationsToLocal(profileKey, evaluations) {
    try {
        localStorage.setItem(`evaluations:${profileKey}`, JSON.stringify(evaluations));
    } catch (err) {
        console.warn('saveEvaluationsToLocal failed:', err);
    }
}

// Optional GitHub integration stubs (safe no-ops)
async function fetchProfileFromGitHub(profileKey) {
    // No GitHub configured; return null to keep app fully offline-capable
    return null;
}

function mergeProfiles(local, remote) {
    if (!local) return remote || null;
    if (!remote) return local;
    return {
        ...local,
        ...remote,
        evaluationFiles: Array.from(new Set([...(local.evaluationFiles || []), ...(remote.evaluationFiles || [])])),
        totalEvaluations: Math.max(local.totalEvaluations || 0, remote.totalEvaluations || 0),
        lastUpdated: new Date().toISOString()
    };
}

async function syncEvaluationToGitHub(evaluation) {
    try {
        const userEmail = (currentProfile && currentProfile.rsEmail) || (evaluation?.rsInfo?.email) || '';
        if (!userEmail || userEmail === 'offline@local') {
            console.warn('GitHub sync skipped: no valid user email');
            return false;
        }

        let token = null;
        try {
            token = await githubService.getTokenFromEnvironment?.();
        } catch (e) {
            console.warn('Token retrieval failed:', e);
        }
        if (!token && typeof window !== 'undefined' && window.GITHUB_CONFIG?.token) {
            token = window.GITHUB_CONFIG.token;
        }
        if (!token) {
            console.warn('GitHub sync unavailable: token not found');
            return false;
        }

        githubService.initialize(token);
        const connected = await githubService.verifyConnection?.();
        if (!connected) {
            console.warn('GitHub connection failed; check token scopes and repo access');
            return false;
        }

        const result = await githubService.saveEvaluation(evaluation, userEmail);
        if (result?.success) {
            evaluation.syncStatus = 'synced';
            console.log('Evaluation synced to GitHub:', result.message);
            return true;
        }

        evaluation.syncStatus = 'error';
        console.error('GitHub sync failed:', result?.error || result);
        return false;
    } catch (error) {
        console.error('Error during GitHub sync:', error);
        return false;
    }
}
