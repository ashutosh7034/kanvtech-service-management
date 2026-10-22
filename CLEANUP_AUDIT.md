# KANVTECH SERVICE MANAGEMENT PLATFORM — CLEANUP AUDIT

**Audit Date:** 2026-10-22  
**Platform Version:** 2.0.1  
**Audit Scope:** Full repository scan across `web/`, `backend/`, `mobile/`, `release-predeploy/`, `scripts/`, `docs/`, and root level.  
**Auditor:** Antigravity AI Pair Programmer  

---

## 1. Project Structure & Repository Baseline

The workspace root contains the three primary application subsystems alongside deployment, scripting, and QA release packaging directories:

- `web/` — Next.js 15.5.25 frontend application
- `backend/` — NestJS 10 / Prisma 5 backend application
- `mobile/` — Flutter Android application (SDK 3.24 / Dart 3.5)
- `release-predeploy/` — Staging release package, APK builds, and UAT verification evidence
- `scripts/` — Project tooling, UAT test runners, and seed scripts
- `deploy/` — Staging deployment configurations, reverse proxies, and TLS certificates
- `docs/` — Architecture documentation and UI evidence captures

### Git Status Baseline (Pre-Cleanup)
- **Branch:** `main` (Up to date with `origin/main`)
- **Tracked Modifications:** Authentication, branding, and release package updates.
- **Untracked Additions:** Authoritative branding assets, generated mipmaps, PWA icons, BrandLogo component, deliverable reports, and temporary test artifacts.

---

## 2. File Classification Matrix

| File Path | Category | Git Status | Size (Bytes) | References & Dependencies | Action / Disposition |
|---|:---:|:---:|:---:|---|---|
| `web/public/favicon.png` | **SAFE TO REMOVE** | Untracked | 2,685 | 0 references in code or HTML. 100% byte-for-byte duplicate of `web/public/favicon-32x32.png` (SHA-256: `DF5D0237BD1FC4EA5D1DCCC0C8027B2685FC06817BFDE74CC51A65E7C31B4931`). | Move to quarantine. |
| `.wifi-server.pids.json` | **SAFE TO REMOVE** | Untracked | 136 | Stale PID file created by `start-wifi-server.ps1`. Recorded processes (17680, 30708) are no longer running. | Move to quarantine. |
| `backend/test_timer.ts` | **SAFE TO REMOVE** | Untracked (Ignored) | 2,624 | Ad-hoc scratch script from earlier timer development. Not imported, not part of test suite, explicitly ignored in `.gitignore`. | Move to quarantine. |
| `backend/scripts/admin_token.txt` | **SAFE TO REMOVE** | Untracked (Ignored) | 273 | Expired scratch JWT token (iat: 1791359844, exp: 1791446244). Explicitly ignored in `.gitignore`. 0 references. | Move to quarantine. |
| `Kanvtech logo.jpeg` (root) | **KEEP** | Untracked | 37,352 | Authoritative horizontal web logo source provided by user. | Preserve in root. |
| `Kanvtech app logo.png` (root) | **KEEP** | Untracked | 1,523,091 | Authoritative square app icon source provided by user. | Preserve in root. |
| `web/public/assets/*` | **KEEP** | Untracked | 1,560,443 | Authoritative web logo & app icon referenced by `BrandLogo.tsx`. | Preserve in `web/public/assets/`. |
| `web/public/favicon.ico` | **KEEP** | Untracked | 3,603 | Multi-size browser icon (16x16, 32x32, 48x48) referenced in `layout.tsx`. | Preserve in `web/public/`. |
| `web/public/favicon-16x16.png` | **KEEP** | Untracked | 875 | Standard favicon referenced in `layout.tsx`. | Preserve in `web/public/`. |
| `web/public/favicon-32x32.png` | **KEEP** | Untracked | 2,685 | High-DPI favicon referenced in `layout.tsx`. | Preserve in `web/public/`. |
| `web/public/apple-touch-icon.png` | **KEEP** | Untracked | 44,588 | iOS touch icon referenced in `layout.tsx`. | Preserve in `web/public/`. |
| `web/public/icon-192.png` | **KEEP** | Untracked | 49,945 | PWA icon referenced in `manifest.json`. | Preserve in `web/public/`. |
| `web/public/icon-512.png` | **KEEP** | Untracked | 295,796 | High-res splash icon referenced in `manifest.json`. | Preserve in `web/public/`. |
| `web/public/manifest.json` | **KEEP** | Untracked | 658 | Web app manifest referenced in `layout.tsx`. | Preserve in `web/public/`. |
| `web/src/components/common/BrandLogo.tsx` | **KEEP** | Untracked | 1,940 | Reusable branding component referenced in `LoginPage`, `Sidebar`, `CustomerMobileView`. | Preserve. |
| `mobile/assets/images/*` | **KEEP** | Untracked | 1,560,443 | Authoritative mobile assets declared in `pubspec.yaml` and used in app. | Preserve in `mobile/assets/images/`. |
| `mobile/android/app/src/main/res/mipmap-*` | **KEEP** | Untracked & Modified | ~1.2 MB | Launcher icons, adaptive foregrounds, and splash images across all Android densities. | Preserve. |
| `release-predeploy/mobile/app-release.apk` | **KEEP** | Modified | 55.0 MB | Production-ready release APK artifact with verified SHA-256 hash. | Preserve in release package. |
| `release-predeploy/qa_reports/*` | **KEEP** | Tracked & Modified | ~40 KB | Active QA test reports, checksums, defect registers, and device guides. | Preserve. |
| `AUTHENTICATION_UAT_REPORT.md` | **KEEP** | Untracked | 8,068 | Active UAT deliverable for Fast-Track Login and Remember Me testing. | Preserve. |
| `FAST_TRACK_LOGIN_ROOT_CAUSE.md` | **KEEP** | Untracked | 8,788 | Root-cause architectural analysis deliverable. | Preserve. |
| `REMEMBER_ME_IMPLEMENTATION_REPORT.md` | **KEEP** | Untracked | 8,590 | Implementation report for cross-platform Remember Me functionality. | Preserve. |
| `KANVTECH_BRANDING_UPDATE_REPORT.md` | **KEEP** | Untracked | 14,323 | Official branding update deliverable for logo and launcher icon updates. | Preserve. |
| `PROJECT_TECH_STACK_AUDIT.md` | **KEEP** | Tracked | 7,157 | Architectural reference document. | Preserve. |
| `LOCAL_WIFI_HOSTING_GUIDE.md` | **KEEP** | Tracked | 8,414 | Local Wi-Fi hosting procedures and instructions. | Preserve. |
| `scripts/*` (15 scripts) | **KEEP** | Tracked | ~120 KB | UAT runners, emulators, database inspection, and benchmark scripts. | Preserve. |
| `backend/scripts/*` (37 scripts) | **KEEP** | Tracked | ~320 KB | Production audit, migration, seed, and security verification suites. | Preserve. |
| `deploy/staging/*` | **KEEP** | Tracked & Ignored | ~12 KB | Staging reverse-proxy configuration and local self-signed TLS certificates. | Preserve. |
| `backend/backups/*` & `backend/uploads/*` | **KEEP** | Ignored | ~4 MB | Staging SQL database dumps and uploaded business attachments. | Preserve. |

---

## 3. Reference and Safety Verification

1. **`web/public/favicon.png`:**
   - Search across repository for `favicon.png`: 0 matches.
   - Hash comparison against `web/public/favicon-32x32.png`: Identical SHA-256 (`DF5D0237BD1FC4EA5D1DCCC0C8027B2685FC06817BFDE74CC51A65E7C31B4931`).
   - Removing this duplicate does not break any browser tab or Next.js build requirement.
2. **`.wifi-server.pids.json`:**
   - PowerShell inspection confirmed PIDs 17680 and 30708 do not exist on the system.
   - Removing this file restores a clean repository root without impacting any active processes.
3. **`backend/test_timer.ts`:**
   - Search across repository for `test_timer`: 0 matches.
   - File was already excluded via `.gitignore`.
   - Removing this scratch script does not alter backend builds or tests.
4. **`backend/scripts/admin_token.txt`:**
   - Search across repository for `admin_token`: 0 matches.
   - File contains an expired JWT token; already excluded via `.gitignore`.
   - Safe to quarantine.

---

## 4. Proposed Quarantine & Cleanup Plan

All approved disposable files will be moved into `.cleanup_quarantine/` with a manifest (`QUARANTINE_MANIFEST.json`) preserving original relative paths for instant, 100% reversible recovery.

No production source code, configuration files, active branding assets, test suites, or release artifacts will be touched.
