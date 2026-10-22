import 'dart:io' show HttpOverrides;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/tickets_provider.dart';
import 'providers/allotment_provider.dart';
import 'providers/operations_provider.dart';
import 'services/http_overrides.dart';
import 'screens/login_screen.dart';
import 'screens/role_shells.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  if (!kIsWeb) {
    HttpOverrides.global = OfficeServerHttpOverrides();
  }
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

    if (auth.isInitializingSession) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const CircularProgressIndicator(),
                const SizedBox(height: 16),
                const Text(
                  'Connecting to Kanvtech Service Platform...',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  auth.serverUrl,
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: () {
                    auth.cancelOrSkipInitialization();
                  },
                  icon: const Icon(Icons.arrow_forward, size: 16),
                  label: const Text('Continue to Login Screen'),
                ),
              ],
            ),
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
