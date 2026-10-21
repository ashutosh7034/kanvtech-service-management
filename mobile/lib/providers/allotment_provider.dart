import 'package:flutter/foundation.dart';
import '../models/ticket_model.dart';
import '../models/master_models.dart';
import '../services/api_service.dart';

class AllotmentProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  List<TicketModel> _queue = [];
  List<EmployeeSummaryModel> _employees = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<TicketModel> get queue => _queue;
  List<EmployeeSummaryModel> get employees => _employees;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchQueue({String? level, String? search}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _queue = await _api.getTaskAllotmentQueue(level: level, search: search);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchEligibleEmployees() async {
    try {
      _employees = await _api.getEligibleEmployees();
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> assignTicket({
    required String ticketId,
    required String employeeId,
    String level = 'L1',
    String? notes,
  }) async {
    try {
      await _api.assignTicket(
        ticketId: ticketId,
        employeeId: employeeId,
        level: level,
        notes: notes,
      );
      await fetchQueue();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      notifyListeners();
      return false;
    }
  }
}
