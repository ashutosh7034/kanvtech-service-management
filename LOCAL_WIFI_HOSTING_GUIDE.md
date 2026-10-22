# Kanvtech Service Management — Local Wi-Fi Hosting Guide

This guide provides instructions to run the **Kanvtech Service Management Platform** on your Windows host machine and access it seamlessly from mobile phones, tablets, or other computers connected to the same Wi-Fi network.

---

## 1. Detected Stack & Architecture

- **Backend:** NestJS 10.4.1 (Modular Monolith) on Node.js (v24.12.0)
- **Database:** PostgreSQL (active on port `5432`) managed via Prisma ORM (v5.20 / 5.22)
- **Frontend:** Next.js 15.5.25 (React 18.3.1, TypeScript 5.5.4)
- **Mobile Client:** Flutter (Dart) in `mobile/`
- **Reverse Proxy Architecture:** Next.js handles frontend assets on port `3000` and automatically proxies all `/api/*` and `/uploads/*` requests internally to the NestJS backend on port `5000`.

---

## 2. Prerequisites

Before starting the server, ensure:
1. **Node.js:** v18.x to v24.x installed (`node -v`).
2. **PostgreSQL:** Running on port `5432` with database `kanvtech_sm_staging`.
3. **Network Connection:** Connected to the target Wi-Fi network (`Auditorum-Stage_5GHz` or your local router).
4. **Build Artifacts:** Backend built in `backend/dist` and frontend built in `web/.next`.

---

## 3. Installation & Preparation

If starting on a fresh clone:
```powershell
# 1. Install dependencies
npm install --prefix backend
npm install --prefix web

# 2. Generate Prisma Client
npm run prisma:generate --prefix backend

# 3. Build production bundles
npm run build:backend
npm run build:web
```

---

## 4. Startup & Shutdown Commands

### How to Start the Wi-Fi Server

Run the provided PowerShell startup automation:

```powershell
# Option A: Run in background (recommended)
powershell -ExecutionPolicy Bypass -File .\start-wifi-server.ps1

# Option B: Run in foreground (interactive terminal with live monitoring)
powershell -ExecutionPolicy Bypass -File .\start-wifi-server.ps1 -Foreground

# Option C: Run in development mode (hot-reloading enabled)
powershell -ExecutionPolicy Bypass -File .\start-wifi-server.ps1 -DevMode
```

### How to Stop the Wi-Fi Server

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-wifi-server.ps1
```

---

## 5. Network Addressing & Access URLs

### Determining Your Laptop's LAN IPv4 Address
In PowerShell:
```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi' }).IPAddress
```
*Current Active Wi-Fi IPv4 Address:* **`192.168.3.111`**

### Access URLs

| Device / Client | Target Service | Access URL |
| :--- | :--- | :--- |
| **Hosting Laptop** | Web Application | `http://localhost:3000` |
| **Hosting Laptop** | Backend API | `http://localhost:5000/api` |
| **Hosting Laptop** | Swagger OpenAPI Docs | `http://localhost:5000/api/docs` |
| **Android Phone / Wi-Fi Device** | **Web Application (UI)** | **`http://192.168.3.111:3000`** |
| **Android Phone / Wi-Fi Device** | Backend API (Direct) | `http://192.168.3.111:5000/api` |
| **Android Phone / Wi-Fi Device** | Swagger OpenAPI Docs | `http://192.168.3.111:5000/api/docs` |
| **Flutter Mobile App** | API Base URL | `http://192.168.3.111:5000/api` |

---

## 6. How to Connect from an Android Phone or Other Device

1. Connect your phone or secondary laptop to the **exact same Wi-Fi network** as this host computer (`Auditorum-Stage_5GHz`).
2. Open Chrome, Safari, or Firefox on the phone.
3. In the address bar, type:
   ```text
   http://192.168.3.111:3000
   ```
4. Log in using your test credentials or administrator account.
5. All ticket views, dashboards, and API requests will resolve through the laptop.

---

## 7. Windows Firewall & Security Configuration

- **Current Status:** The Windows Wi-Fi network profile is set to `Public`. Node.js runtime (`C:\program files\nodejs\node.exe`) already possesses active Inbound Allow rules on the Public profile.
- **Trusted Networks Recommendation:** If switching to a trusted private network, configure the network profile to `Private`:
  ```powershell
  # Check connection profile
  Get-NetConnectionProfile
  ```
- **Narrowly Scoped Port Rules (Optional / If Needed):**
  If remote devices experience connection timeouts on restricted networks, add an inbound port rule with Administrator privileges:
  ```powershell
  # Requires Administrator PowerShell
  New-NetFirewallRule -DisplayName "Kanvtech Web Server (Port 3000)" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
  New-NetFirewallRule -DisplayName "Kanvtech Backend API (Port 5000)" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow -Profile Private
  ```
- **Database Safety:** PostgreSQL (port `5432`) is strictly kept on loopback and is **never** exposed to external Wi-Fi clients.

---

## 8. Troubleshooting Guide

### 1. Connection Refused / Site Cannot Be Reached
- **Cause:** Servers are not currently running.
- **Fix:** Execute `powershell -ExecutionPolicy Bypass -File .\start-wifi-server.ps1` and verify both ports `3000` and `5000` display `Ready!`.

### 2. Connection Times Out on Phone
- **Cause:** AP Client Isolation enabled on Wi-Fi router, or Windows Firewall blocking inbound packets.
- **Fix:**
  - Verify phone and laptop are on the same Wi-Fi SSID and subnet (`192.168.3.x`).
  - Test ping from phone (using network utility app) to `192.168.3.111`.
  - Some enterprise / guest Wi-Fi networks enable **Client Isolation** (preventing devices on Wi-Fi from talking to each other). If this occurs, switch both devices to a mobile hotspot or private router.

### 3. IP Address Changes After Reconnecting
- **Cause:** Dynamic DHCP lease renewal.
- **Fix:** Run `.\start-wifi-server.ps1`; the script automatically detects your updated IPv4 address and prints the new access URL.

### 4. CORS Policy Violation Errors
- **Symptom:** `CORS policy violation: Origin 'http://192.168.3.111:3000' is not authorized`.
- **Status:** **Resolved.** `backend/src/main.ts` now allows RFC 1918 private IP subnets (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`) in development mode, and `CORS_ORIGIN` in `backend/.env` includes `http://192.168.3.111:3000`.

### 5. Port Conflicts (Port 3000 or 5000 in Use)
- **Fix:** Run `powershell -ExecutionPolicy Bypass -File .\stop-wifi-server.ps1` to terminate dangling processes.

---

## 9. Changes Made & Reversion Procedure

### Files Modified:
1. **`backend/src/main.ts`:**
   - *Change:* Extended CORS validation in development mode to permit RFC 1918 private IP addresses.
   - *Reversion:* Revert lines 48–56 to check only `localhost` and `127.0.0.1`.
2. **`backend/.env`:**
   - *Change:* Appended `http://192.168.3.111:3000,http://192.168.3.111:5000` to `CORS_ORIGIN`.
   - *Reversion:* Remove the IP origin from `CORS_ORIGIN`.

### Files Added:
1. `PROJECT_TECH_STACK_AUDIT.md`: Complete architectural audit report.
2. `start-wifi-server.ps1`: Automated multi-tier server launch script.
3. `stop-wifi-server.ps1`: Automated graceful shutdown script.
4. `LOCAL_WIFI_HOSTING_GUIDE.md`: This comprehensive hosting guide.

---

## 10. Verification & Test Matrix

| Test Case | Description | Target URL | Expected Result | Verified Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Localhost Web UI | `http://localhost:3000` | HTTP 200 OK | **PASSED** |
| **TC-02** | Localhost API Health | `http://localhost:5000/api/health` | HTTP 200, `database: connected` | **PASSED** |
| **TC-03** | LAN Web UI | `http://192.168.3.111:3000` | HTTP 200 OK | **PASSED** |
| **TC-04** | LAN API Health | `http://192.168.3.111:5000/api/health` | HTTP 200, `database: connected` | **PASSED** |
| **TC-05** | LAN Wi-Fi CORS | Origin: `http://192.168.3.111:3000` | HTTP 200 + `Access-Control-Allow-Origin` | **PASSED** |
| **TC-06** | Next.js API Rewrite | `http://192.168.3.111:3000/api/health` | Proxied to NestJS with HTTP 200 | **PASSED** |
| **TC-07** | Production Web Build | `next build` | Zero compile errors | **PASSED** |
| **TC-08** | Production Backend Build | `nest build` | Zero compile errors | **PASSED** |
| **TC-09** | Remote Device Access | Physical second device test | Access via phone browser | **UNVERIFIED (Requires physical device)** |

> [!NOTE]
> All automated tests from the host machine to its local network interface (`192.168.3.111`) passed with full 200 OK status. Direct verification from a physical secondary device on Wi-Fi remains unverified as it requires manual physical interaction from your phone or tablet.
