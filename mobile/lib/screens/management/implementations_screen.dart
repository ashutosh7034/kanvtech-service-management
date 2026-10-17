import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/master_models.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';

class ImplementationsScreen extends StatefulWidget {
  const ImplementationsScreen({super.key});

  @override
  State<ImplementationsScreen> createState() => _ImplementationsScreenState();
}

class _ImplementationsScreenState extends State<ImplementationsScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  String? _error;
  List<ImplementationModel> _projects = [];
  String _search = '';

  @override
  void initState() {
    super.initState();
    _loadImplementations();
  }

  Future<void> _loadImplementations() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final list = await _api.getImplementations();
      setState(() {
        _projects = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  List<ImplementationModel> get _filtered {
    if (_search.trim().isEmpty) return _projects;
    final q = _search.toLowerCase();
    return _projects.where((p) {
      return p.companyName.toLowerCase().contains(q) ||
          p.productName.toLowerCase().contains(q) ||
          p.stage.toLowerCase().contains(q);
    }).toList();
  }

  void _showAddProjectDialog() async {
    List<CompanyModel> companies = [];
    List<ProductModel> products = [];
    try {
      companies = await _api.getCompanies();
      products = await _api.getProducts();
    } catch (_) {}

    if (companies.isEmpty || products.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Need client companies and products registered first.')),
      );
      return;
    }

    String selectedCompany = companies.first.id;
    String selectedProduct = products.first.id;
    final notesCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('New Implementation Project', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: selectedCompany,
                  decoration: const InputDecoration(labelText: 'Client Company', isDense: true),
                  items: companies.map((c) => DropdownMenuItem(value: c.id, child: Text(c.companyName, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: (v) => setDialogState(() => selectedCompany = v!),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: selectedProduct,
                  decoration: const InputDecoration(labelText: 'Software Product', isDense: true),
                  items: products.map((p) => DropdownMenuItem(value: p.id, child: Text(p.name, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: (v) => setDialogState(() => selectedProduct = v!),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesCtrl,
                  decoration: const InputDecoration(labelText: 'Implementation Scope Notes', isDense: true),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await _api.createImplementation(
                    companyId: selectedCompany,
                    productId: selectedProduct,
                    notes: notesCtrl.text.trim(),
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Implementation project created!'), backgroundColor: AppColors.success),
                  );
                  _loadImplementations();
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.danger),
                  );
                }
              },
              child: const Text('Initialize'),
            ),
          ],
        ),
      ),
    );
  }

  void _showTasksSheet(ImplementationModel project) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          height: MediaQuery.of(context).size.height * 0.7,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      '${project.companyName} • ${project.productName}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.brandPrimary),
                    ),
                  ),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              Text('Current Stage: ${project.stage} (${project.progressPercent}% completed)', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              const Divider(height: 24),
              const Text('Implementation Milestones', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 8),
              Expanded(
                child: project.tasks.isEmpty
                    ? const Center(child: Text('Standard milestones active. Check web portal for granular Gantt schedule.'))
                    : ListView.builder(
                        itemCount: project.tasks.length,
                        itemBuilder: (ctx, i) {
                          final t = project.tasks[i];
                          return CheckboxListTile(
                            dense: true,
                            title: Text(
                              t.title,
                              style: TextStyle(
                                decoration: t.isCompleted ? TextDecoration.lineThrough : null,
                                color: t.isCompleted ? AppColors.textMuted : AppColors.textPrimary,
                              ),
                            ),
                            subtitle: Text('Stage: ${t.stage}', style: const TextStyle(fontSize: 11)),
                            value: t.isCompleted,
                            activeColor: AppColors.success,
                            onChanged: (val) async {
                              try {
                                await _api.toggleImplementationTask(t.id, val ?? false);
                                _loadImplementations();
                                Navigator.pop(ctx);
                              } catch (e) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.danger),
                                );
                              }
                            },
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _stageColor(String stage) {
    switch (stage.toUpperCase()) {
      case 'GO_LIVE':
      case 'COMPLETED':
        return AppColors.success;
      case 'UAT':
        return AppColors.accent;
      case 'DEVELOPMENT':
        return AppColors.brandSecondary;
      case 'DESIGN':
        return AppColors.warning;
      case 'PLANNING':
      default:
        return AppColors.brandPrimary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Client Implementations'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadImplementations),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.brandPrimary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Project', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        onPressed: _showAddProjectDialog,
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.white,
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search by client, product, or stage...',
                prefixIcon: const Icon(Icons.search, size: 20),
                isDense: true,
                filled: true,
                fillColor: AppColors.bgApp,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              ),
              onChanged: (val) => setState(() => _search = val),
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
                            Text(_error!, style: const TextStyle(color: AppColors.danger)),
                            const SizedBox(height: 8),
                            ElevatedButton(onPressed: _loadImplementations, child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _filtered.isEmpty
                        ? const Center(child: Text('No active implementation projects.'))
                        : RefreshIndicator(
                            onRefresh: _loadImplementations,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _filtered.length,
                              itemBuilder: (ctx, i) {
                                final p = _filtered[i];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  child: InkWell(
                                    onTap: () => _showTasksSheet(p),
                                    borderRadius: BorderRadius.circular(12),
                                    child: Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  p.companyName,
                                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                                ),
                                              ),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                decoration: BoxDecoration(
                                                  color: _stageColor(p.stage).withValues(alpha: 0.12),
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  p.stage,
                                                  style: TextStyle(
                                                    color: _stageColor(p.stage),
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Text('Product: ${p.productName}', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                                          const SizedBox(height: 12),
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text('Progress: ${p.progressPercent}%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                              if (p.targetDate != null)
                                                Text('Target: ${p.targetDate!.day}/${p.targetDate!.month}/${p.targetDate!.year}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                            ],
                                          ),
                                          const SizedBox(height: 6),
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(4),
                                            child: LinearProgressIndicator(
                                              value: (p.progressPercent / 100.0).clamp(0.0, 1.0),
                                              backgroundColor: AppColors.bgApp,
                                              valueColor: AlwaysStoppedAnimation<Color>(_stageColor(p.stage)),
                                              minHeight: 6,
                                            ),
                                          ),
                                        ],
                                      ),
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
