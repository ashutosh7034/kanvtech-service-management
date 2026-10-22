import 'dart:convert';
import 'dart:io' show SocketException, HandshakeException;
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  UserModel? _user;
  String? _token;
  bool _isInitializingSession = true;
  bool _isSubmittingLogin = false;
  String? _errorMessage;
  String? _sessionTerminatedMessage;
  String? _serverUrl;

  UserModel? get user => _user;
  String? get token => _token;
  bool get isInitializingSession => _isInitializingSession;
  bool get isSubmittingLogin => _isSubmittingLogin;
  bool get isLoading => _isInitializingSession || _isSubmittingLogin;
  String? get errorMessage => _errorMessage;
  String? get sessionTerminatedMessage => _sessionTerminatedMessage;
  String get serverUrl => _serverUrl ?? _api.baseUrl;
  bool get isAuthenticated => _token != null && _user != null;

  AuthProvider() {
    _api.onSessionTerminated = _handleSessionTerminated;
    _loadSession();
  }

  void _handleSessionTerminated(String message) {
    _token = null;
    _user = null;
    _sessionTerminatedMessage = message;
    _secureStorage
        .delete(key: 'kanvtech_mobile_token')
        .timeout(const Duration(milliseconds: 200), onTimeout: () {})
        .catchError((_) {});
    SharedPreferences.getInstance().then((prefs) {
      prefs.remove('kanvtech_mobile_token');
      prefs.remove('kanvtech_mobile_user');
    }).catchError((_) {});
    notifyListeners();
  }

  void clearSessionTerminatedMessage() {
    _sessionTerminatedMessage = null;
    notifyListeners();
  }

  Future<void> _loadSession() async {
    _isInitializingSession = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();

      // Load custom server URL if previously set
      final savedUrl = prefs.getString('kanvtech_server_url');
      if (savedUrl != null && savedUrl.isNotEmpty) {
        _serverUrl = savedUrl;
        _api.setCustomBaseUrl(savedUrl);
      }

      // Check Remember Me persistence preference
      final isRemembered =
          prefs.getString('kanvtech_mobile_remember_me') != 'false';
      if (!isRemembered) {
        // Nonpersistent session policy: Do not restore session on app cold launch
        _token = null;
        _user = null;
        return;
      }

      String? savedToken;
      try {
        savedToken = await _secureStorage
            .read(key: 'kanvtech_mobile_token')
            .timeout(const Duration(milliseconds: 100), onTimeout: () => null)
            .catchError((_) => null);
      } catch (_) {}
      savedToken ??= prefs.getString('kanvtech_mobile_token');

      if (savedToken != null && savedToken.isNotEmpty) {
        _token = savedToken;
        _api.setToken(savedToken);

        // Load cached user profile if present to maintain offline/transient readiness
        final savedUserJson = prefs.getString('kanvtech_mobile_user');
        if (savedUserJson != null && savedUserJson.isNotEmpty) {
          try {
            _user = UserModel.fromJson(jsonDecode(savedUserJson));
          } catch (_) {}
        }

        try {
          final refreshedUser = await _api.getMe();
          _user = refreshedUser;
          await prefs.setString(
              'kanvtech_mobile_user', jsonEncode(refreshedUser.toJson()));
        } on UnauthorizedException {
          // Token expired or invalid on the server
          _token = null;
          _user = null;
          _api.setToken(null);
          await _secureStorage
              .delete(key: 'kanvtech_mobile_token')
              .timeout(const Duration(milliseconds: 200), onTimeout: () {})
              .catchError((_) {});
          await prefs.remove('kanvtech_mobile_token');
          await prefs.remove('kanvtech_mobile_user');
        } on SessionTerminatedException catch (e) {
          _token = null;
          _user = null;
          _api.setToken(null);
          await _secureStorage
              .delete(key: 'kanvtech_mobile_token')
              .timeout(const Duration(milliseconds: 200), onTimeout: () {})
              .catchError((_) {});
          await prefs.remove('kanvtech_mobile_token');
          await prefs.remove('kanvtech_mobile_user');
          _sessionTerminatedMessage = e.message;
        } catch (_) {
          // Transient network error (SocketException, Timeout, offline, etc.)
          // Preserve the saved token and user session! Do not clear credentials.
        }
      }
    } catch (_) {
      // SharedPreferences access failure
    } finally {
      _isInitializingSession = false;
      notifyListeners();
    }
  }

  void cancelOrSkipInitialization() {
    _isInitializingSession = false;
    notifyListeners();
  }

  Future<void> setServerUrl(String? url) async {
    final prefs = await SharedPreferences.getInstance();
    if (url != null && url.trim().isNotEmpty) {
      _api.setCustomBaseUrl(url.trim());
      _serverUrl = _api.baseUrl;
      await prefs.setString('kanvtech_server_url', _serverUrl!);
    } else {
      _serverUrl = null;
      _api.setCustomBaseUrl(null);
      await prefs.remove('kanvtech_server_url');
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password,
      {bool rememberMe = true}) async {
    if (_isSubmittingLogin) return false;
    _isSubmittingLogin = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.login(email, password, rememberMe: rememberMe);
      final token = res['token']?.toString();
      final user = UserModel.fromJson(res['user']);

      final prefs = await SharedPreferences.getInstance();
      if (rememberMe) {
        if (token != null) {
          await _secureStorage
              .write(key: 'kanvtech_mobile_token', value: token)
              .timeout(const Duration(milliseconds: 500), onTimeout: () {})
              .catchError((_) {});
          await prefs.setString('kanvtech_mobile_token', token);
        }
        await prefs.setString('kanvtech_mobile_remember_me', 'true');
        await prefs.setString('kanvtech_remembered_email', email.trim());
        await prefs.setString(
            'kanvtech_mobile_user', jsonEncode(user.toJson()));
      } else {
        // Nonpersistent session policy: clean up persistent storage so cold restart requires reauthentication
        await _secureStorage
            .delete(key: 'kanvtech_mobile_token')
            .timeout(const Duration(milliseconds: 500), onTimeout: () {})
            .catchError((_) {});
        await prefs.remove('kanvtech_mobile_token');
        await prefs.remove('kanvtech_mobile_user');
        await prefs.remove('kanvtech_remembered_email');
        await prefs.setString('kanvtech_mobile_remember_me', 'false');
      }

      _token = token;
      _user = user;
      _isSubmittingLogin = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = _formatErrorMessage(e);
      _isSubmittingLogin = false;
      notifyListeners();
      return false;
    }
  }

  String _formatErrorMessage(dynamic e) {
    final str = e.toString();
    if (e is HandshakeException ||
        str.contains('CERTIFICATE_VERIFY_FAILED') ||
        str.contains('HandshakeException')) {
      return 'TLS / SSL certificate verification failed connecting to $serverUrl. Please ensure the server SSL certificate is valid and trusted.';
    }
    if (e is SocketException ||
        str.contains('Connection refused') ||
        str.contains('SocketException') ||
        str.contains('Network is unreachable')) {
      return 'Cannot connect to server at $serverUrl. Please check that you are connected to the office Wi-Fi and the server is online.';
    }
    if (str.contains('Connection timed out') ||
        str.contains('TimeoutException')) {
      return 'Connection to $serverUrl timed out. Please check your Wi-Fi signal and server status.';
    }
    if (e is UnauthorizedException || str.contains('UnauthorizedException')) {
      return str
          .replaceFirst('UnauthorizedException: ', '')
          .replaceFirst('Exception: ', '');
    }
    return str.replaceFirst('Exception: ', '');
  }

  Future<void> refreshProfile() async {
    try {
      if (_token != null) {
        _user = await _api.getMe();
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> logout() async {
    await _api.logout();
    _token = null;
    _user = null;
    _sessionTerminatedMessage = null;
    _api.setToken(null);
    try {
      final prefs = await SharedPreferences.getInstance();
      await _secureStorage
          .delete(key: 'kanvtech_mobile_token')
          .timeout(const Duration(milliseconds: 500), onTimeout: () {})
          .catchError((_) {});
      await prefs.remove('kanvtech_mobile_token');
      await prefs.remove('kanvtech_mobile_user');
      await prefs.remove('kanvtech_mobile_remember_me');
    } catch (_) {}
    notifyListeners();
  }

  Future<bool> switchDemoRole(String role, {bool rememberMe = true}) async {
    if (_isSubmittingLogin) return false;
    final creds = getDemoCredentials(role);
    if (creds != null) {
      final success = await login(creds['email']!, creds['password']!,
          rememberMe: rememberMe);
      if (!success && creds['fallbackPassword'] != null) {
        return await login(creds['email']!, creds['fallbackPassword']!,
            rememberMe: rememberMe);
      }
      return success;
    }
    return false;
  }

  Map<String, String>? getDemoCredentials(String role) {
    const credentials = {
      'ADMIN': {
        'email': 'admin@kanvtech.com',
        'password': 'Password@123',
        'fallbackPassword': 'admin123',
      },
      'MANAGER': {
        'email': 'manager@kanvtech.com',
        'password': 'Password@123',
        'fallbackPassword': 'manager123',
      },
      'L1_EMPLOYEE': {
        'email': 'l1.amit@kanvtech.com',
        'password': 'Password@123',
        'fallbackPassword': 'l1pass123',
      },
      'L2_EMPLOYEE': {
        'email': 'l2.vikram@kanvtech.com',
        'password': 'Password@123',
        'fallbackPassword': 'l2pass123',
      },
      'L3_EMPLOYEE': {
        'email': 'l3.priya@kanvtech.com',
        'password': 'Password@123',
        'fallbackPassword': 'l3pass123',
      },
      'CUSTOMER': {
        'email': 'rajesh@acme.com',
        'password': 'Password@123',
        'fallbackPassword': 'cust123',
      },
    };
    return credentials[role];
  }
}
