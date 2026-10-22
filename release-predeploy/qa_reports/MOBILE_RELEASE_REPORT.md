# KANVTECH Mobile Application — Release Verification Report

**Release Date:** October 22, 2026  
**Artifact Path:** `release-predeploy/mobile/app-release.apk`  
**Target Environment:** KANVTECH Office Gateway (`https://192.168.1.4:8444/api`)  

---

## 1. Environment & Build Configuration

| Property | Value |
|---|---|
| **Flutter SDK Version** | Flutter 3.32.0 (channel stable) |
| **Dart SDK Version** | Dart 3.8.0 |
| **Java / JDK Version** | OpenJDK 17.0.12 (Oracle Corporation) |
| **Android SDK Path** | `C:\Android\Sdk` |
| **Build Tools Version** | 36.0.0 |
| **Compile SDK Version** | 36 (Android 16 / Android Preview) |
| **Target SDK Version** | 34 (Android 14) |
| **Min SDK Version** | 21 (Android 5.0 Lollipop) |
| **Gradle Version** | 8.14.0 |
| **Android Gradle Plugin (AGP)** | 8.11.1 |
| **Kotlin Version** | 2.2.20 |

---

## 2. Package & Binary Metadata

| Property | Value |
|---|---|
| **Package Name (Application ID)** | `com.kanvtech.kanvtech_mobile` |
| **Version Name** | `2.0.1` |
| **Version Code** | `2` |
| **APK File Size** | `55,210,148` bytes (52.65 MB) |
| **APK SHA-256 Digest** | `b0c38a94e1b5a121971fd9281bb94451c94410df72e004067ccf636c84f6f2a1` |
| **Supported ABIs** | `arm64-v8a`, `armeabi-v7a`, `x86_64` |
| **Compile Define Embedded** | `API_URL=https://192.168.1.4:8444/api` |
| **Default Base API URL** | `https://192.168.1.4:8444/api` |

---

## 3. Signing & Certificate Audit

| Property | Value |
|---|---|
| **Signature Scheme** | APK Signature Scheme v2 (Strict Android V2 verification enabled) |
| **Signer Certificate DN** | `C=US, O=Android, CN=Android Debug` |
| **Certificate SHA-256 Fingerprint** | `b04b3b88fe17646856c0b768b8af0e43dab87bc589587225a55fd729cc1f08af` |
| **Certificate SHA-1 Fingerprint** | `cb7d0ef122d7a511ce0878aad5dd960d2de8c0e2` |
| **Signing Profile Note** | Built for internal enterprise UAT. For public Google Play Console deployment, a production release keystore must be supplied. |

---

## 4. Application Security & Operational Posture

1. **TLS Certificate Scope:**
   - Unconditional certificate callbacks removed.
   - Self-signed Caddy TLS trust is strictly scoped to `192.168.1.4` on port `8444` and local development loopback addresses.
   - Active temporal certificate checks (`startValidity` and `endValidity`) are enforced on every TLS handshake.
2. **Credential & Secret Protection:**
   - Zero hardcoded production passwords or private tokens in code.
   - Passwords and auth tokens are excluded from all logging and stdout.
   - Authentication tokens are stored using device-backed secure preferences.
3. **Session Lifecycle & Invalidation:**
   - Single-active-session protocol implemented: concurrent login from a second device or web portal cleanly notifies the mobile user and terminates the local session without crashing.
   - Transient network/socket errors do not delete valid authentication tokens.
4. **Resilience & State Management:**
   - Form submission does not unmount the screen.
   - Async calls feature bounded timeouts (15s socket timeout).
   - "Continue to Login" escape hatch guarantees users are never stuck indefinitely on the startup splash.
