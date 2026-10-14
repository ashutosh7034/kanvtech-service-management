import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/operations_provider.dart';
import '../../providers/tickets_provider.dart';
import '../../theme/app_colors.dart';
import '../manager/manager_dashboard_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OperationsProvider>().fetchAdminDashboard();
      context.read<TicketsProvider>().fetchTickets();
    });
  }

  void _showAssignmentSettingDialog(String currentLevel) {
    String selected = currentLevel;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Auto-Assignment Tier Setting'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Configure the default specialist support tier to which newly created customer tickets are automatically routed by the engine:',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              _tierOption('L1', 'L1 Support Specialist (Standard)', selected,
                  (v) => setDialogState(() => selected = v)),
              _tierOption('L2', 'L2 Senior Specialist (Priority Direct)',
                  selected, (v) => setDialogState(() => selected = v)),
              _tierOption('L3', 'L3 Principal Architect', selected,
                  (v) => setDialogState(() => selected = v)),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await context
                    .read<OperationsProvider>()
                    .updateAutoAssignmentLevel(selected);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Auto-assignment tier set to $selected!'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                }
              },
              child: const Text('Save Setting'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final ops = context.watch<OperationsProvider>();
    final ticketsProvider = context.watch<TicketsProvider>();
    final stats = ops.dashboardStats;

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Administrator Operations'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ops.fetchAdminDashboard();
              ticketsProvider.fetchTickets();
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await ops.fetchAdminDashboard();
          await ticketsProvider.fetchTickets();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Admin Banner
            Card(
              color: AppColors.brandPrimaryLight,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(Icons.admin_panel_settings,
                        size: 36, color: AppColors.brandPrimary),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            auth.user?.displayName ?? 'System Administrator',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: AppColors.brandPrimary),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Platform Engine Status: Active & Operational',
                            style: TextStyle(
                                fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Operational KPI Grid
            const Text(
              'Real-Time Service KPIs',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary),
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(
                  child: _kpiCard(
                    'Active Tickets',
                    '${ticketsProvider.activeTicketsCount}',
                    Icons.confirmation_number_outlined,
                    AppColors.brandSecondary,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _kpiCard(
                    'Total Tickets',
                    '${stats?.totalTickets ?? ticketsProvider.tickets.length}',
                    Icons.analytics_outlined,
                    AppColors.brandPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _kpiCard(
                    'SLA Breached',
                    '${stats?.breachedSlaTickets ?? 0}',
                    Icons.alarm_off,
                    AppColors.danger,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _kpiCard(
                    'Auto-Route Tier',
                    ops.autoAssignmentLevel,
                    Icons.alt_route,
                    AppColors.warning,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Management Quick Actions
            const Text(
              'Administrative Governance',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary),
            ),
            const SizedBox(height: 10),

            Card(
              child: ListTile(
                leading: const Icon(Icons.assignment_ind,
                    color: AppColors.brandPrimary),
                title: const Text('Task Allotment & Workload Queue',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: const Text(
                    'Specialist workload distribution and ticket reassignments',
                    style: TextStyle(fontSize: 12)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const ManagerDashboardScreen()),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),

            Card(
              child: ListTile(
                leading: const Icon(Icons.settings_suggest,
                    color: AppColors.brandPrimary),
                title: const Text('Ticket Auto-Assignment Rule',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: Text(
                    'Currently routed to: ${ops.autoAssignmentLevel}',
                    style: const TextStyle(fontSize: 12)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () =>
                    _showAssignmentSettingDialog(ops.autoAssignmentLevel),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _kpiCard(String label, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textMuted)),
                Icon(icon, size: 18, color: color),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tierOption(String code, String label, String currentSelected,
      ValueChanged<String> onSelect) {
    final isSelected = code == currentSelected;
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
        color: isSelected ? AppColors.brandPrimary : AppColors.textMuted,
      ),
      title: Text(label,
          style: TextStyle(
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
      onTap: () => onSelect(code),
    );
  }
}
