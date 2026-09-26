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
  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword?: string }) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  adminResetPassword: (data: { userId: number; newPassword?: string }) =>
    request('/auth/admin/reset-password', { method: 'POST', body: JSON.stringify(data) }),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id: number) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  // Companies / Customer Master
  getCompanies: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/companies?${qs}`);
  },
  getCompany: (id: string) => request(`/companies/${id}`),
  createCompany: (data: any) => request('/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: any) => request(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleCompanyStatus: (id: string, isActive: boolean) =>
    request(`/companies/${id}/status`, { method: 'POST', body: JSON.stringify({ isActive }) }),

  // Customer Products
  addCustomerProduct: (companyId: string, productId: string) =>
    request(`/companies/${companyId}/products`, { method: 'POST', body: JSON.stringify({ productId }) }),
  removeCustomerProduct: (companyId: string, productId: string) =>
    request(`/companies/${companyId}/products/${productId}`, { method: 'DELETE' }),

  // Branches
  getCustomerBranches: (companyId: string) => request(`/companies/${companyId}/branches`),
  getBranch: (companyId: string, branchId: string) => request(`/companies/${companyId}/branches/${branchId}`),
  createBranch: (companyId: string, data: any) =>
    request(`/companies/${companyId}/branches`, { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (companyId: string, branchId: string, data: any) =>
    request(`/companies/${companyId}/branches/${branchId}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleBranchStatus: (companyId: string, branchId: string, status: string) =>
    request(`/companies/${companyId}/branches/${branchId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  assignBranchProducts: (companyId: string, branchId: string, productIds: string[]) =>
    request(`/companies/${companyId}/branches/${branchId}/products`, { method: 'POST', body: JSON.stringify({ productIds }) }),

  // Departments
  getDepartments: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/departments?${qs}`);
  },
  getDepartment: (id: string) => request(`/departments/${id}`),
  createDepartment: (data: any) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id: string, data: any) => request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleDepartmentStatus: (id: string, isActive: boolean) =>
    request(`/departments/${id}/status`, { method: 'POST', body: JSON.stringify({ isActive }) }),

  // Employees
  getEmployees: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/employees?${qs}`);
  },
  getEmployee: (id: string) => request(`/employees/${id}`),
  createEmployee: (data: any) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: any) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  promoteEmployee: (id: string) => request(`/employees/${id}/promote`, { method: 'POST' }),
  demoteEmployee: (id: string) => request(`/employees/${id}/demote`, { method: 'POST' }),
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
  downloadTemplate: (type: string) => request(`/import/template/${type}`),
  previewImport: (type: string, formData: FormData) =>
    request(`/import/preview/${type}`, { method: 'POST', body: formData }),
  commitImport: (type: string, rows: any[]) =>
    request(`/import/commit/${type}`, { method: 'POST', body: JSON.stringify({ rows }) }),
  devReset: () => request('/import/dev-reset', { method: 'POST' }),

  // Reports
  getDashboard: () => request('/reports/dashboard'),
  getResolutionByLevel: () => request('/reports/resolution-by-level'),
  getWorkloadReport: () => request('/reports/workload'),
  getEscalationsReport: () => request('/reports/escalations'),
  getSLASettings: () => request('/reports/sla'),
  updateSLASettings: (data: any) => request('/reports/sla', { method: 'PUT', body: JSON.stringify(data) }),

  // Products
  getProducts: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products?${qs}`);
  },
  getProduct: (id: string) => request(`/products/${id}`),
  createProduct: (data: any) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleProductStatus: (id: string, isActive: boolean) =>
    request(`/products/${id}/status`, { method: 'POST', body: JSON.stringify({ isActive }) }),
  getProductStats: () => request('/products/stats'),
  deleteProduct: (id: string) => request(`/products/${id}`, { method: 'DELETE' }),

  // Subscriptions & AMC
  getSubscriptions: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/subscriptions?${qs}`);
  },
  getSubscription: (id: string) => request(`/subscriptions/${id}`),
  createSubscription: (data: any) => request('/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  updateSubscription: (id: string, data: any) => request(`/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  sendSubscriptionWarning: (id: string, message?: string) =>
    request(`/subscriptions/${id}/warning`, { method: 'POST', body: JSON.stringify({ message }) }),
  renewSubscription: (id: string, data: any) =>
    request(`/subscriptions/${id}/renew`, { method: 'POST', body: JSON.stringify(data) }),
  getSubscriptionStats: () => request('/subscriptions/stats'),

  // Implementations
  getImplementations: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/implementations?${qs}`);
  },
  getImplementation: (id: string) => request(`/implementations/${id}`),
  createImplementation: (data: any) => request('/implementations', { method: 'POST', body: JSON.stringify(data) }),
  updateImplementation: (id: string, data: any) =>
    request(`/implementations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getImplementationStats: () => request('/implementations/stats'),
  getImplementationTasks: (id: string) => request(`/implementations/${id}/tasks`),
  addImplementationTask: (id: string, data: any) =>
    request(`/implementations/${id}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateImplementationTask: (taskId: string, data: any) =>
    request(`/implementations/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleImplementationTask: (taskId: string, isCompleted: boolean) =>
    request(`/implementations/tasks/${taskId}/toggle`, { method: 'POST', body: JSON.stringify({ isCompleted }) }),
  reopenImplementationTask: (taskId: string) =>
    request(`/implementations/tasks/${taskId}/reopen`, { method: 'POST' }),
  removeImplementationTask: (taskId: string) =>
    request(`/implementations/tasks/${taskId}`, { method: 'DELETE' }),
  reorderImplementationTasks: (id: string, taskIds: string[]) =>
    request(`/implementations/${id}/tasks/reorder`, { method: 'POST', body: JSON.stringify({ taskIds }) }),

  // Task Allotment
  getTaskAllotmentQueue: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/task-allotment/queue?${qs}`);
  },
  getEligibleEmployees: () => request('/task-allotment/eligible-employees'),
  getAllotmentStats: () => request('/task-allotment/stats'),
  directAssignTicket: (data: any) => request('/task-allotment/assign', { method: 'POST', body: JSON.stringify(data) }),

  // Audit Logs
  getAuditLogs: () => request('/audit-logs'),
};
