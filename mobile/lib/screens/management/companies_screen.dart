import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/master_models.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_drawer.dart';

class CompaniesScreen extends StatefulWidget {
  const CompaniesScreen({super.key});

  @override
  State<CompaniesScreen> createState() => _CompaniesScreenState();
}

class _CompaniesScreenState extends State<CompaniesScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  String? _error;
  List<CompanyModel> _allCompanies = [];
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadCompanies();
  }

  Future<void> _loadCompanies() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final list = await _api.getCompanies();
      setState(() {
        _allCompanies = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  List<CompanyModel> get _filteredCompanies {
    if (_searchQuery.trim().isEmpty) return _allCompanies;
    final q = _searchQuery.toLowerCase();
    return _allCompanies.where((c) {
      return c.companyName.toLowerCase().contains(q) ||
          c.primaryEmail.toLowerCase().contains(q) ||
          c.contactPerson.toLowerCase().contains(q) ||
          c.contactPhone.toLowerCase().contains(q);
    }).toList();
  }

  void _showAddCompanyDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final personCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final addrCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Client Company',
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
                      labelText: 'Company Name *', isDense: true),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                      labelText: 'Primary Email *', isDense: true),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: personCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Contact Person *', isDense: true),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                      labelText: 'Contact Phone *', isDense: true),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: addrCtrl,
                  decoration: const InputDecoration(
                      labelText: 'HQ Address', isDense: true),
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
                await _api.createCompany(
                  companyName: nameCtrl.text.trim(),
                  primaryEmail: emailCtrl.text.trim(),
                  contactPerson: personCtrl.text.trim(),
                  contactPhone: phoneCtrl.text.trim(),
                  address: addrCtrl.text.trim(),
                );
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('Company added successfully!'),
                      backgroundColor: AppColors.success),
                );
                _loadCompanies();
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      content: Text('Failed to add company: $e'),
                      backgroundColor: AppColors.danger),
                );
              }
            },
            child: const Text('Save Company'),
          ),
        ],
      ),
    );
  }

  void _showCompanyDetails(CompanyModel company) async {
    List<BranchModel> branches = [];
    bool loadingBranches = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          if (loadingBranches) {
            _api.getCompanyBranches(company.id).then((bList) {
              setModalState(() {
                branches = bList;
                loadingBranches = false;
              });
            }).catchError((_) {
              setModalState(() => loadingBranches = false);
            });
          }

          return Container(
            height: MediaQuery.of(context).size.height * 0.75,
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
                        company.companyName,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                            color: AppColors.brandPrimary),
                      ),
                    ),
                    IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                    'Contact: ${company.contactPerson} • ${company.contactPhone}',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary)),
                Text('Email: ${company.primaryEmail}',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary)),
                if (company.address != null && company.address!.isNotEmpty)
                  Text('Address: ${company.address}',
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textSecondary)),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Registered Branches',
                        style: TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 15)),
                    TextButton.icon(
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Add Branch'),
                      onPressed: () => _showAddBranchDialog(company.id, () {
                        setModalState(() => loadingBranches = true);
                      }),
                    ),
                  ],
                ),
                Expanded(
                  child: loadingBranches
                      ? const Center(child: CircularProgressIndicator())
                      : branches.isEmpty
                          ? const Center(
                              child: Text('No branches registered yet.',
                                  style: TextStyle(color: AppColors.textMuted)))
                          : ListView.builder(
                              itemCount: branches.length,
                              itemBuilder: (ctx, i) {
                                final b = branches[i];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  child: ListTile(
                                    leading: const Icon(Icons.location_on,
                                        color: AppColors.brandSecondary),
                                    title: Text(b.branchName,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                            fontSize: 14)),
                                    subtitle: Text(
                                        '${b.city ?? ''} ${b.state != null ? "• ${b.state}" : ""}\n${b.contactPerson ?? ''} ${b.contactPhone ?? ''}',
                                        style: const TextStyle(fontSize: 12)),
                                  ),
                                );
                              },
                            ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showAddBranchDialog(String companyId, VoidCallback onAdded) {
    final branchNameCtrl = TextEditingController();
    final cityCtrl = TextEditingController();
    final stateCtrl = TextEditingController();
    final personCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Branch Location',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: branchNameCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Branch Name *', isDense: true)),
              const SizedBox(height: 8),
              TextField(
                  controller: cityCtrl,
                  decoration:
                      const InputDecoration(labelText: 'City', isDense: true)),
              const SizedBox(height: 8),
              TextField(
                  controller: stateCtrl,
                  decoration:
                      const InputDecoration(labelText: 'State', isDense: true)),
              const SizedBox(height: 8),
              TextField(
                  controller: personCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Contact Person', isDense: true)),
              const SizedBox(height: 8),
              TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                      labelText: 'Contact Phone', isDense: true)),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (branchNameCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              try {
                await _api.createBranch(
                  companyId,
                  branchName: branchNameCtrl.text.trim(),
                  city: cityCtrl.text.trim(),
                  state: stateCtrl.text.trim(),
                  contactPerson: personCtrl.text.trim(),
                  contactPhone: phoneCtrl.text.trim(),
                );
                onAdded();
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      content: Text('Failed: $e'),
                      backgroundColor: AppColors.danger),
                );
              }
            },
            child: const Text('Save Branch'),
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
        title: const Text('Customer Master Directory'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadCompanies,
          ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.brandPrimary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Company',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        onPressed: _showAddCompanyDialog,
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.white,
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search companies by name, email, contact...',
                prefixIcon: const Icon(Icons.search, size: 20),
                isDense: true,
                filled: true,
                fillColor: AppColors.bgApp,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none),
              ),
              onChanged: (val) => setState(() => _searchQuery = val),
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
                                onPressed: _loadCompanies,
                                child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _filteredCompanies.isEmpty
                        ? const Center(
                            child: Text('No client companies found.'))
                        : RefreshIndicator(
                            onRefresh: _loadCompanies,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _filteredCompanies.length,
                              itemBuilder: (ctx, idx) {
                                final c = _filteredCompanies[idx];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  child: ListTile(
                                    contentPadding: const EdgeInsets.symmetric(
                                        horizontal: 16, vertical: 8),
                                    leading: CircleAvatar(
                                      backgroundColor: AppColors.brandPrimary
                                          .withValues(alpha: 0.1),
                                      child: const Icon(Icons.business,
                                          color: AppColors.brandPrimary),
                                    ),
                                    title: Text(
                                      c.companyName,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15),
                                    ),
                                    subtitle: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const SizedBox(height: 4),
                                        Text(
                                            '${c.contactPerson} • ${c.contactPhone}',
                                            style:
                                                const TextStyle(fontSize: 12)),
                                        Text(c.primaryEmail,
                                            style: const TextStyle(
                                                fontSize: 12,
                                                color: AppColors.textMuted)),
                                      ],
                                    ),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Switch(
                                          value: c.isActive,
                                          activeThumbColor: AppColors.success,
                                          onChanged: (val) async {
                                            try {
                                              await _api.toggleCompanyStatus(
                                                  c.id, val);
                                              _loadCompanies();
                                            } catch (e) {
                                              ScaffoldMessenger.of(context)
                                                  .showSnackBar(
                                                SnackBar(
                                                    content: Text('Failed: $e'),
                                                    backgroundColor:
                                                        AppColors.danger),
                                              );
                                            }
                                          },
                                        ),
                                        const Icon(Icons.chevron_right),
                                      ],
                                    ),
                                    onTap: () => _showCompanyDetails(c),
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
