# KANVTECH Mobile Application — Physical Device Testing Guide

**Document Purpose:** Guide for field engineers and QA to execute the physical-device and on-premise Wi-Fi tests that are blocked in remote development environments.

---

## 1. Prerequisites

1. **Hardware:** Physical Android smartphone or tablet running Android 8.0 (API 26) through Android 15/16.
2. **Network Connection:** Connect the phone to the **office Wi-Fi network** (same LAN where the office server PC is on `192.168.1.4`).
3. **Verified APK Artifact:**
   - Path: `release-predeploy/mobile/app-release.apk`
   - Expected SHA-256: `b0c38a94e1b5a121971fd9281bb94451c94410df72e004067ccf636c84f6f2a1`

---

## 2. Network Pre-Verification (From Mobile Browser)

Before launching the app, verify that the mobile device can reach the server's HTTPS gateway:

1. Open **Google Chrome** on the mobile phone.
2. Navigate to:  
   `https://192.168.1.4:8444/api/health`
3. If Chrome presents a "Your connection is not private" warning (due to the self-signed Caddy certificate), tap **Advanced** -> **Proceed to 192.168.1.4**.
4. Confirm that the browser displays:
   ```json
   {"status":"ok","timestamp":"..."}
   ```
   *(If this does not load, the phone is either not on the same Wi-Fi network or the office server firewall is blocking inbound port 8444).*

---

## 3. Installation Steps

### Option A: Install via Android Debug Bridge (ADB)
1. Enable **Developer Options** and **USB Debugging** on the Android phone.
2. Connect the phone to your computer via USB.
3. Open a terminal in the project directory:
   ```bash
   adb devices
   ```
   *(Ensure your device appears as `device`).*
4. Install the release APK:
   ```bash
   adb install -r release-predeploy/mobile/app-release.apk
   ```

### Option B: Direct Sideloading
1. Transfer `release-predeploy/mobile/app-release.apk` to the phone via USB cable, Google Drive, or local file share.
2. Open the **Files** app on the phone, tap `app-release.apk`, and allow installation from unknown sources if prompted.

---

## 4. Manual Test Execution Checklist

### Test 1: Cold Launch & Default Configuration (UAT-001 & UAT-002)
1. Tap the **Kanvtech** app icon.
2. Confirm the app launches cleanly without crashing.
3. Tap **Server Config** in the top-right corner.
4. Verify the Base API URL is:  
   `https://192.168.1.4:8444/api`
5. If different, enter `https://192.168.1.4:8444/api` and tap **Save**.

### Test 2: Live Backend Authentication (UAT-006)
1. Under **DEMO ACCOUNTS (ONE-TOUCH)**, tap **Admin** (or enter your authorized office credentials).
2. Observe the Sign In button:
   - Button shows a circular progress indicator.
   - Screen remains mounted.
3. Expected Outcome:
   - The app authenticates against `https://192.168.1.4:8444/api/auth/login`.
   - The app transitions cleanly into the **Admin Shell** (`AdminDashboardScreen`).

### Test 3: Dashboard & Live Ticket Workflow (UAT-011, UAT-012, UAT-014)
1. On the Admin or Technician dashboard:
   - Verify that metrics (Active Tickets, Open Tickets, Resolved Tickets) render real numerical data without any red crash screen.
2. Tap on the **Tickets** tab:
   - Verify that real tickets load from the office database.
3. Tap on a ticket to view details:
   - Check customer name, priority badge, and SLA countdown.
4. Change the ticket status (e.g. from Open to In Progress) or add a comment:
   - Verify that the change persists upon refreshing the ticket list.

### Test 4: Role-Based Navigation (UAT-015)
1. Tap the menu and tap **Logout**.
2. Tap **Customer** on the login screen:
   - Verify that the app opens the **Customer Shell** displaying only customer-permitted views.
3. Logout and tap **L1 Specialist**:
   - Verify that the app opens the **Technician Shell** with ticket queue and assignment tabs.

### Test 5: Single Active Session Termination (UAT-026)
1. With the mobile app logged in as `admin@kanvtech.com`, open a computer browser and log into the web portal (`https://192.168.1.4:8444`) with `admin@kanvtech.com`.
2. Return to the mobile app and perform any action (e.g. refresh ticket list).
3. Expected Outcome:
   - A notification dialog appears stating: *"Your session was terminated because this account was logged into from another device."*
   - Tapping OK returns the user safely to the Login screen.

---

## 5. Capturing Logs in Case of Discrepancies

If any issue occurs during testing on the physical device, capture timestamped logcat:
```bash
adb logcat -d -v time *:E > physical_device_error.log
```
Check for:
- `CERTIFICATE_VERIFY_FAILED` (indicates certificate mismatch or system clock error).
- `SocketException: Connection refused` (indicates server service is stopped or port 8444 is blocked).
- `SocketException: Network is unreachable` (indicates phone disconnected from office Wi-Fi).
