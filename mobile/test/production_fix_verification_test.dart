import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kanvtech_mobile/services/api_service.dart';
import 'package:kanvtech_mobile/services/http_overrides.dart';
import 'package:kanvtech_mobile/providers/auth_provider.dart';
import 'package:kanvtech_mobile/providers/tickets_provider.dart';
import 'package:kanvtech_mobile/models/master_models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('1. API URL Normalization Tests', () {
    test(
        'Normalizes all variants to https://192.168.1.4:8444/api without duplication',
        () {
      expect(ApiService.normalizeApiUrl('https://192.168.1.4:8444'),
          'https://192.168.1.4:8444/api');
      expect(ApiService.normalizeApiUrl('https://192.168.1.4:8444/'),
          'https://192.168.1.4:8444/api');
      expect(ApiService.normalizeApiUrl('https://192.168.1.4:8444/api'),
          'https://192.168.1.4:8444/api');
      expect(ApiService.normalizeApiUrl('https://192.168.1.4:8444/api/'),
          'https://192.168.1.4:8444/api');
      expect(ApiService.normalizeApiUrl('https://192.168.1.4:8444/api///'),
          'https://192.168.1.4:8444/api');
      expect(ApiService.normalizeApiUrl('192.168.1.4:8444'),
          'https://192.168.1.4:8444/api');
      expect(ApiService.normalizeApiUrl('192.168.1.4:8444/api'),
          'https://192.168.1.4:8444/api');
      expect(ApiService.normalizeApiUrl(''), 'https://192.168.1.4:8444/api');
    });

    test('ApiService setCustomBaseUrl and baseUrl getter use normalized URL',
        () {
      final api = ApiService();
      api.setCustomBaseUrl('https://192.168.1.4:8444/');
      expect(api.baseUrl, 'https://192.168.1.4:8444/api');

      api.setCustomBaseUrl('https://192.168.1.4:8444/api/');
      expect(api.baseUrl, 'https://192.168.1.4:8444/api');

      api.setCustomBaseUrl(null);
      expect(api.baseUrl, 'https://192.168.1.4:8444/api');
    });
  });

  group('2. Office Server Scoped TLS Certificate Overrides Tests', () {
    test(
        'Permits self-signed Caddy TLS strictly for designated office server and dev loops',
        () {
      // Designated office server IP and HTTPS port
      expect(OfficeServerHttpOverrides.isPermittedHost('192.168.1.4', 8444),
          isTrue);
      expect(
          OfficeServerHttpOverrides.isPermittedHost('192.168.1.4', 0), isTrue);

      // Localhost and Android emulator loops
      expect(
          OfficeServerHttpOverrides.isPermittedHost('127.0.0.1', 5000), isTrue);
      expect(
          OfficeServerHttpOverrides.isPermittedHost('10.0.2.2', 8444), isTrue);
      expect(
          OfficeServerHttpOverrides.isPermittedHost('localhost', 3000), isTrue);

      // Custom configured URL
      expect(
          OfficeServerHttpOverrides.isPermittedHost('office-server.local', 8444,
              configuredBaseUrl: 'https://office-server.local:8444/api'),
          isTrue);

      // Rejects arbitrary external hosts to prevent TLS bypass
      expect(OfficeServerHttpOverrides.isPermittedHost('google.com', 443),
          isFalse);
      expect(
          OfficeServerHttpOverrides.isPermittedHost(
              'malicious-domain.com', 443),
          isFalse);
      expect(OfficeServerHttpOverrides.isPermittedHost('192.168.1.5', 8444),
          isFalse);
    });
  });

  group('3. DashboardStatsModel Safe Deserialization Tests', () {
    test(
        'Parses nested backend metrics without type errors or null pointer crashes',
        () {
      final backendResponse = {
        'success': true,
        'metrics': {
          'volume': {
            'total': 15,
            'open': 3,
            'inProgress': 5,
            'managerReview': 2,
            'customerFeedback': 1,
            'resolved': 4,
            'closed': 0,
          },
          'sla': {
            'totalEvaluated': 15,
            'breached': 2,
            'met': 10,
            'warning': 3,
            'complianceRate': 67,
          },
          'avgResolutionSeconds': 7200,
        }
      };

      final stats = DashboardStatsModel.fromJson(backendResponse);
      expect(stats.totalTickets, 15);
      expect(stats.openTickets, 3);
      expect(stats.inProgressTickets, 5);
      expect(stats.resolvedTickets, 4);
      expect(stats.breachedSlaTickets, 2);
      expect(stats.averageResolutionHours, 2.0); // 7200 seconds = 2.0 hours
    });

    test(
        'Parses legacy/flat JSON and string numbers safely without casting crashes',
        () {
      final flatData = {
        'totalTickets': '20',
        'openTickets': 5,
        'inProgressTickets': '7',
        'resolvedTickets': 8,
        'breachedSlaTickets': '1',
        'avgResolutionHours': '4.5',
      };

      final stats = DashboardStatsModel.fromJson(flatData);
      expect(stats.totalTickets, 20);
      expect(stats.openTickets, 5);
      expect(stats.inProgressTickets, 7);
      expect(stats.resolvedTickets, 8);
      expect(stats.breachedSlaTickets, 1);
      expect(stats.averageResolutionHours, 4.5);
    });

    test('Handles null or empty response gracefully defaulting to 0', () {
      final stats = DashboardStatsModel.fromJson({});
      expect(stats.totalTickets, 0);
      expect(stats.openTickets, 0);
      expect(stats.inProgressTickets, 0);
      expect(stats.resolvedTickets, 0);
      expect(stats.breachedSlaTickets, 0);
      expect(stats.averageResolutionHours, 0.0);
    });
  });

  group('4. Duplicate Login Submission Prevention Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      ApiService().setCustomBaseUrl(null);
    });

    test('Rejects second concurrent login attempt while request is active',
        () async {
      final auth = AuthProvider();

      // Trigger first login (will start async and set isSubmittingLogin = true)
      final future1 = auth.login('admin@kanvtech.com', 'Password@123');
      expect(auth.isSubmittingLogin, isTrue);

      // Trigger immediate duplicate attempt while still loading
      final future2 = auth.login('admin@kanvtech.com', 'Password@123');

      // The duplicate attempt must return false immediately without re-dispatching
      final result2 = await future2;
      expect(result2, isFalse);

      await future1;
      expect(auth.isSubmittingLogin, isFalse);
    });
  });

  group('5. Loading State Reset and Error Diagnostics Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      ApiService().setCustomBaseUrl(null);
    });

    test(
        'AuthProvider resets isLoading to false and populates errorMessage on failure',
        () async {
      final auth = AuthProvider();
      auth.cancelOrSkipInitialization();
      final success = await auth.login('nonexistent@kanvtech.com', 'WrongPass');
      expect(success, isFalse);
      expect(auth.isLoading, isFalse);
      expect(auth.errorMessage, isNotNull);
      expect(auth.errorMessage!.isNotEmpty, isTrue);
    });

    test(
        'TicketsProvider resets isLoading to false and populates errorMessage on failure',
        () async {
      final provider = TicketsProvider();
      await provider.fetchTickets();
      expect(provider.isLoading, isFalse);
      expect(provider.errorMessage, isNotNull);
    });

    test(
        'AuthProvider separates isInitializingSession from isSubmittingLogin and allows skip',
        () async {
      final auth = AuthProvider();
      // Initially initializing session
      expect(auth.isInitializingSession, isTrue);

      auth.cancelOrSkipInitialization();
      expect(auth.isInitializingSession, isFalse);
      expect(auth.isSubmittingLogin, isFalse);
      expect(auth.isLoading, isFalse);

      // Trigger login - isSubmittingLogin becomes true, but isInitializingSession remains false!
      final loginFuture = auth.login('test@kanvtech.com', 'badpass');
      expect(auth.isSubmittingLogin, isTrue);
      expect(auth.isInitializingSession, isFalse);
      expect(auth.isLoading, isTrue);

      await loginFuture;
      expect(auth.isSubmittingLogin, isFalse);
      expect(auth.isInitializingSession, isFalse);
      expect(auth.isLoading, isFalse);
    });
  });

  group('6. Standard Authentication and Manual Credential Enforcement Tests', () {
    test('Authentication requires explicit email and password submission', () async {
      final auth = AuthProvider();
      auth.cancelOrSkipInitialization();

      // Attempting login with empty password fails safely
      final success = await auth.login('admin@kanvtech.com', '');
      expect(success, isFalse);
      expect(auth.isAuthenticated, isFalse);
    });

    test('AuthProvider maintains null token and null user prior to manual sign in', () {
      final auth = AuthProvider();
      auth.cancelOrSkipInitialization();
      expect(auth.token, isNull);
      expect(auth.user, isNull);
      expect(auth.isAuthenticated, isFalse);
    });
  });

  group('7. Remember Me Session Persistence and Lifecycle Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test(
        'Cold boot with remember_me="false" enforces nonpersistent session policy and skips session restoration',
        () async {
      // Simulate existing token in storage but remember_me flag is false
      SharedPreferences.setMockInitialValues({
        'kanvtech_mobile_token': 'test-session-token',
        'kanvtech_mobile_remember_me': 'false',
        'kanvtech_mobile_user':
            '{"id":"1","email":"admin@kanvtech.com","name":"Admin User","role":"ADMIN"}',
      });

      final auth = AuthProvider();
      // Allow async initialization to complete
      await Future.delayed(const Duration(milliseconds: 50));

      // With remember_me == false, session restoration is suppressed
      expect(auth.isAuthenticated, isFalse);
      expect(auth.token, isNull);
      expect(auth.user, isNull);
      expect(auth.isInitializingSession, isFalse);
    });

    test(
        'Cold boot with remember_me="true" restores cached token and user profile gracefully',
        () async {
      // Simulate existing token in storage with remember_me enabled
      SharedPreferences.setMockInitialValues({
        'kanvtech_mobile_token': 'valid-remembered-token',
        'kanvtech_mobile_remember_me': 'true',
        'kanvtech_mobile_user':
            '{"id":"u1","email":"manager@kanvtech.com","name":"Manager Test","role":"MANAGER"}',
      });

      final auth = AuthProvider();
      // Allow async initialization to complete
      await Future.delayed(const Duration(milliseconds: 50));

      // Token and cached user are immediately loaded for instant offline/transient readiness
      expect(auth.token, 'valid-remembered-token');
      expect(auth.user, isNotNull);
      expect(auth.user!.email, 'manager@kanvtech.com');
      expect(auth.user!.role, 'MANAGER');
      expect(auth.isAuthenticated, isTrue);
      expect(auth.isInitializingSession, isFalse);
    });

    test(
        'Logout clears token and user session, while preserving remember_me preference for seamless re-login',
        () async {
      SharedPreferences.setMockInitialValues({
        'kanvtech_mobile_token': 'active-token',
        'kanvtech_mobile_remember_me': 'true',
        'kanvtech_remembered_email': 'admin@kanvtech.com',
        'kanvtech_mobile_user':
            '{"id":"u1","email":"admin@kanvtech.com","name":"Admin","role":"ADMIN"}',
      });

      final auth = AuthProvider();
      await Future.delayed(const Duration(milliseconds: 50));
      expect(auth.isAuthenticated, isTrue);

      await auth.logout();
      expect(auth.isAuthenticated, isFalse);
      expect(auth.token, isNull);
      expect(auth.user, isNull);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('kanvtech_mobile_token'), isNull);
      expect(prefs.getString('kanvtech_mobile_user'), isNull);
      // Remember Me preference and remembered email remain intact for the login screen
      expect(prefs.getString('kanvtech_mobile_remember_me'), 'true');
      expect(prefs.getString('kanvtech_remembered_email'), 'admin@kanvtech.com');
    });
  });

  group('8. Password Security and Obsolete Credential Purging Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test(
        'Obsolete saved password key is purged during session initialization and never stored',
        () async {
      SharedPreferences.setMockInitialValues({
        'kanvtech_saved_password': 'legacy_plain_password_123',
        'kanvtech_remembered_email': 'test@kanvtech.com',
      });

      final auth = AuthProvider();
      await Future.delayed(const Duration(milliseconds: 50));
      expect(auth.isAuthenticated, isFalse);

      // SharedPreferences should not contain the saved password
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('kanvtech_saved_password'), isNull);
      // Email is preserved
      expect(prefs.getString('kanvtech_remembered_email'), 'test@kanvtech.com');
    });

    test('Login attempt unconditionally deletes obsolete saved password key', () async {
      SharedPreferences.setMockInitialValues({
        'kanvtech_saved_password': 'stale_pass',
      });

      final auth = AuthProvider();
      auth.cancelOrSkipInitialization();

      // Trigger login attempt
      await auth.login('user@kanvtech.com', 'password123');

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('kanvtech_saved_password'), isNull);
    });

    test('Logout unconditionally ensures no saved password exists', () async {
      SharedPreferences.setMockInitialValues({
        'kanvtech_saved_password': 'stale_pass',
        'kanvtech_mobile_token': 'active_token',
      });

      final auth = AuthProvider();
      await Future.delayed(const Duration(milliseconds: 50));

      await auth.logout();

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('kanvtech_saved_password'), isNull);
      expect(prefs.getString('kanvtech_mobile_token'), isNull);
    });
  });
}

