# Session Cookie Debug Guide

## Current Cookie Configuration

On Render.com (production), the server is configured to use:

```javascript
COOKIE_SECURE = true           // Cookies only sent over HTTPS
COOKIE_SAMESITE = 'None'      // Allow cross-site requests
```

This is **correct** for Render but requires debugging if cookies aren't working.

---

## Debug Steps

### 1. Verify Cookies Are Set

**After logging in**, open Chrome DevTools:

1. Press **F12** to open DevTools
2. Go to **Application** tab
3. Click **Cookies** in the left sidebar
4. Select `https://fitness-report-evaluator.onrender.com`

**You should see:**
```
Name: fitrep_session
Value: eyJ1IjoiLi4ufQ==.abc123def456...
Domain: fitness-report-evaluator.onrender.com
Path: /
Secure: ✓ (checkmark)
HttpOnly: ✓ (checkmark)
SameSite: None
Expires: (1 hour from now)
```

```
Name: fitrep_csrf
Value: abc123def456...
Domain: fitness-report-evaluator.onrender.com
Path: /
Secure: ✓ (checkmark)
HttpOnly: (no checkmark)
SameSite: None
Expires: (1 hour from now)
```

**If cookies are missing:**
- Login failed silently
- Browser is blocking cookies
- Cookie settings are incorrect

---

### 2. Check Browser Console for Errors

In the **Console** tab, look for:

```
[api] base healthy; keeping selection: https://fitness-report-evaluator.onrender.com
```

Then try to navigate to `/admin.html`:
```
https://fitness-report-evaluator.onrender.com/admin.html
```

**Expected console output:**
```
[admin] Checking session...
[admin] Session check: {ok: true, user: {...}, isAdmin: true}
```

**If you see 401 or 403 errors:**
```
GET /api/admin/session 401 (Unauthorized)
```
↑ Session cookie not sent or invalid

```
GET /api/admin/session 403 (Forbidden)
```
↑ Not admin user

---

### 3. Verify Environment Variables on Render

Go to Render.com dashboard → Your service → **Environment**

**Required:**
```
ADMIN_USERNAME = semperadmin
```

**Should be auto-detected:**
```
NODE_ENV = production
RENDER_EXTERNAL_URL = https://fitness-report-evaluator.onrender.com
```

---

### 4. Test Login Flow

1. **Logout** first (clear cookies):
   - DevTools → Application → Cookies → Right-click → Clear

2. **Login** again:
   - Go to: `https://fitness-report-evaluator.onrender.com/`
   - Username: `semperadmin`
   - Password: your password
   - Click "Login"

3. **Check Network tab** in DevTools:
   - Find the `POST /api/account/login` request
   - Check the **Response Headers** for:
     ```
     Set-Cookie: fitrep_session=...; Path=/; SameSite=None; Secure; HttpOnly
     Set-Cookie: fitrep_csrf=...; Path=/; SameSite=None; Secure
     ```

4. **Navigate to admin dashboard**:
   ```
   https://fitness-report-evaluator.onrender.com/admin.html
   ```

5. **Check Network tab** again:
   - Find the `GET /api/admin/session` request
   - Check the **Request Headers** for:
     ```
     Cookie: fitrep_session=...; fitrep_csrf=...
     ```

---

## Common Issues & Fixes

### Issue 1: Cookies Not Set After Login

**Symptoms:**
- Login appears successful
- Redirected to profile
- But cookies are missing in DevTools

**Cause:**
- Login API returned 200 but didn't set cookies
- Server cookie configuration is wrong

**Fix:**
Check server logs on Render for:
```
[env] RENDER_EXTERNAL_URL: https://...
```

If missing, add to Render environment variables:
```
NODE_ENV=production
```

---

### Issue 2: Cookies Set But Not Sent on Subsequent Requests

**Symptoms:**
- Cookies visible in DevTools
- But 401 errors on API calls
- Network tab shows cookies missing from request headers

**Cause:**
- Browser blocking `SameSite=None` cookies
- HTTP/HTTPS mismatch

**Fix 1: Check URL protocol**
Make sure you're accessing:
- ✅ `https://fitness-report-evaluator.onrender.com`
- ❌ NOT `http://fitness-report-evaluator.onrender.com`

**Fix 2: Check browser settings**
- Chrome: Settings → Privacy and security → Cookies → "Allow all cookies"
- Firefox: Settings → Privacy & Security → Cookies → "Standard"

---

### Issue 3: Admin Dashboard Returns 403 Forbidden

**Symptoms:**
- Login works
- Cookies are set
- But `/admin.html` or `/api/admin/session` returns 403

**Cause:**
- `ADMIN_USERNAME` environment variable not set
- Username doesn't match
- Profile file at wrong path

**Fix:**
1. Verify environment variable on Render:
   ```
   ADMIN_USERNAME = semperadmin
   ```

2. Verify profile file path in GitHub data repo:
   ```
   users/semperadmin.json  (lowercase!)
   ```

3. Verify profile content:
   ```json
   {
     "rsEmail": "semperadmin",
     "isAdmin": true,
     ...
   }
   ```

---

### Issue 4: File Path Case Mismatch

**Symptoms:**
- Login with `semperadmin` works
- But admin access fails

**Cause:**
- Profile file is `users/SemperAdmin.json` (mixed case)
- System expects `users/semperadmin.json` (lowercase)

**Fix:**
Rename file in GitHub data repo:
- FROM: `users/SemperAdmin.json`
- TO: `users/semperadmin.json`

Update content:
```json
{
  "rsEmail": "semperadmin",
  "rsName": "Semper Admin",
  "rsRank": "Admin",
  "isAdmin": true,
  ...
}
```

---

## Still Not Working?

### Enable Debug Logging

Add to Render environment variables:
```
NODE_ENV=development
```

This will show detailed logs in Render → Logs tab.

### Check Render Logs

Look for:
```
[admin] Admin routes mounted at /api/admin
[req] GET /api/admin/session
[admin-audit] {"action":"admin_session_access","admin":"semperadmin",...}
```

### Try Incognito Mode

Sometimes browser extensions block cookies. Try:
1. Open incognito/private window
2. Navigate to your Render URL
3. Login
4. Navigate to `/admin.html`

---

## Expected Working Flow

1. **Navigate to main site:**
   ```
   https://fitness-report-evaluator.onrender.com/
   ```

2. **Login:**
   - Username: `semperadmin`
   - Password: your password
   - Click "Login"

3. **Check cookies set:**
   - DevTools → Application → Cookies
   - See `fitrep_session` and `fitrep_csrf`

4. **Navigate to admin dashboard:**
   ```
   https://fitness-report-evaluator.onrender.com/admin.html
   ```

5. **See admin dashboard:**
   ```
   FITNESS REPORT EVALUATOR - ADMIN DASHBOARD
   Logged in as: Semper Admin (Administrator)

   [Overview] [Users] [Analytics]
   ```

---

## Contact Information

If none of these steps work, provide:
1. Screenshot of DevTools → Application → Cookies
2. Screenshot of DevTools → Network tab showing login request
3. Screenshot of DevTools → Console showing any errors
4. Render logs showing the error
