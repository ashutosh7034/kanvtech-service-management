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

  UserModel? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _token != null && _user != null;

  AuthProvider() {
    _loadSession();
  }

  Future<void> _loadSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedToken = prefs.getString('kanvtech_mobile_token');
      if (savedToken != null && savedToken.isNotEmpty) {
        _token = savedToken;
        _api.setToken(savedToken);
        _user = await _api.getMe();
      }
    } catch (e) {
      _token = null;
      _user = null;
      _api.setToken(null);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.login(email, password);
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

  Future<void> logout() async {
    _token = null;
    _user = null;
    _api.setToken(null);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('kanvtech_mobile_token');
    notifyListeners();
  }

  Future<bool> switchDemoRole(String role) async {
    final credentials = {
      'ADMIN': 'admin@kanvtech.com',
      'MANAGER': 'manager@kanvtech.com',
      'L1_EMPLOYEE': 'l1.amit@kanvtech.com',
      'L2_EMPLOYEE': 'l2.vikram@kanvtech.com',
      'L3_EMPLOYEE': 'l3.priya@kanvtech.com',
      'CUSTOMER': 'rajesh@acme.com',
    };
    final email = credentials[role];
    if (email != null) {
      return await login(email, 'Password@123');
    }
    return false;
  }
}
