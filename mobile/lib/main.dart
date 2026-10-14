import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/tickets_provider.dart';
import 'providers/allotment_provider.dart';
import 'providers/operations_provider.dart';
import 'screens/login_screen.dart';
import 'screens/role_shells.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KanvtechMobileApp());
}

class KanvtechMobileApp extends StatelessWidget {
  const KanvtechMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => TicketsProvider()),
        ChangeNotifierProvider(create: (_) => AllotmentProvider()),
        ChangeNotifierProvider(create: (_) => OperationsProvider()),
      ],
      child: MaterialApp(
        title: 'Kanvtech Service Management',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.isLoading) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text(
                'Connecting to Kanvtech Service Platform...',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ),
      );
    }

    if (!auth.isAuthenticated || auth.user == null) {
      return const LoginScreen();
    }

    final user = auth.user!;

    if (user.isCustomer) {
      return const CustomerShell();
    } else if (user.isAdmin) {
      return const AdminShell();
    } else if (user.isManager) {
      return const ManagerShell();
    } else {
      // L1, L2, L3 Support Specialists & General Staff
      return const TechnicianShell();
    }
  }
}
