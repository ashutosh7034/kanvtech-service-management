# Kanvtech Service Management Platform

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2010-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%205-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](#)

A centralized, enterprise-grade **Service & Ticket Management Platform** engineered for multi-tier technical support organizations, client implementation tracking, and annual maintenance contract (AMC) operations. 

Built with **NestJS**, **Next.js 14**, **Prisma ORM**, and **PostgreSQL**, the platform enforces strict role-based access control (RBAC), multi-tier escalation hierarchies (L1 &rarr; L2 &rarr; L3), continuous server-authoritative resolution timers, customer verification & reopening engines, 5-star CSAT feedback, product master catalogs, and task allotment routing.

---

## 📑 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Platform Modules & Capabilities](#-platform-modules--capabilities)
- [Technology Stack](#-technology-stack)
- [Evaluation & Demo Credentials](#-evaluation--demo-credentials)
- [Quick Start: How to Run Locally](#-quick-start-how-to-run-locally)
  - [Prerequisites](#prerequisites)
  - [1. Clone Repository & Install Dependencies](#1-clone-repository--install-dependencies)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Start Database & Run Migrations](#3-start-database--run-migrations)
  - [4. Start Application Servers](#4-start-application-servers)
- [Automated Testing & QA Verification](#-automated-testing--qa-verification)
- [Project Directory Structure](#-project-directory-structure)
- [Deployment Guidelines](#-deployment-guidelines)
- [Security & Compliance](#-security--compliance)

---

## 🏗️ Architecture Overview

The system is architected as a modular monolith decoupled into a high-throughput REST API backend and a responsive Next.js web application:

```mermaid
graph TD
    Client[Next.js 14 Web Portal / Mobile Web View :3000]
    API[NestJS Modular REST API :5000]
    DB[(PostgreSQL Database :5432 / :5433)]
    
    Client -->|HTTP / REST + JWT Bearer| API
    API -->|Prisma ORM Type-Safe Queries| DB
    
    subgraph Core Backend Modules
        API --> Auth[Auth & RBAC Guard]
        API --> Tickets[Tickets & State Machine]
        API --> Timer[Resolution Timer Engine]
        API --> Escalation[L1-L2-L3 Escalations]
        API --> Approvals[Manager Review & Approvals]
        API --> Reopen[Customer Reopen Engine]
        API --> Products[Product Master Catalog]
        API --> Allotment[Task Allotment Engine]
        API --> AMC[Subscriptions & AMC Contracts]
        API --> Impl[Client Implementations]
        API --> Audit[Immutable Audit Logger]
    end
```

---

## 🚀 Platform Modules & Capabilities

### 1. 🎫 Core Ticketing & Workflow State Machine
- **Sequential Ticket IDs**: Format `KT-YYYY-000001` with collision-safe database sequence counters.
- **Strict 2-Active-Ticket Limit**: Prevents customer accounts from creating more than 2 active tickets simultaneously (`OPEN`, `IN_PROGRESS`, `REOPENED`, `RESOLVED`, `MANAGER_REVIEW`, `CUSTOMER_FEEDBACK`). Closed tickets immediately free allocation.
- **State Machine Lifecycle**:
  $$\text{OPEN} \longrightarrow \text{IN\_PROGRESS (L1/L2/L3)} \longrightarrow \text{RESOLVED} \longrightarrow \text{MANAGER\_REVIEW} \longrightarrow \text{CUSTOMER\_FEEDBACK} \longrightarrow \text{CLOSED}$$
  $$\text{CUSTOMER\_FEEDBACK / MANAGER\_REVIEW} \overset{\text{Reopen}}{\longrightarrow} \text{REOPENED} \longrightarrow \text{IN\_PROGRESS}$$

### 2. ⏱️ Continuous Server-Authoritative Resolution Timers
- Live resolution timers start on the server when an engineer clicks **Start Work**.
- **Cross-Tier Continuity**: Escalating across L1 $\to$ L2 $\to$ L3 preserves elapsed resolution time across sessions (`ticket_resolution_sessions`) without resetting.
- Single source of truth in database timestamps prevents client-side tampering.

### 3. 👥 Multi-Tier Specialist Hierarchy (L1 / L2 / L3)
- **L1 Support Specialist**: First-line triage, diagnostics, and standard troubleshooting. Escalates to L2 with technical notes.
- **L2 Senior Specialist**: Deep network, server, database, and infrastructure troubleshooting. Escalates to L3.
- **L3 Principal Architect**: Core system architecture, code fixes, and vendor-level interventions. Submits to Manager Review upon resolution.

### 4. 🔁 Customer Reopening & Verification Engine
- Customers can verify resolutions from their portal.
- **Reopen with Mandatory Reason**: If issue is unresolved, customer can reopen the ticket with a reason. Automatically transitions ticket to `REOPENED` / `IN_PROGRESS`, restarts the timer, and logs immutable history in `TicketReopenHistory`.

### 5. ⭐ Customer CSAT & Formal Ticket Closure
- Customers provide a **1 to 5-star rating** along with optional remarks.
- Submitting feedback automatically formalizes ticket closure with audit logging (`closed_at`, `closed_by`).

### 6. 📦 Product Master Catalog
- Centralized software and hardware product catalog (`PRD-0001`, `PRD-0002`).
- Supports category categorization, versioning, product descriptions, and instant active/inactive status toggles.

### 7. 📌 Task Allotment & Workload Router
- Empowers Administrators and Managers to directly assign or re-route tickets to any specific specialist (L1, L2, L3) without tier-mismatch validation errors.
- Real-time engineer workload cards displaying open ticket distribution.

### 8. 📅 Annual Maintenance Contracts (AMC) & Subscriptions
- Multi-company contract tracking (`SUB-2026-000001`) with start date, end date, SLA tier, and billing cycle.
- **Auto Expiry Countdown**: Real-time days remaining calculation and expiration warning alerts (within 30 days).
- One-click contract renewal modal.

### 9. 🚀 New Client Implementations Management
- End-to-end client onboarding lifecycle tracking (`IMP-2026-000001`) from `NEW` $\to$ `IN_PROGRESS` $\to$ `UAT` $\to$ `COMPLETED`.
- Interactive milestone checklists and dynamic progress percentage sliders (0%–100%).

### 10. 🛡️ Security, RBAC & Immutable Audit Trail
- Passwords hashed using standard `bcryptjs` (salt rounds: 10).
- JWT token-based authentication with role-based guards (`ADMIN`, `MANAGER`, `L1`, `L2`, `L3`, `CUSTOMER`).
- Email-only Remember-Me (passwords are **never** stored in client localStorage or logs).
- Every administrative change, assignment, status transition, and approval is logged in `audit_logs`.

---

## 💻 Technology Stack

| Layer | Technology | Key Libraries / Frameworks |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 / React 18 | TypeScript, Lucide React, Modular Vanilla CSS Design Tokens |
| **Backend** | NestJS 10 | TypeScript, Express, Passport JWT, Class-Validator, Helmet, Multer |
| **ORM & Database** | Prisma ORM 5.20 | PostgreSQL 14+, Embedded PostgreSQL fallback engine |
| **Security** | BCrypt + JWT | Strict RBAC Guards, Login Rate-Limiting, CORS Protection |
| **Utilities** | Date-fns / Custom Utils | Resilient date/time formatters, zero `NaN` date fallbacks |

---

## 🔑 Evaluation & Demo Credentials

All test accounts are seeded with standard evaluation credentials:

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@kanvtech.com` | `admin123` | Full access: Product Master, Task Allotment, AMC, Implementations, Master Directory, System Audit Logs |
| **Manager** | `manager@kanvtech.com` | `manager123` | Task routing, manager approvals, resolution send-backs, SLA oversight |
| **L1 Specialist** | `amit.l1@kanvtech.com` | `l1pass123` | Work queue, start work timer, resolution notes, L1 $\to$ L2 escalation |
| **L2 Specialist** | `rahul.l2@kanvtech.com` | `l2pass123` | Senior queue, deep troubleshooting, L2 $\to$ L3 escalation |
| **L3 Specialist** | `priya.l3@kanvtech.com` | `l3pass123` | Core engineering, root-cause resolution, submission to Manager Review |
| **Customer** | `contact@acme.com` | `cust123` | Client portal, 2-ticket limit enforcement, reopen tickets, 5-star CSAT rating & closure |

---

## 🛠️ Quick Start: How to Run Locally

### Prerequisites
- **Node.js**: Version 18.x or 20.x+ installed ([Download Node.js](https://nodejs.org/))
- **npm**: Version 9.x+ (bundled with Node.js)
- **Git**: Installed and configured

---

### 1. Clone Repository & Install Dependencies

Clone the repository and install dependencies for both the backend and web frontend:

```powershell
# Clone the repository
git clone https://github.com/ashutosh7034/kanvtech-service-management.git
cd kanvtech-service-management

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../web
npm install

# Return to root directory
cd ..
```

---

### 2. Environment Configuration

The repository includes pre-configured environment templates.

#### Backend Configuration (`backend/.env`)
Create `backend/.env` (or verify existing):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/kanvtech_sm_staging"
JWT_SECRET="kanvtech-ultra-secure-jwt-secret-key-2026-production"
PORT=5000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3000"
STORAGE_DRIVER=local
UPLOAD_DIR="./uploads"
```

#### Frontend Configuration (`web/.env.local`)
Create `web/.env.local` (or verify existing):
```env
BACKEND_INTERNAL_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=/api
PORT=3000
NODE_ENV=development
```

---

### 3. Start Database & Run Migrations

You can run PostgreSQL in either of two ways:

#### Option A: Zero-Config Embedded PostgreSQL (Recommended for quick evaluation)
The platform includes an embedded PostgreSQL runner that requires no external setup:
```powershell
# From the root directory:
npm run start:db
```
*(This starts PostgreSQL listening on port `5433` and creates `kanvtech_sm_staging`).*

#### Option B: Standard PostgreSQL / Docker
If you have local PostgreSQL or Docker running on port `5432`:
```powershell
docker run --name kanvtech-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kanvtech_sm_staging -p 5432:5432 -d postgres:15
```
*(Update `DATABASE_URL` in `backend/.env` to use port `5432`).*

#### Run Database Migrations and Seed Data:
In a new terminal:
```powershell
cd backend
npx prisma migrate dev
npm run prisma:seed
```

---

### 4. Start Application Servers

Open two terminal windows to run the backend and web frontend:

#### Terminal 1: Backend API (Port 5000)
```powershell
# Using root script:
npm run dev:backend

# Or directly from backend directory:
cd backend
npm run dev
```
*Backend runs on:* `http://localhost:5000`  
*API Health check:* `http://localhost:5000/api/auth/profile`

#### Terminal 2: Web Frontend Portal (Port 3000)
```powershell
# Using root script:
npm run dev:web

# Or directly from web directory:
cd web
npm run dev
```
*Web Portal runs on:* **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Automated Testing & QA Verification

The repository contains three comprehensive automated test suites covering business rules, state transitions, security guards, and advanced workflows:

```powershell
# 1. Run Backend Core Business Test Suite (24 / 24 Tests)
cd backend
npm test

# 2. Run Comprehensive QA & Security Suite (32 / 32 Tests)
npx ts-node test/qa-comprehensive-suite.ts

# 3. Run Advanced Admin & Customer Workflow Suite (14 / 14 Tests)
npx ts-node test/advanced-workflow-suite.ts
```

### TypeScript Validation:
```powershell
# Validate Backend types (0 errors)
cd backend && npx tsc --noEmit

# Validate Web types (0 errors)
cd web && npx tsc --noEmit
```

---

## 📁 Project Directory Structure

```text
kanvtech-service-management/
├── backend/                         # NestJS Backend Application
│   ├── prisma/
│   │   ├── schema.prisma            # Prisma Data Models & Enums
│   │   └── seed.ts                  # Master Seed (Users, Companies, Products, Subscriptions)
│   ├── src/
│   │   ├── app.module.ts            # Root Module Architecture
│   │   ├── auth/                    # JWT Authentication & RBAC Guards
│   │   ├── tickets/                 # Ticket CRUD, 2-Ticket Limit & Lifecycles
│   │   ├── timer/                   # Resolution Timer & Session Logger
│   │   ├── escalations/             # L1 -> L2 -> L3 Escalation Engine
│   │   ├── approvals/               # Manager Approval & Customer Reopen Engine
│   │   ├── feedback/                # Customer 5-Star CSAT Rating Engine
│   │   ├── products/                # Product Master Catalog
│   │   ├── assignments/             # Task Allotment & Workload Router
│   │   ├── subscriptions/           # AMC Contracts & Expiry Alerts
│   │   ├── implementations/         # Client Onboarding & Milestones
│   │   ├── companies/               # Company Master Directory
│   │   ├── audit/                   # System Audit Trail
│   │   └── main.ts                  # NestJS Entry Point
│   ├── test/                        # Automated QA Test Suites
│   └── scripts/                     # Embedded PostgreSQL & Migration Utilities
├── web/                             # Next.js 14 Web Portal
│   ├── src/
│   │   ├── api/                     # Type-Safe REST API Client
│   │   ├── components/              # Layout, Sidebar, Header, Timelines
│   │   ├── context/                 # AuthContext, NotificationContext
│   │   ├── pages-components/        # Dashboard, Tickets, Products, Task Allotment, AMC, Implementations
│   │   ├── styles/                  # Design System & Token Styles
│   │   └── utils/                   # Resilient Date/Time Utilities
│   └── public/                      # Static Assets & Logos
├── docs/                            # Technical Architecture & Planning Docs
└── README.md                        # Project Documentation
```

---

## 🚢 Deployment Guidelines

### Railway Staging Deployment
The backend and web frontend are configured for zero-downtime deployment on **Railway**:
- **Backend Service**: Root directory `backend/`, build command `npm run build`, start command `npm run start`.
- **Web Frontend Service**: Root directory `web/`, build command `npm run build`, start command `npm run start`.
- **PostgreSQL Database**: Provision a Railway PostgreSQL plugin and set `DATABASE_URL` in backend environment variables.

---

## 🔒 Security & Compliance

- **Zero Plaintext Credentials**: Passwords are encrypted using bcrypt hashing before storage.
- **Role Isolation**: Strict server-side route guards prevent unauthorized access or tier violations.
- **Tenant Isolation**: Customers are restricted strictly to their company's tickets and cannot query or modify tickets of other organizations.
- **Audit Logging**: All critical operations (escalations, approvals, reopenings, status changes) generate permanent audit log entries.

---

## 📄 License & Maintainer

&copy; 2026 **Kanvtech Engineering Team**. All rights reserved.  
For technical support or inquiries, contact `support@kanvtech.com`.