// Admin Dashboard Functionality
// This module handles all admin-related operations

// Global state
let adminCredentials = null;
let currentDeleteUser = null;
let currentResetUser = null;

/**
 * Show admin dashboard if user is admin
 */
function showAdminDashboard() {
    const profile = getCurrentProfile();
    if (!profile || !profile.isAdmin) {
        alert('Access denied. Admin privileges required.');
        return;
    }

    // Store admin credentials
    const username = profile.rsEmail || profile.username;
    const password = prompt('Enter your password to access admin dashboard:');

    if (!password) {
        return;
    }

    adminCredentials = { username, password };

    // Hide all other cards
    document.querySelectorAll('.profile-card').forEach(card => {
        card.style.display = 'none';
    });

    // Show admin dashboard
    const adminCard = document.getElementById('adminDashboardCard');
    if (adminCard) {
        adminCard.style.display = 'block';
    }

    // Load initial overview data
    loadAdminOverview();
}

/**
 * Go back to profile dashboard
 */
function backToProfileDashboard() {
    const adminCard = document.getElementById('adminDashboardCard');
    if (adminCard) {
        adminCard.style.display = 'none';
    }

    const profileCard = document.getElementById('profileDashboardCard');
    if (profileCard) {
        profileCard.style.display = 'block';
    }

    // Clear admin credentials
    adminCredentials = null;
}

/**
 * Switch between admin tabs
 */
function showAdminTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const targetTab = document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Load data for the tab
    if (tabName === 'overview') {
        loadAdminOverview();
    } else if (tabName === 'users') {
        loadAllUsers();
    } else if (tabName === 'analytics') {
        loadAnalytics();
    }
}

/**
 * Load admin overview data
 */
async function loadAdminOverview() {
    if (!adminCredentials) {
        console.error('No admin credentials available');
        return;
    }

    try {
        const apiBase = window.API_BASE_URL || window.location.origin;
        const response = await fetch(`${apiBase}/api/admin/analytics`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(adminCredentials)
        });

        if (!response.ok) {
            throw new Error(`Failed to load analytics: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.ok && data.analytics) {
            updateOverviewStats(data.analytics);
        }
    } catch (error) {
        console.error('Error loading admin overview:', error);
        alert('Failed to load admin overview: ' + error.message);
    }
}

/**
 * Update overview statistics
 */
function updateOverviewStats(analytics) {
    document.getElementById('adminTotalUsers').textContent = analytics.totalUsers || 0;
    document.getElementById('adminTotalEvaluations').textContent = analytics.totalEvaluations || 0;
    document.getElementById('adminAvgScore').textContent = analytics.averageFitrepScore || '0.00';
}

/**
 * Load all users for user management
 */
async function loadAllUsers() {
    if (!adminCredentials) {
        console.error('No admin credentials available');
        return;
    }

    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Loading users...</td></tr>';

    try {
        const apiBase = window.API_BASE_URL || window.location.origin;
        const response = await fetch(`${apiBase}/api/admin/users/list`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(adminCredentials)
        });

        if (!response.ok) {
            throw new Error(`Failed to load users: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.ok && data.users) {
            displayUsers(data.users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #d32f2f;">Failed to load users: ${error.message}</td></tr>`;
    }
}

/**
 * Display users in the table
 */
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const createdDate = user.createdDate ? new Date(user.createdDate).toLocaleDateString() : 'N/A';
        const lastUpdated = user.lastUpdated ? new Date(user.lastUpdated).toLocaleDateString() : 'N/A';
        const isAdmin = user.isAdmin ? '✓' : '';

        return `
            <tr>
                <td>${escapeHtml(user.rsEmail || 'N/A')}</td>
                <td>${escapeHtml(user.rsName || 'N/A')}</td>
                <td>${escapeHtml(user.rsRank || 'N/A')}</td>
                <td>${createdDate}</td>
                <td>${lastUpdated}</td>
                <td style="text-align: center;">${isAdmin}</td>
                <td>
                    <button class="btn-small" onclick="openResetPasswordModal('${escapeHtml(user.rsEmail)}')">Reset Password</button>
                    <button class="btn-small btn-danger" onclick="openDeleteUserModal('${escapeHtml(user.rsEmail)}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Load analytics data
 */
async function loadAnalytics() {
    if (!adminCredentials) {
        console.error('No admin credentials available');
        return;
    }

    try {
        const apiBase = window.API_BASE_URL || window.location.origin;
        const response = await fetch(`${apiBase}/api/admin/analytics`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(adminCredentials)
        });

        if (!response.ok) {
            throw new Error(`Failed to load analytics: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.ok && data.analytics) {
            displayAnalytics(data.analytics);
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
        alert('Failed to load analytics: ' + error.message);
    }
}

/**
 * Display analytics charts
 */
function displayAnalytics(analytics) {
    // Display rank chart
    const rankChart = document.getElementById('rankChart');
    if (rankChart && analytics.evaluationsByRank) {
        rankChart.innerHTML = createBarChart(analytics.evaluationsByRank, 'Rank');
    }

    // Display occasion chart
    const occasionChart = document.getElementById('occasionChart');
    if (occasionChart && analytics.evaluationsByOccasion) {
        occasionChart.innerHTML = createBarChart(analytics.evaluationsByOccasion, 'Occasion');
    }
}

/**
 * Create a simple bar chart from data
 */
function createBarChart(data, label) {
    const entries = Object.entries(data);
    if (entries.length === 0) {
        return '<p style="text-align: center; color: #666;">No data available</p>';
    }

    const maxValue = Math.max(...entries.map(([_, value]) => value));

    return `
        <div class="bar-chart">
            ${entries.map(([key, value]) => {
                const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
                return `
                    <div class="bar-item">
                        <div class="bar-label">${escapeHtml(key)}</div>
                        <div class="bar-container">
                            <div class="bar-fill" style="width: ${percentage}%"></div>
                            <div class="bar-value">${value}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Open delete user modal
 */
function openDeleteUserModal(username) {
    currentDeleteUser = username;
    document.getElementById('deleteUsername').textContent = username;
    document.getElementById('deleteUserModal').style.display = 'flex';
}

/**
 * Close delete user modal
 */
function closeDeleteUserModal() {
    currentDeleteUser = null;
    document.getElementById('deleteUserModal').style.display = 'none';
}

/**
 * Confirm delete user
 */
async function confirmDeleteUser() {
    if (!currentDeleteUser || !adminCredentials) {
        return;
    }

    try {
        const apiBase = window.API_BASE_URL || window.location.origin;
        const response = await fetch(`${apiBase}/api/admin/users/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...adminCredentials,
                targetUsername: currentDeleteUser
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete user');
        }

        const data = await response.json();
        if (data.ok) {
            alert('User deleted successfully');
            closeDeleteUserModal();
            loadAllUsers();
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user: ' + error.message);
    }
}

/**
 * Open reset password modal
 */
function openResetPasswordModal(username) {
    currentResetUser = username;
    document.getElementById('resetUsername').textContent = username;
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';
    document.getElementById('resetPasswordModal').style.display = 'flex';
}

/**
 * Close reset password modal
 */
function closeResetPasswordModal() {
    currentResetUser = null;
    document.getElementById('resetPasswordModal').style.display = 'none';
}

/**
 * Confirm reset password
 */
async function confirmResetPassword() {
    if (!currentResetUser || !adminCredentials) {
        return;
    }

    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;

    if (!newPassword || !confirmPassword) {
        alert('Please enter and confirm the new password');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    if (newPassword.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
    }

    try {
        const apiBase = window.API_BASE_URL || window.location.origin;
        const response = await fetch(`${apiBase}/api/admin/users/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...adminCredentials,
                targetUsername: currentResetUser,
                newPassword: newPassword
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to reset password');
        }

        const data = await response.json();
        if (data.ok) {
            alert('Password reset successfully');
            closeResetPasswordModal();
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        alert('Failed to reset password: ' + error.message);
    }
}

/**
 * Get current profile from localStorage
 */
function getCurrentProfile() {
    try {
        const profileStr = localStorage.getItem('userProfile');
        if (!profileStr) return null;
        return JSON.parse(profileStr);
    } catch (error) {
        console.error('Error getting current profile:', error);
        return null;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Initialize admin dashboard when profile is loaded
window.addEventListener('DOMContentLoaded', () => {
    // Check if user is admin and show admin button
    const profile = getCurrentProfile();
    if (profile && profile.isAdmin) {
        const adminBtn = document.getElementById('adminDashboardBtn');
        if (adminBtn) {
            adminBtn.style.display = 'inline-block';
        }
    }
});
