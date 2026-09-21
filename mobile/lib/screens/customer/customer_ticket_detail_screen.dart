import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/tickets_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_badge.dart';

class CustomerTicketDetailScreen extends StatefulWidget {
  final String ticketId;

  const CustomerTicketDetailScreen({super.key, required this.ticketId});

  @override
  State<CustomerTicketDetailScreen> createState() => _CustomerTicketDetailScreenState();
}

class _CustomerTicketDetailScreenState extends State<CustomerTicketDetailScreen> {
  int _selectedRating = 5;
  final _feedbackCommentController = TextEditingController();
  bool _isSubmittingFeedback = false;
  bool _isClosing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TicketsProvider>().fetchTicketDetails(widget.ticketId);
    });
  }

  @override
  void dispose() {
    _feedbackCommentController.dispose();
    super.dispose();
  }

  Future<void> _handleFeedbackSubmit() async {
    setState(() => _isSubmittingFeedback = true);
    try {
      await context.read<TicketsProvider>().submitFeedback(
        widget.ticketId,
        rating: _selectedRating,
        comments: _feedbackCommentController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Thank you! Feedback recorded.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmittingFeedback = false);
    }
  }

  Future<void> _handleCloseTicket() async {
    setState(() => _isClosing = true);
    try {
      await context.read<TicketsProvider>().closeTicket(widget.ticketId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ticket closed successfully.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isClosing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ticketsProvider = context.watch<TicketsProvider>();
    final details = ticketsProvider.currentTicketDetails;
    final ticket = details?['ticket'];

    if (ticketsProvider.isLoading && ticket == null) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.ticketId)),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (ticket == null) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.ticketId)),
        body: const Center(child: Text('Ticket not found')),
      );
    }

    final String status = ticket['status'] ?? 'OPEN';
    final bool isResolved = status == 'RESOLVED';
    final bool isClosed = status == 'CLOSED';
    final feedback = details?['feedback'] ?? ticket['feedback'];

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: Text('Ticket ${ticket['id']}'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ticketsProvider.fetchTicketDetails(widget.ticketId),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Status & Overview Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          ticket['id'] ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.brandPrimary),
                        ),
                        StatusBadge(status: status),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      ticket['problem_type'] ?? ticket['problemType'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      ticket['description'] ?? '',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                    ),
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _infoItem('Priority', ticket['priority'] ?? 'MEDIUM'),
                        _infoItem('Category', ticket['category'] ?? 'SOFTWARE'),
                        _infoItem('SLA Status', ticket['sla_status'] ?? ticket['slaStatus'] ?? 'ON_TRACK'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Resolution Info (if resolved/closed)
            if (ticket['resolution_summary'] != null || ticket['root_cause'] != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.check_circle_outline, color: AppColors.success, size: 18),
                          SizedBox(width: 8),
                          Text('Resolution Information', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (ticket['root_cause'] != null) ...[
                        const Text('Root Cause:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
                        const SizedBox(height: 2),
                        Text('${ticket['root_cause']}', style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                        const SizedBox(height: 8),
                      ],
                      if (ticket['resolution_summary'] != null || ticket['resolution_steps'] != null) ...[
                        const Text('Resolution Steps:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
                        const SizedBox(height: 2),
                        Text('${ticket['resolution_summary'] ?? ticket['resolution_steps']}', style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                      ],
                    ],
                  ),
                ),
              ),

            // Customer Feedback Card
            if (isResolved || isClosed) ...[
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Service Quality Feedback',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        feedback != null
                            ? 'Your feedback has been submitted.'
                            : 'Please rate the service quality for this resolution.',
                        style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                      ),
                      const SizedBox(height: 12),
                      if (feedback != null) ...[
                        Row(
                          children: List.generate(
                            5,
                            (index) => Icon(
                              index < (feedback['rating'] ?? 5) ? Icons.star : Icons.star_border,
                              color: Colors.amber,
                              size: 24,
                            ),
                          ),
                        ),
                        if (feedback['comments'] != null && feedback['comments'].toString().isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text('"${feedback['comments']}"', style: const TextStyle(fontStyle: FontStyle.italic, fontSize: 13)),
                        ],
                      ] else ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(5, (index) {
                            final star = index + 1;
                            return IconButton(
                              icon: Icon(
                                star <= _selectedRating ? Icons.star : Icons.star_border,
                                color: Colors.amber,
                                size: 30,
                              ),
                              onPressed: () => setState(() => _selectedRating = star),
                            );
                          }),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _feedbackCommentController,
                          maxLines: 2,
                          decoration: const InputDecoration(
                            hintText: 'Add comments regarding service delivery (optional)...',
                          ),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: _isSubmittingFeedback ? null : _handleFeedbackSubmit,
                          child: _isSubmittingFeedback
                              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : const Text('Submit Feedback'),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],

            // Close Ticket Button (if resolved and not closed)
            if (isResolved && !isClosed) ...[
              const SizedBox(height: 12),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.success,
                  foregroundColor: Colors.white,
                ),
                onPressed: _isClosing ? null : _handleCloseTicket,
                icon: const Icon(Icons.check),
                label: _isClosing
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Acknowledge & Close Ticket'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _infoItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
      ],
    );
  }
}
