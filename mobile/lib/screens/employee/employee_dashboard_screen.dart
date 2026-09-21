import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../providers/tickets_provider.dart';
import '../../models/ticket_model.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_badge.dart';
import 'employee_ticket_detail_screen.dart';

class EmployeeDashboardScreen extends StatefulWidget {
  const EmployeeDashboardScreen({super.key});

  @override
  State<EmployeeDashboardScreen> createState() => _EmployeeDashboardScreenState();
}

class _EmployeeDashboardScreenState extends State<EmployeeDashboardScreen> {
  String _selectedFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TicketsProvider>().fetchTickets();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final ticketsProvider = context.watch<TicketsProvider>();

    final tickets = ticketsProvider.tickets.where((t) {
      if (_selectedFilter == 'ALL') return true;
      if (_selectedFilter == 'ACTIVE') return !['RESOLVED', 'CLOSED'].contains(t.status);
      return t.status == _selectedFilter;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: Text('${auth.user?.role.replaceAll("_", " ") ?? "Technician"} Queue'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ticketsProvider.fetchTickets(),
            tooltip: 'Refresh',
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
            tooltip: 'Sign Out',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ticketsProvider.fetchTickets(),
        child: Column(
          children: [
            // Filter bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: AppColors.bgSurface,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _filterChip('ALL', 'All Tickets'),
                    const SizedBox(width: 8),
                    _filterChip('ACTIVE', 'Active Work'),
                    const SizedBox(width: 8),
                    _filterChip('IN_PROGRESS', 'In Progress'),
                    const SizedBox(width: 8),
                    _filterChip('ESCALATED', 'Escalated'),
                    const SizedBox(width: 8),
                    _filterChip('RESOLVED', 'Resolved'),
                  ],
                ),
              ),
            ),
            const Divider(height: 1),

            // Tickets List
            Expanded(
              child: ticketsProvider.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : tickets.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              Icon(Icons.assignment_turned_in_outlined, size: 48, color: AppColors.textMuted),
                              SizedBox(height: 12),
                              Text('No tickets in queue', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                              SizedBox(height: 4),
                              Text('Queue is currently clear for your assignment level.', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: tickets.length,
                          itemBuilder: (context, index) {
                            final ticket = tickets[index];
                            return _buildEmployeeTicketCard(context, ticket);
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _filterChip(String filterKey, String label) {
    final isSelected = _selectedFilter == filterKey;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: AppColors.brandPrimaryLight,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
        color: isSelected ? AppColors.brandPrimary : AppColors.textSecondary,
      ),
      onSelected: (selected) {
        if (selected) setState(() => _selectedFilter = filterKey);
      },
    );
  }

  Widget _buildEmployeeTicketCard(BuildContext context, TicketModel ticket) {
    final minutes = ticket.totalResolutionSeconds ~/ 60;
    final seconds = ticket.totalResolutionSeconds % 60;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => EmployeeTicketDetailScreen(ticketId: ticket.id),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Text(
                        ticket.id,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.brandPrimary),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: AppColors.brandPrimaryLight,
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text(
                          ticket.assignedLevel,
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.brandPrimary),
                        ),
                      ),
                    ],
                  ),
                  StatusBadge(status: ticket.status),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                ticket.problemType,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 4),
              Text(
                'Client: ${ticket.companyId}',
                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        ticket.isTimerRunning ? Icons.timer : Icons.timer_outlined,
                        size: 14,
                        color: ticket.isTimerRunning ? AppColors.success : AppColors.textMuted,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${minutes}m ${seconds}s',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: ticket.isTimerRunning ? AppColors.success : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: ticket.slaStatus == 'BREACHED'
                          ? AppColors.dangerBg
                          : ticket.slaStatus == 'WARNING'
                              ? AppColors.warningBg
                              : AppColors.successBg,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'SLA: ${ticket.slaStatus}',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: ticket.slaStatus == 'BREACHED'
                            ? AppColors.danger
                            : ticket.slaStatus == 'WARNING'
                                ? AppColors.warning
                                : AppColors.success,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
