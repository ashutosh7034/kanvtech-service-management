import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/operations_provider.dart';
import '../../providers/tickets_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';
import '../manager/manager_dashboard_screen.dart';
import '../management/companies_screen.dart';
import '../management/departments_screen.dart';
import '../management/employees_screen.dart';
import '../management/products_screen.dart';
import '../management/implementations_screen.dart';
import '../management/maintenance_screen.dart';
import '../management/prospects_screen.dart';
import '../management/reports_screen.dart';
import '../management/escalations_screen.dart';
import '../management/approvals_screen.dart';
import '../management/sla_settings_screen.dart';
import '../management/audit_logs_screen.dart';

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
      drawer: const AppDrawer(),
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
              'Administrative Governance & Master Data',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary),
            ),
            const SizedBox(height: 10),

            _navTile(
              icon: Icons.assignment_ind,
              title: 'Task Allotment & Workload Queue',
              subtitle: 'Specialist workload distribution and manual ticket assignments',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ManagerDashboardScreen())),
            ),
            _navTile(
              icon: Icons.priority_high,
              title: 'Senior Tier Escalation Queue',
              subtitle: 'L2 and L3 escalated tickets review and rebalancing',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EscalationsScreen())),
            ),
            _navTile(
              icon: Icons.verified_outlined,
              title: 'Resolution Approvals',
              subtitle: 'Review resolved tickets and sign off on technical resolutions',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ApprovalsScreen())),
            ),
            _navTile(
              icon: Icons.business_outlined,
              title: 'Customer Master Directory',
              subtitle: 'Manage client companies, branch locations, and contacts',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CompaniesScreen())),
            ),
            _navTile(
              icon: Icons.apartment_outlined,
              title: 'Department Master',
              subtitle: 'Configure departments, specializations, and leads',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const DepartmentsScreen())),
            ),
            _navTile(
              icon: Icons.people_outline,
              title: 'Specialist Employee Directory',
              subtitle: 'Directory, tier management (L1/L2/L3), and status',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EmployeesScreen())),
            ),
            _navTile(
              icon: Icons.inventory_2_outlined,
              title: 'Product Master Catalog',
              subtitle: 'Enterprise software products, modules, and submodules',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProductsScreen())),
            ),
            _navTile(
              icon: Icons.rocket_launch_outlined,
              title: 'Client Implementations',
              subtitle: 'Track new onboarding projects, milestone stages, and tasks',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ImplementationsScreen())),
            ),
            _navTile(
              icon: Icons.handshake_outlined,
              title: 'Annual Maintenance & AMC Subscriptions',
              subtitle: 'Manage client contracts, renewal dates, and expiry alerts',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const MaintenanceScreen())),
            ),
            _navTile(
              icon: Icons.contact_support_outlined,
              title: 'Enquiries & Prospects',
              subtitle: 'Track incoming client requests and conversion pipeline',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProspectsScreen())),
            ),
            _navTile(
              icon: Icons.analytics_outlined,
              title: 'Operational Analytics & Reports',
              subtitle: 'Resolution by tier, SLA compliance, and workload stats',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReportsScreen())),
            ),
            _navTile(
              icon: Icons.tune,
              title: 'SLA Configuration',
              subtitle: 'Response & resolution time limits for priority tiers',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SlaSettingsScreen())),
            ),
            _navTile(
              icon: Icons.security,
              title: 'Security & Audit Logs',
              subtitle: 'Platform security audit trail, user actions, and timestamps',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AuditLogsScreen())),
            ),
            _navTile(
              icon: Icons.settings_suggest,
              title: 'Ticket Auto-Assignment Rule',
              subtitle: 'Currently routed to default tier: ${ops.autoAssignmentLevel}',
              onTap: () => _showAssignmentSettingDialog(ops.autoAssignmentLevel),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _navTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: AppColors.brandPrimary),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        trailing: const Icon(Icons.chevron_right, size: 18),
        onTap: onTap,
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
