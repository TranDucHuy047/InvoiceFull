import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/admin_models.dart';
import '../services/api_service.dart';

class AdminProvider with ChangeNotifier {
  AdminProvider({ApiService? apiService})
    : _apiService = apiService ?? ApiService.instance;

  final ApiService _apiService;

  AdminStatistics? _statistics;
  List<AdminUser> _users = [];
  bool _isLoadingStats = false;
  bool _isLoadingUsers = false;
  String _errorMessage = '';

  // Timer để xử lý Debounce cho ô tìm kiếm
  Timer? _debounceTimer;

  AdminStatistics? get statistics => _statistics;
  List<AdminUser> get users => _users;
  bool get isLoadingStats => _isLoadingStats;
  bool get isLoadingUsers => _isLoadingUsers;
  String get errorMessage => _errorMessage;

  // Gọi đồng thời cả 2 API khi vừa vào Dashboard
  Future<void> loadDashboardData() async {
    await Future.wait([fetchStatistics(), fetchUsers()]);
  }

  Future<void> fetchStatistics() async {
    _isLoadingStats = true;
    notifyListeners();
    try {
      _statistics = await _apiService.fetchAdminStatistics();
      _errorMessage = '';
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoadingStats = false;
      notifyListeners();
    }
  }

  Future<void> fetchUsers({String? query}) async {
    _isLoadingUsers = true;
    notifyListeners();
    try {
      final response = await _apiService.fetchAdminUsers(query: query);
      // Bọc List<AdminUser>.from() để ép kiểu tường minh
      _users = List<AdminUser>.from(response);
      _errorMessage = '';
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoadingUsers = false;
      notifyListeners();
    }
  }

  // Xử lý Debounce: Người dùng dừng gõ 500ms mới gọi API
  void onSearchChanged(String query) {
    if (_debounceTimer?.isActive ?? false) _debounceTimer!.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 500), () {
      fetchUsers(query: query);
    });
  }

  Future<void> toggleLock(String userId) async {
    try {
      // Xác định trạng thái hiện tại để đảo chiều
      final currentUser = _users.firstWhere(
        (u) => u.id == userId,
        orElse: () => const AdminUser(id: '', username: '', email: ''),
      );
      final newLockStatus = !currentUser.isLocked;

      await _apiService.toggleUserLock(userId, lockStatus: newLockStatus);
      // Cập nhật local state ngay lập tức (optimistic update)
      final index = _users.indexWhere((u) => u.id == userId);
      if (index != -1) {
        _users[index] = _users[index].copyWith(isLocked: newLockStatus);
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }


  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }
}
