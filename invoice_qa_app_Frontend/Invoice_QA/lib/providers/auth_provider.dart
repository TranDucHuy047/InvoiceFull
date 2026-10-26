import 'package:flutter/foundation.dart';

import '../models/user_model.dart';
import '../services/api_service.dart';
import '../utils/jwt_auth.dart';

enum AuthEvent {
  none,
  loggedIn,
  loggedOut,
  sessionExpired,
  profileUpdated,
  passwordChanged,
}

class AuthProvider with ChangeNotifier {
  AuthProvider({ApiService? apiService})
      : _apiService = apiService ?? ApiService.instance {
    _apiService.onUnauthorized = handleUnauthorized;
  }

  final ApiService _apiService;

  AppUser? _currentUser;
  AuthEvent _lastEvent = AuthEvent.none;
  bool _isRestoring = true;
  bool _isBusy = false;
  String _errorMessage = '';

  AppUser? get currentUser => _currentUser;
  AuthEvent get lastEvent => _lastEvent;
  bool get isRestoring => _isRestoring;
  bool get isBusy => _isBusy;
  bool get isAuthenticated => _currentUser != null;
  bool get isAdmin => _currentUser?.isAdmin ?? false;
  String get errorMessage => _errorMessage;
  String get displayName {
    final name = _currentUser?.fullName.trim() ?? '';
    if (name.isNotEmpty) return name;
    return _currentUser?.email ?? 'Người dùng';
  }

  Future<void> restoreSession() async {
    _isRestoring = true;
    notifyListeners();
    try {
      final token = await _apiService.tokenStore.read();
      if (token == null || token.isEmpty || JwtAuth.isExpired(token)) {
        await _apiService.tokenStore.delete();
        _currentUser = null;
        _lastEvent = AuthEvent.none;
        return;
      }
      
      try {
        // Lấy thông tin user mới nhất từ Backend (chứa full_name, etc.)
        _currentUser = await _apiService.fetchMe();
      } catch (_) {
        // Fallback nếu API lỗi (offline)
        _currentUser = JwtAuth.decodeUser(token);
      }
      
      if (_currentUser?.isAdmin == true) {
        _lastEvent = AuthEvent.loggedIn;
        return;
      }
      
      _lastEvent = AuthEvent.loggedIn;
    } catch (_) {
      await _apiService.tokenStore.delete();
      _currentUser = null;
      _lastEvent = AuthEvent.none;
    } finally {
      _isRestoring = false;
      notifyListeners();
    }
  }

  Future<void> login(String username, String password) async {
    _setBusy(true);
    try {
      final token = await _apiService.login(
        username: username.trim(),
        password: password,
      );
      await _persistSession(token);
      _lastEvent = AuthEvent.loggedIn;
    } finally {
      _setBusy(false);
    }
  }

  Future<void> register(String fullName, String username, String email, String password, String otpCode) async {
    _setBusy(true);
    try {
      await _apiService.register(
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password: password,
        otpCode: otpCode.trim(),
      );
      // Sau khi đăng ký, tự động đăng nhập
      await login(username, password);
    } finally {
      _setBusy(false);
    }
  }

  Future<void> updateProfile(String fullName, String email) async {
    if (!isAuthenticated) {
      throw Exception('Bạn cần đăng nhập để cập nhật thông tin.');
    }
    _setBusy(true);
    try {
      final updated = await _apiService.updateProfile(
        fullName: fullName.trim(),
        email: email.trim(),
      );
      _currentUser = _currentUser!.copyWith(
        fullName: updated.fullName.isNotEmpty ? updated.fullName : fullName.trim(),
        email: updated.email.isNotEmpty ? updated.email : email.trim(),
      );
      _lastEvent = AuthEvent.profileUpdated;
    } finally {
      _setBusy(false);
    }
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    if (!isAuthenticated) {
      throw Exception('Bạn cần đăng nhập để đổi mật khẩu.');
    }
    _setBusy(true);
    try {
      await _apiService.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
      _lastEvent = AuthEvent.passwordChanged;
    } finally {
      _setBusy(false);
    }
  }

  Future<void> logout() async {
    await _apiService.tokenStore.delete();
    _currentUser = null;
    _lastEvent = AuthEvent.loggedOut;
    notifyListeners();
  }

  void handleUnauthorized() {
    _currentUser = null;
    _lastEvent = AuthEvent.sessionExpired;
    notifyListeners();
  }

  @visibleForTesting
  void setSessionForTest(AppUser user) {
    _currentUser = user;
    _isRestoring = false;
    _lastEvent = AuthEvent.loggedIn;
    notifyListeners();
  }

  Future<void> _persistSession(String token) async {
    await _apiService.tokenStore.write(token);
    try {
      final user = await _apiService.fetchMe();
      _currentUser = user;
    } catch (_) {
      _currentUser = JwtAuth.decodeUser(token);
    }
    _errorMessage = '';
  }

  void _setBusy(bool value) {
    _isBusy = value;
    if (value) _errorMessage = '';
    notifyListeners();
  }
}
