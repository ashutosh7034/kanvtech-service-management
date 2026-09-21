import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/user_model.dart';
import '../models/ticket_model.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String? _token;

  String get baseUrl {
    const configuredUrl = String.fromEnvironment('API_URL');
    if (configuredUrl.isNotEmpty) {
      return configuredUrl;
    }
    if (kReleaseMode) {
      throw StateError(
        'API_URL compile-time environment variable must be specified for release builds (e.g. flutter build apk --dart-define=API_URL=https://api.yourdomain.com/api)',
      );
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

  Map<String, String> _headers({bool isJson = true}) {
    final headers = <String, String>{};
    if (isJson) headers['Content-Type'] = 'application/json';
    if (_token != null) headers['Authorization'] = 'Bearer $_token';
    return headers;
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: _headers(),
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] != false) {
      _token = data['token'];
      return data;
    }
    throw Exception(data['error'] ?? 'Authentication failed');
  }

  Future<UserModel> getMe() async {
    final res = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: _headers(),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode == 200 && data['user'] != null) {
      return UserModel.fromJson(data['user']);
    }
    throw Exception(data['error'] ?? 'Failed to get profile');
  }

  Future<List<TicketModel>> getTickets({String? status, String? priority}) async {
    final queryParams = <String, String>{};
    if (status != null && status != 'ALL') queryParams['status'] = status;
    if (priority != null && priority != 'ALL') queryParams['priority'] = priority;

    final uri = Uri.parse('$baseUrl/tickets').replace(queryParameters: queryParams.isEmpty ? null : queryParams);
    final res = await http.get(uri, headers: _headers());
    final rawTickets = data['data'] ?? data['tickets'];
    if (res.statusCode == 200 && rawTickets != null) {
      return (rawTickets as List).map((t) => TicketModel.fromJson(t)).toList();
    }
    throw Exception(data['error'] ?? 'Failed to load tickets');
  }

  Future<Map<String, dynamic>> getTicketDetails(String id) async {
    final res = await http.get(
      Uri.parse('$baseUrl/tickets/$id'),
      headers: _headers(),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode == 200 && data['ticket'] != null) {
      return data;
    }
    throw Exception(data['error'] ?? 'Failed to load ticket details');
  }

  Future<TicketModel> createTicket({
    required String problemType,
    required String priority,
    required String category,
    required String description,
    String? companyId,
    int? customerContactId,
  }) async {
    final payload = {
      'problem_type': problemType,
      'priority': priority,
      'category': category,
      'description': description,
    };
    if (companyId != null) payload['company_id'] = companyId;
    if (customerContactId != null) payload['customer_contact_id'] = customerContactId.toString();

    final res = await http.post(
      Uri.parse('$baseUrl/tickets'),
      headers: _headers(),
      body: jsonEncode(payload),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['ticket'] != null) {
      return TicketModel.fromJson(data['ticket']);
    }
    throw Exception(data['error'] ?? 'Failed to create ticket');
  }

  Future<void> startTimer(String ticketId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/timer/start'),
      headers: _headers(),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400 || data['success'] == false) {
      throw Exception(data['error'] ?? 'Failed to start timer');
    }
  }

  Future<void> stopTimer(String ticketId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/timer/stop'),
      headers: _headers(),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400 || data['success'] == false) {
      throw Exception(data['error'] ?? 'Failed to stop timer');
    }
  }

  Future<void> escalateTicket(String ticketId, {required String toLevel, required String reason, String? notes}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/escalate'),
      headers: _headers(),
      body: jsonEncode({
        'targetLevel': toLevel,
        'reason': reason,
        'notes': notes ?? '',
      }),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400 || data['success'] == false) {
      throw Exception(data['error'] ?? 'Failed to escalate ticket');
    }
  }

  Future<void> resolveTicket(String ticketId, {required String rootCause, required String resolutionSteps}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/resolve'),
      headers: _headers(),
      body: jsonEncode({
        'rootCause': rootCause,
        'resolutionSteps': resolutionSteps,
      }),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400 || data['success'] == false) {
      throw Exception(data['error'] ?? 'Failed to resolve ticket');
    }
  }

  Future<void> submitFeedback(String ticketId, {required int rating, String? comments}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/feedback'),
      headers: _headers(),
      body: jsonEncode({
        'rating': rating,
        'comments': comments ?? '',
      }),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400 || data['success'] == false) {
      throw Exception(data['error'] ?? 'Failed to submit feedback');
    }
  }

  Future<void> closeTicket(String ticketId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/close'),
      headers: _headers(),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400 || data['success'] == false) {
      throw Exception(data['error'] ?? 'Failed to close ticket');
    }
  }

  Future<void> addInternalNote(String ticketId, String noteText) async {
    final res = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketId/notes'),
      headers: _headers(),
      body: jsonEncode({
        'note_text': noteText,
        'is_internal': true,
      }),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400 || data['success'] == false) {
      throw Exception(data['error'] ?? 'Failed to add internal note');
    }
  }
}
