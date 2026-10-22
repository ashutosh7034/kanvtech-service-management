import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';
import '../screens/role_shells.dart';
import '../screens/manager/manager_dashboard_screen.dart';
import '../screens/common/tasks_screen.dart';
import '../screens/common/chat_screen.dart';
import '../screens/common/attendance_screen.dart';
import '../screens/common/profile_screen.dart';
import '../screens/customer/create_ticket_screen.dart';
import '../screens/management/companies_screen.dart';
import '../screens/management/departments_screen.dart';
import '../screens/management/employees_screen.dart';
import '../screens/management/products_screen.dart';
import '../screens/management/implementations_screen.dart';
import '../screens/management/prospects_screen.dart';
import '../screens/management/maintenance_screen.dart';
import '../screens/management/reports_screen.dart';
import '../screens/management/escalations_screen.dart';
import '../screens/management/approvals_screen.dart';
import '../screens/management/sla_settings_screen.dart';
import '../screens/management/audit_logs_screen.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final role = user?.role.toUpperCase() ?? 'CUSTOMER';

    final isAdmin = role == 'ADMIN';
    final isManager = role == 'MANAGER';
    final isSeniorTech = role == 'L2_EMPLOYEE' || role == 'L3_EMPLOYEE';
    final isCustomer = role == 'CUSTOMER';

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            // Drawer Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              decoration: const BoxDecoration(
                color: AppColors.brandPrimary,
                borderRadius:
                    BorderRadius.only(bottomRight: Radius.circular(20)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.brandAccent,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'K',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'KANVTECH',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                              letterSpacing: 1.2,
                            ),
                          ),
                          Text(
                            'Service Management Platform',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    user?.displayName ?? 'Kanvtech User',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user?.email ?? '',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.accentLight.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      role.replaceAll('_', ' '),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Navigation List
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  _sectionHeader('OPERATIONS'),
                  _navItem(
                    context,
                    icon: Icons.dashboard_outlined,
                    title: 'Home Dashboard',
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushAndRemoveUntil(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const RoleShellDispatcher()),
                        (r) => false,
                      );
                    },
                  ),
                  if (isCustomer)
                    _navItem(
                      context,
                      icon: Icons.add_circle_outline,
                      title: 'Raise Support Ticket',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const CreateTicketScreen()));
                      },
                    ),
                  if (isAdmin || isManager)
                    _navItem(
                      context,
                      icon: Icons.assignment_ind_outlined,
                      title: 'Task Allotment & Workload',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) =>
                                    const ManagerDashboardScreen()));
                      },
                    ),
                  if (isAdmin || isManager || isSeniorTech)
                    _navItem(
                      context,
                      icon: Icons.priority_high,
                      title: 'Senior Tier Escalations',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const EscalationsScreen()));
                      },
                    ),
                  if (isAdmin || isManager)
                    _navItem(
                      context,
                      icon: Icons.verified_outlined,
                      title: 'Resolution Approvals',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const ApprovalsScreen()));
                      },
                    ),

                  // ORGANIZATION MASTER
                  if (isAdmin || isManager) ...[
                    _sectionHeader('ORGANIZATION MASTER'),
                    _navItem(
                      context,
                      icon: Icons.business_outlined,
                      title: 'Customer Master Directory',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const CompaniesScreen()));
                      },
                    ),
                    _navItem(
                      context,
                      icon: Icons.apartment_outlined,
                      title: 'Department Master',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const DepartmentsScreen()));
                      },
                    ),
                    _navItem(
                      context,
                      icon: Icons.people_outline,
                      title: 'Specialist Employee Directory',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const EmployeesScreen()));
                      },
                    ),
                    _navItem(
                      context,
                      icon: Icons.inventory_2_outlined,
                      title: 'Product Master Catalog',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const ProductsScreen()));
                      },
                    ),
                  ],

                  // CLIENT RELATIONS & CONTRACTS
                  _sectionHeader('CLIENT SERVICES'),
                  if (isAdmin || isManager)
                    _navItem(
                      context,
                      icon: Icons.rocket_launch_outlined,
                      title: 'Client Implementations',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const ImplementationsScreen()));
                      },
                    ),
                  _navItem(
                    context,
                    icon: Icons.handshake_outlined,
                    title: 'Annual Maintenance & AMC',
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const MaintenanceScreen()));
                    },
                  ),
                  if (isAdmin || isManager)
                    _navItem(
                      context,
                      icon: Icons.contact_support_outlined,
                      title: 'Enquiries & Prospects',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const ProspectsScreen()));
                      },
                    ),

                  // PRODUCTIVITY
                  if (!isCustomer) ...[
                    _sectionHeader('PRODUCTIVITY & CHAT'),
                    _navItem(
                      context,
                      icon: Icons.checklist_rtl_outlined,
                      title: 'My Tasks & Reminders',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const TasksScreen()));
                      },
                    ),
                    _navItem(
                      context,
                      icon: Icons.chat_bubble_outline,
                      title: 'Internal Messaging',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const ChatScreen()));
                      },
                    ),
                    _navItem(
                      context,
                      icon: Icons.access_time_outlined,
                      title: 'Employee Attendance',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const AttendanceScreen()));
                      },
                    ),
                  ],

                  // GOVERNANCE & ANALYTICS
                  if (isAdmin || isManager) ...[
                    _sectionHeader('ANALYTICS & GOVERNANCE'),
                    _navItem(
                      context,
                      icon: Icons.analytics_outlined,
                      title: 'Operational Analytics & Reports',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const ReportsScreen()));
                      },
                    ),
                  ],
                  if (isAdmin) ...[
                    _navItem(
                      context,
                      icon: Icons.tune,
                      title: 'SLA Configuration',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const SlaSettingsScreen()));
                      },
                    ),
                    _navItem(
                      context,
                      icon: Icons.security,
                      title: 'Security & Audit Logs',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const AuditLogsScreen()));
                      },
                    ),
                  ],

                  const Divider(),
                  _navItem(
                    context,
                    icon: Icons.person_outline,
                    title: 'Account Profile & Security',
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const ProfileScreen()));
                    },
                  ),
                ],
              ),
            ),

            // Footer Logout
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.borderSubtle)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.circle, size: 8, color: AppColors.success),
                  const SizedBox(width: 8),
                  const Text('Single Active Session',
                      style:
                          TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  const Spacer(),
                  TextButton.icon(
                    icon: const Icon(Icons.logout,
                        size: 16, color: AppColors.danger),
                    label: const Text('Logout',
                        style: TextStyle(
                            color: AppColors.danger,
                            fontSize: 13,
                            fontWeight: FontWeight.w600)),
                    onPressed: () {
                      Navigator.pop(context);
                      auth.logout();
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.1,
          color: AppColors.textMuted,
        ),
      ),
    );
  }

  Widget _navItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return ListTile(
      dense: true,
      leading: Icon(icon, size: 20, color: AppColors.brandPrimary),
      title: Text(
        title,
        style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: AppColors.textPrimary),
      ),
      onTap: onTap,
    );
  }
}
