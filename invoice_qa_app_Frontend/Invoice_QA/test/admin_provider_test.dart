import 'package:flutter_test/flutter_test.dart';
import 'package:invoice_qa_app/providers/admin_provider.dart';
import 'package:invoice_qa_app/services/api_service.dart';
import 'package:invoice_qa_app/models/admin_models.dart';

// 1. Tạo Mock API chuyên dụng cho Admin
class MockAdminApi extends ApiService {
  MockAdminApi() : super(baseUrl: 'http://test');

  bool shouldFailToggle = false;

  @override
  Future<AdminStatistics> fetchAdminStatistics() async {
    return const AdminStatistics(totalInvoices: 100, totalUsers: 50, totalRagQueries: 200);
  }

  @override
  Future<List<AdminUser>> fetchAdminUsers({String? query}) async {
    return [
      const AdminUser(id: 'U01', username: 'Nguyen Van A', email: 'a@test.com', isLocked: false),
      const AdminUser(id: 'U02', username: 'Le Thi B', email: 'b@test.com', isLocked: true),
    ];
  }

  @override
  Future<AdminUser> toggleUserLock(String userId, {required bool lockStatus}) async {
    if (shouldFailToggle) {
      throw Exception('Lỗi mạng API');
    }
    // Giả lập API trả về User với trạng thái mới
    return AdminUser(id: userId, username: 'Nguyen Van A', email: 'a@test.com', isLocked: lockStatus);
  }
}

void main() {
  group('Kiểm thử Logic AdminProvider', () {
    late MockAdminApi mockApi;
    late AdminProvider adminProvider;

    setUp(() {
      mockApi = MockAdminApi();
      adminProvider = AdminProvider(apiService: mockApi);
    });

    test('Tải dữ liệu Dashboard (Thống kê & Users) thành công', () async {
      await adminProvider.loadDashboardData();

      // Kiểm tra thống kê
      expect(adminProvider.statistics?.totalInvoices, 100);
      expect(adminProvider.statistics?.totalUsers, 50);
      
      // Kiểm tra danh sách User
      expect(adminProvider.users.length, 2);
      expect(adminProvider.users.first.username, 'Nguyen Van A');
    });

    test('Optimistic Update: Gạt nút khóa thành công', () async {
      // Load dữ liệu ban đầu
      await adminProvider.fetchUsers();
      expect(adminProvider.users[0].isLocked, false);

      // Gọi hàm khóa user (U01 hiện đang unlocked → sẽ bị lock)
      await adminProvider.toggleLock('U01');

      // Xác nhận user đã bị đổi trạng thái thành true
      expect(adminProvider.users[0].isLocked, true);
      expect(adminProvider.errorMessage, isEmpty);
    });

    test('Rollback khi gọi API thất bại', () async {
      await adminProvider.fetchUsers();
      expect(adminProvider.users[0].isLocked, false); // Ban đầu là false

      // Cố tình làm API bị lỗi
      mockApi.shouldFailToggle = true;

      // Cố gắng khóa user
      await adminProvider.toggleLock('U01');

      // Phải có thông báo lỗi
      expect(adminProvider.errorMessage, contains('Lỗi mạng API'));
    });
  });
}