import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/user_model.dart';
import '../models/ticket_model.dart';
import '../models/master_models.dart';

class SessionTerminatedException implements Exception {
  final String message;
  const SessionTerminatedException([this.message = 'Your account has been logged in on another device. You have been logged out for security reasons.']);

  @override
  String toString() => message;
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String? _token;
  String? _customBaseUrl;
  void Function(String message)? onSessionTerminated;

  void setCustomBaseUrl(String? url) {
    if (url != null && url.trim().isNotEmpty) {
      _customBaseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    } else {
      _customBaseUrl = null;
    }
  }

  String get baseUrl {
    if (_customBaseUrl != null && _customBaseUrl!.isNotEmpty) {
      return _customBaseUrl!;
    }
    const configuredUrl = String.fromEnvironment('API_URL');
    if (configuredUrl.isNotEmpty) {
      return configuredUrl.replaceAll(RegExp(r'/+$'), '');
    }
    if (kIsWeb) return 'http://localhost:5000/api';
    try {
      if (Platform.isAndroid) return 'http://10.0.2.2:5000/api';
    } catch (_) {}
    return 'http://localhost:5000/api';
  }

  void setToken(String? token) {
    _token = token;
  }

  String? get token => _token;

  Map<String, String> _headers({bool isJson = true}) {
    final headers = <String, String>{};
    if (isJson) headers['Content-Type'] = 'application/json';
    headers['Accept'] = 'application/json';
    if (_token != null && _token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  dynamic _processResponse(http.Response res) {
    dynamic data;
    try {
      data = jsonDecode(res.body);
    } catch (_) {
      data = {
        'error': res.body.isNotEmpty
            ? res.body
            : 'Server responded with HTTP ${res.statusCode}'
      };
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (data is Map && data['success'] == false) {
        throw Exception(data['message'] ?? data['error'] ?? 'Operation failed');
      }
      return data;
    }

    if (res.statusCode == 401) {
      final isTerminated = data is Map &&
          (data['code'] == 'SESSION_TERMINATED' ||
              (data['message']?.toString().contains('logged in on another device') ?? false));

      if (isTerminated) {
        const msg =
            'Your account has been logged in on another device. You have been logged out for security reasons.';
        _token = null;
        onSessionTerminated?.call(msg);
        throw const SessionTerminatedException(msg);
      }
    }

    if (data is Map) {
      final msg = data['message'] ??
          data['error'] ??
          'Server error (${res.statusCode})';
      if (msg is List) {
        throw Exception(msg.join(', '));
      }
      throw Exception(msg);
    }
    throw Exception('Request failed with HTTP status ${res.statusCode}');
  }

  // ===========================================================================
  // AUTHENTICATION
  // ===========================================================================

  Future<Map<String, dynamic>> login(String email, String password,
      {bool rememberMe = true}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: _headers(),
      body: jsonEncode({
        'email': email.trim(),
        'password': password,
        'rememberMe': rememberMe,
      }),
    );
    final data = _processResponse(res);
    if (data is Map<String, dynamic> && data['token'] != null) {
      _token = data['token'];
      return data;
    }
    throw Exception('Authentication response missing access token');
  }

  Future<UserModel> getMe() async {
    final res = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    if (data is Map && data['user'] != null) {
      return UserModel.fromJson(data['user']);
    }
    throw Exception('Failed to resolve profile from server session');
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    String? confirmPassword,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/auth/change-password'),
      headers: _headers(),
      body: jsonEncode({
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword ?? newPassword,
      }),
    );
    _processResponse(res);
  }

  Future<void> logout() async {
    try {
      if (_token != null) {
        await http.post(
          Uri.parse('$baseUrl/auth/logout'),
          headers: _headers(),
        );
      }
    } catch (_) {}
    _token = null;
  }

  // ===========================================================================
  // TICKETS CORE
  // ===========================================================================

  Future<List<TicketModel>> getTickets({
    String? status,
    String? priority,
    String? level,
    String? employeeId,
    String? companyId,
    String? search,
    int? page,
    int? limit,
  }) async {
    final queryParams = <String, String>{};
    if (status != null && status != 'ALL') queryParams['status'] = status;
    if (priority != null && priority != 'ALL')
      queryParams['priority'] = priority;
    if (level != null && level != 'ALL') queryParams['level'] = level;
    if (employeeId != null) queryParams['employeeId'] = employeeId;
    if (companyId != null) queryParams['companyId'] = companyId;
    if (search != null && search.trim().isNotEmpty)
      queryParams['search'] = search.trim();
    if (page != null) queryParams['page'] = page.toString();
    if (limit != null) queryParams['limit'] = limit.toString();

    final uri = Uri.parse('$baseUrl/tickets').replace(
      queryParameters: queryParams.isEmpty ? null : queryParams,
    );
    final res = await http.get(uri, headers: _headers());
    final data = _processResponse(res);

    final rawList = data['tickets'] ?? data['data'];
    if (rawList is List) {
      return rawList
          .map((t) => TicketModel.fromJson(t as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<TicketModel> getTicketDetails(String id) async {
    final res = await http.get(
      Uri.parse('$baseUrl/tickets/$id'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    if (data['ticket'] != null) {
      return TicketModel.fromJson(data['ticket']);
    }
    throw Exception('Ticket not found');
  }

  Future<TicketModel> createTicket({
    required String problemType,
    required String priority,
    required String category,
    required String description,
    String? companyId,
    int? customerContactId,
    String? productId,
    String? moduleId,
    String? submoduleId,
    String? branchId,
    String? assignedEmployeeId,
  }) async {
    final payload = <String, dynamic>{
      'problem_type': problemType,
      'priority': priority,
      'category': category,
      'description': description,
    };
    if (companyId != null && companyId.isNotEmpty)
      payload['company_id'] = companyId;
    if (customerContactId != null && customerContactId > 0)
      payload['customer_contact_id'] = customerContactId;
    if (productId != null && productId.isNotEmpty)
      payload['product_id'] = productId;
    if (moduleId != null && moduleId.isNotEmpty)
      payload['module_id'] = moduleId;
    if (submoduleId != null && submoduleId.isNotEmpty)
      payload['submodule_id'] = submoduleId;
    if (branchId != null && branchId.isNotEmpty)
      payload['branch_id'] = branchId;
    if (assignedEmployeeId != null && assignedEmployeeId.isNotEmpty)
      payload['assigned_employee_id'] = assignedEmployeeId;

    final res = await http.post(
      Uri.parse('$baseUrl/tickets'),
      headers: _headers(),
      body: jsonEncode(payload),
    );
    final data = _processResponse(res);
    if (data['ticket'] != null) {
      return TicketModel.fromJson(data['ticket']);
    }
    throw Exception(data['message'] ?? 'Failed to open ticket');
  }

  // Timer Controls
  Future<void> startWork(String ticketId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/start'),
      headers: _headers(),
      body: jsonEncode({}),
    );
    _processResponse(res);
  }

  Future<void> pauseWork(String ticketId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/pause'),
      headers: _headers(),
      body: jsonEncode({}),
    );
    _processResponse(res);
  }

  Future<void> resumeWork(String ticketId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/resume'),
      headers: _headers(),
      body: jsonEncode({}),
    );
    _processResponse(res);
  }

  // Escalation & Resolution
  Future<void> escalateTicket(
    String ticketId, {
    required String targetLevel,
    required String reason,
    String? notes,
    String? assignedToEmployeeId,
  }) async {
    final payload = <String, dynamic>{
      'toLevel': targetLevel,
      'targetLevel': targetLevel,
      'reason': reason,
      'notes': notes ?? '',
    };
    if (assignedToEmployeeId != null)
      payload['assignedToEmployeeId'] = assignedToEmployeeId;

    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/escalate'),
      headers: _headers(),
      body: jsonEncode(payload),
    );
    _processResponse(res);
  }

  Future<void> resolveTicket(String ticketId,
      {required String resolutionNotes}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/resolve'),
      headers: _headers(),
      body: jsonEncode({
        'resolutionNotes': resolutionNotes,
        'notes': resolutionNotes,
      }),
    );
    _processResponse(res);
  }

  Future<void> approveResolution(String ticketId, {String? notes}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/approve'),
      headers: _headers(),
      body: jsonEncode({'notes': notes ?? 'Approved by Service Manager'}),
    );
    _processResponse(res);
  }

  Future<void> reopenTicket(String ticketId, {required String reason}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/reopen'),
      headers: _headers(),
      body: jsonEncode({
        'reason': reason,
        'reopenReason': reason,
      }),
    );
    _processResponse(res);
  }

  Future<void> submitFeedback(String ticketId,
      {required int rating, String? remarks}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/feedback'),
      headers: _headers(),
      body: jsonEncode({
        'rating': rating,
        'remarks': remarks ?? '',
      }),
    );
    _processResponse(res);
  }

  Future<void> closeTicket(String ticketId, {String? closureReason}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/close'),
      headers: _headers(),
      body: jsonEncode({
        'closureReason': closureReason ?? 'Ticket closed via mobile app',
      }),
    );
    _processResponse(res);
  }

  Future<void> addComment(String ticketId,
      {required String message, bool isInternal = false}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/comments'),
      headers: _headers(),
      body: jsonEncode({
        'commentType': isInternal ? 'INTERNAL_NOTE' : 'CUSTOMER_COMMUNICATION',
        'message': message,
      }),
    );
    _processResponse(res);
  }

  Future<void> assignTicket({
    required String ticketId,
    required String employeeId,
    String level = 'L1',
    String? notes,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/assign'),
      headers: _headers(),
      body: jsonEncode({
        'employeeId': employeeId,
        'level': level,
        'notes': notes ?? 'Direct assignment via mobile portal',
      }),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // TASK ALLOTMENT & WORKLOAD
  // ===========================================================================

  Future<List<TicketModel>> getTaskAllotmentQueue(
      {String? level, String? search}) async {
    final queryParams = <String, String>{};
    if (level != null && level != 'ALL') queryParams['level'] = level;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    final uri = Uri.parse('$baseUrl/task-allotment/queue').replace(
      queryParameters: queryParams.isEmpty ? null : queryParams,
    );
    final res = await http.get(uri, headers: _headers());
    final data = _processResponse(res);

    final rawList = data['queue'] ?? data['tickets'] ?? data['data'];
    if (rawList is List) {
      return rawList
          .map((t) => TicketModel.fromJson(t as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<List<EmployeeSummaryModel>> getEligibleEmployees() async {
    final res = await http.get(
      Uri.parse('$baseUrl/task-allotment/eligible-employees'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    final rawList = data['employees'] ?? data['data'];
    if (rawList is List) {
      return rawList
          .map((e) => EmployeeSummaryModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  // ===========================================================================
  // MASTER DATA
  // ===========================================================================

  Future<List<CompanyModel>> getCompanies() async {
    final res = await http.get(
      Uri.parse('$baseUrl/companies'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    final rawList = data['companies'] ?? data['data'];
    if (rawList is List) {
      return rawList
          .map((c) => CompanyModel.fromJson(c as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<List<BranchModel>> getCompanyBranches(String companyId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/companies/$companyId/branches'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    final rawList = data['branches'] ?? data['data'];
    if (rawList is List) {
      return rawList
          .map((b) => BranchModel.fromJson(b as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<List<ProductModel>> getProducts() async {
    final res = await http.get(
      Uri.parse('$baseUrl/products'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    final rawList = data['products'] ?? data['data'];
    if (rawList is List) {
      return rawList
          .map((p) => ProductModel.fromJson(p as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  // ===========================================================================
  // EMPLOYEE TASKS & REMINDERS
  // ===========================================================================

  Future<List<EmployeeTaskModel>> getMyTasks() async {
    final res = await http.get(
      Uri.parse('$baseUrl/employee-tasks'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    final rawList = data['tasks'] ?? data['data'];
    if (rawList is List) {
      return rawList
          .map((t) => EmployeeTaskModel.fromJson(t as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<void> createEmployeeTask({
    required String title,
    String? description,
    String priority = 'MEDIUM',
    DateTime? dueDate,
  }) async {
    final payload = <String, dynamic>{
      'title': title,
      'priority': priority,
    };
    if (description != null) payload['description'] = description;
    if (dueDate != null) payload['dueDate'] = dueDate.toIso8601String();

    final res = await http.post(
      Uri.parse('$baseUrl/employee-tasks'),
      headers: _headers(),
      body: jsonEncode(payload),
    );
    _processResponse(res);
  }

  Future<void> completeEmployeeTask(String taskId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/employee-tasks/$taskId/complete'),
      headers: _headers(),
      body: jsonEncode({}),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // INTERNAL MESSAGING (CHAT)
  // ===========================================================================

  Future<List<ChatConversationModel>> getConversations() async {
    final res = await http.get(
      Uri.parse('$baseUrl/chat/conversations'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    final rawList = data['conversations'] ?? data['data'];
    if (rawList is List) {
      return rawList
          .map((c) => ChatConversationModel.fromJson(c as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<List<ChatMessageModel>> getMessages(int conversationId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/chat/conversations/$conversationId/messages'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    final rawList = data['messages'] ?? data['data'];
    if (rawList is List) {
      return rawList
          .map((m) => ChatMessageModel.fromJson(m as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<void> sendChatMessage(int conversationId, String message) async {
    final res = await http.post(
      Uri.parse('$baseUrl/chat/conversations/$conversationId/messages'),
      headers: _headers(),
      body: jsonEncode({'message': message}),
    );
    _processResponse(res);
  }

  Future<void> composeChatMessage({
    required List<int> toUserIds,
    required String subject,
    required String message,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/chat/compose'),
      headers: _headers(),
      body: jsonEncode({
        'toUserIds': toUserIds,
        'subject': subject,
        'message': message,
      }),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // EMPLOYEE ATTENDANCE
  // ===========================================================================

  Future<void> checkInAttendance(
      {double? lat, double? lng, String? address}) async {
    final payload = <String, dynamic>{};
    if (lat != null) payload['locationLat'] = lat;
    if (lng != null) payload['locationLng'] = lng;
    if (address != null) payload['locationAddress'] = address;

    final res = await http.post(
      Uri.parse('$baseUrl/employees/attendance/check-in'),
      headers: _headers(),
      body: jsonEncode(payload),
    );
    _processResponse(res);
  }

  Future<void> checkOutAttendance(
      {double? lat, double? lng, String? address}) async {
    final payload = <String, dynamic>{};
    if (lat != null) payload['locationLat'] = lat;
    if (lng != null) payload['locationLng'] = lng;
    if (address != null) payload['locationAddress'] = address;

    final res = await http.post(
      Uri.parse('$baseUrl/employees/attendance/check-out'),
      headers: _headers(),
      body: jsonEncode(payload),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // ADMIN & REPORTS
  // ===========================================================================

  Future<DashboardStatsModel> getDashboardStats() async {
    final res = await http.get(
      Uri.parse('$baseUrl/reports/dashboard'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    return DashboardStatsModel.fromJson(
        data is Map<String, dynamic> ? data : {});
  }

  Future<String> getAutoAssignmentLevel() async {
    final res = await http.get(
      Uri.parse('$baseUrl/tickets/settings/auto-assignment-level'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    return data['level']?.toString() ?? 'L1';
  }

  Future<void> setAutoAssignmentLevel(String level) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/settings/auto-assignment-level'),
      headers: _headers(),
      body: jsonEncode({'level': level}),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // COMPANY & BRANCH MANAGEMENT
  // ===========================================================================

  Future<void> createCompany({
    required String companyName,
    required String primaryEmail,
    required String contactPerson,
    required String contactPhone,
    String? address,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/companies'),
      headers: _headers(),
      body: jsonEncode({
        'companyName': companyName,
        'primaryEmail': primaryEmail,
        'contactPerson': contactPerson,
        'contactPhone': contactPhone,
        'address': address ?? '',
      }),
    );
    _processResponse(res);
  }

  Future<void> updateCompany(String id, Map<String, dynamic> data) async {
    final res = await http.put(
      Uri.parse('$baseUrl/companies/$id'),
      headers: _headers(),
      body: jsonEncode(data),
    );
    _processResponse(res);
  }

  Future<void> toggleCompanyStatus(String id, bool isActive) async {
    final res = await http.post(
      Uri.parse('$baseUrl/companies/$id/status'),
      headers: _headers(),
      body: jsonEncode({'isActive': isActive}),
    );
    _processResponse(res);
  }

  Future<void> createBranch(
    String companyId, {
    required String branchName,
    String? city,
    String? state,
    String? contactPerson,
    String? contactPhone,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/companies/$companyId/branches'),
      headers: _headers(),
      body: jsonEncode({
        'branchName': branchName,
        'city': city ?? '',
        'state': state ?? '',
        'contactPerson': contactPerson ?? '',
        'contactPhone': contactPhone ?? '',
      }),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // DEPARTMENTS
  // ===========================================================================

  Future<List<DepartmentModel>> getDepartments(
      {String? search, bool? isActive}) async {
    final queryParams = <String, String>{};
    if (search != null && search.isNotEmpty) queryParams['search'] = search;
    if (isActive != null) queryParams['isActive'] = isActive.toString();

    final uri = Uri.parse('$baseUrl/departments').replace(
      queryParameters: queryParams.isEmpty ? null : queryParams,
    );
    final res = await http.get(uri, headers: _headers());
    final data = _processResponse(res);
    final rawList =
        data is List ? data : (data['departments'] ?? data['data'] ?? []);
    if (rawList is List) {
      return rawList
          .map((d) => DepartmentModel.fromJson(d as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<void> createDepartment({
    required String name,
    String? code,
    String? description,
    List<String>? specializations,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/departments'),
      headers: _headers(),
      body: jsonEncode({
        'name': name,
        'code': code ?? '',
        'description': description ?? '',
        if (specializations != null) 'specializations': specializations,
      }),
    );
    _processResponse(res);
  }

  Future<void> updateDepartment(String id, Map<String, dynamic> data) async {
    final res = await http.put(
      Uri.parse('$baseUrl/departments/$id'),
      headers: _headers(),
      body: jsonEncode(data),
    );
    _processResponse(res);
  }

  Future<void> toggleDepartmentStatus(String id, bool isActive) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/departments/$id/status'),
      headers: _headers(),
      body: jsonEncode({'isActive': isActive}),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // EMPLOYEES
  // ===========================================================================

  Future<List<EmployeeDetailModel>> getEmployees({
    String? level,
    String? status,
    String? departmentId,
    String? search,
  }) async {
    final queryParams = <String, String>{};
    if (level != null && level != 'ALL') queryParams['level'] = level;
    if (status != null && status != 'ALL') queryParams['status'] = status;
    if (departmentId != null) queryParams['departmentId'] = departmentId;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    final uri = Uri.parse('$baseUrl/employees').replace(
      queryParameters: queryParams.isEmpty ? null : queryParams,
    );
    final res = await http.get(uri, headers: _headers());
    final data = _processResponse(res);
    final rawList =
        data['employees'] ?? data['data'] ?? (data is List ? data : []);
    if (rawList is List) {
      return rawList
          .map((e) => EmployeeDetailModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<void> createEmployee({
    required String name,
    required String email,
    required String password,
    String? phone,
    String role = 'EMPLOYEE',
    String level = 'L1',
    String? departmentId,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/employees'),
      headers: _headers(),
      body: jsonEncode({
        'name': name,
        'email': email,
        'password': password,
        'phone': phone ?? '',
        'role': role,
        'level': level,
        if (departmentId != null) 'departmentId': departmentId,
      }),
    );
    _processResponse(res);
  }

  Future<void> updateEmployee(String id, Map<String, dynamic> data) async {
    final res = await http.put(
      Uri.parse('$baseUrl/employees/$id'),
      headers: _headers(),
      body: jsonEncode(data),
    );
    _processResponse(res);
  }

  Future<void> promoteEmployee(String id, {String? level}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/employees/$id/promote'),
      headers: _headers(),
      body: jsonEncode({if (level != null) 'level': level}),
    );
    _processResponse(res);
  }

  Future<void> demoteEmployee(String id, {String? level}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/employees/$id/demote'),
      headers: _headers(),
      body: jsonEncode({if (level != null) 'level': level}),
    );
    _processResponse(res);
  }

  Future<void> toggleEmployeeStatus(String id) async {
    final res = await http.post(
      Uri.parse('$baseUrl/employees/$id/toggle-status'),
      headers: _headers(),
      body: jsonEncode({}),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // PRODUCTS
  // ===========================================================================

  Future<void> createProduct({
    required String name,
    String? description,
    String? category,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/products'),
      headers: _headers(),
      body: jsonEncode({
        'name': name,
        'description': description ?? '',
        'category': category ?? 'SOFTWARE',
      }),
    );
    _processResponse(res);
  }

  Future<void> toggleProductStatus(String id, bool isActive) async {
    final res = await http.post(
      Uri.parse('$baseUrl/products/$id/status'),
      headers: _headers(),
      body: jsonEncode({'isActive': isActive}),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // IMPLEMENTATIONS
  // ===========================================================================

  Future<List<ImplementationModel>> getImplementations({
    String? status,
    String? search,
  }) async {
    final queryParams = <String, String>{};
    if (status != null && status != 'ALL') queryParams['status'] = status;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    final uri = Uri.parse('$baseUrl/implementations').replace(
      queryParameters: queryParams.isEmpty ? null : queryParams,
    );
    final res = await http.get(uri, headers: _headers());
    final data = _processResponse(res);
    final rawList = data['implementations'] ?? data['data'] ?? [];
    if (rawList is List) {
      return rawList
          .map((i) => ImplementationModel.fromJson(i as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<void> createImplementation({
    required String companyId,
    required String productId,
    String? notes,
    DateTime? targetDate,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/implementations'),
      headers: _headers(),
      body: jsonEncode({
        'companyId': companyId,
        'productId': productId,
        'notes': notes ?? '',
        if (targetDate != null) 'targetDate': targetDate.toIso8601String(),
      }),
    );
    _processResponse(res);
  }

  Future<void> toggleImplementationTask(
      String taskId, bool isCompleted) async {
    final res = await http.post(
      Uri.parse('$baseUrl/implementations/tasks/$taskId/toggle'),
      headers: _headers(),
      body: jsonEncode({'isCompleted': isCompleted}),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // PROSPECTS / ENQUIRIES
  // ===========================================================================

  Future<List<ProspectModel>> getProspects({
    String? status,
    String? search,
  }) async {
    final queryParams = <String, String>{};
    if (status != null && status != 'ALL') queryParams['status'] = status;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    final uri = Uri.parse('$baseUrl/prospects').replace(
      queryParameters: queryParams.isEmpty ? null : queryParams,
    );
    final res = await http.get(uri, headers: _headers());
    final data = _processResponse(res);
    final rawList = data['prospects'] ?? data['data'] ?? [];
    if (rawList is List) {
      return rawList
          .map((p) => ProspectModel.fromJson(p as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<void> createProspect({
    required String companyName,
    required String contactPerson,
    required String phone,
    String? email,
    String? address,
    required String enquiry,
    String? source,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/prospects'),
      headers: _headers(),
      body: jsonEncode({
        'companyName': companyName,
        'contactPerson': contactPerson,
        'phone': phone,
        'email': email ?? '',
        'address': address ?? '',
        'enquiry': enquiry,
        'source': source ?? 'MOBILE_APP',
      }),
    );
    _processResponse(res);
  }

  Future<void> updateProspect(String id, Map<String, dynamic> data) async {
    final res = await http.put(
      Uri.parse('$baseUrl/prospects/$id'),
      headers: _headers(),
      body: jsonEncode(data),
    );
    _processResponse(res);
  }

  Future<void> convertProspect(String id, Map<String, dynamic> data) async {
    final res = await http.post(
      Uri.parse('$baseUrl/prospects/$id/convert'),
      headers: _headers(),
      body: jsonEncode(data),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // SUBSCRIPTIONS & MAINTENANCE
  // ===========================================================================

  Future<List<SubscriptionModel>> getSubscriptions({
    String? status,
    String? search,
  }) async {
    final queryParams = <String, String>{};
    if (status != null && status != 'ALL') queryParams['status'] = status;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    final uri = Uri.parse('$baseUrl/subscriptions').replace(
      queryParameters: queryParams.isEmpty ? null : queryParams,
    );
    final res = await http.get(uri, headers: _headers());
    final data = _processResponse(res);
    final rawList = data['subscriptions'] ?? data['data'] ?? [];
    if (rawList is List) {
      return rawList
          .map((s) => SubscriptionModel.fromJson(s as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<void> renewSubscription(String id,
      {required DateTime newEndDate, double? amount}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/subscriptions/$id/renew'),
      headers: _headers(),
      body: jsonEncode({
        'newEndDate': newEndDate.toIso8601String(),
        if (amount != null) 'amount': amount,
      }),
    );
    _processResponse(res);
  }

  Future<void> sendSubscriptionWarning(String id, {String? message}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/subscriptions/$id/warning'),
      headers: _headers(),
      body: jsonEncode({if (message != null) 'message': message}),
    );
    _processResponse(res);
  }

  // ===========================================================================
  // REPORTS, SLA & AUDIT
  // ===========================================================================

  Future<Map<String, dynamic>> getResolutionByLevel() async {
    final res = await http.get(
      Uri.parse('$baseUrl/reports/resolution-by-level'),
      headers: _headers(),
    );
    return _processResponse(res) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getWorkloadReport() async {
    final res = await http.get(
      Uri.parse('$baseUrl/reports/workload'),
      headers: _headers(),
    );
    return _processResponse(res) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getEscalationsReport() async {
    final res = await http.get(
      Uri.parse('$baseUrl/reports/escalations'),
      headers: _headers(),
    );
    return _processResponse(res) as Map<String, dynamic>;
  }

  Future<List<SlaConfigModel>> getSlaSettings() async {
    final res = await http.get(
      Uri.parse('$baseUrl/reports/sla'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    final rawList = data['configs'] ?? data['configurations'] ?? [];
    if (rawList is List) {
      return rawList
          .map((c) => SlaConfigModel.fromJson(c as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<void> updateSlaSettings({
    required String priority,
    required int responseTimeHours,
    required int resolutionTimeHours,
    required int warningThresholdPercent,
  }) async {
    final res = await http.put(
      Uri.parse('$baseUrl/reports/sla'),
      headers: _headers(),
      body: jsonEncode({
        'priority': priority,
        'response_time_hours': responseTimeHours,
        'resolution_time_hours': resolutionTimeHours,
        'warning_threshold_percent': warningThresholdPercent,
      }),
    );
    _processResponse(res);
  }

  Future<List<AuditLogModel>> getAuditLogs({int limit = 100}) async {
    final res = await http.get(
      Uri.parse('$baseUrl/audit-logs?limit=$limit'),
      headers: _headers(),
    );
    final data = _processResponse(res);
    final rawList = data['logs'] ?? [];
    if (rawList is List) {
      return rawList
          .map((l) => AuditLogModel.fromJson(l as Map<String, dynamic>))
          .toList();
    }
    return [];
  }
}
