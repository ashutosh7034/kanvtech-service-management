import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/tickets_provider.dart';
import '../../services/api_service.dart';
import '../../models/master_models.dart';
import '../../theme/app_colors.dart';

class CreateTicketScreen extends StatefulWidget {
  const CreateTicketScreen({super.key});

  @override
  State<CreateTicketScreen> createState() => _CreateTicketScreenState();
}

class _CreateTicketScreenState extends State<CreateTicketScreen> {
  final _formKey = GlobalKey<FormState>();
  final _problemTypeController = TextEditingController();
  final _descriptionController = TextEditingController();

  String _priority = 'MEDIUM';
  String _category = 'SOFTWARE';
  String? _selectedProductId;
  String? _selectedBranchId;

  List<ProductModel> _products = [];
  List<BranchModel> _branches = [];
  bool _isSubmitting = false;

  final List<String> _priorities = ['LOW', 'MEDIUM', 'HIGH'];
  final List<String> _categories = [
    'SOFTWARE',
    'HARDWARE',
    'NETWORK',
    'ACCESS',
    'OTHER'
  ];

  @override
  void initState() {
    super.initState();
    _loadMasterData();
  }

  Future<void> _loadMasterData() async {
    try {
      final auth = context.read<AuthProvider>();
      final api = ApiService();
      final products = await api.getProducts();
      List<BranchModel> branches = [];
      if (auth.user?.companyId != null && auth.user!.companyId!.isNotEmpty) {
        branches = await api.getCompanyBranches(auth.user!.companyId!);
      }
      if (mounted) {
        setState(() {
          _products = products;
          _branches = branches;
        });
      }
    } catch (_) {
      // Non-critical: allow creating ticket with general inputs if master lookup fails
    }
  }

  @override
  void dispose() {
    _problemTypeController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final ticketsProvider = context.read<TicketsProvider>();
    if (!ticketsProvider.canCustomerCreateTicket) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Active ticket limit reached (2 maximum). Please resolve existing tickets first.'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final auth = context.read<AuthProvider>();
      await ticketsProvider.createTicket(
        problemType: _problemTypeController.text.trim(),
        priority: _priority,
        category: _category,
        description: _descriptionController.text.trim(),
        companyId: auth.user?.companyId,
        customerContactId: auth.user?.contactId,
        productId: _selectedProductId,
        branchId: _selectedBranchId,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Support ticket raised successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Open Support Ticket'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Issue Details',
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                            color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _problemTypeController,
                        decoration: const InputDecoration(
                          labelText: 'Problem Summary *',
                          hintText: 'e.g. Cannot access ERP sales module',
                        ),
                        validator: (val) {
                          if (val == null || val.trim().isEmpty)
                            return 'Problem summary is required';
                          return null;
                        },
                      ),
                      const SizedBox(height: 14),
                      DropdownButtonFormField<String>(
                        initialValue: _priority,
                        decoration: const InputDecoration(
                            labelText: 'Priority Level *'),
                        items: _priorities
                            .map((p) =>
                                DropdownMenuItem(value: p, child: Text(p)))
                            .toList(),
                        onChanged: (val) =>
                            setState(() => _priority = val ?? 'MEDIUM'),
                      ),
                      const SizedBox(height: 14),
                      DropdownButtonFormField<String>(
                        initialValue: _category,
                        decoration: const InputDecoration(
                            labelText: 'Issue Category *'),
                        items: _categories
                            .map((c) =>
                                DropdownMenuItem(value: c, child: Text(c)))
                            .toList(),
                        onChanged: (val) =>
                            setState(() => _category = val ?? 'SOFTWARE'),
                      ),
                      if (_products.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        DropdownButtonFormField<String>(
                          initialValue: _selectedProductId,
                          decoration: const InputDecoration(
                              labelText: 'Affected Product (Optional)'),
                          items: [
                            const DropdownMenuItem(
                                value: null, child: Text('None / General')),
                            ..._products.map((p) => DropdownMenuItem(
                                value: p.id, child: Text(p.name))),
                          ],
                          onChanged: (val) =>
                              setState(() => _selectedProductId = val),
                        ),
                      ],
                      if (_branches.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        DropdownButtonFormField<String>(
                          initialValue: _selectedBranchId,
                          decoration: const InputDecoration(
                              labelText: 'Customer Branch (Optional)'),
                          items: [
                            const DropdownMenuItem(
                                value: null, child: Text('Main Office')),
                            ..._branches.map((b) => DropdownMenuItem(
                                value: b.id, child: Text(b.branchName))),
                          ],
                          onChanged: (val) =>
                              setState(() => _selectedBranchId = val),
                        ),
                      ],
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _descriptionController,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          labelText: 'Detailed Description *',
                          hintText:
                              'Describe error messages, steps to reproduce, or affected users...',
                        ),
                        validator: (val) {
                          if (val == null || val.trim().length < 5) {
                            return 'Please provide at least a brief explanation';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: _isSubmitting ? null : _handleSubmit,
                        child: _isSubmitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Submit Ticket to Queue'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
