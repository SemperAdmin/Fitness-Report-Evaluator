# Product Requirements Document: Admin Dashboard

## Document Control
- **Version**: 1.0
- **Date**: 2025-11-04
- **Status**: Draft
- **Owner**: SemperAdmin
- **Application**: USMC Fitness Report Evaluator

---

## 1. Executive Summary

### 1.1 Overview
This PRD defines requirements for an administrative dashboard to be integrated into the USMC Fitness Report Evaluator application. The dashboard provides system-wide analytics, user account management, and operational insights exclusively for the system administrator (username: `semperadmin`).

### 1.2 Objectives
- Provide comprehensive visibility into system usage and user behavior
- Enable administrative control over user accounts (view, edit, delete)
- Display real-time analytics on evaluations, user engagement, and performance trends
- Deliver a distinctive dark-mode, data-heavy UI that differentiates admin from regular users

### 1.3 Success Criteria
- Admin can authenticate securely and access dashboard within 2 seconds
- All analytics refresh based on system data updates (near real-time)
- Admin can drill into individual user profiles and view/edit/delete accounts
- Dashboard provides actionable insights for system health and usage patterns
- Zero impact on regular user experience and performance

---

## 2. Product Vision & Goals

### 2.1 Vision Statement
Create a powerful, data-centric administrative interface that provides complete system visibility and user management capabilities, enabling the administrator to monitor system health, understand usage patterns, and manage user accounts efficiently.

### 2.2 Key Goals
1. **System Observability**: Provide real-time visibility into all system metrics
2. **User Management**: Enable comprehensive account administration
3. **Data Insights**: Surface actionable analytics about evaluation patterns and user behavior
4. **Operational Excellence**: Enable proactive system management through data
5. **Security**: Ensure admin-only access with robust authentication

### 2.3 Non-Goals
- Public-facing analytics or reporting
- User self-service analytics (this release)
- Data export functionality (future phase)
- Audit logging (future phase)
- Historical trend analysis with date filters (future phase)

---

## 3. User Personas

### 3.1 Primary Persona: System Administrator (semperadmin)

**Background:**
- Single system administrator responsible for platform oversight
- Needs to monitor system health, user activity, and data integrity
- Requires ability to manage user accounts and resolve issues
- Must identify usage patterns and potential problems proactively

**Needs:**
- Quick access to high-level system metrics
- Ability to drill down into individual user details
- User account management (edit, delete)
- Real-time data visibility
- Distinct admin interface separate from user experience

**Technical Profile:**
- Comfortable with data-heavy interfaces
- Prefers dark mode for extended monitoring sessions
- Values efficiency and information density

---

## 4. Functional Requirements

### 4.1 Authentication & Access Control

#### 4.1.1 Admin Authentication
**Priority**: P0 (Critical)

- **FR-AUTH-001**: System shall recognize username `semperadmin` as the admin account
- **FR-AUTH-002**: Admin shall authenticate with username and password
- **FR-AUTH-003**: Admin password shall be hashed using bcrypt (12 rounds) like regular users
- **FR-AUTH-004**: Admin account shall be created via backend API endpoint
- **FR-AUTH-005**: System shall redirect admin to dashboard UI after successful authentication
- **FR-AUTH-006**: Admin account shall NOT be able to create fitness report evaluations
- **FR-AUTH-007**: Admin session shall persist in localStorage with `admin_session` flag
- **FR-AUTH-008**: System shall auto-logout admin after 4 hours of inactivity

#### 4.1.2 Admin Authorization
**Priority**: P0 (Critical)

- **FR-AUTH-009**: All admin API endpoints shall verify username is `semperadmin`
- **FR-AUTH-010**: Regular users shall not access admin routes (403 Forbidden)
- **FR-AUTH-011**: Admin shall not appear in user listings or public metrics
- **FR-AUTH-012**: Unauthenticated requests to admin endpoints shall return 401 Unauthorized

### 4.2 Dashboard Overview

#### 4.2.1 Key Metrics Display
**Priority**: P0 (Critical)

- **FR-DASH-001**: Display total number of registered users
- **FR-DASH-002**: Display total number of evaluations across all users
- **FR-DASH-003**: Display total evaluations created in last 24 hours
- **FR-DASH-004**: Display total evaluations created in last 7 days
- **FR-DASH-005**: Display total evaluations created in last 30 days
- **FR-DASH-006**: Display average evaluations per user
- **FR-DASH-007**: Display active users (users with at least 1 evaluation)
- **FR-DASH-008**: Display inactive users (registered but zero evaluations)
- **FR-DASH-009**: Display average fitness report score across all evaluations
- **FR-DASH-010**: Display most common evaluation occasion type
- **FR-DASH-011**: Display most evaluated rank
- **FR-DASH-012**: Refresh all metrics on dashboard load (real-time data)

#### 4.2.2 Performance Analytics
**Priority**: P0 (Critical)

- **FR-DASH-013**: Display grade distribution histogram (A-G grades across all traits)
- **FR-DASH-014**: Display performance tier breakdown (Top/Middle/Developing performers)
- **FR-DASH-015**: Display average grade by section (D: Mission Accomplishment, E: Character, F: Leadership, G: Intellect)
- **FR-DASH-016**: Display most frequently used trait grade for each section
- **FR-DASH-017**: Display percentage of evaluations with high grades (>60% E-G grades)
- **FR-DASH-018**: Display percentage of evaluations with low grades (>50% A-C grades)

#### 4.2.3 User Engagement Metrics
**Priority**: P1 (High)

- **FR-DASH-019**: Display top 10 most active users (by evaluation count)
- **FR-DASH-020**: Display recent user registrations (last 10 accounts created)
- **FR-DASH-021**: Display users with most evaluations in last 30 days
- **FR-DASH-022**: Display user rank distribution (Capt, Maj, LtCol, etc.)
- **FR-DASH-023**: Display average evaluations per reporting senior rank

#### 4.2.4 Evaluation Insights
**Priority**: P1 (High)

- **FR-DASH-024**: Display evaluation occasion type distribution (Annual, Transfer, Grade Change, etc.)
- **FR-DASH-025**: Display most evaluated Marine ranks (SSgt, GySgt, etc.)
- **FR-DASH-026**: Display average Section I comment word count
- **FR-DASH-027**: Display percentage of evaluations with directed comments
- **FR-DASH-028**: Display percentage of evaluations with promotion recommendations
- **FR-DASH-029**: Display average time between evaluations (per reporting senior)

#### 4.2.5 System Health Indicators
**Priority**: P2 (Medium)

- **FR-DASH-030**: Display GitHub sync status (last successful sync timestamp)
- **FR-DASH-031**: Display number of evaluations pending sync
- **FR-DASH-032**: Display data storage usage (total JSON size)
- **FR-DASH-033**: Display API response time health check
- **FR-DASH-034**: Display local filesystem vs GitHub data discrepancies (if any)

### 4.3 User Account Management

#### 4.3.1 User List View
**Priority**: P0 (Critical)

- **FR-USER-001**: Display paginated list of all registered users (20 per page)
- **FR-USER-002**: Show user rank, name, email, creation date, evaluation count per row
- **FR-USER-003**: Provide search functionality (search by name or email)
- **FR-USER-004**: Provide sort functionality (by name, email, evaluation count, date created)
- **FR-USER-005**: Display user status indicator (active/inactive based on evaluation count)
- **FR-USER-006**: Provide "View Details" button for each user
- **FR-USER-007**: Provide "Edit" button for each user
- **FR-USER-008**: Provide "Delete" button for each user (with confirmation)

#### 4.3.2 User Detail View (Drill-Down)
**Priority**: P0 (Critical)

- **FR-USER-009**: Display complete user profile (rank, name, email, password hash, created date, last updated)
- **FR-USER-010**: Display comprehensive user statistics:
  - Total evaluations
  - Average FITREP score across all evaluations
  - Most common occasion type
  - Date range of evaluations (earliest to latest)
  - Most frequently evaluated rank
  - Average Section I word count
- **FR-USER-011**: Display list of all user's evaluations in table format:
  - Evaluation ID
  - Marine name
  - Marine rank
  - Evaluation period
  - Occasion type
  - FITREP average
  - Completion date
  - Sync status
- **FR-USER-012**: Provide "View Full Evaluation" modal for each evaluation
- **FR-USER-013**: Display grade distribution chart for this user's evaluations
- **FR-USER-014**: Display performance trend line (average score over time)

#### 4.3.3 User Edit Functionality
**Priority**: P0 (Critical)

- **FR-USER-015**: Allow admin to edit user rank
- **FR-USER-016**: Allow admin to edit user name
- **FR-USER-017**: Allow admin to edit user email/username
- **FR-USER-018**: Allow admin to reset user password (admin enters new password)
- **FR-USER-019**: System shall validate username format on edit (3-50 chars, alphanumeric/._-)
- **FR-USER-020**: System shall check username availability on change
- **FR-USER-021**: System shall update `lastUpdated` timestamp on save
- **FR-USER-022**: System shall sync updated user profile to GitHub and local storage
- **FR-USER-023**: Display success/error message after edit operation

#### 4.3.4 User Delete Functionality
**Priority**: P0 (Critical)

- **FR-USER-024**: Display confirmation modal before deleting user account
- **FR-USER-025**: Confirmation shall require admin to type username to confirm deletion
- **FR-USER-026**: System shall delete user profile JSON from GitHub and local storage
- **FR-USER-027**: System shall delete all user evaluations from GitHub and local storage
- **FR-USER-028**: System shall provide deletion progress indicator
- **FR-USER-029**: System shall display success message with count of deleted files
- **FR-USER-030**: System shall handle deletion errors gracefully (partial deletes)

### 4.4 Evaluation Data Viewer

#### 4.4.1 Evaluation Detail Modal
**Priority**: P1 (High)

- **FR-EVAL-001**: Display complete evaluation data in read-only modal:
  - Marine info (name, rank, evaluation period)
  - Reporting senior info
  - Occasion type
  - All trait evaluations with grades and justifications
  - Section I comments
  - Directed comments (if present)
  - Promotion recommendations (if present)
  - Calculated metrics (FITREP average, RV, Cumulative RV, rank)
- **FR-EVAL-002**: Provide close/dismiss functionality
- **FR-EVAL-003**: Display evaluation in formatted, readable layout
- **FR-EVAL-004**: Highlight grade warnings (consistency issues, inflation flags)

### 4.5 Data Refresh & Real-Time Updates

#### 4.5.1 Data Synchronization
**Priority**: P1 (High)

- **FR-SYNC-001**: Dashboard shall load fresh data from GitHub API on mount
- **FR-SYNC-002**: Dashboard shall fall back to local filesystem if GitHub unavailable
- **FR-SYNC-003**: Provide manual "Refresh Data" button
- **FR-SYNC-004**: Display last data refresh timestamp
- **FR-SYNC-005**: Auto-refresh dashboard data every 30 seconds (configurable)
- **FR-SYNC-006**: Show loading indicators during data fetch operations

---

## 5. Technical Architecture

### 5.1 System Components

#### 5.1.1 Frontend Components (Vanilla JavaScript)
```
/js/admin/
├── admin-auth.js          # Admin authentication logic
├── admin-dashboard.js     # Main dashboard UI & state management
├── admin-metrics.js       # Analytics calculation engine
├── admin-users.js         # User management UI & operations
├── admin-api.js           # Admin API client wrapper
└── admin-charts.js        # Chart rendering (Chart.js or Canvas)
```

#### 5.1.2 Backend API Endpoints (Express.js)
```
/api/admin/
├── POST   /auth/login              # Admin authentication
├── GET    /metrics/overview        # Dashboard metrics
├── GET    /metrics/performance     # Performance analytics
├── GET    /metrics/engagement      # User engagement data
├── GET    /users                   # List all users (paginated)
├── GET    /users/:email            # Get specific user details
├── PUT    /users/:email            # Update user profile
├── DELETE /users/:email            # Delete user account
├── GET    /users/:email/evaluations # Get user's evaluations
├── GET    /evaluations/:id         # Get specific evaluation
└── GET    /system/health           # System health metrics
```

#### 5.1.3 UI Pages
```
/admin.html                 # Admin dashboard HTML
/styles/admin.css           # Dark theme, data-heavy styles
```

### 5.2 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Admin UI)                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  admin.html + admin.css (Dark Mode)                    │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  Admin JavaScript Modules                        │  │  │
│  │  │  • admin-auth.js (authentication)                │  │  │
│  │  │  • admin-dashboard.js (main dashboard)           │  │  │
│  │  │  • admin-metrics.js (analytics engine)           │  │  │
│  │  │  • admin-users.js (user management)              │  │  │
│  │  │  • admin-api.js (API client)                     │  │  │
│  │  │  • admin-charts.js (data visualization)          │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  Storage: localStorage (admin_session)           │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────┬──────────────────────────────────────┘
                         │ HTTPS
                         ↓
        ┌────────────────────────────────────────────────┐
        │   Express.js Backend (Admin Routes)            │
        │   /server/admin-routes.js                      │
        ├────────────────────────────────────────────────┤
        │  Admin Middleware:                             │
        │  • validateAdminAuth() - verify semperadmin    │
        │  • adminRateLimit() - 60 req/min               │
        │                                                 │
        │  Admin Controllers:                            │
        │  • adminAuthController()                       │
        │  • metricsController()                         │
        │  • userManagementController()                  │
        │  • evaluationController()                      │
        └────────┬───────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
  ┌─────────────┐  ┌──────────────┐
  │   GitHub    │  │ Local File   │
  │ API / PAT   │  │ System       │
  │             │  │              │
  │ Data Repo:  │  │ Aggregation  │
  │ Fetch ALL   │  │ & Caching    │
  │ users/*.json│  │ Layer        │
  │ evaluations │  │              │
  └─────────────┘  └──────────────┘
```

### 5.3 Technology Stack

#### 5.3.1 Frontend
- **Core**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 (Dark Mode Theme)
- **Charts**: Chart.js v4.x or D3.js v7.x (for data visualization)
- **Storage**: localStorage (admin session)
- **HTTP**: Fetch API

#### 5.3.2 Backend
- **Runtime**: Node.js v18+
- **Framework**: Express.js v4.19+
- **Authentication**: bcryptjs v2.4+
- **Data Access**: node-fetch v3.3+ (GitHub API)
- **Validation**: Express-validator v7.x (input validation)

#### 5.3.3 Data Storage
- **Primary**: GitHub API (SemperAdmin/Fitness-Report-Evaluator-Data)
- **Fallback**: Local filesystem (temp/fitrep-local)
- **Cache**: In-memory caching for aggregated metrics (60-second TTL)

---

## 6. Data Model & API Specifications

### 6.1 Admin User Data Model

#### 6.1.1 Admin Profile Schema
```json
{
  "rsEmail": "semperadmin",
  "rsName": "System Administrator",
  "rsRank": "Admin",
  "passwordHash": "$2a$12$...",
  "isAdmin": true,
  "createdDate": "2025-11-04T00:00:00Z",
  "lastUpdated": "2025-11-04T00:00:00Z",
  "lastLogin": "2025-11-04T12:00:00Z"
}
```

### 6.2 Admin API Endpoints

#### 6.2.1 Authentication Endpoints

##### POST /api/admin/auth/login
Authenticate admin user.

**Request:**
```json
{
  "username": "semperadmin",
  "password": "SecureAdminPass123"
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "admin": {
    "username": "semperadmin",
    "name": "System Administrator",
    "lastLogin": "2025-11-04T12:00:00Z"
  },
  "sessionToken": "admin_session_token_xyz"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "ok": false,
  "error": "Invalid admin credentials"
}
```

#### 6.2.2 Metrics Endpoints

##### GET /api/admin/metrics/overview
Get dashboard overview metrics.

**Headers:**
```
Authorization: Bearer admin_session_token_xyz
```

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "totalUsers": 127,
    "activeUsers": 89,
    "inactiveUsers": 38,
    "totalEvaluations": 542,
    "evaluationsLast24h": 12,
    "evaluationsLast7d": 68,
    "evaluationsLast30d": 234,
    "avgEvaluationsPerUser": 4.27,
    "avgFitrepScore": 4.65,
    "mostCommonOccasion": "Annual",
    "mostEvaluatedRank": "SSgt",
    "lastRefresh": "2025-11-04T12:30:00Z"
  }
}
```

##### GET /api/admin/metrics/performance
Get performance analytics data.

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "gradeDistribution": {
      "A": 23,
      "B": 187,
      "C": 412,
      "D": 1847,
      "E": 2134,
      "F": 892,
      "G": 127
    },
    "performanceTiers": {
      "top": 156,
      "middle": 298,
      "developing": 88
    },
    "avgGradeBySection": {
      "D_mission": 4.72,
      "E_character": 4.58,
      "F_leadership": 4.65,
      "G_intellect": 4.51
    },
    "highGradePercent": 42.3,
    "lowGradePercent": 8.7
  }
}
```

##### GET /api/admin/metrics/engagement
Get user engagement metrics.

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "topUsers": [
      {
        "email": "capt.smith@usmc.mil",
        "name": "Smith, John A",
        "rank": "Capt",
        "evaluationCount": 24,
        "avgScore": 4.82
      }
    ],
    "recentRegistrations": [
      {
        "email": "lt.jones@usmc.mil",
        "name": "Jones, Sarah M",
        "rank": "1stLt",
        "createdDate": "2025-11-03T14:22:00Z"
      }
    ],
    "userRankDistribution": {
      "Capt": 45,
      "Maj": 32,
      "LtCol": 18,
      "1stLt": 22,
      "2ndLt": 10
    }
  }
}
```

#### 6.2.3 User Management Endpoints

##### GET /api/admin/users?page=1&limit=20&search=&sort=name
List all users with pagination and filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)
- `search` (optional): Search term (matches name or email)
- `sort` (optional): Sort field (name, email, evaluationCount, createdDate)
- `order` (optional): Sort order (asc, desc)

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "users": [
      {
        "email": "capt.smith@usmc.mil",
        "name": "Smith, John A",
        "rank": "Capt",
        "createdDate": "2025-01-15T10:30:00Z",
        "lastUpdated": "2025-10-22T14:45:00Z",
        "totalEvaluations": 18,
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 127,
      "totalPages": 7
    }
  }
}
```

##### GET /api/admin/users/:email
Get detailed user profile and statistics.

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "profile": {
      "email": "capt.smith@usmc.mil",
      "name": "Smith, John A",
      "rank": "Capt",
      "passwordHash": "$2a$12$...",
      "createdDate": "2025-01-15T10:30:00Z",
      "lastUpdated": "2025-10-22T14:45:00Z",
      "totalEvaluations": 18
    },
    "statistics": {
      "avgFitrepScore": 4.78,
      "mostCommonOccasion": "Annual",
      "evaluationDateRange": {
        "earliest": "2024-06-01",
        "latest": "2025-10-15"
      },
      "mostEvaluatedRank": "SSgt",
      "avgSectionIWordCount": 142,
      "gradeDistribution": {
        "D": 47,
        "E": 89,
        "F": 31,
        "G": 5
      }
    },
    "evaluations": [
      {
        "evaluationId": "eval-2025-10-15T12-00-00",
        "marineName": "Doe, Jane M",
        "marineRank": "SSgt",
        "evaluationPeriod": "2024-06-01 to 2025-05-31",
        "occasion": "annual",
        "fitrepAverage": "4.85",
        "completedDate": "2025-10-15T12:00:00Z",
        "syncStatus": "synced"
      }
    ]
  }
}
```

##### PUT /api/admin/users/:email
Update user profile.

**Request:**
```json
{
  "rsName": "Smith, John A",
  "rsRank": "Maj",
  "rsEmail": "maj.smith@usmc.mil",
  "newPassword": "NewSecurePass456"
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "message": "User updated successfully",
  "data": {
    "email": "maj.smith@usmc.mil",
    "name": "Smith, John A",
    "rank": "Maj",
    "lastUpdated": "2025-11-04T12:45:00Z"
  }
}
```

##### DELETE /api/admin/users/:email
Delete user account and all associated data.

**Request:**
```json
{
  "confirmUsername": "capt.smith@usmc.mil"
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "message": "User deleted successfully",
  "data": {
    "deletedFiles": 19,
    "profileDeleted": true,
    "evaluationsDeleted": 18
  }
}
```

##### GET /api/admin/users/:email/evaluations
Get all evaluations for a specific user.

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "email": "capt.smith@usmc.mil",
    "evaluations": [
      {
        "evaluationId": "eval-2025-10-15T12-00-00",
        "marineInfo": {
          "name": "Doe, Jane M",
          "rank": "SSgt",
          "evaluationPeriod": {
            "from": "2024-06-01",
            "to": "2025-05-31"
          }
        },
        "occasion": "annual",
        "fitrepAverage": "4.85",
        "completedDate": "2025-10-15T12:00:00Z"
      }
    ]
  }
}
```

#### 6.2.4 Evaluation Endpoints

##### GET /api/admin/evaluations/:evaluationId?userId=:email
Get complete evaluation data.

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "evaluationId": "eval-2025-10-15T12-00-00",
    "marineInfo": { ... },
    "rsInfo": { ... },
    "occasion": "annual",
    "traitEvaluations": { ... },
    "sectionIComments": "...",
    "directedComments": "...",
    "fitrepAverage": "4.85",
    "completedDate": "2025-10-15T12:00:00Z"
  }
}
```

#### 6.2.5 System Health Endpoints

##### GET /api/admin/system/health
Get system health metrics.

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "github": {
      "connected": true,
      "lastSync": "2025-11-04T12:30:00Z",
      "pendingSync": 3
    },
    "localStorage": {
      "available": true,
      "usage": "12.4 MB"
    },
    "apiResponseTime": "142ms",
    "dataDiscrepancies": 0
  }
}
```

---

## 7. UI/UX Design Specifications

### 7.1 Design Principles

1. **Data Density**: Maximize information displayed without overwhelming the user
2. **Dark Mode First**: Reduce eye strain for extended monitoring sessions
3. **Scannable Hierarchy**: Use typography and spacing to guide attention
4. **Responsive Design**: Optimize for desktop/laptop (1920x1080 primary)
5. **Progressive Disclosure**: Drill-down pattern for detailed views

### 7.2 Visual Design System

#### 7.2.1 Color Palette (Dark Theme)

**Primary Colors:**
- Background: `#0F1419` (Deep Navy/Black)
- Surface: `#1A1F2E` (Elevated panels)
- Surface Elevated: `#252A3A` (Cards, modals)
- Border: `#2D3342` (Dividers, outlines)

**Accent Colors:**
- Primary: `#4A90E2` (Links, primary actions)
- Success: `#27AE60` (Positive metrics, success states)
- Warning: `#F39C12` (Attention required)
- Danger: `#E74C3C` (Errors, delete actions)
- Info: `#3498DB` (Informational highlights)

**Text Colors:**
- Primary: `#E1E4E8` (Main text)
- Secondary: `#8B92A1` (Labels, secondary text)
- Tertiary: `#5D6470` (De-emphasized text)
- Inverse: `#FFFFFF` (High contrast text)

**Data Visualization Colors:**
- Chart 1: `#4A90E2` (Primary data series)
- Chart 2: `#27AE60` (Secondary series)
- Chart 3: `#F39C12` (Tertiary series)
- Chart 4: `#E74C3C` (Warning series)
- Chart 5: `#9B59B6` (Additional series)

#### 7.2.2 Typography

**Font Family:**
- Primary: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Monospace: `'Fira Code', 'Consolas', monospace` (for data, IDs)

**Type Scale:**
- Hero: 32px / 2rem (Dashboard title)
- H1: 24px / 1.5rem (Section headers)
- H2: 20px / 1.25rem (Subsection headers)
- H3: 18px / 1.125rem (Card titles)
- Body: 14px / 0.875rem (Primary text)
- Small: 12px / 0.75rem (Labels, captions)
- Tiny: 10px / 0.625rem (Metadata)

**Font Weights:**
- Light: 300 (De-emphasized)
- Regular: 400 (Body text)
- Medium: 500 (Labels)
- Semibold: 600 (Subheadings)
- Bold: 700 (Headings, emphasis)

#### 7.2.3 Spacing System
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px
- 3xl: 64px

#### 7.2.4 Border Radius
- sm: 4px (Buttons, inputs)
- md: 8px (Cards)
- lg: 12px (Modals, panels)
- full: 9999px (Pills, badges)

### 7.3 Layout Specifications

#### 7.3.1 Dashboard Layout Structure

```
┌───────────────────────────────────────────────────────────────┐
│ Header Bar (80px height)                                      │
│ [FITREP Admin Logo] [Last Refresh: 12:30 PM] [Refresh] [User]│
├───────────────────────────────────────────────────────────────┤
│ Navigation Tabs (48px height)                                 │
│ [Overview] [Users] [Analytics] [System Health]                │
├──────┬────────────────────────────────────────────────────────┤
│      │ Main Content Area (scrollable)                         │
│ Side │ ┌────────────────────────────────────────────────────┐ │
│ Nav  │ │ Metric Cards Grid (4 columns)                      │ │
│ (240)│ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │ │
│      │ │ │ 127  │ │ 542  │ │ 4.65 │ │ 89   │              │ │
│ [📊] │ │ │Users │ │Evals │ │Avg   │ │Active│              │ │
│ [👥] │ │ └──────┘ └──────┘ └──────┘ └──────┘              │ │
│ [📈] │ │                                                     │ │
│ [⚙️] │ │ ┌────────────────────────────────────────────────┐ │ │
│      │ │ │ Chart: Grade Distribution (Bar Chart)          │ │ │
│      │ │ │                                                 │ │ │
│      │ │ └────────────────────────────────────────────────┘ │ │
│      │ │                                                     │ │
│      │ │ ┌───────────────┐ ┌────────────────────────────┐  │ │
│      │ │ │ Top 10 Users  │ │ Recent Registrations       │  │ │
│      │ │ │ (Table)       │ │ (List)                     │  │ │
│      │ │ └───────────────┘ └────────────────────────────┘  │ │
│      │ └────────────────────────────────────────────────────┘ │
└──────┴────────────────────────────────────────────────────────┘
```

#### 7.3.2 Component Specifications

##### Metric Card Component
```css
.metric-card {
  background: #1A1F2E;
  border: 1px solid #2D3342;
  border-radius: 8px;
  padding: 24px;
  min-height: 140px;
}

.metric-card__value {
  font-size: 32px;
  font-weight: 700;
  color: #4A90E2;
  line-height: 1;
}

.metric-card__label {
  font-size: 14px;
  font-weight: 500;
  color: #8B92A1;
  margin-top: 8px;
}

.metric-card__change {
  font-size: 12px;
  margin-top: 8px;
  /* green for positive, red for negative */
}
```

##### Data Table Component
```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: #1A1F2E;
  border-radius: 8px;
  overflow: hidden;
}

.data-table thead {
  background: #252A3A;
  border-bottom: 2px solid #2D3342;
}

.data-table th {
  padding: 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #8B92A1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.data-table td {
  padding: 16px;
  border-top: 1px solid #2D3342;
  color: #E1E4E8;
  font-size: 14px;
}

.data-table tr:hover {
  background: #252A3A;
}
```

##### Button Components
```css
.btn-primary {
  background: #4A90E2;
  color: #FFFFFF;
  padding: 12px 24px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #357ABD;
  box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
}

.btn-danger {
  background: #E74C3C;
  color: #FFFFFF;
}

.btn-danger:hover {
  background: #C0392B;
}

.btn-secondary {
  background: transparent;
  border: 1px solid #2D3342;
  color: #8B92A1;
}
```

### 7.4 Page-Specific Layouts

#### 7.4.1 Overview Dashboard Page

**Sections (Top to Bottom):**

1. **Hero Metrics (4-column grid)**
   - Total Users
   - Total Evaluations
   - Avg FITREP Score
   - Active Users

2. **Activity Metrics (4-column grid)**
   - Evaluations Last 24h
   - Evaluations Last 7d
   - Evaluations Last 30d
   - Avg Evaluations/User

3. **Performance Overview (2-column grid)**
   - Grade Distribution (Bar Chart)
   - Performance Tiers (Pie Chart)

4. **Recent Activity (2-column grid)**
   - Top 10 Active Users (Table)
   - Recent Registrations (List)

#### 7.4.2 Users Management Page

**Layout:**

```
┌────────────────────────────────────────────────────────────┐
│ Users Management Header                                     │
│ [Search: _________] [Sort: Name ▼] [Showing 1-20 of 127]  │
├────────────────────────────────────────────────────────────┤
│ User Table                                                  │
│ ┌─────┬───────┬──────────────┬──────────┬──────┬─────────┐│
│ │Rank │ Name  │    Email     │ Created  │Evals │ Actions ││
│ ├─────┼───────┼──────────────┼──────────┼──────┼─────────┤│
│ │Capt │Smith  │capt.smith... │01/15/25  │  18  │[v][e][x]││
│ │Maj  │Jones  │maj.jones...  │03/22/25  │   7  │[v][e][x]││
│ │...  │...    │...           │...       │  ... │...      ││
│ └─────┴───────┴──────────────┴──────────┴──────┴─────────┘│
│                                                             │
│ [← Previous] [1] [2] [3] ... [7] [Next →]                 │
└────────────────────────────────────────────────────────────┘

Actions Legend:
[v] = View Details
[e] = Edit User
[x] = Delete User
```

#### 7.4.3 User Detail Page (Drill-Down)

**Layout:**

```
┌────────────────────────────────────────────────────────────┐
│ [← Back to Users]                                          │
│                                                             │
│ User Profile                                                │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Capt Smith, John A (capt.smith@usmc.mil)               │ │
│ │ Created: 01/15/2025 | Last Updated: 10/22/2025        │ │
│ │ [Edit Profile] [Reset Password] [Delete Account]      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ Statistics (4-column grid)                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │18 Evals  │ │4.78 Avg  │ │SSgt Top  │ │142 Words │      │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│ Performance Trend (Line Chart)                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ [Chart showing FITREP avg over time]                   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ Evaluations (Table)                                         │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Marine | Rank | Period | Occasion | Avg | Date | View  │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ Doe, J | SSgt | 6/1-5/31| Annual  |4.85|10/15 |[View] │ │
│ │ ...    | ...  | ...     | ...     |... |...   |[View] │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 7.5 Interactive Elements

#### 7.5.1 Modal Dialogs

**Evaluation Detail Modal:**
- Full-screen overlay with semi-transparent backdrop
- Centered modal (max-width: 900px)
- Close button (top-right)
- Scrollable content area
- Formatted display of all evaluation data
- Grade highlighting based on performance level

**Delete Confirmation Modal:**
- Centered modal (max-width: 500px)
- Red/danger theme
- Warning icon
- Confirmation text input (user must type username)
- Cancel and Confirm Delete buttons
- Disable confirm until username matches

**Edit User Modal:**
- Centered modal (max-width: 600px)
- Form with inputs for rank, name, email
- Optional password reset section
- Validation messages
- Save and Cancel buttons

#### 7.5.2 Loading States

**Skeleton Loaders:**
- Use for metric cards while loading
- Animated pulse effect
- Match component dimensions

**Spinner:**
- Use for API calls (e.g., delete operations)
- Overlay with loading message

**Progress Bar:**
- Use for multi-step operations (e.g., bulk delete)

### 7.6 Responsive Breakpoints

- Desktop (≥1920px): 4-column metric grid
- Laptop (1440-1919px): 4-column metric grid, adjusted spacing
- Tablet (768-1439px): 2-column metric grid
- Mobile (<768px): Single column (admin dashboard not optimized for mobile)

---

## 8. Analytics & Metrics Details

### 8.1 Metric Calculation Logic

#### 8.1.1 User Metrics

**Total Users:**
```javascript
// Count all user profile JSON files excluding admin
totalUsers = allUserProfiles.filter(u => u.rsEmail !== 'semperadmin').length
```

**Active Users:**
```javascript
// Users with at least 1 evaluation
activeUsers = allUsers.filter(u => u.totalEvaluations > 0).length
```

**Inactive Users:**
```javascript
inactiveUsers = totalUsers - activeUsers
```

**Average Evaluations Per User:**
```javascript
avgEvalsPerUser = totalEvaluations / totalUsers
```

#### 8.1.2 Evaluation Metrics

**Total Evaluations:**
```javascript
// Sum all evaluations across all users
totalEvaluations = allUsers.reduce((sum, user) => sum + user.totalEvaluations, 0)
```

**Evaluations Last 24h/7d/30d:**
```javascript
// Filter evaluations by completedDate
const now = new Date()
const last24h = evaluations.filter(e =>
  new Date(e.completedDate) > new Date(now - 24*60*60*1000)
).length
```

**Average FITREP Score:**
```javascript
// Mean of all fitrepAverage values
avgFitrepScore = evaluations.reduce((sum, e) =>
  sum + parseFloat(e.fitrepAverage), 0
) / evaluations.length
```

#### 8.1.3 Performance Metrics

**Grade Distribution:**
```javascript
// Count occurrences of each grade across all trait evaluations
gradeDistribution = {A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0}
evaluations.forEach(eval => {
  Object.values(eval.traitEvaluations).forEach(trait => {
    gradeDistribution[trait.grade]++
  })
})
```

**Performance Tier Classification:**
```javascript
// Based on FITREP average
performanceTiers = {
  top: evaluations.filter(e => parseFloat(e.fitrepAverage) >= 4.5).length,
  middle: evaluations.filter(e => {
    const avg = parseFloat(e.fitrepAverage)
    return avg >= 3.5 && avg < 4.5
  }).length,
  developing: evaluations.filter(e => parseFloat(e.fitrepAverage) < 3.5).length
}
```

**Average Grade By Section:**
```javascript
// Calculate mean grade for each section (D, E, F, G)
const gradeValues = {A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7}
avgGradeBySection = {
  D_mission: mean(allTraits.filter(t => t.section === 'D').map(t => gradeValues[t.grade])),
  E_character: mean(allTraits.filter(t => t.section === 'E').map(t => gradeValues[t.grade])),
  F_leadership: mean(allTraits.filter(t => t.section === 'F').map(t => gradeValues[t.grade])),
  G_intellect: mean(allTraits.filter(t => t.section === 'G').map(t => gradeValues[t.grade]))
}
```

### 8.2 Chart Specifications

#### 8.2.1 Grade Distribution Bar Chart

**Type:** Horizontal Bar Chart

**Data:**
- X-axis: Grade labels (A, B, C, D, E, F, G)
- Y-axis: Count of occurrences

**Styling:**
- Bar colors: Gradient from red (A) to green (G)
- Grid lines: Horizontal only
- Labels: Inside bars if space allows, otherwise outside
- Legend: None (self-explanatory)

#### 8.2.2 Performance Tiers Pie Chart

**Type:** Doughnut Chart

**Data:**
- Top Performers (green)
- Middle Performers (blue)
- Developing Performers (orange)

**Styling:**
- Center text: Total evaluations
- Percentage labels on segments
- Legend: Bottom position

#### 8.2.3 User Performance Trend Line Chart

**Type:** Line Chart (on user detail page)

**Data:**
- X-axis: Evaluation completion dates
- Y-axis: FITREP average (1-7 scale)

**Styling:**
- Line color: Primary blue (#4A90E2)
- Point markers: Visible on hover
- Grid: Both axes
- Reference line: User's overall average (dashed)

---

## 9. Security & Access Control

### 9.1 Authentication & Authorization

#### 9.1.1 Admin Authentication Requirements
- Admin username MUST be exactly `semperadmin` (case-sensitive)
- Password must meet strength requirements:
  - Minimum 12 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 number
  - At least 1 special character
- Password hashed with bcrypt (12 rounds)
- Admin profile stored in same format as regular users

#### 9.1.2 Session Management
- Admin session token stored in localStorage (`admin_session`)
- Session expires after 4 hours of inactivity
- Session validated on every API request
- Failed authentication attempts logged (future: rate limiting)

#### 9.1.3 Authorization Middleware
```javascript
// server/middleware/admin-auth.js
function validateAdminAuth(req, res, next) {
  const username = req.body.username || req.session?.username

  if (username !== 'semperadmin') {
    return res.status(403).json({
      ok: false,
      error: 'Forbidden: Admin access required'
    })
  }

  // Verify session token or password
  // ...

  next()
}
```

### 9.2 Data Protection

#### 9.2.1 User Data Access
- Admin can view all user data (necessary for management)
- User password hashes displayed but NOT editable (only reset)
- All admin actions should be performed via backend API (no direct GitHub writes from frontend)

#### 9.2.2 Sensitive Data Handling
- Never log password hashes or session tokens
- Sanitize all user inputs before processing
- Validate username format on edit (prevent injection)
- Confirm dangerous operations (delete) with secondary confirmation

### 9.3 Rate Limiting

#### 9.3.1 Admin API Rate Limits
- Auth endpoint: 10 attempts per IP per 15 minutes
- Admin endpoints: 100 requests per IP per minute
- Use existing rate limiter from server.js

```javascript
const adminRateLimit = {
  auth: 10,      // 10 login attempts per 15 min
  api: 100       // 100 requests per minute
}
```

### 9.4 Input Validation

#### 9.4.1 Server-Side Validation Rules
- Username: 3-50 chars, alphanumeric + `. _ -`
- Name: 2-100 chars, no special validation
- Rank: Must match predefined rank list
- Password (new): Meet strength requirements
- Email format validation (if used for notifications)

#### 9.4.2 Sanitization
- Strip HTML tags from text inputs
- Encode special characters in outputs
- Validate file paths (for evaluation access)

---

## 10. Implementation Plan

### 10.1 Phase 1: Foundation (Week 1)

#### Milestone 1.1: Backend Infrastructure
**Duration:** 3 days

**Tasks:**
1. Create admin profile for `semperadmin`
2. Implement admin authentication endpoint (`POST /api/admin/auth/login`)
3. Create admin authorization middleware (`validateAdminAuth`)
4. Set up admin route structure (`/server/admin-routes.js`)
5. Implement rate limiting for admin endpoints
6. Add admin session management

**Deliverables:**
- Admin can authenticate via API
- Middleware protects admin routes
- Admin profile stored in data repo

#### Milestone 1.2: Data Aggregation Layer
**Duration:** 2 days

**Tasks:**
1. Create data aggregation service (`/server/services/admin-data-service.js`)
2. Implement metric calculation functions
3. Add caching layer (60-second TTL)
4. Implement user listing and search
5. Test GitHub API data fetching performance

**Deliverables:**
- Backend can calculate all required metrics
- API responds within 1 second
- Caching reduces GitHub API calls

### 10.2 Phase 2: Admin Dashboard UI (Week 2)

#### Milestone 2.1: Layout & Navigation
**Duration:** 2 days

**Tasks:**
1. Create `/admin.html` page
2. Implement admin login UI
3. Create dark theme CSS (`/styles/admin.css`)
4. Build navigation header and tabs
5. Create responsive grid layout
6. Implement side navigation

**Deliverables:**
- Admin login page functional
- Dark theme applied consistently
- Navigation structure in place

#### Milestone 2.2: Overview Dashboard
**Duration:** 3 days

**Tasks:**
1. Build metric card component
2. Implement hero metrics section
3. Add activity metrics section
4. Integrate Chart.js library
5. Create grade distribution chart
6. Create performance tiers chart
7. Build top users table
8. Build recent registrations list
9. Implement data refresh functionality

**Deliverables:**
- Overview dashboard fully functional
- All metrics display correctly
- Charts render properly
- Data refreshes on demand

### 10.3 Phase 3: User Management (Week 3)

#### Milestone 3.1: User List & Search
**Duration:** 2 days

**Tasks:**
1. Build user list table component
2. Implement pagination
3. Add search functionality
4. Add sort functionality
5. Create user status indicators
6. Wire up to backend API

**Deliverables:**
- User list displays all users
- Search and sort work correctly
- Pagination handles large user counts

#### Milestone 3.2: User Detail & Edit
**Duration:** 3 days

**Tasks:**
1. Create user detail page layout
2. Implement user statistics display
3. Build user evaluations table
4. Create performance trend chart
5. Build edit user modal
6. Implement user profile update API
7. Add form validation
8. Test update functionality

**Deliverables:**
- User detail page shows comprehensive info
- Admin can edit user profiles
- Changes persist to GitHub and local storage

### 10.4 Phase 4: Advanced Features (Week 4)

#### Milestone 4.1: User Deletion
**Duration:** 2 days

**Tasks:**
1. Build delete confirmation modal
2. Implement username confirmation input
3. Create deletion API endpoint
4. Add progress indicator for deletion
5. Handle partial deletion errors
6. Test deletion of users with many evaluations

**Deliverables:**
- Admin can delete user accounts
- Deletion removes profile and all evaluations
- Confirmation prevents accidental deletion

#### Milestone 4.2: Evaluation Viewer
**Duration:** 2 days

**Tasks:**
1. Create evaluation detail modal
2. Format evaluation data display
3. Add grade highlighting
4. Implement close/dismiss functionality
5. Test with various evaluation types

**Deliverables:**
- Admin can view full evaluation details
- Evaluation displayed in readable format
- Modal works smoothly

#### Milestone 4.3: Analytics Enhancements
**Duration:** 1 day

**Tasks:**
1. Implement performance analytics page
2. Add engagement metrics page
3. Create system health page
4. Add auto-refresh (30-second interval)
5. Display last refresh timestamp

**Deliverables:**
- All analytics pages functional
- Data stays current with auto-refresh
- System health indicators work

### 10.5 Phase 5: Testing & Refinement (Week 5)

#### Milestone 5.1: Integration Testing
**Duration:** 2 days

**Tasks:**
1. Test full authentication flow
2. Test all CRUD operations on users
3. Test metric calculations with real data
4. Test pagination with large datasets
5. Test error handling (network failures, etc.)
6. Performance testing (load time, API response)

**Deliverables:**
- All features tested end-to-end
- No critical bugs
- Performance acceptable

#### Milestone 5.2: Security Hardening
**Duration:** 1 day

**Tasks:**
1. Review authorization checks on all endpoints
2. Test rate limiting
3. Validate input sanitization
4. Test session expiration
5. Review password reset security

**Deliverables:**
- Security vulnerabilities addressed
- Admin access properly restricted

#### Milestone 5.3: UI Polish & Documentation
**Duration:** 2 days

**Tasks:**
1. Refine dark theme consistency
2. Add loading states to all async operations
3. Improve error messages
4. Add tooltips and help text
5. Write admin user guide
6. Document API endpoints

**Deliverables:**
- UI polished and professional
- Admin documentation complete
- API documentation updated

---

## 11. Success Metrics

### 11.1 Performance Metrics
- Dashboard load time: < 2 seconds
- API response time: < 500ms (cached), < 2s (uncached)
- User list pagination: < 1 second per page
- Chart rendering: < 500ms

### 11.2 Functionality Metrics
- Admin authentication success rate: 100%
- Metric calculation accuracy: 100%
- User edit success rate: > 99%
- User deletion success rate: > 99%
- Data refresh success rate: > 95%

### 11.3 Usability Metrics
- Admin can find specific user within 3 clicks
- Admin can edit user profile in < 30 seconds
- Admin can view system health at a glance
- Dashboard is scannable without scrolling (1920x1080)

### 11.4 Security Metrics
- Zero unauthorized access to admin endpoints
- Zero password leaks or exposures
- 100% of dangerous operations require confirmation
- Session expiration enforced consistently

---

## 12. Risks & Mitigations

### 12.1 Risks

**Risk 1: GitHub API Rate Limits**
- **Impact:** High
- **Likelihood:** Medium
- **Mitigation:** Implement aggressive caching (60s TTL), batch requests, optimize queries

**Risk 2: Performance with Large Datasets**
- **Impact:** High
- **Likelihood:** Medium
- **Mitigation:** Implement pagination, lazy loading, in-memory caching, consider indexing

**Risk 3: Admin Account Compromise**
- **Impact:** Critical
- **Likelihood:** Low
- **Mitigation:** Strong password requirements, session expiration, rate limiting, future: 2FA

**Risk 4: Accidental Data Deletion**
- **Impact:** High
- **Likelihood:** Medium
- **Mitigation:** Confirmation modals, username verification, no bulk delete (initially)

**Risk 5: UI Complexity**
- **Impact:** Medium
- **Likelihood:** Medium
- **Mitigation:** Iterative design, focus on information hierarchy, user testing

### 12.2 Dependencies

**External Dependencies:**
- GitHub API availability (99.9% uptime)
- Local filesystem access (development fallback)
- Chart.js library (stable, widely used)

**Internal Dependencies:**
- Existing backend server infrastructure
- Current data model and storage structure
- Authentication system

---

## 13. Future Enhancements (Post-V1)

### 13.1 Phase 2 Features
1. **Data Export**: CSV/PDF export of analytics and user lists
2. **Audit Logging**: Track all admin actions with timestamps
3. **Date Filters**: Historical trend analysis with date range selectors
4. **Bulk Operations**: Bulk user import/export, bulk delete
5. **Advanced Search**: Filter by rank, date range, evaluation count, etc.
6. **Email Notifications**: Notify users of account changes
7. **Dashboard Customization**: Admins can rearrange/hide widgets
8. **API Usage Stats**: Track API calls, identify usage patterns

### 13.2 Phase 3 Features
1. **Multi-Admin Support**: Support for multiple admin accounts with role-based permissions
2. **System Alerts**: Automated alerts for anomalies (sudden drop in usage, etc.)
3. **Data Backup & Restore**: Admin-initiated backups and restoration
4. **User Impersonation**: View system as specific user (for support)
5. **Custom Reports**: Build and save custom analytics reports
6. **Integration Webhooks**: External system integrations
7. **Advanced Visualizations**: Interactive dashboards with drill-down
8. **Mobile Admin App**: Responsive mobile version or native app

---

## 14. Appendices

### Appendix A: API Endpoint Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/admin/auth/login | Admin login | No |
| GET | /api/admin/metrics/overview | Dashboard metrics | Yes |
| GET | /api/admin/metrics/performance | Performance analytics | Yes |
| GET | /api/admin/metrics/engagement | Engagement metrics | Yes |
| GET | /api/admin/users | List users (paginated) | Yes |
| GET | /api/admin/users/:email | Get user details | Yes |
| PUT | /api/admin/users/:email | Update user profile | Yes |
| DELETE | /api/admin/users/:email | Delete user account | Yes |
| GET | /api/admin/users/:email/evaluations | Get user evaluations | Yes |
| GET | /api/admin/evaluations/:id | Get evaluation details | Yes |
| GET | /api/admin/system/health | System health check | Yes |

### Appendix B: Component File Structure

```
/
├── admin.html                          # Admin dashboard HTML
├── styles/
│   └── admin.css                       # Admin dark theme styles
├── js/
│   └── admin/
│       ├── admin-auth.js               # Authentication logic
│       ├── admin-dashboard.js          # Main dashboard controller
│       ├── admin-metrics.js            # Metrics calculation
│       ├── admin-users.js              # User management UI
│       ├── admin-api.js                # API client wrapper
│       └── admin-charts.js             # Chart rendering
├── server/
│   ├── admin-routes.js                 # Admin API routes
│   ├── middleware/
│   │   └── admin-auth.js               # Authorization middleware
│   ├── controllers/
│   │   ├── admin-auth-controller.js    # Auth logic
│   │   ├── admin-metrics-controller.js # Metrics endpoints
│   │   └── admin-users-controller.js   # User management logic
│   └── services/
│       └── admin-data-service.js       # Data aggregation service
└── docs/
    └── PRD-Admin-Dashboard.md          # This document
```

### Appendix C: Design Mockups

*(Mockups would be included here in a real PRD - wireframes/screenshots of key pages)*

### Appendix D: Glossary

- **FITREP**: Fitness Report - performance evaluation for USMC personnel
- **RS**: Reporting Senior - officer conducting the evaluation
- **RV**: Relative Value - performance metric based on statistical distribution
- **Trait**: Individual evaluation criterion (e.g., Performance, Leadership)
- **Section I**: Narrative comments section of FITREP
- **Directed Comments**: Special circumstances or context for evaluation
- **Grade Inflation**: Tendency to assign artificially high grades
- **Left-to-Right Methodology**: Standards-based evaluation approach (vs. outcome-based)

---

## Document Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | SemperAdmin | 2025-11-04 | ____________ |
| Technical Lead | TBD | TBD | ____________ |
| Security Review | TBD | TBD | ____________ |

---

**END OF DOCUMENT**
