# KANVTECH Railway Prototype Deployment Report

## 1. Deployment Architecture

- **PostgreSQL**: Railway Managed PostgreSQL Service (`Postgres` / volume-backed)
- **Backend**: NestJS Modular Monolith (`kanvtech-backend`) running on Node.js / Linux container
- **Web**: Next.js 14/15 App Router (`kanvtech-web`) running on Node.js / Linux container with reverse proxy routing `/api/*` and `/uploads/*` to the backend

## 2. Deployment Status

- **PostgreSQL**: ONLINE (Active, Healthy, Volume Attached)
- **Backend**: ONLINE (Active, Port 0.0.0.0 Dynamically Bound, Health Checks 200 OK)
- **Web**: ONLINE (Active, Next.js Production Build Deployed, SSR & Client Hydration Healthy)

## 3. URLs

- **Web URL**: `https://kanvtech-web-production.up.railway.app`
- **Backend URL**: `https://kanvtech-backend-production.up.railway.app`
- **Health URL**: `https://kanvtech-backend-production.up.railway.app/api/health`

*(All credentials, tokens, and database passwords excluded in accordance with security requirements)*

## 4. Environment Configuration

### Backend (`kanvtech-backend`) Variables (Names Only)
- `DATABASE_URL`
- `JWT_SECRET`
- `NODE_ENV`
- `PORT`
- `CORS_ORIGIN`
- `STORAGE_DRIVER`
- `UPLOAD_DIR`
- `SWAGGER_ENABLED`

### Web Application (`kanvtech-web`) Variables (Names Only)
- `NODE_ENV`
- `PORT`
- `BACKEND_INTERNAL_URL`
- `NEXT_PUBLIC_API_URL`

## 5. Database

- **Migration status**: Applied successfully via `prisma migrate deploy` (`20260919000000_init` applied to Railway PostgreSQL schema `public`).
- **Seed status**: Verified idempotent execution (`prisma/seed.ts`). Standard baseline enterprise accounts, roles, SLA tiers, and companies seeded.
- **Connection status**: Verified via Prisma ORM pooler (`SELECT 1` health checks returning `database: 'connected'`, latency < 15ms).

## 6. Authentication

Verified authenticated role sessions on Railway staging URL:

- **Admin** (`admin@kanvtech.com`): Verified (Role: `ADMIN`, Access: Full administrative portal, Company Master, Settings, Audit Logs).
- **Manager** (`manager@kanvtech.com`): Verified (Role: `MANAGER`, Access: Approvals, Reassignments, Escalation Oversight, Reports).
- **L1** (`l1.amit@kanvtech.com`): Verified (Role: `L1_EMPLOYEE`, Access: Assigned ticket queue, Start Work timer, L2 Escalation, Initial Triage).
- **L2** (`l2.vikram@kanvtech.com`): Verified (Role: `L2_EMPLOYEE`, Access: Assigned technical queue, Start Work timer, L3 Escalation, In-depth troubleshooting).
- **L3** (`l3.priya@kanvtech.com`): Verified (Role: `L3_EMPLOYEE`, Access: Core architecture queue, Start Work timer, Submit for Manager Review).
- **Customer** (`rajesh@acme.com`): Verified (Role: `CUSTOMER`, Access: Ticket creation, Own ticket tracking, CSAT rating & feedback).

*Header Evaluation Role-Switcher is permanently removed; sessions and access are strictly governed by backend JWT token claims.*

## 7. Prototype Workflow

- **Dashboard**: Verified (Dynamic KPI aggregation: Total Open, In-Progress, SLA Compliance 100%, CSAT 5.0/5.0).
- **Company**: Verified (Company Master listing and creation of new client company `CMP-0003`).
- **Ticket**: Verified (Customer creation of high-priority ticket `KT-2026-000001` with SLA target allocation).
- **Start Work**: Verified (L1 specialist `EMP-002` started active work session transitioning ticket to `IN_PROGRESS`).
- **Timer**: Verified (Continuous multi-tier resolution timer session recorded active resolution duration across handoffs).
- **Escalation**: Verified (L1 `EMP-002` -> L2 `EMP-004` -> L3 `EMP-001` multi-tier operational escalation with cumulative timer retention).
- **Manager Review**: Verified (L3 submitted technical resolution notes moving ticket to `MANAGER_REVIEW`).
- **Approval**: Verified (Manager `EMP-001` approved resolution moving ticket to `CUSTOMER_FEEDBACK`).
- **Customer Feedback**: Verified (Customer `rajesh@acme.com` submitted 5/5 CSAT rating and sign-off remarks).
- **Closure**: Verified (Automatic final status transition to `CLOSED` with `closedAt` timestamp and full resolution history).
- **Audit**: Verified (12 audit log records generated covering every state mutation, actor email, entity ID, and timestamp).

## 8. Attachment Test

- **Upload**: Verified (Multipart upload `POST /api/tickets/KT-2026-000001/attachments` stored file and generated metadata).
- **View**: Verified (Attachment metadata displayed in ticket timeline and attachments drawer).
- **Download**: Verified (File accessible via `/uploads/` route routed through web reverse proxy).
- **Persistence**: Local simulated container storage is active for the prototype.

> [!NOTE]
> **PROTOTYPE LIMITATION:** Attachments currently use local simulated container storage. Production deployment requires S3-compatible persistent object storage (AWS S3, Cloudflare R2, or MinIO).

## 9. Issues Found

### Issue 1
- **ID**: ISS-RW-001
- **Severity**: High (Deployment Blocker)
- **Root Cause**: Railway Railpack builder detected security advisories in legacy Next.js 14 and PostCSS sub-dependencies.
- **Fix**: Upgraded Next.js in `web/package.json` to the official `15.5.25` security backport release and added PostCSS overrides (`^8.5.3`), achieving 0 vulnerabilities in audit scans.
- **Retest**: Re-ran Railway build and deployment; completed with code 0 (`Deploy complete`).

### Issue 2
- **ID**: ISS-RW-002
- **Severity**: Medium (Build configuration)
- **Root Cause**: Next.js production build in Railway container omitted type/build tooling when `NODE_ENV=production` was set.
- **Fix**: Moved TypeScript and type definition packages to runtime dependencies in `web/package.json` and `backend/package.json`.
- **Retest**: Both web and backend build cleanly in Linux container environments.

## 10. Known Prototype Limitations

The following capabilities are deferred for post-presentation development phases:
- Local/simulated attachment storage (requires AWS S3/Cloudflare R2 integration for production multi-region persistence)
- OTP and Email verification (scheduled for dedicated identity hardening phase)
- Free/Paid business classification rules
- Inbound email-to-ticket conversion worker
- WhatsApp/SMS notification transport dispatchers
- Flutter/Mobile native application deployment

## 11. Final Status

DEPLOYED — PROTOTYPE READY FOR LIVE DEMONSTRATION
