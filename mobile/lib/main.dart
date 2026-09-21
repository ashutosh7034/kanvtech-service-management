import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/tickets_provider.dart';
import 'screens/login_screen.dart';
import 'screens/customer/customer_dashboard_screen.dart';
import 'screens/employee/employee_dashboard_screen.dart';
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
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (!auth.isAuthenticated || auth.user == null) {
      return const LoginScreen();
    }

    if (auth.user!.isCustomer) {
      return const CustomerDashboardScreen();
    } else {
      return const EmployeeDashboardScreen();
    }
  }
}
