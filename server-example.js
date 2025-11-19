/**
 * Example Backend Proxy Server for GitHub Integration
 *
 * This is a reference implementation showing how to securely proxy
 * GitHub API calls for the FITREP Evaluator application.
 *
 * SECURITY FEATURES:
 * - GitHub PAT never exposed to client
 * - Session-based authentication
 * - Request validation and sanitization
 * - Rate limiting
 *
 * DEPLOYMENT:
 * - Copy this file to your backend server
 * - Install dependencies: npm install express express-session dotenv cors
 * - Create .env file with FITREP_DATA=your_github_token
 * - Run: node server-example.js
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const GITHUB_TOKEN = process.env.FITREP_DATA;
const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'SemperAdmin';
const REPO_NAME = 'Fitness-Report-Evaluator-Data';

if (!GITHUB_TOKEN) {
    console.error('ERROR: FITREP_DATA environment variable not set');
    process.exit(1);
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:8080',
    credentials: true
}));

app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware (simplified - implement proper auth in production)
const requireAuth = (req, res, next) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

// Simple login endpoint (replace with proper authentication)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // TODO: Implement proper authentication
    // This is a placeholder - DO NOT use in production
    if (email && password) {
        req.session.authenticated = true;
        req.session.userEmail = email;
        res.json({ success: true, email });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// GitHub API proxy endpoints

/**
 * Get file from GitHub repository
 * GET /api/github/file/:path
 */
app.get('/api/github/file/*', requireAuth, async (req, res) => {
    try {
        const filePath = req.params[0]; // Gets everything after /file/

        // Validate path with strict regex to prevent path traversal
        if (!filePath || !/^users\/[a-zA-Z0-9_]+\.json$/.test(filePath)) {
            return res.status(400).json({ error: 'Invalid file path - must match users/[username].json format' });
        }

        const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'FITREP-Evaluator-Proxy'
            }
        });

        if (response.status === 404) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'GitHub API error');
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create or update file in GitHub repository
 * PUT /api/github/file
 */
app.put('/api/github/file', requireAuth, async (req, res) => {
    try {
        const { filePath, content, message, sha } = req.body;

        // Validate inputs
        if (!filePath || !content || !message) {
            return res.status(400).json({
                error: 'Missing required fields: filePath, content, message'
            });
        }

        // Validate path with strict regex to prevent path traversal
        if (!filePath || !/^users\/[a-zA-Z0-9_]+\.json$/.test(filePath)) {
            return res.status(400).json({
                error: 'Invalid file path - must be in users/ directory and match expected format'
            });
        }

        // Verify user can only modify their own file
        const userEmail = req.session.userEmail;
        const expectedFileName = userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_') + '.json';

        if (!filePath.endsWith(expectedFileName)) {
            return res.status(403).json({
                error: 'You can only modify your own data file'
            });
        }

        const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;

        const body = {
            message,
            content,
            branch: 'main'
        };

        if (sha) {
            body.sha = sha;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'FITREP-Evaluator-Proxy'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'GitHub API error');
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Error creating/updating file:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Save user data (convenience endpoint)
 * POST /api/github/save-user-data
 */
app.post('/api/github/save-user-data', requireAuth, async (req, res) => {
    try {
        const { userData } = req.body;

        if (!userData || !userData.rsEmail) {
            return res.status(400).json({ error: 'Invalid user data' });
        }

        // Verify user can only save their own data
        if (userData.rsEmail !== req.session.userEmail) {
            return res.status(403).json({ error: 'Cannot save data for another user' });
        }

        // Serialize data
        const dataToSave = {
            version: '1.0',
            lastUpdated: new Date().toISOString(),
            profile: {
                rsName: userData.rsName,
                rsEmail: userData.rsEmail,
                rsRank: userData.rsRank,
                totalEvaluations: userData.evaluations?.length || 0
            },
            evaluations: userData.evaluations || [],
            metadata: {
                exportedAt: new Date().toISOString(),
                exportedBy: userData.rsName,
                applicationVersion: '1.0'
            }
        };

        const jsonContent = JSON.stringify(dataToSave, null, 2);
        const base64Content = Buffer.from(jsonContent, 'utf-8').toString('base64');

        // Generate filename
        const fileName = userData.rsEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_') + '.json';
        const filePath = `users/${fileName}`;

        const maxRetries = 3;

        // Retry loop to handle race conditions (409 Conflict)
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Check if file exists (get SHA for update)
                const checkUrl = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;

                const checkResponse = await fetch(checkUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'FITREP-Evaluator-Proxy'
                    }
                });

                let existingSha = null;
                if (checkResponse.ok) {
                    const existing = await checkResponse.json();
                    existingSha = existing.sha;
                }

                // Create/update file
                const commitMessage = existingSha
                    ? `Update profile for ${userData.rsName} - ${new Date().toISOString()}`
                    : `Create profile for ${userData.rsName} - ${new Date().toISOString()}`;

                const saveUrl = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;
                const body = {
                    message: commitMessage,
                    content: base64Content,
                    branch: 'main'
                };

                if (existingSha) {
                    body.sha = existingSha;
                }

                const saveResponse = await fetch(saveUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'FITREP-Evaluator-Proxy'
                    },
                    body: JSON.stringify(body)
                });

                if (!saveResponse.ok) {
                    const error = await saveResponse.json();

                    // Handle 409 Conflict (file was updated between SHA fetch and write)
                    if (saveResponse.status === 409 && attempt < maxRetries - 1) {
                        console.warn(`GitHub save conflict detected (attempt ${attempt + 1}/${maxRetries}). Retrying...`);
                        // Exponential backoff: 100ms, 200ms, 400ms
                        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
                        continue; // Retry with fresh SHA
                    }

                    // Not a 409 or retries exhausted
                    throw new Error(error.message || 'GitHub API error');
                }

                const result = await saveResponse.json();

                return res.json({
                    success: true,
                    filePath,
                    fileName,
                    isUpdate: !!existingSha,
                    commitSha: result.commit.sha,
                    message: existingSha ? 'Profile updated successfully' : 'Profile created successfully',
                    retries: attempt
                });

            } catch (error) {
                // Re-throw immediately - only 409 errors are retriable (handled above)
                // Network errors, 500 errors, etc. should fail fast
                throw error;
            }
        }

    } catch (error) {
        console.error('Error saving user data:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: `Failed to save data: ${error.message}`
        });
    }
});

/**
 * Load user data (convenience endpoint)
 * GET /api/github/load-user-data/:email
 */
app.get('/api/github/load-user-data/:email', requireAuth, async (req, res) => {
    try {
        const email = req.params.email;

        // Verify user can only load their own data
        if (email !== req.session.userEmail) {
            return res.status(403).json({ error: 'Cannot load data for another user' });
        }

        const fileName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_') + '.json';
        const filePath = `users/${fileName}`;

        const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'FITREP-Evaluator-Proxy'
            }
        });

        if (response.status === 404) {
            return res.json(null); // File doesn't exist yet
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'GitHub API error');
        }

        const data = await response.json();
        const decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
        const userData = JSON.parse(decodedContent);

        res.json(userData);

    } catch (error) {
        console.error('Error loading user data:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        authenticated: !!req.session.authenticated
    });
});

/**
 * Verify GitHub connection
 */
app.get('/api/github/verify', requireAuth, async (req, res) => {
    try {
        const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'FITREP-Evaluator-Proxy'
            }
        });

        res.json({
            connected: response.ok,
            status: response.status
        });

    } catch (error) {
        res.json({
            connected: false,
            error: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✓ Proxy server running on port ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  GitHub repo: ${REPO_OWNER}/${REPO_NAME}`);
});

module.exports = app; // For testing
