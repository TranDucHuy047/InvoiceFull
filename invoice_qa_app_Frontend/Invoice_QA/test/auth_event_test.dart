import 'package:flutter_test/flutter_test.dart';
import 'package:invoice_qa_app/models/user_model.dart';
import 'package:invoice_qa_app/providers/auth_provider.dart';
import 'package:invoice_qa_app/services/api_service.dart';
import 'package:invoice_qa_app/services/token_store.dart';

class _AuthEventApi extends ApiService {
  _AuthEventApi() : super(tokenStore: MemoryTokenStore());

  AppUser profile = AppUser(
    id: 'U01',
    email: 'user@example.com',
    fullName: 'User',
    roleId: '1',
  );

  @override
  Future<AppUser> updateProfile({
    required String fullName,
    required String email,
  }) async {
    profile = profile.copyWith(fullName: fullName, email: email);
    return profile;
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    if (currentPassword.isEmpty || newPassword.isEmpty) {
      throw Exception('Thiếu mật khẩu.');
    }
  }
}

void main() {
  test('Bắt sự kiện đổi mật khẩu và cập nhật thông tin', () async {
    final api = _AuthEventApi();
    final auth = AuthProvider(apiService: api);
    await api.tokenStore.write('session');
    auth.setSessionForTest(api.profile);

    await auth.updateProfile('Loan Nguyen', 'loan@example.com');
    expect(auth.lastEvent, AuthEvent.profileUpdated);
    expect(auth.currentUser?.fullName, 'Loan Nguyen');
    expect(auth.displayName, 'Loan Nguyen');

    await auth.changePassword('oldpass', 'newpass123');
    expect(auth.lastEvent, AuthEvent.passwordChanged);

    auth.handleUnauthorized();
    expect(auth.lastEvent, AuthEvent.sessionExpired);
    expect(auth.isAuthenticated, isFalse);
  });
}
