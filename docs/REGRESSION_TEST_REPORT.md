# KANVTECH Comprehensive Regression Test Report

**Execution Date:** 2026-10-17  
**Branch:** `feature/kanvtech-mobile-update`  
**Test Auditor:** Automated QA & Full-Stack Release Verification  
**Final Outcome:** **ZERO REGRESSIONS — 100% PASS ACROSS ALL SUITES**  

---

## 1. Automated Verification Command Summary

| Suite / Tool | Command Line | Working Directory | Exit Code | Result | Duration |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Next.js Production Build** | `npm run build` | `web/` | `0` | **PASS (0 errors)** | 7.3s |
| **Flutter Static Analysis** | `flutter.bat analyze` | `mobile/` | `0` | **PASS (0 issues)** | 7.9s |
| **Flutter Unit & Widget Tests** | `flutter.bat test` | `mobile/` | `0` | **PASS (18/18 passed)** | 7.8s |
| **Full Live UAT Parity Runner** | `node scripts/audit_uat_runner.js` | Project Root | `0` | **PASS (64/64 passed)** | 3.9s |
| **Backend Health Probe** | `curl.exe -s http://localhost:5000/api/health` | `backend/` | `0` | **PASS (`status: ok`)** | <100ms |

---

## 2. Test Execution Details

### A. Web Application Build & Type Checking
- **Command:** `npm run build` in `web/`
- **Output:**
  ```text
  ▲ Next.js 15.5.25
  - Environments: .env.local, .env.production
  Creating an optimized production build ...
  ✓ Compiled successfully in 7.3s
  Checking validity of types ...
  Collecting page data ...
  Generating static pages (5/5)
  Finalizing page optimization ...
  Route (app)                                 Size  First Load JS
  ┌ ○ /                                      451 B         449 kB
  ├ ○ /_not-found                            996 B         103 kB
  ├ ƒ /[...slug]                             449 B         449 kB
  └ ○ /login                                 456 B         449 kB
  + First Load JS shared by all             102 kB
  ```
- **Verdict:** TypeScript compiles with zero errors, static pages render cleanly, production compression active.

### B. Flutter Static Analysis
- **Command:** `C:\src\flutter\bin\flutter.bat analyze` in `mobile/`
- **Output:**
  ```text
  Analyzing mobile...
  No issues found! (ran in 7.9s)
  ```
- **Verdict:** Zero lint warnings, zero deprecation errors, zero typing defects.

### C. Flutter Unit & Widget Test Suite
- **Command:** `C:\src\flutter\bin\flutter.bat test` in `mobile/`
- **Output:**
  ```text
  00:00 +0: UserModel Role & Predicate Tests Customer role parsed correctly
  00:00 +1: Feature Parity Models Verification DepartmentModel parses correctly
  00:00 +5: TicketModel Deserialization & Workflow Rules Active ticket limit and reopen predicates
  00:00 +6: Master Data Deserialization Company and Branch models
  00:00 +8: Feature Parity Models Verification ProspectModel parses inquiries and sales pipeline
  00:00 +9: Feature Parity Models Verification ImplementationModel parses stages and tasks
  00:00 +10: Feature Parity Models Verification SubscriptionModel parses AMC validity and days remaining
  00:00 +11: Feature Parity Models Verification AuditLogModel parses security events
  00:00 +12: Feature Parity Models Verification SlaConfigModel parses response and resolution limits
  00:00 +13: Feature Parity Models Verification TicketModel convenience getters match web parity fields
  00:00 +14: Single Active Session Mobile Invalidation Tests SessionTerminatedException carries required message
  00:00 +15: Single Active Session Mobile Invalidation Tests AuthProvider clears credentials and sets message
  00:00 +16: Single Active Session Mobile Invalidation Tests Logout clears session terminated message
  00:00 +17: Kanvtech mobile app renders login screen by default
  00:01 +18: All tests passed!
  ```
- **Verdict:** 18 out of 18 test cases passed.

### D. Live UAT End-to-End Parity Verification
- **Command:** `node scripts/audit_uat_runner.js` against Staging PostgreSQL port 5433 and NestJS port 5000.
- **Output Summary:**
  ```text
  Total Operations Inventoried: 65
  Applicable Operations:        64
  PASS:                         64
  FAIL:                         0
  PARTIAL:                      0
  NOT IMPLEMENTED:              0
  NOT TESTED:                   0
  BLOCKED:                      0
  NOT APPLICABLE:               1
  ----------------------------------------------------------------
  Verified Operation Coverage:  100.00% (64/64)
  FINAL AUDIT VERDICT:          FULL PARITY VERIFIED
  ```
- **Verdict:** 100.00% verified functional parity confirmed across all 6 roles.
