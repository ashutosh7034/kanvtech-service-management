import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../theme/app_colors.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    return Scaffold(
      backgroundColor: AppColors.bgApp,
      appBar: AppBar(
        title: const Text('Account Profile'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: AppColors.brandPrimaryLight,
                    child: Text(
                      user?.email.isNotEmpty == true
                          ? user!.email[0].toUpperCase()
                          : 'U',
                      style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: AppColors.brandPrimary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    user?.displayName ?? 'User',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user?.formattedRole ?? 'User Role',
                    style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.brandPrimary,
                        fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user?.email ?? '',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                if (user?.employeeId != null)
                  ListTile(
                    leading: const Icon(Icons.badge_outlined,
                        color: AppColors.textSecondary),
                    title: const Text('Employee ID',
                        style: TextStyle(fontSize: 13)),
                    trailing: Text(user!.employeeId!,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                if (user?.companyId != null)
                  ListTile(
                    leading: const Icon(Icons.business_outlined,
                        color: AppColors.textSecondary),
                    title: const Text('Company / Account',
                        style: TextStyle(fontSize: 13)),
                    trailing: Text(user!.companyId!,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ListTile(
                  leading: const Icon(Icons.dns_outlined,
                      color: AppColors.textSecondary),
                  title: const Text('Connected API Server',
                      style: TextStyle(fontSize: 13)),
                  subtitle: Text(auth.serverUrl,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.textMuted)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            icon: const Icon(Icons.logout),
            label: const Text('Sign Out from Mobile'),
            onPressed: () => auth.logout(),
          ),
        ],
      ),
    );
  }
}
