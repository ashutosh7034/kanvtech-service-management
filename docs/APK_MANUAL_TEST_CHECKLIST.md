# KANVTECH Mobile Application — Manual Android Testing Checklist

**Document Version:** 1.0  
**Target APK:** `mobile/build/app/outputs/flutter-apk/app-release.apk`  
**Application ID:** `com.kanvtech.kanvtech_mobile`  
**Version:** `2.0.0` (Build `1`)  
**SHA-256 Checksum:** `047595809d7310243f063b60896f1fc7b2a0bf6132ee01ec88c1ecaf1978dd7a`  

---

## 1. Physical Device Setup Instructions

### 1.1 Enable Developer Options & USB Debugging
1. On your Android phone, navigate to **Settings** > **About Phone**.
2. Tap **Build Number** 7 times until you see the prompt: *"You are now a developer!"*.
3. Go back to **Settings** > **System** > **Developer Options**.
4. Enable **USB Debugging**.
5. Enable **Install via USB** (if prompted by OEM: Xiaomi, Oppo, Vivo, Samsung).

### 1.2 Transfer & Install APK
#### Method A: Direct ADB Install (Recommended for PC connection)
Connect the Android phone to your PC via USB cable, authorize the debugging prompt on the phone screen, and run:
```powershell
adb devices
adb install -r "mobile\build\app\outputs\flutter-apk\app-release.apk"
```

#### Method B: Direct File Transfer / Sideload
1. Copy `mobile/build/app/outputs/flutter-apk/app-release.apk` to your phone's **Downloads** folder (via USB file transfer, Google Drive, or local HTTP transfer).
2. Open the **Files** app on your phone, locate `app-release.apk`, and tap to install.
3. If prompted, allow **Install Unknown Apps** for your file browser.
4. Tap **Install** and then **Open**.

### 1.3 Connecting Phone to Backend API
When testing on a physical phone connected over local Wi-Fi:
1. Ensure your PC running the NestJS backend (`port 5000`) and the phone are on the same Wi-Fi network.
2. Find your PC's local Wi-Fi IP address (e.g. run `ipconfig` -> `192.168.1.XXX`).
3. Launch the Kanvtech app on your phone.
4. On the **Sign In** screen, tap **Server Config** at the top right.
5. Enter: `http://<YOUR_PC_IP>:5000/api` (e.g., `http://192.168.1.15:5000/api`).
6. Tap **Save**.

---

## 2. Comprehensive Test Checklist

### Section A: App Installation & Launch Stability
- [ ] **A.1 Sideload Installation:** APK installs without parse error or signature mismatch block.
- [ ] **A.2 Cold Launch:** App launches from home screen icon ("Kanvtech Service") without crash.
- [ ] **A.3 Splash & Branding:** Title "KANVTECH Service Management Platform" is clearly visible.
- [ ] **A.4 Memory & Orientation:** App survives screen rotation (portrait to landscape and back).
- [ ] **A.5 Backgrounding:** Minimizing the app and returning resumes the existing screen state.

---

### Section B: Authentication & Session Management
- [ ] **B.1 Demo Account Chips:** Tapping each demo chip fills email and signs in:
  - [ ] Customer (`customer@kanvtech.com`)
  - [ ] L1 Specialist (`l1@kanvtech.com`)
  - [ ] L2 Specialist (`l2@kanvtech.com`)
  - [ ] L3 Specialist (`l3@kanvtech.com`)
  - [ ] Manager (`manager@kanvtech.com`)
  - [ ] Admin (`admin@kanvtech.com`)
- [ ] **B.2 Invalid Credentials:** Entering wrong password shows a clear, non-crashing error message.
- [ ] **B.3 Empty Field Validation:** Submitting empty inputs prompts user to enter work email.
- [ ] **B.4 Logout Flow:** Tapping the logout icon on AppBar terminates session and returns to Sign In.
- [ ] **B.5 Token Persistence:** Closing and reopening app while logged in maintains active session.
- [ ] **B.6 Single Active Session Alert:** Logging in on a second device flags or invalidates the previous session gracefully.

---

### Section C: Role-Based Dashboard & KPIs
- [ ] **C.1 Admin Dashboard:** Displays Real-Time KPIs (Active Tickets, Total Tickets, SLA Breached, Auto-Route Tier).
- [ ] **C.2 Manager Dashboard:** Displays workload queues, team allocation summaries, and resolution approvals.
- [ ] **C.3 Technician Dashboard (L1/L2/L3):** Displays assigned ticket queue, priority badges, and quick-action buttons.
- [ ] **C.4 Customer Dashboard:** Displays active tickets submitted by the customer's company and "+ New Ticket" action.
- [ ] **C.5 Pull-to-Refresh:** Pulling down on dashboard refreshes live numbers from API without lag.

---

### Section D: Ticket Workflow & Details
- [ ] **D.1 Ticket List Filter Bar:** Horizontal status filters (`ALL`, `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`) scroll smoothly without layout overflow.
- [ ] **D.2 Status Badge Styling:** Badges display correct background and text colors matching web theme:
  - [ ] `CRITICAL` / `BREACHED` (Red / Destructive)
  - [ ] `HIGH` / `ESCALATED` (Amber / Warning)
  - [ ] `IN_PROGRESS` (Blue / Info)
  - [ ] `RESOLVED` / `CLOSED` (Emerald / Success)
- [ ] **D.3 SLA Counter & Countdown:** Time remaining or breached status displays accurately.
- [ ] **D.4 Ticket Detail Navigation:** Tapping a ticket card opens detailed view with description, history, and assigned technician.
- [ ] **D.5 Create Ticket Form:** Submitting a new ticket validates title, priority, and problem description.

---

### Section E: Master Data & Management Modules
- [ ] **E.1 Navigation Drawer:** Hamburger icon opens drawer showing user name, email, and role badge.
- [ ] **E.2 Customer Master Directory:**
  - [ ] List of companies loads with contact names and phone numbers.
  - [ ] Active/Inactive status toggle operates without crash.
  - [ ] Search bar filters company list dynamically.
  - [ ] "+ New Company" dialog opens, accepts company name/contact, and saves.
- [ ] **E.3 Department Master:** Displays department cards, employee headcount, and manager name without text overflow.
- [ ] **E.4 Specialist Employee Directory:** Displays specialists with level badges (`L1`, `L2`, `L3`) and assigned ticket counts.
- [ ] **E.5 Resolution Approvals:** Review list of pending approvals with sign-off and rejection dialogs.

---

### Section F: Visual Hierarchy, Typography & Responsive UI
- [ ] **F.1 Narrow Screen Parity:** No yellow/black overflow stripes (`RenderFlex overflowed by X pixels`) on any screen.
- [ ] **F.2 Card Elevation & Borders:** Clean slate borders (`#E2E8F0` / dark mode `#334155`) with rounded corners (`12px` / `16px`).
- [ ] **F.3 Soft Keyboard Handling:** Tapping text input fields scrolls the view up (`adjustResize`) without obscuring the input.
- [ ] **F.4 Empty States:** Displays friendly empty state illustration and text when queues have zero items.
- [ ] **F.5 Loading States:** Centered circular progress indicator renders while waiting for network requests.

---

## 3. Defect Reporting Template

If a defect is observed during manual testing, record it using this standard structure:

```markdown
### Defect ID: MOB-XXX
- **Screen:** (e.g. Ticket Detail Screen)
- **Role:** (e.g. L2 Specialist)
- **Device & Android Version:** (e.g. Samsung Galaxy S23, Android 14)
- **Steps to Reproduce:**
  1. Login as L2 Specialist
  2. Open Ticket #KT-1042
  3. Tap 'Reassign Ticket'
- **Expected Behavior:** Modal opens allowing selection of L3 specialist.
- **Actual Behavior:** Yellow RenderFlex overflow banner appears on right edge.
- **Screenshot / Logcat snippet:** (Attach image or logcat stack trace)
```
