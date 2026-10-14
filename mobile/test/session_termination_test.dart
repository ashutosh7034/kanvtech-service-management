import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kanvtech_mobile/services/api_service.dart';
import 'package:kanvtech_mobile/providers/auth_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Single Active Session Mobile Invalidation Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('SessionTerminatedException carries required message', () {
      const exception = SessionTerminatedException();
      expect(
        exception.toString(),
        'Your account has been logged in on another device. You have been logged out for security reasons.',
      );
      expect(
        exception.message,
        'Your account has been logged in on another device. You have been logged out for security reasons.',
      );
    });

    test('AuthProvider clears credentials and sets message on session termination', () async {
      SharedPreferences.setMockInitialValues({
        'kanvtech_mobile_token': 'dummy_invalidated_token',
      });

      final auth = AuthProvider();
      await Future.delayed(const Duration(milliseconds: 50));

      expect(auth.sessionTerminatedMessage, isNull);

      // Simulate session termination callback from ApiService
      final api = ApiService();
      api.onSessionTerminated?.call(
        'Your account has been logged in on another device. You have been logged out for security reasons.',
      );

      expect(auth.isAuthenticated, isFalse);
      expect(auth.token, isNull);
      expect(auth.user, isNull);
      expect(
        auth.sessionTerminatedMessage,
        'Your account has been logged in on another device. You have been logged out for security reasons.',
      );

      // Verify clearSessionTerminatedMessage resets state once displayed
      auth.clearSessionTerminatedMessage();
      expect(auth.sessionTerminatedMessage, isNull);
    });

    test('Logout clears session terminated message and local tokens', () async {
      SharedPreferences.setMockInitialValues({
        'kanvtech_mobile_token': 'active_token',
      });

      final auth = AuthProvider();
      await Future.delayed(const Duration(milliseconds: 50));

      await auth.logout();

      expect(auth.isAuthenticated, isFalse);
      expect(auth.token, isNull);
      expect(auth.sessionTerminatedMessage, isNull);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('kanvtech_mobile_token'), isNull);
    });
  });
}
