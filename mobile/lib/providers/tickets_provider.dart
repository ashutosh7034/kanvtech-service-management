import 'package:flutter/foundation.dart';
import '../models/ticket_model.dart';
import '../services/api_service.dart';

class TicketsProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  List<TicketModel> _tickets = [];
  Map<String, dynamic>? _currentTicketDetails;
  bool _isLoading = false;
  String? _errorMessage;

  List<TicketModel> get tickets => _tickets;
  Map<String, dynamic>? get currentTicketDetails => _currentTicketDetails;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // Active tickets for two-ticket rule checking
  int get activeTicketsCount => _tickets.where((t) => !['RESOLVED', 'CLOSED'].contains(t.status)).length;
  bool get canCustomerCreateTicket => activeTicketsCount < 2;

  Future<void> fetchTickets({String? status, String? priority}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _tickets = await _api.getTickets(status: status, priority: priority);
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
      _currentTicketDetails = await _api.getTicketDetails(id);
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
  }) async {
    final ticket = await _api.createTicket(
      problemType: problemType,
      priority: priority,
      category: category,
      description: description,
      companyId: companyId,
      customerContactId: customerContactId,
    );
    await fetchTickets();
    return ticket;
  }

  Future<void> startTimer(String ticketId) async {
    await _api.startTimer(ticketId);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> stopTimer(String ticketId) async {
    await _api.stopTimer(ticketId);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> escalateTicket(String ticketId, {required String toLevel, required String reason, String? notes}) async {
    await _api.escalateTicket(ticketId, toLevel: toLevel, reason: reason, notes: notes);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> resolveTicket(String ticketId, {required String rootCause, required String resolutionSteps}) async {
    await _api.resolveTicket(ticketId, rootCause: rootCause, resolutionSteps: resolutionSteps);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> submitFeedback(String ticketId, {required int rating, String? comments}) async {
    await _api.submitFeedback(ticketId, rating: rating, comments: comments);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> closeTicket(String ticketId) async {
    await _api.closeTicket(ticketId);
    await fetchTicketDetails(ticketId);
    await fetchTickets();
  }

  Future<void> addInternalNote(String ticketId, String noteText) async {
    await _api.addInternalNote(ticketId, noteText);
    await fetchTicketDetails(ticketId);
  }
}
