# KANVTECH Mobile Application — Android APK Build and Test Report

**Execution Date:** 2026-10-19  
**Execution Timestamp:** 2026-10-19 16:13:25 IST (10:43:25 UTC)  
**Git Branch:** `feature/kanvtech-mobile-update`  
**Application ID:** `com.kanvtech.kanvtech_mobile`  
**Application Version:** `2.0.0` (Build Number: `1`)  
**Target Build Mode:** Android Testing Release APK (`flutter build apk --release`)  

---

## 1. Build Verification & Deliverables Summary

| Field | Measurement / Value |
| :--- | :--- |
| **Build Status** | **PASS** (Exit Code 0) |
| **Output APK Path** | `mobile/build/app/outputs/flutter-apk/app-release.apk` |
| **APK File Size** | 55,127,484 bytes (52.57 MB) |
| **Build Timestamp** | `2026-10-19T10:43:23.998Z` |
| **SHA-256 Checksum** | `047595809d7310243f063b60896f1fc7b2a0bf6132ee01ec88c1ecaf1978dd7a` |
| **Canonical Backup** | `mobile/build/app/outputs/flutter-apk/app-release-canonical-backup.apk` |
| **Canonical Backup Size**| 53,402,640 bytes (50.93 MB) |
| **Canonical SHA-256** | `480195e594d8c55eebe6cfea03278c6736a6f18c427d264bc2a8c7ed7d22428b` |

---

## 2. Environment & Toolchain Details

- **Operating System:** Windows 11 Enterprise (26H2, Build 26300.9711)
- **Flutter SDK:** Flutter 3.47.5 (channel `stable`)
- **Dart SDK:** Dart 3.13.4 (DevTools 2.60.0)
- **Android SDK:** Version 36.1.0 (`C:\Users\Ashutosh Pandey\AppData\Local\Android\Sdk`)
- **Android Build Tools:** `34.0.0` / `36.0.0`
- **Android Gradle Plugin (AGP):** `8.11.1`
- **Gradle Version:** `8.14`
- **Kotlin Version:** `2.2.20`
- **Java Virtual Machine:** OpenJDK 17 (`JavaVersion.VERSION_17`)

---

## 3. Static Analysis & Test Execution Results

### 3.1 Static Code Analysis (`flutter analyze`)
- **Command:** `& 'C:\src\flutter\bin\flutter.bat' analyze`
- **Working Directory:** `mobile`
- **Exit Code:** `0`
- **Duration:** 53.8 seconds
- **Output:**
  ```text
  Analyzing mobile...
  No issues found! (ran in 53.8s)
  ```
- **Result:** **PASS** (Zero compile errors, zero warnings, zero linter hints).

### 3.2 Automated Test Suite (`flutter test`)
- **Command:** `& 'C:\src\flutter\bin\flutter.bat' test`
- **Working Directory:** `mobile`
- **Exit Code:** `0`
- **Execution Summary:** 18 passing tests across 4 test suites:
  1. `parity_modules_test.dart` (8 tests):
     - DepartmentModel parses correctly
     - EmployeeDetailModel parses specialist level and availability
     - ProspectModel parses inquiries and sales pipeline
     - ImplementationModel parses stages and tasks
     - SubscriptionModel parses AMC validity and days remaining
     - AuditLogModel parses security events
     - SlaConfigModel parses response and resolution limits
     - TicketModel convenience getters match web parity fields
  2. `models_test.dart` (6 tests):
     - UserModel Customer role parsing
     - UserModel L1 Technician role parsing
     - UserModel Manager role parsing
     - UserModel Admin role parsing
     - TicketModel workflow rules and active ticket limits
     - Master data Company and Branch deserialization
  3. `session_termination_test.dart` (3 tests):
     - SessionTerminatedException carries required message
     - AuthProvider clears credentials and sets session termination message
     - Logout clears session terminated message and local tokens
  4. `widget_test.dart` (1 test):
     - Kanvtech mobile app renders login screen and demo chips
- **Result:** **PASS** (`00:01 +18: All tests passed!`)

---

## 4. Release Build Execution (`flutter build apk --release`)

- **Command:** `& 'C:\src\flutter\bin\flutter.bat' build apk --release`
- **Execution Duration:** 116.3 seconds
- **Exit Code:** `0`
- **Gradle Task:** `:app:assembleRelease`
- **Asset Tree Shaking:** `MaterialIcons-Regular.otf` tree-shaken from 1,645,184 to 12,844 bytes (99.2% reduction).
- **AAPT Badging Inspection:**
  - Package Name: `com.kanvtech.kanvtech_mobile`
  - Version Code: `1`
  - Version Name: `2.0.0`
  - Min SDK Version: `24`
  - Target SDK Version: `36`
  - Uses Permissions:
    - `android.permission.INTERNET`
    - `android.permission.ACCESS_NETWORK_STATE`
    - `com.kanvtech.kanvtech_mobile.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`
  - Application Label: `Kanvtech Service`
  - Launchable Activity: `com.kanvtech.kanvtech_mobile.MainActivity`

---

## 5. Live Installation & Emulator Testing

### 5.1 Target Test Device
- **Device Identifier:** `emulator-5554`
- **Product / Model:** `sdk_gphone16k_x86_64` (Google Pixel 8a AVD)
- **Android OS:** Android 16 (API Level 36, 16k page size kernel)
- **Status:** Connected (`device`)

### 5.2 Sideload Installation (`adb install -r`)
- **Command:** `adb -s emulator-5554 install -r "mobile\build\app\outputs\flutter-apk\app-release.apk"`
- **Result:** `Performing Streamed Install` -> `Success` (Exit Code 0)
- **Signature Compatibility:** Compatible with debug key; no signing conflicts or app replacement blocks encountered.

### 5.3 Runtime Verification
1. **Application Launch & Startup Stability:**
   - Command: `adb -s emulator-5554 shell am start -n com.kanvtech.kanvtech_mobile/.MainActivity`
   - Result: Instant launch without native crash or Flutter red screen.
   - Screenshot Evidence: `docs/apk-evidence/01_apk_fresh_launch.png`.
2. **Session Termination & Logout Flow:**
   - Action: Tapped top-right exit action on AppBar.
   - Result: Session terminated cleanly, redirected immediately to `LoginScreen`.
   - Screenshot Evidence: `docs/apk-evidence/02_apk_login_screen.png`.
3. **Environment & Server Configuration:**
   - Action: Opened "Server Config" dialog.
   - Verified Endpoint: `http://127.0.0.1:5000/api` active with `adb reverse tcp:5000 tcp:5000`.
   - Screenshot Evidence: `docs/apk-evidence/03_apk_server_config.png`.
4. **Authentication & Role Loading:**
   - Action: Tapped 1-touch demo chip for "Admin".
   - Result: Backend authenticated user `admin@kanvtech.com`, stored JWT securely, loaded Admin dashboard with real KPIs.
   - Screenshot Evidence: `docs/apk-evidence/04_apk_admin_dashboard.png`.
5. **App Drawer & Navigation:**
   - Action: Opened hamburger navigation drawer.
   - Result: All Operations, Organization Master, and Client Services links populated with correct role badges and icons.
   - Screenshot Evidence: `docs/apk-evidence/05_apk_app_drawer.png`.
6. **Master Data Module Loading:**
   - Action: Navigated to "Customer Master Directory".
   - Result: Loaded companies from local PostgreSQL staging database via NestJS REST API. Active toggles, search input, and FAB rendered cleanly.
   - Screenshot Evidence: `docs/apk-evidence/06_apk_customer_directory.png`.

---

## 6. Verified Fixed Issues & Known Deficiencies

### 6.1 Verified Fixes in this Build
1. **Status Badge Consistency:** Reusable status badge component dynamically maps all workflow states (`QUEUED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REOPENED`, `PENDING`) using theme tokens.
2. **Horizontal Filter Bar Overflow:** Wrapped horizontally scrolling chip bars in `SingleChildScrollView`.
3. **Department & Approval Card Overflow:** Replaced fixed-width columns with `Flexible` and single-line ellipsis truncation.
4. **API Response Payload Parsing:** Added robust unwrapping for `{ data: [...] }` and direct array response structures in `ApiService`.
5. **Session Invalidation Handling:** Automated dialog and redirect when a token is invalidated on secondary devices.

### 6.2 Remaining Limitations & Unresolved Issues
1. **Real Physical Hardware Testing:** Tested on official Android emulator (`emulator-5554`). Physical device sideloading requires USB debugging or web distribution (instructions provided below).
2. **Firebase Push Notifications:** The application currently relies on in-app polling; Google FCM push notifications are not configured in this build.
3. **Release Keystore Signing:** Build uses standard test debug signing keys for manual testing. Production Play Store release will require a dedicated private keystore and `key.properties`.

---

## 7. Mandatory Safety Boundary Confirmation

- **No Remote Deployment:** No code or APK was deployed to any external server.
- **Production Database Safe:** Production PostgreSQL port 5432 was never opened or accessed. Staging database was isolated to local port 5433.
- **Office Production Server Safe:** No network packets or HTTP requests were directed to `https://192.168.1.4:8444`.
- **Git Branch Preserved:** The active branch remains strictly `feature/kanvtech-mobile-update`. No `git commit`, `git push`, `git checkout`, or `git merge` commands were executed.
- **Canonical APK Preserved:** The original pre-existing APK was backed up to `app-release-canonical-backup.apk` prior to build execution.
- **Zero Secrets Exposed:** No passwords, private keys, or tokens were printed to logs or documentation.
