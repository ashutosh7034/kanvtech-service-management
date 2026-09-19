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

export type EmployeeAvailability = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export type NotificationChannel = 'EMAIL' | 'WHATSAPP' | 'PUSH' | 'IN_APP';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: number;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: UserRole;
  employeeId?: string | null;
  companyId?: string | null;
  contactId?: number | null;
}

export interface Company {
  id: string; // CMP-0001
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
  alternate_contact_address?: string | null;
  alternate_contact_email?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyContact {
  id: number;
  company_id: string;
  user_id?: number | null;
  name: string;
  email: string;
  phone: string;
  designation?: string | null;
  is_primary: number;
  is_active: number;
  created_at: string;
}

export interface Employee {
  id: string; // EMP-001
  user_id: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  level: 'L1' | 'L2' | 'L3';
  manager_id?: string | null;
  availability: EmployeeAvailability;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  active_ticket_count?: number;
}

export interface EmployeeAttendance {
  id: number;
  employee_id: string;
  check_in_time: string;
  check_out_time?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_address?: string | null;
  status: 'CHECKED_IN' | 'CHECKED_OUT';
  created_at: string;
}

export interface Ticket {
  id: string; // KT-2026-000001
  company_id: string;
  customer_contact_id: number;
  problem_type: string;
  priority: TicketPriority;
  category: string;
  description: string;
  created_by: number;
  assigned_employee_id?: string | null;
  assigned_level: TicketLevel;
  status: TicketStatus;
  sla_priority: TicketPriority;
  sla_deadline?: string | null;
  sla_status: SLAStatus;
  resolution_started_at?: string | null;
  resolution_ended_at?: string | null;
  total_resolution_seconds: number;
  closed_at?: string | null;
  closed_by?: number | null;
  closure_reason?: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  company_name?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  assigned_employee_name?: string;
  assigned_employee_level?: string;
  current_session_seconds?: number;
  is_timer_running?: boolean;
}

export interface TicketAssignment {
  id: number;
  ticket_id: string;
  employee_id: string;
  level: TicketLevel;
  assigned_by: number;
  assigned_at: string;
  unassigned_at?: string | null;
  assignment_type: 'AUTO' | 'MANUAL';
  employee_name?: string;
}

export interface TicketHistory {
  id: number;
  ticket_id: string;
  actor_user_id: number;
  action_type: string;
  title: string;
  description?: string | null;
  metadata_json?: string | null;
  created_at: string;
  actor_name?: string;
  actor_role?: string;
}

export interface TicketEscalation {
  id: number;
  ticket_id: string;
  from_level: 'L1' | 'L2' | 'L3';
  to_level: 'L2' | 'L3' | 'PARENT_COMPANY';
  escalated_by_employee_id: string;
  assigned_to_employee_id?: string | null;
  reason: string;
  notes?: string | null;
  created_at: string;
  escalated_by_name?: string;
  assigned_to_name?: string;
}

export interface TicketResolutionSession {
  id: number;
  ticket_id: string;
  employee_id: string;
  level: TicketLevel;
  started_at: string;
  ended_at?: string | null;
  duration_seconds: number;
  employee_name?: string;
}

export interface TicketComment {
  id: number;
  ticket_id: string;
  author_user_id: number;
  comment_type: 'INTERNAL_NOTE' | 'CUSTOMER_COMMUNICATION' | 'SYSTEM';
  message: string;
  created_at: string;
  author_name?: string;
  author_role?: string;
}

export interface TicketAttachment {
  id: number;
  ticket_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  created_at: string;
  uploaded_by_name?: string;
}

export interface TicketFeedback {
  id: number;
  ticket_id: string;
  customer_user_id: number;
  rating: number; // 1-5
  remarks?: string | null;
  created_at: string;
  customer_name?: string;
}

export interface SLAConfiguration {
  id: number;
  priority: TicketPriority;
  response_time_hours: number;
  resolution_time_hours: number;
  warning_threshold_percent: number;
  is_active: number;
  updated_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: number;
  link_url?: string | null;
  created_at: string;
}

export interface NotificationLog {
  id: number;
  channel: NotificationChannel;
  recipient: string;
  event_type: string;
  payload_json?: string | null;
  status: 'SENT' | 'FAILED';
  error_message?: string | null;
  sent_at: string;
}

export interface AuditLog {
  id: number;
  actor_user_id?: number | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values_json?: string | null;
  new_values_json?: string | null;
  ip_address?: string | null;
  created_at: string;
  actor_email?: string;
}
