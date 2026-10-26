class AdminStatistics {
  const AdminStatistics({
    required this.totalUsers,
    required this.totalInvoices,
    required this.totalRagQueries,
  });

  final int totalUsers;
  final int totalInvoices;
  final int totalRagQueries;

  factory AdminStatistics.fromJson(Map<String, dynamic> json) {
    return AdminStatistics(
      totalUsers: json['total_users'] ?? 0,
      totalInvoices: json['total_invoices'] ?? 0,
      // Backend trả về 'total_chat_queries' (không phải 'total_rag_queries')
      totalRagQueries: json['total_chat_queries'] ?? json['total_rag_queries'] ?? 0,
    );
  }
}

class AdminUser {
  const AdminUser({
    required this.id,
    required this.username,
    required this.email,
    this.role = 'user',
    this.isLocked = false,
  });

  final String id;
  /// Username = tên đăng nhập (backend không có full_name)
  final String username;
  final String email;
  final String role;
  final bool isLocked;

  /// Hiển thị tên thân thiện: username được dùng thay fullName
  String get fullName => username;

  /// Kiểm tra quyền Admin
  bool get isAdmin => role == 'admin';

  factory AdminUser.fromJson(Map<String, dynamic> json) {
    return AdminUser(
      id: json['id']?.toString() ?? '',
      // Backend trả về 'username' (không có 'full_name')
      username: json['username'] ?? json['full_name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'user',
      isLocked: json['is_locked'] == true || json['is_locked'] == 1,
    );
  }

  AdminUser copyWith({
    String? id,
    String? username,
    String? email,
    String? role,
    bool? isLocked,
  }) {
    return AdminUser(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      role: role ?? this.role,
      isLocked: isLocked ?? this.isLocked,
    );
  }
}