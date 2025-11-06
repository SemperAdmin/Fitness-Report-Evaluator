# Reusable Prompt: User Feedback Widget with GitHub Issues Integration

Copy and customize this prompt for implementing a **secure, accessible, privacy-conscious** feedback collection system in any web application.

**✅ Includes:** XSS protection, privacy warnings, ARIA attributes, fine-grained tokens, input sanitization

---

## Prompt Template

```
I want to implement a SECURE user feedback collection system for my [APP NAME] application that automatically creates GitHub issues.

**CRITICAL SECURITY & PRIVACY REQUIREMENTS:**

⚠️ **Security:**
- XSS protection: NO innerHTML usage - use textContent and createElement()
- Input sanitization: Remove control characters, truncate to safe lengths
- Token security: Fine-grained tokens preferred, minimal permissions
- Link security: Add rel="noopener noreferrer" to external links
- Debug endpoints: Limit information exposure (only necessary fields)

⚠️ **Privacy:**
- Email field MUST have explicit warnings that it will be public in GitHub issues
- Label: "Email (Optional - will be public in GitHub issue)"
- Placeholder: "your@email.mil (visible publicly)"
- Warning text below input: "⚠️ Your email will be visible in the public GitHub issue"
- Backend comment documenting this is intentional

⚠️ **Accessibility:**
- Modal must have proper ARIA attributes:
  * role="dialog" and aria-modal="true"
  * aria-labelledby pointing to modal title
  * aria-label on close button
  * aria-describedby on inputs with helper text
- Keyboard navigation: ESC closes modal, Tab order is logical
- Screen reader friendly labels and descriptions

---

**IMPLEMENTATION REQUIREMENTS:**

1. **Frontend Feedback Widget**
   - Floating feedback button (bottom-right corner, always visible)
   - Accessible modal with proper ARIA attributes
   - Modal form with these fields:
     * Feedback Type dropdown: Bug Report, Feature Request, UX Suggestion (required)
     * Title (required, max 200 chars, sanitized)
     * Description (required, textarea, max 50,000 chars, sanitized)
     * Email (OPTIONAL with privacy warnings - see above)

   - Auto-capture technical context (sanitized):
     * Browser/user agent
     * Screen resolution and viewport size
     * Current page/route/view
     * App theme (dark/light if applicable)
     * Timestamp (ISO format)
     * App-specific state (optional)

   - **XSS-Safe** success/error messages:
     * Use textContent and createElement(), NEVER innerHTML
     * If showing links, create <a> elements programmatically
     * Escape all user input before display

   - Modal interactions:
     * Close on ESC key press
     * Close on click outside modal
     * Close button with aria-label
     * Prevent body scroll when open

   - Full dark mode support (if app has dark mode)
   - Mobile responsive (test on 320px+ widths)

2. **Backend API Integration**

   **Endpoint:** POST `/api/feedback`

   **Input Sanitization (CRITICAL):**
   ```javascript
   const sanitizeString = (str) => {
     if (!str) return '';
     // Remove null bytes and control characters except newlines and tabs
     return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
   };

   const sanitizedTitle = sanitizeString(title).substring(0, 200);
   const sanitizedDescription = sanitizeString(description).substring(0, 50000);
   const sanitizedEmail = email ? sanitizeString(email).substring(0, 200) : '';
   ```

   **GitHub Issue Creation:**
   - Use GitHub REST API: POST /repos/{owner}/{repo}/issues
   - Issue title format: `[BUG REPORT]`, `[FEATURE REQUEST]`, or `[UX SUGGESTION]` + user title
   - Issue body: Markdown formatted with description + auto-captured context
   - No labels initially (avoid validation errors if labels don't exist)
   - Include privacy comment in code:
     ```javascript
     // NOTE: Email is included in the public GitHub issue body.
     // The frontend displays a privacy warning to users before they submit.
     // This is intentional to allow maintainers to follow up with users.
     ```

   **Error Handling:**
   - Detailed server-side logging (but don't expose to client)
   - User-friendly error messages (no stack traces)
   - Log: request details, GitHub API response, errors with context

   **Rate Limiting:**
   - 100 requests per 15 minutes per IP (general API)
   - 10 requests per minute per IP (feedback endpoint - optional stricter limit)

3. **Debug Endpoint (Optional but Recommended)**

   **Endpoint:** GET `/api/debug/github`

   **Returns (with minimal information disclosure):**
   ```json
   {
     "tokenConfigured": true/false,
     "tokenPrefix": "github_pat_..." or "ghp_..." (first 7 chars only),
     "repoConfigured": true/false,
     "repo": "owner/repository",
     "apiTest": {
       "success": true/false,
       "repoExists": true/false,
       "hasIssues": true/false,
       "permissions": {
         "admin": false,
         "push": true,
         "pull": true
       }
     }
   }
   ```

   **Security:** Only expose admin/push/pull permissions, not entire permissions object

4. **Environment Configuration**

   **Required Environment Variables:**
   - `GITHUB_TOKEN` - Use **fine-grained token** (recommended) or classic PAT
   - `GITHUB_REPO` - Format: `owner/repository`

   **GitHub Token Setup (Fine-Grained - Recommended):**
   1. Go to: https://github.com/settings/tokens?type=beta
   2. Generate new token with:
      - **Repository access:** Only select repositories → Choose your repo
      - **Permissions → Repository permissions:**
        * **Issues:** Read and write ✅
        * All others: No access
   3. Token starts with `github_pat_...`

   **GitHub Token Setup (Classic - Fallback):**
   1. Go to: https://github.com/settings/tokens
   2. Generate new token (classic) with:
      - **Scope:** `repo` (full repository access)
      - ⚠️ Warning: Grants access to ALL your repositories
   3. Token starts with `ghp_...`

   **Token Security:**
   - Store ONLY in environment variables (never in code)
   - Add to .gitignore: `.env`, `.env.local`, etc.
   - Rotate tokens every 90 days (set expiration)
   - Use hosting platform's secrets management (Vercel, Netlify, Render, etc.)

5. **Documentation Requirements**

   Create `FEEDBACK_SETUP.md` with:
   - GitHub token creation (prioritize fine-grained tokens)
   - Environment variable setup for your hosting platform
   - Testing instructions
   - Troubleshooting guide (common errors)
   - Privacy policy snippet (email is public)
   - Security considerations

---

**MY APP DETAILS:**

- **App Name:** [Your app name]
- **Tech Stack:** [e.g., React 18 + TypeScript + Vite + Express backend]
- **Styling:** [e.g., Tailwind CSS, Styled Components, custom CSS]
- **GitHub Repo:** [owner/repository]
- **Backend Framework:** [Express, Flask, Django, Next.js API routes, etc.]
- **Backend Already Has:** [CORS, rate limiting, authentication, etc.]
- **Primary Color:** [Hex code for button styling]
- **Dark Mode:** [Yes/No - if yes, provide dark theme colors]

**Existing Files to Modify:**
- Frontend: [e.g., `src/components/`, `public/index.html`, `src/styles.css`]
- Backend: [e.g., `server.js`, `routes/api.js`, `app.py`]

**Custom Context to Capture:**
[Optional: List any app-specific context you want captured, e.g., "current workspace ID", "subscription tier", "selected filters"]

---

**DELIVERABLES:**

Please implement:

1. ✅ **Secure Frontend Code**
   - XSS-safe feedback form with ARIA attributes
   - Privacy warnings on email field
   - Dark mode compatible

2. ✅ **Secure Backend Code**
   - Input sanitization
   - GitHub API integration
   - Error handling and logging
   - Debug endpoint

3. ✅ **Styling**
   - Matches my app's design
   - Mobile responsive
   - Dark mode support (if applicable)

4. ✅ **Documentation**
   - Setup guide (fine-grained tokens)
   - Testing instructions
   - Security notes

5. ✅ **Testing**
   - Verify all inputs are sanitized
   - Test XSS protection (try injecting <script> tags)
   - Test ARIA attributes with screen reader
   - Test mobile responsiveness
   - Verify privacy warnings are visible

**VALIDATION CHECKLIST:**

Before marking as complete, verify:
- [ ] No innerHTML usage (use textContent + createElement)
- [ ] Email field has 3 privacy warnings (label, placeholder, helper text)
- [ ] Modal has ARIA attributes (role, aria-modal, aria-labelledby)
- [ ] Input sanitization removes control characters
- [ ] Title truncated to 200 chars, description to 50,000 chars
- [ ] Links have rel="noopener noreferrer"
- [ ] Debug endpoint limits permissions exposure
- [ ] Documentation recommends fine-grained tokens first
- [ ] Dark mode styling works (if applicable)
- [ ] Mobile responsive tested
- [ ] ESC key closes modal
- [ ] Click outside closes modal
- [ ] Error messages don't expose sensitive info

Start by confirming you understand all security and privacy requirements, then implement the solution.
```

---

## Customization Guide

### For Different Frameworks

**React/Next.js:**
```
- Tech Stack: React 18 + Next.js 14 + TypeScript
- Styling: Tailwind CSS
- Add as: New component `components/FeedbackWidget.tsx`
- Backend: Next.js API route `pages/api/feedback.ts` or `app/api/feedback/route.ts`
```

**Vue/Nuxt:**
```
- Tech Stack: Vue 3 + Nuxt 3 + TypeScript
- Styling: Tailwind CSS + Pinia for state
- Add as: New component `components/FeedbackWidget.vue`
- Backend: Nuxt server route `server/api/feedback.post.ts`
```

**Python Flask:**
```
- Tech Stack: Python 3.11 + Flask + Jinja2
- Styling: Bootstrap 5
- Frontend: Add to base template `templates/base.html`
- Backend: Flask route in `app.py` or `routes/feedback.py`
```

**Django:**
```
- Tech Stack: Django 4.2 + Python 3.11
- Styling: Django templates + custom CSS
- Frontend: Add to base template `templates/base.html`
- Backend: Django view in `views.py` + URL route
```

**Ruby on Rails:**
```
- Tech Stack: Rails 7 + Ruby 3.2
- Styling: Tailwind CSS
- Frontend: Add to application layout `app/views/layouts/application.html.erb`
- Backend: Rails controller `app/controllers/feedback_controller.rb`
```

### For Different Hosting Platforms

**Vercel:**
```
Environment variables: Vercel Dashboard → Project Settings → Environment Variables
Add: GITHUB_TOKEN and GITHUB_REPO
```

**Netlify:**
```
Environment variables: Site Settings → Build & Deploy → Environment Variables
Add: GITHUB_TOKEN and GITHUB_REPO
```

**AWS (EC2/ECS):**
```
Environment variables: Via .env file, AWS Systems Manager Parameter Store, or ECS task definition
```

**Heroku:**
```
heroku config:set GITHUB_TOKEN=your_token_here
heroku config:set GITHUB_REPO=owner/repo
```

**Railway:**
```
Environment variables: Project → Variables tab
Add: GITHUB_TOKEN and GITHUB_REPO
```

**Fly.io:**
```
fly secrets set GITHUB_TOKEN=your_token_here
fly secrets set GITHUB_REPO=owner/repo
```

---

## Quick Start Examples

### Example 1: React SPA + Express Backend
```
I want to add a feedback widget to my React app.

Tech Stack: React 18 + TypeScript + Vite + Express backend
Styling: Tailwind CSS
GitHub Repo: myorg/my-react-app
Dark Mode: Yes (using context API)

Frontend Files:
- src/components/FeedbackWidget.tsx (new)
- src/App.tsx (import widget)
- src/index.css (Tailwind)

Backend Files:
- server/index.js (add /api/feedback endpoint)

Please implement the feedback widget with TypeScript types and proper error boundaries.
```

### Example 2: Vanilla JS Static Site
```
I want to add a feedback widget to my static website.

Tech Stack: Vanilla JavaScript + HTML + CSS + Node.js proxy server
Styling: Custom CSS (blue/white color scheme)
GitHub Repo: myorg/my-website
Dark Mode: No

Frontend Files:
- index.html (add modal HTML)
- style.css (add widget styles)
- app.js (add widget logic)

Backend Files:
- server.js (add /api/feedback endpoint)

The widget should match my existing blue (#0066cc) primary color.
```

### Example 3: Django Web App
```
I want to add a feedback widget to my Django application.

Tech Stack: Django 4.2 + Python 3.11 + PostgreSQL
Styling: Bootstrap 5
GitHub Repo: myorg/my-django-app
Dark Mode: Yes (Bootstrap dark theme)

Frontend Files:
- templates/base.html (add modal template)
- static/css/feedback.css (new file)
- static/js/feedback.js (new file)

Backend Files:
- myapp/views.py (add feedback view)
- myapp/urls.py (add URL route)

Please use Django's CSRF protection and follow Django best practices.
```

---

## Pro Tips for Reuse

1. **Save this prompt as a template** - Store it in your notes/wiki for quick access

2. **Adjust the context capture** - Each app has different useful context:
   - E-commerce: Current cart items, product page
   - SaaS: Current workspace, subscription tier
   - Blog: Current article, author
   - Dashboard: Active filters, data range

3. **Customize the feedback types** - Add app-specific types:
   - E-commerce: "Product Issue", "Checkout Problem"
   - Documentation: "Docs Error", "Missing Info"
   - Game: "Gameplay Bug", "Balance Issue"

4. **Add screenshots (optional)** - For visual apps, capture screenshots:
   ```javascript
   html2canvas(document.body).then(canvas => {
     const screenshot = canvas.toDataURL();
     // Include in feedback
   });
   ```

5. **Integrate with existing auth** - If your app has users:
   ```javascript
   const context = {
     ...captureContext(),
     userId: currentUser.id,
     username: currentUser.username,
     accountType: currentUser.tier
   };
   ```

6. **Add to CI/CD** - Auto-deploy when feedback code changes:
   ```yaml
   # .github/workflows/deploy.yml
   - name: Deploy with new feedback widget
     run: npm run deploy
   ```

---

## Security Checklist

Before deploying to production:

- [ ] GITHUB_TOKEN is stored as environment variable (never in code)
- [ ] Input sanitization removes control characters
- [ ] Rate limiting prevents abuse
- [ ] CORS is configured to only allow your domain
- [ ] Token has minimum required permissions (only `repo` scope)
- [ ] Environment variables are not exposed in client-side code
- [ ] Error messages don't leak sensitive information

---

## Testing Checklist

Before marking as complete:

- [ ] Submit test feedback successfully
- [ ] Verify GitHub issue is created with correct format
- [ ] Test with very long title/description (truncation works)
- [ ] Test with special characters and emojis
- [ ] Test dark mode (if applicable)
- [ ] Test mobile responsive layout
- [ ] Test ESC key and click-outside to close
- [ ] Test error handling (disconnect backend)
- [ ] Verify debug endpoint shows correct configuration
- [ ] Check server logs for any errors

---

## Cost Considerations

**Free Tier Limits:**
- GitHub API: 5,000 requests/hour (authenticated)
- Most hosting: 100-1000 requests/month free tier
- Estimated cost: $0-5/month for small apps (<1000 users)

**Scaling:**
- For high-traffic apps, consider:
  - Caching GitHub API responses
  - Queuing feedback submissions
  - Using GitHub Apps instead of PAT
  - Implementing honeypot spam protection

---

**Last Updated:** November 2025
**Based On:** USMC Directives Hub implementation
**Repository:** https://github.com/SemperAdmin/usmc-directives-hub
