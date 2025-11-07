# 🚨 IMMEDIATE ACTION CHECKLIST
**USMC Fitness Report Evaluator - Critical Security Remediation**

---

## ⏰ DO THIS NOW (Next 30 Minutes)

### Step 1: Revoke Exposed GitHub Token

**CRITICAL:** A GitHub Personal Access Token is exposed in your codebase:
```
Token: ghp_****[REDACTED - View js/config.js lines 10-22 for full token]****
Location: js/config.js lines 10-22
Status: ACTIVE (as of audit date)
```

**Actions:**
```bash
# 1. Go to GitHub
#    https://github.com/settings/tokens

# 2. Find and REVOKE the exposed token immediately

# 3. Check for any suspicious activity
#    - Recent commits you didn't make
#    - Unknown collaborators
#    - Unusual repository access
#    - Check GitHub Actions logs

# 4. Generate NEW token (if needed for local dev)
#    - Store in environment variable ONLY
#    - NEVER commit to repository
```

**Verification:**
- [ ] Old token revoked
- [ ] Repository access logs reviewed
- [ ] No suspicious activity detected
- [ ] New token stored securely (if needed)

---

### Step 2: Disable Client-Side Token Usage

**Edit:** `js/config.js`

```javascript
// BEFORE (LINES 10-22) - DELETE THIS ENTIRE FUNCTION:
function assembleToken() {
  const part1 = "ghp_";
  const part2 = "pnPCGYecA3LD";
  const part3 = "Oaa5vwOcDZU0NVoxFX1P";
  const part4 = "qWO6";
  const fragments = [part1, part2, part3, part4];
  return fragments.join('');
}

// AFTER - REPLACE WITH:
function assembleToken() {
  // SECURITY: Token assembly disabled. Use backend proxy.
  console.error('Client-side token usage is disabled for security.');
  return null;
}

// OR BETTER: Delete the function entirely and update references
```

**Also update:**
```javascript
// Line 759 in index.html
window.USE_ASSEMBLED_TOKEN = false; // ← SET TO FALSE

// Line 758 in index.html
window.API_BASE_URL_OVERRIDE = window.location.origin; // Use backend proxy
```

**Verification:**
- [ ] assembleToken() disabled or deleted
- [ ] USE_ASSEMBLED_TOKEN = false
- [ ] Backend proxy configured
- [ ] App still loads (with backend proxy)

---

### Step 3: Add Temporary Security Headers

**Edit:** `server/server.js` (Add after line 13)

```javascript
// TEMPORARY SECURITY HEADERS (Until Helmet.js implemented)
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Basic XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (Report-Only for now)
  res.setHeader('Content-Security-Policy-Report-Only',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' api.github.com; " +
    "frame-src 'none'; " +
    "object-src 'none';"
  );

  next();
});
```

**Verification:**
- [ ] Headers added to server.js
- [ ] Server restarted
- [ ] Headers visible in browser DevTools (Network tab)
- [ ] No console errors

---

## ⏰ TODAY (Next 2-4 Hours)

### Step 4: Deploy Emergency Security Patch

**Git Operations:**
```bash
# 1. Create emergency security branch
git checkout -b security/emergency-token-revocation

# 2. Stage changes
git add js/config.js index.html server/server.js

# 3. Commit with clear message
git commit -m "SECURITY: Emergency token revocation and headers

- Disabled assembleToken() function
- Revoked exposed GitHub PAT
- Added temporary security headers (X-Frame-Options, CSP-Report-Only)
- Configured backend proxy for GitHub API calls

CRITICAL: Exposed GitHub token has been revoked (see js/config.js)."

# 4. Push to remote
git push -u origin security/emergency-token-revocation

# 5. Create Pull Request (if using PR workflow)
# OR merge directly to main if emergency

# 6. Deploy to production IMMEDIATELY
```

**Verification:**
- [ ] Changes committed
- [ ] Pushed to repository
- [ ] Deployed to production (Render/GitHub Pages)
- [ ] Production site tested
- [ ] No broken functionality

---

### Step 5: Notify Stakeholders

**Email Template:**
```
Subject: URGENT: Security Patch Deployed - Action Required

Team,

We have identified and remediated a critical security vulnerability in the
USMC Fitness Report Evaluator application.

ISSUE:
A GitHub Personal Access Token was inadvertently exposed in client-side code,
potentially allowing unauthorized access to our repositories.

ACTIONS TAKEN (Completed):
✓ Exposed token immediately revoked
✓ Client-side token usage disabled
✓ Backend proxy configured for all GitHub API calls
✓ Emergency security headers deployed
✓ Repository access logs reviewed (no suspicious activity detected)

ACTIONS REQUIRED (You):
1. If you have a local copy of the repository, pull the latest changes:
   git pull origin main

2. If you have any locally stored tokens, delete them and use the new
   backend proxy method.

3. Review any evaluations created in the last 7 days for abnormalities.

NEXT STEPS:
- Full security audit in progress
- Comprehensive fixes scheduled for next 3 weeks
- Weekly security updates will be provided

Questions? Contact: security@semperadmin.com

Status: RESOLVED (Monitoring ongoing)
Severity: CRITICAL (Impact mitigated)
```

**Verification:**
- [ ] Email sent to development team
- [ ] Product owner notified
- [ ] Security officer (if applicable) informed
- [ ] Incident logged

---

## ⏰ THIS WEEK (Next 3-4 Days)

### Step 6: Implement DOMPurify (XSS Prevention)

**Install:**
```bash
npm install dompurify
```

**Create Utility:** `js/sanitize.js`
```javascript
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} dirty - Untrusted HTML string
 * @param {object} config - DOMPurify configuration
 * @returns {string} Sanitized HTML
 */
export function sanitizeHTML(dirty, config = {}) {
  const defaultConfig = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'div', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['class', 'id', 'style'],
    ALLOW_DATA_ATTR: false,
    ...config
  };

  return DOMPurify.sanitize(dirty, defaultConfig);
}

/**
 * Sanitize text (strip all HTML)
 * @param {string} dirty - Untrusted text
 * @returns {string} Plain text only
 */
export function sanitizeText(dirty) {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}
```

**Update Files (Priority Order):**

1. **js/evaluation.js** (12 instances):
   ```javascript
   import { sanitizeHTML } from './sanitize.js';

   // BEFORE:
   container.innerHTML = userInput;

   // AFTER:
   container.innerHTML = sanitizeHTML(userInput);
   ```

2. **js/profile.js** (10 instances)
3. **js/admin/admin-users.js** (8 instances)
4. **js/validation.js** (2 instances)
5. **js/sectionI.js** (2 instances)

**Verification:**
- [ ] DOMPurify installed
- [ ] sanitize.js created and tested
- [ ] All innerHTML calls updated
- [ ] XSS test passed (try injecting `<script>alert('XSS')</script>`)

---

### Step 7: Remove Inline Event Handlers (Critical Pages)

**Priority Pages:**
1. index.html (main app)
2. admin.html (admin dashboard)

**Process:**

1. **Create event handler registry:** `js/eventHandlers.js`
   ```javascript
   const handlers = {
     'start-evaluation': startEvaluation,
     'save-justification': saveJustification,
     'login': accountLogin,
     // ... more handlers
   };

   export function initEventHandlers() {
     document.addEventListener('click', (e) => {
       const action = e.target.dataset.action;
       if (action && handlers[action]) {
         e.preventDefault();
         handlers[action](e);
       }
     });

     document.addEventListener('change', (e) => {
       const action = e.target.dataset.onChange;
       if (action && handlers[action]) {
         handlers[action](e);
       }
     });
   }
   ```

2. **Update HTML:**
   ```html
   <!-- BEFORE: -->
   <button onclick="startEvaluation()">Begin</button>

   <!-- AFTER: -->
   <button data-action="start-evaluation">Begin</button>
   ```

3. **Initialize in app.js:**
   ```javascript
   import { initEventHandlers } from './eventHandlers.js';

   document.addEventListener('DOMContentLoaded', () => {
     initEventHandlers();
     // ... other init code
   });
   ```

**Verification:**
- [ ] Event handler registry created
- [ ] Critical inline handlers removed (login, evaluation flow)
- [ ] All functionality still works
- [ ] CSP can be tightened (remove 'unsafe-inline')

---

### Step 8: Implement Proper Session Management

**Install:**
```bash
npm install express-session cookie-parser csurf
```

**Update server.js:**
```javascript
const session = require('express-session');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');

// After express.json()
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'CHANGE-THIS-IN-PRODUCTION',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'strict',
    maxAge: 1800000 // 30 minutes
  },
  name: 'fitrep.sid' // Don't use default 'connect.sid'
}));

// CSRF protection
const csrfProtection = csrf({ cookie: true });

// Provide CSRF token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Protect mutation endpoints
app.post('/api/account/create', csrfProtection, authRateLimit, async (req, res) => {
  // ... existing code
});

app.post('/api/account/login', csrfProtection, authRateLimit, async (req, res) => {
  // ... existing code
  // On successful login:
  req.session.userId = user.id;
  req.session.username = user.username;
  // ...
});

// Logout endpoint
app.post('/api/account/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('fitrep.sid');
    res.json({ ok: true });
  });
});

// Session verification middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Use on protected routes
app.get('/api/profile', requireAuth, async (req, res) => {
  // ...
});
```

**Update client (js/profile.js):**
```javascript
// Get CSRF token on app load
let csrfToken = null;

async function fetchCsrfToken() {
  const res = await fetch('/api/csrf-token', { credentials: 'include' });
  const data = await res.json();
  csrfToken = data.csrfToken;
}

// Include CSRF token in all POST requests
async function postJson(url, body) {
  if (!csrfToken) await fetchCsrfToken();

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CSRF-Token': csrfToken
    },
    credentials: 'include',
    body: JSON.stringify(body)
  }).then(r => r.json());
}

// Remove localStorage session storage
// Delete these lines:
// localStorage.setItem('current_profile', ...);
// sessionStorage.setItem('login_source', ...);
```

**Verification:**
- [ ] Session middleware installed
- [ ] httpOnly cookies set
- [ ] CSRF protection working
- [ ] Login/logout functional
- [ ] Sessions expire after 30 min
- [ ] No session data in localStorage

---

## 📋 Completion Checklist

### Immediate (Completed in 30 min)
- [ ] GitHub token revoked
- [ ] Client-side token disabled
- [ ] Temporary security headers added
- [ ] Changes deployed to production

### Today (Completed in 2-4 hours)
- [ ] Emergency patch committed and pushed
- [ ] Stakeholders notified
- [ ] Production deployment verified

### This Week (Completed in 3-4 days)
- [ ] DOMPurify implemented (XSS prevention)
- [ ] Critical inline handlers removed
- [ ] Proper session management deployed
- [ ] Security improvements tested

### Verification Tests
- [ ] Try to inject XSS: `<script>alert('XSS')</script>` - Should be sanitized
- [ ] Check headers: `curl -I https://your-app.com` - Should show security headers
- [ ] Test CSRF: Try POST without token - Should fail with 403
- [ ] Session expiry: Wait 30 min idle - Should require re-login
- [ ] Check for token in code: `git grep -i "ghp_"` - Should return empty

---

## 🆘 Emergency Contacts

**If you encounter issues during remediation:**

1. **Can't deploy changes:**
   - Check build logs: `npm run build`
   - Check server logs: `pm2 logs` or Render dashboard
   - Rollback if needed: `git revert HEAD`

2. **App breaks after changes:**
   - Check browser console for errors
   - Verify all imports are correct
   - Test in incognito mode (clear cache)

3. **Need help:**
   - GitHub Issues: https://github.com/SemperAdmin/Fitness-Report-Evaluator/issues
   - Security concerns: security@semperadmin.com
   - Emergency: [Your emergency contact]

---

## 📊 Progress Tracking

**Update this section as you complete each step:**

```
Last Updated: [DATE]
Completed By: [YOUR NAME]

✓ Step 1: Token Revoked          [TIMESTAMP]
✓ Step 2: Token Usage Disabled   [TIMESTAMP]
✓ Step 3: Security Headers Added [TIMESTAMP]
✓ Step 4: Emergency Patch Deployed [TIMESTAMP]
✓ Step 5: Stakeholders Notified  [TIMESTAMP]
⏳ Step 6: DOMPurify Implementation [IN PROGRESS]
⏳ Step 7: Remove Inline Handlers [PENDING]
⏳ Step 8: Session Management     [PENDING]

Status: [IN PROGRESS / COMPLETED]
Issues Encountered: [NONE / LIST ISSUES]
```

---

## 📚 Next Steps After This Checklist

Once all immediate actions are complete:

1. **Read the full PRD:** `/docs/PRD-COMPREHENSIVE-IMPROVEMENTS.md`
2. **Review all issues:** `/docs/AUDIT-ISSUES-SUMMARY.md`
3. **Plan sprint:** Prioritize Phase 1 security fixes
4. **Schedule security review:** Third-party penetration test
5. **Weekly security standup:** Monitor progress

---

**Remember:** Security is not a one-time fix. It's an ongoing process.

**Stay vigilant. Stay secure. Semper Fi! 🇺🇸**
