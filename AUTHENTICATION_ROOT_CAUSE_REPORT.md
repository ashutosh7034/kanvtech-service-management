# KANVTECH SERVICE MANAGEMENT PLATFORM — AUTHENTICATION ROOT CAUSE REPORT

**Report Date:** 2026-10-22  
**Platform Version:** 2.0.1  
**Investigation Target:** Production Mobile Login Troubleshooting (`"User does not exist. Please contact admin."`)  
**Target Environment:** Office Wi-Fi Production Gateway (`https://192.168.1.4:8444/api`)  
**Investigator:** Antigravity AI Senior Full-Stack & Security Engineer  

---

## 1. Executive Summary

A comprehensive, end-to-end trace of the KANVTECH authentication lifecycle was conducted across the Flutter mobile client (`mobile/`), the NestJS backend (`backend/`), and the live office gateway (`https://192.168.1.4:8444/api`).

### The Verified Root Cause
1. **Source of `"User does not exist. Please contact admin."`:**
   - In `backend/src/auth/auth.service.ts` (lines 42–54), the backend queries the database for the submitted email:
     ```typescript
     const user = await this.prisma.user.findFirst({
       where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
     });
     if (!user) {
       throw new UnauthorizedException('User does not exist. Please contact admin.');
     }
     ```
   - On the live office server (`https://192.168.1.4:8444`), the database is configured in clean production mode seeded via `prisma/seed.prod.ts`.
   - The production database contains **only** the primary administrator account (`admin@kanvtech.com`).
   - The five demo/test accounts (`manager@kanvtech.com`, `l1.amit@kanvtech.com`, `l2.vikram@kanvtech.com`, `l3.priya@kanvtech.com`, and `rajesh@acme.com`) were defined only in local development fixtures (`backend/scripts/seed-test-users.ts`) and **do not exist** in the production database.
   - Whenever any of these demo chips is selected on mobile, the backend returns HTTP 401 with `"User does not exist. Please contact admin."`.

2. **Status of `admin@kanvtech.com`:**
   - Live HTTPS probe confirmed that `admin@kanvtech.com` **does exist** in the live production database.
   - When tested against `https://192.168.1.4:8444/api/auth/login` with an incorrect password, the server does **not** return `"User does not exist"`; instead, it reaches line 62 and returns:
     ```json
     {"success":false,"error":"Invalid email or password","message":"Invalid email or password","statusCode":401}
     ```
   - Because the production password for `admin@kanvtech.com` was reportedly updated on the server, the outdated password (`Password@123` / `admin123`) fails password hash verification (`bcrypt.compare`).

3. **Status of Login Verification with New Password:**
   - **Status:** **BLOCKED**
   - In compliance with security policy, no credentials have been guessed, hardcoded, or committed. Login verification with the new administrator password is blocked until the system owner supplies the updated credential or verifies it directly on the device.

---

## 2. Authentication Flow Trace

```
[Mobile LoginScreen]
       │
       ▼ (User taps Sign In or Fast-Track Chip)
_emailController.text.trim() & _passwordController.text
       │
       ▼
[AuthProvider.login(email, password, rememberMe)]
       │
       ▼
[ApiService.login() -> HTTP POST https://192.168.1.4:8444/api/auth/login]
       │
       ▼
[NestJS AuthController.login()] (with LoginThrottlerGuard)
       │
       ▼
[AuthService.login()]
  1. normalizedEmail = email.trim().toLowerCase()
  2. prisma.user.findFirst({ where: { email: normalizedEmail } })
     ├── If user == null ───────────────► 401: "User does not exist. Please contact admin."
     ├── If !user.isActive ────────────► 401: "User account is inactive. Please contact Admin."
     └── bcrypt.compare(pass, user.passwordHash)
          ├── If !isMatch ─────────────► 401: "Invalid email or password"
          └── If match ────────────────► Generate activeSessionId -> Update User -> Return JWT + User
```

---

## 3. Live Server Connectivity & Security Verification

| Target Parameter | Value | Verification Method | Status |
|---|---|---|:---:|
| **Server Base URL** | `https://192.168.1.4:8444/api` | Direct HTTPS probe | **ONLINE (HTTP 200)** |
| **Database Connection** | PostgreSQL on office server | `/api/health` response | **CONNECTED** |
| **Server Uptime** | > 117,000 seconds (~32.6 hours) | `/api/health` JSON payload | **STABLE** |
| **TLS / SSL Trust** | Scoped self-signed cert for `192.168.1.4` | `HttpOverrides` via Dart / Python | **TRUSTED** |
| **`admin@kanvtech.com` Probe** | `POST /api/auth/login` | Probe with wrong password | **USER EXISTS** (Returns `Invalid email or password`) |
| **`manager@kanvtech.com` Probe** | `POST /api/auth/login` | Probe with wrong password | **USER ABSENT** (Returns `User does not exist`) |

---

## 4. Security Findings & Recommendations

### A. User Enumeration Exposure
- **Finding:** The backend returns different messages for non-existent users (`"User does not exist. Please contact admin."`) versus wrong passwords (`"Invalid email or password"`). This enables unauthenticated third parties to enumerate which email addresses exist in the corporate database.
- **Remediation:** 
  1. On the mobile client, sanitize all credential-related 401 responses into a consistent, safe, professional message:
     `"Invalid email or password. Please verify your credentials or contact your administrator."`
  2. For demo role buttons that target accounts not provisioned in the production environment, show a clear informational banner explaining that the demo account is not provisioned on the current server, and guide the user to enter their authorized corporate credentials.

### B. Credential Management for Fast-Track Buttons
- **Finding:** The fast-track buttons attempted to authenticate automatically using hardcoded development credentials (`Password@123`). When pressed against a production server where demo accounts were deliberately not seeded, they triggered confusing `"User does not exist"` or `"Invalid email or password"` errors.
- **Remediation:**
  - Fast-track buttons must act as **Quick-Fill Role Selectors** that pre-fill the role's canonical email and set focus to the password field.
  - If the user taps a demo role on a production server that returns `"User does not exist"`, the UI gracefully handles it as an unprovisioned test account rather than a platform defect.

---

## 5. Verification Status

| Category | Status | Details |
|---|:---:|---|
| **Root Cause Identification** | **VERIFIED** | Error originates from `auth.service.ts` line 53 because demo role accounts are unseeded in production DB. |
| **Live Server Reachability** | **VERIFIED** | `https://192.168.1.4:8444/api` is online, responsive, and connected to PostgreSQL. |
| **Admin Account Existence** | **VERIFIED** | `admin@kanvtech.com` exists in the connected production database. |
| **Updated Admin Password Verification** | **BLOCKED** | New password not provided in environment. Password verification will occur when authorized owner enters new password. |
| **TLS Certificate Validation** | **VERIFIED** | Scoped TLS validation active; no insecure global certificate bypass. |
