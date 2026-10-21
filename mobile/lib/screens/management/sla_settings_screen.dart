import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/master_models.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';

class SlaSettingsScreen extends StatefulWidget {
  const SlaSettingsScreen({super.key});

  @override
  State<SlaSettingsScreen> createState() => _SlaSettingsScreenState();
}

class _SlaSettingsScreenState extends State<SlaSettingsScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  String? _error;
  List<SlaConfigModel> _configs = [];

  @override
  void initState() {
    super.initState();
    _loadSla();
  }

  Future<void> _loadSla() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final list = await _api.getSlaSettings();
      setState(() {
        _configs = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  void _showEditSlaDialog(SlaConfigModel config) {
    final respCtrl = TextEditingController(text: '${config.responseTimeHours}');
    final resCtrl = TextEditingController(text: '${config.resolutionTimeHours}');
    final warnCtrl = TextEditingController(text: '${config.warningThresholdPercent}');
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Configure ${config.priority} SLA Target'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: respCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'First Response SLA (Hours) *', isDense: true),
                validator: (v) => v == null || int.tryParse(v) == null ? 'Must be a valid integer' : null,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: resCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Complete Resolution SLA (Hours) *', isDense: true),
                validator: (v) => v == null || int.tryParse(v) == null ? 'Must be a valid integer' : null,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: warnCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Warning Threshold (%) *', isDense: true),
                validator: (v) => v == null || int.tryParse(v) == null ? 'Must be a valid percentage' : null,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              Navigator.pop(ctx);
              try {
                await _api.updateSlaSettings(
                  priority: config.priority,
                  responseTimeHours: int.parse(respCtrl.text.trim()),
                  resolutionTimeHours: int.parse(resCtrl.text.trim()),
                  warningThresholdPercent: int.parse(warnCtrl.text.trim()),
                );
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('${config.priority} SLA targets updated!'), backgroundColor: AppColors.success),
                );
                _loadSla();
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.danger),
                );
              }
            },
            child: const Text('Save Targets'),
          ),
        ],
      ),
    );
  }

  Color _priorityColor(String priority) {
    switch (priority.toUpperCase()) {
      case 'CRITICAL':
        return AppColors.danger;
      case 'HIGH':
        return AppColors.warning;
      case 'MEDIUM':
        return AppColors.brandSecondary;
      case 'LOW':
      default:
        return AppColors.success;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('SLA Configuration'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadSla),
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
                      ElevatedButton(onPressed: _loadSla, child: const Text('Retry')),
                    ],
                  ),
                )
              : _configs.isEmpty
                  ? const Center(child: Text('No SLA rules configured.'))
                  : RefreshIndicator(
                      onRefresh: _loadSla,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _configs.length,
                        itemBuilder: (ctx, i) {
                          final c = _configs[i];
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
                                        '${c.priority} Priority SLA',
                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: _priorityColor(c.priority)),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.edit, size: 18, color: AppColors.brandPrimary),
                                        onPressed: () => _showEditSlaDialog(c),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Text('First Response Target', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                            Text('${c.responseTimeHours} Hours', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                          ],
                                        ),
                                      ),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Text('Resolution Target', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                            Text('${c.resolutionTimeHours} Hours', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                          ],
                                        ),
                                      ),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Text('Warning Alert', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                            Text('${c.warningThresholdPercent}% Elapsed', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                          ],
                                        ),
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
