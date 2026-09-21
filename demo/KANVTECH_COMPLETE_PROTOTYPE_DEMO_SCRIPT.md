# KANVTECH Service Management Platform — Demonstration Script

## Demonstration Overview

- **Title**: KANVTECH Complete Service Management Lifecycle Prototype Demonstration
- **Target Video File**: `demo/KANVTECH_COMPLETE_PROTOTYPE_DEMO.mp4`
- **Resolution**: 1920×1080 Full HD (30 FPS)
- **Environment**: Live Staging / Prototype Portal (`https://kanvtech-web-production.up.railway.app`)

---

## Complete Multi-Persona Demonstration Sequence

### Scene 1: Initial Login & System Administrator Verification
1. **Target**: `https://kanvtech-web-production.up.railway.app/login`
2. **Actor**: System Administrator (`admin@kanvtech.com`)
3. **Actions**:
   - Enter Administrator credentials.
   - Click **Sign In**.
   - Navigate to **Admin Dashboard** (verify executive KPIs: Total Tickets, SLA Compliance, CSAT Index, Open vs Closed metrics).
   - Navigate to **Company Master** (verify enterprise tenant management and active contacts).
   - Navigate to **Support Tickets** (inspect enterprise ticket queue and status distribution).
   - Click **New Ticket** to create the official presentation demonstration ticket:
     - **Company**: Acme Technologies Pvt Ltd (`CMP-0001`)
     - **Problem Type**: Core Database Latency & Connection Exhaustion
     - **Priority**: High (4-hour SLA resolution target)
     - **Category**: Database Architecture
     - **Description**: Staging database cluster experiencing connection timeout spikes and query queue backlogs during peak automated tests.
   - Submit ticket and note the generated monotonic ticket ID (`KT-2026-000002` or next sequence).
   - View ticket detail: verify Initial Level `L1`, Auto-assignment to L1 Engineer (`EMP-002 Amit Sharma`), and `OPEN` status.
   - Click **Sign Out**.

---

### Scene 2: Level 1 (L1) Support Specialist — Triage & Work Session
1. **Actor**: L1 Support Engineer (`l1.amit@kanvtech.com`)
2. **Actions**:
   - Sign in as Amit Sharma (L1 Support Specialist).
   - View L1 Personal Workspace / Assigned Ticket Queue.
   - Open the demonstration ticket.
   - Click **Start Work** to begin resolution work session.
   - Observe live continuous **Resolution Timer** activating and status advancing to `IN_PROGRESS`.
   - Add internal triage note and diagnostic log attachment.
   - Identify that senior database index optimization and query plan tuning is required beyond L1 operational scope.
   - Click **Escalate to L2** with justification: `"Requires senior database query plan profiling and index restructuring"`.
   - Verify ticket level shifts to `L2` and assignee automatically transitions to `EMP-004 Vikram Malhotra`.
   - Click **Sign Out**.

---

### Scene 3: Level 2 (L2) Technical Specialist — In-Depth Analysis & Tier 3 Handoff
1. **Actor**: L2 Senior Technical Specialist (`l2.vikram@kanvtech.com`)
2. **Actions**:
   - Sign in as Vikram Malhotra (L2 Specialist).
   - Open the escalated demonstration ticket from active queue.
   - Click **Start Work** (or continue work session).
   - Observe the cumulative **Resolution Timer** seamlessly retaining previous L1 triage duration and continuing elapsed time calculation.
   - Analyze connection pooling constraints and determine core connection manager architecture modifications are required.
   - Click **Escalate to L3** with reason: `"Core connection pooling architecture and max_connections parameter reconfiguration required"`.
   - Confirm handoff to L3 Principal Architect (`EMP-001 Rahul Verma` / `EMP-005 Priya Nair`).
   - Click **Sign Out**.

---

### Scene 4: Level 3 (L3) Principal Engineer — Root Cause Fix & Resolution
1. **Actor**: L3 Principal Architect (`l3.priya@kanvtech.com`)
2. **Actions**:
   - Sign in as Priya Nair (L3 Principal Engineer).
   - Open demonstration ticket.
   - Review complete chronological timeline from L1 and L2 specialists.
   - Click **Start Work** to record core engineering work session.
   - Formulate comprehensive resolution notes:
     - *Resolution Summary*: Reconfigured PostgreSQL connection pool parameters, optimized b-tree indexes on foreign keys, and deployed automated query kill-switch for runaway transactions.
     - *Preventative Action*: Implemented proactive telemetry alert for queue latency > 500ms.
   - Click **Submit Resolution**.
   - Observe ticket status transition to `MANAGER_REVIEW` and resolution timer finalized.
   - Click **Sign Out**.

---

### Scene 5: Service Delivery Manager — Operational Review & Sign-Off
1. **Actor**: Service Operations Manager (`manager@kanvtech.com`)
2. **Actions**:
   - Sign in as Rahul Verma (Service Delivery Manager).
   - Navigate to **Manager Approvals / Review Queue**.
   - Open the resolved demonstration ticket.
   - Review L1 $\rightarrow$ L2 $\rightarrow$ L3 escalation trail, total active resolution duration against 4-hour SLA target, and root cause notes.
   - Click **Approve Resolution** with manager comments: `"Verified thorough fix and preventative monitoring. Approved for client sign-off."`
   - Observe status progression to `CUSTOMER_FEEDBACK`.
   - Click **Sign Out**.

---

### Scene 6: Client Portal User — Customer Satisfaction (CSAT) & Ticket Closure
1. **Actor**: Client Contact (`rajesh@acme.com`)
2. **Actions**:
   - Sign in as Rajesh Mehta (IT Director, Acme Technologies).
   - View Customer Portal (sanitized client view).
   - Open ticket and review the clear client-facing resolution summary.
   - Rate service satisfaction: **5 Stars (Excellent)**.
   - Enter customer feedback remarks: `"Exceptional turnaround speed and crystal-clear root cause documentation by the Kanvtech team."`
   - Click **Submit Feedback & Confirm Closure**.
   - Observe real-time transition to **CLOSED** status with closure timestamp recorded.
   - Click **Sign Out**.

---

### Scene 7: Enterprise Governance & Chronological Audit Timeline Verification
1. **Actor**: System Administrator (`admin@kanvtech.com`)
2. **Actions**:
   - Sign in as Administrator.
   - Navigate to **Support Tickets** and open the closed demonstration ticket.
   - Verify all finalized lifecycle metadata:
     - **Status**: `CLOSED`
     - **SLA State**: `MET` / `ON_TRACK` (Completed well within SLA deadline)
     - **Total Resolution Time**: Recorded across all engineering tiers
     - **CSAT Feedback**: 5/5 Stars with customer sign-off quote
   - Navigate to **Audit Logs / Activity History** to inspect the tamper-evident chronological audit trail with exact actors, IP addresses, and state diffs.
   - Conclude on the clean, modern Kanvtech dashboard displaying updated 100% SLA compliance and 5.0 CSAT rating.

---

## Video File Specifications
- **Output Path**: `demo/KANVTECH_COMPLETE_PROTOTYPE_DEMO.mp4`
- **Video Codec**: H.264 (`libx264`, yuv420p)
- **Resolution**: 1920×1080
- **Frame Rate**: 30.0 fps
- **Quality**: CRF 18 (High Fidelity)
