# GitHub Data Persistence Integration

## Overview

This document explains how to configure and use the secure GitHub data persistence feature for the USMC FITREP Evaluator. This feature allows user profiles and evaluation records to be securely stored in a private GitHub repository.

## Architecture

### Components

1. **GitHub Service Module** (`js/githubService.js`)
   - Handles GitHub API authentication
   - Provides data serialization and Base64 encoding
   - Manages file creation and updates via GitHub Contents API

2. **Profile Integration** (`js/profile.js`)
   - Integrates with GitHub service for sync operations
   - Manages local/remote data merging
   - Handles offline-first architecture

### Data Flow

```
User Data (Browser) → Serialize to JSON → Base64 Encode → GitHub Contents API → Repository
```

## Configuration

### Prerequisites

1. **GitHub Personal Access Token (PAT)**
   - Token name: `FITREP_DATA`
   - Required scopes: `repo` (full control of private repositories)
   - Create at: https://github.com/settings/tokens

2. **Target Repository**
   - Repository: `https://github.com/SemperAdmin/Fitness-Report-Evaluator-Data`
   - Must be a **private** repository
   - Service account should have write access

### Security Best Practices

⚠️ **CRITICAL SECURITY REQUIREMENTS:**

1. **NEVER** commit the GitHub PAT to version control
2. **NEVER** expose the PAT in client-side code
3. **ALWAYS** use a secure backend proxy for client-side applications
4. **ALWAYS** use environment variables for server-side deployments

## Implementation Approaches

### Approach 1: Backend API Proxy (RECOMMENDED for Production)

This is the most secure approach for client-side applications.

#### 1.1 Create Backend API Endpoint

**Node.js/Express Example:**

```javascript
// server.js
const express = require('express');
const app = express();

// Secure endpoint to provide GitHub operations
app.get('/api/github-token', (req, res) => {
    // Verify user authentication first
    if (!req.session || !req.session.authenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Return token from environment variable
    res.json({ token: process.env.FITREP_DATA });
});

// Proxy GitHub API calls
app.post('/api/github/save-data', async (req, res) => {
    const { userData } = req.body;

    // Validate and sanitize input
    // Make GitHub API call using FITREP_DATA from environment
    // Return result to client
});

app.listen(3000);
```

**Environment Configuration:**

```bash
# .env file (NEVER commit this!)
FITREP_DATA=ghp_your_personal_access_token_here
```

#### 1.2 Configure Client Application

The client application will automatically use the `/api/github-token` endpoint when available.

### Approach 2: Serverless Functions

**Netlify Functions Example:**

```javascript
// netlify/functions/github-token.js
exports.handler = async (event, context) => {
    // Verify authentication
    if (!context.clientContext?.user) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            token: process.env.FITREP_DATA
        })
    };
};
```

**Netlify Environment Variables:**
```bash
# Configure in Netlify dashboard or netlify.toml
FITREP_DATA=ghp_your_personal_access_token_here
```

### Approach 3: GitHub Actions

For automated backups and data processing via GitHub Actions.

**Workflow Example:**

```yaml
# .github/workflows/sync-data.yml
name: Sync Evaluation Data

on:
  workflow_dispatch:
    inputs:
      userData:
        description: 'User data JSON'
        required: true

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Sync Data to Repository
        env:
          FITREP_DATA: ${{ secrets.FITREP_DATA }}
        run: |
          node scripts/sync-data.js
```

**Secrets Configuration:**
1. Go to repository Settings → Secrets and variables → Actions
2. Add new repository secret: `FITREP_DATA`
3. Paste your GitHub PAT

### Approach 4: Development/Testing

For development and testing purposes only (NOT for production):

```javascript
// Create a local config file (add to .gitignore!)
// config/github.local.js
window.GITHUB_CONFIG = {
    token: 'ghp_your_dev_token_here'  // ONLY for local testing
};

// Initialize in application
if (window.GITHUB_CONFIG?.token) {
    githubService.initialize(window.GITHUB_CONFIG.token);
}
```

⚠️ **Add to .gitignore:**
```
config/github.local.js
.env
*.local.js
```

## Usage

### Initialize GitHub Service

The service initializes automatically on page load. Manual initialization:

```javascript
// Get token from secure source
const token = await githubService.getTokenFromEnvironment();

// Initialize service
if (token) {
    githubService.initialize(token);

    // Verify connection
    const isConnected = await githubService.verifyConnection();
    console.log('GitHub connected:', isConnected);
}
```

### Save User Profile and Evaluations

```javascript
// Prepare user data
const userData = {
    rsName: 'Smith, John A',
    rsEmail: 'john.smith@usmc.mil',
    rsRank: 'Capt',
    evaluations: [
        {
            evaluationId: 'eval-2024-01-15',
            marineInfo: {
                name: 'Doe, Jane M',
                rank: 'SSgt',
                evaluationPeriod: {
                    from: '2023-06-01',
                    to: '2024-05-31'
                }
            },
            // ... other evaluation data
        }
    ]
};

// Save to GitHub
const result = await githubService.saveUserData(userData);

if (result.success) {
    console.log('Data saved:', result.message);
    console.log('File path:', result.filePath);
} else {
    console.error('Save failed:', result.error);
}
```

### Load User Profile and Evaluations

```javascript
const userData = await githubService.loadUserData('john.smith@usmc.mil');

if (userData) {
    console.log('Profile loaded:', userData.profile);
    console.log('Evaluations count:', userData.evaluations.length);
} else {
    console.log('No data found for this user');
}
```

### Sync Single Evaluation

```javascript
const evaluation = {
    evaluationId: 'eval-2024-01-15',
    rsInfo: {
        name: 'Smith, John A',
        email: 'john.smith@usmc.mil',
        rank: 'Capt'
    },
    // ... other evaluation data
};

const result = await githubService.saveEvaluation(
    evaluation,
    'john.smith@usmc.mil'
);

console.log('Sync result:', result.message);
```

## Data Structure

### Repository Structure

```
Fitness-Report-Evaluator-Data/
├── users/
│   ├── john_smith.json
│   ├── jane_doe.json
│   └── ...
└── README.md
```

### File Format

Each user file (`[user_id].json`) contains:

```json
{
  "version": "1.0",
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "profile": {
    "rsName": "Smith, John A",
    "rsEmail": "john.smith@usmc.mil",
    "rsRank": "Capt",
    "totalEvaluations": 5
  },
  "evaluations": [
    {
      "evaluationId": "eval-2024-01-15T12-00-00",
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
        "performance": {
          "trait": "Performance",
          "grade": "D",
          "gradeNumber": 4,
          "justification": "Consistently exceeds expectations..."
        }
        // ... other traits
      },
      "sectionIComments": "...",
      "directedComments": "...",
      "savedToProfile": true,
      "syncStatus": "synced"
    }
    // ... more evaluations
  ],
  "metadata": {
    "exportedAt": "2024-01-15T10:30:00.000Z",
    "exportedBy": "Smith, John A",
    "applicationVersion": "1.0"
  }
}
```

## API Reference

### GitHubDataService Class

#### Methods

##### `initialize(token)`
Initialize the service with GitHub PAT.

**Parameters:**
- `token` (string): GitHub Personal Access Token

**Returns:** `boolean` - Success status

##### `serializeData(userData)`
Serialize user data to JSON string.

**Parameters:**
- `userData` (Object): User profile and evaluations

**Returns:** `string` - JSON string

##### `encodeToBase64(content)`
Encode string content to Base64 (required by GitHub API).

**Parameters:**
- `content` (string): Content to encode

**Returns:** `string` - Base64 encoded string

##### `createOrUpdateFile(filePath, content, commitMessage, sha)`
Create or update file in GitHub repository.

**Parameters:**
- `filePath` (string): Path in repository (e.g., "users/john_smith.json")
- `content` (string): File content
- `commitMessage` (string): Git commit message
- `sha` (string|null): File SHA for updates, null for new files

**Returns:** `Promise<Object>` - GitHub API response

##### `saveUserData(userData)`
Save complete user profile and evaluations.

**Parameters:**
- `userData` (Object): User profile and evaluations object

**Returns:** `Promise<Object>` - Result object with success status

##### `loadUserData(userEmail)`
Load user profile and evaluations from GitHub.

**Parameters:**
- `userEmail` (string): User's email address

**Returns:** `Promise<Object|null>` - User data or null if not found

##### `saveEvaluation(evaluation, userEmail)`
Save single evaluation to user's data file.

**Parameters:**
- `evaluation` (Object): Evaluation object
- `userEmail` (string): User's email address

**Returns:** `Promise<Object>` - Result object

##### `verifyConnection()`
Verify GitHub connection and authentication.

**Returns:** `Promise<boolean>` - Connection status

## Error Handling

The service includes comprehensive error handling:

```javascript
try {
    const result = await githubService.saveUserData(userData);

    if (result.success) {
        // Handle success
        console.log('Saved:', result.message);
    } else {
        // Handle failure
        console.error('Failed:', result.error);
        alert(`Save failed: ${result.message}`);
    }

} catch (error) {
    // Handle exceptions
    console.error('Unexpected error:', error);
    alert('An unexpected error occurred. Please try again.');
}
```

### Common Error Scenarios

1. **Authentication Failure**
   - Error: "GitHub API error: Bad credentials"
   - Solution: Verify PAT is valid and has correct scopes

2. **Repository Not Found**
   - Error: "GitHub API error: Not Found"
   - Solution: Verify repository exists and token has access

3. **Rate Limiting**
   - Error: "API rate limit exceeded"
   - Solution: Implement exponential backoff, use authenticated requests

4. **Network Errors**
   - Error: "Failed to fetch"
   - Solution: Check internet connection, verify CORS settings

## Testing

### Unit Tests

```javascript
// Test data serialization
const userData = {
    rsName: 'Test User',
    rsEmail: 'test@example.com',
    rsRank: 'Capt',
    evaluations: []
};

const json = githubService.serializeData(userData);
console.assert(json.includes('"version":"1.0"'), 'Version included');
console.assert(json.includes('"rsName":"Test User"'), 'User data included');

// Test Base64 encoding
const original = 'Hello, World!';
const encoded = githubService.encodeToBase64(original);
const decoded = githubService.decodeFromBase64(encoded);
console.assert(original === decoded, 'Encode/decode works');
```

### Integration Tests

```javascript
// Test GitHub connection
async function testGitHubIntegration() {
    // Initialize with test token
    const token = process.env.FITREP_DATA_TEST;
    githubService.initialize(token);

    // Verify connection
    const connected = await githubService.verifyConnection();
    console.assert(connected, 'GitHub connection successful');

    // Test save operation
    const testData = {
        rsName: 'Test User',
        rsEmail: 'test@example.com',
        rsRank: 'Capt',
        evaluations: []
    };

    const result = await githubService.saveUserData(testData);
    console.assert(result.success, 'Save operation successful');

    // Test load operation
    const loaded = await githubService.loadUserData('test@example.com');
    console.assert(loaded !== null, 'Load operation successful');
    console.assert(loaded.profile.rsName === 'Test User', 'Data integrity verified');
}

testGitHubIntegration().catch(console.error);
```

## Monitoring and Logging

The service includes built-in logging:

```javascript
// Success logs
console.log('✓ GitHub sync available');
console.log('File created/updated successfully:', filePath);
console.log('Evaluation synced to GitHub:', message);

// Warning logs
console.warn('GitHub token found but connection failed');
console.warn('No user email in evaluation, cannot sync');

// Error logs
console.error('Failed to sync evaluation:', error);
console.error('Error saving user data to GitHub:', error);
```

Monitor these logs in production to track:
- Sync success/failure rates
- Authentication issues
- Network connectivity problems
- Data integrity issues

## Security Considerations

1. **Token Security**
   - Rotate PATs regularly (every 90 days recommended)
   - Use fine-grained tokens with minimal scopes
   - Monitor token usage in GitHub settings

2. **Data Privacy**
   - All evaluation data is PII - ensure repository is private
   - Implement access controls on backend endpoints
   - Use HTTPS for all communications
   - Consider encryption at rest for sensitive data

3. **Audit Trail**
   - All GitHub commits create an audit trail
   - Review commit history regularly
   - Use signed commits for verification

4. **Access Control**
   - Limit repository access to essential personnel
   - Use branch protection rules
   - Implement code review for repository changes

## Troubleshooting

### Service Not Initializing

**Symptom:** Console shows "GitHub service not initialized"

**Solutions:**
1. Check if `githubService.js` is loaded before `profile.js`
2. Verify token is available from environment
3. Check browser console for JavaScript errors

### Sync Failing

**Symptom:** Evaluations not syncing to GitHub

**Solutions:**
1. Check network connectivity
2. Verify GitHub token is valid
3. Check repository permissions
4. Review error messages in console

### Data Not Loading

**Symptom:** Profile data not loading from GitHub

**Solutions:**
1. Verify file exists in repository
2. Check file path format
3. Ensure token has read permissions
4. Verify JSON format is valid

## Support

For issues with GitHub integration:

1. Check console logs for detailed error messages
2. Verify token permissions and expiration
3. Review this documentation for configuration steps
4. Contact repository maintainers for assistance

## License

This integration follows the same license as the main application.

## Changelog

### Version 1.0 (2024-01-15)
- Initial implementation
- GitHub Contents API integration
- Data serialization and Base64 encoding
- Automatic sync functionality
- Offline-first architecture
- Comprehensive error handling
