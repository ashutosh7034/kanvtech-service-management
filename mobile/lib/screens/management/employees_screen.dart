import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/master_models.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';

class EmployeesScreen extends StatefulWidget {
  const EmployeesScreen({super.key});

  @override
  State<EmployeesScreen> createState() => _EmployeesScreenState();
}

class _EmployeesScreenState extends State<EmployeesScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  String? _error;
  List<EmployeeDetailModel> _allEmployees = [];
  String _search = '';
  String _selectedLevel = 'ALL';

  @override
  void initState() {
    super.initState();
    _loadEmployees();
  }

  Future<void> _loadEmployees() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final list = await _api.getEmployees();
      setState(() {
        _allEmployees = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  List<EmployeeDetailModel> get _filtered {
    return _allEmployees.where((e) {
      if (_selectedLevel != 'ALL' && e.level != _selectedLevel) return false;
      if (_search.trim().isEmpty) return true;
      final q = _search.toLowerCase();
      return e.name.toLowerCase().contains(q) ||
          e.email.toLowerCase().contains(q) ||
          (e.departmentName?.toLowerCase().contains(q) ?? false) ||
          (e.phone?.contains(q) ?? false);
    }).toList();
  }

  void _showAddEmployeeDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController(text: 'Password@123');
    final phoneCtrl = TextEditingController();
    String role = 'EMPLOYEE';
    String level = 'L1';
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Add Specialist Employee',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(
                        labelText: 'Full Name *', isDense: true),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                        labelText: 'Corporate Email *', isDense: true),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: passCtrl,
                    decoration: const InputDecoration(
                        labelText: 'Initial Password *', isDense: true),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                        labelText: 'Mobile Phone', isDense: true),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: role,
                    decoration: const InputDecoration(
                        labelText: 'System Role', isDense: true),
                    items: const [
                      DropdownMenuItem(
                          value: 'EMPLOYEE', child: Text('Support Specialist')),
                      DropdownMenuItem(
                          value: 'MANAGER',
                          child: Text('Service Operations Manager')),
                      DropdownMenuItem(
                          value: 'ADMIN', child: Text('System Administrator')),
                    ],
                    onChanged: (v) =>
                        setDialogState(() => role = v ?? 'EMPLOYEE'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: level,
                    decoration: const InputDecoration(
                        labelText: 'Technical Tier', isDense: true),
                    items: const [
                      DropdownMenuItem(
                          value: 'L1', child: Text('L1 Support Specialist')),
                      DropdownMenuItem(
                          value: 'L2', child: Text('L2 Senior Specialist')),
                      DropdownMenuItem(
                          value: 'L3', child: Text('L3 Principal Architect')),
                    ],
                    onChanged: (v) => setDialogState(() => level = v ?? 'L1'),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;
                Navigator.pop(ctx);
                try {
                  await _api.createEmployee(
                    name: nameCtrl.text.trim(),
                    email: emailCtrl.text.trim(),
                    password: passCtrl.text.trim(),
                    phone: phoneCtrl.text.trim(),
                    role: role,
                    level: level,
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Employee registered successfully!'),
                        backgroundColor: AppColors.success),
                  );
                  _loadEmployees();
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('Failed: $e'),
                        backgroundColor: AppColors.danger),
                  );
                }
              },
              child: const Text('Save Employee'),
            ),
          ],
        ),
      ),
    );
  }

  void _showPromoteDemoteDialog(EmployeeDetailModel emp) {
    String current = emp.level;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Adjust Technical Tier • ${emp.name}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Current Level: ${emp.level}',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            const Text(
                'Promoting advances specialist ticket routing priority. Demoting lowers escalation tier assignment.',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                if (current != 'L1')
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.warning),
                    icon: const Icon(Icons.arrow_downward, size: 16),
                    label: const Text('Demote'),
                    onPressed: () async {
                      Navigator.pop(ctx);
                      try {
                        await _api.demoteEmployee(emp.id);
                        _loadEmployees();
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text('Failed: $e'),
                            backgroundColor: AppColors.danger));
                      }
                    },
                  ),
                if (current != 'L3')
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.success),
                    icon: const Icon(Icons.arrow_upward, size: 16),
                    label: const Text('Promote'),
                    onPressed: () async {
                      Navigator.pop(ctx);
                      try {
                        await _api.promoteEmployee(emp.id);
                        _loadEmployees();
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text('Failed: $e'),
                            backgroundColor: AppColors.danger));
                      }
                    },
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _levelColor(String level) {
    switch (level.toUpperCase()) {
      case 'L3':
        return AppColors.danger;
      case 'L2':
        return AppColors.warning;
      case 'L1':
      default:
        return AppColors.brandPrimary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final levels = ['ALL', 'L1', 'L2', 'L3'];

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Specialist Employee Directory'),
        actions: [
          IconButton(
              icon: const Icon(Icons.refresh), onPressed: _loadEmployees),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.brandPrimary,
        icon: const Icon(Icons.person_add, color: Colors.white),
        label: const Text('New Specialist',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        onPressed: _showAddEmployeeDialog,
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.white,
            child: Column(
              children: [
                TextField(
                  decoration: InputDecoration(
                    hintText: 'Search by specialist name, email, department...',
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
                    children: levels.map((lvl) {
                      final isSel = _selectedLevel == lvl;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(
                              lvl == 'ALL' ? 'All Specialists' : '$lvl Tier'),
                          selected: isSel,
                          selectedColor: AppColors.brandPrimary,
                          labelStyle: TextStyle(
                            color: isSel ? Colors.white : AppColors.textPrimary,
                            fontSize: 12,
                            fontWeight:
                                isSel ? FontWeight.bold : FontWeight.normal,
                          ),
                          onSelected: (val) =>
                              setState(() => _selectedLevel = lvl),
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
                                onPressed: _loadEmployees,
                                child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _filtered.isEmpty
                        ? const Center(
                            child: Text('No specialist employees found.'))
                        : RefreshIndicator(
                            onRefresh: _loadEmployees,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _filtered.length,
                              itemBuilder: (ctx, i) {
                                final emp = _filtered[i];
                                final isAvailable =
                                    emp.availability == 'AVAILABLE';

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
                                              radius: 20,
                                              backgroundColor:
                                                  _levelColor(emp.level)
                                                      .withValues(alpha: 0.12),
                                              child: Text(
                                                emp.level,
                                                style: TextStyle(
                                                    color:
                                                        _levelColor(emp.level),
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 13),
                                              ),
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(emp.name,
                                                      style: const TextStyle(
                                                          fontWeight:
                                                              FontWeight.bold,
                                                          fontSize: 15)),
                                                  Text(emp.email,
                                                      style: const TextStyle(
                                                          fontSize: 12,
                                                          color: AppColors
                                                              .textSecondary)),
                                                  if (emp.phone != null &&
                                                      emp.phone!.isNotEmpty)
                                                    Text(emp.phone!,
                                                        style: const TextStyle(
                                                            fontSize: 11,
                                                            color: AppColors
                                                                .textMuted)),
                                                ],
                                              ),
                                            ),
                                            Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.end,
                                              children: [
                                                Container(
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                      horizontal: 8,
                                                      vertical: 3),
                                                  decoration: BoxDecoration(
                                                    color: isAvailable
                                                        ? AppColors.success
                                                            .withValues(
                                                                alpha: 0.12)
                                                        : AppColors.danger
                                                            .withValues(
                                                                alpha: 0.12),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            10),
                                                  ),
                                                  child: Text(
                                                    emp.availability,
                                                    style: TextStyle(
                                                      color: isAvailable
                                                          ? AppColors.success
                                                          : AppColors.danger,
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(height: 6),
                                                Text(
                                                  '${emp.assignedTicketsCount} active tickets',
                                                  style: const TextStyle(
                                                      fontSize: 11,
                                                      color:
                                                          AppColors.textMuted),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                        const Divider(height: 20),
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              'Dept: ${emp.departmentName ?? "General Technical"}',
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  color:
                                                      AppColors.textSecondary),
                                            ),
                                            Row(
                                              children: [
                                                OutlinedButton(
                                                  style:
                                                      OutlinedButton.styleFrom(
                                                    padding: const EdgeInsets
                                                        .symmetric(
                                                        horizontal: 10,
                                                        vertical: 4),
                                                    visualDensity:
                                                        VisualDensity.compact,
                                                  ),
                                                  onPressed: () =>
                                                      _showPromoteDemoteDialog(
                                                          emp),
                                                  child: const Text(
                                                      'Tier Setting',
                                                      style: TextStyle(
                                                          fontSize: 11)),
                                                ),
                                                const SizedBox(width: 8),
                                                Switch(
                                                  value: emp.status == 'ACTIVE',
                                                  activeThumbColor:
                                                      AppColors.success,
                                                  onChanged: (val) async {
                                                    try {
                                                      await _api
                                                          .toggleEmployeeStatus(
                                                              emp.id);
                                                      _loadEmployees();
                                                    } catch (e) {
                                                      ScaffoldMessenger.of(
                                                              context)
                                                          .showSnackBar(
                                                        SnackBar(
                                                            content: Text(
                                                                'Failed: $e'),
                                                            backgroundColor:
                                                                AppColors
                                                                    .danger),
                                                      );
                                                    }
                                                  },
                                                ),
                                              ],
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
