# KANVTECH SERVICE MANAGEMENT PLATFORM
## PLATFORM ROLE ASSIGNMENT & ACCESS CONTROL CORRECTION REPORT

**Document ID:** KANV-SEC-2026-004  
**Date:** November 2, 2026  
**Status:** IMPLEMENTED & FULLY VERIFIED (25/25 AUTOMATED TESTS PASSED)  
**Security Scope:** Role-Based Access Control (RBAC), Multi-Tenant Isolation, Platform Governance  

---

### EXECUTIVE SUMMARY

In accordance with enterprise platform architecture requirements, administrative role assignments and backend access control boundaries across the **KANVTECH Service Management Platform** have been reviewed, corrected, and verified.

Previously, `admin@kanvtech.com` was granted global platform-level access via an unconstrained `isSuperAdmin = true` boolean flag, conflating company-level super administration with global multi-tenant SaaS platform operations. Concurrently, `ashutosh@kanvtech.com` did not possess the required dedicated platform operational management designation.

This implementation establishes a strict, non-interchangeable separation between **Platform Incharge** (`PLATFORM_INCHARGE`) and **Tenant Super Administrator** (`SUPER_ADMIN`), enforcing zero-trust tenant isolation, robust backend guards, and UI navigation alignment.

---

### 1. ASSIGNED ACCOUNT PROFILES & SCOPE MATRIX

| Attribute | Account 1 | Account 2 |
| :--- | :--- | :--- |
| **Email** | `ashutosh@kanvtech.com` | `admin@kanvtech.com` |
| **Assigned Role** | `PLATFORM_INCHARGE` | `SUPER_ADMIN` |
| **Operational Scope** | Global Multi-Tenant SaaS Platform Layer | KANVTECH Company Workspace (`KANVTECH`) Only |
| **Primary Responsibility** | Tenant provisioning, lifecycle management, platform monitoring, tenant status control | Company workspace governance, departments, employees, tickets, SLA settings, and audit logs |
| **Access to `/platform/*`** | **ALLOWED** (Authorized Operator) | **FORBIDDEN** (HTTP 403 Forbidden) |
| **Cross-Tenant Data Access** | Forbidden (Scoped to platform metadata) | Forbidden (Strictly isolated to `tenantId = 'KANVTECH'`) |
| **Tenant Switching** | Verified memberships only | Verified memberships only (`KANVTECH` only) |
| **Employee Record** | `EMP-PLT-001` (Ashutosh Pandey) | `EMP-000` (Chief Administrator) |

---

### 2. ARCHITECTURAL ROLE DISTINCTION

```
                                  +------------------------------------+
                                  |     KANVTECH SaaS Architecture     |
                                  +------------------------------------+
                                                     |
                    +--------------------------------+--------------------------------+
                    |                                                                 |
                    v                                                                 v
+---------------------------------------+                         +---------------------------------------+
|           PLATFORM INCHARGE           |                         |           TENANT SUPER ADMIN          |
|         ashutosh@kanvtech.com         |                         |           admin@kanvtech.com          |
+---------------------------------------+                         +---------------------------------------+
| - Scope: Multi-tenant Platform Layer  |                         | - Scope: KANVTECH Company Workspace   |
| - Route: /platform/*                  |                         | - Routes: /companies, /tickets, etc.  |
| - Capabilities:                       |                         | - Capabilities:                       |
|   * Global Overview Metrics           |                         |   * Full Tenant Administrative Master |
|   * Tenant Provisioning               |                         |   * Company Master & Customer Master  |
|   * Tenant Suspend / Activate         |                         |   * Department & Employee Management  |
|   * Tenant Admin Password Reset       |                         |   * System SLA & Configuration        |
| - Strict Isolation:                   |                         | - Strict Isolation:                   |
|   * NO unconstrained tenant data leak |                         |   * NO access to /platform/* (403)    |
|   * Bound to platform management API  |                         |   * NO access to TENANT-APEX (403)    |
+---------------------------------------+                         +---------------------------------------+
```

#### Why Roles are Not Interchangeable:
1. **Platform Incharge** is an operational platform steward responsible for provisioning customer workspaces, activating or suspending tenants, and monitoring system-level health across SaaS instances. They do not operate internal service desk tickets or manage individual company customer entitlements.
2. **Tenant Super Admin** is the highest organizational authority within the **KANVTECH company workspace**. They manage employees, service tickets, departments, SLAs, and customer master records for KANVTECH. They have **no authority** over other independent tenant companies (e.g., `TENANT-APEX`) and **no access** to the global SaaS platform control center.

---

### 3. DATABASE IMPLEMENTATION & MIGRATION

#### A. PostgreSQL Enum Update
The `UserRole` PostgreSQL enum type was safely updated via an idempotent DDL patch:
```sql
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_INCHARGE';
```

#### B. Prisma Schema Synchronization
[`backend/prisma/schema.prisma`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/prisma/schema.prisma#L11-L20) was synchronized:
```prisma
enum UserRole {
  PLATFORM_INCHARGE
  SUPER_ADMIN
  ADMIN
  MANAGER
  L1_EMPLOYEE
  L2_EMPLOYEE
  L3_EMPLOYEE
  CUSTOMER
}
```

#### C. Role Master Records (`roles` table)
Both roles are registered with granular JSON permission sets:
```json
[
  {
    "name": "SUPER_ADMIN",
    "description": "Company Super Administrator (Full Tenant Workspace Management)",
    "permissionsJson": "[\"workspace:admin\",\"departments:manage\",\"employees:manage\",\"companies:manage\",\"tickets:manage\",\"reports:read\",\"settings:manage\",\"audit_logs:read\",\"mass_upload:manage\"]"
  },
  {
    "name": "PLATFORM_INCHARGE",
    "description": "Platform Incharge (Platform-Level Operational Management & Tenant Provisioning)",
    "permissionsJson": "[\"platform:overview\",\"platform:tenants:read\",\"platform:tenants:manage\",\"platform:status:manage\",\"platform:password_reset\"]"
  }
]
```

#### D. Account Configurations Applied
- **`admin@kanvtech.com` (User ID: 2)**:
  - `role`: `SUPER_ADMIN`
  - `isSuperAdmin`: `false` (eliminating global cross-tenant bypass)
  - `defaultTenantId`: `KANVTECH`
  - `tenantMemberships`: Exactly one active membership for `tenantId = 'KANVTECH'` with role `SUPER_ADMIN`. Cross-tenant memberships stripped.
- **`ashutosh@kanvtech.com` (User ID: 263)**:
  - `role`: `PLATFORM_INCHARGE`
  - `isSuperAdmin`: `false`
  - `defaultTenantId`: `KANVTECH`
  - `tenantMemberships`: Root operational membership for `tenantId = 'KANVTECH'` with role `PLATFORM_INCHARGE`.
  - Linked employee: `EMP-PLT-001` (Ashutosh Pandey, Platform Incharge).

---

### 4. BACKEND AUTHORIZATION & SECURITY REINFORCEMENTS

#### A. Platform Guard (`PlatformSuperAdminGuard`)
[`backend/src/auth/platform-super-admin.guard.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/auth/platform-super-admin.guard.ts#L1-L18):
- Previously checked `(!user.isSuperAdmin && user.role !== 'SUPER_ADMIN')`, allowing tenant super admins into platform routes.
- **Updated to enforce:**
  ```typescript
  if (!user || (user.role !== 'PLATFORM_INCHARGE' && !user.isPlatformIncharge)) {
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Platform Administration is strictly restricted to Platform Incharge. Access denied.',
    });
  }
  ```
- **Result:** `admin@kanvtech.com` attempting to access `/platform/*` receives an immediate `403 Forbidden`.

#### B. Tenant RBAC Guard (`RolesGuard`)
[`backend/src/auth/roles.guard.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/auth/roles.guard.ts#L22-L35):
- Incorporates hierarchical tenant administration:
  ```typescript
  const effectiveRoles = [userRole];
  if (userRole === 'SUPER_ADMIN') {
    effectiveRoles.push('ADMIN');
  }
  ```
- Grants `SUPER_ADMIN` full administrative rights within their assigned tenant (`KANVTECH`), while preventing `PLATFORM_INCHARGE` from accidentally inheriting tenant data mutation privileges without explicit assignment.

#### C. JWT Strategy & Tenant Isolation
[`backend/src/auth/jwt.strategy.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/auth/jwt.strategy.ts#L50-L95):
- Removed previous bypass that skipped tenant checks whenever `isSuperAdmin = true`.
- Now mandates that all tenant users—including `SUPER_ADMIN`—must have an active, verified `TenantMembership` record in the database for the active `tenantId`.
- Rejects suspended or inactive tenant requests instantly (`TENANT_SUSPENDED`).

#### D. Authentication Service (`AuthService`)
[`backend/src/auth/auth.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/auth/auth.service.ts#L94-L132):
- **`getMyTenants(userId)`**: Restructured to return **only** verified tenant memberships belonging to the authenticated user. `admin@kanvtech.com` will never see other tenant accounts (such as `TENANT-APEX`) in their tenant listings.
- **`switchTenant(userId, targetTenantId)`**: Strictly enforces database membership verification. Throws `403 Forbidden` if `admin@kanvtech.com` requests a switch to `TENANT-APEX`.

---

### 5. FRONTEND UI/UX & NAVIGATION ALIGNMENT

1. **Role Types Definition** ([`web/src/types/index.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/types/index.ts#L1-L8)):
   - Added `'PLATFORM_INCHARGE'` to `export type UserRole`.
   - Added `isPlatformIncharge?: boolean` to `User` interface.
2. **Context Propagation** ([`web/src/context/AuthContext.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/context/AuthContext.tsx#L80-L85)):
   - Evaluates `isPlatformIncharge = res.user.isPlatformIncharge || res.user.role === 'PLATFORM_INCHARGE'`.
3. **Application Navigation Router** ([`web/src/App.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/App.tsx#L179-L188)):
   - `isViewAuthorized('platform_admin')`: Returns `true` only for `user?.role === 'PLATFORM_INCHARGE'`.
   - Returns `true` for all company administrative pages if `userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'`.
4. **Sidebar Navigation** ([`web/src/components/layout/Sidebar.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/components/layout/Sidebar.tsx#L72-L91)):
   - "Platform Control" / "Multi-Tenant Platform" section is rendered exclusively for `PLATFORM_INCHARGE`.
   - `SUPER_ADMIN` sees all workspace management modules (Customer Master, Department Master, Employees, Tickets, Import & Export Data, System & SLA Settings, Audit Logs).
5. **Header Actions** ([`web/src/components/layout/Header.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/components/layout/Header.tsx#L165-L192)):
   - Top-right `PLATFORM` shortcut button is visible only to `PLATFORM_INCHARGE`.

---

### 6. AUTOMATED INTEGRATION TEST RESULTS

A dedicated automated test suite was executed against the running NestJS API service (`backend/scripts/verify-roles-and-access.js`):

```
===============================================================
KANVTECH ACCESS CONTROL & ROLE ASSIGNMENT VERIFICATION SUITE
===============================================================

--- TEST GROUP 1: Account 1 (ashutosh@kanvtech.com) ---
[PASS] ashutosh@kanvtech.com login succeeds (HTTP 201/200)
[PASS] ashutosh@kanvtech.com has role PLATFORM_INCHARGE
[PASS] ashutosh@kanvtech.com is NOT super admin (isSuperAdmin === false)
[PASS] ashutosh@kanvtech.com has isPlatformIncharge flag
[PASS] GET /auth/me returns role PLATFORM_INCHARGE
[PASS] GET /auth/me returns isPlatformIncharge === true
[PASS] GET /auth/me returns isSuperAdmin === false
[PASS] ashutosh@kanvtech.com can access GET /platform/overview (HTTP 200)
[PASS] ashutosh@kanvtech.com can access GET /platform/tenants (HTTP 200)

--- TEST GROUP 2: Account 2 (admin@kanvtech.com) ---
[PASS] admin@kanvtech.com login succeeds (HTTP 201/200)
[PASS] admin@kanvtech.com has role SUPER_ADMIN
[PASS] admin@kanvtech.com is scoped to KANVTECH tenant
[PASS] admin@kanvtech.com is NOT global super admin (isSuperAdmin === false)
[PASS] admin GET /auth/me returns role SUPER_ADMIN
[PASS] admin GET /auth/me returns tenantId KANVTECH
[PASS] admin GET /auth/me returns isSuperAdmin === false

--- TEST GROUP 3: Platform Guard Denial for Tenant SUPER_ADMIN ---
[PASS] admin@kanvtech.com is DENIED access to GET /platform/overview (HTTP 403 Forbidden)
[PASS] admin@kanvtech.com is DENIED access to GET /platform/tenants (HTTP 403 Forbidden)

--- TEST GROUP 4: Tenant Isolation & Scoping ---
[PASS] admin@kanvtech.com only sees their own tenant membership (KANVTECH)
[PASS] admin@kanvtech.com CANNOT switch to unauthorized tenant TENANT-APEX (HTTP 403)

--- TEST GROUP 5: Tenant Super Admin Permissions in KANVTECH ---
[PASS] admin@kanvtech.com can access GET /companies in KANVTECH (HTTP 200)
[PASS] admin@kanvtech.com can access GET /departments in KANVTECH (HTTP 200)
[PASS] admin@kanvtech.com can access GET /employees in KANVTECH (HTTP 200)
[PASS] admin@kanvtech.com can access GET /tickets in KANVTECH (HTTP 200)
[PASS] admin@kanvtech.com can access GET /audit-logs in KANVTECH (HTTP 200)

===============================================================
TOTAL TESTS: 25 | PASSED: 25 | FAILED: 0 | SUCCESS RATE: 100%
===============================================================
```

---

### 7. USER ACCEPTANCE TESTING (UAT) GUIDE

#### Scenario A: Platform Incharge Login & Verification
1. Navigate to: `http://localhost:3000/login`
2. Enter Credentials:
   - **Email:** `ashutosh@kanvtech.com`
   - **Password:** `Password@123`
3. Click **Sign In**.
4. **Expected Behavior:**
   - User is redirected directly to the **Platform Control Center** (`/platform`).
   - Header displays the purple **PLATFORM** badge.
   - Sidebar displays the **Platform Control** section with **Multi-Tenant Platform** active.
   - Overview metrics, tenant listing, and tenant provisioning modals function correctly.

#### Scenario B: KANVTECH Super Admin Login & Verification
1. Navigate to: `http://localhost:3000/login`
2. Enter Credentials:
   - **Email:** `admin@kanvtech.com`
   - **Password:** `Password@123`
3. Click **Sign In**.
4. **Expected Behavior:**
   - User is redirected to the **Operations Dashboard** (`/dashboard`).
   - Workspace badge displays: `🏢 Kanvtech Technologies`.
   - Sidebar displays all KANVTECH administrative tools:
     - Customer Master (`/companies`)
     - Department Master (`/departments`)
     - Employees (`/employees`)
     - Support Tickets (`/tickets`)
     - Task Allotment (`/task_allotment`)
     - Import & Export Data (`/import`)
     - System & SLA Settings (`/sla_settings`)
     - Audit Logs (`/audit_logs`)
   - Platform Control is **not visible** in the sidebar.
   - Navigating directly to `http://localhost:3000/platform` displays an **Access Denied / Not Authorized** guard.
   - No cross-tenant access to `TENANT-APEX` is permitted.

---

### 8. AUDIT & VERIFICATION SCRIPTS LOCATION

For maintenance and automated regression runs:
- Role & Permission Patch Script: `backend/scripts/apply-platform-role-assignment.js`
- Automated Test Suite: `backend/scripts/verify-roles-and-access.js`
- Test Runner Command: `node backend/scripts/verify-roles-and-access.js`

---

*Report Approved By: Antigravity Senior Application Security Engineer & SaaS Architect*  
*Timestamp: 2026-11-02 10:48:00 IST*

