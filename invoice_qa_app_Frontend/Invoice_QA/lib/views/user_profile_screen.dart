
import 'package:flutter/material.dart';
import '../ui_contracts/thuy_ui_contracts.dart';

class UserProfileScreen extends StatelessWidget {
  const UserProfileScreen({
    super.key,
    required this.profile,
    this.onEditProfile,
    this.onChangePassword,
  });

  final UserProfileViewData profile;
  final VoidCallback? onEditProfile;
  final VoidCallback? onChangePassword;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).primaryColor;

    String initials = 'U';
    if (profile.fullName.isNotEmpty) {
      final parts = profile.fullName.split(' ');
      if (parts.length > 1 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
        initials = '${parts[0][0]}${parts[1][0]}'.toUpperCase();
      } else {
        initials = profile.fullName.substring(0, 2).toUpperCase();
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF9F9FB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Hồ sơ cá nhân',
          style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const SizedBox(height: 16),
            // Avatar
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFA776), Color(0xFFF06292)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(30),
              ),
              alignment: Alignment.center,
              child: Text(
                initials,
                style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              profile.fullName.isNotEmpty ? profile.fullName : 'Người dùng',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black87),
            ),
            const SizedBox(height: 4),
            Text(
              profile.email,
              style: TextStyle(color: Colors.grey.shade500),
            ),
            const SizedBox(height: 32),

            // Info Card
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  _buildInfoRow('User ID', 'USR-${profile.userId.length > 6 ? profile.userId.substring(0, 6).toUpperCase() : profile.userId.toUpperCase()}'),
                  const Divider(height: 1, color: Color(0xFFEEEEEE)),
                  _buildInfoRow('Họ và tên', profile.fullName),
                  const Divider(height: 1, color: Color(0xFFEEEEEE)),
                  _buildInfoRow('Email', profile.email),
                  const Divider(height: 1, color: Color(0xFFEEEEEE)),
                  _buildInfoRow('Ngày tạo', '12/04/2026'), // Hardcoded based on design requirement, or could be fetched if backend supports
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Actions
            FilledButton(
              onPressed: onEditProfile,
              style: FilledButton.styleFrom(
                backgroundColor: primary,
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: const Text('Chỉnh sửa thông tin', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onChangePassword,
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Colors.grey.shade300),
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: Text('Đổi mật khẩu', style: TextStyle(color: Colors.indigo.shade900, fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () {
                // TODO: Xóa tài khoản
              },
              icon: const Icon(Icons.delete_outline, color: Colors.red),
              label: const Text('Xóa tài khoản', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 16)),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Colors.red.withValues(alpha: 0.3)),
                backgroundColor: Colors.red.withValues(alpha: 0.05),
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
            
            const SizedBox(height: 100),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade500)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.black87)),
        ],
      ),
    );
  }
}
