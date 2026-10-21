# KANVTECH Service Management Platform — Server Deployment Checklist

**Deployment Target:** Office Server PC (`192.168.1.4`)  
**Web Endpoint:** `https://192.168.1.4:8444`  
**API Endpoint:** `https://192.168.1.4:8444/api`  
**Execution Context:** Manual execution on office server PC in a future instruction  

---

## CRITICAL SAFETY BOUNDARIES

> [!CAUTION]
> **Database Protection Rules:**
> 1. Port `5432` is production HikCentral PostgreSQL and must **NEVER** be touched, accessed, or modified.
> 2. Port `5433` is the staging PostgreSQL database.
> 3. **NO** database migrations, seed commands, resets, or table truncations are permitted during deployment.
> 4. All code changes in this release are 100% backward-compatible with the existing database schema.

---

## Phase 1: Transfer & Workspace Preparation
- [ ] **1.1 Transfer Files:** Copy repository source / `release-predeploy/` package from personal PC to office server PC.
- [ ] **1.2 Verify Working Tree:** Run `git status` on office PC to ensure no uncommitted local server overrides are overwritten.
- [ ] **1.3 Environment Files & Mandatory Database Source Verification:**
  - Verify that `backend/.env` and `web/.env.production` exist locally on the server PC.
  - **MANDATORY PRE-START DATABASE VERIFICATION:**
    - Inspect the existing server's `backend/.env` locally to verify which database the currently deployed KANVTECH application is intended to use.
    - Confirm the database host, port, and database name against the existing authorized server configuration.
    - **Security Rule:** Never print the database password, never replace the URL with an unverified address, and never assume that staging port `5433` is the correct production database.
    - **Port 5432 Protection:** Port `5432` is reserved strictly for HikCentral and must NOT be modified, accessed, or used for KANVTECH without explicit, verified authorization.
    - **Blocker Gate:** If the intended database cannot be established with certainty, STOP the deployment process immediately and request clarification. Do not proceed with service restarts or compilation.
- [ ] **1.4 Database Backup (Recommended Precaution):**
  - Run a read-only database backup of the authorized KANVTECH database identified in step 1.3 before restarting services.
  - Example command for staging (never run against port 5432):
    ```powershell
    pg_dump -h localhost -p 5433 -U postgres kanvtech_sm_staging > C:\backups\kanvtech_staging_predeploy_backup.sql
    ```

---

## Phase 2: Backend Service Deployment
- [ ] **2.1 Navigate to Backend Directory:**
  ```powershell
  cd "C:\path\to\Kanvtech service management\backend"
  ```
- [ ] **2.2 Install Dependencies:**
  ```powershell
  npm ci
  ```
- [ ] **2.3 Identify KANVTECH Service Management Method:**
  - Identify the exact KANVTECH backend process and how it is managed on the server (e.g., Windows Task Scheduler task, PM2 process, Windows Service wrapper, or standalone terminal).
  - Note the exact service name or process ID.
  - **Safety Rule:** Do not kill unrelated Node.js processes (such as office automation, UltraViewer, or print services) or restart other office services.
- [ ] **2.4 Gracefully Stop ONLY the KANVTECH Backend Service (Port 5000):**
  - Stop only the specific KANVTECH backend service identified in step 2.3 using its established management method (e.g. stop the specific PM2 process or Task Scheduler task).
  - This prevents Windows file-locking (`EPERM`) on `dist/main.js` and `.dll.node` files during compilation.
- [ ] **2.5 Generate Prisma Client:**
  ```powershell
  npx prisma generate
  ```
  *(Code generation only; strictly zero database migrations or schema updates).*
- [ ] **2.6 Compile NestJS Production Build:**
  ```powershell
  npm run build
  ```
  - Verify the build exit code is `0` and compilation output exists in `dist/`. If compilation fails, stop and investigate before restarting.
- [ ] **2.7 Restart KANVTECH Backend Service Using Its Existing Management Method:**
  - Restart the service using the same management method identified in step 2.3 (e.g. start the PM2 process or trigger the Task Scheduler task).
  - If executed standalone:
    ```powershell
    npm run start:prod
    ```
- [ ] **2.8 Verify Local API Health:**
  ```powershell
  curl http://127.0.0.1:5000/api/auth/profile
  ```

---

## Phase 3: Web Frontend Deployment
- [ ] **3.1 Navigate to Web:**
  ```powershell
  cd "C:\path\to\Kanvtech service management\web"
  ```
- [ ] **3.2 Install Dependencies:**
  ```powershell
  npm ci
  ```
- [ ] **3.3 Compile Next.js Production Build:**
  ```powershell
  npm run build
  ```
  *(Verify static pages generate successfully in `~3.5s`)*
- [ ] **3.4 Restart Web Service (Port 3000):**
  - If managed via Windows Task Scheduler / PM2: restart the task.
  - Or manually execute:
    ```powershell
    npm run start
    ```
- [ ] **3.5 Verify Local Web Health:**
  ```powershell
  curl http://127.0.0.1:3000/
  ```

---

## Phase 4: Reverse Proxy & Network Verification
- [ ] **4.1 Verify Caddy / Nginx Service:**
  Confirm reverse proxy is running and listening on port `8444`.
- [ ] **4.2 End-to-End HTTPS Verification from Office PC:**
  Open Chrome/Edge on the server PC:
  ```text
  https://192.168.1.4:8444
  ```
  - Verify page loads with HTTPS TLS styling.
  - Confirm `/api/auth/profile` reverse proxies correctly to backend port `5000`.
- [ ] **4.3 Office Wi-Fi Network Smoke Test:**
  From a secondary laptop/workstation connected to the office Wi-Fi:
  - Navigate to `https://192.168.1.4:8444`.
  - Log in using an authorized account.
  - Test Ticket List, Customer Directory, and Dashboard KPI loading.

---

## Phase 5: Mobile Android APK Sideload & Verification
- [ ] **5.1 Distribute APK:**
  Transfer `release-predeploy/mobile/app-release.apk` to test Android devices.
- [ ] **5.2 Sideload Install:**
  Install `app-release.apk` on physical test device(s).
- [ ] **5.3 Configure Server URL:**
  - Launch **Kanvtech Service** on phone.
  - On the **Sign In** screen, tap **Server Config** at top right.
  - Set Base API URL to:
    ```text
    https://192.168.1.4:8444/api
    ```
  - Tap **Save**.
- [ ] **5.4 Execute Mobile Checklist:**
  Follow [APK_MANUAL_TEST_CHECKLIST.md](file:///c:/Users/Ashutosh%20Pandey/Downloads/Kanvtech%20service%20management/docs/APK_MANUAL_TEST_CHECKLIST.md) to record manual test results on physical hardware.
