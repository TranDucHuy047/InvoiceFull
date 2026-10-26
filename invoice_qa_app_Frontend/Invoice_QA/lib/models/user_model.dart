class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.roleId,
  });

  final String id;
  final String email;
  /// fullName được map từ trường 'username' của Backend (backend không có full_name).
  final String fullName;
  final String roleId;

  // Thuộc tính kiểm tra quyền Admin
  bool get isAdmin => roleId == 'admin';

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id']?.toString() ?? '',
      email: json['email'] ?? '',
      // Backend trả về 'full_name' sau bản vá, fallback 'username'
      fullName: json['full_name'] != null && json['full_name'].toString().isNotEmpty 
          ? json['full_name'] 
          : (json['username'] ?? ''),
      // Backend trả về 'role' (không phải 'role_id')
      roleId: json['role'] ?? json['role_id'] ?? 'user',
    );
  }

  // Hàm copyWith để cập nhật thông tin State (đổi tên/email)
  AppUser copyWith({
    String? id,
    String? email,
    String? fullName,
    String? roleId,
  }) {
    return AppUser(
      id: id ?? this.id,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      roleId: roleId ?? this.roleId,
    );
  }
}