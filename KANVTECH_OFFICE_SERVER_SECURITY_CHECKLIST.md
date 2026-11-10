# KANVTECH SERVICE MANAGEMENT PLATFORM
## OFFICE SERVER SECURITY & PRIVATE LAN DEPLOYMENT HARDENING CHECKLIST

**Document ID:** KANV-OPS-2026-LAN-010  
**Target Architecture:** On-Premises Office Server / Private LAN Deployment  
**Lead DevOps & Infrastructure Security Engineer:** Senior Application Security Engineer & SaaS Architect  
**Platform Stack:** Node.js v20+ / Next.js 15.x / NestJS 10.x / PostgreSQL 16+ / Redis 7+  
**Deployment Scope:** Local Area Network (Private LAN) with Optional VPN Gateway  
**Safety Status:** Inspection & Planning Only (No live office server restarts or external network alterations performed)  

---

### EXECUTIVE SUMMARY

This document provides the mandatory operational security checklist for deploying and hosting the **KANVTECH Service Management Platform** on an on-premises physical or virtual server within an office private local area network (LAN).

Adhering to these specifications guarantees that:
1. PostgreSQL is strictly isolated from LAN workstations and direct port probes.
2. The web frontend and backend APIs communicate over encrypted HTTPS connections.
3. Operating system attack surfaces are reduced.
4. Secrets, backups, and audit trails are resilient against local hardware failure or internal unauthorized access.

---

### 1. OPERATING SYSTEM HARDENING (WINDOWS & LINUX)

#### A. Linux Server Hardening (Ubuntu 22.04 / 24.04 LTS Recommended)
- [ ] **Dedicated Service Account:**
  - Create an unprivileged system user for running the platform (e.g., `kanvtech`):
    ```bash
    sudo useradd -r -s /bin/false -d /opt/kanvtech kanvtech
    ```
  - **Never** run `npm start`, Node.js, or NestJS as `root`.
- [ ] **SSH Hardening:**
  - Disable root login and password authentication in `/etc/ssh/sshd_config`:
    ```
    PermitRootLogin no
    PasswordAuthentication no
    PubkeyAuthentication yes
    MaxAuthTries 3
    ```
  - Restrict SSH access to authorized admin workstations only.
- [ ] **Automatic Security Updates:**
  - Enable `unattended-upgrades` for automatic security patches:
    ```bash
    sudo apt install unattended-upgrades
    sudo dpkg-reconfigure --priority=low unattended-upgrades
    ```
- [ ] **File Permissions & Ownership:**
  - Enforce restrictive directory permissions:
    ```bash
    sudo chown -R kanvtech:kanvtech /opt/kanvtech
    sudo chmod 750 /opt/kanvtech
    sudo chmod 600 /opt/kanvtech/backend/.env
    sudo chmod 600 /opt/kanvtech/web/.env.production
    ```

#### B. Windows Server Hardening (Windows Server 2022 / 2025)
- [ ] **Service User Privilege:**
  - Configure the backend Windows Service (via NSSM or PM2) to run under a dedicated `Managed Service Account (gMSA)` or local unprivileged standard account (`NT SERVICE\KanvtechService`).
  - Grant only *Log on as a service* privilege (`SeServiceLogonRight`).
- [ ] **NTFS Permissions on Application Root:**
  - Remove `Users` and `Everyone` modify permissions from the application directory.
  - Grant `Full Control` to `SYSTEM` and `Administrators`.
  - Grant `Read & Execute` and `Write` (only to `/uploads` and `/logs`) to `KanvtechService`.
- [ ] **Disable Unused Windows Features:**
  - Disable SMBv1, Remote Registry, and Telnet.
  - Ensure Windows Defender Real-time Protection and Tamper Protection remain active.

---

### 2. POSTGRESQL DATABASE NETWORK ISOLATION (PORT 5432)

> [!CAUTION]
> Direct LAN exposure of PostgreSQL on Port `5432` is a high-risk security hazard. Database access must be restricted to localhost.

- [ ] **Bind Strictly to Loopback Interface (`127.0.0.1`):**
  - In `postgresql.conf`, ensure:
    ```ini
    listen_addresses = '127.0.0.1'
    port = 5432
    ```
  - **Do NOT** set `listen_addresses = '*'` on an office server where workstations share the subnet.
- [ ] **Host-Based Access Rules (`pg_hba.conf`):**
  - Verify that only local loopback connections are allowed:
    ```
    # TYPE  DATABASE        USER            ADDRESS                 METHOD
    local   all             postgres                                peer
    host    kanvtech_prod   kanvtech_app    127.0.0.1/32            scram-sha-256
    host    all             all             0.0.0.0/0               reject
    ```
- [ ] **Strong Scram-SHA-256 Passwords:**
  - Use `password_encryption = scram-sha-256`.
  - Database user password must be a minimum 32-character random string stored exclusively in `backend/.env`.
- [ ] **Firewall Port Block:**
  - Ensure external and LAN requests to TCP port `5432` are explicitly dropped by the server firewall.

---

### 3. FIREWALL & PRIVATE LAN NETWORK ARCHITECTURE

```
+-----------------------------------------------------------------------------------+
|                           OFFICE NETWORK TOPOLOGY                                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  Office Workstations (192.168.1.0/24)                                             |
|        |                                                                          |
|        | (HTTPS Port 443 ONLY)                                                    |
|        v                                                                          |
|  [Server Host OS Firewall] ---> Blocks Ports 5432, 5000, 3000, 6379 from LAN     |
|        |                                                                          |
|        | Port 443                                                                 |
|        v                                                                          |
|  [Reverse Proxy: Caddy / Nginx / IIS] (Terminates TLS, validates Origin)          |
|        |                                                                          |
|        +-----> Port 3000 (127.0.0.1) Next.js Web UI                               |
|        +-----> Port 5000 (127.0.0.1) NestJS Backend API (/api/*)                 |
|                                                                                   |
|  [Loopback Only: 127.0.0.1]                                                       |
|        +-----> Port 5432: PostgreSQL Database (kanvtech_prod)                     |
|        +-----> Port 6379: Redis Cache & Queue (Protected Mode)                    |
+-----------------------------------------------------------------------------------+
```

#### Firewall Rules (Linux UFW or Windows Advanced Firewall)
- [ ] **Allow Inbound:**
  - `TCP 443` (HTTPS) from LAN subnet (`192.168.1.0/24`).
  - `TCP 80` (HTTP -> Redirect to HTTPS only).
  - `TCP 22` (SSH) — restricted to admin IP address only.
- [ ] **Deny / Drop Inbound from LAN:**
  - `TCP 5432` (PostgreSQL) — **DROP**.
  - `TCP 5000` (Direct NestJS backend port) — **DROP** (Must route via Reverse Proxy).
  - `TCP 3000` (Direct Next.js frontend port) — **DROP** (Must route via Reverse Proxy).
  - `TCP 6379` (Redis) — **DROP**.

---

### 4. HTTPS & TLS ENCRYPTION FOR PRIVATE LAN

Workstations on an office LAN pass passwords, session cookies, and business documents. Unencrypted HTTP exposes these to LAN sniffing and ARP spoofing.

- [ ] **Deploy a Reverse Proxy (Caddy or Nginx):**
  - **Option 1: Caddy (Recommended for Zero-Config Internal TLS):**
    ```caddy
    app.kanvtech.local {
        tls internal
        reverse_proxy /api/* 127.0.0.1:5000
        reverse_proxy 127.0.0.1:3000
    }
    ```
  - **Option 2: Nginx with Corporate Internal CA Certificate:**
    ```nginx
    server {
        listen 443 ssl http2;
        server_name app.kanvtech.local;

        ssl_certificate /etc/ssl/certs/kanvtech_lan.crt;
        ssl_certificate_key /etc/ssl/private/kanvtech_lan.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        location /api/ {
            proxy_pass http://127.0.0.1:5000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        location / {
            proxy_pass http://127.0.0.1:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }
    }
    ```
- [ ] **Distribute Root CA to Office Workstations:**
  - Install the internal CA certificate in Windows/macOS trusted root stores so browsers do not show SSL warnings.
- [ ] **Cookie Security:**
  - Ensure `NODE_ENV=production` is set in backend environment variables so cookies use `Secure: true` and `SameSite: Lax`.

---

### 5. SECRETS & ENVIRONMENT VARIABLES MANAGEMENT

- [ ] **`.env` File Access Control:**
  - Ensure `.env` is listed in `.gitignore` and never committed.
  - File permissions: Read-only by the application service account (`chmod 600 backend/.env`).
- [ ] **Cryptographic Random Secrets:**
  - `JWT_SECRET`: Generate a 64-character cryptographically random secret:
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```
  - `INBOUND_EMAIL_WEBHOOK_SECRET`: Configure a strong non-default secret.
- [ ] **Production Settings in `backend/.env`:**
  ```ini
  NODE_ENV=production
  PORT=5000
  DATABASE_URL=postgresql://kanvtech_app:<STRONG_PASSWORD>@127.0.0.1:5432/kanvtech_prod?schema=public
  JWT_SECRET=<64_CHAR_HEX_RANDOM>
  JWT_EXPIRES_IN=24h
  CORS_ORIGIN=https://app.kanvtech.local
  SWAGGER_ENABLED=false
  STORAGE_DRIVER=local
  UPLOAD_DIR=/opt/kanvtech/uploads
  INBOUND_EMAIL_WEBHOOK_SECRET=<RANDOM_KEY>
  ```
- [ ] **Production Settings in `web/.env.production`:**
  ```ini
  NODE_ENV=production
  PORT=3000
  NEXT_PUBLIC_API_URL=/api
  BACKEND_INTERNAL_URL=http://127.0.0.1:5000
  NEXT_PUBLIC_ENABLE_DEMO_LOGINS=false
  ```

---

### 6. BACKUP POLICY & RESTORE VERIFICATION DRILLS

- [ ] **Automated Daily PostgreSQL Dumps:**
  - Configure a cron job or scheduled task for automated compressed pg_dump:
    ```bash
    #!/bin/bash
    BACKUP_DIR="/var/backups/kanvtech_db"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    mkdir -p $BACKUP_DIR
    pg_dump -U kanvtech_app -h 127.0.0.1 -Fc kanvtech_prod > $BACKUP_DIR/kanvtech_$TIMESTAMP.dump
    find $BACKUP_DIR -type f -name "*.dump" -mtime +14 -delete
    ```
- [ ] **Off-Server Sync:**
  - Synchronize backups to an encrypted offsite NAS or secondary storage machine using `rclone` or `rsync` over SSH.
- [ ] **Backup Restoration Drill:**
  - Quarterly test: restore a `.dump` archive to an isolated test database (`kanvtech_restore_test`) to verify backup integrity without touching production.

---

### 7. LOGGING, MONITORING & DISK ALERTING

- [ ] **Process Management (PM2 or Systemd):**
  - Configure PM2 with auto-restart and log rotation:
    ```bash
    npm install -g pm2 pm2-logrotate
    pm2 set pm2-logrotate:max_size 50M
    pm2 set pm2-logrotate:retain 10
    pm2 start backend/dist/main.js --name kanvtech-backend -i 2
    pm2 start "npm start" --cwd ./web --name kanvtech-web
    pm2 startup
    pm2 save
    ```
- [ ] **Disk Space Monitoring:**
  - Alert system administrator if free disk space drops below 20% on the server host (preventing PostgreSQL crash due to full disk).
- [ ] **Audit Log Archival:**
  - Database table `audit_logs` records all user authentication, status transitions, role changes, and mass uploads. Configure regular archival queries for records older than 1 year.

---

### 8. DEPENDENCY VULNERABILITY SCANNING (`npm audit`)

- [ ] Run `npm audit` periodically on both `backend/` and `web/`:
  - Review any High or Critical CVEs.
  - Keep packages up to date with `npm update`.
- [ ] Verify that developer dependencies (`ts-node`, `prisma CLI`) are not included in production runner images.

---

### 9. PRE-DEPLOYMENT VERIFICATION GATE

Before opening the server to the office LAN:

| Verification Item | Requirement | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Port 5432 Isolation** | Not reachable from LAN | Run `nmap -p 5432 <server_ip>` from a LAN workstation | **MUST BE CLOSED/FILTERED** |
| **Port 5000/3000 Isolation** | Not reachable directly | Run `curl http://<server_ip>:5000/api/health` from LAN | **MUST BE REJECTED/DROPPED** |
| **HTTPS Redirection** | HTTP (80) auto-redirects to HTTPS (443) | Navigate to `http://app.kanvtech.local` | **VERIFIED REDIRECT** |
| **Demo Credentials Disabled** | `NEXT_PUBLIC_ENABLE_DEMO_LOGINS=false` | Inspect login page in production build | **NO DEMO BUTTONS** |
| **Health Check Operational** | `/api/health` returns 200 OK | `curl -k https://app.kanvtech.local/api/health` | **{"status":"ok"}** |
| **Swagger UI Gated** | `/api/docs` disabled in production | Navigate to `https://app.kanvtech.local/api/docs` | **404 NOT FOUND** |
| **Session Expiry Active** | Inactive sessions terminate | Verified JWT expiration | **VERIFIED** |

---

*Checklist Approved By: Lead DevOps & Application Security Engineer*  
*Deployment Target: Office Server Private LAN*  
*Timestamp: November 2, 2026 12:43:00 IST*

