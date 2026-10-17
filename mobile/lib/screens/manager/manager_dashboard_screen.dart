import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/tickets_provider.dart';
import '../../providers/allotment_provider.dart';
import '../../models/ticket_model.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_badge.dart';
import '../../widgets/app_drawer.dart';
import '../employee/employee_ticket_detail_screen.dart';

class ManagerDashboardScreen extends StatefulWidget {
  const ManagerDashboardScreen({super.key});

  @override
  State<ManagerDashboardScreen> createState() => _ManagerDashboardScreenState();
}

class _ManagerDashboardScreenState extends State<ManagerDashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AllotmentProvider>().fetchQueue();
      context.read<AllotmentProvider>().fetchEligibleEmployees();
      context.read<TicketsProvider>().fetchTickets(status: 'MANAGER_REVIEW');
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showAllotDialog(TicketModel ticket) {
    final allotmentProvider = context.read<AllotmentProvider>();
    final employees = allotmentProvider.employees;
    String? selectedEmployeeId =
        employees.isNotEmpty ? employees.first.id : null;
    String selectedLevel = ticket.assignedLevel;
    final notesController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Assign Specialist for ${ticket.id}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  ticket.problemType,
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: selectedEmployeeId,
                  decoration: const InputDecoration(
                      labelText: 'Assign to Specialist *'),
                  items: employees.map((e) {
                    return DropdownMenuItem(
                      value: e.id,
                      child: Text(
                          '${e.name} (${e.level} • ${e.openTicketsCount} active)'),
                    );
                  }).toList(),
                  onChanged: (val) =>
                      setDialogState(() => selectedEmployeeId = val),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: selectedLevel,
                  decoration:
                      const InputDecoration(labelText: 'Target Level Tier'),
                  items: const [
                    DropdownMenuItem(value: 'L1', child: Text('L1 Specialist')),
                    DropdownMenuItem(
                        value: 'L2', child: Text('L2 Senior Specialist')),
                    DropdownMenuItem(
                        value: 'L3', child: Text('L3 Principal Specialist')),
                  ],
                  onChanged: (val) =>
                      setDialogState(() => selectedLevel = val ?? 'L1'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesController,
                  decoration: const InputDecoration(
                    labelText: 'Assignment Notes',
                    hintText: 'Direct allocation via manager portal',
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
              onPressed: () async {
                if (selectedEmployeeId == null) return;
                Navigator.pop(ctx);
                final ok = await allotmentProvider.assignTicket(
                  ticketId: ticket.id,
                  employeeId: selectedEmployeeId!,
                  level: selectedLevel,
                  notes: notesController.text.trim(),
                );
                if (ok && mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content:
                            Text('Ticket successfully assigned to specialist!'),
                        backgroundColor: AppColors.success),
                  );
                }
              },
              child: const Text('Confirm Assignment'),
            ),
          ],
        ),
      ),
    );
  }

  void _showApprovalDialog(TicketModel ticket) {
    final notesController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Review Resolution • ${ticket.id}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              ticket.problemType,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            const SizedBox(height: 8),
            Text(
              'Technical description: ${ticket.description}',
              style:
                  const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: notesController,
              decoration: const InputDecoration(
                labelText: 'Manager Approval Remarks',
                hintText: 'Verified and approved for client delivery',
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
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await context.read<TicketsProvider>().approveResolution(
                      ticket.id,
                      notes: notesController.text.trim(),
                    );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text(
                            'Resolution approved and moved to Customer Verification!'),
                        backgroundColor: AppColors.success),
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
              }
            },
            child: const Text('Approve Resolution'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final allotmentProvider = context.watch<AllotmentProvider>();
    final ticketsProvider = context.watch<TicketsProvider>();

    final pendingApprovals = ticketsProvider.tickets
        .where((t) => t.status == 'MANAGER_REVIEW')
        .toList();

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Service Manager Operations'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              allotmentProvider.fetchQueue();
              allotmentProvider.fetchEligibleEmployees();
              ticketsProvider.fetchTickets(status: 'MANAGER_REVIEW');
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: [
            Tab(text: 'Task Allotment (${allotmentProvider.queue.length})'),
            Tab(text: 'Approvals (${pendingApprovals.length})'),
          ],
        ),
      ),
      drawer: const AppDrawer(),
      body: TabBarView(
        controller: _tabController,
        children: [
          // 1. Task Allotment Queue
          RefreshIndicator(
            onRefresh: () => allotmentProvider.fetchQueue(),
            child: allotmentProvider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : allotmentProvider.queue.isEmpty
                    ? const Center(
                        child: Text('No tickets currently awaiting allotment.'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: allotmentProvider.queue.length,
                        itemBuilder: (ctx, i) {
                          final t = allotmentProvider.queue[i];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(t.id,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.brandPrimary)),
                                      StatusBadge(status: t.status),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(t.problemType,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 14)),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Client: ${t.companyName ?? t.companyId} • Level: ${t.assignedLevel}',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textMuted),
                                  ),
                                  const SizedBox(height: 10),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      OutlinedButton(
                                        onPressed: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                                builder: (_) =>
                                                    EmployeeTicketDetailScreen(
                                                        ticketId: t.id)),
                                          );
                                        },
                                        child: const Text('View'),
                                      ),
                                      const SizedBox(width: 8),
                                      ElevatedButton(
                                        onPressed: () => _showAllotDialog(t),
                                        child: const Text('Allot Specialist'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),

          // 2. Manager Approvals
          RefreshIndicator(
            onRefresh: () =>
                ticketsProvider.fetchTickets(status: 'MANAGER_REVIEW'),
            child: pendingApprovals.isEmpty
                ? const Center(
                    child:
                        Text('No tickets currently awaiting Manager Review.'))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: pendingApprovals.length,
                    itemBuilder: (ctx, i) {
                      final t = pendingApprovals[i];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(t.id,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.brandPrimary)),
                                  StatusBadge(status: t.status),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(t.problemType,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14)),
                              const SizedBox(height: 4),
                              Text(
                                'Resolved by: ${t.assignedEmployeeName ?? "Specialist"} • Level: ${t.assignedLevel}',
                                style: const TextStyle(
                                    fontSize: 12, color: AppColors.textMuted),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  OutlinedButton(
                                    onPressed: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                            builder: (_) =>
                                                EmployeeTicketDetailScreen(
                                                    ticketId: t.id)),
                                      );
                                    },
                                    child: const Text('Review Notes'),
                                  ),
                                  const SizedBox(width: 8),
                                  ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                        backgroundColor: AppColors.success),
                                    onPressed: () => _showApprovalDialog(t),
                                    child: const Text('Approve Resolution'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
