import 'package:flutter/foundation.dart';
import '../models/master_models.dart';
import '../services/api_service.dart';

class OperationsProvider with ChangeNotifier {
  final ApiService _api = ApiService();

  List<EmployeeTaskModel> _tasks = [];
  List<ChatConversationModel> _conversations = [];
  List<ChatMessageModel> _currentMessages = [];
  DashboardStatsModel? _dashboardStats;
  String _autoAssignmentLevel = 'L1';
  bool _isLoading = false;
  String? _errorMessage;

  List<EmployeeTaskModel> get tasks => _tasks;
  List<ChatConversationModel> get conversations => _conversations;
  List<ChatMessageModel> get currentMessages => _currentMessages;
  DashboardStatsModel? get dashboardStats => _dashboardStats;
  String get autoAssignmentLevel => _autoAssignmentLevel;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // Tasks
  Future<void> fetchTasks() async {
    _isLoading = true;
    notifyListeners();
    try {
      _tasks = await _api.getMyTasks();
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> createTask(String title,
      {String? description,
      String priority = 'MEDIUM',
      DateTime? dueDate}) async {
    await _api.createEmployeeTask(
        title: title,
        description: description,
        priority: priority,
        dueDate: dueDate);
    await fetchTasks();
  }

  Future<void> completeTask(String id) async {
    await _api.completeEmployeeTask(id);
    await fetchTasks();
  }

  // Chat
  Future<void> fetchConversations() async {
    _isLoading = true;
    notifyListeners();
    try {
      _conversations = await _api.getConversations();
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchMessages(int conversationId) async {
    try {
      _currentMessages = await _api.getMessages(conversationId);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> sendMessage(int conversationId, String message) async {
    await _api.sendChatMessage(conversationId, message);
    await fetchMessages(conversationId);
  }

  // Attendance
  Future<void> checkIn({double? lat, double? lng, String? address}) async {
    await _api.checkInAttendance(lat: lat, lng: lng, address: address);
  }

  Future<void> checkOut({double? lat, double? lng, String? address}) async {
    await _api.checkOutAttendance(lat: lat, lng: lng, address: address);
  }

  // Admin & Reports
  Future<void> fetchAdminDashboard() async {
    _isLoading = true;
    notifyListeners();
    try {
      _dashboardStats = await _api.getDashboardStats();
      _autoAssignmentLevel = await _api.getAutoAssignmentLevel();
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateAutoAssignmentLevel(String level) async {
    await _api.setAutoAssignmentLevel(level);
    _autoAssignmentLevel = level;
    notifyListeners();
  }
}
