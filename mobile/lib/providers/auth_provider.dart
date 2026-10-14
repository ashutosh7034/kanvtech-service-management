import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  UserModel? _user;
  String? _token;
  bool _isLoading = true;
  String? _errorMessage;
  String? _sessionTerminatedMessage;
  String? _serverUrl;

  UserModel? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
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
    SharedPreferences.getInstance().then((prefs) {
      prefs.remove('kanvtech_mobile_token');
    });
    notifyListeners();
  }

  void clearSessionTerminatedMessage() {
    _sessionTerminatedMessage = null;
    notifyListeners();
  }

  Future<void> _loadSession() async {
    _isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();

      // Load custom server URL if previously set
      final savedUrl = prefs.getString('kanvtech_server_url');
      if (savedUrl != null && savedUrl.isNotEmpty) {
        _serverUrl = savedUrl;
        _api.setCustomBaseUrl(savedUrl);
      }

      final savedToken = prefs.getString('kanvtech_mobile_token');
      if (savedToken != null && savedToken.isNotEmpty) {
        _token = savedToken;
        _api.setToken(savedToken);
        try {
          _user = await _api.getMe();
        } catch (e) {
          // Token expired, invalid, or session terminated
          _token = null;
          _user = null;
          _api.setToken(null);
          await prefs.remove('kanvtech_mobile_token');
          if (e is SessionTerminatedException) {
            _sessionTerminatedMessage = e.message;
          }
        }
      }
    } catch (e) {
      _token = null;
      _user = null;
      _api.setToken(null);
      if (e is SessionTerminatedException) {
        _sessionTerminatedMessage = e.message;
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> setServerUrl(String? url) async {
    final prefs = await SharedPreferences.getInstance();
    if (url != null && url.trim().isNotEmpty) {
      _serverUrl = url.trim();
      _api.setCustomBaseUrl(_serverUrl);
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
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.login(email, password, rememberMe: rememberMe);
      _token = res['token'];
      _user = UserModel.fromJson(res['user']);

      final prefs = await SharedPreferences.getInstance();
      if (_token != null) {
        await prefs.setString('kanvtech_mobile_token', _token!);
      }
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
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
      await prefs.remove('kanvtech_mobile_token');
    } catch (_) {}
    notifyListeners();
  }

  Future<bool> switchDemoRole(String role) async {
    // Official evaluation and demo credentials from repository documentation
    final credentials = {
      'ADMIN': {'email': 'admin@kanvtech.com', 'password': 'admin123'},
      'MANAGER': {'email': 'manager@kanvtech.com', 'password': 'manager123'},
      'L1_EMPLOYEE': {'email': 'amit.l1@kanvtech.com', 'password': 'l1pass123'},
      'L2_EMPLOYEE': {
        'email': 'rahul.l2@kanvtech.com',
        'password': 'l2pass123'
      },
      'L3_EMPLOYEE': {
        'email': 'priya.l3@kanvtech.com',
        'password': 'l3pass123'
      },
      'CUSTOMER': {'email': 'contact@acme.com', 'password': 'cust123'},
    };

    final creds = credentials[role];
    if (creds != null) {
      return await login(creds['email']!, creds['password']!);
    }
    return false;
  }
}
