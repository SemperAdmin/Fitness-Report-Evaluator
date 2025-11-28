# Migration Guide: JSON to Supabase

This guide walks you through migrating the USMC Fitness Report Evaluator from JSON/GitHub storage to Supabase (PostgreSQL).

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Set Up Supabase Project](#step-1-set-up-supabase-project)
4. [Step 2: Configure Environment Variables](#step-2-configure-environment-variables)
5. [Step 3: Install Dependencies](#step-3-install-dependencies)
6. [Step 4: Run Database Migration](#step-4-run-database-migration)
7. [Step 5: Migrate Existing Data](#step-5-migrate-existing-data)
8. [Step 6: Update Server Code](#step-6-update-server-code)
9. [Step 7: Testing](#step-7-testing)
10. [Rollback Plan](#rollback-plan)
11. [Troubleshooting](#troubleshooting)

---

## Overview

### What's Changing?

**Current Architecture:**
- **Primary Storage**: GitHub Data Repository (via GitHub Contents API)
- **Fallback**: Local JSON files
- **Challenges**: Rate limits, network latency, complexity

**New Architecture:**
- **Primary Storage**: Supabase (PostgreSQL)
- **Fallback**: Legacy GitHub/local storage (during transition)
- **Benefits**:
  - Real-time sync capabilities
  - Better performance
  - Built-in Row Level Security (RLS)
  - Simplified codebase
  - No GitHub API rate limits

### Migration Strategy

This migration is **backwards-compatible** and uses a **phased approach**:

1. ✅ **Phase 1**: Set up Supabase infrastructure (schemas, services)
2. ✅ **Phase 2**: Migrate existing data
3. ✅ **Phase 3**: Update application code to use Supabase
4. 🔄 **Phase 4**: Run in hybrid mode (both systems) for validation
5. 🎯 **Phase 5**: Deprecate GitHub storage (optional)

---

## Prerequisites

- [ ] Node.js 16+ installed
- [ ] Supabase account (free tier is sufficient)
- [ ] Access to existing JSON data (local or GitHub)
- [ ] Basic understanding of PostgreSQL (helpful but not required)

---

## Step 1: Set Up Supabase Project

### 1.1 Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Fill in project details:
   - **Name**: `fitrep-evaluator` (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait for project to finish setting up (~2 minutes)

### 1.2 Run Database Migration

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the SQL Editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)

✅ **Expected Result**: You should see "Success. No rows returned" message.

### 1.3 Verify Tables Created

1. Go to **Table Editor** in Supabase Dashboard
2. You should see 3 new tables:
   - `users` - User accounts
   - `evaluations` - Fitness reports
   - `trait_evaluations` - Individual trait grades

### 1.4 Get API Credentials

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) - **Keep this secret!**

---

## Step 2: Configure Environment Variables

### 2.1 Copy Environment Template

```bash
cp .env.example .env
```

### 2.2 Edit `.env` File

Open `.env` and fill in your values:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Storage mode: 'supabase' or 'github'
STORAGE_MODE=supabase

# Session secret (generate with: openssl rand -hex 32)
SESSION_SECRET=your-random-session-secret-here

# Legacy GitHub settings (optional - only if keeping GitHub as fallback)
FITREP_DATA=your-github-token
DISPATCH_TOKEN=your-dispatch-token
DATA_REPO=SemperAdmin/Fitness-Report-Evaluator-Data
MAIN_REPO=SemperAdmin/Fitness-Report-Evaluator

# CORS origins
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Development
NODE_ENV=development
PORT=3000
ALLOW_DEV_TOKEN=false
```

### 2.3 Generate Session Secret

```bash
openssl rand -hex 32
```

Copy the output and paste it as the `SESSION_SECRET` value.

### 2.4 Verify Configuration

```bash
node -e "require('dotenv').config(); console.log('SUPABASE_URL:', process.env.SUPABASE_URL)"
```

✅ **Expected Result**: Should print your Supabase URL.

---

## Step 3: Install Dependencies

### 3.1 Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### 3.2 Verify Installation

```bash
npm list @supabase/supabase-js
```

✅ **Expected Result**: Should show `@supabase/supabase-js@2.39.0` (or newer).

---

## Step 4: Run Database Migration

The schema has already been created in Step 1.2. This step is complete! ✅

---

## Step 5: Migrate Existing Data

### 5.1 Dry Run (Preview)

First, preview what will be migrated without actually writing to the database:

```bash
npm run migrate:dry-run
```

This will show:
- Number of users found
- Number of evaluations per user
- Any validation errors

### 5.2 Migrate Users Only (Safe Test)

Start with just user profiles to test:

```bash
npm run migrate:users
```

### 5.3 Verify Users in Supabase

1. Go to Supabase Dashboard → **Table Editor** → **users**
2. Verify your users are present
3. Check that passwords are hashed (should start with `$2a$`)

### 5.4 Full Migration

Once you're confident, migrate everything:

```bash
npm run migrate
```

### 5.5 Migration Options

**Migrate specific user:**
```bash
node scripts/migrate-to-supabase.js --user=test.user@example.mil
```

**Verbose logging:**
```bash
node scripts/migrate-to-supabase.js --verbose
```

**From GitHub (not yet implemented):**
```bash
node scripts/migrate-to-supabase.js --source=github
```

### 5.6 Verify Data Integrity

**Check user count:**
```sql
SELECT COUNT(*) FROM users;
```

**Check evaluation count:**
```sql
SELECT COUNT(*) FROM evaluations;
```

**Check trait count:**
```sql
SELECT COUNT(*) FROM trait_evaluations;
```

**Verify relationships:**
```sql
SELECT
  u.rs_email,
  COUNT(e.id) as eval_count,
  COUNT(t.id) as trait_count
FROM users u
LEFT JOIN evaluations e ON e.user_id = u.id
LEFT JOIN trait_evaluations t ON t.evaluation_id = e.id
GROUP BY u.rs_email;
```

---

## Step 6: Update Server Code

### 6.1 Option A: Use New Route Modules (Recommended)

This approach keeps your existing `server.js` intact and adds new Supabase routes alongside.

**Edit `server/server.js`:**

Add at the top (after existing requires):

```javascript
// Supabase route handlers
const { createAccountHandler, loginHandler } = require('./authRoutes');
const { loadUserHandler, saveUserHandler } = require('./userRoutes');
const {
  saveEvaluationHandler,
  listEvaluationsHandler,
  getEvaluationHandler,
  deleteEvaluationHandler,
  exportEvaluationsHandler,
} = require('./evaluationRoutes');
const { getStorageMode } = require('./supabaseClient');
```

Add after existing routes (or replace existing routes):

```javascript
// Determine storage mode
const storageMode = getStorageMode();
console.log(`Storage mode: ${storageMode}`);

// Authentication routes (Supabase)
if (storageMode === 'supabase') {
  app.post('/api/account/create', authRateLimit, createAccountHandler);
  app.post('/api/account/login', authRateLimit, loginHandler);

  // User profile routes (Supabase)
  app.get('/api/user/load', loadUserHandler);
  app.post('/api/user/save', saveUserHandler);

  // Evaluation routes (Supabase)
  app.post('/api/evaluation/save', saveEvaluationHandler);
  app.get('/api/evaluations/list', listEvaluationsHandler);
  app.get('/api/evaluation/:evaluationId', getEvaluationHandler);
  app.delete('/api/evaluation/:evaluationId', deleteEvaluationHandler);
  app.get('/api/evaluations/export', exportEvaluationsHandler);
}
// Otherwise, existing GitHub/local routes remain active
```

### 6.2 Option B: Complete Replacement

Replace your entire `server.js` with Supabase-only endpoints.

⚠️ **Warning**: This removes GitHub storage support entirely.

### 6.3 Hybrid Mode (Both Systems)

Keep both systems running simultaneously for gradual transition:

```javascript
// Use Supabase for new accounts, GitHub for existing
app.post('/api/account/create', authRateLimit, async (req, res, next) => {
  if (getStorageMode() === 'supabase' && isSupabaseAvailable()) {
    return createAccountHandler(req, res);
  }
  // Fall through to existing GitHub handler
  next();
});
```

---

## Step 7: Testing

### 7.1 Test Account Creation

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

✅ **Expected Response:**
```json
{
  "ok": true,
  "userId": "uuid-here",
  "email": "test@example.mil",
  "method": "supabase"
}
```

### 7.2 Test Login

```bash
curl -X POST http://localhost:3000/api/account/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test@example.mil",
    "password": "TestPass123"
  }'
```

✅ **Expected Response:**
```json
{
  "ok": true,
  "user": {
    "id": "uuid-here",
    "email": "test@example.mil",
    "name": "Test User",
    "rank": "Capt"
  },
  "method": "supabase"
}
```

### 7.3 Test Saving Evaluation

Use your existing frontend or create a test evaluation file.

### 7.4 Test Listing Evaluations

```bash
curl http://localhost:3000/api/evaluations/list?email=test@example.mil
```

### 7.5 Integration Tests

Run your existing test suite (if you have one):

```bash
npm test
```

---

## Rollback Plan

If you encounter issues and need to rollback:

### Quick Rollback (Revert to GitHub Storage)

**Edit `.env`:**
```bash
STORAGE_MODE=github
```

**Restart server:**
```bash
npm start
```

✅ Your application will immediately revert to GitHub/local storage.

### Complete Rollback (Remove Supabase)

1. Set `STORAGE_MODE=github`
2. Comment out Supabase route handlers in `server.js`
3. Your data remains in Supabase for future retry

### Data Recovery

If you need to export data from Supabase back to JSON:

```bash
# Export users
curl "http://localhost:3000/api/users/export" > users-backup.json

# Export evaluations
curl "http://localhost:3000/api/evaluations/export?email=user@example.mil" > evals-backup.json
```

---

## Troubleshooting

### Issue: "Supabase not configured"

**Symptom:** Server logs show "Supabase not available, using fallback"

**Solution:**
1. Verify `.env` file has `SUPABASE_URL` and `SUPABASE_ANON_KEY`
2. Restart server: `npm start`
3. Check for typos in environment variables

### Issue: Migration Script Fails

**Symptom:** `Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set`

**Solution:**
- Ensure you're using `SUPABASE_SERVICE_ROLE_KEY` (not `SUPABASE_ANON_KEY`)
- Verify the key is correct in `.env`

### Issue: "User already exists"

**Symptom:** Migration reports users already exist

**Solution:**
- This is normal on re-runs
- Use `--dry-run` to preview without duplicates
- Users are skipped automatically (not an error)

### Issue: Row Level Security (RLS) Blocks Access

**Symptom:** `new row violates row-level security policy`

**Solution:**
- Migration script uses `service_role` key which bypasses RLS
- Verify you're using the service role key (not anon key) in `.env`

### Issue: Password Hash Not Migrating

**Symptom:** Can't login after migration

**Solution:**
- Verify password hash in `users` table starts with `$2a$`
- Check migration script didn't modify password hash
- Re-run migration for specific user:
  ```bash
  node scripts/migrate-to-supabase.js --user=test@example.mil
  ```

### Issue: Traits Not Saving

**Symptom:** Evaluation saves but traits are missing

**Solution:**
- Check `trait_evaluations` table in Supabase
- Verify `section`, `grade`, and `grade_number` constraints
- Valid sections: A, B, C, D, E
- Valid grades: A, B, C, D, E, F, G
- Grade numbers: 1-7

### Issue: CORS Errors

**Symptom:** Frontend can't connect to API

**Solution:**
- Check `CORS_ORIGINS` in `.env` includes your frontend URL
- Restart server after changing CORS settings

---

## Performance Optimization

### Enable Connection Pooling

Supabase automatically pools connections, but you can optimize:

```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-my-custom-header': 'my-app-name' },
  },
});
```

### Add Indexes (Already Done)

The migration script creates indexes on:
- `users.rs_email` (fast login lookups)
- `evaluations.user_id` (fast evaluation queries)
- `evaluations.evaluation_id` (unique lookup)
- `trait_evaluations.evaluation_id` (fast trait joins)

### Monitor Query Performance

In Supabase Dashboard → **Database** → **Query Performance**:
- Identify slow queries
- Add indexes as needed

---

## Security Best Practices

### ✅ Row Level Security (RLS)

Already configured! Users can only access their own data:

```sql
-- Users can only see their own profile
CREATE POLICY users_select_own ON users FOR SELECT
  USING (auth.uid()::text = id::text);

-- Users can only see their own evaluations
CREATE POLICY evaluations_select_own ON evaluations FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth.uid()::text = id::text));
```

### 🔒 Protect Service Role Key

**NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend:
- ✅ Use in server-side code only
- ✅ Add to `.gitignore` (`.env` should already be ignored)
- ✅ Use environment variables in production
- ❌ Don't commit to version control
- ❌ Don't log or expose in API responses

### 🛡️ Input Validation

All route handlers validate input before database operations:
- Username format validation
- Rank validation (USMC ranks only)
- Password strength requirements
- SQL injection prevention (Supabase client handles this)

---

## Production Deployment

### Environment Variables on Render.com

1. Go to Render Dashboard → Your Service → **Environment**
2. Add environment variables:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   STORAGE_MODE=supabase
   SESSION_SECRET=your-random-secret
   NODE_ENV=production
   ```

### Vercel Deployment

Add to `vercel.json`:

```json
{
  "env": {
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_ANON_KEY": "@supabase-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-key",
    "STORAGE_MODE": "supabase"
  }
}
```

Then add secrets:
```bash
vercel secrets add supabase-url "https://your-project.supabase.co"
vercel secrets add supabase-anon-key "eyJ..."
vercel secrets add supabase-service-key "eyJ..."
```

### Health Check Endpoint

Add to `server.js`:

```javascript
app.get('/health', async (req, res) => {
  const { isSupabaseAvailable } = require('./supabaseClient');

  res.json({
    status: 'ok',
    storage: getStorageMode(),
    supabase: isSupabaseAvailable(),
    timestamp: new Date().toISOString(),
  });
});
```

---

## Next Steps

After successful migration:

1. ✅ **Monitor Logs**: Watch for errors in first 24-48 hours
2. 🔄 **Gradual Rollout**: Start with test users, then roll out to all users
3. 📊 **Analytics**: Track performance improvements
4. 🗑️ **Cleanup**: After 30 days of stable operation, consider deprecating GitHub storage
5. 🚀 **New Features**: Leverage Supabase real-time, storage, and edge functions

### Potential Enhancements

- **Real-time Sync**: Use Supabase real-time subscriptions for multi-device sync
- **File Storage**: Use Supabase Storage for document uploads
- **Edge Functions**: Serverless functions for complex business logic
- **Full-Text Search**: Add search across evaluations and comments
- **Audit Logs**: Track all changes to evaluations

---

## Support

If you encounter issues:

1. Check [Supabase Documentation](https://supabase.com/docs)
2. Review logs in Supabase Dashboard → **Logs**
3. Check server logs for errors
4. Create an issue in the project repository

---

## Summary

✅ **What You've Accomplished:**

- Created Supabase database with proper schema
- Implemented Row Level Security for data protection
- Migrated existing user and evaluation data
- Updated application to use Supabase
- Maintained backward compatibility with legacy storage
- Set up production-ready infrastructure

🎉 **Congratulations!** Your USMC Fitness Report Evaluator now uses a modern, scalable PostgreSQL database with Supabase!
