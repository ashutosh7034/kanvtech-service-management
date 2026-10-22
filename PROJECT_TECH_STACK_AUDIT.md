# Comprehensive Technology Stack Audit & Architecture Report

**Project Name:** Kanvtech Service Management Platform  
**Audit Date:** October 22, 2026  
**Auditor:** Senior Software Architect & Network Engineering Specialist  
**Workspace Location:** `c:\Users\Ashutosh Pandey\Downloads\Kanvtech service management`  

---

## 1. Project Overview & System Architecture

Kanvtech Service Management is an enterprise multi-tier customer service, ticket dispatch, and field management platform. It is structured as a **hybrid monorepo** consisting of:

1. **Web Frontend (`web/`):** A server-rendered and static Next.js 15 application utilizing React 18, Tailwind/Vanilla CSS, Lucide icons, and an internal reverse-proxy rewrite configuration for seamless API mediation.
2. **Backend API (`backend/`):** A modular monolith built on NestJS 10 running on Node.js (v24.12.0), featuring role-based access control (RBAC), monotonic ticket identification, SLA engines, BullMQ background jobs, and Prisma ORM.
3. **Database Layer:** PostgreSQL (version 16-18 compatible, currently actively running on local port `5432` with an embedded fallback script in `backend/scripts/start-postgres.js`).
4. **Mobile Client (`mobile/`):** A cross-platform Flutter application configured with REST client communication against the backend.

### Architecture Classification
- **Type:** Full-Stack Web & Mobile Application (Modular Monolith Backend + Next.js App Router Web Frontend + Flutter Mobile App + Relational Database).
- **Runtime Model:** Decoupled multi-process architecture with Next.js acting both as the client UI host and server-side reverse proxy to the NestJS REST API.

---

## 2. Programming Languages & Framework Identification

| Component | Primary Language | Framework | Version (Detected) | Build / Runtime Tool |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | TypeScript 5.5.4 | NestJS (`@nestjs/core`) | `10.4.1` | Node.js v24.12.0, Nest CLI 10.4.5, `ts-node` |
| **Frontend Web** | TypeScript 5.5.4 / React | Next.js (App Router) | `15.5.25` / React `18.3.1` | Next CLI, Webpack / SWC compiler |
| **Database ORM** | Prisma Schema | Prisma Client & CLI | `5.20.0` / `5.22.0` | `prisma generate`, `prisma migrate` |
| **Mobile App** | Dart | Flutter | Target SDK 34 / Dart 3.x | Flutter SDK, Gradle |
| **Automation** | JavaScript / PowerShell | Node.js / PowerShell Core | Node v24.12.0 / PS 5.1+ | Custom runner scripts |

---

## 3. Package Management & Dependencies

- **Package Manager:** `npm` (with `package-lock.json` present across root, `backend/`, and `web/`).
- **Dependency Isolation:** Separate `node_modules` folders per tier (`backend/node_modules`, `web/node_modules`) orchestrated from the root `package.json`.
- **Lockfile Status:**
  - `backend/package-lock.json`: Validated, active.
  - `web/package-lock.json`: Validated, active.
  - `mobile/pubspec.lock`: Validated, active.

---

## 4. Entry Points & Process Map

| Component | Source Entry Point | Compiled Entry Point | Dev Startup Command | Production Startup Command |
| :--- | :--- | :--- | :--- | :--- |
| **Backend** | `backend/src/main.ts` | `backend/dist/main.js` | `npm run dev --prefix backend` (`nest start --watch`) | `node dist/main.js` |
| **Frontend Web** | `web/src/app/page.tsx` & `web/src/app/layout.tsx` | `web/.next/` | `npm run dev --prefix web` (`next dev -p 3000`) | `npx next start -H 0.0.0.0 -p 3000` |
| **PostgreSQL Database** | Port `5432` System Service | PostgreSQL Engine | Windows PostgreSQL Service / `node backend/scripts/start-postgres.js` | Windows PostgreSQL Service |

---

## 5. Network Interfaces, Ports & Bindings

| Service | Target Port | Configured Binding | Localhost Access | Wi-Fi / LAN Access |
| :--- | :--- | :--- | :--- | :--- |
| **Web Frontend** | `3000` | `0.0.0.0` (All interfaces) | `http://localhost:3000` | `http://192.168.3.111:3000` |
| **Backend REST API** | `5000` | `0.0.0.0` (All interfaces) | `http://localhost:5000/api` | `http://192.168.3.111:5000/api` |
| **OpenAPI / Swagger** | `5000` | `0.0.0.0` (Gated by env) | `http://localhost:5000/api/docs` | `http://192.168.3.111:5000/api/docs` |
| **PostgreSQL** | `5432` | `0.0.0.0` / `localhost` | `postgresql://localhost:5432` | **Private (Not exposed to Wi-Fi)** |

---

## 6. Environment Variables Audit (Redacted)

### Backend (`backend/.env`)
- `PORT`: `5000` (Listening port for NestJS)
- `DATABASE_URL`: `postgresql://postgres:[REDACTED]@localhost:5432/kanvtech_sm_staging?schema=public`
- `JWT_SECRET`: `[REDACTED_SECRET_KEY]`
- `JWT_EXPIRES_IN`: `24h`
- `CORS_ORIGIN`: Whitelist containing localhost, staging domain, and LAN endpoints (`http://192.168.3.111:3000`)
- `SWAGGER_ENABLED`: `true`
- `STORAGE_DRIVER`: `local`
- `UPLOAD_DIR`: `./uploads`
- `NODE_ENV`: `development`
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`: Configured for local MinIO/S3 if utilized

### Web Frontend (`web/.env.local` & `web/.env.production`)
- `PORT`: `3000`
- `NEXT_PUBLIC_API_URL`: `/api` (Relative path routing requests through Next.js proxy)
- `BACKEND_INTERNAL_URL`: `http://localhost:5000` (Internal loopback address used by Next.js rewrites)
- `NODE_ENV`: `development` / `production`

---

## 7. Internet & Offline Suitability

- **Offline Capability:** **100% Fully Offline Capable.** All npm packages, Next.js assets, Prisma client binaries, and Google fonts are cached and bundled locally. No active internet uplink is required for the web application or backend API to serve clients on the local Wi-Fi network.
- **Local Wi-Fi Hosting Suitability:** **Excellent.** 
  - The Next.js frontend uses relative `/api` paths, eliminating hardcoded `localhost` browser fetch bugs.
  - Next.js acts as a reverse proxy forwarding requests server-side to NestJS on loopback.
  - PostgreSQL runs entirely locally on the machine.

---

## 8. Discovered Issues & Technical Risks Resolved

1. **Strict CORS Policy Rejection on LAN IP (CRITICAL):**
   - *Problem:* `backend/src/main.ts` previously validated incoming `Origin` headers strictly against `localhost` or `127.0.0.1` in development mode. When a mobile device or secondary laptop accessed the application via `http://192.168.3.111:3000`, the browser's `Origin` header (`http://192.168.3.111:3000`) caused NestJS to abort requests with a `500 CORS policy violation`.
   - *Remediation:* Updated `backend/src/main.ts` to permit RFC 1918 private network address ranges (`192.168.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`) during development mode, and added `http://192.168.3.111:3000` to `CORS_ORIGIN`. Verified with live `curl` tests returning `Access-Control-Allow-Origin: http://192.168.3.111:3000` and HTTP 200 OK.
2. **Windows Firewall Profile:**
   - *Status:* Windows active Wi-Fi connection is currently categorized under the `Public` network profile. Node.js (`node.exe`) already possesses active Inbound Allow rules on the Public profile.
3. **Database Security:**
   - *Protection:* PostgreSQL port 5432 remains isolated to internal loopback / machine boundaries. Remote Wi-Fi clients cannot access the database directly; all data is strictly mediated through authenticated NestJS REST endpoints.
