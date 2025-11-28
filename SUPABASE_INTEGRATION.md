# Supabase Integration - Quick Start

This document provides a quick reference for integrating the new Supabase routes into your existing `server/server.js` file.

## Integration Steps

### 1. Add Require Statements

Add these lines near the top of `server/server.js`, after your existing require statements:

```javascript
// Supabase modules
const { createAccountHandler, loginHandler } = require('./authRoutes');
const { loadUserHandler, saveUserHandler, deleteUserHandler } = require('./userRoutes');
const {
  saveEvaluationHandler,
  listEvaluationsHandler,
  getEvaluationHandler,
  deleteEvaluationHandler,
  exportEvaluationsHandler,
} = require('./evaluationRoutes');
const { getStorageMode, isSupabaseAvailable } = require('./supabaseClient');
```

### 2. Add Storage Mode Check

Add this near your app initialization (after creating the Express app):

```javascript
// Determine storage backend
const STORAGE_MODE = getStorageMode();
console.log(`🗄️  Storage mode: ${STORAGE_MODE}`);

if (STORAGE_MODE === 'supabase') {
  if (isSupabaseAvailable()) {
    console.log('✅ Supabase connected successfully');
  } else {
    console.warn('⚠️  Supabase not configured, falling back to legacy storage');
  }
}
```

### 3. Add Supabase Routes

You have **three options** for adding routes:

#### Option A: Replace Existing Routes (Recommended for new deployments)

**Replace** your existing authentication routes with:

```javascript
// Authentication routes
if (STORAGE_MODE === 'supabase' && isSupabaseAvailable()) {
  app.post('/api/account/create', authRateLimit, createAccountHandler);
  app.post('/api/account/login', authRateLimit, loginHandler);
} else {
  // Keep your existing /api/account/create and /api/account/login routes here
}

// User profile routes
if (STORAGE_MODE === 'supabase' && isSupabaseAvailable()) {
  app.get('/api/user/load', loadUserHandler);
  app.post('/api/user/save', saveUserHandler);
  app.delete('/api/user/delete', deleteUserHandler);
} else {
  // Keep your existing user routes here
}

// Evaluation routes
if (STORAGE_MODE === 'supabase' && isSupabaseAvailable()) {
  app.post('/api/evaluation/save', saveEvaluationHandler);
  app.get('/api/evaluations/list', listEvaluationsHandler);
  app.get('/api/evaluation/:evaluationId', getEvaluationHandler);
  app.delete('/api/evaluation/:evaluationId', deleteEvaluationHandler);
  app.get('/api/evaluations/export', exportEvaluationsHandler);
} else {
  // Keep your existing evaluation routes here
}
```

#### Option B: Add Alongside Existing (Gradual Migration)

Add new routes with `/v2` prefix while keeping existing routes:

```javascript
// V2 API - Supabase
app.post('/api/v2/account/create', authRateLimit, createAccountHandler);
app.post('/api/v2/account/login', authRateLimit, loginHandler);
app.get('/api/v2/user/load', loadUserHandler);
app.post('/api/v2/user/save', saveUserHandler);
app.post('/api/v2/evaluation/save', saveEvaluationHandler);
app.get('/api/v2/evaluations/list', listEvaluationsHandler);
app.get('/api/v2/evaluation/:evaluationId', getEvaluationHandler);
app.delete('/api/v2/evaluation/:evaluationId', deleteEvaluationHandler);

// V1 API - Legacy (existing routes remain unchanged)
// ... keep your existing routes here ...
```

Then update frontend to use `/api/v2/*` endpoints.

#### Option C: Hybrid Fallback (Best of Both Worlds)

Try Supabase first, fall back to legacy on error:

```javascript
app.post('/api/account/create', authRateLimit, async (req, res) => {
  if (STORAGE_MODE === 'supabase' && isSupabaseAvailable()) {
    try {
      return await createAccountHandler(req, res);
    } catch (error) {
      console.error('Supabase error, falling back to legacy:', error);
      // Fall through to legacy handler
    }
  }

  // Legacy GitHub/local storage handler
  // ... your existing code here ...
});
```

### 4. Add Health Check Endpoint (Optional but Recommended)

```javascript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    storage_mode: STORAGE_MODE,
    supabase_available: isSupabaseAvailable(),
    timestamp: new Date().toISOString(),
  });
});
```

### 5. Update Session Handling (If Needed)

If you're not already using `express-session`, add it:

```bash
npm install express-session
```

```javascript
const session = require('express-session');

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);
```

---

## Complete Integration Example

Here's a complete example of how your `server/server.js` should look:

```javascript
// ============================================================================
// IMPORTS
// ============================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
require('dotenv').config();

// Supabase modules
const { createAccountHandler, loginHandler } = require('./authRoutes');
const { loadUserHandler, saveUserHandler, deleteUserHandler } = require('./userRoutes');
const {
  saveEvaluationHandler,
  listEvaluationsHandler,
  getEvaluationHandler,
  deleteEvaluationHandler,
  exportEvaluationsHandler,
} = require('./evaluationRoutes');
const { getStorageMode, isSupabaseAvailable } = require('./supabaseClient');

// ... your existing imports ...

// ============================================================================
// APP INITIALIZATION
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'replace-with-random-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// CORS (if needed)
app.use((req, res, next) => {
  const origins = (process.env.CORS_ORIGINS || '').split(',');
  const origin = req.headers.origin;
  if (origins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Storage mode check
const STORAGE_MODE = getStorageMode();
console.log(`🗄️  Storage mode: ${STORAGE_MODE}`);
if (STORAGE_MODE === 'supabase') {
  if (isSupabaseAvailable()) {
    console.log('✅ Supabase connected successfully');
  } else {
    console.warn('⚠️  Supabase not configured, using fallback storage');
  }
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    storage_mode: STORAGE_MODE,
    supabase_available: isSupabaseAvailable(),
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
if (STORAGE_MODE === 'supabase' && isSupabaseAvailable()) {
  app.post('/api/account/create', createAccountHandler);
  app.post('/api/account/login', loginHandler);
} else {
  // Your existing GitHub/local authentication routes
  // app.post('/api/account/create', ...);
  // app.post('/api/account/login', ...);
}

// User profile routes
if (STORAGE_MODE === 'supabase' && isSupabaseAvailable()) {
  app.get('/api/user/load', loadUserHandler);
  app.post('/api/user/save', saveUserHandler);
  app.delete('/api/user/delete', deleteUserHandler);
} else {
  // Your existing user profile routes
  // app.get('/api/user/load', ...);
  // app.post('/api/user/save', ...);
}

// Evaluation routes
if (STORAGE_MODE === 'supabase' && isSupabaseAvailable()) {
  app.post('/api/evaluation/save', saveEvaluationHandler);
  app.get('/api/evaluations/list', listEvaluationsHandler);
  app.get('/api/evaluation/:evaluationId', getEvaluationHandler);
  app.delete('/api/evaluation/:evaluationId', deleteEvaluationHandler);
  app.get('/api/evaluations/export', exportEvaluationsHandler);
} else {
  // Your existing evaluation routes
  // app.post('/api/evaluation/save', ...);
  // app.get('/api/evaluations/list', ...);
}

// Static files (if applicable)
app.use(express.static('public'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   Storage mode: ${STORAGE_MODE}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
```

---

## Testing Your Integration

### 1. Start the Server

```bash
npm start
```

### 2. Check Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "storage_mode": "supabase",
  "supabase_available": true,
  "timestamp": "2025-11-27T20:00:00.000Z"
}
```

### 3. Test Account Creation

```bash
curl -X POST http://localhost:3000/api/account/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.mil",
    "name": "Test User",
    "rank": "Capt",
    "password": "TestPass123"
  }'
```

### 4. Test Login

```bash
curl -X POST http://localhost:3000/api/account/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test@example.mil",
    "password": "TestPass123"
  }'
```

---

## Environment Variables Reference

Required for Supabase mode:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Mode
STORAGE_MODE=supabase

# Session
SESSION_SECRET=your-random-secret-here

# Optional
NODE_ENV=production
PORT=3000
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

## Common Issues

### Issue: "Supabase not configured"

**Check:**
- `.env` file exists in project root
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set
- Server was restarted after updating `.env`

### Issue: Routes return 501

**Reason:** Storage mode is not set to `supabase` or Supabase is not available.

**Solution:** Set `STORAGE_MODE=supabase` in `.env` and restart.

### Issue: Session not persisting

**Check:**
- `express-session` is installed: `npm install express-session`
- `SESSION_SECRET` is set in `.env`
- Session middleware is added before routes

---

## Migration Checklist

- [ ] Install dependencies: `npm install @supabase/supabase-js express-session`
- [ ] Create Supabase project and run schema migration
- [ ] Copy `.env.example` to `.env` and fill in values
- [ ] Add Supabase module requires to `server.js`
- [ ] Add storage mode check
- [ ] Add/replace routes with Supabase handlers
- [ ] Add session middleware (if not already present)
- [ ] Test health endpoint
- [ ] Test account creation
- [ ] Test login
- [ ] Migrate existing data: `npm run migrate`
- [ ] Test with real frontend
- [ ] Deploy to production
- [ ] Monitor logs for errors

---

## Need Help?

1. Check [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed instructions
2. Review [Supabase Documentation](https://supabase.com/docs)
3. Check server logs for error messages
4. Verify environment variables are set correctly

---

## Summary

You've successfully integrated Supabase into your USMC Fitness Report Evaluator! 🎉

**Next steps:**
1. Migrate existing data
2. Test thoroughly with your frontend
3. Deploy to production
4. Monitor performance
