import 'package:flutter/material.dart';

class AppSidebar extends StatelessWidget {
  const AppSidebar({
    super.key,
    this.userName = 'Người dùng',
    this.email = '',
    this.activeKey = 'home',
    this.isAdmin = false,
    this.onHome,
    this.onScan,
    this.onHistory,
    this.onTrash,
    this.onChat,
    this.onProfile,
    this.onSettings,
    this.onAdminUsers,
    this.onAdminStatistics,
    this.onLogout,
  });

  final String userName;
  final String email;
  final String activeKey;
  final bool isAdmin;
  final VoidCallback? onHome;
  final VoidCallback? onScan;
  final VoidCallback? onHistory;
  final VoidCallback? onTrash;
  final VoidCallback? onChat;
  final VoidCallback? onProfile;
  final VoidCallback? onSettings;
  final VoidCallback? onAdminUsers;
  final VoidCallback? onAdminStatistics;
  final VoidCallback? onLogout;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Drawer(
      width: MediaQuery.sizeOf(context).width * 0.80,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: primary.withValues(alpha: 0.12),
                    child: Text(
                      userName.trim().isEmpty ? 'U' : userName.trim()[0].toUpperCase(),
                      style: TextStyle(color: primary, fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                userName,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                              ),
                            ),
                            if (isAdmin) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                decoration: BoxDecoration(
                                  color: primary.withValues(alpha: 0.10),
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                child: Text('Admin', style: TextStyle(fontSize: 10, color: primary, fontWeight: FontWeight.w800)),
                              ),
                            ],
                          ],
                        ),
                        if (email.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(email, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Color(0xFF687386))),
                        ],
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    tooltip: 'Đóng',
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(12),
                children: isAdmin
                    ? [
                        _item(context, 'dashboard', Icons.dashboard_outlined, 'Dashboard', onHome),
                        _item(context, 'users', Icons.people_outline_rounded, 'Người dùng', onAdminUsers),
                        _item(context, 'statistics', Icons.bar_chart_rounded, 'Thống kê', onAdminStatistics),
                        _item(context, 'settings', Icons.settings_outlined, 'Cài đặt', onSettings),
                      ]
                    : [
                        _item(context, 'home', Icons.home_outlined, 'Trang chủ', onHome),
                        _item(context, 'scan', Icons.document_scanner_outlined, 'Quét hóa đơn', onScan),
                        _item(context, 'history', Icons.history_rounded, 'Lịch sử hóa đơn', onHistory),
                        _item(context, 'trash', Icons.delete_outline_rounded, 'Thùng rác', onTrash),
                        _item(context, 'chat', Icons.auto_awesome_outlined, 'Hỏi đáp AI', onChat),
                        _item(context, 'profile', Icons.person_outline_rounded, 'Thông tin cá nhân', onProfile),
                        _item(context, 'settings', Icons.settings_outlined, 'Cài đặt', onSettings),
                      ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                tileColor: const Color(0xFFFFEEEE),
                leading: const Icon(Icons.logout_rounded, color: Color(0xFFB42318)),
                title: const Text('Đăng xuất', style: TextStyle(color: Color(0xFFB42318), fontWeight: FontWeight.w800)),
                onTap: onLogout,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _item(
    BuildContext context,
    String key,
    IconData icon,
    String label,
    VoidCallback? onTap,
  ) {
    final selected = activeKey == key;
    final primary = Theme.of(context).colorScheme.primary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: ListTile(
        selected: selected,
        selectedTileColor: primary.withValues(alpha: 0.10),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        leading: Icon(icon, color: selected ? primary : const Color(0xFF4D5768)),
        title: Text(
          label,
          style: TextStyle(
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? primary : const Color(0xFF2C3443),
          ),
        ),
        onTap: onTap,
      ),
    );
  }
}
