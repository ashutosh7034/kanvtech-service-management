# KANVTECH Service Management Platform — Changelog

All notable changes to the KANVTECH platform are documented in this file.

---

## [2.0.0] - 2026-10-19

### Mobile (Flutter / Android)
- **Release APK Generated:** Built fresh release-testing APK `mobile/build/app/outputs/flutter-apk/app-release.apk` (52.57 MB, SHA-256 `047595809d7310243f063b60896f1fc7b2a0bf6132ee01ec88c1ecaf1978dd7a`).
- **Canonical Backup:** Preserved canonical backup at `mobile/build/app/outputs/flutter-apk/app-release-canonical-backup.apk` (50.93 MB).
- **Toolchain Alignment:** Flutter 3.47.5 stable, Dart 3.13.4, AGP 8.11.1, Gradle 8.14, compileSdk 36, minSdk 24.
- **Theme & Design System Synchronization:**
  - Synchronized `AppColors` and `AppTheme` with Web canonical design tokens (`#0b3b60` primary, `#2563eb` secondary, slate borders).
  - Aligned status badges with 3-part semantic color triplets (background, border, text) and status dots across all modules.
  - Implemented reusable `SlaBadge` widget (`mobile/lib/widgets/sla_badge.dart`).
- **Layout & Overflow Resolutions:**
  - Fixed horizontal text overflow on `ApprovalsScreen` (93px) using `Expanded` and `TextOverflow.ellipsis`.
  - Fixed horizontal text overflow on `DepartmentsScreen` (16px) using `Flexible` and single-line truncation.
  - Fixed horizontal filter bar overflow on `EscalationsScreen` (77px) and `MaintenanceScreen` using `SingleChildScrollView(scrollDirection: Axis.horizontal)`.
- **API & Serialization Hardening:**
  - Implemented resilient JSON unwrapping in `ApiService` supporting both direct lists and `{ data: [...] }` envelopes.
  - Resolved `EmployeeDetailModel.fromJson` runtime type casting exception on department fields.
  - Verified `SessionTerminatedException` handling with user notification and credentials purge on secondary login.
- **Navigation & Drawer Architecture:**
  - Grouped navigation drawer sections into OPERATIONS, ORGANIZATION MASTER, CLIENT SERVICES, and ANALYTICS & GOVERNANCE.

### Web (Next.js 14 / React 18)
- **Production Build Optimization:**
  - Dynamically imported `xlsx` via `import('xlsx')` in `reportExporter.ts`, trimming initial page JS bundle from 449 kB to 355 kB.
  - Configured Gzip/Brotli compression and compiler stripping in `next.config.js`.
- **User Experience (UX) Enhancements:**
  - Integrated `LoadingSpinner` across Dashboard and Tickets pages to eliminate layout shift during async fetches.
  - Integrated `EmptyState` component with contextual clear-filter and ticket-logging actions.
  - Unified CSS custom properties and badge triplets in `src/styles/app.css`.

### Repository Space Reclaimed
- Removed 35 abandoned temporary Prisma Windows update binaries (`query_engine-windows.dll.node.tmp*`) reclaiming **642.95 MB**.
- Purged stale webpack build caches and test dill artifacts, reclaiming over **1.05 GB** total workspace disk space.

---

## [1.2.0] - 2026-10-17

### Added
- **Web vs Mobile Functional Parity:** Verified 64/64 applicable REST API operations across 6 roles (Admin, Manager, L1, L2, L3, Customer) with 100% test coverage.
- **Task Allotment Engine:** Added administrative override allowing assignment to any specialist tier without tier-mismatch validation blocks.
- **Single Active Session Guard:** Concurrent login detection invalidating previous sessions with user alerts.

---

## [1.1.0] - 2026-10-15

### Added
- **Multi-Tier Escalation Hierarchy:** Continuous resolution timer preserving elapsed seconds across L1 $\to$ L2 $\to$ L3 handoffs.
- **Customer Verification Engine:** Strict 2-active-ticket limit, ticket reopening with mandatory reasoning, and 5-star CSAT ratings.
- **Annual Maintenance Contracts (AMC):** Subscription tracking with auto-expiry countdowns and renewal dialogs.
- **Product Master Catalog:** Centralized product code directory with category filters and active/inactive toggles.

---

## [1.0.0] - 2026-10-10

### Initial Prototype Release
- Modular NestJS 10 REST API backend with Prisma 5 ORM and PostgreSQL database.
- Next.js 14 web portal with server-side authentication and role-based guards.
- Comprehensive QA test suites (core business, security, and advanced workflow suites).
