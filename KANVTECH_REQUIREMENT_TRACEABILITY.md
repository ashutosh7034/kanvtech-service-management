# KANVTECH REQUIREMENT TRACEABILITY MATRIX

## 1. Authentication & Security
### REQ-AUTH-001: Secure Login Errors
- **Requirement**: Show generic "User not found" messages for invalid emails/usernames to prevent enumeration. Do not expose credentials, test accounts, or admin cards.
- **Existing Implementation**: Needs backend verification in `auth.controller.ts`.
- **Database Impact**: None.
- **Backend Impact**: Update auth endpoint to return generic messages.
- **Frontend Impact**: Remove any demo credential cards.
- **Test Case**: Login with invalid email should show generic message.
- **Status**: TO DO

### REQ-AUTH-002: Password Policies & Management
- **Requirement**: Support Min 8, Max 128, Upper, Lower, Number, Special. Support logout, change password, admin reset, visibility toggle, Secure Remember Me, JWT, bcrypt, audit logging.
- **Existing Implementation**: Basic auth exists; password complexity validation exists in UI.
- **Database Impact**: None.
- **Backend Impact**: Enforce password policy in backend; audit log all changes.
- **Frontend Impact**: Ensure visibility toggle and remember me are fully functional.
- **Test Case**: Attempt setting weak password, verify rejection.
- **Status**: TO DO

## 2. Employee Master
### REQ-EMP-001: Multiple Contact Details
- **Requirement**: Employee belongs to one department, but can have multiple phone numbers and email addresses via "+ Add More".
- **Existing Implementation**: `Employee` has single `email` and `phone`.
- **Database Impact**: Add `alternateEmails` (Text/JSON) and `alternatePhones` (Text/JSON) or separate `EmployeeContact` model.
- **Backend Impact**: Update Employee CRUD.
- **Frontend Impact**: Add dynamic fields for multiple emails/phones in forms.
- **Test Case**: Add employee with 3 emails and 2 phones.
- **Status**: TO DO

### REQ-EMP-002: Configurable Support Levels
- **Requirement**: Admin can enable/disable employee support levels. Hierarchy is configurable (e.g., L1->L2->L3->Manager vs L1->Manager). Calculate escalation based on active levels. Safe disabling.
- **Existing Implementation**: `EmployeeLevel` and `TicketLevel` are hardcoded enums.
- **Database Impact**: Add `SupportLevel` model for dynamic levels and hierarchy. Remove enums or use them as a base but manage hierarchy in DB.
- **Backend Impact**: Escalation logic must fetch active levels from DB.
- **Frontend Impact**: UI to manage support levels.
- **Test Case**: Disable L2, escalate ticket from L1 -> L3.
- **Status**: TO DO

### REQ-EMP-003: Employee Promotion/Demotion
- **Requirement**: Admin can promote/demote employees. Must update assignment eligibility, routing, but NOT destroy historical ticket records.
- **Existing Implementation**: Modifying level directly.
- **Database Impact**: None structurally, but requires safe update.
- **Backend Impact**: Validation to ensure department doesn't change accidentally during promotion; audit logging.
- **Frontend Impact**: Promotion/Demotion action buttons.
- **Test Case**: Promote L1 to L2, ensure old L1 tickets are intact.
- **Status**: TO DO

## 3. Department Master
### REQ-DEPT-001: Department CRUD
- **Requirement**: Full CRUD for Departments. Fix "Unable to add department".
- **Existing Implementation**: Department model exists.
- **Database Impact**: None.
- **Backend Impact**: Fix creation bug.
- **Frontend Impact**: Ensure form works.
- **Test Case**: Create new department successfully.
- **Status**: TO DO

### REQ-DEPT-002: Department to Multiple Products
- **Requirement**: One department can support multiple products (Many-to-Many).
- **Existing Implementation**: `Department` has `productId` (1:1 or 1:N).
- **Database Impact**: Remove `productId` from `Department`. Add `DepartmentProduct` join table.
- **Backend Impact**: Update department creation and ticket routing logic.
- **Frontend Impact**: Multi-select product in department form.
- **Test Case**: Assign 3 products to 1 department.
- **Status**: TO DO

## 4. Product & Module Master
### REQ-PROD-001: Product Master CRUD
- **Requirement**: Complete Product CRUD.
- **Existing Implementation**: `Product` model exists.
- **Database Impact**: None.
- **Backend Impact**: Ensure CRUD handles deactivation correctly.
- **Frontend Impact**: Product management UI.
- **Test Case**: Deactivate product, ensure dependent views handle it safely.
- **Status**: TO DO

### REQ-PROD-002: Modules and Submodules
- **Requirement**: Product -> Module -> Submodule structure. Configurable.
- **Existing Implementation**: No module structure in DB.
- **Database Impact**: Add `Module` and `Submodule` models with relations to `Product`.
- **Backend Impact**: CRUD for Modules/Submodules.
- **Frontend Impact**: Nested UI for managing modules under products.
- **Test Case**: Add "Payroll" module to "SPINE" product.
- **Status**: TO DO

### REQ-PROD-003: Customer Product Purchase Model (Entitlement)
- **Requirement**: Customer can purchase complete product or specific modules.
- **Existing Implementation**: `CompanyProduct` links company to product.
- **Database Impact**: Add `PurchaseType` (COMPLETE/MODULES) to `CompanyProduct`. Add `CompanyProductModule` join table.
- **Backend Impact**: API to handle modular entitlement.
- **Frontend Impact**: UI checklist for modules during purchase.
- **Test Case**: Customer purchases 2 modules out of 10.
- **Status**: TO DO

### REQ-PROD-004: Customer Product View & Delete
- **Requirement**: View purchased products/modules. Fix "Purchased product delete is not working" with safe validation.
- **Existing Implementation**: Basic view exists. Deletion might fail on FK constraints.
- **Database Impact**: None.
- **Backend Impact**: Implement controlled removal checking for tickets, branches, AMC, etc.
- **Frontend Impact**: Show module names instead of IDs. Warning modals for deletion.
- **Test Case**: Attempt deleting product in use; should warn/prevent.
- **Status**: TO DO

## 5. Branch Master
### REQ-BRN-001: Customer Branch Management
- **Requirement**: Branch CRUD, optional GST, multiple contacts (Add More for phones/emails).
- **Existing Implementation**: `CompanyBranch` exists. `contactPhone` is single.
- **Database Impact**: Add `alternatePhones`, `alternateEmails`, `alternateContacts` to `CompanyBranch`.
- **Backend Impact**: Update Branch CRUD.
- **Frontend Impact**: Add dynamic fields for contacts.
- **Test Case**: Add branch with 2 contact persons.
- **Status**: TO DO

### REQ-BRN-002: Branch Product Entitlement
- **Requirement**: Branch can only use a subset of products/modules that the parent customer has purchased.
- **Existing Implementation**: `BranchProduct` links branch to product, but doesn't validate against parent. No module support.
- **Database Impact**: Add `BranchProductModule`.
- **Backend Impact**: Strict validation during branch product assignment.
- **Frontend Impact**: Limit selection dropdown to parent entitlements.
- **Test Case**: Try assigning product not owned by parent to branch (should fail).
- **Status**: TO DO

## 6. Ticket Management
### REQ-TKT-001: Product-Based Ticket Routing
- **Requirement**: Ticket must capture Product, Module, Submodule, and route to correct Department based on mapping.
- **Existing Implementation**: `Ticket` has `productId` and `departmentId`.
- **Database Impact**: Add `moduleId`, `submoduleId` to `Ticket`.
- **Backend Impact**: Update auto-routing logic to use Product/Module.
- **Frontend Impact**: Cascading dropdowns for Product -> Module -> Submodule in ticket creation.
- **Test Case**: Create ticket for specific module, verify routing to correct dept.
- **Status**: TO DO

### REQ-TKT-002: Multiple Customer Tickets
- **Requirement**: Customer can create multiple tickets.
- **Existing Implementation**: Supported by schema.
- **Database Impact**: None.
- **Backend Impact**: None.
- **Frontend Impact**: Ensure UI handles multiple tickets properly.
- **Test Case**: Create 3 active tickets for one customer.
- **Status**: TO DO

### REQ-TKT-003: Automatic Ticket Assignment
- **Requirement**: Auto-assign to eligible support level employee with lowest workload in the mapped department.
- **Existing Implementation**: Manual or basic auto-assignment.
- **Database Impact**: None.
- **Backend Impact**: Complex workload calculation algorithm based on active tickets.
- **Frontend Impact**: None.
- **Test Case**: Assign ticket to dept with 3 employees; verify employee with least tickets gets it.
- **Status**: TO DO

### REQ-TKT-004: Ticket Timer
- **Requirement**: Start, Pause, Resume, Escalate (preserves time), Resolve, Review, Closure. Fix "Timer paused and Start is not working".
- **Existing Implementation**: `TicketResolutionSession` exists.
- **Database Impact**: Potentially add `timerStatus` to `Ticket`.
- **Backend Impact**: Fix timer logic, ensure cumulative time is calculated correctly across escalations.
- **Frontend Impact**: Timer UI controls.
- **Test Case**: Start timer, pause, escalate, resume. Total time should be cumulative.
- **Status**: TO DO

### REQ-TKT-005: Granular SLA
- **Requirement**: SLA can differ by product/module/task for a single customer.
- **Existing Implementation**: Global or Priority-based SLA (`SlaConfiguration`).
- **Database Impact**: Add SLA linking to `CompanyProduct` or `Subscription`.
- **Backend Impact**: SLA deadline calculation must use specific agreement.
- **Frontend Impact**: SLA config UI per customer product.
- **Test Case**: Ensure two different products for same customer have different SLAs.
- **Status**: TO DO

## 7. Implementation & AMC
### REQ-IMP-001: Implementation Customer/Product Selection
- **Requirement**: Fix "Company list is not visible". Implementation must show only purchased products/modules.
- **Existing Implementation**: `Implementation` exists.
- **Database Impact**: None.
- **Backend Impact**: Fix company list API. Fetch entitled modules.
- **Frontend Impact**: Update selection UI.
- **Test Case**: Start implementation, ensure un-purchased products don't appear.
- **Status**: TO DO

### REQ-IMP-002: Implementation Checklists & Progress
- **Requirement**: Checklists must reflect purchased modules. Progress calculated from completion. Team members visible.
- **Existing Implementation**: `ImplementationTask` exists.
- **Database Impact**: Add `moduleId` to `ImplementationTask` or link to modules.
- **Backend Impact**: Auto-generate tasks based on modules. Calculate progress.
- **Frontend Impact**: Checklist UI, progress bar.
- **Test Case**: Complete 1 of 2 modules, progress should be 50%.
- **Status**: TO DO

### REQ-AMC-001: AMC Enhancements
- **Requirement**: AMC supports multiple products, modules, different SLAs. Fix "Company list is not visible". Search + Filter simultaneously.
- **Existing Implementation**: `Subscription` exists.
- **Database Impact**: Link `Subscription` to modules.
- **Backend Impact**: Fix search/filter logic.
- **Frontend Impact**: Update AMC list UI.
- **Test Case**: Search for "ABC" and filter by "Active" simultaneously.
- **Status**: TO DO

## 8. New Features (Prospects, Tasks, Chat)
### REQ-NEW-001: Temporary Prospect
- **Requirement**: Lifecycle: ENQUIRY -> PROSPECT -> CONVERT -> CUSTOMER.
- **Existing Implementation**: None.
- **Database Impact**: Add `Prospect` model.
- **Backend Impact**: CRUD for prospects, Conversion endpoint.
- **Frontend Impact**: Prospect management UI.
- **Test Case**: Convert prospect, verify CMP-XXXX generated.
- **Status**: TO DO

### REQ-NEW-002: Employee Task Reminders
- **Requirement**: Employees can create self tasks/reminders. Dashboard widget.
- **Existing Implementation**: None.
- **Database Impact**: Add `EmployeeTask` model.
- **Backend Impact**: CRUD for tasks.
- **Frontend Impact**: Task widget on dashboard.
- **Test Case**: Create task due today, verify dashboard shows it.
- **Status**: TO DO

### REQ-NEW-003: Internal Employee Chat
- **Requirement**: Chat inside Kanvtech. 1-to-1, multi-recipient, CC, read receipts.
- **Existing Implementation**: None.
- **Database Impact**: Add `ChatConversation`, `ChatMessage`, `ChatParticipant` models.
- **Backend Impact**: Chat API / WebSockets.
- **Frontend Impact**: Chat UI window/widget.
- **Test Case**: Admin sends message to employee, employee reads it, read receipt shows.
- **Status**: TO DO

## 9. General System
### REQ-SYS-001: URL/Username/Password Fields
- **Requirement**: "add field URL, username & password" to appropriate entity securely.
- **Existing Implementation**: Unknown context, likely for customer access credentials or integrations.
- **Database Impact**: Add `CustomerCredential` or `ProductCredential` model (encrypted).
- **Backend Impact**: Encryption/Decryption logic.
- **Frontend Impact**: Secure masked UI.
- **Test Case**: Save credential, verify DB stores encrypted string.
- **Status**: TO DO

### REQ-SYS-002: Validation & Email Verification
- **Requirement**: Validate email/phone properly (FE & BE). Real email verification flow.
- **Existing Implementation**: Basic validation.
- **Database Impact**: Add `emailVerified` boolean, `verificationToken` to User/CompanyContact.
- **Backend Impact**: Verification API.
- **Frontend Impact**: Verification UI flow.
- **Test Case**: Enter invalid email, ensure backend rejects. Verify email via token.
- **Status**: TO DO

### REQ-SYS-003: Import Engine
- **Requirement**: Templates for all entities with validation, proper error reporting, handle Customer ID or Email matching.
- **Existing Implementation**: Basic import.
- **Database Impact**: None.
- **Backend Impact**: Update import parsers for new fields/modules.
- **Frontend Impact**: Update template downloads.
- **Test Case**: Import branch with valid Customer Email, verify mapping.
- **Status**: TO DO

### REQ-SYS-004: Audit Logging & RBAC
- **Requirement**: Audit all new actions. Ensure strict RBAC and data isolation (customer sees only own data).
- **Existing Implementation**: `AuditLog` exists.
- **Database Impact**: None.
- **Backend Impact**: Wrap new endpoints in RBAC and Audit.
- **Frontend Impact**: None.
- **Test Case**: Customer attempts to fetch another customer's ticket, receives 403.
- **Status**: TO DO
