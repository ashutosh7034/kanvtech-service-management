import 'package:flutter/foundation.dart';
import '../models/ticket_model.dart';
import '../services/api_service.dart';

class TicketsProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  List<TicketModel> _tickets = [];
  TicketModel? _currentTicket;
  bool _isLoading = false;
  String? _errorMessage;

  List<TicketModel> get tickets => _tickets;
  TicketModel? get currentTicket => _currentTicket;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // Active tickets for two-ticket rule checking
  int get activeTicketsCount =>
      _tickets.where((t) => !['RESOLVED', 'CLOSED'].contains(t.status)).length;
  bool get canCustomerCreateTicket => activeTicketsCount < 2;

  Future<void> fetchTickets({
    String? status,
    String? priority,
    String? level,
    String? employeeId,
    String? companyId,
    String? search,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _tickets = await _api.getTickets(
        status: status,
        priority: priority,
        level: level,
        employeeId: employeeId,
        companyId: companyId,
        search: search,
      );
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchTicketDetails(String id) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _currentTicket = await _api.getTicketDetails(id);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<TicketModel> createTicket({
    required String problemType,
    required String priority,
    required String category,
    required String description,
    String? companyId,
    int? customerContactId,
    String? productId,
    String? branchId,
    String? assignedEmployeeId,
  }) async {
    final ticket = await _api.createTicket(
      problemType: problemType,
      priority: priority,
      category: category,
      description: description,
      companyId: companyId,
      customerContactId: customerContactId,
      productId: productId,
      branchId: branchId,
      assignedEmployeeId: assignedEmployeeId,
    );
    await fetchTickets();
    return ticket;
  }

  Future<void> startWork(String ticketId) async {
    await _api.startWork(ticketId);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> pauseWork(String ticketId) async {
    await _api.pauseWork(ticketId);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> resumeWork(String ticketId) async {
    await _api.resumeWork(ticketId);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> escalateTicket(
    String ticketId, {
    required String targetLevel,
    required String reason,
    String? notes,
    String? assignedToEmployeeId,
  }) async {
    await _api.escalateTicket(
      ticketId,
      targetLevel: targetLevel,
      reason: reason,
      notes: notes,
      assignedToEmployeeId: assignedToEmployeeId,
    );
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> resolveTicket(String ticketId,
      {required String resolutionNotes}) async {
    await _api.resolveTicket(ticketId, resolutionNotes: resolutionNotes);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> approveResolution(String ticketId, {String? notes}) async {
    await _api.approveResolution(ticketId, notes: notes);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> reopenTicket(String ticketId, {required String reason}) async {
    await _api.reopenTicket(ticketId, reason: reason);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> submitFeedback(String ticketId,
      {required int rating, String? remarks}) async {
    await _api.submitFeedback(ticketId, rating: rating, remarks: remarks);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> closeTicket(String ticketId, {String? closureReason}) async {
    await _api.closeTicket(ticketId, closureReason: closureReason);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> addComment(String ticketId,
      {required String message, bool isInternal = false}) async {
    await _api.addComment(ticketId, message: message, isInternal: isInternal);
    await fetchTicketDetails(ticketId);
  }

  Future<void> assignTicket({
    required String ticketId,
    required String employeeId,
    String level = 'L1',
    String? notes,
  }) async {
    await _api.assignTicket(
      ticketId: ticketId,
      employeeId: employeeId,
      level: level,
      notes: notes,
    );
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }
}
