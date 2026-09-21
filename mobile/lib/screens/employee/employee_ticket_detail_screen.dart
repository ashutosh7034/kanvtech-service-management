import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/tickets_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_badge.dart';

class EmployeeTicketDetailScreen extends StatefulWidget {
  final String ticketId;

  const EmployeeTicketDetailScreen({super.key, required this.ticketId});

  @override
  State<EmployeeTicketDetailScreen> createState() => _EmployeeTicketDetailScreenState();
}

class _EmployeeTicketDetailScreenState extends State<EmployeeTicketDetailScreen> {
  final _noteController = TextEditingController();
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

  Future<void> _toggleTimer(bool isCurrentlyRunning) async {
    setState(() => _isProcessingTimer = true);
    try {
      final ticketsProvider = context.read<TicketsProvider>();
      if (isCurrentlyRunning) {
        await ticketsProvider.stopTimer(widget.ticketId);
      } else {
        await ticketsProvider.startTimer(widget.ticketId);
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
          title: Text('Escalate Ticket ($currentLevel -> $targetLevel)'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Timer continuity is preserved across all escalation levels.',
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
                const SizedBox(height: 14),
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
                    labelText: 'Handoff Notes',
                    hintText: 'Work done so far, diagnostic logs...',
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
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.warning),
              onPressed: () async {
                final reason = reasonController.text.trim();
                if (reason.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Escalation reason is required.')),
                  );
                  return;
                }
                Navigator.pop(dialogCtx);
                setState(() => _isProcessingAction = true);
                try {
                  await context.read<TicketsProvider>().escalateTicket(
                    widget.ticketId,
                    toLevel: targetLevel,
                    reason: reason,
                    notes: notesController.text.trim(),
                  );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Escalated to $targetLevel successfully.')),
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
    final rootCauseController = TextEditingController();
    final resolutionStepsController = TextEditingController();

    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Resolve Ticket'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: rootCauseController,
                decoration: const InputDecoration(
                  labelText: 'Root Cause *',
                  hintText: 'e.g. Memory leak in background worker',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: resolutionStepsController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Resolution Steps *',
                  hintText: 'Patched worker and verified memory stabilization',
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
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
            onPressed: () async {
              final rc = rootCauseController.text.trim();
              final steps = resolutionStepsController.text.trim();
              if (rc.isEmpty || steps.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Root cause and resolution steps are required.')),
                );
                return;
              }
              Navigator.pop(dialogCtx);
              setState(() => _isProcessingAction = true);
              try {
                await context.read<TicketsProvider>().resolveTicket(
                  widget.ticketId,
                  rootCause: rc,
                  resolutionSteps: steps,
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Ticket resolved! Submitted to manager review.'),
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
                if (mounted) setState(() => _isProcessingAction = false);
              }
            },
            child: const Text('Resolve & Submit'),
          ),
        ],
      ),
    );
  }

  void _showAddNoteDialog() {
    final noteController = TextEditingController();

    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Add Internal Work Note'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Internal notes are strictly isolated and NEVER visible to customers.',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: noteController,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Internal Note',
                hintText: 'Investigation findings, internal reproduction notes...',
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
            onPressed: () async {
              final note = noteController.text.trim();
              if (note.isEmpty) return;
              Navigator.pop(dialogCtx);
              try {
                await context.read<TicketsProvider>().addInternalNote(widget.ticketId, note);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Internal note saved.')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger),
                  );
                }
              }
            },
            child: const Text('Save Note'),
          ),
        ],
      ),
    );
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
    final String currentLevel = ticket['assigned_level'] ?? ticket['assignedLevel'] ?? 'L1';
    final int totalSeconds = ticket['total_resolution_seconds'] ?? ticket['totalResolutionSeconds'] ?? 0;
    final bool isTimerRunning = ticket['is_timer_running'] == 1 || (ticket['timer'] != null && ticket['timer']['isRunning'] == true);
    final List notes = details?['notes'] ?? [];

    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: Text('${ticket['id']} ($currentLevel)'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ticketsProvider.fetchTicketDetails(widget.ticketId),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Overview card
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
                    const SizedBox(height: 8),
                    Text(
                      ticket['problem_type'] ?? ticket['problemType'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Client: ${ticket['company_id'] ?? ticket['companyId']}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      ticket['description'] ?? '',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Continuous Resolution Timer Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Continuous Resolution Timer',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isTimerRunning ? AppColors.successBg : AppColors.bgSurfaceSubtle,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            isTimerRunning ? 'ACTIVE' : 'PAUSED',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: isTimerRunning ? AppColors.success : AppColors.textMuted,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Timer continuity preserved across L1 -> L2 -> L3. Zero resets.',
                      style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${minutes}m ${seconds}s',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: isTimerRunning ? AppColors.success : AppColors.textPrimary,
                          ),
                        ),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isTimerRunning ? AppColors.warning : AppColors.brandPrimary,
                            foregroundColor: Colors.white,
                          ),
                          onPressed: _isProcessingTimer ? null : () => _toggleTimer(isTimerRunning),
                          icon: Icon(isTimerRunning ? Icons.pause : Icons.play_arrow, size: 18),
                          label: Text(isTimerRunning ? 'Pause Session' : 'Start Session'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Technician Action Bar
            if (!['RESOLVED', 'CLOSED'].contains(status))
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _showAddNoteDialog,
                          icon: const Icon(Icons.note_add_outlined, size: 16),
                          label: const Text('Internal Note'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.warning,
                            foregroundColor: Colors.white,
                          ),
                          onPressed: _isProcessingAction ? null : () => _showEscalateDialog(currentLevel),
                          icon: const Icon(Icons.arrow_upward, size: 16),
                          label: const Text('Escalate'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.success,
                            foregroundColor: Colors.white,
                          ),
                          onPressed: _isProcessingAction ? null : _showResolveDialog,
                          icon: const Icon(Icons.check_circle_outline, size: 16),
                          label: const Text('Resolve'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 12),

            // Internal Work Notes Section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Internal Notes (Technician Only)',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                        ),
                        Text(
                          '${notes.length} notes',
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (notes.isEmpty)
                      const Text(
                        'No internal notes logged yet.',
                        style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: AppColors.textMuted),
                      )
                    else
                      ...notes.map((n) => Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.bgSurfaceSubtle,
                              borderRadius: BorderRadius.circular(6),
                              border: const Border(left: BorderSide(color: AppColors.brandPrimary, width: 3)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  n['note_text'] ?? n['noteText'] ?? '',
                                  style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'By: ${n['created_by'] ?? n['createdBy'] ?? "Technician"}',
                                  style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                                ),
                              ],
                            ),
                          )),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
