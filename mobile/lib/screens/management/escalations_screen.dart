import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/ticket_model.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';
import '../employee/employee_ticket_detail_screen.dart';

class EscalationsScreen extends StatefulWidget {
  const EscalationsScreen({super.key});

  @override
  State<EscalationsScreen> createState() => _EscalationsScreenState();
}

class _EscalationsScreenState extends State<EscalationsScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  String? _error;
  List<TicketModel> _escalatedTickets = [];
  String _selectedTier = 'ALL';

  @override
  void initState() {
    super.initState();
    _loadEscalations();
  }

  Future<void> _loadEscalations() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final all = await _api.getTickets();
      setState(() {
        _escalatedTickets = all.where((t) {
          final isHighLevel = t.level == 'L2' || t.level == 'L3';
          final isEscalatedStatus =
              t.status == 'MANAGER_REVIEW' || (t.slaBreached);
          return isHighLevel || isEscalatedStatus;
        }).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  List<TicketModel> get _filtered {
    if (_selectedTier == 'ALL') return _escalatedTickets;
    return _escalatedTickets.where((t) => t.level == _selectedTier).toList();
  }

  Color _levelColor(String level) {
    if (level == 'L3') return AppColors.danger;
    if (level == 'L2') return AppColors.warning;
    return AppColors.brandPrimary;
  }

  @override
  Widget build(BuildContext context) {
    const tiers = ['ALL', 'L2', 'L3'];

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Senior Tier Escalation Queue'),
        actions: [
          IconButton(
              icon: const Icon(Icons.refresh), onPressed: _loadEscalations),
        ],
      ),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: Colors.white,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  const Text('Filter by Tier:',
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(width: 12),
                  ...tiers.map((t) {
                    final isSel = _selectedTier == t;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(
                            t == 'ALL' ? 'All Escalations' : '$t Escalated'),
                        selected: isSel,
                        selectedColor: AppColors.brandPrimary,
                        labelStyle: TextStyle(
                          color: isSel ? Colors.white : AppColors.textPrimary,
                          fontSize: 12,
                          fontWeight:
                              isSel ? FontWeight.bold : FontWeight.normal,
                        ),
                        onSelected: (val) => setState(() => _selectedTier = t),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(_error!,
                                style:
                                    const TextStyle(color: AppColors.danger)),
                            const SizedBox(height: 8),
                            ElevatedButton(
                                onPressed: _loadEscalations,
                                child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _filtered.isEmpty
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.verified,
                                    size: 48, color: AppColors.success),
                                SizedBox(height: 8),
                                Text(
                                    'No senior tier escalations in queue! All tickets on SLA track.',
                                    style: TextStyle(
                                        color: AppColors.textSecondary)),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _loadEscalations,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _filtered.length,
                              itemBuilder: (ctx, i) {
                                final t = _filtered[i];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  child: ListTile(
                                    contentPadding: const EdgeInsets.all(14),
                                    leading: CircleAvatar(
                                      backgroundColor: _levelColor(t.level)
                                          .withValues(alpha: 0.12),
                                      child: Text(
                                        t.level,
                                        style: TextStyle(
                                            color: _levelColor(t.level),
                                            fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                    title: Text(
                                      '#${t.ticketNumber} • ${t.problemType}',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14),
                                    ),
                                    subtitle: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const SizedBox(height: 4),
                                        Text(
                                            'Client: ${t.companyName ?? "Direct Customer"}',
                                            style:
                                                const TextStyle(fontSize: 12)),
                                        Text(
                                            'Priority: ${t.priority} • Status: ${t.status}',
                                            style: const TextStyle(
                                                fontSize: 11,
                                                color: AppColors.textMuted)),
                                        if (t.slaBreached)
                                          const Text('⚠️ SLA BREACHED',
                                              style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppColors.danger)),
                                      ],
                                    ),
                                    trailing: const Icon(Icons.chevron_right),
                                    onTap: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) =>
                                              EmployeeTicketDetailScreen(
                                                  ticketId: t.id),
                                        ),
                                      ).then((_) => _loadEscalations());
                                    },
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
