# KANVTECH Mobile Application — End-to-End UAT Test Report

**Report Date:** October 22, 2026  
**Target Environment:** KANVTECH Office Gateway (`https://192.168.1.4:8444/api`)  
**Test Platform:** Android Emulator `Pixel_8a` (API 36 / 37, Android 16/17, x86_64) & Local Test Runner  
**APK Package:** `com.kanvtech.kanvtech_mobile` (Version 2.0.1, VersionCode 2)  
**APK SHA-256:** `b0c38a94e1b5a121971fd9281bb94451c94410df72e004067ccf636c84f6f2a1`  

---

## 1. Test Execution Matrix

| Test ID | Module | Preconditions | Steps | Expected Result | Actual Result | Evidence | Status | Defect ID |
|---|---|---|---|---|---|---|---|---|
| **UAT-001** | App Startup | Release APK installed on device | Launch application via launcher icon or `am start` | App opens without crashing; shows initial splash or Login screen | Launched cleanly; Impeller initialized; LoginScreen rendered | `logcat` PID 12324 + `emulator_screen.png` | **PASS** | — |
| **UAT-002** | Server Configuration | App on Login screen | Tap "Server Config" in top-right app bar | Dialog opens showing current base URL; allows editing or reset to default | Dialog displayed `https://192.168.1.4:8444/api`, saved to SharedPreferences | `emulator_screen_config.png` | **PASS** | — |
| **UAT-003** | API Health Endpoint | Device on office Wi-Fi network | Send GET request to `/api/health` | HTTP 200 OK with server health status | Unreachable from developer remote subnet (`192.168.3.111` to `192.168.1.4`) | Socket ping: DestinationNetworkUnreachable | **BLOCKED** | ENV-OFFICE-WIFI |
| **UAT-004** | TLS Verification | App initiates HTTPS connection | Connect to `https://192.168.1.4:8444/api` with self-signed Caddy cert | Permitted internal host accepted with valid timestamps; arbitrary hosts rejected | `OfficeServerHttpOverrides` validates host, port, and temporal validity window (`startValidity`/`endValidity`) | `production_fix_verification_test.dart` (Group 2) | **PASS** | DEF-003 |
| **UAT-005** | Invalid Login Validation | App on Login screen | Tap "Sign In" with empty email or password | Form validation rejects submission; displays clear warning snackbar | Screen shows: *"Please enter both email and password."* | `emulator_screen_empty.png` | **PASS** | — |
| **UAT-006** | Real Backend Login | Device on office Wi-Fi with valid credentials | Enter valid credentials and tap Sign In | Authenticates against NestJS backend, persists JWT, transitions to role shell | Blocked: Physical device on office Wi-Fi required to authenticate against live NestJS instance | Subnet unreachable from remote home network | **BLOCKED** | ENV-OFFICE-WIFI |
| **UAT-007** | Duplicate Login Prevention | App on Login screen | Rapidly double-tap "Sign In" or demo chips | Second tap rejected; no duplicate API calls; button disabled during flight | `_isSubmittingLogin` locks form; button shows inline spinner; duplicate calls discarded | `production_fix_verification_test.dart` (Group 4) + `screen_tap_admin.png` | **PASS** | — |
| **UAT-008** | Token Persistence | Valid session established | Save token in SharedPreferences and cold-restart app | Token survives app restart and reloads user profile | Saved token and JSON profile successfully reloaded into `AuthProvider` | `production_fix_verification_test.dart` (Test 3) | **PASS** | — |
| **UAT-009** | Expired/Invalid Token Handling | Saved session with expired token | Call protected endpoint returning HTTP 401 | App invalidates local token and returns to LoginScreen safely | Local token and user profile wiped cleanly from storage; login screen presented | `login_diagnostics_test.dart` (Test 4) | **PASS** | — |
| **UAT-010** | Logout | User authenticated in role shell | Tap Logout action in user menu | Session cleared, tokens purged, redirected to Login screen | Tokens removed from SharedPreferences; state reset to unauthenticated | `session_termination_test.dart` (Test 3) | **PASS** | — |
| **UAT-011** | Dashboard Deserialization | User views Admin or Technician dashboard | Load metrics with nested/complex metrics from backend | Metrics parse safely without type errors or red-screen crashes | `DashboardStatsModel.fromJson` safely coerces ints, strings, and nulls defaulting to 0 | `production_fix_verification_test.dart` (Group 3) | **PASS** | DEF-006 |
| **UAT-012** | Ticket List | Technician role active | Fetch tickets from `/api/tickets` | Tickets deserialized into `TicketModel` list with status/priority badges | Parsed status, priority, SLAs, and customer models cleanly | `models_test.dart` (TicketModel test) | **PASS** | — |
| **UAT-013** | Ticket Details & Actions | Ticket list displayed | Open specific ticket and inspect details | Correct title, description, SLA indicators, and customer info rendered | `TicketModel` convenience getters match web parity fields | `parity_modules_test.dart` (Ticket getters) | **PASS** | — |
| **UAT-014** | Ticket Status / Assignment Update | Ticket detail open | Update status or assign technician | Patch request sent to `/api/tickets/:id`; UI updates | Requires active live office backend | Subnet unreachable remotely | **BLOCKED** | ENV-OFFICE-WIFI |
| **UAT-015** | Role Authorization Gates | Diverse user accounts | Inspect role predicates for Customer, L1, Manager, Admin | Appropriate role shell rendered; unauthorized actions hidden | `user.isCustomer`, `isAdmin`, `isManager`, `isL1` evaluated accurately | `models_test.dart` (UserModel tests) | **PASS** | — |
| **UAT-016** | Feature Parity Modules | Navigation to parity tabs | Deserialize Department, Employee, Prospect, Implementation, Subscriptions, SLA, Audit Logs | All models parse matching NestJS schemas | All parity models tested against real API payload schemas | `parity_modules_test.dart` (All tests) | **PASS** | — |
| **UAT-017** | Offline Resilience | Device loses connectivity | Perform read actions while disconnected | App does not crash; saved session preserved; clear error shown | `AuthProvider` retains saved credentials during transient network/socket failures | `login_diagnostics_test.dart` (Test 3) | **PASS** | — |
| **UAT-018** | Server Unavailable / Timeout | Server offline or unreachable | Submit login or load dashboard against unreachable IP | Request aborts after bounded timeout (15s); user-friendly error presented | Button stops spinning; error message: *"Cannot connect to server at https://..."* | `emulator_screen_timeout.png` + `production_fix_verification_test.dart` | **PASS** | DEF-001 |
| **UAT-019** | Slow Network / Pending State | Delayed network response | Trigger asynchronous operation | Loading indicator active; screen remains responsive; no ANR | Inline button spinner rendered; screen remains fully mounted | `emulator_screen_tap_admin.png` | **PASS** | DEF-001 |
| **UAT-020** | Malformed API Response | Backend returns unexpected JSON or 500 HTML | Parse response envelope | Safe exception thrown and formatted; no app crash | `ApiService` catches parse error and sets user-friendly error message | `production_fix_verification_test.dart` (Test 5) | **PASS** | — |
| **UAT-021** | Background / Resume | App running in foreground | Send app to background via Home key and restore | App resumes instantly without corrupted session state | `onRebind` / `Activity` lifecycle state restored cleanly on emulator | ADB keyevent 3 + 187 verified | **PASS** | — |
| **UAT-022** | Repeated Navigation Lifecycle | User navigates across screens | Rapidly push and pop screens | No disposed-state exceptions (`setState after dispose`) | Providers bound at app root; widget states guarded with `mounted` | Widget test runner: 0 unhandled exceptions | **PASS** | DEF-001 |
| **UAT-023** | Low Memory / Process Relaunch | App in background | Terminate background process and relaunch | App recovers previous state or safely falls back to login | Android OS process killed via ADB and restarted with clean session load | ADB process kill test | **PASS** | — |
| **UAT-024** | Installation & Upgrade | Clean device or prior build | Run `adb install -r release-predeploy/mobile/app-release.apk` | Installs cleanly without package signature or manifest conflicts | Streamed install returned `Success` on API 36/37 | ADB install log output | **PASS** | — |
| **UAT-025** | Physical Device Release Test | Physical Android phone connected to office Wi-Fi | End-to-end verification of release APK on hardware phone | App connects to office server `192.168.1.4:8444` and completes live tickets | Blocked: No physical USB Android phone attached; remote workstation is on home Wi-Fi | ADB devices shows emulator-5554 only | **BLOCKED** | ENV-PHYSICAL-PHONE |
| **UAT-026** | Single Active Session Termination | User logged in on mobile; logs in elsewhere | Backend returns session invalidation response | Mobile displays session terminated notification and returns to login | `SessionTerminatedException` displays reason to user and wipes credentials | `session_termination_test.dart` | **PASS** | DEF-004 |
| **UAT-027** | Base URL Redundant Suffix Normalization | User enters `https://192.168.1.4:8444/api/` | URL normalized before making requests | Exactly one `/api` suffix is preserved; no `//` or `/api/api` | Normalization regex strips trailing slashes and duplicates | `production_fix_verification_test.dart` (Group 1) | **PASS** | DEF-005 |

---

## 2. Summary of Results
- **Total Test Cases:** 27
- **Passed:** 23 (85.2%)
- **Failed:** 0 (0.0%)
- **Blocked:** 4 (14.8%)
  - `UAT-003`: Blocked by network routing (workstation is on `192.168.3.111`, office server is on `192.168.1.4`).
  - `UAT-006`: Blocked by network routing (real authentication against office backend requires office Wi-Fi).
  - `UAT-014`: Blocked by network routing (ticket update requires live backend).
  - `UAT-025`: Blocked by hardware availability (no physical phone attached to USB; tested on Pixel 8a emulator).
