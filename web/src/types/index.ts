export type UserRole = 
  | 'ADMIN' 
  | 'MANAGER' 
  | 'L1_EMPLOYEE' 
  | 'L2_EMPLOYEE' 
  | 'L3_EMPLOYEE' 
  | 'CUSTOMER';

export type TicketPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type TicketStatus = 
  | 'OPEN' 
  | 'IN_PROGRESS' 
  | 'RESOLVED' 
  | 'MANAGER_REVIEW' 
  | 'CUSTOMER_FEEDBACK' 
  | 'CLOSED';

export type TicketLevel = 'L1' | 'L2' | 'L3' | 'PARENT_COMPANY';

export type SLAStatus = 'ON_TRACK' | 'WARNING' | 'BREACHED' | 'MET';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  displayName: string;
  employeeId?: string | null;
  companyId?: string | null;
  contactId?: number | null;
}

export interface Ticket {
  id: string;
  company_id: string;
  company_name?: string;
  customer_contact_id: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  problem_type: string;
  priority: TicketPriority;
  category: string;
  description: string;
  created_by: number;
  assigned_employee_id?: string | null;
  assigned_employee_name?: string;
  assigned_employee_email?: string;
  assigned_employee_level?: string;
  assigned_level: TicketLevel;
  status: TicketStatus;
  sla_priority: TicketPriority;
  sla_deadline?: string | null;
  sla_status: SLAStatus;
  liveSlaStatus?: SLAStatus;
  slaRemainingSeconds?: number;
  slaPercentElapsed?: number;
  resolution_started_at?: string | null;
  resolution_ended_at?: string | null;
  total_resolution_seconds: number;
  closed_at?: string | null;
  closed_by?: number | null;
  closure_reason?: string | null;
  created_at: string;
  updated_at: string;
  is_timer_running?: boolean;
  latest_resolution_notes?: string | null;
  latest_escalation_reason?: string | null;
  escalated_by_name?: string | null;
  escalated_at?: string | null;

  computedSLA?: {
    status: SLAStatus;
    remainingSeconds: number;
    percentElapsed: number;
    isBreached: boolean;
  };
  timer?: {
    totalSeconds: number;
    isRunning: boolean;
    activeSessionSeconds: number;
    sessions: any[];
  };
  timeline?: any[];
  comments?: any[];
  attachments?: any[];
  escalations?: any[];
  feedback?: any;
}

export interface Company {
  id: string;
  company_name: string;
  address: string;
  gstn?: string | null;
  primary_email: string;
  alternate_emails?: string | null;
  contact_person: string;
  contact_phone: string;
  contact_address?: string | null;
  contact_status: string;
  alternate_contact?: string | null;
  alternate_contact_phone?: string | null;
  alternate_contact_email?: string | null;
  is_active: number;
  created_at: string;
  open_ticket_count?: number;
  resolved_ticket_count?: number;
  closed_ticket_count?: number;
  contacts?: any[];
  products?: any[];
  branches?: any[];
  ticketSummary?: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
  recentTickets?: any[];
}

export interface Employee {
  id: string;
  user_id: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  department_id?: string | null;
  designation: string;
  level: 'MANAGER' | 'L1' | 'L2' | 'L3';
  manager_id?: string | null;
  manager_name?: string;
  availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  active_ticket_count?: number;
  current_attendance_status?: 'CHECKED_IN' | 'CHECKED_OUT';
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: number;
  link_url?: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  isActive: boolean;
  is_active?: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  productId?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  managerId?: string | null;
  manager_id?: string | null;
  manager_name?: string | null;
  manager?: { id: string; name: string; email: string };
  isActive: boolean;
  is_active?: boolean;
  specialist_count?: number;
  active_ticket_count?: number;
  employees?: Employee[];
}

export interface BranchProduct {
  id: number;
  branchId: string;
  productId: string;
  productName?: string;
  productCode?: string;
  product?: Product;
}

export interface Branch {
  id: string;
  company_id: string;
  companyId?: string;
  branch_name: string;
  branchName?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contact_person: string;
  contactPerson?: string;
  contact_phone: string;
  contactPhone?: string;
  contact_email: string;
  contactEmail?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  products?: BranchProduct[];
  branchProducts?: BranchProduct[];
}

export interface CompanyProduct {
  id: number;
  companyId: string;
  productId: string;
  product_id?: string;
  product_name?: string;
  product_code?: string;
  category?: string;
  product?: Product;
}

export interface SLAConfig {
  id?: number;
  priority?: TicketPriority;
  response_time_hours?: number;
  resolution_time_hours?: number;
  warning_threshold_percent?: number;
  is_active?: number;
  HIGH?: number;
  MEDIUM?: number;
  LOW?: number;
  warningThresholdPercent?: number;
}
