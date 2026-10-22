import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/master_models.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';

class DepartmentsScreen extends StatefulWidget {
  const DepartmentsScreen({super.key});

  @override
  State<DepartmentsScreen> createState() => _DepartmentsScreenState();
}

class _DepartmentsScreenState extends State<DepartmentsScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  String? _error;
  List<DepartmentModel> _departments = [];
  String _search = '';

  @override
  void initState() {
    super.initState();
    _loadDepartments();
  }

  Future<void> _loadDepartments() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final list = await _api.getDepartments();
      setState(() {
        _departments = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  List<DepartmentModel> get _filtered {
    if (_search.trim().isEmpty) return _departments;
    final q = _search.toLowerCase();
    return _departments.where((d) {
      return d.name.toLowerCase().contains(q) ||
          (d.code?.toLowerCase().contains(q) ?? false) ||
          (d.description?.toLowerCase().contains(q) ?? false);
    }).toList();
  }

  void _showAddDepartmentDialog() {
    final nameCtrl = TextEditingController();
    final codeCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Department',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: nameCtrl,
                decoration: const InputDecoration(
                    labelText: 'Department Name *', isDense: true),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: codeCtrl,
                decoration: const InputDecoration(
                    labelText: 'Code (e.g. CORE, SEC, INFRA)', isDense: true),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: descCtrl,
                decoration: const InputDecoration(
                    labelText: 'Description', isDense: true),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              Navigator.pop(ctx);
              try {
                await _api.createDepartment(
                  name: nameCtrl.text.trim(),
                  code: codeCtrl.text.trim(),
                  description: descCtrl.text.trim(),
                );
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('Department created successfully!'),
                      backgroundColor: AppColors.success),
                );
                _loadDepartments();
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      content: Text('Failed: $e'),
                      backgroundColor: AppColors.danger),
                );
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Department Master'),
        actions: [
          IconButton(
              icon: const Icon(Icons.refresh), onPressed: _loadDepartments),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.brandPrimary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Department',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        onPressed: _showAddDepartmentDialog,
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.white,
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search departments by name or code...',
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
                                onPressed: _loadDepartments,
                                child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _filtered.isEmpty
                        ? const Center(child: Text('No departments found.'))
                        : RefreshIndicator(
                            onRefresh: _loadDepartments,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _filtered.length,
                              itemBuilder: (ctx, i) {
                                final d = _filtered[i];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            CircleAvatar(
                                              radius: 18,
                                              backgroundColor: AppColors
                                                  .brandSecondary
                                                  .withValues(alpha: 0.12),
                                              child: const Icon(Icons.apartment,
                                                  size: 20,
                                                  color:
                                                      AppColors.brandSecondary),
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Row(
                                                    children: [
                                                      Flexible(
                                                        child: Text(
                                                          d.name,
                                                          style:
                                                              const TextStyle(
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .bold,
                                                                  fontSize: 15),
                                                          overflow: TextOverflow
                                                              .ellipsis,
                                                        ),
                                                      ),
                                                      if (d.code != null &&
                                                          d.code!
                                                              .isNotEmpty) ...[
                                                        const SizedBox(
                                                            width: 8),
                                                        Container(
                                                          padding:
                                                              const EdgeInsets
                                                                  .symmetric(
                                                                  horizontal: 6,
                                                                  vertical: 2),
                                                          decoration:
                                                              BoxDecoration(
                                                            color:
                                                                AppColors.bgApp,
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                                        4),
                                                            border: Border.all(
                                                                color: AppColors
                                                                    .borderLight),
                                                          ),
                                                          child: Text(d.code!,
                                                              style: const TextStyle(
                                                                  fontSize: 10,
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .bold)),
                                                        ),
                                                      ],
                                                    ],
                                                  ),
                                                  if (d.description != null &&
                                                      d.description!.isNotEmpty)
                                                    Text(d.description!,
                                                        style: const TextStyle(
                                                            fontSize: 12,
                                                            color: AppColors
                                                                .textSecondary)),
                                                ],
                                              ),
                                            ),
                                            Switch(
                                              value: d.isActive,
                                              activeThumbColor:
                                                  AppColors.success,
                                              onChanged: (val) async {
                                                try {
                                                  await _api
                                                      .toggleDepartmentStatus(
                                                          d.id, val);
                                                  _loadDepartments();
                                                } catch (e) {
                                                  ScaffoldMessenger.of(context)
                                                      .showSnackBar(
                                                    SnackBar(
                                                        content:
                                                            Text('Failed: $e'),
                                                        backgroundColor:
                                                            AppColors.danger),
                                                  );
                                                }
                                              },
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 10),
                                        Row(
                                          children: [
                                            const Icon(Icons.group,
                                                size: 16,
                                                color: AppColors.textMuted),
                                            const SizedBox(width: 6),
                                            Text(
                                                '${d.employeeCount} Specialists Assigned',
                                                style: const TextStyle(
                                                    fontSize: 12,
                                                    color: AppColors
                                                        .textSecondary)),
                                            if (d.managerName != null) ...[
                                              const SizedBox(width: 14),
                                              const Icon(Icons.person,
                                                  size: 16,
                                                  color: AppColors.textMuted),
                                              const SizedBox(width: 4),
                                              Text('Lead: ${d.managerName}',
                                                  style: const TextStyle(
                                                      fontSize: 12,
                                                      color: AppColors
                                                          .textSecondary)),
                                            ],
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
