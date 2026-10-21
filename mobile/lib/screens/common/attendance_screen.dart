import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/operations_provider.dart';
import '../../theme/app_colors.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _isCheckedIn = false;
  DateTime? _lastActionTime;
  bool _isProcessing = false;

  Future<void> _handleCheckIn() async {
    setState(() => _isProcessing = true);
    try {
      await context
          .read<OperationsProvider>()
          .checkIn(address: 'Mobile Office / On-Site Client');
      setState(() {
        _isCheckedIn = true;
        _lastActionTime = DateTime.now();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Successfully Checked In!'),
              backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _handleCheckOut() async {
    setState(() => _isProcessing = true);
    try {
      await context
          .read<OperationsProvider>()
          .checkOut(address: 'Mobile Office / On-Site Client');
      setState(() {
        _isCheckedIn = false;
        _lastActionTime = DateTime.now();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Successfully Checked Out!'),
              backgroundColor: AppColors.warning),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Field Duty Attendance'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 36,
                      backgroundColor: _isCheckedIn
                          ? AppColors.successBg
                          : AppColors.bgSurfaceSubtle,
                      child: Icon(
                        _isCheckedIn ? Icons.verified_user : Icons.schedule,
                        size: 40,
                        color: _isCheckedIn
                            ? AppColors.success
                            : AppColors.textMuted,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      auth.user?.displayName ?? 'Field Engineer',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Status: ${_isCheckedIn ? "ON DUTY (CHECKED IN)" : "OFF DUTY (CHECKED OUT)"}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: _isCheckedIn
                            ? AppColors.success
                            : AppColors.textMuted,
                      ),
                    ),
                    if (_lastActionTime != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Last Action: ${_lastActionTime!.hour.toString().padLeft(2, '0')}:${_lastActionTime!.minute.toString().padLeft(2, '0')}',
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.textMuted),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            if (!_isCheckedIn)
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.success,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                icon: const Icon(Icons.login),
                label: _isProcessing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
                    : const Text('Check In to Duty',
                        style: TextStyle(fontSize: 15)),
                onPressed: _isProcessing ? null : _handleCheckIn,
              )
            else
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.danger,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                icon: const Icon(Icons.logout),
                label: _isProcessing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
                    : const Text('Check Out from Duty',
                        style: TextStyle(fontSize: 15)),
                onPressed: _isProcessing ? null : _handleCheckOut,
              ),
            const SizedBox(height: 20),
            const Card(
              child: Padding(
                padding: EdgeInsets.all(14),
                child: Row(
                  children: [
                    Icon(Icons.location_on_outlined,
                        color: AppColors.brandPrimary),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Location coordinates & server timestamps are logged to the central database for field technician audit trails.',
                        style: TextStyle(
                            fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
