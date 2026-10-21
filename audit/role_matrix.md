# KANVTECH Role-versus-Operation Authorization Matrix

| Module | Operation | ADMIN | MANAGER | L1 Specialist | L2 Specialist | L3 Specialist | CUSTOMER |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Authentication | User Authentication & JWT Issuance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Authentication | Get Authenticated User Profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Authentication | Self Password Change | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Authentication | Active Session Termination & Logout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dashboard | Retrieve Operational KPIs & Summary Statistics | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Customer Master | List Customer Companies with Search & Status Filter | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Customer Master | Create New Customer Company | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Customer Master | Update Customer Company Details | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Customer Master | Toggle Customer Company Active/Inactive Status | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Customer Master | List Company Branches | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Customer Master | Create Customer Company Branch | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Customer Master | Assign Product Entitlement to Company | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Product Master | List Products with Category & Status Filter | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Product Master | Create Product with Code & Category | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Product Master | Toggle Product Active/Inactive Status | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Department Master | List Departments with Manager & Specializations | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Department Master | Create Department with Unique Code | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Department Master | Toggle Department Active/Inactive Status | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Employee Master | List Employees with Tier Level & Availability | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Employee Master | Create Employee Profile with System User Link | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Employee Master | Promote Employee Tier (L1 -> L2 -> L3) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Employee Master | Demote Employee Tier (L3 -> L2 -> L1) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Employee Master | Toggle Employee Active/Inactive Status | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Attendance | Employee Attendance Check-In with Geolocation | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Attendance | Employee Attendance Check-Out | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Support Tickets | Create Support Ticket (Customer Portal or Staff Desk) | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Support Tickets | List Tickets with Status, Priority, Level Filters | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Support Tickets | Retrieve Ticket Detail with SLA, History & Comments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Support Tickets | Assign / Reassign Ticket to Employee | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Support Tickets | Start Work Continuous Timer | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Support Tickets | Pause Work Continuous Timer | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Support Tickets | Resume Work Continuous Timer | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Support Tickets | Post Internal Note or Customer Communication Comment | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Support Tickets | Escalate Ticket to Higher Tier (L1 -> L2, L2 -> L3) | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Support Tickets | Submit Ticket Resolution for Manager Review | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Support Tickets | Manager Resolution Sign-off / Approval | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Support Tickets | Customer Satisfaction Feedback & Rating | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Support Tickets | Close Ticket with Reason | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Support Tickets | Reopen Ticket with Root Reason | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Task Allotment | Retrieve Unassigned / Workload Ticket Queue | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Task Allotment | Retrieve Eligible Support Staff Workload Ranking | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Escalations Queue | Retrieve L2 / L3 Escalations Queue | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| Manager Approvals | Retrieve Tickets Pending Manager Review | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Implementations | List Implementation Projects with Milestones | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Implementations | Create Implementation Project | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Implementations | Toggle Implementation Checklist Task | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Annual Maintenance | List AMC Subscriptions & Expiry Dates | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Annual Maintenance | Renew AMC Contract with Extended Period | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Annual Maintenance | Dispatch AMC Expiration Warning Notice | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Prospects & Enquiries | List Sales Leads & Prospective Enquiries | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Prospects & Enquiries | Record New Prospect Enquiry | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Prospects & Enquiries | Update Prospect Status (NEW -> WON / LOST) | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Prospects & Enquiries | Convert Won Prospect into Customer Master Company | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Reports & Analytics | Retrieve Resolution by Support Level Report | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Reports & Analytics | Retrieve Support Staff Workload Report | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Reports & Analytics | Retrieve Escalations Compliance Report | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| SLA Settings | Retrieve Dynamic SLA Target Configurations | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| SLA Settings | Update SLA Priority Response & Resolution Targets | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Audit Logs | Retrieve Immutable Security Audit Trail | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Internal Messages | Retrieve Conversation Threads | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Internal Messages | Compose & Send Internal Message | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Tasks & Reminders | Retrieve Personal Tasks & Reminders | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Tasks & Reminders | Create Personal Task with Due Date & Priority | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Tasks & Reminders | Mark Task Completed | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Import / Export | Bulk Excel Spreadsheet File Ingestion | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
