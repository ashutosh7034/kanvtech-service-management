import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/tickets_provider.dart';
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
  bool _isSubmitting = false;

  final List<String> _priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  final List<String> _categories = ['SOFTWARE', 'HARDWARE', 'NETWORK', 'ACCESS', 'OTHER'];

  @override
  void dispose() {
    _problemTypeController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final ticketsProvider = context.read<TicketsProvider>();
      await ticketsProvider.createTicket(
        problemType: _problemTypeController.text.trim(),
        priority: _priority,
        category: _category,
        description: _descriptionController.text.trim(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Support ticket submitted successfully!'),
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
        title: const Text('Create Support Ticket'),
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
                        'Ticket Details',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _problemTypeController,
                        decoration: const InputDecoration(
                          labelText: 'Problem Summary *',
                          hintText: 'e.g. Cannot connect to VPN server',
                        ),
                        validator: (val) {
                          if (val == null || val.trim().isEmpty) return 'Problem summary is required';
                          return null;
                        },
                      ),
                      const SizedBox(height: 14),
                      DropdownButtonFormField<String>(
                        value: _category,
                        decoration: const InputDecoration(labelText: 'Category *'),
                        items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _category = val);
                        },
                      ),
                      const SizedBox(height: 14),
                      DropdownButtonFormField<String>(
                        value: _priority,
                        decoration: const InputDecoration(labelText: 'Priority Level *'),
                        items: _priorities.map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _priority = val);
                        },
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _descriptionController,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          labelText: 'Detailed Description *',
                          hintText: 'Describe what occurred, any error messages, and steps to reproduce...',
                        ),
                        validator: (val) {
                          if (val == null || val.trim().isEmpty) return 'Description is required';
                          return null;
                        },
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: _isSubmitting ? null : _handleSubmit,
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Submit Ticket'),
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
