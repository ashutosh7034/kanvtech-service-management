import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/tickets_provider.dart';
import '../../models/ticket_model.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_badge.dart';

class CustomerTicketDetailScreen extends StatefulWidget {
  final String ticketId;

  const CustomerTicketDetailScreen({super.key, required this.ticketId});

  @override
  State<CustomerTicketDetailScreen> createState() =>
      _CustomerTicketDetailScreenState();
}

class _CustomerTicketDetailScreenState
    extends State<CustomerTicketDetailScreen> {
  final _commentController = TextEditingController();
  bool _isSendingComment = false;
  bool _isProcessingAction = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TicketsProvider>().fetchTicketDetails(widget.ticketId);
    });
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  void _showReopenDialog() {
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reopen Ticket'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'If the technical issue is still persisting, please explain why you are reopening this ticket. This will move the ticket back to the engineering queue.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Reason for Reopening *',
                hintText: 'e.g. Issue recurred when accessing invoices...',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () async {
              final reason = reasonController.text.trim();
              if (reason.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('Please state the reason for reopening')),
                );
                return;
              }
              Navigator.pop(ctx);
              setState(() => _isProcessingAction = true);
              try {
                await context
                    .read<TicketsProvider>()
                    .reopenTicket(widget.ticketId, reason: reason);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content:
                          Text('Ticket reopened and returned to active queue.'),
                      backgroundColor: AppColors.warning,
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content:
                            Text(e.toString().replaceFirst('Exception: ', ''))),
                  );
                }
              } finally {
                if (mounted) setState(() => _isProcessingAction = false);
              }
            },
            child: const Text('Confirm Reopen'),
          ),
        ],
      ),
    );
  }

  void _showFeedbackDialog() {
    int rating = 5;
    final remarksController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Verify Resolution & Rate'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Please confirm resolution and submit your CSAT satisfaction rating. Submitting will formally close this ticket.',
                  style:
                      TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                Center(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(5, (index) {
                      final starValue = index + 1;
                      return IconButton(
                        icon: Icon(
                          starValue <= rating ? Icons.star : Icons.star_border,
                          color: const Color(0xFFF59E0B),
                          size: 32,
                        ),
                        onPressed: () {
                          setDialogState(() => rating = starValue);
                        },
                      );
                    }),
                  ),
                ),
                Center(
                  child: Text(
                    '$rating / 5 Stars',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: remarksController,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Comments / Remarks (Optional)',
                    hintText: 'Share your feedback on the resolution...',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style:
                  ElevatedButton.styleFrom(backgroundColor: AppColors.success),
              onPressed: () async {
                Navigator.pop(ctx);
                setState(() => _isProcessingAction = true);
                try {
                  await context.read<TicketsProvider>().submitFeedback(
                        widget.ticketId,
                        rating: rating,
                        remarks: remarksController.text.trim(),
                      );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content:
                            Text('Feedback recorded! Ticket is now CLOSED.'),
                        backgroundColor: AppColors.success,
                      ),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text(
                              e.toString().replaceFirst('Exception: ', ''))),
                    );
                  }
                } finally {
                  if (mounted) setState(() => _isProcessingAction = false);
                }
              },
              child: const Text('Accept & Close'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleSendComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    setState(() => _isSendingComment = true);
    try {
      await context.read<TicketsProvider>().addComment(
            widget.ticketId,
            message: text,
            isInternal: false,
          );
      _commentController.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _isSendingComment = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ticketsProvider = context.watch<TicketsProvider>();
    final ticket = ticketsProvider.currentTicket;

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: Text(ticket?.id ?? widget.ticketId),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ticketsProvider.fetchTicketDetails(widget.ticketId),
          ),
        ],
      ),
      body: ticketsProvider.isLoading && ticket == null
          ? const Center(child: CircularProgressIndicator())
          : ticket == null
              ? Center(
                  child: Text(ticketsProvider.errorMessage ??
                      'Ticket details unavailable'),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header Card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      ticket.problemType,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ),
                                  StatusBadge(status: ticket.status),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(
                                ticket.description,
                                style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textSecondary,
                                    height: 1.4),
                              ),
                              const SizedBox(height: 14),
                              const Divider(),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 16,
                                runSpacing: 8,
                                children: [
                                  _metaItem('Priority', ticket.priority),
                                  _metaItem('Category', ticket.category),
                                  if (ticket.productName != null)
                                    _metaItem('Product', ticket.productName!),
                                  if (ticket.branchName != null)
                                    _metaItem('Branch', ticket.branchName!),
                                  if (ticket.assignedEmployeeName != null)
                                    _metaItem('Specialist',
                                        ticket.assignedEmployeeName!),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Verification / Reopen Action Banner
                      if (ticket.canCustomerReopen || ticket.canCustomerRate)
                        Card(
                          color: const Color(0xFFFEF3C7),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                const Row(
                                  children: [
                                    Icon(Icons.rate_review_outlined,
                                        color: Color(0xFFB45309)),
                                    SizedBox(width: 8),
                                    Text(
                                      'Technical Resolution Awaiting Verification',
                                      style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF92400E)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                const Text(
                                  'The engineering team has marked this issue as resolved. Please verify whether your issue is fixed.',
                                  style: TextStyle(
                                      fontSize: 12, color: Color(0xFF78350F)),
                                ),
                                const SizedBox(height: 14),
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton(
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: AppColors.danger,
                                          side: const BorderSide(
                                              color: AppColors.danger),
                                        ),
                                        onPressed: _isProcessingAction
                                            ? null
                                            : _showReopenDialog,
                                        child: const Text('Reopen Ticket'),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppColors.success,
                                        ),
                                        onPressed: _isProcessingAction
                                            ? null
                                            : _showFeedbackDialog,
                                        child: const Text('Accept & Close'),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),

                      if (ticket.feedback != null) ...[
                        const SizedBox(height: 12),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Your CSAT Feedback',
                                  style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                      color: AppColors.textPrimary),
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    ...List.generate(5, (index) {
                                      final r = ticket.feedback?['rating'] ?? 5;
                                      return Icon(
                                        index < r
                                            ? Icons.star
                                            : Icons.star_border,
                                        color: const Color(0xFFF59E0B),
                                        size: 18,
                                      );
                                    }),
                                    const SizedBox(width: 8),
                                    Text(
                                      '${ticket.feedback?['rating']} / 5 Stars',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 12),
                                    ),
                                  ],
                                ),
                                if (ticket.feedback?['remarks'] != null &&
                                    ticket.feedback!['remarks']
                                        .toString()
                                        .isNotEmpty) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    '"${ticket.feedback!['remarks']}"',
                                    style: const TextStyle(
                                        fontStyle: FontStyle.italic,
                                        fontSize: 12,
                                        color: AppColors.textSecondary),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 16),
                      // Communication & Comments Feed
                      const Text(
                        'Communication Feed',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),

                      if (ticket.comments.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 20),
                          child: Center(
                            child: Text('No messages on this ticket yet.',
                                style: TextStyle(
                                    color: AppColors.textMuted, fontSize: 12)),
                          ),
                        )
                      else
                        ...ticket.comments
                            .where((c) => !c.isInternal)
                            .map((c) => _buildCommentTile(c)),

                      const SizedBox(height: 12),
                      // Message Input Box (only if not closed)
                      if (!ticket.isClosed) ...[
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _commentController,
                                decoration: const InputDecoration(
                                  hintText:
                                      'Type message to support engineers...',
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton.filled(
                              icon: _isSendingComment
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                          color: Colors.white, strokeWidth: 2),
                                    )
                                  : const Icon(Icons.send),
                              onPressed:
                                  _isSendingComment ? null : _handleSendComment,
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
    );
  }

  Widget _metaItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
        const SizedBox(height: 2),
        Text(value,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary)),
      ],
    );
  }

  Widget _buildCommentTile(TicketCommentModel comment) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: AppColors.bgSurface,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  comment.authorName ?? 'Support Specialist',
                  style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                      color: AppColors.brandPrimary),
                ),
                Text(
                  comment.createdAt != null
                      ? '${comment.createdAt!.hour.toString().padLeft(2, '0')}:${comment.createdAt!.minute.toString().padLeft(2, '0')}'
                      : '',
                  style:
                      const TextStyle(fontSize: 10, color: AppColors.textMuted),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              comment.message,
              style:
                  const TextStyle(fontSize: 12, color: AppColors.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}
