import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';
import 'customer/customer_dashboard_screen.dart';
import 'customer/create_ticket_screen.dart';
import 'employee/employee_dashboard_screen.dart';
import 'manager/manager_dashboard_screen.dart';
import 'admin/admin_dashboard_screen.dart';
import 'common/tasks_screen.dart';
import 'common/chat_screen.dart';
import 'common/attendance_screen.dart';
import 'common/profile_screen.dart';
import 'login_screen.dart';

// ---------------------------------------------------------------------------
// CUSTOMER SHELL
// ---------------------------------------------------------------------------
class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int _currentIndex = 0;

  final _pages = const [
    CustomerDashboardScreen(),
    CreateTicketScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.inbox_outlined),
            selectedIcon: Icon(Icons.inbox, color: AppColors.brandPrimary),
            label: 'My Tickets',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_circle_outline),
            selectedIcon: Icon(Icons.add_circle, color: AppColors.brandPrimary),
            label: 'Raise Ticket',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: AppColors.brandPrimary),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// TECHNICIAN SHELL (L1 / L2 / L3 SPECIALISTS)
// ---------------------------------------------------------------------------
class TechnicianShell extends StatefulWidget {
  const TechnicianShell({super.key});

  @override
  State<TechnicianShell> createState() => _TechnicianShellState();
}

class _TechnicianShellState extends State<TechnicianShell> {
  int _currentIndex = 0;

  final _pages = const [
    EmployeeDashboardScreen(),
    TasksScreen(),
    ChatScreen(),
    AttendanceScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.assignment_outlined),
            selectedIcon: Icon(Icons.assignment, color: AppColors.brandPrimary),
            label: 'Work Queue',
          ),
          NavigationDestination(
            icon: Icon(Icons.checklist_rtl_outlined),
            selectedIcon:
                Icon(Icons.checklist_rtl, color: AppColors.brandPrimary),
            label: 'Tasks',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon:
                Icon(Icons.chat_bubble, color: AppColors.brandPrimary),
            label: 'Messages',
          ),
          NavigationDestination(
            icon: Icon(Icons.access_time_outlined),
            selectedIcon:
                Icon(Icons.access_time_filled, color: AppColors.brandPrimary),
            label: 'Attendance',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: AppColors.brandPrimary),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// MANAGER SHELL
// ---------------------------------------------------------------------------
class ManagerShell extends StatefulWidget {
  const ManagerShell({super.key});

  @override
  State<ManagerShell> createState() => _ManagerShellState();
}

class _ManagerShellState extends State<ManagerShell> {
  int _currentIndex = 0;

  final _pages = const [
    ManagerDashboardScreen(),
    TasksScreen(),
    ChatScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_customize_outlined),
            selectedIcon:
                Icon(Icons.dashboard_customize, color: AppColors.brandPrimary),
            label: 'Operations',
          ),
          NavigationDestination(
            icon: Icon(Icons.checklist_rtl_outlined),
            selectedIcon:
                Icon(Icons.checklist_rtl, color: AppColors.brandPrimary),
            label: 'Tasks',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon:
                Icon(Icons.chat_bubble, color: AppColors.brandPrimary),
            label: 'Messages',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: AppColors.brandPrimary),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// ADMIN SHELL
// ---------------------------------------------------------------------------
class AdminShell extends StatefulWidget {
  const AdminShell({super.key});

  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends State<AdminShell> {
  int _currentIndex = 0;

  final _pages = const [
    AdminDashboardScreen(),
    ManagerDashboardScreen(),
    TasksScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.shield_outlined),
            selectedIcon: Icon(Icons.shield, color: AppColors.brandPrimary),
            label: 'Overview',
          ),
          NavigationDestination(
            icon: Icon(Icons.assignment_ind_outlined),
            selectedIcon:
                Icon(Icons.assignment_ind, color: AppColors.brandPrimary),
            label: 'Allotment',
          ),
          NavigationDestination(
            icon: Icon(Icons.checklist_rtl_outlined),
            selectedIcon:
                Icon(Icons.checklist_rtl, color: AppColors.brandPrimary),
            label: 'Tasks',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: AppColors.brandPrimary),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// ROLE SHELL DISPATCHER
// ---------------------------------------------------------------------------
class RoleShellDispatcher extends StatelessWidget {
  const RoleShellDispatcher({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (!auth.isAuthenticated || auth.user == null) {
      return const LoginScreen();
    }
    final user = auth.user!;
    if (user.isCustomer) {
      return const CustomerShell();
    } else if (user.isAdmin) {
      return const AdminShell();
    } else if (user.isManager) {
      return const ManagerShell();
    } else {
      return const TechnicianShell();
    }
  }
}

