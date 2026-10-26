import 'package:flutter/material.dart';

import '../ui_contracts/thuy_ui_contracts.dart';
import '../widgets/app_sidebar.dart';
import '../widgets/stat_card.dart';

/// Layout Admin thuần UI của Thúy.
/// Loan truyền dữ liệu Provider vào constructor/callback; file này không import Provider.
class AdminDashboardLayout extends StatelessWidget {
  const AdminDashboardLayout({
    super.key,
    this.adminName = 'Admin',
    this.adminEmail = '',
    this.statistics = const AdminStatisticsViewData(),
    this.recentActivities = const [],
    this.onOpenUsers,
    this.onOpenStatistics,
    this.onOpenSettings,
    this.onLogout,
  });

  final String adminName;
  final String adminEmail;
  final AdminStatisticsViewData statistics;
  final List<String> recentActivities;
  final VoidCallback? onOpenUsers;
  final VoidCallback? onOpenStatistics;
  final VoidCallback? onOpenSettings;
  final VoidCallback? onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: AppSidebar(
        userName: adminName,
        email: adminEmail,
        isAdmin: true,
        activeKey: 'dashboard',
        onHome: () => Navigator.of(context).maybePop(),
        onAdminUsers: onOpenUsers,
        onAdminStatistics: onOpenStatistics,
        onSettings: onOpenSettings,
        onLogout: onLogout,
      ),
      appBar: AppBar(
        title: const Text('Admin Dashboard', style: TextStyle(fontWeight: FontWeight.w900)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: CircleAvatar(
              radius: 17,
              child: Text(adminName.trim().isEmpty ? 'A' : adminName.trim()[0].toUpperCase()),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
          children: [
            const Text('Tổng quan hệ thống', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            const Text('Theo dõi số liệu vận hành mà không hiển thị chi tiết ảnh hóa đơn riêng tư của User.', style: TextStyle(color: Color(0xFF687386), height: 1.4)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: StatCard(icon: Icons.receipt_long_rounded, title: 'Tổng hóa đơn', value: '${statistics.totalInvoices}', subtitle: 'Toàn hệ thống')),
                const SizedBox(width: 8),
                Expanded(child: StatCard(icon: Icons.people_alt_outlined, title: 'Tổng User', value: '${statistics.totalUsers}', subtitle: 'Tài khoản')),
              ],
            ),
            const SizedBox(height: 8),
            StatCard(icon: Icons.auto_awesome_outlined, title: 'Tổng truy vấn AI/RAG', value: '${statistics.totalRagQueries}', subtitle: 'Lượt truy vấn'),
            const SizedBox(height: 20),
            Row(
              children: [
                const Expanded(child: Text('Quản trị nhanh', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900))),
                TextButton(onPressed: onOpenStatistics, child: const Text('Xem thống kê')),
              ],
            ),
            const SizedBox(height: 8),
            Card(
              child: Column(
                children: [
                  ListTile(leading: const Icon(Icons.manage_accounts_outlined), title: const Text('Quản lý người dùng', style: TextStyle(fontWeight: FontWeight.w800)), subtitle: const Text('Tìm kiếm, khóa hoặc mở khóa tài khoản'), trailing: const Icon(Icons.chevron_right_rounded), onTap: onOpenUsers),
                  const Divider(height: 1),
                  ListTile(leading: const Icon(Icons.bar_chart_rounded), title: const Text('Thống kê hệ thống', style: TextStyle(fontWeight: FontWeight.w800)), subtitle: const Text('Hóa đơn, User và truy vấn RAG'), trailing: const Icon(Icons.chevron_right_rounded), onTap: onOpenStatistics),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const Text('Hoạt động gần đây', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Card(
              child: recentActivities.isEmpty
                  ? const Padding(padding: EdgeInsets.all(18), child: Text('Chưa có hoạt động gần đây.', style: TextStyle(color: Color(0xFF687386))))
                  : Column(
                      children: recentActivities
                          .take(5)
                          .map((text) => ListTile(leading: const Icon(Icons.history_rounded), title: Text(text), dense: true))
                          .toList(),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
