# KANVTECH Demonstration Accounts (Example)

This document lists the baseline demonstration persona accounts provisioned during standard database seeding for prototype presentation.

## Demonstration Persona Accounts

| Persona / Role | Email Address | Description |
| :--- | :--- | :--- |
| **System Administrator** | `admin@kanvtech.com` | Full administrative control, system settings, audit logs, and company master |
| **Service Operations Manager** | `manager@kanvtech.com` | Ticket review, resolution approvals, reassignments, and operational SLA reports |
| **Level 1 Support Specialist** | `l1.amit@kanvtech.com` | Initial triage, work session timer, and Level 2 operational escalation |
| **Level 2 Support Specialist** | `l2.vikram@kanvtech.com` | Advanced technical troubleshooting, query optimization, and Level 3 escalation |
| **Level 3 Principal Engineer** | `l3.priya@kanvtech.com` | Core architecture troubleshooting, root cause resolution, and review submission |
| **Client Portal Contact** | `rajesh@acme.com` | Ticket creation, client timeline view, and CSAT rating & feedback submission |

> [!NOTE]
> All demonstration accounts are initialized during local database migration / seed (`npm run prisma:seed`). Real deployment credentials must be configured securely via environment variables.
