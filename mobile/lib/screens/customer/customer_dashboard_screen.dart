import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
  State<CustomerDashboardScreen> createState() =>
      _CustomerDashboardScreenState();
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
        title: const Text('Customer Service Portal'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Tickets',
            onPressed: () => ticketsProvider.fetchTickets(),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign Out',
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.brandPrimary,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('Raise Ticket',
                  style: TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold)),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const CreateTicketScreen()),
                );
              },
            )
          : null,
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
                        auth.user?.email.isNotEmpty == true
                            ? auth.user!.email.substring(0, 1).toUpperCase()
                            : 'C',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: AppColors.brandPrimary),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            auth.user?.displayName ?? 'Customer Account',
                            style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Account: ${auth.user?.companyId ?? "Authorized Client"}',
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.textMuted),
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
                  color: canCreate
                      ? AppColors.info.withAlpha(50)
                      : AppColors.warning.withAlpha(50),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    canCreate
                        ? Icons.info_outline
                        : Icons.warning_amber_rounded,
                    color: canCreate ? AppColors.info : AppColors.warning,
                    size: 22,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Active Tickets: $activeCount / 2 Allowed',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color:
                                canCreate ? AppColors.info : AppColors.warning,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          canCreate
                              ? 'You have available quota to raise ${2 - activeCount} more support ticket(s).'
                              : 'Limit reached. Outstanding issues must be verified or closed before opening a new ticket.',
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Tickets Section Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'My Support Tickets',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary),
                ),
                Text(
                  '${ticketsProvider.tickets.length} Total',
                  style:
                      const TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Tickets List
            if (ticketsProvider.isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (ticketsProvider.tickets.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(40),
                  child: Column(
                    children: const [
                      Icon(Icons.inbox_outlined,
                          size: 48, color: AppColors.textMuted),
                      SizedBox(height: 12),
                      Text(
                        'No tickets found',
                        style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Tap the "Raise Ticket" button below to open a request.',
                        style:
                            TextStyle(fontSize: 12, color: AppColors.textMuted),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              )
            else
              ...ticketsProvider.tickets
                  .map((t) => _buildTicketCard(context, t)),

            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }

  Widget _buildTicketCard(BuildContext context, TicketModel t) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CustomerTicketDetailScreen(ticketId: t.id),
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
                    t.id,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: AppColors.brandPrimary,
                    ),
                  ),
                  StatusBadge(status: t.status),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                t.problemType,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                t.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.bgSurfaceSubtle,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      t.priority,
                      style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textSecondary),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.bgSurfaceSubtle,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      t.category,
                      style: const TextStyle(
                          fontSize: 10, color: AppColors.textMuted),
                    ),
                  ),
                  const Spacer(),
                  if (t.canCustomerReopen || t.canCustomerRate)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.warningBg,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Action Needed',
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.warning),
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
