# Admin Dashboard Setup Guide

This guide explains how to set up and configure admin access for the Fitness Report Evaluator admin dashboard.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (5 Minutes)](#quick-start-5-minutes)
3. [Detailed Setup](#detailed-setup)
4. [Environment Variables](#environment-variables)
5. [Admin User Configuration](#admin-user-configuration)
6. [Accessing the Dashboard](#accessing-the-dashboard)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before setting up the admin dashboard, ensure you have:

- ✅ Server deployed and running (Render, Vercel, or local)
- ✅ GitHub data repository configured (`FITREP_DATA` token set)
- ✅ Admin user account created in the main application
- ✅ Access to deployment environment variables

---

## Quick Start (5 Minutes)

### Step 1: Set Environment Variable

Add this environment variable to your deployment (Render.com, Vercel, etc.):

```bash
ADMIN_USERNAME=semperadmin
```

**Note:** Replace `semperadmin` with your actual admin username (lowercase).

### Step 2: Create Admin User Profile (Optional)

If you want additional security with the `isAdmin` flag:

1. Go to your GitHub data repository: `https://github.com/SemperAdmin/Fitness-Report-Evaluator-Data`
2. Navigate to `users/semperadmin.json` (or your admin username)
3. Edit the file and add `"isAdmin": true`:

```json
{
  "rsEmail": "semperadmin",
  "rsName": "System Administrator",
  "rsRank": "Administrator",
  "passwordHash": "...",
  "createdDate": "2025-01-15T10:00:00.000Z",
  "lastUpdated": "2025-01-15T10:00:00.000Z",
  "isAdmin": true
}
```

4. Commit the changes

### Step 3: Access the Dashboard

1. **Login** to the main application using your admin credentials
2. **Navigate** to `/admin.html` (e.g., `https://fitness-report-evaluator.onrender.com/admin.html`)
3. You should see the admin dashboard!

---

## Detailed Setup

### 1. Create Admin User Account

If you haven't already created your admin user account:

**Option A: Via Main Application UI**

1. Go to your application URL
2. Click "Create Account"
3. Fill in details:
   - Username: `semperadmin` (or your chosen username)
   - Name: Your name
   - Rank: Administrator
   - Password: Strong password (8+ chars, upper, lower, digit)
4. Click "Create Account"

**Option B: Via GitHub Actions Workflow**

Create a file in `.github/workflows/create-admin.yml`:

```yaml
name: Create Admin User
on:
  workflow_dispatch:
    inputs:
      username:
        description: 'Admin username'
        required: true
        default: 'semperadmin'
jobs:
  create-admin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Create admin user file
        run: |
          mkdir -p users
          cat > users/${{ github.event.inputs.username }}.json <<EOF
          {
            "rsEmail": "${{ github.event.inputs.username }}",
            "rsName": "System Administrator",
            "rsRank": "Administrator",
            "passwordHash": "",
            "createdDate": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
            "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
            "isAdmin": true
          }
          EOF
```

**Note:** You'll still need to set a password via the login flow.

### 2. Configure Environment Variables

Set the following environment variable in your deployment platform:

#### Render.com

1. Go to your service dashboard
2. Click "Environment"
3. Add:
   - **Key:** `ADMIN_USERNAME`
   - **Value:** `semperadmin` (your admin username, lowercase)
4. Click "Save Changes"
5. Service will auto-deploy with new config

#### Vercel

```bash
vercel env add ADMIN_USERNAME
# Enter: semperadmin
```

Or via Vercel Dashboard:
1. Project Settings → Environment Variables
2. Add `ADMIN_USERNAME` = `semperadmin`

#### Local Development

Add to `.env` file:

```bash
ADMIN_USERNAME=semperadmin
```

### 3. Optional: Add isAdmin Flag to User Profile

For additional security (defense-in-depth), add the `isAdmin` flag:

1. Navigate to your data repository: `https://github.com/YOUR_ORG/Fitness-Report-Evaluator-Data`
2. Go to `users/{username}.json`
3. Edit the file and add `"isAdmin": true`
4. Commit changes

**Example:**

```json
{
  "rsEmail": "semperadmin",
  "rsName": "Jane Doe",
  "rsRank": "SSgt",
  "passwordHash": "$2a$12$...",
  "createdDate": "2025-01-15T10:00:00.000Z",
  "lastUpdated": "2025-01-15T15:30:00.000Z",
  "isAdmin": true
}
```

**Security Note:** The system checks both `ADMIN_USERNAME` environment variable AND the `isAdmin` flag. If `isAdmin` is explicitly set to `false`, access will be denied even if the username matches.

---

## Environment Variables

### Required

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `ADMIN_USERNAME` | Username of the admin account | `semperadmin` | `semperadmin` |

### Optional (for enhanced features)

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `FITREP_DATA` | GitHub PAT for data repo access | `ghp_xxxx...` | - |
| `AUDIT_LOG_FILE` | Enable file-based audit logging | `true` | `false` |
| `AUDIT_LOG_DIR` | Directory for audit logs | `/var/log/fitrep` | `/tmp/fitrep-audit` |

---

## Accessing the Dashboard

### Via Browser

1. **Login** to the main application first using your admin credentials
2. **Navigate** to the admin dashboard:
   - Production: `https://your-domain.com/admin.html`
   - Local: `http://localhost:10000/admin.html`

### What You'll See

Upon successful access, you'll see:

- **Overview Tab:** User counts, evaluation metrics, top users, recent registrations
- **Users Tab:** Paginated user list with search, filter, sort, and management actions
- **Analytics Tab:** Charts for grade distribution, performance tiers, section averages

### Available Actions

- **View User:** See profile and recent evaluations
- **Soft Delete:** Mark user as deleted (preserves data)
- **Hard Delete:** Permanently remove user and all evaluations (creates audit trail)

**Note:** User editing (update name, username, rank) is planned for a future release.

---

## Security Considerations

### Authentication Flow

1. User logs in via main app (`/api/account/login`)
2. Server issues HMAC-signed session cookie (`fitrep_session`)
3. Admin routes verify session token and check `ADMIN_USERNAME`
4. Optional: Verify `isAdmin` flag in user profile

### Rate Limiting

Admin endpoints have rate limiting to prevent abuse:

- **Auth endpoints** (session, logout): 10 requests/minute
- **Read endpoints** (GET): 60 requests/minute
- **Write endpoints** (DELETE): 20 requests/minute

### Audit Logging

All admin actions are logged with:

- ✅ Timestamp
- ✅ Admin username
- ✅ Action performed
- ✅ Target user/resource
- ✅ IP address
- ✅ Severity level (info, warning, critical)

**Critical actions** (hard delete) automatically create GitHub issues for audit trail.

### Best Practices

1. **Use a strong admin password** (12+ characters, mixed case, numbers, symbols)
2. **Limit admin access** to trusted personnel only
3. **Monitor audit logs** regularly for suspicious activity
4. **Use HTTPS** in production (enforced via `COOKIE_SECURE`)
5. **Rotate admin password** periodically
6. **Enable `isAdmin` flag** for defense-in-depth security

---

## Troubleshooting

### Issue: "Not authenticated" error

**Symptoms:** `/admin.html` returns 401 or redirects to login

**Solutions:**
1. **Login first** via the main app at `/login.html`
2. Check that session cookie is set (browser DevTools → Application → Cookies)
3. Verify `fitrep_session` cookie exists and is not expired

### Issue: "Forbidden: Admin access required"

**Symptoms:** Logged in, but admin routes return 403

**Solutions:**
1. **Check `ADMIN_USERNAME` environment variable:**
   ```bash
   # Should match your username (lowercase)
   echo $ADMIN_USERNAME
   ```
2. **Verify username matches** (case-insensitive):
   - Environment: `semperadmin`
   - Logged in as: `SemperAdmin` ✅ (will match)
   - Logged in as: `johndoe` ❌ (will not match)
3. **Check `isAdmin` flag** in user profile (if set):
   - If `isAdmin: false`, access will be denied
   - Remove the flag or set to `true`

### Issue: Routes return 404

**Symptoms:** `/api/admin/*` endpoints return "Not Found"

**Solutions:**
1. **Verify server deployment** completed successfully
2. **Check server logs** for admin routes mounting:
   ```
   [admin] Admin routes mounted at /api/admin
   ```
3. **Restart server** if hot-reload didn't pick up changes
4. **Check `server/admin-routes.js`** file exists

### Issue: Admin dashboard shows no data

**Symptoms:** Dashboard loads but shows 0 users, 0 evaluations

**Solutions:**
1. **Check `FITREP_DATA` environment variable** is set
2. **Verify GitHub data repository** has user files in `users/` directory
3. **Check GitHub API rate limits** (60/hour for unauthenticated)
4. **Review server logs** for GitHub API errors

### Issue: Cannot hard-delete users

**Symptoms:** Hard delete button returns error

**Solutions:**
1. **Cannot delete admin account:** System prevents deleting the primary admin (safety feature)
2. **Check `FITREP_DATA` token permissions:** Needs write access to data repo
3. **GitHub API errors:** Check server logs for detailed error messages

### Debug Mode

Enable detailed logging by setting:

```bash
NODE_ENV=development
```

This will:
- Log all admin requests
- Show detailed error messages
- Enable console audit logs

---

## Advanced Configuration

### Multiple Admin Users

To support multiple admin users, modify the `requireAdmin()` function in `server/admin-routes.js`:

```javascript
// Support multiple admins via comma-separated list
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || 'semperadmin')
  .toLowerCase()
  .split(',')
  .map(u => u.trim());

if (!ADMIN_USERNAMES.includes(currentUser)) {
  return res.status(403).json({ error: 'Forbidden: Admin access required' });
}
```

Then set environment variable:

```bash
ADMIN_USERNAMES=semperadmin,johndoe,janedoe
```

### Custom Audit Log Location

Set custom audit log directory:

```bash
AUDIT_LOG_DIR=/var/log/fitness-evaluator/audit
AUDIT_LOG_FILE=true
```

Logs will be written to daily files:
- `/var/log/fitness-evaluator/audit/admin-audit-2025-01-15.jsonl`
- `/var/log/fitness-evaluator/audit/admin-audit-2025-01-16.jsonl`

### GitHub Issue Notifications for Critical Actions

Critical actions (hard delete) automatically create GitHub issues when these tokens are available:

1. Set `GITHUB_TOKEN` or `DISPATCH_TOKEN` in environment
2. Set `GITHUB_REPO` or `MAIN_REPO` (default: `SemperAdmin/Fitness-Report-Evaluator`)

Example issue created on hard delete:

```
Title: [Admin Audit] Critical Action: user_hard_delete
Labels: admin-audit, critical, security

## Critical Admin Action Alert

**Action:** user_hard_delete
**Admin:** semperadmin
**Target:** testuser123
**Timestamp:** 2025-01-15T14:30:00.000Z
**IP Address:** 192.168.1.100

### Metadata
{
  "method": "github",
  "removedFiles": 5
}
```

---

## Support

If you encounter issues not covered in this guide:

1. **Check server logs** for detailed error messages
2. **Review audit logs** for security-related issues
3. **Create a GitHub issue** with:
   - Error message
   - Server logs (redact sensitive info)
   - Steps to reproduce

---

## Summary

✅ **Set `ADMIN_USERNAME` environment variable**
✅ **Create admin user account** (via UI or workflow)
✅ **Optional: Add `isAdmin: true` flag** to user profile
✅ **Login** via main app
✅ **Access** `/admin.html`

**Security:** All admin actions are rate-limited, validated, and logged for audit trail.

**Support:** Contact system administrator or create GitHub issue for assistance.
