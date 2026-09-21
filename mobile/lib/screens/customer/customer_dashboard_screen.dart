import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../providers/tickets_provider.dart';
import '../../models/ticket_model.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_badge.dart';
import 'create_ticket_screen.dart';
import 'customer_ticket_detail_screen.dart';

class CustomerDashboardScreen extends StatefulWidget {
  const CustomerDashboardScreen({super.key});

  @override
  State<CustomerDashboardScreen> createState() => _CustomerDashboardScreenState();
}

class _CustomerDashboardScreenState extends State<CustomerDashboardScreen> {
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

    final activeCount = ticketsProvider.activeTicketsCount;
    final canCreate = ticketsProvider.canCustomerCreateTicket;

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Customer Portal'),
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
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Welcome & Company Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: AppColors.brandPrimaryLight,
                      child: Text(
                        auth.user?.email.substring(0, 1).toUpperCase() ?? 'C',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brandPrimary),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            auth.user?.email ?? 'Customer',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Account: ${auth.user?.companyId ?? "Client"}',
                            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Two-Ticket Rule Policy Banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: canCreate ? AppColors.infoBg : AppColors.warningBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: canCreate ? AppColors.info.withOpacity(0.3) : AppColors.warning.withOpacity(0.4),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    canCreate ? Icons.info_outline : Icons.warning_amber_rounded,
                    color: canCreate ? AppColors.info : AppColors.warning,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          canCreate
                              ? 'Active Quota: $activeCount / 2 Active Tickets'
                              : 'Active Quota Reached: 2 / 2 Active Tickets',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            color: canCreate ? AppColors.info : AppColors.warning,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          canCreate
                              ? 'You may have up to 2 active support requests concurrently. You can create ${2 - activeCount} more.'
                              : 'Kanvtech two-ticket policy limit reached. An active ticket must be resolved or closed before opening another.',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Section Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'My Support Tickets',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary),
                ),
                Text(
                  '${ticketsProvider.tickets.length} total',
                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
            const SizedBox(height: 10),

            if (ticketsProvider.isLoading)
              const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
            else if (ticketsProvider.tickets.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
                  child: Column(
                    children: const [
                      Icon(Icons.inbox_outlined, size: 40, color: AppColors.textMuted),
                      SizedBox(height: 12),
                      Text('No tickets found', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                      SizedBox(height: 4),
                      Text('Submit a new support ticket to get started.', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                    ],
                  ),
                ),
              )
            else
              ...ticketsProvider.tickets.map((t) => _buildTicketCard(context, t)),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: canCreate ? AppColors.brandPrimary : AppColors.borderMedium,
        foregroundColor: Colors.white,
        onPressed: () {
          if (!canCreate) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Active quota limit reached (2/2 active tickets). Please wait for an existing ticket to be resolved.'),
                backgroundColor: AppColors.warning,
              ),
            );
            return;
          }
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const CreateTicketScreen()),
          );
        },
        icon: const Icon(Icons.add),
        label: const Text('Create Ticket'),
      ),
    );
  }

  Widget _buildTicketCard(BuildContext context, TicketModel ticket) {
    final dateFormat = DateFormat('MMM dd, yyyy');
    final dateStr = ticket.createdAt != null ? dateFormat.format(ticket.createdAt!) : '';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CustomerTicketDetailScreen(ticketId: ticket.id),
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
                  Text(
                    ticket.id,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.brandPrimary),
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
                ticket.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.bgSurfaceSubtle,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'Priority: ${ticket.priority}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textSecondary),
                    ),
                  ),
                  if (dateStr.isNotEmpty)
                    Text(
                      dateStr,
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
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
