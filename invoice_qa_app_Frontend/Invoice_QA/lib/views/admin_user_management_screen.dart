import 'package:flutter/material.dart';

import '../ui_contracts/thuy_ui_contracts.dart';
import '../widgets/user_card.dart';

class AdminUserManagementScreen extends StatefulWidget {
  const AdminUserManagementScreen({
    super.key,
    required this.users,
    this.initialQuery = '',
    this.onSearchChanged,
    this.onToggleLock,
    this.onRefresh,
  });

  final List<AdminUserViewData> users;
  final String initialQuery;
  final ValueChanged<String>? onSearchChanged;
  final ToggleAdminUserLockAction? onToggleLock;
  final Future<void> Function()? onRefresh;

  @override
  State<AdminUserManagementScreen> createState() => _AdminUserManagementScreenState();
}

class _AdminUserManagementScreenState extends State<AdminUserManagementScreen> {
  late final TextEditingController _search;
  String _query = '';
  final Set<String> _busyUsers = {};

  @override
  void initState() {
    super.initState();
    _query = widget.initialQuery;
    _search = TextEditingController(text: widget.initialQuery);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<AdminUserViewData> get _visible => widget.users;

  void _onSearch(String value) {
    setState(() => _query = value);
    // Chỉ phát sự kiện UI; debounce và gọi API thuộc phần Logic của Loan.
    widget.onSearchChanged?.call(value.trim());
  }

  Future<void> _toggle(AdminUserViewData user, bool shouldLock) async {
    final action = widget.onToggleLock;
    if (action == null || _busyUsers.contains(user.id)) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AdminToggleLockDialog(user: user, shouldLock: shouldLock),
    );
    if (confirmed != true) return;
    setState(() => _busyUsers.add(user.id));
    try {
      await action(user.id, shouldLock);
    } finally {
      if (mounted) setState(() => _busyUsers.remove(user.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visible;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Quản lý người dùng', style: TextStyle(fontWeight: FontWeight.w900)),
        actions: [
          if (widget.onRefresh != null)
            IconButton(onPressed: () => widget.onRefresh!.call(), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            TextField(
              controller: _search,
              onChanged: _onSearch,
              decoration: InputDecoration(
                hintText: 'Tìm theo tên hoặc email...',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          _search.clear();
                          _onSearch('');
                        },
                        icon: const Icon(Icons.close_rounded),
                      ),
              ),
            ),
            const SizedBox(height: 12),
            if (_query.isNotEmpty)
              Row(
                children: [
                  Expanded(child: Text('Kết quả cho “$_query”', style: const TextStyle(fontWeight: FontWeight.w800))),
                  Text('${visible.length} kết quả', style: const TextStyle(color: Color(0xFF687386))),
                ],
              ),
            if (_query.isNotEmpty) const SizedBox(height: 10),
            if (visible.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 80),
                child: Column(
                  children: [
                    Icon(Icons.person_search_rounded, size: 52, color: Color(0xFF8D96A8)),
                    SizedBox(height: 12),
                    Text('Không tìm thấy người dùng', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                    SizedBox(height: 6),
                    Text('Hãy thử từ khóa khác.', style: TextStyle(color: Color(0xFF687386))),
                  ],
                ),
              )
            else
              ...visible.map(
                (user) => Padding(
                  padding: const EdgeInsets.only(bottom: 9),
                  child: Stack(
                    children: [
                      AdminUserCard(
                        user: user,
                        onToggleLock: widget.onToggleLock == null ? null : (value) => _toggle(user, value),
                      ),
                      if (_busyUsers.contains(user.id))
                        const Positioned.fill(child: ColoredBox(color: Color(0x66FFFFFF), child: Center(child: CircularProgressIndicator()))),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class AdminToggleLockDialog extends StatelessWidget {
  const AdminToggleLockDialog({super.key, required this.user, required this.shouldLock});

  final AdminUserViewData user;
  final bool shouldLock;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: Icon(shouldLock ? Icons.lock_outline_rounded : Icons.lock_open_rounded),
      title: Text(shouldLock ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'),
      content: Text('${user.fullName}\n${user.email}'),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Hủy')),
        FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Xác nhận')),
      ],
    );
  }
}
