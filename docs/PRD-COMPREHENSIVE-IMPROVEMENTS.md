# Product Requirements Document
## USMC Fitness Report Evaluator - Comprehensive Improvements

**Document Version:** 1.0
**Date:** 2025-11-07
**Status:** Draft for Review
**Author:** Security & UX Audit Team

---

## Executive Summary

This PRD outlines critical improvements needed for the USMC Fitness Report Evaluator following a comprehensive security, functionality, and UX audit. The audit identified **71 issues** across five categories, with **9 critical security vulnerabilities** requiring immediate attention.

**Key Findings:**
- 🚨 **CRITICAL**: Exposed GitHub token in client-side code
- 🚨 **CRITICAL**: 40+ XSS vulnerabilities via unsanitized innerHTML
- ⚠️ **HIGH**: Missing security headers (CSP, X-Frame-Options)
- ⚠️ **HIGH**: Accessibility violations (WCAG 2.1 AA non-compliant)
- 📊 **MEDIUM**: Data loss risks and sync reliability issues

**Recommended Investment:** 12-16 weeks development time, prioritizing Phase 1 (Security) immediately.

---

## 1. Security Hardening (Phase 1 - IMMEDIATE)

### 1.1 Token Management & Secret Rotation

**Problem:** GitHub PAT `ghp_****[REDACTED]****` is hardcoded in js/config.js:10-22 (Full token visible in source code)

**Requirements:**
- **SEC-001**: Immediately revoke exposed GitHub token
- **SEC-002**: Implement server-side token management (no client-side tokens)
- **SEC-003**: Use GitHub Actions secrets exclusively for workflows
- **SEC-004**: Implement backend proxy for all GitHub API calls
- **SEC-005**: Add token rotation policy (90-day cycle)

**Implementation:**
```javascript
// REMOVE from config.js
function assembleToken() { /* DELETE THIS */ }

// ADD to server.js
app.post('/api/github-proxy', authenticateUser, async (req, res) => {
  const token = process.env.GITHUB_TOKEN; // Server-side only
  // Proxy GitHub API calls
});
```

**Acceptance Criteria:**
- ✅ No tokens in client-side code
- ✅ All GitHub calls route through authenticated backend
- ✅ Token rotation documented in runbook
- ✅ Security scan passes (no secrets detected)

**Priority:** P0 - CRITICAL
**Effort:** 2-3 days

---

### 1.2 XSS Prevention & Input Sanitization

**Problem:** 40+ instances of unsanitized `innerHTML` usage

**Requirements:**
- **SEC-006**: Implement DOMPurify library for HTML sanitization
- **SEC-007**: Replace all `innerHTML` with sanitized alternatives
- **SEC-008**: Create sanitization utility functions
- **SEC-009**: Add ESLint rule to prevent raw innerHTML

**Implementation:**
```javascript
// Install DOMPurify
npm install dompurify

// Create sanitization utility
// js/sanitize.js
import DOMPurify from 'dompurify';

export function sanitizeHTML(dirty) {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'div', 'p'],
    ALLOWED_ATTR: ['class', 'id']
  });
}

// Replace dangerous patterns
// BEFORE:
container.innerHTML = userInput;

// AFTER:
container.innerHTML = sanitizeHTML(userInput);
```

**Affected Files:**
- js/evaluation.js (12 instances)
- js/profile.js (10 instances)
- js/validation.js (2 instances)
- js/sectionI.js (2 instances)
- js/admin/admin-users.js (8 instances)

**Acceptance Criteria:**
- ✅ All innerHTML calls use DOMPurify
- ✅ XSS penetration test passes
- ✅ ESLint enforces sanitization
- ✅ No user input directly in DOM

**Priority:** P0 - CRITICAL
**Effort:** 3-4 days

---

### 1.3 Security Headers Implementation

**Problem:** No CSP, X-Frame-Options, or other security headers

**Requirements:**
- **SEC-010**: Implement Content-Security-Policy
- **SEC-011**: Add X-Frame-Options: DENY
- **SEC-012**: Add X-Content-Type-Options: nosniff
- **SEC-013**: Add Referrer-Policy: strict-origin-when-cross-origin
- **SEC-014**: Add Permissions-Policy

**Implementation:**
```javascript
// server/server.js
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'sha256-...'", "cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "api.github.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

**Acceptance Criteria:**
- ✅ SecurityHeaders.com scores A+
- ✅ CSP violations monitored (Report-URI)
- ✅ No mixed content warnings
- ✅ HSTS preload submitted

**Priority:** P0 - CRITICAL
**Effort:** 2 days

---

### 1.4 Remove Inline Event Handlers

**Problem:** 64 inline onclick/onchange handlers violate CSP

**Requirements:**
- **SEC-015**: Move all inline handlers to addEventListener
- **SEC-016**: Create event delegation system
- **SEC-017**: Add nonce-based script execution for CSP

**Implementation:**
```javascript
// BEFORE (index.html):
<button onclick="startEvaluation()">Begin</button>

// AFTER:
<button data-action="start-evaluation">Begin</button>

// js/app.js:
document.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (action === 'start-evaluation') startEvaluation();
});
```

**Acceptance Criteria:**
- ✅ Zero inline event handlers in HTML
- ✅ CSP passes without 'unsafe-inline'
- ✅ All functionality preserved
- ✅ Event delegation documented

**Priority:** P0 - CRITICAL
**Effort:** 3-4 days

---

### 1.5 Session Management Overhaul

**Problem:** Sessions in localStorage, no httpOnly cookies, no CSRF protection

**Requirements:**
- **SEC-018**: Implement httpOnly, secure cookies for sessions
- **SEC-019**: Add CSRF token validation
- **SEC-020**: Implement session timeout (30 min idle)
- **SEC-021**: Add session fixation protection
- **SEC-022**: Implement logout on all tabs

**Implementation:**
```javascript
// server/server.js
const session = require('express-session');
const csrf = require('csurf');

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true, // HTTPS only
    sameSite: 'strict',
    maxAge: 1800000 // 30 min
  }
}));

app.use(csrf({ cookie: true }));

// Return CSRF token to client
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

**Acceptance Criteria:**
- ✅ No sensitive data in localStorage
- ✅ Session cookies httpOnly and secure
- ✅ CSRF protection on all mutations
- ✅ Auto-logout after 30 min idle
- ✅ Session hijacking test passes

**Priority:** P0 - CRITICAL
**Effort:** 4-5 days

---

### 1.6 Input Validation Harmonization

**Problem:** Client allows 3-char usernames, server requires 8-char passwords (mismatch)

**Requirements:**
- **SEC-023**: Enforce identical validation client and server
- **SEC-024**: Strengthen password requirements (min 12 chars, complexity)
- **SEC-025**: Add username format validation (no special chars)
- **SEC-026**: Implement rate limiting on validation endpoints

**Implementation:**
```javascript
// shared/validation.js (shared between client and server)
export const VALIDATION_RULES = {
  username: {
    minLength: 6,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9._-]+$/,
    message: 'Username: 6-50 chars, letters, numbers, ., _, - only'
  },
  password: {
    minLength: 12,
    requireUpper: true,
    requireLower: true,
    requireNumber: true,
    requireSpecial: true,
    message: 'Password: 12+ chars with upper, lower, number, special'
  }
};

export function validateUsername(username) {
  const { minLength, maxLength, pattern } = VALIDATION_RULES.username;
  if (username.length < minLength || username.length > maxLength) return false;
  return pattern.test(username);
}
```

**Acceptance Criteria:**
- ✅ Client and server use identical validation logic
- ✅ Password strength meter added
- ✅ Real-time validation feedback
- ✅ Validation rules documented

**Priority:** P1 - HIGH
**Effort:** 2 days

---

### 1.7 Encrypt Sensitive Data at Rest

**Problem:** Evaluation data stored plain text in localStorage

**Requirements:**
- **SEC-027**: Implement client-side encryption for sensitive data
- **SEC-028**: Use Web Crypto API for encryption
- **SEC-029**: Store encryption keys securely (not in localStorage)
- **SEC-030**: Add data integrity checks (HMAC)

**Implementation:**
```javascript
// js/crypto.js
class DataEncryption {
  async generateKey() {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(data))
    );
    return { encrypted, iv };
  }

  async decrypt(encrypted, iv, key) {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
}
```

**Acceptance Criteria:**
- ✅ All localStorage data encrypted
- ✅ Keys stored in SessionStorage (memory only)
- ✅ Encryption documented
- ✅ Performance impact < 50ms

**Priority:** P1 - HIGH
**Effort:** 3-4 days

---

## 2. Functionality Improvements (Phase 2)

### 2.1 Robust Offline Sync

**Problem:** Sync failures, no conflict resolution, data loss risk

**Requirements:**
- **FUNC-001**: Implement persistent sync queue
- **FUNC-002**: Add conflict resolution UI
- **FUNC-003**: Exponential backoff for retries
- **FUNC-004**: Sync status indicators
- **FUNC-005**: Manual sync trigger

**Implementation:**
```javascript
// js/syncQueue.js
class SyncQueue {
  constructor() {
    this.queue = this.loadQueue();
    this.retryAttempts = new Map();
  }

  async addToQueue(operation) {
    this.queue.push({
      id: Date.now(),
      operation,
      timestamp: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    });
    await this.persistQueue();
    await this.processQueue();
  }

  async processQueue() {
    for (const item of this.queue.filter(i => i.status === 'pending')) {
      try {
        await this.executeOperation(item);
        item.status = 'completed';
      } catch (error) {
        item.attempts++;
        const delay = Math.pow(2, item.attempts) * 1000; // Exponential backoff
        if (item.attempts > 5) {
          item.status = 'failed';
          this.notifyUser(`Sync failed for ${item.operation.type}`);
        } else {
          setTimeout(() => this.processQueue(), delay);
        }
      }
      await this.persistQueue();
    }
  }
}
```

**Acceptance Criteria:**
- ✅ Queue persists across sessions
- ✅ Failed syncs retry automatically
- ✅ User notified of sync conflicts
- ✅ Manual retry available
- ✅ Sync history viewable

**Priority:** P1 - HIGH
**Effort:** 5-6 days

---

### 2.2 Enhanced Error Handling

**Problem:** Generic errors, no retry mechanisms, silent failures

**Requirements:**
- **FUNC-006**: Centralized error handling service
- **FUNC-007**: User-friendly error messages
- **FUNC-008**: Automatic retry for transient errors
- **FUNC-009**: Error logging to backend
- **FUNC-010**: Error recovery flows

**Implementation:**
```javascript
// js/errorHandler.js
class ErrorHandler {
  static handleError(error, context) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    // Log to backend
    this.logError(errorInfo);

    // Determine user-friendly message
    const userMessage = this.getUserMessage(error);

    // Show notification
    this.showErrorNotification(userMessage, {
      onRetry: () => context.retry?.(),
      onReport: () => this.reportBug(errorInfo)
    });
  }

  static getUserMessage(error) {
    const errorMap = {
      'NetworkError': 'Connection lost. Retrying...',
      'QuotaExceededError': 'Storage full. Please export and clear old data.',
      'ValidationError': 'Please check your input and try again.',
      'AuthenticationError': 'Session expired. Please log in again.'
    };
    return errorMap[error.name] || 'Something went wrong. Please try again.';
  }
}
```

**Acceptance Criteria:**
- ✅ All errors handled gracefully
- ✅ Clear error messages displayed
- ✅ Retry mechanism for network errors
- ✅ Errors logged for debugging
- ✅ Error recovery flows tested

**Priority:** P1 - HIGH
**Effort:** 3-4 days

---

### 2.3 Data Integrity & Versioning

**Problem:** No schema versioning, corrupted data crashes app

**Requirements:**
- **FUNC-011**: Add schema version to all stored data
- **FUNC-012**: Implement migration system
- **FUNC-013**: Validate data on load
- **FUNC-014**: Checksum verification
- **FUNC-015**: Corrupted data recovery

**Implementation:**
```javascript
// js/dataVersion.js
const SCHEMA_VERSION = 3;

class DataMigration {
  static migrations = {
    1: (data) => {
      // Add missing fields from v1 to v2
      return { ...data, newField: 'default' };
    },
    2: (data) => {
      // Restructure from v2 to v3
      return {
        ...data,
        evaluations: data.evals || []
      };
    }
  };

  static migrate(data) {
    const currentVersion = data.__version || 1;

    if (currentVersion === SCHEMA_VERSION) return data;

    let migrated = { ...data };
    for (let v = currentVersion; v < SCHEMA_VERSION; v++) {
      migrated = this.migrations[v](migrated);
    }

    migrated.__version = SCHEMA_VERSION;
    return migrated;
  }

  static validate(data) {
    const schema = {
      __version: 'number',
      evaluations: 'array',
      profile: 'object'
    };

    for (const [key, type] of Object.entries(schema)) {
      if (typeof data[key] !== type && !Array.isArray(data[key])) {
        throw new Error(`Invalid schema: ${key} should be ${type}`);
      }
    }
  }
}
```

**Acceptance Criteria:**
- ✅ All data has version number
- ✅ Migrations tested
- ✅ Invalid data detected
- ✅ Data recovery UI implemented
- ✅ Backup before migration

**Priority:** P2 - MEDIUM
**Effort:** 4-5 days

---

### 2.4 Improved Form State Management

**Problem:** Multi-step form loses data, back button issues

**Requirements:**
- **FUNC-016**: Implement state machine for evaluation flow
- **FUNC-017**: Persistent state across navigation
- **FUNC-018**: Undo/redo capability
- **FUNC-019**: Auto-save on every change
- **FUNC-020**: State history visualization

**Implementation:**
```javascript
// js/stateMachine.js
import { createMachine, interpret } from 'xstate';

const evaluationMachine = createMachine({
  id: 'evaluation',
  initial: 'modeSelection',
  states: {
    modeSelection: {
      on: { SELECT_MODE: 'setup' }
    },
    setup: {
      on: {
        START: 'evaluation',
        BACK: 'modeSelection'
      }
    },
    evaluation: {
      on: {
        NEXT_TRAIT: { actions: 'saveProgress' },
        COMPLETE: 'review',
        BACK: 'setup'
      }
    },
    review: {
      on: {
        EDIT: 'evaluation',
        CONTINUE: 'directedComments'
      }
    },
    // ... more states
  }
});

const service = interpret(evaluationMachine)
  .onTransition((state) => {
    // Persist state
    localStorage.setItem('evaluationState', JSON.stringify(state));
  })
  .start();
```

**Acceptance Criteria:**
- ✅ Form state never lost
- ✅ Back button works correctly
- ✅ State persists across sessions
- ✅ Undo/redo functional
- ✅ State visualization available

**Priority:** P2 - MEDIUM
**Effort:** 5-6 days

---

### 2.5 Server-Side PDF Generation

**Problem:** Client-side PDF fails for large evaluations

**Requirements:**
- **FUNC-021**: Implement server-side PDF generation
- **FUNC-022**: Support bulk PDF export
- **FUNC-023**: PDF templates with Marine Corps branding
- **FUNC-024**: Email PDF delivery option
- **FUNC-025**: PDF archive storage

**Implementation:**
```javascript
// server/pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');

class FitrepPDFGenerator {
  async generate(evaluation) {
    const doc = new PDFDocument({ size: 'LETTER' });
    const stream = fs.createWriteStream(`temp/${evaluation.id}.pdf`);

    doc.pipe(stream);

    // Header
    doc.fontSize(16).text('USMC FITNESS REPORT', { align: 'center' });
    doc.moveDown();

    // Marine Info
    doc.fontSize(12).text(`Marine: ${evaluation.marineName}`);
    doc.text(`Rank: ${evaluation.marineRank}`);
    doc.text(`Period: ${evaluation.fromDate} to ${evaluation.toDate}`);
    doc.moveDown();

    // Traits table
    doc.fontSize(10);
    for (const [trait, result] of Object.entries(evaluation.results)) {
      doc.text(`${trait}: ${result.grade} - ${result.justification}`);
    }

    doc.end();

    return new Promise((resolve) => {
      stream.on('finish', () => resolve(`temp/${evaluation.id}.pdf`));
    });
  }
}

// Route
app.post('/api/pdf/generate', authenticateUser, async (req, res) => {
  const pdfPath = await new FitrepPDFGenerator().generate(req.body.evaluation);
  res.download(pdfPath);
});
```

**Acceptance Criteria:**
- ✅ Server generates PDFs
- ✅ Handles evaluations of any size
- ✅ Official FITREP template used
- ✅ Email delivery works
- ✅ PDFs archived securely

**Priority:** P2 - MEDIUM
**Effort:** 4-5 days

---

## 3. UI/UX Improvements (Phase 3)

### 3.1 Accessibility Compliance (WCAG 2.1 AA)

**Problem:** Only 5 ARIA labels, no keyboard nav, screen reader incompatible

**Requirements:**
- **UX-001**: Add ARIA labels to all interactive elements
- **UX-002**: Implement keyboard navigation (Tab, Enter, Esc)
- **UX-003**: Add focus management for modals
- **UX-004**: Ensure color contrast meets WCAG AA (4.5:1)
- **UX-005**: Add skip navigation links
- **UX-006**: Screen reader testing and fixes
- **UX-007**: Accessible form validation messages
- **UX-008**: ARIA live regions for dynamic content

**Implementation:**
```html
<!-- BEFORE -->
<button onclick="save()">Save</button>

<!-- AFTER -->
<button
  id="save-btn"
  aria-label="Save evaluation progress"
  aria-describedby="save-help"
  data-action="save">
  Save
</button>
<div id="save-help" class="sr-only">
  Saves your current evaluation progress to your profile
</div>

<!-- Focus trap for modals -->
<script>
class FocusTrap {
  constructor(element) {
    this.element = element;
    this.focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    this.firstElement = this.focusableElements[0];
    this.lastElement = this.focusableElements[this.focusableElements.length - 1];
  }

  activate() {
    this.firstElement.focus();
    this.element.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  handleKeyDown(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === this.firstElement) {
        e.preventDefault();
        this.lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === this.lastElement) {
        e.preventDefault();
        this.firstElement.focus();
      }
    } else if (e.key === 'Escape') {
      this.deactivate();
    }
  }
}
</script>
```

**Acceptance Criteria:**
- ✅ WAVE accessibility scan: 0 errors
- ✅ Lighthouse accessibility score > 95
- ✅ All functionality keyboard-accessible
- ✅ Screen reader testing passed (NVDA, JAWS)
- ✅ Color contrast verified (WCAG AAA where possible)
- ✅ Focus indicators visible
- ✅ Skip nav links functional

**Priority:** P1 - HIGH
**Effort:** 7-8 days

---

### 3.2 Mobile Responsive Design

**Problem:** Tables unreadable on mobile, touch targets too small

**Requirements:**
- **UX-009**: Responsive grid system (mobile-first)
- **UX-010**: Touch-friendly buttons (min 44x44px)
- **UX-011**: Mobile navigation pattern
- **UX-012**: Swipe gestures for table navigation
- **UX-013**: Adaptive layouts for < 768px screens
- **UX-014**: Mobile-optimized forms
- **UX-015**: Progressive disclosure for complex data

**Implementation:**
```css
/* Mobile-first approach */
.profile-grid {
  display: block; /* Stack on mobile */
}

@media (min-width: 768px) {
  .profile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}

/* Touch targets */
.btn {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 24px;
}

/* Mobile table: card view */
@media (max-width: 767px) {
  .profile-grid table {
    display: block;
  }

  .profile-grid tbody tr {
    display: flex;
    flex-direction: column;
    border: 1px solid #ddd;
    margin-bottom: 16px;
    padding: 12px;
  }

  .profile-grid td {
    display: grid;
    grid-template-columns: 120px 1fr;
    padding: 8px 0;
  }

  .profile-grid td::before {
    content: attr(data-label);
    font-weight: bold;
  }
}
```

**Acceptance Criteria:**
- ✅ Mobile usability score > 90
- ✅ All features work on mobile
- ✅ Touch targets meet accessibility standards
- ✅ No horizontal scroll
- ✅ Forms easy to complete on mobile
- ✅ Tested on iOS and Android

**Priority:** P1 - HIGH
**Effort:** 6-7 days

---

### 3.3 Loading States & Feedback

**Problem:** No loading indicators, operations block UI

**Requirements:**
- **UX-016**: Skeleton screens for data loading
- **UX-017**: Progress indicators for long operations
- **UX-018**: Optimistic UI updates
- **UX-019**: Button loading states
- **UX-020**: Toast notifications for actions

**Implementation:**
```javascript
// Skeleton loader component
function SkeletonLoader({ rows = 3 }) {
  return `
    <div class="skeleton-loader">
      ${Array(rows).fill(0).map(() => `
        <div class="skeleton-row">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-content">
            <div class="skeleton-line" style="width: 80%"></div>
            <div class="skeleton-line" style="width: 60%"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Button loading state
class LoadingButton {
  constructor(button) {
    this.button = button;
    this.originalText = button.textContent;
  }

  start() {
    this.button.disabled = true;
    this.button.classList.add('loading');
    this.button.innerHTML = `
      <span class="spinner"></span>
      <span>Loading...</span>
    `;
  }

  stop(success = true) {
    this.button.disabled = false;
    this.button.classList.remove('loading');
    this.button.textContent = this.originalText;

    if (success) {
      this.button.classList.add('success');
      setTimeout(() => this.button.classList.remove('success'), 2000);
    }
  }
}
```

**CSS:**
```css
/* Skeleton animations */
.skeleton-loader {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.skeleton-line {
  height: 16px;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin: 8px 0;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Button states */
.btn.loading {
  pointer-events: none;
  opacity: 0.7;
}

.btn.success {
  background: #4caf50;
  color: white;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Acceptance Criteria:**
- ✅ Skeleton screens for all data loads
- ✅ Progress bars for uploads/syncs
- ✅ Button states reflect operations
- ✅ No UI blocking during operations
- ✅ User always knows what's happening

**Priority:** P2 - MEDIUM
**Effort:** 4-5 days

---

### 3.4 Form Validation Improvements

**Problem:** Real-time validation missing, errors not inline

**Requirements:**
- **UX-021**: Real-time validation as user types
- **UX-022**: Inline error messages
- **UX-023**: Success states for valid fields
- **UX-024**: Password strength meter
- **UX-025**: Smart field suggestions
- **UX-026**: Form submission disabled until valid

**Implementation:**
```javascript
// Real-time validation
class FormValidator {
  constructor(form) {
    this.form = form;
    this.fields = form.querySelectorAll('input, textarea, select');
    this.attachListeners();
  }

  attachListeners() {
    this.fields.forEach(field => {
      field.addEventListener('blur', () => this.validateField(field));
      field.addEventListener('input', debounce(() => {
        if (field.classList.contains('touched')) {
          this.validateField(field);
        }
      }, 300));
    });
  }

  validateField(field) {
    field.classList.add('touched');
    const rules = field.dataset.rules?.split('|') || [];
    let isValid = true;
    let errorMessage = '';

    for (const rule of rules) {
      const [ruleName, ...params] = rule.split(':');
      const validator = this.validators[ruleName];

      if (validator && !validator(field.value, ...params)) {
        isValid = false;
        errorMessage = this.errorMessages[ruleName](field, ...params);
        break;
      }
    }

    this.updateFieldUI(field, isValid, errorMessage);
    this.updateSubmitButton();
  }

  updateFieldUI(field, isValid, errorMessage) {
    const errorEl = field.parentElement.querySelector('.error-message');
    const icon = field.parentElement.querySelector('.validation-icon');

    field.classList.toggle('valid', isValid);
    field.classList.toggle('invalid', !isValid);

    if (errorEl) errorEl.textContent = isValid ? '' : errorMessage;
    if (icon) icon.textContent = isValid ? '✓' : '✗';
  }

  validators = {
    required: (value) => value.trim().length > 0,
    minLength: (value, min) => value.length >= parseInt(min),
    maxLength: (value, max) => value.length <= parseInt(max),
    pattern: (value, pattern) => new RegExp(pattern).test(value),
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  };

  errorMessages = {
    required: (field) => `${field.name} is required`,
    minLength: (field, min) => `Minimum ${min} characters required`,
    maxLength: (field, max) => `Maximum ${max} characters allowed`,
    pattern: (field) => `Invalid format for ${field.name}`,
    email: () => 'Invalid email address'
  };
}

// Usage:
// <input data-rules="required|minLength:6|pattern:^[a-zA-Z0-9]+$" />
```

**Password Strength Meter:**
```javascript
function calculatePasswordStrength(password) {
  let strength = 0;

  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 20;
  if (/[a-z]/.test(password)) strength += 15;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

  return {
    score: strength,
    label: strength < 40 ? 'Weak' : strength < 70 ? 'Medium' : 'Strong',
    color: strength < 40 ? '#f44336' : strength < 70 ? '#ff9800' : '#4caf50'
  };
}
```

**Acceptance Criteria:**
- ✅ All fields validate in real-time
- ✅ Error messages appear inline
- ✅ Valid fields show success state
- ✅ Password strength meter functional
- ✅ Submit disabled until form valid
- ✅ Accessible error announcements

**Priority:** P2 - MEDIUM
**Effort:** 4-5 days

---

### 3.5 Modal Management System

**Problem:** Multiple modals overlap, no escape key, background scroll

**Requirements:**
- **UX-027**: Modal stack management
- **UX-028**: Prevent background scroll
- **UX-029**: Escape key closes modals
- **UX-030**: Click outside to close
- **UX-031**: Smooth open/close animations
- **UX-032**: Z-index hierarchy

**Implementation:**
```javascript
// Modal manager
class ModalManager {
  constructor() {
    this.stack = [];
    this.baseZIndex = 1000;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.stack.length > 0) {
        this.close(this.stack[this.stack.length - 1]);
      }
    });
  }

  open(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal || this.stack.includes(modalId)) return;

    // Add to stack
    this.stack.push(modalId);

    // Set z-index
    modal.style.zIndex = this.baseZIndex + this.stack.length;

    // Prevent body scroll
    if (this.stack.length === 1) {
      document.body.style.overflow = 'hidden';
    }

    // Show modal
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    // Focus first element
    const focusable = modal.querySelector('button, [href], input, select, textarea');
    if (focusable) focusable.focus();

    // Close on backdrop click
    if (options.closeOnBackdrop !== false) {
      modal.querySelector('.modal-backdrop')?.addEventListener('click', () => {
        this.close(modalId);
      });
    }

    // Callback
    if (options.onOpen) options.onOpen(modal);
  }

  close(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Remove from stack
    this.stack = this.stack.filter(id => id !== modalId);

    // Hide modal
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');

    // Restore body scroll if no modals
    if (this.stack.length === 0) {
      document.body.style.overflow = '';
    }

    // Return focus to trigger
    const trigger = document.querySelector(`[data-modal="${modalId}"]`);
    if (trigger) trigger.focus();
  }

  closeAll() {
    [...this.stack].forEach(id => this.close(id));
  }
}

// Global instance
window.modalManager = new ModalManager();
```

**CSS:**
```css
.modal {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.modal.active {
  display: flex;
  opacity: 1;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.modal-content {
  position: relative;
  background: white;
  border-radius: 8px;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  transform: scale(0.9);
  transition: transform 0.3s ease;
}

.modal.active .modal-content {
  transform: scale(1);
}
```

**Acceptance Criteria:**
- ✅ Multiple modals stack correctly
- ✅ Background scroll prevented
- ✅ Escape closes top modal
- ✅ Click outside closes modal
- ✅ Smooth animations
- ✅ Focus management works

**Priority:** P2 - MEDIUM
**Effort:** 3-4 days

---

### 3.6 Navigation & Breadcrumbs

**Problem:** No breadcrumbs, inconsistent back button, no deep linking

**Requirements:**
- **UX-033**: Breadcrumb navigation on all screens
- **UX-034**: Consistent back button behavior
- **UX-035**: URL-based routing (deep linking)
- **UX-036**: Navigation history
- **UX-037**: Unsaved changes warning

**Implementation:**
```javascript
// Router with breadcrumbs
class Router {
  constructor() {
    this.routes = new Map();
    this.history = [];
    this.breadcrumbs = [];

    window.addEventListener('popstate', (e) => {
      this.navigate(window.location.pathname, false);
    });
  }

  register(path, handler, meta = {}) {
    this.routes.set(path, { handler, meta });
  }

  navigate(path, pushState = true) {
    // Check for unsaved changes
    if (window.hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Continue?')) {
        return;
      }
    }

    const route = this.routes.get(path);
    if (!route) {
      console.error(`Route not found: ${path}`);
      return;
    }

    // Update history
    this.history.push(path);
    if (pushState) {
      window.history.pushState({ path }, '', path);
    }

    // Update breadcrumbs
    this.updateBreadcrumbs(path, route.meta);

    // Execute handler
    route.handler();
  }

  updateBreadcrumbs(path, meta) {
    const parts = path.split('/').filter(Boolean);
    this.breadcrumbs = parts.map((part, index) => ({
      label: meta.breadcrumbLabels?.[index] || part,
      path: '/' + parts.slice(0, index + 1).join('/')
    }));

    this.renderBreadcrumbs();
  }

  renderBreadcrumbs() {
    const container = document.getElementById('breadcrumbs');
    if (!container) return;

    container.innerHTML = `
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">
          <li><a href="/">Home</a></li>
          ${this.breadcrumbs.map((crumb, i) => `
            <li>
              <span class="separator">›</span>
              ${i === this.breadcrumbs.length - 1
                ? `<span aria-current="page">${crumb.label}</span>`
                : `<a href="${crumb.path}">${crumb.label}</a>`
              }
            </li>
          `).join('')}
        </ol>
      </nav>
    `;
  }

  back() {
    if (this.history.length > 1) {
      this.history.pop(); // Remove current
      const previous = this.history[this.history.length - 1];
      this.navigate(previous, false);
      window.history.back();
    }
  }
}

// Usage
const router = new Router();

router.register('/dashboard', () => {
  // Show dashboard
}, { breadcrumbLabels: ['Dashboard'] });

router.register('/evaluation/new', () => {
  // New evaluation
}, { breadcrumbLabels: ['Evaluations', 'New'] });
```

**Acceptance Criteria:**
- ✅ Breadcrumbs on all screens
- ✅ Back button consistent
- ✅ URLs shareable
- ✅ Browser back/forward work
- ✅ Unsaved changes warning

**Priority:** P2 - MEDIUM
**Effort:** 4-5 days

---

## 4. Performance Optimization (Phase 4)

### 4.1 Code Splitting & Lazy Loading

**Problem:** 8MB bundle, no code splitting, all JS loaded upfront

**Requirements:**
- **PERF-001**: Implement route-based code splitting
- **PERF-002**: Lazy load heavy components (Chart.js, jsPDF)
- **PERF-003**: Dynamic imports for admin dashboard
- **PERF-004**: Tree shaking for unused code
- **PERF-005**: Bundle size < 500KB initial load

**Implementation:**
```javascript
// Dynamic imports
// BEFORE:
import { jsPDF } from 'jspdf';

// AFTER:
async function generatePDF() {
  const { jsPDF } = await import('jspdf');
  // Use jsPDF
}

// Route-based splitting (webpack config)
module.exports = {
  entry: {
    main: './js/app.js',
    admin: './js/admin/admin-dashboard.js',
    profile: './js/profile.js'
  },
  output: {
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist')
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true
        }
      }
    }
  }
};

// Lazy component loader
class LazyLoader {
  static components = new Map();

  static async load(componentName) {
    if (this.components.has(componentName)) {
      return this.components.get(componentName);
    }

    const component = await import(`./components/${componentName}.js`);
    this.components.set(componentName, component.default);
    return component.default;
  }
}
```

**Acceptance Criteria:**
- ✅ Initial bundle < 500KB
- ✅ Lighthouse performance score > 90
- ✅ First Contentful Paint < 1.5s
- ✅ Time to Interactive < 3.5s
- ✅ Lazy loading working

**Priority:** P2 - MEDIUM
**Effort:** 5-6 days

---

### 4.2 Virtual Scrolling for Large Lists

**Problem:** Large evaluation lists lag

**Requirements:**
- **PERF-006**: Virtual scrolling for evaluation grid
- **PERF-007**: Pagination for admin user list
- **PERF-008**: Infinite scroll with lazy loading
- **PERF-009**: Render only visible items

**Implementation:**
```javascript
// Virtual scroller
class VirtualScroller {
  constructor(container, items, renderItem, itemHeight = 60) {
    this.container = container;
    this.items = items;
    this.renderItem = renderItem;
    this.itemHeight = itemHeight;
    this.visibleStart = 0;
    this.visibleEnd = 0;

    this.setup();
  }

  setup() {
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.style.height = `${this.items.length * this.itemHeight}px`;
    this.scrollContainer.style.position = 'relative';

    this.viewport = document.createElement('div');
    this.viewport.style.overflow = 'auto';
    this.viewport.style.height = '100%';
    this.viewport.appendChild(this.scrollContainer);
    this.container.appendChild(this.viewport);

    this.viewport.addEventListener('scroll', () => this.onScroll());
    this.render();
  }

  onScroll() {
    const scrollTop = this.viewport.scrollTop;
    this.visibleStart = Math.floor(scrollTop / this.itemHeight);
    this.visibleEnd = Math.ceil((scrollTop + this.viewport.clientHeight) / this.itemHeight);
    this.render();
  }

  render() {
    const buffer = 5; // Render extra items for smooth scrolling
    const start = Math.max(0, this.visibleStart - buffer);
    const end = Math.min(this.items.length, this.visibleEnd + buffer);

    const fragment = document.createDocumentFragment();

    for (let i = start; i < end; i++) {
      const item = this.renderItem(this.items[i], i);
      item.style.position = 'absolute';
      item.style.top = `${i * this.itemHeight}px`;
      item.style.height = `${this.itemHeight}px`;
      fragment.appendChild(item);
    }

    this.scrollContainer.innerHTML = '';
    this.scrollContainer.appendChild(fragment);
  }
}

// Usage:
new VirtualScroller(
  document.getElementById('evaluation-list'),
  evaluations,
  (evaluation, index) => {
    const div = document.createElement('div');
    div.className = 'evaluation-item';
    div.innerHTML = `
      <strong>${evaluation.marineName}</strong>
      <span>${evaluation.date}</span>
      <span>Score: ${evaluation.average}</span>
    `;
    return div;
  },
  80 // item height
);
```

**Acceptance Criteria:**
- ✅ Handles 1000+ items smoothly
- ✅ 60fps scrolling
- ✅ Memory usage stable
- ✅ Works on mobile

**Priority:** P3 - LOW
**Effort:** 4-5 days

---

### 4.3 Caching & Request Optimization

**Problem:** No caching, redundant API calls

**Requirements:**
- **PERF-010**: Implement service worker for offline caching
- **PERF-011**: Cache GitHub API responses
- **PERF-012**: Debounce search inputs
- **PERF-013**: Request deduplication
- **PERF-014**: Optimistic UI updates

**Implementation:**
```javascript
// Service Worker (sw.js)
const CACHE_VERSION = 'v1';
const CACHE_NAME = `fitrep-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/styles.css',
  '/js/app.js',
  '/js/profile.js',
  '/assets/images/Logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;

        return fetch(event.request).then(response => {
          // Cache new requests
          if (event.request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
  );
});

// Request cache with expiration
class RequestCache {
  constructor(ttl = 300000) { // 5 min default
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  clear() {
    this.cache.clear();
  }
}

// Debounced search
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const searchUsers = debounce(async (query) => {
  const results = await api.searchUsers(query);
  displayResults(results);
}, 300);
```

**Acceptance Criteria:**
- ✅ Offline mode functional
- ✅ API cache hit rate > 70%
- ✅ Search debounced (300ms)
- ✅ No redundant requests
- ✅ Faster page loads

**Priority:** P2 - MEDIUM
**Effort:** 5-6 days

---

## 5. Testing & Quality Assurance (Phase 5)

### 5.1 Automated Testing Suite

**Problem:** No tests, regression risks

**Requirements:**
- **TEST-001**: Unit tests for all utility functions (Jest)
- **TEST-002**: Integration tests for API endpoints (Supertest)
- **TEST-003**: E2E tests for critical flows (Playwright)
- **TEST-004**: Visual regression tests (Percy)
- **TEST-005**: Accessibility tests (axe-core)
- **TEST-006**: Code coverage > 80%
- **TEST-007**: CI/CD integration

**Implementation:**
```javascript
// Unit test example (validation.test.js)
import { validateUsername, validatePassword } from './validation';

describe('Validation', () => {
  describe('validateUsername', () => {
    test('accepts valid usernames', () => {
      expect(validateUsername('john.doe')).toBe(true);
      expect(validateUsername('user_123')).toBe(true);
    });

    test('rejects invalid usernames', () => {
      expect(validateUsername('ab')).toBe(false); // too short
      expect(validateUsername('user@name')).toBe(false); // invalid char
      expect(validateUsername('a'.repeat(51))).toBe(false); // too long
    });
  });

  describe('validatePassword', () => {
    test('accepts strong passwords', () => {
      expect(validatePassword('SecureP@ss123')).toBe(true);
    });

    test('rejects weak passwords', () => {
      expect(validatePassword('weak')).toBe(false);
      expect(validatePassword('NoNumbers!')).toBe(false);
      expect(validatePassword('nonumbersorspecial')).toBe(false);
    });
  });
});

// Integration test (auth.test.js)
import request from 'supertest';
import app from '../server/server';

describe('Authentication API', () => {
  test('POST /api/account/create creates user', async () => {
    const response = await request(app)
      .post('/api/account/create')
      .send({
        rank: 'Capt',
        name: 'Test User',
        username: 'testuser',
        password: 'SecureP@ss123'
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  test('POST /api/account/login authenticates user', async () => {
    const response = await request(app)
      .post('/api/account/login')
      .send({
        username: 'testuser',
        password: 'SecureP@ss123'
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.profile).toBeDefined();
  });
});

// E2E test (evaluation.spec.js - Playwright)
import { test, expect } from '@playwright/test';

test.describe('Evaluation Flow', () => {
  test('complete evaluation from start to finish', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.click('[data-action="rs-dashboard"]');
    await page.fill('#loginEmailInput', 'testuser');
    await page.fill('#loginPasswordInput', 'SecureP@ss123');
    await page.click('button:has-text("Login")');

    // Start evaluation
    await page.click('button:has-text("New Evaluation")');
    await page.fill('#marineNameInput', 'Doe, John');
    await page.selectOption('#marineRankSelect', 'SSgt');
    await page.fill('#fromDateInput', '2024-01-01');
    await page.fill('#toDateInput', '2024-12-31');
    await page.click('button:has-text("Begin Evaluation")');

    // Complete traits (simplified)
    for (let i = 0; i < 14; i++) {
      await page.click('button:has-text("Meets")');
      await page.fill('#justificationText', 'Test justification');
      await page.click('button:has-text("Save")');
    }

    // Verify summary
    await expect(page.locator('#fitrepAverage')).toBeVisible();
  });
});

// package.json scripts
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "test:a11y": "jest --testMatch='**/*.a11y.test.js'"
  }
}
```

**Acceptance Criteria:**
- ✅ All tests passing
- ✅ Code coverage > 80%
- ✅ E2E tests for critical paths
- ✅ Tests run in CI/CD
- ✅ No flaky tests

**Priority:** P1 - HIGH
**Effort:** 10-12 days

---

## 6. Implementation Roadmap

### Phase 1: Security Hardening (IMMEDIATE - 2-3 weeks)
**Week 1:**
- [ ] SEC-001-005: Revoke token, implement backend proxy
- [ ] SEC-006-009: XSS prevention (DOMPurify)
- [ ] SEC-010-014: Security headers

**Week 2:**
- [ ] SEC-015-017: Remove inline handlers
- [ ] SEC-018-022: Session management overhaul
- [ ] SEC-023-026: Input validation harmonization

**Week 3:**
- [ ] SEC-027-030: Encrypt sensitive data
- [ ] Security audit & penetration testing
- [ ] Deploy security fixes to production

### Phase 2: Functionality Improvements (4-5 weeks)
**Week 4-5:**
- [ ] FUNC-001-005: Robust offline sync
- [ ] FUNC-006-010: Enhanced error handling
- [ ] FUNC-011-015: Data integrity & versioning

**Week 6-7:**
- [ ] FUNC-016-020: Form state management
- [ ] FUNC-021-025: Server-side PDF generation

**Week 8:**
- [ ] Testing & bug fixes
- [ ] Deploy functionality updates

### Phase 3: UI/UX Improvements (5-6 weeks)
**Week 9-10:**
- [ ] UX-001-008: Accessibility compliance
- [ ] UX-009-015: Mobile responsive design

**Week 11-12:**
- [ ] UX-016-020: Loading states & feedback
- [ ] UX-021-026: Form validation improvements

**Week 13-14:**
- [ ] UX-027-032: Modal management
- [ ] UX-033-037: Navigation & breadcrumbs
- [ ] UX testing & refinement

### Phase 4: Performance Optimization (3-4 weeks)
**Week 15-16:**
- [ ] PERF-001-005: Code splitting
- [ ] PERF-006-009: Virtual scrolling

**Week 17-18:**
- [ ] PERF-010-014: Caching & optimization
- [ ] Performance testing & tuning

### Phase 5: Testing & QA (2 weeks)
**Week 19-20:**
- [ ] TEST-001-007: Full testing suite
- [ ] Final QA & regression testing
- [ ] Production deployment

---

## 7. Success Metrics

### Security Metrics
- **Target:** 0 critical vulnerabilities
- **Measure:** Lighthouse, OWASP ZAP, Snyk scans
- **Frequency:** Weekly

### Performance Metrics
- **Target:** Lighthouse score > 90
- **Measure:** Core Web Vitals
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1
- **Frequency:** Daily (CI/CD)

### Accessibility Metrics
- **Target:** WCAG 2.1 AA compliance
- **Measure:** axe-core scan, manual testing
- **Frequency:** Per release

### User Experience Metrics
- **Target:** System Usability Scale > 80
- **Measure:** User surveys, analytics
- **Frequency:** Monthly

### Reliability Metrics
- **Target:** 99.9% uptime
- **Measure:** Uptime monitoring
- **Frequency:** Continuous

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Token exposure exploited | High | Critical | Revoke immediately, monitor logs |
| XSS exploited in production | Medium | High | Deploy sanitization ASAP |
| Data loss during migration | Low | High | Backup before changes, test migrations |
| Performance degradation | Low | Medium | Load testing, rollback plan |
| User resistance to changes | Medium | Low | Gradual rollout, documentation |
| Third-party dependency issues | Medium | Medium | Lock versions, monitor updates |

---

## 9. Resource Requirements

### Development Team
- **Full-Stack Developer (2):** Security, backend, frontend
- **UI/UX Designer (1):** Design system, accessibility
- **QA Engineer (1):** Test automation, manual testing
- **DevOps Engineer (0.5):** CI/CD, deployment

### Infrastructure
- **GitHub Actions:** CI/CD pipeline
- **Render/Heroku:** Backend hosting
- **GitHub Pages:** Static hosting
- **Monitoring:** Sentry, Datadog

### Budget Estimate
- **Development:** 16 weeks × 3.5 FTE = 56 person-weeks
- **Infrastructure:** $500/month
- **Tools & Services:** $200/month
- **Testing & QA:** $5,000 one-time

---

## 10. Appendices

### A. Technical Dependencies
- **DOMPurify:** v3.0+ (XSS prevention)
- **Helmet:** v7.0+ (Security headers)
- **Express-session:** v1.18+ (Session management)
- **Csurf:** v1.11+ (CSRF protection)
- **Jest:** v29.0+ (Unit testing)
- **Playwright:** v1.40+ (E2E testing)
- **Webpack:** v5.0+ (Bundling)

### B. Documentation Updates Needed
- [ ] Security best practices guide
- [ ] API documentation (OpenAPI spec)
- [ ] Deployment runbook
- [ ] User manual updates
- [ ] Admin guide
- [ ] Troubleshooting guide

### C. Training Requirements
- [ ] Security awareness for developers
- [ ] Accessibility training
- [ ] New features walkthrough for users
- [ ] Admin dashboard training

---

## 11. Approval & Sign-off

**Prepared by:** Security & UX Audit Team
**Date:** 2025-11-07
**Version:** 1.0

**Review & Approval:**
- [ ] Technical Lead: _________________ Date: _______
- [ ] Product Owner: _________________ Date: _______
- [ ] Security Officer: _________________ Date: _______
- [ ] UX Lead: _________________ Date: _______

---

**Next Steps:**
1. Review and approve PRD
2. Prioritize Phase 1 (Security) for immediate implementation
3. Allocate resources and create sprint plan
4. Begin implementation with SEC-001 (token revocation)

---

*This document is a living document and will be updated as requirements evolve.*
