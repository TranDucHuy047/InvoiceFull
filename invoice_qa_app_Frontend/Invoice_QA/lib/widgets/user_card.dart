import 'package:flutter/material.dart';

import '../ui_contracts/thuy_ui_contracts.dart';

class AdminUserCard extends StatelessWidget {
  const AdminUserCard({
    super.key,
    required this.user,
    this.onToggleLock,
  });

  final AdminUserViewData user;
  final ValueChanged<bool>? onToggleLock;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: primary.withValues(alpha: 0.10),
              child: Text(
                user.fullName.trim().isEmpty ? 'U' : user.fullName.trim()[0].toUpperCase(),
                style: TextStyle(color: primary, fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(user.fullName, style: const TextStyle(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text(user.email, style: const TextStyle(fontSize: 12, color: Color(0xFF687386))),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    children: [
                      _pill(user.roleLabel, primary.withValues(alpha: 0.10), primary),
                      _pill(
                        user.isLocked ? 'Đã khóa' : 'Đang hoạt động',
                        user.isLocked ? const Color(0xFFFFEEEE) : const Color(0xFFE9F8EF),
                        user.isLocked ? const Color(0xFFB42318) : const Color(0xFF17733C),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Switch(
              value: user.isLocked,
              onChanged: onToggleLock,
            ),
          ],
        ),
      ),
    );
  }

  Widget _pill(String text, Color background, Color foreground) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(99)),
      child: Text(text, style: TextStyle(fontSize: 10, color: foreground, fontWeight: FontWeight.w700)),
    );
  }
}
