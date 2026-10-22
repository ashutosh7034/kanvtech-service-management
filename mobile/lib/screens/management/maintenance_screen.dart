import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/master_models.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';

class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key});

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  String? _error;
  List<SubscriptionModel> _subscriptions = [];
  String _search = '';
  String _statusFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    _loadSubscriptions();
  }

  Future<void> _loadSubscriptions() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final list = await _api.getSubscriptions();
      setState(() {
        _subscriptions = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  List<SubscriptionModel> get _filtered {
    return _subscriptions.where((s) {
      if (_statusFilter != 'ALL' && s.status.toUpperCase() != _statusFilter)
        return false;
      if (_search.trim().isEmpty) return true;
      final q = _search.toLowerCase();
      return s.companyName.toLowerCase().contains(q) ||
          s.productName.toLowerCase().contains(q) ||
          s.planType.toLowerCase().contains(q);
    }).toList();
  }

  void _showRenewDialog(SubscriptionModel sub) {
    DateTime newDate = sub.endDate.add(const Duration(days: 365));
    final amountCtrl = TextEditingController(
        text: sub.annualValue != null ? '${sub.annualValue}' : '');

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Renew Maintenance Contract • ${sub.companyName}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Product: ${sub.productName}'),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                      'New End Date: ${newDate.day}/${newDate.month}/${newDate.year}'),
                  TextButton(
                    child: const Text('Change'),
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: newDate,
                        firstDate: DateTime.now(),
                        lastDate:
                            DateTime.now().add(const Duration(days: 3650)),
                      );
                      if (picked != null) {
                        setDialogState(() => newDate = picked);
                      }
                    },
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Renewal Contract Value (₹)', isDense: true),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  final val = double.tryParse(amountCtrl.text.trim());
                  await _api.renewSubscription(sub.id,
                      newEndDate: newDate, amount: val);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Subscription renewed successfully!'),
                        backgroundColor: AppColors.success),
                  );
                  _loadSubscriptions();
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('Failed: $e'),
                        backgroundColor: AppColors.danger),
                  );
                }
              },
              child: const Text('Renew AMC'),
            ),
          ],
        ),
      ),
    );
  }

  void _sendWarning(SubscriptionModel sub) async {
    try {
      await _api.sendSubscriptionWarning(sub.id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Renewal expiry warning sent to client!'),
            backgroundColor: AppColors.success),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('Failed: $e'), backgroundColor: AppColors.danger),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    const filters = ['ALL', 'ACTIVE', 'EXPIRED'];

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Annual Maintenance & AMC'),
        actions: [
          IconButton(
              icon: const Icon(Icons.refresh), onPressed: _loadSubscriptions),
        ],
      ),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.white,
            child: Column(
              children: [
                TextField(
                  decoration: InputDecoration(
                    hintText: 'Search by client or product...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    isDense: true,
                    filled: true,
                    fillColor: AppColors.bgApp,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide.none),
                  ),
                  onChanged: (val) => setState(() => _search = val),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: filters.map((f) {
                      final isSel = _statusFilter == f;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(f),
                          selected: isSel,
                          selectedColor: AppColors.brandPrimary,
                          labelStyle: TextStyle(
                            color: isSel ? Colors.white : AppColors.textPrimary,
                            fontSize: 12,
                            fontWeight:
                                isSel ? FontWeight.bold : FontWeight.normal,
                          ),
                          onSelected: (val) =>
                              setState(() => _statusFilter = f),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
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
                                onPressed: _loadSubscriptions,
                                child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _filtered.isEmpty
                        ? const Center(
                            child:
                                Text('No subscription or maintenance records.'))
                        : RefreshIndicator(
                            onRefresh: _loadSubscriptions,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _filtered.length,
                              itemBuilder: (ctx, i) {
                                final s = _filtered[i];
                                final daysLeft =
                                    s.endDate.difference(DateTime.now()).inDays;
                                final isExpired = daysLeft < 0;
                                final isExpiringSoon =
                                    daysLeft >= 0 && daysLeft <= 30;

                                return Card(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                s.companyName,
                                                style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 16),
                                              ),
                                            ),
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                      vertical: 3),
                                              decoration: BoxDecoration(
                                                color: (isExpired
                                                        ? AppColors.danger
                                                        : (isExpiringSoon
                                                            ? AppColors.warning
                                                            : AppColors
                                                                .success))
                                                    .withValues(alpha: 0.12),
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                isExpired
                                                    ? 'EXPIRED'
                                                    : (isExpiringSoon
                                                        ? 'EXPIRING SOON'
                                                        : 'ACTIVE'),
                                                style: TextStyle(
                                                  color: isExpired
                                                      ? AppColors.danger
                                                      : (isExpiringSoon
                                                          ? AppColors.warning
                                                          : AppColors.success),
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                            'Product: ${s.productName} • Plan: ${s.planType}',
                                            style: const TextStyle(
                                                fontSize: 13,
                                                color:
                                                    AppColors.textSecondary)),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Contract Validity: ${s.startDate.day}/${s.startDate.month}/${s.startDate.year} - ${s.endDate.day}/${s.endDate.month}/${s.endDate.year} (${isExpired ? "Expired ${-daysLeft} days ago" : "$daysLeft days remaining"})',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                            color: isExpired
                                                ? AppColors.danger
                                                : (isExpiringSoon
                                                    ? AppColors.warning
                                                    : AppColors.textMuted),
                                          ),
                                        ),
                                        if (s.annualValue != null) ...[
                                          const SizedBox(height: 4),
                                          Text(
                                              'Contract Value: ₹${s.annualValue!.toStringAsFixed(0)}',
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                  color:
                                                      AppColors.brandPrimary)),
                                        ],
                                        const Divider(height: 20),
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.end,
                                          children: [
                                            if (isExpiringSoon || isExpired)
                                              OutlinedButton.icon(
                                                icon: const Icon(
                                                    Icons.notifications_active,
                                                    size: 16),
                                                label: const Text(
                                                    'Send Warning',
                                                    style: TextStyle(
                                                        fontSize: 12)),
                                                style: OutlinedButton.styleFrom(
                                                    visualDensity:
                                                        VisualDensity.compact),
                                                onPressed: () =>
                                                    _sendWarning(s),
                                              ),
                                            const SizedBox(width: 8),
                                            ElevatedButton.icon(
                                              icon: const Icon(Icons.refresh,
                                                  size: 16),
                                              label: const Text('Renew AMC',
                                                  style:
                                                      TextStyle(fontSize: 12)),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor:
                                                    AppColors.brandPrimary,
                                                visualDensity:
                                                    VisualDensity.compact,
                                              ),
                                              onPressed: () =>
                                                  _showRenewDialog(s),
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
          ),
        ],
      ),
    );
  }
}
