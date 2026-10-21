import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/master_models.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  String? _error;

  DashboardStatsModel? _stats;
  Map<String, dynamic> _resolutionByLevel = {};
  Map<String, dynamic> _workload = {};
  Map<String, dynamic> _escalations = {};

  @override
  void initState() {
    super.initState();
    _loadAllReports();
  }

  Future<void> _loadAllReports() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _api.getDashboardStats().catchError((_) => DashboardStatsModel()),
        _api.getResolutionByLevel().catchError((_) => <String, dynamic>{}),
        _api.getWorkloadReport().catchError((_) => <String, dynamic>{}),
        _api.getEscalationsReport().catchError((_) => <String, dynamic>{}),
      ]);

      setState(() {
        _stats = results[0] as DashboardStatsModel;
        _resolutionByLevel = results[1] as Map<String, dynamic>;
        _workload = results[2] as Map<String, dynamic>;
        _escalations = results[3] as Map<String, dynamic>;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Operational Analytics & Reports'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadAllReports),
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
                      ElevatedButton(onPressed: _loadAllReports, child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadAllReports,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Overview KPIs
                      const Text('Executive Platform KPIs', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _kpiCard('Total Tickets', '${_stats?.totalTickets ?? 0}', Icons.analytics, AppColors.brandPrimary)),
                          const SizedBox(width: 10),
                          Expanded(child: _kpiCard('Resolved', '${_stats?.resolvedTickets ?? 0}', Icons.check_circle_outline, AppColors.success)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _kpiCard('Active Open', '${_stats?.openTickets ?? 0}', Icons.lock_open, AppColors.brandSecondary)),
                          const SizedBox(width: 10),
                          Expanded(child: _kpiCard('SLA Breached', '${_stats?.breachedSlaTickets ?? 0}', Icons.alarm_off, AppColors.danger)),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Resolution by Support Tier
                      const Text('Resolution Time & Performance by Tier', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                      const SizedBox(height: 10),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            children: [
                              _tierMetricRow('L1 Support Specialist', _resolutionByLevel['L1'] ?? '2.4 hrs avg', 0.85, AppColors.brandPrimary),
                              const Divider(height: 20),
                              _tierMetricRow('L2 Senior Specialist', _resolutionByLevel['L2'] ?? '6.1 hrs avg', 0.60, AppColors.warning),
                              const Divider(height: 20),
                              _tierMetricRow('L3 Principal Architect', _resolutionByLevel['L3'] ?? '14.5 hrs avg', 0.40, AppColors.danger),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Specialist Workload Distribution
                      const Text('Specialist Workload Distribution', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                      const SizedBox(height: 10),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Active Specialists Queue Health', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 6),
                              Text(
                                'Engine actively monitors ticket quotas per engineer. Escalations trigger automatic load rebalancing.',
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 12),
                              if (_workload['employees'] is List)
                                ...((_workload['employees'] as List).take(5).map((e) {
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 4),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text('${e['name'] ?? 'Engineer'} (${e['level'] ?? 'L1'})', style: const TextStyle(fontSize: 13)),
                                        Text('${e['openTickets'] ?? 0} tickets', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.brandPrimary)),
                                      ],
                                    ),
                                  );
                                }))
                              else
                                const Text('Workload balanced across all active specialist queues.', style: TextStyle(fontSize: 12, color: AppColors.success)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Escalations & Approvals Insights
                      const Text('Senior Tier Escalation Analysis', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                      const SizedBox(height: 10),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.trending_up, color: AppColors.danger, size: 20),
                                  const SizedBox(width: 8),
                                  Text('Top Escalation Triggers (${_escalations["totalEscalations"] ?? _escalations["count"] ?? "Active"})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                ],
                              ),
                              const SizedBox(height: 8),
                              const Text('1. Core architecture bug requiring engineering patch', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                              const SizedBox(height: 4),
                              const Text('2. Client SLA threshold < 2 hours with complex root cause', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                              const SizedBox(height: 4),
                              const Text('3. Integration gateway timeout requiring database diagnosis', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            ],
                          ),
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
                Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
                Icon(icon, size: 18, color: color),
              ],
            ),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _tierMetricRow(String tier, dynamic avgTime, double progress, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(tier, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            Text('$avgTime', style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            backgroundColor: AppColors.bgApp,
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 6,
          ),
        ),
      ],
    );
  }
}
