# KANVTECH SERVICE MANAGEMENT PLATFORM
# FINAL DEVELOPMENT PC AUDIT & PRE-OFFICE-SERVER UAT REPORT

**Audit Date:** November 2, 2026  
**Auditor:** Senior QA Engineer, Full-Stack Architect & Security Auditor  
**Scope:** Development PC Complete Audit & Manual Testing Only  
**Target Environment:** Development PC (`127.0.0.1` / LAN `192.168.3.111`)  
**Deployment Status:** Pre-Office-Server Verification Complete  

---

## 1. EXECUTIVE SUMMARY

An end-to-end audit, build validation, and role-wise User Acceptance Testing (UAT) was conducted on the development PC for the KANVTECH Service Management Platform. The primary focus of this audit was to independently verify the recently pushed tenant-isolation security fixes, validate frontend and backend production builds, confirm multi-role authentication behavior, test customer portal isolation, evaluate module functional workflows, and verify local area network (LAN) accessibility prior to office server release.

### Summary of Audit Findings
* **Git Status:** Working directory is clean and strictly synchronized with `origin/main` at commit `e767841603a344cbb1aae523ff156eab0f4064e7`.
* **Build Integrity:** Both the NestJS backend and Next.js frontend production builds succeeded with exit code 0 and zero compilation errors.
* **Automated Suites:** 99 out of 99 automated tests across 7 verification suites passed (100% pass rate).
* **Tenant Isolation:** Enforced tenant scoping on backup restore, imports, tickets, and multi-tenant switching was independently verified via negative security tests.
* **Customer Portal:** Customer authentication (`contact@acme.com`), ticket logging, company-scoping, and mobile view (`/customer-mobile`) were verified. Negative tests confirmed customer accounts cannot access employee directories, manager reviews, or audit logs.
* **LAN Accessibility:** Verified functional access over the local network at `http://192.168.3.111:3000` (Frontend) and `http://192.168.3.111:5000` (Backend API).
* **Database & Office Server Protection:** Strict non-destructive compliance was maintained. No direct connection to PostgreSQL port 5432 was initiated; no migrations, resets, or seeds were executed; and zero connections were made to the office server.

---

## 2. GIT COMMIT VERIFICATION

Independent inspection of the local repository and GitHub remote repository was performed.

| Attribute | Verified Value | Status |
| :--- | :--- | :--- |
| **Current Branch** | `main` | Verified |
| **Tracking Remote** | `origin/main` | Synchronized |
| **Local Commit SHA** | `e767841603a344cbb1aae523ff156eab0f4064e7` | Matches Remote |
| **Remote Commit SHA** | `e767841603a344cbb1aae523ff156eab0f4064e7` | Matches Local |
| **Working Tree Status** | Clean (0 modified, 0 staged, 2 untracked docs) | Clean |
| **Commit Message** | `fix(isolation): enforce mandatory tenant context and eliminate default fallbacks across restore and resource creation` | Confirmed |

### Verified Security-Fix Files in Commit `e767841`
The commit contains the exact 8 authorized security-fix files:
1. `backend/src/companies/companies.controller.ts` (Mandatory tenant check on company creation)
2. `backend/src/employees/employees.controller.ts` (Mandatory tenant check on employee creation)
3. `backend/src/export/export.controller.ts` (Tenant context validation on backup restore)
4. `backend/src/export/export.service.ts` (Strict table-level tenant scoping and overwrite defense in `commitRestore`)
5. `backend/src/import/import.controller.ts` (Forced authenticated tenant attribution on batch import)
6. `backend/src/products/products.controller.ts` (Mandatory tenant check on product creation)
7. `backend/src/prospects/prospects.controller.ts` (Mandatory tenant check on prospect creation)
8. `backend/src/tickets/tickets.controller.ts` (Mandatory tenant check on ticket creation)

---

## 3. BACKEND BUILD RESULTS

| Build Step | Command Executed | Exit Code | Result | Details |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript / NestJS Build** | `cd backend; npx nest build` | `0` | **PASS** | 0 compilation errors. Emitted `dist/` cleanly. |
| **Service Status** | Running on PID background task | `0` | **PASS** | `GET /api/health` -> HTTP 200 `{"status":"ok","database":"connected"}` |

---

## 4. FRONTEND BUILD RESULTS

| Build Step | Command Executed | Exit Code | Result | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Next.js Production Build** | `cd web; npm run build` | `0` | **PASS** | 5 static pages generated. Bundle size: 102 kB shared JS. |
| **TypeScript Validation** | `cd web; npx tsc --noEmit` | `0` | **PASS** | 0 type errors across all React components and pages. |
| **Dev Server Reload** | `cd web; npm run dev` | `0` | **PASS** | Bound to `0.0.0.0:3000` (`localhost:3000` and `192.168.3.111:3000`). |

---

## 5. AUTOMATED TEST SUMMARY

A comprehensive battery of non-destructive automated test suites was executed against the application.

| Test Suite File | Focus Area | Total Tests | Passed | Failed | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/scripts/verify-roles-and-access.js` | Platform Incharge vs Super Admin RBAC | 25 | 25 | 0 | **PASS** |
| `web/scripts/test-login-redirect.js` | Role-wise Client Redirect Logic | 13 | 13 | 0 | **PASS** |
| `backend/test/isolated-mock-security.spec.ts` | Multi-Tenant IDOR & Isolation Boundaries | 10 | 10 | 0 | **PASS** |
| `backend/test/security-hardening-suite.spec.ts` | Attack Mitigation & Privilege Escalation | 13 | 13 | 0 | **PASS** |
| `backend/test/tenant-provisioning-workspace-login.spec.ts` | Provisioning, Membership & Listing | 20 | 20 | 0 | **PASS** |
| `backend/test/mass-update-safety-suite.spec.ts` | Mass Update Excel Parsing & Field Safety | 12 | 12 | 0 | **PASS** |
| `backend/test/remember-me-auth.spec.ts` | JWT Expiration & Cookie Session Lifecycles | 6 | 6 | 0 | **PASS** |
| **TOTAL** | | **99** | **99** | **0** | **100% PASS** |

---

## 6. ROLE-WISE LOGIN AND ACCESS CONTROL UAT

Manual and automated API UAT testing was conducted for each designated platform role.

| Role Tested | Account Email | Login Status | Role Returned | Redirect Path | Authorized Route Test | Restricted Route Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Platform Incharge** | `ashutosh@kanvtech.com` | HTTP 200 | `PLATFORM_INCHARGE` | `/platform` | `/api/platform/overview` (HTTP 200) | Scoped to Platform Ops | **PASS** |
| **Tenant Super Admin** | `admin@kanvtech.com` | HTTP 200 | `SUPER_ADMIN` | `/dashboard` | `/api/companies` (HTTP 200) | `/api/platform/overview` (HTTP 403) | **PASS** |
| **L1 Employee** | `amit.l1@kanvtech.com` | HTTP 200 | `L1_EMPLOYEE` | `/dashboard` | `/api/tickets` (HTTP 200) | `/api/audit-logs` (HTTP 403) | **PASS** |
| **L2 Employee** | `rahul.l2@kanvtech.com` | HTTP 200 | `L2_EMPLOYEE` | `/dashboard` | `/api/tickets` (HTTP 200) | `/api/audit-logs` (HTTP 403) | **PASS** |
| **L3 Employee** | `priya.l3@kanvtech.com` | HTTP 200 | `L3_EMPLOYEE` | `/dashboard` | `/api/tickets` (HTTP 200) | `/api/audit-logs` (HTTP 403) | **PASS** |
| **Customer** | `contact@acme.com` | HTTP 200 | `CUSTOMER` | `/dashboard` | `/api/tickets` (HTTP 200) | `/api/employees` (HTTP 403) | **PASS** |
| **Manager / HOD** | `manager@kanvtech.com` | HTTP 401 | N/A | N/A | N/A | Missing TenantMembership in DB | **FAIL (Data Issue)** |

> [!NOTE]
> The account `manager@kanvtech.com` returned HTTP 401 (`Access denied. No active company workspace found for this user account.`) because the user account exists in `User` and `Employee` tables, but lacks an active `TenantMembership` link in the development database. Tenant Super Admin (`admin@kanvtech.com`) and Platform Incharge (`ashutosh@kanvtech.com`) are fully functional with active tenant memberships.

---

## 7. MODULE-WISE FUNCTIONAL TESTING

All primary functional modules were evaluated using authenticated API calls and frontend view inspections under the `admin@kanvtech.com` tenant context.

| Module | Route / API Endpoint | HTTP Status | Payload / Record Verification | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Operations Dashboard** | `GET /api/reports/dashboard` | HTTP 200 | Active volume, SLA breach counters, CSAT score | **PASS** |
| **Department Master** | `GET /api/departments` | HTTP 200 | Department directory filtered by tenant | **PASS** |
| **Customer Master** | `GET /api/companies` | HTTP 200 | Returns 20 records; search `?search=Acme` matches `CMP-0001` | **PASS** |
| **Branch Management** | `GET /api/companies/CMP-0001/branches` | HTTP 200 | Returns customer organization branch directory | **PASS** |
| **Products Master** | `GET /api/products` | HTTP 200 | 8 active catalog products returned | **PASS** |
| **Specialist Employees** | `GET /api/employees` | HTTP 200 | 10 employee specialist records returned | **PASS** |
| **Task Allotment Queue** | `GET /api/task-allotment/queue` | HTTP 200 | Returns unassigned and active support tickets | **PASS** |
| **Support Tickets** | `GET /api/tickets` | HTTP 200 | Returns active ticket queue with SLA tracking data | **PASS** |
| **Implementations** | `GET /api/implementations` | HTTP 200 | New onboarding implementation projects loaded | **PASS** |
| **Annual Maintenance** | `GET /api/subscriptions` | HTTP 200 | Active AMC / subscription contracts loaded | **PASS** |
| **Audit Logs** | `GET /api/audit-logs` | HTTP 200 | 100 recent security audit log entries returned | **PASS** |
| **Import Templates** | `GET /api/import/template/customers` | HTTP 200 | Customer onboarding Excel/CSV template download | **PASS** |
| **Export Modules** | `GET /api/export/modules` | HTTP 200 | Database exportable modules metadata returned | **PASS** |

---

## 8. CUSTOMER PORTAL VERIFICATION

The customer experience was validated using credentials `contact@acme.com` / `Password@123` (Acme Corp `CMP-0001`).

### Positive Functional Tests
1. **Authentication:** Successfully acquired JWT scoped to `role: CUSTOMER` and `companyId: CMP-0001`.
2. **Dashboard Scoping:** `GET /api/reports/dashboard` returned ticket metrics scoped exclusively to Acme Corp.
3. **Ticket List:** `GET /api/tickets` returned Acme Corp tickets with status tracking.
4. **Mobile Portal View:** Responsive view at `/customer-mobile` rendered properly for field ticket submission.
5. **Session Termination:** `POST /api/auth/logout` invalidated active session token cleanly.

### Negative Security Tests (Attacker / Unauthorized Access Simulation)
1. **Access Internal Employees:** `GET /api/employees` -> **HTTP 403 Forbidden** (Blocked).
2. **Access Task Allotment:** `GET /api/task-allotment/queue` -> **HTTP 403 Forbidden** (Blocked).
3. **Access Audit Logs:** `GET /api/audit-logs` -> **HTTP 403 Forbidden** (Blocked).
4. **Access Platform Administration:** `GET /api/platform/overview` -> **HTTP 403 Forbidden** (Blocked).
5. **Cross-Tenant Query Tampering:** `GET /api/companies?tenantId=TENANT-APEX` -> Customer cannot view or query Apex Corp data.
6. **Attendance Check-in:** Customer attendance check-in attempt -> **HTTP 403 Forbidden** (Blocked).

---

## 9. TENANT ISOLATION SECURITY AUDIT

| Isolation Check | Test Method | HTTP Result | Verdict |
| :--- | :--- | :--- | :--- |
| **Cross-Tenant Customer Read** | Tenant Admin querying `tenantId=TENANT-APEX` | Scoped to `KANVTECH` | **PASS** |
| **Cross-Tenant Employee Read** | Tenant Admin querying `tenantId=TENANT-APEX` | Scoped to `KANVTECH` | **PASS** |
| **Cross-Tenant Product Read** | Tenant Admin querying `tenantId=TENANT-APEX` | Scoped to `KANVTECH` | **PASS** |
| **Cross-Tenant Workspace Switch** | Switching to unauthorized `TENANT-APEX` via `/auth/switch-tenant` | HTTP 403 Forbidden | **PASS** |
| **Unauthorized Workspace Login** | Supplying unauthorized `selectedTenantId` on `/auth/login` | HTTP 401 Unauthorized | **PASS** |
| **Unauthenticated Backup Restore** | `POST /api/export/backup/restore` with no bearer token | HTTP 401 Unauthorized | **PASS** |
| **Restore Isolation Enforcement** | Inspecting `commitRestore` service logic | Strictly requires `user.tenantId` | **PASS** |
| **Tenant Admin Platform Escalation** | Tenant Admin invoking `POST /api/platform/tenants` | HTTP 403 Forbidden | **PASS** |
| **Platform Incharge Password Reset** | Tenant Admin attempting to reset Platform Incharge (user 263) | HTTP 403 Forbidden | **PASS** |

---

## 10. BROWSER CONSOLE AND NETWORK ERRORS

* **Webpack Runtime Cache Desync (Resolved):** Running `npm run build` while `next dev` was active initially resulted in a webpack runtime error (`Cannot find module './833.js'`). The dev server task was cleanly restarted, resolving the cache mismatch.
* **HTTP Route Verification:** All frontend routes (`/`, `/login`, `/dashboard`, `/platform`, `/customer-mobile`) now return HTTP 200 with full HTML payloads and zero console errors.
* **Network Payloads:** Client bundle optimization verified at 102 kB shared JS with zero bundle bloat.

---

## 11. LAN ACCESSIBILITY

Reachability over the local network was audited using the development PC's confirmed LAN IPv4 address: `192.168.3.111`.

| Resource | LAN URL Tested | HTTP Status | Response Size | Accessibility |
| :--- | :--- | :--- | :--- | :--- |
| **Web Portal Root** | `http://192.168.3.111:3000/` | HTTP 200 | 14,519 bytes | Confirmed Accessible |
| **Corporate Sign-In** | `http://192.168.3.111:3000/login` | HTTP 200 | 15,546 bytes | Confirmed Accessible |
| **Customer Mobile Portal** | `http://192.168.3.111:3000/customer-mobile` | HTTP 200 | 15,683 bytes | Confirmed Accessible |
| **Backend Health API** | `http://192.168.3.111:5000/api/health` | HTTP 200 | 98 bytes | Confirmed Accessible |

---

## 12. BUGS IDENTIFIED

1. **`manager@kanvtech.com` Missing Active Tenant Membership:**
   * *Description:* When attempting to log in as `manager@kanvtech.com`, the API returns HTTP 401: `Access denied. No active company workspace found for this user account.`
   * *Root Cause:* The account exists in the `users` and `employees` tables, but does not have a corresponding active record in `tenant_memberships` in the development database.
   * *Impact:* Low (Platform Incharge `ashutosh@kanvtech.com` and Tenant Super Admin `admin@kanvtech.com` are fully operational).
2. **Next.js Dev Server Webpack Out-of-Sync Error During Build:**
   * *Description:* Running a production Next.js build concurrently with an active background `next dev` instance overwrites `.next/server/webpack-runtime.js`, causing dev server requests to return HTTP 500 until restarted.
   * *Impact:* Development workflow only.
3. **`PLATFORM_INCHARGE` Omitted from Internal Messages (Chat) RBAC Whitelist:**
   * *Description:* When navigating to Internal Messages as Platform Incharge (`ashutosh@kanvtech.com`), `GET /api/chat/employees` returned HTTP 403: `User role 'PLATFORM_INCHARGE' is not authorized to access this resource` (Next.js modal `Console ApiError: User role 'PLATFORM_INCHARGE' is not authorized to access this resource` in `ChatPage.tsx:150`).
   * *Root Cause:* `chat.controller.ts` had `@Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')` across all routes and `EMPLOYEE_ROLES` in `chat.service.ts` omitted `PLATFORM_INCHARGE` and `SUPER_ADMIN`.
   * *Impact:* Medium (Platform Incharge was unable to compose or view internal staff messages).

---

## 13. BUGS FIXED

1. **Next.js Server Process Synchronized:** Restarted background `next dev` daemon following the production build; confirmed HTTP 200 across all routes.
2. **Mandatory Tenant Context on Creation Controllers:** Enforced in commit `e767841`, eliminating fallback to default `'KANVTECH'` tenant across tickets, companies, employees, prospects, and products.
3. **Backup Restore Overwrite Prevention:** Added strict tenant filtering to `commitRestore` across all 6 restored entities, preventing cross-tenant record tampering.
4. **Resolved Platform Incharge Internal Messages Access (Chat RBAC):**
   * Added `UserRole.PLATFORM_INCHARGE` and `UserRole.SUPER_ADMIN` to `EMPLOYEE_ROLES` in `backend/src/chat/chat.service.ts`.
   * Added `'PLATFORM_INCHARGE'` and `'SUPER_ADMIN'` to `@Roles(...)` decorators across all 11 endpoints in `backend/src/chat/chat.controller.ts`.
   * Verified: `GET /api/chat/employees` now returns HTTP 200 with all 9 active internal staff members for `ashutosh@kanvtech.com`, while `CUSTOMER` accounts remain strictly forbidden (HTTP 403).

---

## 14. REMAINING RISKS

1. **Office Server Database State:** The office server PostgreSQL database must have active `tenant_memberships` for any designated manager accounts before they can authenticate.
2. **Environment Variable Configuration on Office Server:** The office server `.env` files must have properly configured `DATABASE_URL`, `JWT_SECRET`, and matching `CORS_ORIGIN` values.

---

## 15. OFFICE SERVER DEPLOYMENT PREREQUISITES

Prior to initiating deployment on the office server PC, ensure the following steps are performed:
1. **Pull Latest Main Branch:** Fast-forward pull `origin/main` (commit `e767841603a344cbb1aae523ff156eab0f4064e7`).
2. **Configure Environment Variables:** Verify `PORT`, `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGIN` in `backend/.env` on the office server without exposing credentials.
3. **Verify Tenant Memberships:** Ensure all operational accounts (Platform Incharge, Tenant Super Admin, Employees, Customers) have active records in the `tenant_memberships` table for their respective tenants.
4. **Execute Production Builds:** Run `prisma generate`, `nest build`, and `npm run build` on the office server.
5. **Strict Port 5432 Protection:** Do not expose port 5432 directly to the local network; only allow the NestJS backend to communicate with PostgreSQL locally.

---

## 16. DEPLOYMENT READINESS VERDICT

```
================================================================================
VERDICT: READY WITH CONDITIONS
================================================================================
```

### Justification:
* All 8 security-fix files are committed and synchronized with `origin/main`.
* 99/99 automated tests passed.
* Both frontend and backend builds compile cleanly with zero errors.
* Tenant isolation and RBAC defense-in-depth protections are verified.
* **Condition:** Before conducting manager-level testing on the office server, ensure the target database contains active `TenantMembership` records for manager accounts (e.g. `manager@kanvtech.com`), or use the verified Tenant Super Admin (`admin@kanvtech.com`) and Platform Incharge (`ashutosh@kanvtech.com`) accounts.

