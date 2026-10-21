import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/tickets_provider.dart';
import '../../models/ticket_model.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_badge.dart';

class EmployeeTicketDetailScreen extends StatefulWidget {
  final String ticketId;

  const EmployeeTicketDetailScreen({super.key, required this.ticketId});

  @override
  State<EmployeeTicketDetailScreen> createState() =>
      _EmployeeTicketDetailScreenState();
}

class _EmployeeTicketDetailScreenState
    extends State<EmployeeTicketDetailScreen> {
  final _noteController = TextEditingController();
  bool _isInternalNote = true;
  bool _isProcessingTimer = false;
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
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _handleTimerAction(TicketModel ticket) async {
    setState(() => _isProcessingTimer = true);
    final provider = context.read<TicketsProvider>();
    try {
      if (ticket.isTimerRunning) {
        await provider.pauseWork(widget.ticketId);
      } else if (ticket.isPaused) {
        await provider.resumeWork(widget.ticketId);
      } else {
        await provider.startWork(widget.ticketId);
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
      if (mounted) setState(() => _isProcessingTimer = false);
    }
  }

  void _showEscalateDialog(String currentLevel) {
    String targetLevel = 'L2';
    if (currentLevel == 'L2') targetLevel = 'L3';
    if (currentLevel == 'L3') targetLevel = 'PARENT_COMPANY';

    final reasonController = TextEditingController();
    final notesController = TextEditingController();

    showDialog(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Escalate Tier ($currentLevel -> $targetLevel)'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Continuous resolution timer is preserved across tiers.',
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: targetLevel,
                  decoration: const InputDecoration(labelText: 'Target Level'),
                  items: const [
                    DropdownMenuItem(
                        value: 'L2', child: Text('L2 Senior Specialist')),
                    DropdownMenuItem(
                        value: 'L3', child: Text('L3 Principal Architect')),
                    DropdownMenuItem(
                        value: 'PARENT_COMPANY',
                        child: Text('Parent Company / Vendor')),
                  ],
                  onChanged: (val) =>
                      setDialogState(() => targetLevel = val ?? 'L2'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reasonController,
                  decoration: const InputDecoration(
                    labelText: 'Escalation Reason *',
                    hintText: 'e.g. Requires deep DB indexing audit',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: notesController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Handoff Technical Notes',
                    hintText: 'Diagnostic logs, steps performed...',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style:
                  ElevatedButton.styleFrom(backgroundColor: AppColors.warning),
              onPressed: () async {
                final reason = reasonController.text.trim();
                if (reason.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Escalation reason is required.')),
                  );
                  return;
                }
                Navigator.pop(dialogCtx);
                setState(() => _isProcessingAction = true);
                try {
                  await context.read<TicketsProvider>().escalateTicket(
                        widget.ticketId,
                        targetLevel: targetLevel,
                        reason: reason,
                        notes: notesController.text.trim(),
                      );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text('Ticket escalated to $targetLevel')),
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
              child: const Text('Confirm Escalation'),
            ),
          ],
        ),
      ),
    );
  }

  void _showResolveDialog() {
    final resolutionController = TextEditingController();

    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Complete Technical Resolution'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Document the technical root cause and applied fix. This will stop the active timer and move the ticket to verification.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: resolutionController,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Resolution Summary *',
                hintText: 'Root cause and fix steps...',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
            onPressed: () async {
              final text = resolutionController.text.trim();
              if (text.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('Please describe the resolution applied.')),
                );
                return;
              }
              Navigator.pop(dialogCtx);
              setState(() => _isProcessingAction = true);
              try {
                await context.read<TicketsProvider>().resolveTicket(
                      widget.ticketId,
                      resolutionNotes: text,
                    );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Resolution submitted successfully!'),
                      backgroundColor: AppColors.success,
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
            child: const Text('Submit Resolution'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleAddNote() async {
    final text = _noteController.text.trim();
    if (text.isEmpty) return;

    setState(() => _isProcessingAction = true);
    try {
      await context.read<TicketsProvider>().addComment(
            widget.ticketId,
            message: text,
            isInternal: _isInternalNote,
          );
      _noteController.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessingAction = false);
    }
  }

  String _formatSeconds(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
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
                      'Ticket details unavailable'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Timer & Workflow Action Card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'SERVER RESOLUTION TIMER',
                                        style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.textMuted),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        _formatSeconds(
                                            ticket.totalResolutionSeconds),
                                        style: const TextStyle(
                                          fontSize: 22,
                                          fontWeight: FontWeight.bold,
                                          fontFamily: 'monospace',
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    ],
                                  ),
                                  ElevatedButton.icon(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: ticket.isTimerRunning
                                          ? AppColors.warning
                                          : (ticket.isPaused
                                              ? AppColors.brandSecondary
                                              : AppColors.success),
                                    ),
                                    icon: Icon(
                                      ticket.isTimerRunning
                                          ? Icons.pause
                                          : (ticket.isPaused
                                              ? Icons.play_arrow
                                              : Icons.play_arrow),
                                      size: 18,
                                    ),
                                    label: Text(
                                      ticket.isTimerRunning
                                          ? 'Pause Work'
                                          : (ticket.isPaused
                                              ? 'Resume Work'
                                              : 'Start Work'),
                                    ),
                                    onPressed: _isProcessingTimer
                                        ? null
                                        : () => _handleTimerAction(ticket),
                                  ),
                                ],
                              ),
                              if (ticket.status != 'RESOLVED' &&
                                  ticket.status != 'CLOSED') ...[
                                const SizedBox(height: 14),
                                const Divider(),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        icon: const Icon(Icons.arrow_upward,
                                            size: 16),
                                        label: const Text('Escalate Tier'),
                                        onPressed: _isProcessingAction
                                            ? null
                                            : () => _showEscalateDialog(
                                                ticket.assignedLevel),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                            backgroundColor: AppColors.success),
                                        icon: const Icon(Icons.check, size: 16),
                                        label: const Text('Resolve Ticket'),
                                        onPressed: _isProcessingAction
                                            ? null
                                            : _showResolveDialog,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Issue Overview Card
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
                                  Text(
                                    ticket.assignedLevel,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.brandPrimary),
                                  ),
                                  StatusBadge(status: ticket.status),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                ticket.problemType,
                                style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary),
                              ),
                              const SizedBox(height: 8),
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
                                  _metaItem('Client Company',
                                      ticket.companyName ?? ticket.companyId),
                                  _metaItem('Contact Person',
                                      ticket.contactName ?? 'Authorized User'),
                                  if (ticket.contactPhone != null)
                                    _metaItem('Phone', ticket.contactPhone!),
                                  _metaItem('Priority', ticket.priority),
                                  _metaItem('SLA Status', ticket.slaStatus),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Escalations history if any
                      if (ticket.escalations.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        const Text(
                          'Tier Escalation History',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 8),
                        ...ticket.escalations.map((esc) => Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          '${esc.fromLevel} -> ${esc.toLevel}',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.warning),
                                        ),
                                        Text(
                                          esc.escalatedByName ?? 'Technician',
                                          style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.textMuted),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text('Reason: ${esc.reason}',
                                        style: const TextStyle(fontSize: 12)),
                                    if (esc.notes != null &&
                                        esc.notes!.isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Text('Notes: ${esc.notes}',
                                          style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.textSecondary)),
                                    ],
                                  ],
                                ),
                              ),
                            )),
                      ],

                      const SizedBox(height: 16),
                      // Notes & Communication Stream
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Activity & Notes Feed',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary),
                          ),
                          Row(
                            children: [
                              Text(
                                _isInternalNote
                                    ? 'Internal Note'
                                    : 'Client Message',
                                style: const TextStyle(
                                    fontSize: 11, color: AppColors.textMuted),
                              ),
                              Switch(
                                value: _isInternalNote,
                                onChanged: (val) =>
                                    setState(() => _isInternalNote = val),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      if (ticket.comments.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(
                            child: Text(
                                'No notes or messages on this ticket yet.',
                                style: TextStyle(
                                    color: AppColors.textMuted, fontSize: 12)),
                          ),
                        )
                      else
                        ...ticket.comments.map((c) => _buildCommentTile(c)),

                      const SizedBox(height: 8),
                      // Add note input
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _noteController,
                              decoration: InputDecoration(
                                hintText: _isInternalNote
                                    ? 'Add internal diagnostic note...'
                                    : 'Send message to customer...',
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            icon: const Icon(Icons.send),
                            onPressed:
                                _isProcessingAction ? null : _handleAddNote,
                          ),
                        ],
                      ),
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

  Widget _buildCommentTile(TicketCommentModel c) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: c.isInternal ? const Color(0xFFFFFBEB) : AppColors.bgSurface,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      c.authorName ?? 'Technician',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          color: AppColors.textPrimary),
                    ),
                    const SizedBox(width: 6),
                    if (c.isInternal)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: const Text('INTERNAL',
                            style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFB45309))),
                      ),
                  ],
                ),
                Text(
                  c.createdAt != null
                      ? '${c.createdAt!.hour.toString().padLeft(2, '0')}:${c.createdAt!.minute.toString().padLeft(2, '0')}'
                      : '',
                  style:
                      const TextStyle(fontSize: 10, color: AppColors.textMuted),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(c.message,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}
