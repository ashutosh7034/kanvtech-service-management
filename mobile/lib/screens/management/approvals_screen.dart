import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/ticket_model.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';
import '../employee/employee_ticket_detail_screen.dart';

class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  String? _error;
  List<TicketModel> _pendingApprovals = [];

  @override
  void initState() {
    super.initState();
    _loadApprovals();
  }

  Future<void> _loadApprovals() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final all = await _api.getTickets();
      setState(() {
        _pendingApprovals = all.where((t) {
          return t.status == 'RESOLVED' || t.status == 'MANAGER_REVIEW';
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

  void _approveTicket(TicketModel t) async {
    try {
      await _api.approveResolution(t.id, notes: 'Approved via KANVTECH Mobile Management');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Ticket #${t.ticketNumber} resolution approved!'), backgroundColor: AppColors.success),
      );
      _loadApprovals();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Approval failed: $e'), backgroundColor: AppColors.danger),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Resolution Approvals'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadApprovals),
        ],
      ),
      drawer: const AppDrawer(),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: AppColors.danger)),
                      const SizedBox(height: 8),
                      ElevatedButton(onPressed: _loadApprovals, child: const Text('Retry')),
                    ],
                  ),
                )
              : _pendingApprovals.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, size: 48, color: AppColors.success),
                          SizedBox(height: 10),
                          Text('All resolutions approved! No pending tickets.', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadApprovals,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _pendingApprovals.length,
                        itemBuilder: (ctx, i) {
                          final t = _pendingApprovals[i];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        '#${t.ticketNumber} • ${t.problemType}',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: AppColors.success.withValues(alpha: 0.12),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          t.status,
                                          style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.bold, fontSize: 10),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text('Client: ${t.companyName ?? "Direct Customer"}', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                                  Text('Assigned Specialist: ${t.assignedEmployeeName ?? "Specialist"} (${t.level})', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                                  const SizedBox(height: 6),
                                  Text(t.description, style: const TextStyle(fontSize: 12)),
                                  const Divider(height: 20),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      OutlinedButton(
                                        child: const Text('View Work Details', style: TextStyle(fontSize: 12)),
                                        onPressed: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) => EmployeeTicketDetailScreen(ticketId: t.id),
                                            ),
                                          ).then((_) => _loadApprovals());
                                        },
                                      ),
                                      const SizedBox(width: 8),
                                      ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                                        icon: const Icon(Icons.check, size: 16),
                                        label: const Text('Approve', style: TextStyle(fontSize: 12)),
                                        onPressed: () => _approveTicket(t),
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
    );
  }
}
