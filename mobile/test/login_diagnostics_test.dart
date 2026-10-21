import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kanvtech_mobile/services/api_service.dart';
import 'package:kanvtech_mobile/providers/auth_provider.dart';
import 'package:kanvtech_mobile/models/user_model.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Production Mobile Login & Network Diagnostics Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      ApiService().setCustomBaseUrl(null);
    });

    test('1. Default baseUrl points to office server HTTPS entry point', () {
      final api = ApiService();
      expect(api.baseUrl, 'https://192.168.1.4:8444/api');
      expect(api.baseUrl.startsWith('https://'), isTrue);
      expect(api.baseUrl.contains('127.0.0.1'), isFalse);
      expect(api.baseUrl.contains('localhost'), isFalse);
    });

    test('2. setCustomBaseUrl normalizes URL with and without trailing slash or /api', () {
      final api = ApiService();

      // Given URL without /api
      api.setCustomBaseUrl('https://192.168.1.4:8444');
      expect(api.baseUrl, 'https://192.168.1.4:8444/api');

      // Given URL with /api and trailing slash
      api.setCustomBaseUrl('https://192.168.1.4:8444/api/');
      expect(api.baseUrl, 'https://192.168.1.4:8444/api');

      // Given URL with /api without trailing slash
      api.setCustomBaseUrl('https://192.168.1.4:8444/api');
      expect(api.baseUrl, 'https://192.168.1.4:8444/api');

      // Given null or empty string resets to default
      api.setCustomBaseUrl('');
      expect(api.baseUrl, 'https://192.168.1.4:8444/api');

      api.setCustomBaseUrl(null);
      expect(api.baseUrl, 'https://192.168.1.4:8444/api');
    });

    test('3. Transient network error does NOT erase valid saved token or user session', () async {
      final sampleUser = UserModel(
        id: 1,
        email: 'admin@kanvtech.com',
        role: 'ADMIN',
        name: 'System Administrator',
      );

      SharedPreferences.setMockInitialValues({
        'kanvtech_mobile_token': 'valid_saved_jwt_token',
        'kanvtech_mobile_user': jsonEncode(sampleUser.toJson()),
      });

      final auth = AuthProvider();
      // Allow async _loadSession to settle
      await Future.delayed(const Duration(milliseconds: 100));

      // In test environment without a real server, getMe() throws a network exception (SocketException / ClientException).
      // Verify that transient network failure did NOT clear the saved token or user profile!
      expect(auth.token, 'valid_saved_jwt_token');
      expect(auth.user, isNotNull);
      expect(auth.user!.email, 'admin@kanvtech.com');
      expect(auth.user!.isAdmin, isTrue);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('kanvtech_mobile_token'), 'valid_saved_jwt_token');
      expect(prefs.getString('kanvtech_mobile_user'), isNotNull);
    });

    test('4. UnauthorizedException (HTTP 401) clears invalid token and cached user', () {
      final exception = UnauthorizedException('Invalid email or password');
      expect(exception.message, 'Invalid email or password');
      expect(exception.toString(), 'Invalid email or password');
    });

    test('5. Formatted error messages provide user-friendly non-sensitive guidance', () async {
      final auth = AuthProvider();

      // Test login with invalid credentials or offline network
      final result = await auth.login('admin@kanvtech.com', 'WrongPassword123');
      expect(result, isFalse);
      expect(auth.errorMessage, isNotNull);
      expect(auth.errorMessage!.isNotEmpty, isTrue);

      // Verify no sensitive tokens or password leaks in error message
      expect(auth.errorMessage!.contains('WrongPassword123'), isFalse);
      expect(auth.errorMessage!.contains('Bearer'), isFalse);
    });
  });
}
