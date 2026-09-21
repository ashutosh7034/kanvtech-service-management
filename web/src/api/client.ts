const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export class ApiError extends Error {
  constructor(public message: string, public status = 400) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('kanvtech_token') : null;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('kanvtech_token');
    localStorage.removeItem('kanvtech_user');
    window.dispatchEvent(new Event('auth_unauthorized'));
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument')) {
    return (await response.blob()) as any;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new ApiError(data.error || 'Server request failed', response.status);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  me: () => request('/auth/me'),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id: number) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  // Companies
  getCompanies: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/companies?${qs}`);
  },
  getCompany: (id: string) => request(`/companies/${id}`),
  createCompany: (data: any) => request('/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: any) => request(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleCompanyStatus: (id: string, isActive: boolean) =>
    request(`/companies/${id}/status`, { method: 'POST', body: JSON.stringify({ isActive }) }),

  // Employees
  getEmployees: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/employees?${qs}`);
  },
  getEmployee: (id: string) => request(`/employees/${id}`),
  createEmployee: (data: any) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: any) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  checkIn: (data: any) => request('/employees/attendance/check-in', { method: 'POST', body: JSON.stringify(data) }),
  checkOut: (data: any) => request('/employees/attendance/check-out', { method: 'POST', body: JSON.stringify(data) }),

  // Tickets
  getTickets: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tickets?${qs}`);
  },
  getTicket: (id: string) => request(`/tickets/${id}`),
  createTicket: (data: any) => request('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  assignTicket: (id: string, data: any) => request(`/tickets/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  startWork: (id: string) => request(`/tickets/${id}/start`, { method: 'POST' }),
  escalateTicket: (id: string, data: any) => request(`/tickets/${id}/escalate`, { method: 'POST', body: JSON.stringify(data) }),
  resolveTicket: (id: string, data: any) => request(`/tickets/${id}/resolve`, { method: 'POST', body: JSON.stringify(data) }),
  approveTicket: (id: string, data: any = {}) => request(`/tickets/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  reopenTicket: (id: string, data: any) => request(`/tickets/${id}/reopen`, { method: 'POST', body: JSON.stringify(data) }),
  submitFeedback: (id: string, data: any) => request(`/tickets/${id}/feedback`, { method: 'POST', body: JSON.stringify(data) }),
  closeTicket: (id: string, data: any = {}) => request(`/tickets/${id}/close`, { method: 'POST', body: JSON.stringify(data) }),
  addComment: (id: string, data: any) => request(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  uploadAttachment: (id: string, formData: FormData) => request(`/tickets/${id}/attachments`, { method: 'POST', body: formData }),

  // Import
  downloadTemplate: (type: 'companies' | 'employees') => request(`/import/template/${type}`),
  previewImport: (type: 'companies' | 'employees', formData: FormData) =>
    request(`/import/preview/${type}`, { method: 'POST', body: formData }),
  commitImport: (type: 'companies' | 'employees', rows: any[]) =>
    request(`/import/commit/${type}`, { method: 'POST', body: JSON.stringify({ rows }) }),

  // Reports
  getDashboard: () => request('/reports/dashboard'),
  getResolutionByLevel: () => request('/reports/resolution-by-level'),
  getWorkloadReport: () => request('/reports/workload'),
  getEscalationsReport: () => request('/reports/escalations'),
  getSLASettings: () => request('/reports/sla'),
  updateSLASettings: (data: any) => request('/reports/sla', { method: 'PUT', body: JSON.stringify(data) }),

  // Audit Logs
  getAuditLogs: () => request('/audit-logs'),
};
