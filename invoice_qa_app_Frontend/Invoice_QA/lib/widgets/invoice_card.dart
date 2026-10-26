
import 'package:flutter/material.dart';
import '../ui_contracts/thuy_ui_contracts.dart';

class InvoiceCard extends StatelessWidget {
  const InvoiceCard({
    super.key,
    this.invoice,
    this.item, // Support both for backward compatibility temporarily
    this.onTap,
  });

  final InvoiceHistoryViewData? invoice;
  final InvoiceHistoryViewData? item;
  final VoidCallback? onTap;

  String _formatMoney(double amount) {
    return '${amount.round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')}đ';
  }

  Color _getLogoColor(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('fpt')) return Colors.deepOrange;
    if (lower.contains('highland')) return Colors.red;
    if (lower.contains('coffee house')) return const Color(0xFFF2E6DB); // light brown
    return const Color(0xFFF0EDFF); // light purple default
  }

  Widget _buildLogo(String name) {
    final color = _getLogoColor(name);
    final isLight = color == const Color(0xFFF2E6DB) || color == const Color(0xFFF0EDFF);
    final textColor = isLight ? Colors.brown.shade800 : Colors.white;

    String initial = 'I';
    if (name.isNotEmpty) {
      final parts = name.split(' ');
      if (parts.length > 1 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
        initial = parts[0][0].toUpperCase();
      } else {
        initial = name[0].toUpperCase();
      }
    }

    // if name contains fpt or highland, we can just use initials or a generic icon
    Widget content;
    if (name.toLowerCase().contains('coffee house')) {
      content = Icon(Icons.receipt_long, color: textColor);
    } else {
      content = Text(initial, style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 18));
    }

    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
      ),
      alignment: Alignment.center,
      child: content,
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = invoice ?? item;
    if (data == null) return const SizedBox();

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            _buildLogo(data.storeName),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    data.storeName.isEmpty ? 'Chưa rõ cửa hàng' : data.storeName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${data.dateLabel} - ${data.id.length > 5 ? data.id.substring(0, 5).toUpperCase() : data.id.toUpperCase()}',
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _formatMoney(data.totalAmount),
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
            ),
            const SizedBox(width: 8),
            Icon(Icons.chevron_right, color: Colors.grey.shade400, size: 20),
          ],
        ),
      ),
    );
  }
}
