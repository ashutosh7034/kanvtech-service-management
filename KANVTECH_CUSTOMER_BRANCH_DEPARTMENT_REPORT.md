# KANVTECH SERVICE MANAGEMENT PLATFORM
## MASTER IMPLEMENTATION REPORT — CUSTOMER / BRANCH / PRODUCT / DEPARTMENT UPDATE BATCH

**Baseline Version:** `KANVTECH v2.1.0-advanced`  
**Current Release:** `KANVTECH v2.2.0-customer-dept-arch`  
**Date & Time:** September 25, 2026  
**Status:** **FULLY IMPLEMENTED, TESTED, & VERIFIED (0 REGRESSIONS, 112/112 TESTS PASS)**

---

### Executive Summary

This architecture update transforms KANVTECH's organizational and technical core from a generic "Company Master" into a structured **Customer Master** integrated with:
1. **Mandatory Product Ownership:** Customer registration requires $\ge 1$ product from Product Master.
2. **Dynamic Branch Hierarchy:** Customers can have $0, 1, \dots, N$ branches. Branch products are strictly a subset of parent customer-owned products ($\text{BranchProducts} \subseteq \text{CustomerProducts}$).
3. **Department Master:** Product-specialized operational support teams (Tally Support, Spine Support, BIOS 360 Support, CyberShield Support).
4. **Specialist Employee Hierarchy:** Strict **1 Employee = Exactly 1 Department** rule enforced at DB and application layer. Each department maintains its own dedicated Manager, L1 specialists, L2 seniors, and L3 principal engineers.
5. **Workload-Based Auto-Routing:** Support tickets are created by selecting customer, optional branch, and product. The backend automatically determines the department from the product and routes the ticket to the eligible L1 engineer with the **lowest active workload**.
6. **Strict Department Escalation Isolation:** Escalations ($L1 \to L2 \to L3$) stay strictly within the same product department. Cross-department assignment is blocked.

---

### 1. Customer Master Changes
- **Terminology & Scope:** Fully transitioned visible terminology from "Company Master" to "Customer Master" across navigation sidebar, header titles, breadcrumbs, search bars, creation modals, detail sheets, and notification templates while preserving database foreign-key stability (`Company` table).
- **Mandatory Product Selection:** Registration is rejected with a 400 Bad Request error if 0 products are selected: *"At least one product must be selected before registering a customer."*
- **Post-Registration Expansion:** Added `POST /api/companies/:id/products` and `DELETE /api/companies/:id/products/:productId` to allow customers to purchase additional products or remove products while enforcing retention of at least 1 product.
- **Modified Modules:**
  - [`backend/src/companies/companies.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/companies/companies.service.ts)
  - [`backend/src/companies/companies.controller.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/companies/companies.controller.ts)
  - [`web/src/pages-components/companies/CompaniesPage.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/pages-components/companies/CompaniesPage.tsx)
  - [`web/src/components/layout/Sidebar.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/components/layout/Sidebar.tsx)

---

### 2. Database Changes & Schema Integrity
The Prisma schema (`backend/prisma/schema.prisma`) was extended with clean relational models and foreign key constraints:
- **`Department` Model:** Added table `departments` with `id` (`DEP-0001`), `code`, `name`, `productId` (FK $\to$ `products`), and `managerId` (FK $\to$ `employees`).
- **`CompanyProduct` Model:** Added table `company_products` mapping `companyId` (FK $\to$ `companies`) and `productId` (FK $\to$ `products`) with unique index `@@unique([companyId, productId])`.
- **`CompanyBranch` Model:** Added table `company_branches` with `id` (`BR-0001`), `companyId` (FK $\to$ `companies`), address, contact info, and status (`ACTIVE`/`INACTIVE`).
- **`BranchProduct` Model:** Added table `branch_products` mapping `branchId` (FK $\to$ `company_branches`) and `productId` (FK $\to$ `products`) with unique index `@@unique([branchId, productId])`.
- **`Employee` Model:** Added `departmentId` (FK $\to$ `departments`), foreign key relation `departmentRel`, and extended `level` enum to include `MANAGER`.
- **`Ticket` Model:** Added `productId` (FK $\to$ `products`), `branchId` (FK $\to$ `company_branches`), and `departmentId` (FK $\to$ `departments`).
- **Modified Modules:**
  - [`backend/prisma/schema.prisma`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/prisma/schema.prisma)
  - [`backend/prisma/migrations/20260925000000_customer_branch_department/migration.sql`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/prisma/migrations/20260925000000_customer_branch_department/migration.sql)

---

### 3. Branch Architecture
- **Dynamic Branch Creation:** Customers can have 0, 1, or unlimited dynamic branches. No artificial branch limit exists.
- **Single-Site Customers:** Customers without branches operate seamlessly (`branch_id = null`), routing tickets directly via company headquarters.
- **Branch Fields:** ID, Branch Name, Address, City, State, PIN, Contact Person, Contact Phone, Contact Email, Status (`ACTIVE`/`INACTIVE`).
- **Non-Destructive Status:** Branches cannot be hard-deleted if referenced in tickets or contracts; status toggling (`ACTIVE` $\leftrightarrow$ `INACTIVE`) preserves historical data integrity.

---

### 4. Product Relationships
- **Source of Truth:** Reused the existing `Product` model (`Product Master`) with codes (e.g., `TALLY`, `SPINE`, `BIOS360`, `CYBERSHIELD`).
- **Relational Chain:**
  $$\text{Product Master} \longrightarrow \text{Customer Products} \longrightarrow \text{Branch Products}$$
- **Subset Enforcement:** Attempting to assign a product to a branch that is not owned by the parent customer is blocked by the backend API (`400 Bad Request: Parent company does not own this product`).

---

### 5. Department Architecture
- **Purpose:** Departments represent operational support units dedicated to specific product lines.
- **Master Data:** Managed via `Department Master` by administrators and operations managers.
- **Seeded Departments:**
  - `DEP-0001` — **Tally Support** (maps to `PROD-0001` Tally Prime)
  - `DEP-0002` — **Spine Support** (maps to `PROD-0002` Spine HRMS)
  - `DEP-0003` — **BIOS 360 Support** (maps to `PROD-0003` BIOS 360 Healthcare)
  - `DEP-0004` — **CyberShield Support** (maps to `PROD-0004` CyberShield Endpoint)
- **Modified Modules:**
  - [`backend/src/departments/departments.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/departments/departments.service.ts)
  - [`backend/src/departments/departments.controller.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/departments/departments.controller.ts)
  - [`web/src/pages-components/departments/DepartmentsPage.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/web/src/pages-components/departments/DepartmentsPage.tsx)

---

### 6. Employee Specialization
- **Strict Constraint:** **1 Employee = Exactly 1 Department**.
- **Backend & DB Enforcement:** `Employee.departmentId` is a single foreign key relation. Employees cannot be linked to multiple departments.
- **Department Integrity on Assignment:** Attempting to assign a Tally ticket to a Spine employee or vice-versa is blocked at the backend with an error:
  *"Cannot assign Tally Support ticket to employee Suresh Raina who belongs to the Spine Support department."*
- **Modified Modules:**
  - [`backend/src/employees/employees.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/employees/employees.service.ts)
  - [`backend/src/assignments/assignments.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/assignments/assignments.service.ts)

---

### 7. Manager Hierarchy
- Every department is assigned a dedicated Operations Manager.
- A ticket's full hierarchy is traceable:
  $$\text{Product} \longrightarrow \text{Department} \longrightarrow \text{Assigned Engineer (L1/L2/L3)} \longrightarrow \text{Department Manager}$$

---

### 8. Ticket Routing Logic
- When a ticket is created:
  1. Customer selects Company $\to$ optional Branch $\to$ Product $\to$ Problem & Priority.
  2. Backend validates product ownership (and branch product assignment if branch selected).
  3. Backend derives the `Department` automatically from the product.
  4. Backend queries active, eligible **L1 engineers** in that Department.
  5. The L1 engineer with the **lowest active workload** is automatically assigned.
  6. If no active L1 engineer is available, the ticket remains unassigned and an administrative broadcast notification (`NO_ENGINEER_AVAILABLE`) is dispatched.
- **Modified Modules:**
  - [`backend/src/tickets/tickets.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/tickets/tickets.service.ts)
  - [`backend/src/assignments/assignments.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/assignments/assignments.service.ts)

---

### 9. Workload Calculation
- Calculated in real time from live active ticket assignments where status $\in \{\text{OPEN}, \text{IN\_PROGRESS}, \text{REOPENED}, \text{CUSTOMER\_FEEDBACK}, \text{MANAGER\_REVIEW}\}$.
- Excludes `CLOSED` and resolved historical tickets.
- Ties are broken by availability (`AVAILABLE` > `BUSY`) and creation order.

---

### 10. Escalation Logic
- Escalation path strictly adheres to operational tiers within the same department:
  - Tally ticket: $\text{Tally L1} \longrightarrow \text{Tally L2} \longrightarrow \text{Tally L3}$
  - Spine ticket: $\text{Spine L1} \longrightarrow \text{Spine L2} \longrightarrow \text{Spine L3}$
- Cross-department escalation is strictly rejected by `EscalationsService`.
- **Modified Modules:**
  - [`backend/src/escalations/escalations.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/backend/src/escalations/escalations.service.ts)

---

### 11. RBAC Changes
- `ADMIN`: Full CRUD across Customers, Branches, Products, Departments, Employees, Tickets, SLAs, and Audit Logs.
- `MANAGER`: CRUD on Master data for their authorized scope, ticket reallocation within department, and manager reviews.
- `L1_EMPLOYEE` / `L2_EMPLOYEE` / `L3_EMPLOYEE`: Access to assigned tickets, timer activation, same-department escalation, and resolution. Blocked from master modifications (403 Forbidden).
- `CUSTOMER`: Access strictly isolated to their own organization's tickets, branches, and purchased products.

---

### 12. API Changes Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/departments` | List all departments with manager & specialist counts |
| `POST` | `/api/departments` | Create new support department |
| `GET` | `/api/departments/:id` | Get department details & specialist team roster |
| `PUT` | `/api/departments/:id` | Update department name, code, product, manager |
| `POST` | `/api/departments/:id/status` | Activate / Deactivate department |
| `POST` | `/api/companies` | Register customer with mandatory `product_ids` array |
| `POST` | `/api/companies/:id/products` | Purchase / add product to existing customer |
| `DELETE` | `/api/companies/:id/products/:productId` | Remove product (retaining min 1 product) |
| `GET` | `/api/companies/:id/branches` | List all branches of customer |
| `POST` | `/api/companies/:id/branches` | Create branch with branch products subset |
| `PUT` | `/api/companies/:id/branches/:branchId` | Update branch address & contacts |
| `PATCH` | `/api/companies/:id/branches/:branchId/status` | Toggle branch `ACTIVE`/`INACTIVE` |
| `POST` | `/api/companies/:id/branches/:branchId/products` | Assign customer-owned products to branch |
| `POST` | `/api/tickets` | Create ticket with `productId`, `branchId` & auto-department routing |

---

### 13. Prisma Migration Details
- Migration directory: `backend/prisma/migrations/20260925000000_customer_branch_department/`
- Executed non-destructively via `npx prisma migrate deploy` on PostgreSQL database.
- Schema validated via `npx prisma validate` $\to$ Clean & Valid.

---

### 14. UI Changes
- **Sidebar & Header:** Renamed "Company Master" $\to$ "Customer Master" and added "Department Master" navigation icon.
- **Customer Master Page (`CompaniesPage.tsx`):**
  - Enhanced table showing Customer ID, Organization Name, Purchased Products badges, Branch count, Primary Contact, Phone, Active Tickets, and Status.
  - Multi-step Customer Registration Modal with mandatory Product Selection from Product Master and dynamic branch onboarding.
  - Detailed Customer View Sheet with Company Info, Purchased Products (+ Add / Remove), Branch Management (+ Add Branch, Edit, Status Toggle, Product Assignment), and Ticket Statistics.
- **Department Master Page (`DepartmentsPage.tsx`):**
  - Grid & Table view of departments, associated products, managers, specialist counts, open tickets, and Create/Edit modal.
- **Employee Directory (`EmployeesPage.tsx`):**
  - Department dropdown loaded from `GET /api/departments` enforcing 1 Employee = 1 Department.
  - Added `MANAGER` tier level alongside L1, L2, L3.
- **Support Tickets & Mobile App (`TicketsPage.tsx` & `CustomerMobileView.tsx`):**
  - Ticket creation modal dynamically filters products based on selected branch.
  - Visual read-only banner indicating auto-derived support department and workload routing.

---

### 15. Automated Tests Suite
Created comprehensive test suite `test/customer-branch-department-suite.ts` with 36 automated assertions:

| # | Test Case Description | Result |
|---|---|---|
| 1 | Create customer with one product (Tally) | **PASSED** ✔ |
| 2 | Create customer with multiple products (Tally + Spine + BIOS 360) | **PASSED** ✔ |
| 3 | Reject customer with zero products (Mandatory Validation) | **PASSED** ✔ |
| 4 | Edit customer basic details | **PASSED** ✔ |
| 5 | Add product later to customer (Spine purchase) | **PASSED** ✔ |
| 6 | Remove product where safe and enforce retaining min 1 product | **PASSED** ✔ |
| 7 | Create customer without branches (branches = 0) | **PASSED** ✔ |
| 8 | Create customer with one branch | **PASSED** ✔ |
| 9 | Create customer with multiple dynamic branches (Dahisar, Kandivali, Vapi) | **PASSED** ✔ |
| 10 | Edit branch contact and address details | **PASSED** ✔ |
| 11 | Deactivate branch (Status transitions to INACTIVE) | **PASSED** ✔ |
| 12 | Assign products to branch (Assign Tally to Kandivali) | **PASSED** ✔ |
| 13 | Reject branch product NOT owned by customer (Mandatory Business Rule) | **PASSED** ✔ |
| 14 | Create specialized Tally department employee | **PASSED** ✔ |
| 15 | Create specialized Spine department employee | **PASSED** ✔ |
| 16 | Verify 1 Employee = Exactly 1 Department constraint | **PASSED** ✔ |
| 17 | Department Master has separate L1, L2, L3 specialists | **PASSED** ✔ |
| 18 | Verify department manager relationship and traceability | **PASSED** ✔ |
| 19 | Create Tally ticket with Product selection | **PASSED** ✔ |
| 20 | Verify Tally department derived automatically from product | **PASSED** ✔ |
| 21 | Verify assigned employee is a Tally L1 specialist | **PASSED** ✔ |
| 22 | Verify lowest workload L1 receives auto-assigned ticket | **PASSED** ✔ |
| 23 | Verify Spine employee cannot receive Tally ticket (Department Segregation) | **PASSED** ✔ |
| 24 | Escalate Tally L1 $\to$ Tally L2 | **PASSED** ✔ |
| 25 | Escalate Tally L2 $\to$ Tally L3 | **PASSED** ✔ |
| 26 | Verify escalation remains strictly within Tally Department | **PASSED** ✔ |
| 27 | Create Spine ticket and verify Spine Department auto-routing | **PASSED** ✔ |
| 28 | Branch product validation on ticket creation | **PASSED** ✔ |
| 29 | Verify customer without branch can create ticket smoothly | **PASSED** ✔ |
| 30 | Verify customer can create separate tickets for different products | **PASSED** ✔ |
| 31 | Verify 2-active-ticket limit strictly enforced per customer contact | **PASSED** ✔ |
| 32 | Customer cannot access another customer records (Isolation) | **PASSED** ✔ |
| 33 | Employee cannot create or modify department master | **PASSED** ✔ |
| 34 | Employee cannot change their own department | **PASSED** ✔ |
| 35 | Customer cannot create or modify Customer Master | **PASSED** ✔ |
| 36 | Unauthenticated requests return 401 Unauthorized | **PASSED** ✔ |

---

### 16. Regression Test Verification
All existing test suites were executed sequentially to confirm zero regressions against the 76-test baseline:

- `test/runner.ts`: **24 / 24 PASSED** ✔
- `test/direct-workflow-suite.ts`: **6 / 6 PASSED** ✔
- `test/advanced-workflow-suite.ts`: **14 / 14 PASSED** ✔
- `test/qa-comprehensive-suite.ts`: **32 / 32 PASSED** ✔
- `test/customer-branch-department-suite.ts`: **36 / 36 PASSED** ✔

**GRAND TOTAL AUTOMATED TEST SUITE: 112 / 112 PASSED (100% SUCCESS RATE, 0 FAILURES, 0 REGRESSIONS)**

---

### 17. TypeScript, Prisma, & Build Results
- **Prisma Schema Validation:** `npx prisma validate` $\to$ **Valid (Code 0)**
- **Backend TypeScript Compilation:** `npx tsc --noEmit` $\to$ **0 errors (Code 0)**
- **Frontend TypeScript Compilation:** `npx tsc --noEmit` $\to$ **0 errors (Code 0)**
- **Frontend Next.js Production Build:** `npm run build` $\to$ **Successfully Generated Static & Server Pages (Code 0)**

---

### 18. Known Limitations & Notes
- Railway redeployment is held locally as instructed in Requirement 56. All local verification and quality gates have passed.
- Historical ticket records prior to this update have their product relations safely populated from customer active products.
