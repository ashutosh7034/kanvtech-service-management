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
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('kanvtech_token') || sessionStorage.getItem('kanvtech_token')
      : null;
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
    cache: 'no-store',
    ...options,
    headers,
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('kanvtech_token');
    sessionStorage.removeItem('kanvtech_token');
    localStorage.removeItem('kanvtech_user');
    sessionStorage.removeItem('kanvtech_user');
    window.dispatchEvent(new Event('auth_unauthorized'));
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument')) {
    return (await response.blob()) as any;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new ApiError(data.message || data.error || 'Server request failed', response.status);
  }

  return data as T;
}

export function toQueryString(params: any = {}): string {
  if (!params || typeof params !== 'object') return '';
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (
      val !== undefined &&
      val !== null &&
      val !== '' &&
      val !== 'undefined' &&
      val !== 'null'
    ) {
      searchParams.append(key, String(val));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
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
  getCompanies: (params: any = {}) => request(`/companies${toQueryString(params)}`),
  getCompany: (id: string) => request(`/companies/${id}`),
  createCompany: (data: any) => request('/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: any) => request(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleCompanyStatus: (id: string, isActive: boolean) =>
    request(`/companies/${id}/status`, { method: 'POST', body: JSON.stringify({ isActive }) }),

  // Customer Products
  addCustomerProduct: (companyId: string, data: any) =>
    request(`/companies/${companyId}/products`, {
      method: 'POST',
      body: JSON.stringify(typeof data === 'string' ? { productId: data } : data),
    }),
  updateCustomerProductEntitlement: (companyId: string, productId: string, data: any) =>
    request(`/companies/${companyId}/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
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
  getDepartments: (params: any = {}) => request(`/departments${toQueryString(params)}`),
  getDepartment: (id: string) => request(`/departments/${id}`),
  createDepartment: (data: any) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id: string, data: any) => request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleDepartmentStatus: (id: string, isActive: boolean) =>
    request(`/departments/${id}/status`, { method: 'POST', body: JSON.stringify({ isActive }) }),

  // Employees
  getEmployees: (params: any = {}) => request(`/employees${toQueryString(params)}`),
  getEmployee: (id: string) => request(`/employees/${id}`),
  createEmployee: (data: any) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: any) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  promoteEmployee: (id: string, level?: string) => request(`/employees/${id}/promote`, { method: 'POST', body: JSON.stringify({ level }) }),
  demoteEmployee: (id: string, level?: string) => request(`/employees/${id}/demote`, { method: 'POST', body: JSON.stringify({ level }) }),
  toggleEmployeeStatus: (id: string) => request(`/employees/${id}/toggle-status`, { method: 'POST' }),
  deleteEmployee: (id: string) => request(`/employees/${id}`, { method: 'DELETE' }),
  getLevelManagementStatus: () => request('/employees/level-management/status'),
  toggleLevelManagement: (enabled: boolean) => request('/employees/level-management/toggle', { method: 'POST', body: JSON.stringify({ enabled }) }),
  checkIn: (data: any) => request('/employees/attendance/check-in', { method: 'POST', body: JSON.stringify(data) }),
  checkOut: (data: any) => request('/employees/attendance/check-out', { method: 'POST', body: JSON.stringify(data) }),

  // Tickets
  getTickets: (params: any = {}) => request(`/tickets${toQueryString(params)}`),
  getTicket: (id: string) => request(`/tickets/${id}`),
  createTicket: (data: any) => request('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  assignTicket: (id: string, data: any) => request(`/tickets/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  startWork: (id: string) => request(`/tickets/${id}/start`, { method: 'POST' }),
  pauseWork: (id: string) => request(`/tickets/${id}/pause`, { method: 'POST' }),
  resumeWork: (id: string) => request(`/tickets/${id}/resume`, { method: 'POST' }),
  escalateTicket: (id: string, data: any) => request(`/tickets/${id}/escalate`, { method: 'POST', body: JSON.stringify(data) }),
  resolveTicket: (id: string, data: any) => request(`/tickets/${id}/resolve`, { method: 'POST', body: JSON.stringify(data) }),
  approveTicket: (id: string, data: any = {}) => request(`/tickets/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  reopenTicket: (id: string, data: any) => request(`/tickets/${id}/reopen`, { method: 'POST', body: JSON.stringify(data) }),
  submitFeedback: (id: string, data: any) => request(`/tickets/${id}/feedback`, { method: 'POST', body: JSON.stringify(data) }),
  closeTicket: (id: string, data: any = {}) => request(`/tickets/${id}/close`, { method: 'POST', body: JSON.stringify(data) }),
  addComment: (id: string, data: any) => request(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  uploadAttachment: (id: string, formData: FormData) => request(`/tickets/${id}/attachments`, { method: 'POST', body: formData }),
  getAutoAssignmentLevel: () => request('/tickets/settings/auto-assignment-level'),
  updateAutoAssignmentLevel: (level: string) =>
    request('/tickets/settings/auto-assignment-level', { method: 'POST', body: JSON.stringify({ level }) }),

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
  getProducts: (params: any = {}) => request(`/products${toQueryString(params)}`),
  getProduct: (id: string) => request(`/products/${id}`),
  createProduct: (data: any) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Prospects / Enquiries
  getProspects: (params: any = {}) => request(`/prospects${toQueryString(params)}`),
  getProspect: (id: string) => request(`/prospects/${id}`),
  createProspect: (data: any) => request('/prospects', { method: 'POST', body: JSON.stringify(data) }),
  updateProspect: (id: string, data: any) => request(`/prospects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  convertProspect: (id: string, data: any) => request(`/prospects/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),

  // Internal Messaging / Mailbox
  getConversations: (params: { folder?: 'inbox' | 'sent' | 'unread'; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.folder) qs.append('folder', params.folder);
    if (params.search) qs.append('search', params.search);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/chat/conversations${query}`).then((r) => r.conversations || []);
  },
  getConversationDetails: (conversationId: number) =>
    request(`/chat/conversations/${conversationId}`).then((r) => r.conversation),
  composeMessage: (data: { toUserIds: number[]; ccUserIds?: number[]; subject: string; message: string; attachments?: any[] }) =>
    request('/chat/compose', { method: 'POST', body: JSON.stringify(data) }),
  uploadChatAttachment: (formData: FormData) =>
    request('/chat/upload', { method: 'POST', body: formData }),
  replyMessage: (conversationId: number, data: { message: string; isReplyAll?: boolean; attachments?: any[] }) =>
    request(`/chat/conversations/${conversationId}/reply`, { method: 'POST', body: JSON.stringify(data) }),
  getInternalEmployees: () => request('/chat/employees').then((r) => r.employees || []),
  searchEmployeesForMessaging: (q: string) =>
    request(`/chat/search/employees?q=${encodeURIComponent(q)}`).then((r) => r.employees || []),
  getMessages: (conversationId: number) =>
    request(`/chat/conversations/${conversationId}/messages`).then((r) => r.messages || []),
  sendMessage: (conversationId: number, message: string) =>
    request(`/chat/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
  markMessagesRead: (conversationId: number) =>
    request(`/chat/conversations/${conversationId}/read`, { method: 'POST' }),
  startDirectChat: (targetUserId: number) =>
    request('/chat/conversations/direct', { method: 'POST', body: JSON.stringify({ targetUserId }) }).then(
      (r) => r.conversation
    ),

  // Email Verification
  requestEmailVerification: (email: string) => request('/email-verification/send', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmail: (token: string) => request('/email-verification/verify', { method: 'POST', body: JSON.stringify({ token }) }),
  getVerificationStatus: (email: string) => request(`/email-verification/status?email=${encodeURIComponent(email)}`),
  verifyCustomerEmail: (email: string) =>
    request('/email-verification/customer-verify', { method: 'POST', body: JSON.stringify({ email }) }),
  checkCustomerEmailVerification: (email: string) =>
    request(`/email-verification/check-status?email=${encodeURIComponent(email)}`),
  toggleProductStatus: (id: string, isActive: boolean) =>
    request(`/products/${id}/status`, { method: 'POST', body: JSON.stringify({ isActive }) }),
  getProductStats: () => request('/products/stats'),
  deleteProduct: (id: string) => request(`/products/${id}`, { method: 'DELETE' }),
  getProductModules: (productId: string) => request(`/products/${productId}/modules`),
  createProductModule: (productId: string, data: any) =>
    request(`/products/${productId}/modules`, { method: 'POST', body: JSON.stringify(data) }),
  updateProductModule: (moduleId: string, data: any) =>
    request(`/products/modules/${moduleId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProductModule: (moduleId: string) =>
    request(`/products/modules/${moduleId}`, { method: 'DELETE' }),
  createProductSubmodule: (moduleId: string, data: any) =>
    request(`/products/modules/${moduleId}/submodules`, { method: 'POST', body: JSON.stringify(data) }),
  updateProductSubmodule: (submoduleId: string, data: any) =>
    request(`/products/submodules/${submoduleId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProductSubmodule: (submoduleId: string) =>
    request(`/products/submodules/${submoduleId}`, { method: 'DELETE' }),

  // Subscriptions & AMC
  getSubscriptions: (params: any = {}) => request(`/subscriptions${toQueryString(params)}`),
  getSubscription: (id: string) => request(`/subscriptions/${id}`),
  createSubscription: (data: any) => request('/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  updateSubscription: (id: string, data: any) => request(`/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  sendSubscriptionWarning: (id: string, message?: string) =>
    request(`/subscriptions/${id}/warning`, { method: 'POST', body: JSON.stringify({ message }) }),
  renewSubscription: (id: string, data: any) =>
    request(`/subscriptions/${id}/renew`, { method: 'POST', body: JSON.stringify(data) }),
  getSubscriptionStats: () => request('/subscriptions/stats'),

  // Implementations
  getImplementations: (params: any = {}) => request(`/implementations${toQueryString(params)}`),
  getImplementation: (id: string) => request(`/implementations/${id}`),
  getEntitledImplementationModules: (companyId: string, productId: string) =>
    request(`/implementations/entitled-modules?companyId=${encodeURIComponent(companyId)}&productId=${encodeURIComponent(productId)}`),
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
  getTaskAllotmentQueue: (params: any = {}) => request(`/task-allotment/queue${toQueryString(params)}`),
  getEligibleEmployees: () => request('/task-allotment/eligible-employees'),
  getAllotmentStats: () => request('/task-allotment/stats'),
  directAssignTicket: (data: any) => request('/task-allotment/assign', { method: 'POST', body: JSON.stringify(data) }),

  // Audit Logs
  getAuditLogs: () => request('/audit-logs'),

  // Employee Tasks (Task Reminders)
  getMyTasks: (params: any = {}) => request(`/employee-tasks${toQueryString(params)}`),
  getMyTaskSummary: () => request('/employee-tasks/summary'),
  getEligibleTaskAssignees: () => request('/employee-tasks/eligible-assignees'),
  getTaskById: (id: string) => request(`/employee-tasks/${id}`),
  getDueReminders: () => request('/employee-tasks/reminders'),
  createTask: (data: any) => request('/employee-tasks', { method: 'POST', body: JSON.stringify(data) }),
  uploadTaskAttachment: (formData: FormData) => request('/employee-tasks/upload', { method: 'POST', body: formData }),
  updateTask: (id: string, data: any) => request(`/employee-tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  completeTask: (id: string) => request(`/employee-tasks/${id}/complete`, { method: 'POST' }),
  deleteTask: (id: string) => request(`/employee-tasks/${id}`, { method: 'DELETE' }),
};

