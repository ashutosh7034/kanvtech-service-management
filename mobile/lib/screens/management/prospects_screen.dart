import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/master_models.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';

class ProspectsScreen extends StatefulWidget {
  const ProspectsScreen({super.key});

  @override
  State<ProspectsScreen> createState() => _ProspectsScreenState();
}

class _ProspectsScreenState extends State<ProspectsScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  String? _error;
  List<ProspectModel> _prospects = [];
  String _search = '';
  String _statusFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    _loadProspects();
  }

  Future<void> _loadProspects() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final list = await _api.getProspects();
      setState(() {
        _prospects = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  List<ProspectModel> get _filtered {
    return _prospects.where((p) {
      if (_statusFilter != 'ALL' && p.status.toUpperCase() != _statusFilter)
        return false;
      if (_search.trim().isEmpty) return true;
      final q = _search.toLowerCase();
      return p.companyName.toLowerCase().contains(q) ||
          p.contactPerson.toLowerCase().contains(q) ||
          p.phone.contains(q) ||
          p.enquiry.toLowerCase().contains(q);
    }).toList();
  }

  void _showAddProspectDialog() {
    final companyCtrl = TextEditingController();
    final personCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final enquiryCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Enquiry / Prospect',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: SingleChildScrollView(
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: companyCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Company / Lead Name *', isDense: true),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: personCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Contact Person *', isDense: true),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                      labelText: 'Phone Number *', isDense: true),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                      labelText: 'Email Address', isDense: true),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: enquiryCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                      labelText: 'Enquiry Requirements *', isDense: true),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
              ],
            ),
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
                await _api.createProspect(
                  companyName: companyCtrl.text.trim(),
                  contactPerson: personCtrl.text.trim(),
                  phone: phoneCtrl.text.trim(),
                  email: emailCtrl.text.trim(),
                  enquiry: enquiryCtrl.text.trim(),
                );
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('Enquiry registered successfully!'),
                      backgroundColor: AppColors.success),
                );
                _loadProspects();
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      content: Text('Failed: $e'),
                      backgroundColor: AppColors.danger),
                );
              }
            },
            child: const Text('Save Enquiry'),
          ),
        ],
      ),
    );
  }

  void _showUpdateStatusDialog(ProspectModel p) {
    String selected = p.status;
    const statuses = [
      'NEW',
      'CONTACTED',
      'QUALIFIED',
      'PROPOSAL_SENT',
      'WON',
      'LOST'
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Update Enquiry Status • ${p.companyName}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: statuses.map((s) {
              final isChecked = selected == s;
              return ListTile(
                dense: true,
                leading: Icon(
                  isChecked
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                  color:
                      isChecked ? AppColors.brandPrimary : AppColors.textMuted,
                ),
                title: Text(s,
                    style: TextStyle(
                        fontWeight:
                            isChecked ? FontWeight.bold : FontWeight.normal)),
                onTap: () => setDialogState(() => selected = s),
              );
            }).toList(),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await _api.updateProspect(p.id, {'status': selected});
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('Status updated to $selected!'),
                        backgroundColor: AppColors.success),
                  );
                  _loadProspects();
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('Failed: $e'),
                        backgroundColor: AppColors.danger),
                  );
                }
              },
              child: const Text('Update'),
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'WON':
        return AppColors.success;
      case 'LOST':
        return AppColors.danger;
      case 'QUALIFIED':
      case 'PROPOSAL_SENT':
        return AppColors.brandSecondary;
      case 'CONTACTED':
        return AppColors.warning;
      case 'NEW':
      default:
        return AppColors.brandPrimary;
    }
  }

  @override
  Widget build(BuildContext context) {
    const filterOptions = [
      'ALL',
      'NEW',
      'CONTACTED',
      'QUALIFIED',
      'WON',
      'LOST'
    ];

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Enquiries & Prospects'),
        actions: [
          IconButton(
              icon: const Icon(Icons.refresh), onPressed: _loadProspects),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.brandPrimary,
        icon: const Icon(Icons.add_comment, color: Colors.white),
        label: const Text('New Enquiry',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        onPressed: _showAddProspectDialog,
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
                    hintText: 'Search inquiries by company, contact, phone...',
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
                    children: filterOptions.map((s) {
                      final isSel = _statusFilter == s;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(s),
                          selected: isSel,
                          selectedColor: AppColors.brandPrimary,
                          labelStyle: TextStyle(
                            color: isSel ? Colors.white : AppColors.textPrimary,
                            fontSize: 12,
                            fontWeight:
                                isSel ? FontWeight.bold : FontWeight.normal,
                          ),
                          onSelected: (val) =>
                              setState(() => _statusFilter = s),
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
                                onPressed: _loadProspects,
                                child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _filtered.isEmpty
                        ? const Center(child: Text('No enquiries found.'))
                        : RefreshIndicator(
                            onRefresh: _loadProspects,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _filtered.length,
                              itemBuilder: (ctx, i) {
                                final p = _filtered[i];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
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
                                                p.companyName,
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
                                                color: _statusColor(p.status)
                                                    .withValues(alpha: 0.12),
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                p.status,
                                                style: TextStyle(
                                                  color: _statusColor(p.status),
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                            'Contact: ${p.contactPerson} • ${p.phone}',
                                            style: const TextStyle(
                                                fontSize: 12,
                                                color:
                                                    AppColors.textSecondary)),
                                        if (p.email != null &&
                                            p.email!.isNotEmpty)
                                          Text('Email: ${p.email}',
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  color:
                                                      AppColors.textSecondary)),
                                        const SizedBox(height: 8),
                                        Container(
                                          width: double.infinity,
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            color: AppColors.bgApp,
                                            borderRadius:
                                                BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            p.enquiry,
                                            style: const TextStyle(
                                                fontSize: 13,
                                                color: AppColors.textPrimary),
                                          ),
                                        ),
                                        const SizedBox(height: 10),
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              'Received: ${p.createdAt.day}/${p.createdAt.month}/${p.createdAt.year}',
                                              style: const TextStyle(
                                                  fontSize: 11,
                                                  color: AppColors.textMuted),
                                            ),
                                            OutlinedButton.icon(
                                              icon: const Icon(Icons.edit_note,
                                                  size: 16),
                                              label:
                                                  const Text('Update Status'),
                                              style: OutlinedButton.styleFrom(
                                                visualDensity:
                                                    VisualDensity.compact,
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        horizontal: 10,
                                                        vertical: 4),
                                              ),
                                              onPressed: () =>
                                                  _showUpdateStatusDialog(p),
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
