# KANVTECH Service Management Platform — Pre-Deployment Preparation Report

**Document Date:** 2026-10-21  
**Execution Context:** Personal PC (`C:\Users\Ashutosh Pandey\Downloads\Kanvtech service management`)  
**Deployment Target:** Office Server PC (`192.168.1.4:8444`) in a separate, future instruction  
**Status:** **PRE-DEPLOYMENT VERIFIED — NOT DEPLOYED**  

---

## 1. Executive Summary

This report documents the completed pre-deployment audit, build validation, and release package preparation for the KANVTECH Service Management Platform. The release package contains verified builds and runtime specifications for the Next.js web application, NestJS backend API, and Flutter Android mobile client.

In accordance with strict safety mandates:
- **Deployment Status:** **NOT DEPLOYED**. Zero remote connections, zero file transfers to office server, zero service restarts.
- **Database Status:** **NOT MODIFIED**. Staging database (port 5433) and HikCentral production database (port 5432) remain strictly untouched. Zero Prisma migrations or table modifications exist in this release.
- **Git Status:** Clean repository working tree; zero git commits or git push operations performed during this task.

---

## 2. Subsystem Readiness & Verification Results

### 2.1 Backend API (NestJS 10 + Prisma 5)
- **TypeScript Compilation:** `npx tsc --noEmit` &rarr; **PASS** (0 errors).
- **Production Build:** `npx nest build` &rarr; **PASS** (Compiled cleanly into `backend/dist/`).
- **Functional API Parity:** 64/64 applicable REST operations verified (100% pass rate) via automated UAT suite.
- **Database Compatibility:** 100% backward-compatible with existing PostgreSQL database schema. No schema migrations or data alterations required.
- **Runtime Port:** `5000` (Internal). Reverse-proxied via Caddy/Nginx from `https://192.168.1.4:8444/api/*`.

### 2.2 Web Frontend (Next.js 15.5.25 / React 18)
- **TypeScript Compilation:** `npx tsc --noEmit` &rarr; **PASS** (0 errors).
- **Production Compilation:** `npm run build` (`next build`) &rarr; **PASS** (Compiled in ~3.5s; all 5 static/dynamic routes generated).
- **Bundle Optimization:** First Load JS shared by all routes is `102 kB`; main application bundle is `355 kB` (optimized via dynamic `xlsx` import).
- **Network Routing:** Configured for relative API routing (`NEXT_PUBLIC_API_URL=/api`), ensuring seamless reverse proxying through port `8444` without hardcoded client IP addresses.
- **Runtime Port:** `3000` (Internal). Reverse-proxied via Caddy/Nginx from `https://192.168.1.4:8444/*`.

### 2.3 Mobile Application (Flutter 3.47.5 / Android)
- **Static Analysis:** `flutter analyze` &rarr; **PASS** (0 issues found, 0 warnings across all Dart files).
- **Automated Tests:** `flutter test` &rarr; **PASS** (23/23 tests passed across 5 test suites).
- **Release Testing APK:** Built and verified at `mobile/build/app/outputs/flutter-apk/app-release.apk` (and packaged in `release-predeploy/mobile/app-release.apk`).
- **Runtime Sideload Testing:** Successfully installed via `adb install -r` on Google Pixel 8a emulator (`emulator-5554`, Android 16 API 36). Verified cold start, 1-touch demo authentication, KPI dashboard, navigation drawer, and customer directory.

---

## 3. Verified APK Specifications

| Property | Value |
| :--- | :--- |
| **Artifact Path** | `release-predeploy/mobile/app-release.apk` |
| **Application ID** | `com.kanvtech.kanvtech_mobile` |
| **Application Label** | `Kanvtech Service` |
| **Version Name** | `2.0.0` |
| **Version Code** | `1` |
| **Target SDK / Min SDK**| Target SDK `36` (Android 16), Min SDK `24` (Android 7.0+) |
| **File Size** | `55,127,484 bytes` (52.57 MB) |
| **Build Timestamp** | `2026-10-21T12:22:48.000Z` |
| **SHA-256 Checksum** | `ab2cd903413cc89bd71d39a90bb492e2e5c7f3bcd34716a7748eedb46484b31a` |
| **Signing Setup** | Android Standard Debug Key (Appropriate for internal Wi-Fi sideload testing; not for Google Play Store) |

---

## 4. Database Compatibility Assessment

- **Prisma Schema:** `backend/prisma/schema.prisma` is completely unchanged and identical to the deployed database structure.
- **Migrations Required:** **ZERO** (0).
- **Data Operations Required:** **ZERO** (0). No seeding, truncation, reset, or schema evolution needed.
- **Isolation Protection & Pre-Start Verification:**
  - Production HikCentral PostgreSQL on port `5432` is strictly reserved, untouched, and off-limits.
  - Staging PostgreSQL on port `5433` remains unmodified.
  - **Mandatory Pre-Start Verification:** The operator must inspect the existing server's `backend/.env` locally to verify the authorized target database host, port, and database name. Never assume staging port 5433 is production, never print credentials, and never use port 5432 without explicit authorized approval. If unverified, stop and request clarification.

---

## 5. Environment Variables Required on Office Server PC

The following environment variables must be present on the office server PC (secrets omitted for security):

### Backend (`backend/.env`)
| Variable | Expected Value / Description | Sensitive? |
| :--- | :--- | :---: |
| `PORT` | `5000` | No |
| `DATABASE_URL` | `postgresql://postgres:<PASSWORD>@localhost:5433/kanvtech_sm_staging?schema=public` | **Yes (Password)** |
| `JWT_SECRET` | `<SERVER_CONFIGURED_JWT_SECRET>` | **Yes (Secret Key)**|
| `JWT_EXPIRES_IN` | `24h` | No |
| `CORS_ORIGIN` | `https://192.168.1.4:8444,https://staging.kanvtech.com,http://localhost:3000,http://127.0.0.1:3000` | No |
| `SWAGGER_ENABLED` | `false` | No |
| `NODE_ENV` | `production` | No |
| `STORAGE_DRIVER` | `local` | No |
| `UPLOAD_DIR` | `./uploads` | No |

### Web Frontend (`web/.env.production`)
| Variable | Expected Value / Description | Sensitive? |
| :--- | :--- | :---: |
| `NEXT_PUBLIC_API_URL` | `/api` | No |
| `BACKEND_INTERNAL_URL` | `http://127.0.0.1:5000` | No |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGINS` | `false` | No |
| `PORT` | `3000` | No |
| `NODE_ENV` | `production` | No |

---

## 6. Pre-Deployment Transfer Package Inventory

The local release package is located at `release-predeploy/`:

```text
release-predeploy/
├── mobile/
│   └── app-release.apk                          # 52.57 MB, verified release testing APK
├── backend/
│   └── BUILD_AND_RUNTIME_INSTRUCTIONS.md        # Exact step-by-step build & launch instructions
├── web/
│   └── BUILD_AND_RUNTIME_INSTRUCTIONS.md        # Exact step-by-step build & launch instructions
├── PREDEPLOYMENT_REPORT.md                      # This comprehensive audit report
├── SERVER_DEPLOYMENT_CHECKLIST.md               # Office server PC execution checklist
└── ARTIFACT_MANIFEST.txt                        # Cryptographic hashes and artifact manifest
```

---

## 7. Known Limitations & Remaining Manual Tests

1. **Physical Handset Verification:** Compilation, packaging, and emulator runtime testing were completed on `emulator-5554`. Manual testing on physical Android devices connected to the office Wi-Fi network (`https://192.168.1.4:8444/api`) remains to be conducted following [APK_MANUAL_TEST_CHECKLIST.md](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/docs/APK_MANUAL_TEST_CHECKLIST.md).
2. **Push Notifications:** The mobile app relies on REST polling and local state updates. Background Firebase Cloud Messaging (FCM) is not configured in this build.
3. **Office Wi-Fi Smoke Test:** In-office browser testing at `https://192.168.1.4:8444` will take place during server execution.

---

## 8. Safety & Policy Confirmation

- **Deployment Status:** **NOT DEPLOYED** (Zero remote server actions performed).
- **Database Status:** **NOT MODIFIED** (Zero SQL, migrations, or data writes).
- **Git Status:** **NOT COMMITTED / NOT PUSHED** (Clean working tree, `release-predeploy/` generated locally for transfer).
- **Secrets Security:** Zero credentials, passwords, or private keys exposed or committed.
