# Kanvtech Service Management Platform

A centralized, production-grade customer service and ticket management platform engineered for enterprise service organizations. Built to handle company masters, employee tiers (L1/L2/L3), multi-level ticket escalation workflows, server-authoritative continuous resolution timers, configurable SLAs, manager approvals, customer feedback, and multi-channel notifications across Desktop Web Portal, Customer Mobile, and Employee Mobile applications.

---

## Architecture Overview

- **Backend API**: Node.js (v22.x) with Express, TypeScript, and clean layered architecture (Controllers, Services, Repositories, Middlewares).
- **Database Engine**: Native **MySQL 8.x / MariaDB** with InnoDB engine, utf8mb4 charset, strict foreign key constraints, composite indexes, and connection pooling via `mysql2/promise` (with an automatic embedded relational engine fallback for offline development/testing).
- **Frontend Web Portal**: React 18 with TypeScript and Vite. Modular CSS design system with custom design tokens for Kanvtech corporate navy/slate palette, high information density, accessible contrast, and zero AI-demo gimmicks.
- **Mobile Applications**: Dedicated **Customer Mobile Application** (self-service, ticket creation, feedback rating) and **Employee Mobile Application** (field work screen, check-in/check-out with geolocation, continuous timer controls).

---

## Platform Modules & Features

### 1. Company Master Directory
- Complete CRUD management for customer organizations.
- Tracks registered address, GSTN, primary corporate email, alternate contacts, and live ticket breakdown (Open, In Progress, Resolved, Closed).
- Instant company activation / deactivation status toggle.

### 2. Employee Tier Management (L1 / L2 / L3)
- Tiered specialist roster:
  - **L1 Support Specialist**: Initial triage, diagnostics, standard resolution, escalation to L2.
  - **L2 Senior Specialist**: Deep technical troubleshooting, SAN/database configurations, escalation to L3.
  - **L3 Principal Architect**: Core system architecture, kernel/firmware interventions, escalation to Parent Company / Vendor.
- Real-time active workload allocation tracking (number of active open tickets per engineer).
- Daily attendance check-in / check-out with workplace location tagging.

### 3. Core Ticketing Workflow & Business Rules
- **Centralized Ticket ID Generation**: Centralized sequential sequence: `KT-YYYY-000001`.
- **Strict Two-Open-Ticket Limit**: Customers may have a maximum of two open tickets simultaneously. If two active tickets exist, the backend strictly blocks creation and displays an actionable notice.
- **Workflow State Machine**:
  ```
  OPEN ➔ IN_PROGRESS (L1) ➔ IN_PROGRESS (L2) ➔ IN_PROGRESS (L3) ➔ RESOLVED ➔ MANAGER_REVIEW ➔ CUSTOMER_FEEDBACK ➔ CLOSED
  ```
- **Continuous Resolution Timer**:
  - Timer starts when the employee begins work on the ticket.
  - **Timer continues across escalation**: Individual resolution sessions are stored in `ticket_resolution_sessions` (`started_at`, `ended_at`, `duration_seconds`). Handoff from L1 to L2 to L3 does NOT reset the timer.
  - Server and database are the single source of truth; the client synchronizes with server timestamps.
- **Configurable SLA Engine**:
  - Priorities: `HIGH` (4h), `MEDIUM` (12h), `LOW` (24h) with configurable warning thresholds (75% elapsed).
  - Live warning badges and pulsing breach indicators.
- **Manager Approval**:
  - Resolved tickets route automatically to Manager Review.
  - Managers can **Approve Resolution** (advancing to customer feedback) or **Reopen / Send Back** (returning to `IN_PROGRESS` with explicit instructions).
- **Customer Feedback (CSAT)**:
  - 1 to 5 star rating with customer remarks.
  - Submitting feedback automatically formalizes ticket closure with audit logging.
- **Chronological Ticket Timeline**:
  - Tailored visual icons and badges for ticket creation, assignment, work start, escalations, resolution, manager review, customer feedback, and closure.

### 4. Excel & CSV Data Import Engine
- Dedicated batch import engine for both Companies and Employees.
- Workflow: `Upload ➔ Validate ➔ Preview Breakdown ➔ Show Errors ➔ Confirm ➔ Import ➔ Summary`.
- Validates row fields (GSTN format, Email format, required columns) and checks for duplicates against the live database.
- One-click downloadable Excel template.

### 5. Multi-Channel Notifications
- Abstract notification provider interface (`INotificationProvider`) supporting:
  - **In-App Notifications**: Real-time notification drawer with unread counts and read markers.
  - **Email**: SMTP / transactional email driver abstraction.
  - **WhatsApp**: Cloud API / Twilio driver abstraction.
  - **Push**: WebPush / Mobile push driver abstraction.
- Comprehensive event logging in `notification_logs`.

### 6. Operational Reports & Analytics
- 100% computed from real database telemetry (no manufactured statistics).
- Volume counts, SLA compliance percentage, breach tallies.
- Resolution time breakdown overall and by support tier (L1, L2, L3).
- Specialist workload ranking and active ticket distribution.
- Escalation matrix showing transition volumes between tiers and top reasons.

---

## Default Evaluation Accounts (Password: `Password@123`)

| Role | Email | Purpose |
|------|-------|---------|
| **Admin** | `admin@kanvtech.com` | Full platform configuration, SLA settings, and audit logs |
| **Manager** | `manager@kanvtech.com` | Approvals, reopen workflow, reports, and company management |
| **L1 Specialist** | `l1.amit@kanvtech.com` | Triage, initial resolution, and escalation to L2 |
| **L2 Specialist** | `l2.vikram@kanvtech.com` | Advanced technical troubleshooting, escalation to L3 |
| **L3 Specialist** | `l3.priya@kanvtech.com` | Core engineering, resolution, escalation to Parent Company |
| **Customer** | `rajesh@acme.com` | Acme Technologies client portal, ticket logging, CSAT feedback |

*(A 1-click evaluation switcher is available directly on the Login page and in the top header).*

---

## Setup & Running Locally

### Prerequisites
- Node.js v18+ (tested on Node.js v22 LTS)
- MySQL 8.x / MariaDB (optional; if MySQL is not running on port 3306, the platform automatically activates its zero-config relational engine fallback)

### 1. Install Dependencies
```powershell
npm install --prefix server
npm install --prefix client
```

### 2. Configure Environment (.env)
Create `server/.env` or configure root environment variables:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=kanvtech_sm
JWT_SECRET=kanvtech-production-jwt-secret-key-2026
JWT_EXPIRES_IN=24h
```

### 3. Initialize & Seed Database
```powershell
# Create MySQL database and run schema
npm run db:init --prefix server

# Seed master roles, users, employees, companies, SLAs, and settings
npm run db:seed --prefix server
```

### 4. Run Automated Test Suite
Executes all 18 mandatory business requirement test suites plus the full end-to-end lifecycle journey:
```powershell
npm test --prefix server
```
*Result: 19 PASSED, 0 FAILED.*

### 5. Start Development Servers
```powershell
# Start Backend API Server (Port 5000)
npm run dev --prefix server

# Start Frontend Web Portal (Port 3000)
npm run dev --prefix client
```
Open `http://localhost:3000` in your web browser.

---

## Automated Test Coverage (19 Test Suites)

1. `Authentication`: Bcrypt password hashing, JWT issuance, invalid credentials rejection.
2. `RBAC`: Role-based route authorization guards across all 6 roles.
3. `Company CRUD`: Company creation, contact associations, activation/deactivation.
4. `Excel Validation`: Spreadsheet parsing, GSTN/email format validation, duplicate detection.
5. `Ticket Creation`: Centralized sequential `KT-2026-XXXXXX` ID generation, customer auto-population, SLA assignment.
6. `Two-Ticket Restriction`: Strict backend rejection when customer has 2 open tickets; allowed after one closes.
7. `Assignment`: Auto-assignment routing to available L1 with lowest active workload; manual reassignment.
8. `L1 Workflow`: Work start, status transition to `IN_PROGRESS`.
9. `L1 -> L2 Escalation`: Validation preventing illegal hierarchy jumps, immutable escalation logging.
10. `L2 -> L3 Escalation`: Seamless transition to L3 core engineering.
11. `Timer Calculation`: Individual resolution sessions logged in database (`started_at`, `ended_at`, `duration_seconds`).
12. `Timer Continuity`: Continuity maintained across L1, L2, L3 escalations without resetting elapsed duration.
13. `SLA Calculation`: Priority deadline calculation, warning threshold triggers (75%), breach detection.
14. `Manager Approval`: Manager review queue, approve transition to `CUSTOMER_FEEDBACK`, reopen transition to `IN_PROGRESS`.
15. `Customer Feedback`: 1-5 star rating and remarks submission, prevents duplicate submissions.
16. `Ticket Closure`: Formal closure recording `closed_by`, `closed_at`, and `closure_reason`.
17. `Authorization`: Customer cross-company isolation (customers cannot inspect other companies' tickets).
18. `Attachment Validation`: Permitted file extensions (`.pdf`, `.png`, `.jpg`, `.xlsx`, `.docx`, `.csv`, `.txt`) and 10MB size limits.
19. **Master End-to-End Journey**:
    Customer creates ticket ➔ Ticket ID generated ➔ L1 assigned ➔ Customer acknowledged ➔ L1 starts work (Timer starts) ➔ L1 adds notes ➔ L1 escalates to L2 (Timer continues) ➔ L2 works ➔ L2 escalates to L3 (Timer continues) ➔ L3 resolves ➔ Manager reviews ➔ Manager approves ➔ Customer submits rating + remarks ➔ Ticket closes ➔ Complete timeline exists ➔ Resolution time verified ➔ SLA result verified.
#   k a n v t e c h - s e r v i c e - m a n a g e m e n t  
 #   k a n v t e c h - s e r v i c e - m a n a g e m e n t  
 