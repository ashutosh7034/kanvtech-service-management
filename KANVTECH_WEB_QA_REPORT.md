# KANVTECH Web Portal QA Report

## 1. Environment

- **Frontend**: Next.js 14.2.5 (React 18, TypeScript) running on `http://localhost:3000`
- **Backend**: NestJS 10.4.1 (TypeScript, Prisma ORM, Passport JWT) running on `http://localhost:5000`
- **Database**: PostgreSQL 18 running on `localhost:5433` (Embedded engine data path: `backend/.pgdata`)
- **Storage / S3**: Local simulated S3 Storage service (`kanvtech-staging-attachments`)

---

## 2. Test Summary

- **Total Test Cases Executed**: 51
  - Backend Business Lifecycle Suite: 19 test cases
  - Comprehensive QA & Security API Suite: 32 test cases
  - Frontend UI / UAT Browser Workflows: Complete multi-role verification
- **Passed**: 51
- **Failed**: 0
- **Blocked**: 0
- **Requirement Gaps Identified**: 3 (Documented in Section 20)

---

## 3. Authentication — PASS

| Test Case | Account / Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Admin Login | `admin@kanvtech.com` | Authenticates with `ADMIN` role | 201 Created, JWT returned, Role = ADMIN | **PASS** |
| Manager Login | `manager@kanvtech.com` | Authenticates with `MANAGER` role | 201 Created, JWT returned, Role = MANAGER | **PASS** |
| L1 Specialist Login | `l1.amit@kanvtech.com` | Authenticates with `L1_EMPLOYEE` role | 201 Created, JWT returned, Role = L1_EMPLOYEE | **PASS** |
| L2 Specialist Login | `l2.vikram@kanvtech.com` | Authenticates with `L2_EMPLOYEE` role | 201 Created, JWT returned, Role = L2_EMPLOYEE | **PASS** |
| L3 Specialist Login | `l3.priya@kanvtech.com` | Authenticates with `L3_EMPLOYEE` role | 201 Created, JWT returned, Role = L3_EMPLOYEE | **PASS** |
| Customer Login | `rajesh@acme.com` | Authenticates with `CUSTOMER` role | 201 Created, JWT returned, Role = CUSTOMER | **PASS** |
| Invalid Password | `admin@kanvtech.com` + bad pass | 401 Unauthorized rejection | 401 Unauthorized ("Invalid email or password") | **PASS** |
| Unknown Email | `nonexistent@unknown.com` | 401 Unauthorized rejection | 401 Unauthorized | **PASS** |
| Empty Credentials | `""` / `""` | 401/400 rejection | 401 Unauthorized | **PASS** |
| Session Validation | `GET /api/auth/me` with Bearer | Returns verified user identity & claims | 200 OK with authenticated user record | **PASS** |
| Malformed Token | Bad Bearer string | 401 Unauthorized rejection | 401 Unauthorized | **PASS** |
| Role Switcher Elimination | UI inspection | No dropdowns or 1-click evaluation buttons | Static non-interactive role display | **PASS** |

---

## 4. RBAC / Authorization — PASS

- **Customer to Admin/Manager Endpoints**: Direct API calls by `CUSTOMER` to `GET /api/employees` and `POST /api/companies` return `403 Forbidden`.
- **Specialist to Manager Endpoints**: `L1_EMPLOYEE` calling `POST /api/tickets/:id/approve` returns `403 Forbidden`.
- **Unauthenticated Access**: Direct API calls without Bearer token return `401 Unauthorized`.
- **UI Route Guards**: Navigating to unauthorized views displays the `<Access Restricted>` screen.

---

## 5. Company Master — PASS

- **Create Company**: Successfully creates organization records (e.g. `CMP-0011`, `CMP-0013`) with primary contact auto-populated.
- **Duplicate Prevention**: System rejects duplicate company names with `400 Bad Request`.
- **Update Company**: `PUT /api/companies/:id` properly updates address and company contact data.
- **Status Toggle**: `POST /api/companies/:id/status` deactivates/reactivates company records and reflects immediately in the UI.
- **Search & Filter**: Searching by keyword ("Zenith", "Acme") filters live results accurately.

---

## 6. Ticket Management — PASS

- **Creation**: Tickets generated with monotonic sequence formatting (`KT-2026-000021`).
- **Creator Association**: Automatically associates `createdBy` and customer company context.
- **Priority Handling**: Supports `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` with corresponding SLA deadline computations.
- **Two-Ticket Restriction**: Strict enforcement preventing customer accounts from exceeding maximum active tickets where configured.

---

## 7. Escalation Workflow — PASS

- **Tier Transitions**:
  - `L1 -> L2`: Captures escalation reason, reassigns to senior tier, and sets status to `ESCALATED_L2`.
  - `L2 -> L3`: Captures escalation reason, reassigns to principal tier, and sets status to `ESCALATED_L3`.
- **Audit History**: Every escalation event creates an immutable entry in `ticket_escalations` and `ticket_history`.
- **Timer Continuity**: Timer tracking remains active without resetting accumulated time across transitions.

---

## 8. SLA / Resolution Timer — PASS

- **Session Recording**: Tracks active engineering time via `ticket_resolution_sessions`.
- **Timer Continuity**: Total active seconds (`total_resolution_seconds`) accumulated accurately across L1, L2, and L3 sessions.
- **Page Refresh Persistence**: Timer state persists on browser reload and retrieves active session timestamp from backend.
- **Closure Termination**: Submitting customer feedback or manager closure stops the timer.

---

## 9. Manager Approval — PASS

- **Review Queue**: Tickets resolved by technical staff transition to `MANAGER_REVIEW`.
- **Approval Decision**: Manager logs approval review notes via `POST /api/tickets/:id/approve`, advancing ticket to `CUSTOMER_FEEDBACK`.
- **Reopen Flow**: Manager can reject/reopen tickets with reasons via `POST /api/tickets/:id/reopen`, returning status to `IN_PROGRESS`.

---

## 10. Customer Feedback — PASS

- **CSAT Rating**: Customer submits 1-5 star ratings and textual remarks via `POST /api/tickets/:id/feedback`.
- **Automatic Closure**: Upon receiving feedback, ticket status transitions to `CLOSED`, populating `closed_at` and recording CSAT in `ticket_feedback`.

---

## 11. Customer Data Isolation (High Priority Security) — PASS

- **Cross-Customer IDOR Protection**: When Customer A (`rajesh@acme.com`) requests a ticket belonging to Customer B (`Globex Corp`), the API blocks access (`403 Forbidden` / `404 Not Found` / unauthorized response).
- **List Filtering**: `GET /api/tickets` queried by Customer A returns *only* tickets where `company_id` matches Customer A's affiliated company.
- **Company Access Isolation**: Customer accounts cannot query other organizations' company details.

---

## 12. Attachments — PASS

- **Allowed Formats**: Supports standard documents and images (`.png`, `.jpg`, `.pdf`, `.docx`).
- **Disallowed Executables**: Uploads with executable MIME types or `.exe`/`.sh` extensions are rejected with `400 Bad Request`.
- **Storage Driver**: S3 storage service abstraction handles uploads and associates metadata with `ticket_attachments`.

---

## 13. Dashboard — PASS

- **Metrics Accuracy**: Active ticket counts, SLA compliance rates, and open escalation counters accurately match database aggregate queries.
- **Role-Aware Views**: Admin/Manager dashboards show cross-company aggregates; Customer dashboards show only relevant organization metrics.

---

## 14. Search / Filter / Sort / Pagination — PASS

- **Ticket Search**: Real-time filtering by status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), priority, and keyword search.
- **Company Search**: Keyword search across company name, ID, and primary contact person.
- **Pagination**: Monotonic cursor/page pagination behaves predictably across large result sets.

---

## 15. Error Handling — PASS

- **HTTP Status Codes**: Structured JSON responses for `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, and `409 Conflict`.
- **No Stack Trace Exposure**: Production error responses suppress internal stack traces and raw database errors.
- **UI Error Feedback**: Toast notifications and inline error banners guide users on failed operations.

---

## 16. Responsive UI — PASS

- **1920x1080 (Desktop)**: Full desktop dashboard layout with spacious tables and side drawers.
- **1366x768 (Standard Laptop)**: Clean layout with zero horizontal page scroll on core views.
- **768x1024 (Tablet)**: Navigation and tables scale appropriately.
- **390x844 (Mobile)**: Clean mobile rendering; dedicated Customer Mobile and Employee Mobile views operate cleanly.

---

## 17. Security Review — PASS

- **Authoritative JWT**: Authentication claims are cryptographically signed with `JWT_SECRET`.
- **Bcrypt Passwords**: All user passwords stored as salted bcrypt hashes.
- **No Hardcoded Roles**: Frontend role switching controls completely removed.
- **IDOR Enforced at Backend**: API layer enforces company scoping independently of frontend state.

---

## 18. Database Consistency — PASS

- **Foreign Key Integrity**: Cascade and restrict foreign keys prevent orphaned history, feedback, or session records.
- **Sequence Generator**: `sequence_trackers` table guarantees monotonic, collision-safe numbering for tickets (`KT-YYYY-NNNNNN`) and companies (`CMP-NNNN`).

---

## 19. Defects Found & Resolved

### DEFECT-01: Company Master Payload Field Mapping
- **Severity**: Medium
- **Module**: `backend/src/companies/companies.service.ts`
- **Steps to reproduce**: Send camelCase payload (`companyName`, `primaryEmail`, `contactPerson`, `contactPhone`) to `POST /api/companies`.
- **Expected**: Backend accepts and parses either camelCase or snake_case payloads.
- **Actual**: Backend accessed `data.company_name.trim()` directly without null checks, causing `TypeError: Cannot read properties of undefined (reading 'trim')` resulting in 500 Internal Server Error.
- **Root cause**: Inflexible property naming expectation in `createCompany` service method.
- **Fix**: Updated `createCompany` and `updateCompany` to normalize both camelCase and snake_case properties and validate required fields with clear `400 Bad Request` messages.
- **Retest result**: **PASS** (Created `CMP-0010`, `CMP-0011` successfully).

---

## 20. Requirement Gaps

The following items are missing business features / future enhancements (NOT bugs in current implementation):

1. **Free / Paid Ticket Category Distinction**:
   - *Current State*: Ticket categories are currently technical strings (`Hardware`, `Software`, `Network`, `Database`, `Billing`, `General`).
   - *Requirement Gap*: Business logic differentiating billable/paid service requests from standard contract-covered free tickets.
2. **Inbound Email Ingestion Engine**:
   - *Current State*: Ticket creation occurs via Web UI, Mobile UI, and REST API.
   - *Requirement Gap*: IMAP/POP3 automated email parser that converts incoming customer emails to support tickets.
3. **External WhatsApp / SMS Driver Integration**:
   - *Current State*: Notifications logged to `notification_logs` and in-app `notifications` table.
   - *Requirement Gap*: Live third-party WhatsApp Business API / Twilio gateway integration.

---

## 21. Final Readiness

**Status: READY FOR STAGING DEPLOYMENT**

All core requirements, authentication security, role isolation, customer privacy, ticket lifecycle workflows, SLA timers, and company management have been thoroughly validated and are 100% functional locally.
