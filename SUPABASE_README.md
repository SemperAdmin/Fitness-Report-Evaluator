# Supabase Migration - Complete Package

This directory contains a complete migration package for moving the USMC Fitness Report Evaluator from JSON/GitHub storage to Supabase (PostgreSQL).

## 📦 What's Included

### 1. Database Schema
- **`supabase/migrations/001_initial_schema.sql`** - PostgreSQL schema with:
  - `users` table (RS accounts)
  - `evaluations` table (fitness reports)
  - `trait_evaluations` table (individual trait grades)
  - Row Level Security (RLS) policies
  - Indexes for performance
  - Helper functions and views

### 2. Server Infrastructure
- **`server/supabaseClient.js`** - Supabase client configuration
  - Public client (anon key)
  - Admin client (service role key)
  - Storage mode detection
  - Connection helpers

- **`server/supabaseService.js`** - Database abstraction layer
  - User CRUD operations
  - Evaluation CRUD operations
  - Clean API with standardized responses

### 3. API Routes (Express.js)
- **`server/authRoutes.js`** - Authentication endpoints
  - `POST /api/account/create` - Create account
  - `POST /api/account/login` - User login
  - Input validation
  - Password hashing with bcrypt

- **`server/userRoutes.js`** - User profile endpoints
  - `GET /api/user/load` - Load profile
  - `POST /api/user/save` - Update profile
  - `DELETE /api/user/delete` - Delete account
  - Email migration support

- **`server/evaluationRoutes.js`** - Evaluation endpoints
  - `POST /api/evaluation/save` - Save evaluation
  - `GET /api/evaluations/list` - List all evaluations
  - `GET /api/evaluation/:id` - Get single evaluation
  - `DELETE /api/evaluation/:id` - Delete evaluation
  - `GET /api/evaluations/export` - Export as JSON

### 4. Data Migration
- **`scripts/migrate-to-supabase.js`** - Migration utility
  - Reads existing JSON files (local or GitHub)
  - Validates data
  - Inserts into Supabase
  - Dry-run mode
  - Detailed logging and error handling

### 5. Configuration
- **`.env.example`** - Environment variable template
  - Supabase credentials
  - Storage mode selection
  - Session configuration
  - Legacy GitHub settings (optional)

- **`package.json`** (updated) - New dependencies and scripts
  - `@supabase/supabase-js` - Supabase client
  - `npm run migrate` - Run migration
  - `npm run migrate:dry-run` - Preview migration
  - `npm run migrate:users` - Migrate users only

### 6. Documentation
- **`MIGRATION_GUIDE.md`** - Complete step-by-step guide (10+ pages)
  - Prerequisites
  - Supabase setup
  - Environment configuration
  - Data migration
  - Testing procedures
  - Troubleshooting
  - Production deployment

- **`SUPABASE_INTEGRATION.md`** - Integration quick reference
  - Code examples
  - Route integration options
  - Testing commands
  - Common issues

- **`SUPABASE_README.md`** - This file (overview)

---

## 🚀 Quick Start (5 Minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase
1. Create project at [supabase.com](https://app.supabase.com)
2. Run `supabase/migrations/001_initial_schema.sql` in SQL Editor
3. Get API credentials from Settings → API

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your Supabase credentials
```

### 4. Migrate Data
```bash
# Preview migration (no changes)
npm run migrate:dry-run

# Run full migration
npm run migrate
```

### 5. Update Server Code
See `SUPABASE_INTEGRATION.md` for integration examples.

---

## 📊 Architecture Overview

### Current (JSON/GitHub)
```
Frontend → Express Server → GitHub API → JSON Files
                          ↓
                     Local JSON Files
```

### New (Supabase)
```
Frontend → Express Server → Supabase Client → PostgreSQL
                          ↓
                     Legacy Fallback (optional)
```

---

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  rs_email TEXT UNIQUE NOT NULL,
  rs_name TEXT NOT NULL,
  rs_rank TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_date TIMESTAMPTZ,
  last_updated TIMESTAMPTZ
);
```

### Evaluations Table
```sql
CREATE TABLE evaluations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  evaluation_id TEXT UNIQUE NOT NULL,
  marine_name TEXT,
  marine_rank TEXT,
  occasion TEXT,
  completed_date DATE,
  fitrep_average NUMERIC(3,1),
  section_i_comments TEXT,
  -- ... more fields
);
```

### Trait Evaluations Table
```sql
CREATE TABLE trait_evaluations (
  id UUID PRIMARY KEY,
  evaluation_id UUID REFERENCES evaluations(id),
  section TEXT, -- A, B, C, D, E
  trait TEXT,
  grade TEXT, -- A-G
  grade_number INTEGER -- 1-7
);
```

---

## 🔒 Security Features

### Row Level Security (RLS)
- ✅ Users can only access their own data
- ✅ Automatic policy enforcement
- ✅ Admin bypass with service role key

### Authentication
- ✅ bcrypt password hashing (cost factor 12)
- ✅ Strong password requirements
- ✅ Session-based authentication
- ✅ SQL injection prevention (parameterized queries)

### Data Protection
- ✅ Service role key never exposed to frontend
- ✅ Environment variables for secrets
- ✅ CORS configuration
- ✅ Input validation on all endpoints

---

## 🎯 Key Features

### Data Migration
- ✅ Preserves all existing data
- ✅ Maintains data relationships
- ✅ Validates data integrity
- ✅ Dry-run mode for testing
- ✅ Detailed error reporting

### Backward Compatibility
- ✅ Hybrid mode (both Supabase and GitHub)
- ✅ Easy rollback to legacy storage
- ✅ No frontend changes required
- ✅ Gradual migration support

### Performance
- ✅ Indexed queries for fast lookups
- ✅ Connection pooling
- ✅ Optimized JOIN queries
- ✅ Real-time capabilities (optional)

### Developer Experience
- ✅ Clean API abstraction
- ✅ Comprehensive documentation
- ✅ Type safety (JSDoc comments)
- ✅ Error handling throughout
- ✅ Detailed logging

---

## 📝 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/account/create` | Create new account |
| POST | `/api/account/login` | User login |

### User Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/load` | Load user profile |
| POST | `/api/user/save` | Update user profile |
| DELETE | `/api/user/delete` | Delete account |

### Evaluations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/evaluation/save` | Save/update evaluation |
| GET | `/api/evaluations/list` | List all evaluations |
| GET | `/api/evaluation/:id` | Get single evaluation |
| DELETE | `/api/evaluation/:id` | Delete evaluation |
| GET | `/api/evaluations/export` | Export as JSON |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health check |

---

## 🧪 Testing

### Manual Testing
```bash
# Test account creation
curl -X POST http://localhost:3000/api/account/create \
  -H "Content-Type: application/json" \
  -d '{"email":"test@mil","name":"Test","rank":"Capt","password":"Test123"}'

# Test login
curl -X POST http://localhost:3000/api/account/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@mil","password":"Test123"}'

# Test evaluation list
curl "http://localhost:3000/api/evaluations/list?email=test@mil"
```

### Migration Testing
```bash
# Dry run (no changes)
npm run migrate:dry-run

# Users only
npm run migrate:users

# Specific user
node scripts/migrate-to-supabase.js --user=test@example.mil

# Full migration
npm run migrate
```

---

## 🌍 Production Deployment

### Render.com
Add environment variables in dashboard:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STORAGE_MODE=supabase
SESSION_SECRET=random-secret-here
NODE_ENV=production
```

### Vercel
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add STORAGE_MODE
vercel env add SESSION_SECRET
```

### Heroku
```bash
heroku config:set SUPABASE_URL=https://your-project.supabase.co
heroku config:set SUPABASE_ANON_KEY=eyJ...
heroku config:set SUPABASE_SERVICE_ROLE_KEY=eyJ...
heroku config:set STORAGE_MODE=supabase
heroku config:set SESSION_SECRET=random-secret-here
```

---

## 🔄 Migration Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Set Up Supabase Project                             │
│    - Create project                                     │
│    - Run schema migration                               │
│    - Get API credentials                                │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│ 2. Configure Environment                                │
│    - Copy .env.example to .env                          │
│    - Add Supabase credentials                           │
│    - Set STORAGE_MODE=supabase                          │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│ 3. Test Migration (Dry Run)                             │
│    - npm run migrate:dry-run                            │
│    - Review output                                      │
│    - Verify data counts                                 │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│ 4. Migrate Users                                        │
│    - npm run migrate:users                              │
│    - Verify in Supabase dashboard                       │
│    - Test login with existing account                   │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│ 5. Migrate All Data                                     │
│    - npm run migrate                                    │
│    - Check evaluation counts                            │
│    - Verify trait evaluations                           │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│ 6. Update Server Code                                   │
│    - Add Supabase route handlers                        │
│    - Test all endpoints                                 │
│    - Verify frontend compatibility                      │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│ 7. Deploy to Production                                 │
│    - Set environment variables                          │
│    - Deploy application                                 │
│    - Monitor logs                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## ❓ FAQ

### Q: Will this break my existing application?
**A:** No! The migration is designed to be backward-compatible. Set `STORAGE_MODE=github` to keep using the old system.

### Q: Can I run both systems simultaneously?
**A:** Yes! Use hybrid mode or versioned endpoints (`/api/v2/*`) during transition.

### Q: What happens to my existing JSON files?
**A:** They remain unchanged. The migration copies data to Supabase without deleting originals.

### Q: How do I rollback if something goes wrong?
**A:** Simply set `STORAGE_MODE=github` in `.env` and restart. Your data is safe in both systems.

### Q: Do I need to change my frontend code?
**A:** No! The API endpoints remain the same (unless you choose to use versioned endpoints).

### Q: How much does Supabase cost?
**A:** Free tier includes:
- 500MB database
- 1GB file storage
- 50K monthly active users
- 2GB bandwidth

This is sufficient for most deployments. [Pricing details](https://supabase.com/pricing)

### Q: Can I self-host Supabase?
**A:** Yes! Supabase is fully open-source and can be self-hosted.

---

## 🎉 Success Criteria

After migration, you should have:

- ✅ All users migrated to Supabase
- ✅ All evaluations with trait data preserved
- ✅ API endpoints responding correctly
- ✅ Authentication working
- ✅ Frontend functioning normally
- ✅ No data loss
- ✅ Improved performance
- ✅ Ability to rollback if needed

---

## 🤝 Support

Need help?

1. Check `MIGRATION_GUIDE.md` for detailed instructions
2. Review `SUPABASE_INTEGRATION.md` for code examples
3. Check Supabase logs in dashboard
4. Review server console logs
5. Create an issue in the repository

---

## 📄 License

This migration package is part of the USMC Fitness Report Evaluator project.

---

**Last Updated:** 2025-11-27
**Version:** 1.0.0
**Status:** Production Ready ✅
