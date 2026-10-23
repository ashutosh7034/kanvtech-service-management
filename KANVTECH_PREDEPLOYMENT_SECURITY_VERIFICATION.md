# KANVTECH SERVICE MANAGEMENT PLATFORM
## PRE-DEPLOYMENT SECURITY VERIFICATION REPORT

**Date of Execution:** October 23, 2026  
**Auditor / Roles:** Senior Application Security Engineer, Flutter/Android Engineer, Backend Engineer, Web Engineer, QA Lead & Release-Readiness Auditor  
**Local Environment:** Developer PC (Windows / PowerShell)  
**Target Repository:** `https://github.com/ashutosh7034/kanvtech-service-management.git`  
**Inspected Reference Commit:** `3ec57f3`  
**Execution Scope:** Local Developer PC Only (No office server access, no database modifications, no automatic Git commit/push)  
**Release Readiness Decision:** **READY FOR CONTROLLED TESTING** (Pending physical-device & office-network environment verification)

---

## 1. EXECUTIVE SUMMARY

An independent security hardening and pre-deployment verification audit was conducted on the KANVTECH Service Management Platform across its three core pillars: **Flutter Android Mobile App**, **Next.js Web Frontend**, and **NestJS/Node.js Backend**.

### Key Outcomes:
1. **Password Persistence & Autofill Completely Eliminated on Android:** Verified that the mobile application previously had a vulnerability where passwords could be persisted in local storage (`kanvtech_saved_password`) and prefilled on the login screen. This vulnerability was **completely eradicated**. `getSavedPassword()` was removed from `AuthProvider`, password prefilling was removed from `LoginScreen`, and active backward-compatible purging was implemented across `_loadSession()`, `login()`, and `logout()` to delete any legacy stored passwords from both `FlutterSecureStorage` and `SharedPreferences`.
2. **Android Cleartext Networking Hardened:** Confirmed that `AndroidManifest.xml` had `android:usesCleartextTraffic="true"` and `network_security_config.xml` permitted cleartext globally. This has been remediated: `usesCleartextTraffic` was removed from the manifest, `base-config` sets `cleartextTrafficPermitted="false"`, the office server endpoint `192.168.1.4` (which operates on HTTPS 8444) has `cleartextTrafficPermitted="false"`, and cleartext exceptions are strictly isolated to emulator/local loopbacks (`127.0.0.1`, `10.0.2.2`, `localhost`).
3. **Remember Me Architecture Standardized:** "Remember Me" now strictly means **token-based session persistence** (30-day token lifetime) across app restarts without ever caching the user's password. Unchecked Remember Me enforces non-persistent session lifecycles (24-hour token duration; storage cleared on app cold boot). Email prefill is preserved as a convenience without compromising credential security.
4. **Full Automated Test Pass & Production Compilation:**
   - Flutter Static Analysis: **0 issues found** (`flutter analyze`).
   - Flutter Automated Tests: **All 47 tests passed** (`flutter test`), including new security regression tests.
   - Web TypeScript & Next.js Build: **0 type errors**, optimized static/dynamic production build compiled successfully (`npm run build`).
   - Backend Authentication Suite: **All 6 Remember Me & session tests passed** (`remember-me-auth.spec.ts`).
   - Release APK Compilation: Successfully built release APK (54.9 MB) at `mobile/build/app/outputs/flutter-apk/app-release.apk` (SHA-256: `64467BF1082355BC7D7FF619E5080D841B5C82FA9581EDA51F7BBED8212E0D60`).
5. **Release Signing & Hygiene Constraints Maintained:** In strict compliance with the safety rules, existing tracked release artifacts in Git were preserved, no production keystores were generated or committed, no remote servers or databases were touched, and no Git commits or pushes were executed.

---

## 2. ACTUAL REPOSITORY AND COMMIT INFORMATION

- **Repository Root:** `c:\Users\Ashutosh Pandey\Downloads\Kanvtech service management`
- **Current Git Branch:** `main`
- **Current Head Commit:** `3ec57f3` (`docs(audit): integrate comprehensive QA validation, root cause, and mobile UI/UX audit reports`)
- **Remote Configuration:**
  - `origin https://github.com/ashutosh7034/kanvtech-service-management.git (fetch)`
  - `origin https://github.com/ashutosh7034/kanvtech-service-management.git (push)`
- **Commit Lineage:**
  - `3ec57f3` (HEAD -> main) docs(audit): integrate comprehensive QA validation...
  - `24df60e` fix(auth): resolve Remember Me credential persistence and session duration across Android and Web
  - `ecc03f4` feat: official KANVTECH branding, fast-track login, remember me, and safe repo cleanup
  - `571a4bc` fix(mobile): resolve auth state teardown, session loading, and TLS bounds with full UAT report
  - `f70f692` Merge branch 'feature/kanvtech-mobile-update'

---

## 3. BASELINE FINDINGS

| Component | Audited Area | Observed Baseline State | Risk Assessment | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile** | Password Storage | `AuthProvider` maintained `kanvtech_saved_password` in `FlutterSecureStorage` and `login_screen.dart` prefilled `_passwordController`. | **CRITICAL**: Plaintext password cached locally on device; accessible if device compromised or via backup. | **DEFECT CONFIRMED & REMEDIATED** |
| **Mobile** | Cleartext Traffic | `AndroidManifest.xml` had `android:usesCleartextTraffic="true"`; `network_security_config.xml` permitted cleartext globally. | **HIGH**: Potential MitM vulnerability on public Wi-Fi networks if HTTP endpoints were contacted. | **DEFECT CONFIRMED & REMEDIATED** |
| **Mobile** | Session Restoration | Restored 30-day token when `kanvtech_mobile_remember_me == true`. Suppressed restoration when `false`. | Standard token-based session persistence; working as intended. | **PASS** |
| **Mobile** | Release Signing | `build.gradle.kts` uses debug signing config for release build type (`signingConfig = signingConfigs.getByName("debug")`). | **MEDIUM**: Debug-signed APKs cannot be published to Google Play or enterprise MDM without resign. | **INFORMATIONAL (DOCUMENTED)** |
| **Web** | Storage & Passwords | `AuthContext.tsx` uses `localStorage` for 30d remembered token, `sessionStorage` for 24h unremembered token. Passwords NEVER stored. | Compliant with web security standards; no password exposure. | **PASS** |
| **Web** | Cookies | `HttpOnly`, `SameSite=lax`, `Path=/`, `maxAge=30d` (remembered) or session-cookie (unremembered). | Robust server-side session cookies. | **PASS** |
| **Backend** | Session Invalidation | `activeSessionId` checked against JWT `sessionId` claim; logout clears active session. | Proper single-session and explicit revocation mechanics. | **PASS** |

---

## 4. REMEMBER ME BEHAVIOR BEFORE AND AFTER

### A. Remember Me Enabled (`rememberMe: true`)

| Platform | Before Hardening | After Hardening |
| :--- | :--- | :--- |
| **Android Mobile** | Token saved to secure storage & prefs; **plaintext password saved to secure storage**; email saved to prefs. On app restart: session restored via token. On explicit logout: email & **saved password remained and prefilled password field**. | Token saved to secure storage & prefs; **password NEVER saved**. On app launch: session restored via token without prompting for credentials. On explicit logout: tokens wiped, **password field remains empty**, corporate email pre-filled for convenience. |
| **Web Frontend** | JWT stored in `localStorage` (`kanvtech_token`); email stored in `kanvtech_remembered_email`; cookie set with 30-day `maxAge`. No passwords stored. | **Maintained**: Token stored in `localStorage`; cookie set with 30-day `maxAge`; passwords never touch client storage; email prefilled on login screen. |
| **Backend API** | JWT issued with `30d` expiration (`2,592,000` seconds); `sessionId` registered in user session record. | **Maintained**: Expiry verified via `remember-me-auth.spec.ts`. |

### B. Remember Me Disabled (`rememberMe: false`)

| Platform | Before Hardening | After Hardening |
| :--- | :--- | :--- |
| **Android Mobile** | Persistent storage wiped; `kanvtech_mobile_remember_me = 'false'`. On app cold boot: session restoration skipped, forcing manual login. | **Maintained & Hardened**: Storage wiped; `kanvtech_saved_password` proactively purged from both `FlutterSecureStorage` and `SharedPreferences`. |
| **Web Frontend** | Token stored strictly in `sessionStorage`; `localStorage` wiped; session cookie set (omitting `maxAge`, destroyed on browser close). | **Maintained**: Complete session-only isolation. Disappears upon browser tab/window closure. |
| **Backend API** | JWT issued with `24h` expiration (`86,400` seconds). | **Maintained**: Expiry verified via `remember-me-auth.spec.ts`. |

### C. Explicit Logout

| Platform | Mechanism & Verification | Status |
| :--- | :--- | :--- |
| **Android Mobile** | Calls `/api/auth/logout`, wipes `kanvtech_mobile_token`, `kanvtech_mobile_user`, and unlinks local state. Unconditionally deletes `kanvtech_saved_password`. Does not wipe `kanvtech_remembered_email` if Remember Me was selected. Password field is reset to empty. | **PASS** |
| **Web Frontend** | Calls `/api/auth/logout`, clears `kanvtech_token` from both `localStorage` and `sessionStorage`, clears user context, redirects to `/login`. | **PASS** |
| **Backend API** | Nullifies `activeSessionId` for the user in the database, invalidating the current JWT `sessionId`. Subsequent authenticated calls with the old token reject with `401 Unauthorized` / `SESSION_TERMINATED`. | **PASS** |

---

## 5. ANDROID PASSWORD-PERSISTENCE CORRECTION

### Verified Vulnerability:
In previous builds, `mobile/lib/providers/auth_provider.dart` contained a helper `getSavedPassword()` that read `kanvtech_saved_password` from `FlutterSecureStorage`, and `mobile/lib/screens/login_screen.dart` in `_loadRememberedState()` populated `_passwordController.text` with the saved password.

### Implementation Fix:
1. **Removed `getSavedPassword()`:** Deleted the method from `AuthProvider`.
2. **Removed Password Prefill:** In `login_screen.dart`, deleted lines 46–54 that fetched and populated `_passwordController.text`. The password field now always initializes empty and obscured.
3. **Active Migration & Obsolete Key Purging:**
   - In `_loadSession()`: Added unconditional deletion of `kanvtech_saved_password` from both `SharedPreferences` and `FlutterSecureStorage` before any early-returns.
   - In `login()`: Added explicit deletion of `kanvtech_saved_password` regardless of whether `rememberMe` is true or false.
   - In `logout()`: Added explicit deletion of `kanvtech_saved_password` from both stores.
4. **Automated Verification:** Added Group 8 in `mobile/test/production_fix_verification_test.dart` and assertions in `mobile/test/widget_test.dart` verifying that legacy password keys are purged and the password field remains empty upon state restoration.

---

## 6. WEB SESSION AND COOKIE VERIFICATION

### Audited Files:
- `web/src/context/AuthContext.tsx`
- `web/src/pages-components/auth/LoginPage.tsx`
- `web/src/services/api/client.ts`

### Findings:
1. **No Password Storage:** The web frontend never writes passwords to `localStorage`, `sessionStorage`, or cookies. Password input values exist solely in React component state during submission.
2. **Session Storage Isolation:** When Remember Me is unchecked, the token is stored strictly in `sessionStorage` and immediately purged from `localStorage`.
3. **Cookie Configuration:** The backend sets the `kanvtech_token` cookie with:
   - `HttpOnly: true` (prevents XSS exfiltration).
   - `SameSite: 'lax'` (protects against cross-site request forgery).
   - `Path: '/'`.
   - `maxAge: 30 * 24 * 60 * 60 * 1000` (when Remember Me is true) or omitted (session cookie when false).
4. **Client-Side Authorization:** Route guards check `user` and `token` state, and all sensitive API calls are enforced by NestJS JWT guards on the backend.

---

## 7. BACKEND SESSION AND LOGOUT VERIFICATION

### Audited Files:
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/jwt.strategy.ts`
- `backend/test/remember-me-auth.spec.ts`

### Findings:
1. **Token Duration:**
   - `rememberMe: true` -> JWT `expiresIn: '30d'` (verified duration: `2,592,000` seconds).
   - `rememberMe: false` -> JWT `expiresIn: '24h'` (verified duration: `86,400` seconds).
2. **Single Active Session & Revocation:**
   - Every login generates a unique `sessionId` embedded in the JWT payload and saved to the database.
   - On `/api/auth/logout`, `authService.logout(userId)` clears the user's active session.
   - If a token is presented whose `sessionId` does not match the active session in the database, the backend throws an unauthorized exception (`SESSION_TERMINATED`), terminating unauthorized replay of previous sessions.
3. **Expired Token Rejection:** Verified that expired tokens fail cryptographic validation and reject with `TokenExpiredError`.

---

## 8. CLEARTEXT NETWORKING AND TLS REVIEW

### Audited Files:
- `mobile/android/app/src/main/AndroidManifest.xml`
- `mobile/android/app/src/main/res/xml/network_security_config.xml`
- `mobile/lib/services/http_overrides.dart`
- `mobile/lib/services/api_service.dart`

### Remediated Configuration:
1. **`AndroidManifest.xml`:** Removed `android:usesCleartextTraffic="true"` from the `<application>` tag.
2. **`network_security_config.xml`:**
   - Global Base Config: `<base-config cleartextTrafficPermitted="false">` (enforces HTTPS by default across the entire application).
   - Office Server Domain: `<domain-config cleartextTrafficPermitted="false"><domain includeSubdomains="true">192.168.1.4</domain>...</domain-config>`. Cleartext HTTP is strictly forbidden for the office server.
   - Development Loopbacks: `<domain-config cleartextTrafficPermitted="true">` is strictly confined to emulator loopback addresses: `127.0.0.1`, `10.0.2.2`, and `localhost`.
3. **TLS Verification Architecture:**
   - The production endpoint is `https://192.168.1.4:8444/api`.
   - `OfficeServerHttpOverrides` strictly checks host and port:
     ```dart
     static bool isPermittedHost(String host, int port, {String? configuredBaseUrl})
     ```
   - Only `192.168.1.4` on port `8444` and local loopback addresses are permitted for internal self-signed TLS certificates; arbitrary external domains (e.g., `google.com`, external hosts) are rejected, preventing general TLS bypass.

---

## 9. ANDROID RELEASE-SIGNING STATUS

### Configuration Review:
- File: `mobile/android/app/build.gradle.kts`
- Current Configuration:
  ```kotlin
  buildTypes {
      release {
          signingConfig = signingConfigs.getByName("debug")
      }
  }
  ```

### Release Status:
- **Current Signing:** Android Debug Key.
- **Suitability:** **Suitable for internal QA sideloading and controlled testing.**
- **Production Gate:** **BLOCKED for formal public distribution or Google Play release.**
- **Action Required by Authorized Administrator:**
  1. Generate a production keystore (e.g., `kanvtech-release.keystore`) on a secure machine.
  2. Create a secure, non-committed `key.properties` file in `mobile/android/`:
     ```properties
     storePassword=SECURE_STORE_PASSWORD
     keyPassword=SECURE_KEY_PASSWORD
     keyAlias=kanvtech-key-alias
     storeFile=../kanvtech-release.keystore
     ```
  3. Update `build.gradle.kts` to load `key.properties` for production release signing.

---

## 10. GIT ARTIFACT HYGIENE

### Audit of Tracked APK:
- Tracked File: `release-predeploy/mobile/app-release.apk`
- Tracked SHA-256 Hash: `F762AEEFCFD838EDB774D0DDE2DBBD51F0B13892DAD4F43B0032C5C505AE376E`
- Size: ~54.9 MB (tracked in Git history from commit `24df60e`/`3ec57f3`).
- Newly Compiled Test APK: `mobile/build/app/outputs/flutter-apk/app-release.apk` (SHA-256: `64467BF1082355BC7D7FF619E5080D841B5C82FA9581EDA51F7BBED8212E0D60`).

### Git Safety Adherence:
- **No Git history rewriting:** In strict adherence to Safety Rule 10, no `git filter-repo`, `rebase`, or force-push was performed.
- **Tracked File Preserved:** `release-predeploy/mobile/app-release.apk` was untouched to preserve published Git tree integrity.
- **Future Recommendation:** Transition binary distribution to GitHub Releases or an enterprise artifact repository, and add `*.apk` to `.gitignore` for future commits once authorized by repository owners.

---

## 11. FILES CHANGED AND REASONS

| File Path | Nature of Change | Justification |
| :--- | :--- | :--- |
| `mobile/lib/providers/auth_provider.dart` | Code Edit | Removed `getSavedPassword()`. Added unconditional purging of `kanvtech_saved_password` from both `SharedPreferences` and `FlutterSecureStorage` in `_loadSession()`, `login()`, and `logout()`. |
| `mobile/lib/screens/login_screen.dart` | Code Edit | Removed lines that retrieved and prefilled `_passwordController.text`. Password field always starts empty. |
| `mobile/android/app/src/main/AndroidManifest.xml` | Code Edit | Removed `android:usesCleartextTraffic="true"`, preventing unencrypted cleartext HTTP traffic. |
| `mobile/android/app/src/main/res/xml/network_security_config.xml` | Code Edit | Configured `<base-config cleartextTrafficPermitted="false">` and set `192.168.1.4` to `cleartextTrafficPermitted="false"`. Scoped cleartext strictly to localhost/emulator loopbacks. |
| `mobile/test/widget_test.dart` | Test Update | Added assertions verifying that restored Remember Me state leaves `_passwordController` empty while preserving corporate email. |
| `mobile/test/production_fix_verification_test.dart` | Test Update | Added Group 8 test suite verifying that obsolete saved password keys are purged during initialization, login, and logout. |

---

## 12. REGRESSION TESTS ADDED

### 1. `mobile/test/production_fix_verification_test.dart` — Group 8: Password Security & Obsolete Credential Purging
- **Test 1:** `Obsolete saved password key is purged during session initialization and never stored` — Verifies that any legacy `kanvtech_saved_password` in storage is wiped on startup while `kanvtech_remembered_email` is preserved.
- **Test 2:** `Login attempt unconditionally deletes obsolete saved password key` — Verifies that attempting login actively purges obsolete saved password entries.
- **Test 3:** `Logout unconditionally ensures no saved password exists` — Verifies that logging out purges tokens and ensures no saved password exists in storage.

### 2. `mobile/test/widget_test.dart`
- **Assertion:** `expect(passwordField.controller?.text.isEmpty ?? true, isTrue);` — Validates that UI state initialization populates work email but strictly leaves the password controller empty.

---

## 13. COMMANDS EXECUTED AND ACTUAL RESULTS

```powershell
# 1. Flutter Static Analysis
C:\src\flutter\bin\flutter.bat analyze
# Result: Exit code 0 ("No issues found! (ran in 2.8s)")

# 2. Flutter Unit & Widget Test Suite
C:\src\flutter\bin\flutter.bat test
# Result: Exit code 0 ("All tests passed! 47 passed")

# 3. Flutter Release APK Build
C:\src\flutter\bin\flutter.bat build apk --release --dart-define=API_URL=https://192.168.1.4:8444/api
# Result: Exit code 0 ("√ Built build\app\outputs\flutter-apk\app-release.apk (54.9MB)")

# 4. Web TypeScript Type Validation
npx tsc --noEmit
# Result: Exit code 0 (0 errors)

# 5. Web Next.js Production Build
npm run build
# Result: Exit code 0 ("Compiled successfully", "Generating static pages (5/5)", 0 errors)

# 6. Backend Remember Me Auth Spec
npx ts-node test/remember-me-auth.spec.ts
# Result: Exit code 0 ("BACKEND VERIFICATION SUMMARY: Passed: 6, Failed: 0")

# 7. Git Status & Log Verification
git status
git log -n 5 --oneline
# Result: Exit code 0 (Branch main at commit 3ec57f3, only 6 intentional mobile files modified, uncommitted)
```

---

## 14. BUILD AND TEST RESULTS

| Suite | Component | Tests Run | Result | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| `flutter analyze` | Mobile | Static check | **PASS** | 0 warnings, 0 errors |
| `widget_test.dart` | Mobile UI | 7 tests | **PASS** | Obscured empty password verified |
| `production_fix_verification_test.dart` | Mobile Logic | 16 tests | **PASS** | Password purging & network overrides verified |
| `session_termination_test.dart` | Mobile Session | 5 tests | **PASS** | Invalidation & message display verified |
| `login_diagnostics_test.dart` | Mobile Diagnostics| 7 tests | **PASS** | Transient offline resilience verified |
| `parity_modules_test.dart` | Mobile Models | 12 tests | **PASS** | Data models deserialization verified |
| **Total Flutter Tests** | **Mobile** | **47 tests** | **PASS** | **100% Passing** |
| `tsc --noEmit` | Web | Static types | **PASS** | 0 type errors |
| `npm run build` | Web | Next.js prod | **PASS** | 5 static pages compiled |
| `remember-me-auth.spec.ts` | Backend | 6 tests | **PASS** | 30d/24h tokens & cookies verified |

---

## 15. REMAINING RISKS AND BLOCKERS

1. **Physical Device Validation (Pending):** Sideloading the newly generated APK on a physical Android handset connected to the office Wi-Fi is required to confirm biometric/autofill compatibility and UI rendering on vendor-specific Android OS skins.
2. **Office Network Connectivity Gate (Pending):** Because office server access was strictly prohibited during this audit, actual round-trip HTTPS negotiation to `https://192.168.1.4:8444/api` remains **PENDING OFFICE ENVIRONMENT VERIFICATION**.
3. **Android Release Keystore (Pending Production Gate):** The APK is signed with Android Debug keys. A formal company keystore must be configured prior to production distribution.

---

## 16. MANUAL TEST PROCEDURE FOR AN AUTHORIZED TEST DEVICE

When an authorized engineer installs `mobile/build/app/outputs/flutter-apk/app-release.apk` on a physical test phone:

1. **Install APK:**
   ```bash
   adb install -r mobile/build/app/outputs/flutter-apk/app-release.apk
   ```
2. **Verify Password Non-Persistence:**
   - Launch app. Check "Remember Me (30-day session)".
   - Enter email and password. Sign in.
   - Tap profile -> "Logout".
   - **Verification:** Confirm that Work Email is prefilled, but the **Password field is completely empty**.
3. **Verify Session Restoration:**
   - Sign in with Remember Me checked.
   - Force close the application (swipe away from recent apps).
   - Reopen the application.
   - **Verification:** App should immediately open to Dashboard without presenting the Login screen.
4. **Verify Session Revocation:**
   - Log in from Web Portal using the same account.
   - On the mobile app, perform a pull-to-refresh.
   - **Verification:** App should detect session invalidation, display "Session terminated: active on another device", and return to Login screen.

---

## 17. OFFICE-ENVIRONMENT VERIFICATION REQUIREMENTS

Prior to production deployment on the office server (`192.168.1.4`):
1. **Network Connectivity:** Verify that port `8444` is accessible over internal office Wi-Fi from mobile devices.
2. **Caddy Reverse Proxy Certificate:** Verify that Caddy's internal TLS certificate is active and serves valid headers.
3. **Database Safeguard:** Ensure no migration or reset scripts are run against the PostgreSQL database.
4. **CORS Headers:** Confirm that the backend allows requests originating from the web portal domain.

---

## 18. SAFE DEPLOYMENT PREREQUISITES

1. Verification of the manual test procedure on an authorized Android test device.
2. Decision on production keystore generation and storage in CI/CD secrets.
3. Explicit sign-off from platform owners prior to committing or pushing the 6 modified files to GitHub `main`.

---

## 19. ROLLBACK CONSIDERATIONS

Because all changes are strictly confined to local working tree modifications on 6 mobile source files, rollback is instantaneous and risk-free:
```powershell
# To revert all local modifications to clean commit 3ec57f3:
git restore mobile/
```
No database migrations were executed, no backend APIs were altered in breaking ways, and no remote server configurations were changed.

---

## 20. FINAL RELEASE RECOMMENDATION

### Release Decision:
### **READY FOR CONTROLLED TESTING**

**Rationale:**  
All identified security vulnerabilities—including plaintext password persistence, password prefilling, and global cleartext Android networking—have been completely remediated. The codebase passes static analysis with 0 issues, passes all 47 Flutter unit/widget tests, passes the Next.js production build, and passes the backend authentication verification suite. The platform is ready for controlled deployment and testing on authorized physical devices in the office environment. Production Google Play release remains conditionally gated upon configuring the company's official release signing key.
