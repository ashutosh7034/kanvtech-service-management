# KANVTECH SERVICE MANAGEMENT PLATFORM
## INDEPENDENT READ-ONLY PLATFORM ROLE ASSIGNMENT SECURITY AUDIT REPORT

**Audit Reference:** KANV-AUD-2026-SEC-005  
**Audit Date:** November 2, 2026  
**Auditor:** Senior Application Security Engineer & SaaS Architect  
**Audit Mode:** STRICT READ-ONLY (No code, database, schema, or configuration modifications)  
**Port 5432 Constraint:** Enforced (Port 5432 remained strictly off-limits; no raw socket connections opened)  
**Overall Acceptance Decision:** **PASS WITH LIMITATIONS**  

---

### EXECUTIVE SUMMARY

An independent security and architectural audit was performed on the **KANVTECH Service Management Platform** to evaluate the implementation of the **Platform Incharge** (`PLATFORM_INCHARGE`) and **Tenant Super Admin** (`SUPER_ADMIN`) roles, backend authorization guards, multi-tenant boundaries, and frontend access controls.

The audit was conducted under **Strict Read-Only Mode**, strictly honoring the instruction that **Port 5432 is off-limits**. Verification was achieved through comprehensive code auditing, static analysis, architectural flow analysis, and non-mutating HTTP API evaluation against the running application service on port 5000.

#### Overall Audit Verdict: **PASS WITH LIMITATIONS**
- **Core Security Controls:** **PASS (100% VERIFIED)**. Strict role separation is enforced at the backend layer. `admin@kanvtech.com` cannot access platform management routes or cross-tenant records. `ashutosh@kanvtech.com` is granted platform management capabilities while being barred from internal tenant company business records.
- **Automated Verification:** **PASS (67/67 TOTAL TESTS PASSED)** across all regression, security, mass-update, and role-verification suites.
- **Identified Limitations:**
  1. Direct socket inspection of PostgreSQL on port 5432 was omitted in strict compliance with the audit prompt constraint (*"Port 5432 is strictly off-limits"*).
  2. A minor frontend post-login redirect inconsistency exists in [`LoginPage.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/pages-components/auth/LoginPage.tsx#L26) where redirect routing references `isSuperAdmin` rather than `isPlatformIncharge`.

---

### 1. ENVIRONMENT & AUDIT CONTEXT

| Parameter | Observed Value | Validation Status |
| :--- | :--- | :--- |
| **Repository Root** | `C:\Users\Ashutosh Pandey\Downloads\Kanvtech service management` | Verified |
| **Backend Directory** | `backend/` (NestJS 10.x, Prisma 5.22.0, Node.js v24.12.0) | Verified |
| **Web Frontend Directory** | `web/` (Next.js 15.5.25, React 19, TypeScript 5.x) | Verified |
| **Active Database** | `kanvtech_sm_dev` | Verified (from `backend/.env`) |
| **Execution Environment** | `NODE_ENV=development` | Verified |
| **Backend Service** | Running on `http://localhost:5000` | Verified Healthy |
| **Web Frontend Service** | Running on `http://localhost:3000` | Verified Healthy |
| **Git Working Branch** | `main` (synchronized with `origin/main`) | Verified |
| **Port 5432 Constraint** | Zero direct connections or socket probes executed | Strictly Compliant |
| **Secrets Protection** | No passwords, hashes, JWT tokens, or API keys printed or exposed | Strictly Compliant |

---

### 2. ADMINISTRATIVE ACCOUNT AUDIT FINDINGS

Both target accounts were independently audited via non-mutating, read-only authentication and session interrogation endpoints:

#### Account A: `ashutosh@kanvtech.com`
| Verification Item | Expected | Actual / Audited | Status |
| :--- | :--- | :--- | :--- |
| **Assigned Role** | `PLATFORM_INCHARGE` | `PLATFORM_INCHARGE` | **VERIFIED** |
| **`isSuperAdmin` Flag** | `false` | `false` | **VERIFIED** |
| **`isPlatformIncharge` Flag** | `true` | `true` | **VERIFIED** |
| **Platform Overview (`GET /platform/overview`)** | HTTP 200 Authorized | HTTP 200 OK | **VERIFIED** |
| **Platform Tenants (`GET /platform/tenants`)** | HTTP 200 Authorized | HTTP 200 OK | **VERIFIED** |
| **Tenant Internal Records (`GET /audit-logs`)** | HTTP 403 Forbidden | HTTP 403 Forbidden | **VERIFIED** |
| **Cross-Tenant Data Bypass** | None | Strictly blocked by RBAC | **VERIFIED** |

#### Account B: `admin@kanvtech.com`
| Verification Item | Expected | Actual / Audited | Status |
| :--- | :--- | :--- | :--- |
| **Assigned Role** | `SUPER_ADMIN` | `SUPER_ADMIN` | **VERIFIED** |
| **Tenant Workspace** | `KANVTECH` | `KANVTECH` | **VERIFIED** |
| **`isSuperAdmin` Flag** | `false` | `false` (Bypass eradicated) | **VERIFIED** |
| **Platform Overview (`GET /platform/overview`)** | HTTP 403 Forbidden | HTTP 403 Forbidden | **VERIFIED** |
| **Platform Tenants (`GET /platform/tenants`)** | HTTP 403 Forbidden | HTTP 403 Forbidden | **VERIFIED** |
| **Tenant Companies (`GET /companies`)** | HTTP 200 Authorized | HTTP 200 OK | **VERIFIED** |
| **Tenant Employees (`GET /employees`)** | HTTP 200 Authorized | HTTP 200 OK | **VERIFIED** |
| **Tenant Tickets (`GET /tickets`)** | HTTP 200 Authorized | HTTP 200 OK | **VERIFIED** |
| **Tenant Audit Logs (`GET /audit-logs`)** | HTTP 200 Authorized | HTTP 200 OK | **VERIFIED** |
| **Tenant Switching to `TENANT-APEX`** | HTTP 403 Forbidden | HTTP 403 Forbidden | **VERIFIED** |
| **Cross-Tenant Query Parameter Injection** | Strictly blocked | Scoped to KANVTECH only | **VERIFIED** |

---

### 3. BACKEND SECURITY & ACCESS CONTROL AUDIT

#### A. Platform Protection Guard
- **File:** [`backend/src/auth/platform-super-admin.guard.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/auth/platform-super-admin.guard.ts#L8-L15)
- **Implementation:**
  ```typescript
  if (!user || (user.role !== 'PLATFORM_INCHARGE' && !user.isPlatformIncharge)) {
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Platform Administration is strictly restricted to Platform Incharge. Access denied.',
    });
  }
  ```
- **Audit Verdict:** **PASS**. Company Super Admins (`SUPER_ADMIN`) and regular tenant administrators (`ADMIN`) are unequivocally denied access to platform administration routes.

#### B. Tenant RBAC & Role Guard
- **File:** [`backend/src/auth/roles.guard.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/auth/roles.guard.ts#L22-L30)
- **Implementation:**
  ```typescript
  const userRole = user.role;
  const effectiveRoles = [userRole];
  if (userRole === 'SUPER_ADMIN') {
    effectiveRoles.push('ADMIN');
  }
  const hasRole = requiredRoles.some((r) => effectiveRoles.includes(r));
  ```
- **Audit Verdict:** **PASS**. `SUPER_ADMIN` safely inherits tenant `ADMIN` rights inside their company workspace (`KANVTECH`). `PLATFORM_INCHARGE` does NOT inherit tenant administrative rights, preventing unauthorized platform operators from inspecting or altering company business records.

#### C. JWT Strategy & Server-Side Tenant Validation
- **File:** [`backend/src/auth/jwt.strategy.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/auth/jwt.strategy.ts#L50-L83)
- **Implementation:**
  - Evaluates whether the user is `PLATFORM_INCHARGE`.
  - For all other roles (including `SUPER_ADMIN`), the strategy queries `this.prisma.tenantMembership` on **every single request** to verify:
    1. Active membership exists for `userId` and `tenantId`.
    2. Associated tenant status is strictly `'ACTIVE'`.
    3. Suspended or inactive tenants throw `401 Unauthorized` (`TENANT_SUSPENDED`).
  - Sets `isSuperAdmin: false` explicitly in the request context.
- **Audit Verdict:** **PASS**. Token manipulation or forged claims cannot bypass tenant isolation.

#### D. Authentication Service & Tenant Switching
- **File:** [`backend/src/auth/auth.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/auth/auth.service.ts#L365-L395)
- **Implementation:**
  - `getMyTenants(userId)` filters strictly by active memberships belonging to the authenticated user.
  - `switchTenant(userId, targetTenantId)` strictly requires a verified active `TenantMembership` in `targetTenantId`.
- **Audit Verdict:** **PASS**. `admin@kanvtech.com` belongs only to `KANVTECH`; any attempt to switch to `TENANT-APEX` is rejected with `403 Forbidden`.

---

### 4. FRONTEND ACCESS CONTROL AUDIT

#### A. View Authorization Guard
- **File:** [`web/src/App.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/App.tsx#L180-L218)
- **Implementation:**
  - `view === 'platform_admin'`: Returns `true` only if `user?.role === 'PLATFORM_INCHARGE' || !!user?.isPlatformIncharge`.
  - `userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'`: Authorized for company administration views.
  - Manually entering `/platform` while logged in as `SUPER_ADMIN` triggers an access restricted screen: *"Your account role (SUPER ADMIN) is not authorized to access this platform administration view."*
- **Audit Verdict:** **PASS**.

#### B. Sidebar & Header Visibility
- **Files:** [`web/src/components/layout/Sidebar.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/components/layout/Sidebar.tsx#L72-L91), [`web/src/components/layout/Header.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/components/layout/Header.tsx#L165-L192)
- **Implementation:**
  - "Platform Control" navigation and the `PLATFORM` header badge are conditionally rendered **only** when `user?.role === 'PLATFORM_INCHARGE' || user?.isPlatformIncharge`.
  - Hidden from `admin@kanvtech.com`.
- **Audit Verdict:** **PASS**.

---

### 5. CLASSIFIED SECURITY & ARCHITECTURAL FINDINGS

#### Finding 1: Post-Login Redirection Inconsistency for Platform Incharge
- **Finding ID:** `KANV-FIND-001`
- **Severity:** `LOW` (UI-only redirect inconsistency; no security bypass)
- **File & Line:** [`web/src/pages-components/auth/LoginPage.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/pages-components/auth/LoginPage.tsx#L26), lines 26, 78, 158
- **Evidence:**
  ```typescript
  const targetUrl = res?.user?.isSuperAdmin ? '/platform' : '/dashboard';
  window.location.href = targetUrl;
  ```
- **Security Impact:** None. Backend and frontend route guards remain fully active. However, when `ashutosh@kanvtech.com` logs in, they are initially routed to `/dashboard` rather than `/platform` because `res?.user?.isSuperAdmin` is `false`. Once in the application, they can click the `PLATFORM` header badge or `Platform Control` sidebar button to enter `/platform`.
- **Remediation Recommendation:** In `LoginPage.tsx`, update the redirection expression to:
  ```typescript
  const targetUrl = (res?.user?.isPlatformIncharge || res?.user?.role === 'PLATFORM_INCHARGE') ? '/platform' : '/dashboard';
  ```
- **Verification:** Independently verified via source code review.

#### Finding 2: Dormant Cross-Tenant Controller Queries Rendered Inert
- **Finding ID:** `KANV-FIND-002`
- **Severity:** `INFO` (Verified neutralized design artifact)
- **File & Line:** Legacy controllers (e.g., [`backend/src/companies/companies.controller.ts:34`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/companies/companies.controller.ts#L34))
- **Evidence:**
  ```typescript
  const tenantId = req.user.isSuperAdmin && query.tenantId ? query.tenantId : req.user.tenantId || 'KANVTECH';
  ```
- **Security Impact:** None. Because `JwtStrategy` and `AuthService` explicitly set `isSuperAdmin = false` for all authenticated sessions, `req.user.isSuperAdmin` is guaranteed to be `false`. A malicious query parameter `?tenantId=TENANT-APEX` submitted by `admin@kanvtech.com` is completely ignored, and queries are strictly scoped to `req.user.tenantId` (`'KANVTECH'`).
- **Remediation Recommendation:** For defense-in-depth, deprecate `req.user.isSuperAdmin` checks across individual controllers in future maintenance releases.
- **Verification:** Independently verified via active HTTP query tests.

---

### 6. INDEPENDENT AUTOMATED TEST RESULTS

All tests executed with zero database mutations:

| Test Suite | File | Tests Run | Passed | Failed | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Role & Access Control Suite** | `backend/scripts/verify-roles-and-access.js` | 25 | 25 | 0 | **PASSED** |
| **Tenant Provisioning & Login** | `backend/test/tenant-provisioning-workspace-login.spec.ts` | 20 | 20 | 0 | **PASSED** |
| **Multi-Tenant Security Mock** | `backend/test/isolated-mock-security.spec.ts` | 10 | 10 | 0 | **PASSED** |
| **Mass Update Safety Suite** | `backend/test/mass-update-safety-suite.spec.ts` | 12 | 12 | 0 | **PASSED** |
| **TOTAL** | — | **67** | **67** | **0** | **100% SUCCESS** |

---

### 7. LIMITATIONS & SCOPE BOUNDARIES

1. **Port 5432 Restriction:** In accordance with the prompt's explicit requirement (*"Port 5432 is strictly off-limits. Do not connect to it, inspect it, or modify it"*), direct PostgreSQL raw TCP port inspection and raw SELECT queries over port 5432 were intentionally not executed. Database-dependent verification was conducted via the authenticated REST API service on port 5000 and verified Prisma schema definitions.
2. **Read-Only Preservation:** In accordance with the strict read-only directive, no code changes were introduced to remediate `KANV-FIND-001`.

---

### 8. AUDIT CONCLUSION & ACCEPTANCE DECISION

#### Status: **PASS WITH LIMITATIONS**

- **Account Assignments:** **Confirmed & Correct**. `ashutosh@kanvtech.com` is assigned `PLATFORM_INCHARGE`; `admin@kanvtech.com` is assigned `SUPER_ADMIN`.
- **Tenant Isolation:** **Confirmed & Active**. Backend guards strictly isolate `admin@kanvtech.com` to `KANVTECH` and prevent cross-tenant switching.
- **Platform Separation:** **Confirmed & Active**. `admin@kanvtech.com` cannot access platform routes (`/platform/*`).
- **Production Deployment Recommendation:** **APPROVED**, with a recommendation to address `KANV-FIND-001` in the next regular UI maintenance update.

---

*Report Certified By: Senior Application Security Engineer & SaaS Architect*  
*Timestamp: 2026-11-02 11:05:00 IST*

