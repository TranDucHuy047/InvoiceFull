import 'package:flutter/material.dart';

import '../ui_contracts/thuy_ui_contracts.dart';
import '../widgets/adaptive_image.dart';
import 'extraction_result_screen.dart';

class InvoiceDetailScreen extends StatelessWidget {
  const InvoiceDetailScreen({
    super.key,
    required this.data,
    this.onEdit,
    this.onDelete,
    this.onAskAi,
    this.onConfirmSave,
  });

  final InvoiceDetailViewData data;
  final VoidCallback? onEdit;
  final Future<void> Function()? onDelete;
  final VoidCallback? onAskAi;
  final Future<void> Function()? onConfirmSave;

  String _money(double value) {
    final text = value.round().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < text.length; i++) {
      if (i > 0 && (text.length - i) % 3 == 0) buffer.write('.');
      buffer.write(text[i]);
    }
    return '${buffer.toString()} đ';
  }

  @override
  Widget build(BuildContext context) {
    final path = data.imagePath;
    final confidence = data.ocrConfidence;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết hóa đơn', style: TextStyle(fontWeight: FontWeight.w900)),
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'edit') onEdit?.call();
              if (value == 'delete') _confirmDelete(context);
            },
            itemBuilder: (_) => [
              if (onEdit != null) const PopupMenuItem(value: 'edit', child: Text('Chỉnh sửa')),
              if (onDelete != null) const PopupMenuItem(value: 'delete', child: Text('Xóa')),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: SizedBox(
                height: path != null && path.isNotEmpty ? 210 : 160,
                child: AdaptiveImage(
                  source: path ?? '',
                  fit: BoxFit.cover,
                  fallback: Container(
                    decoration: const BoxDecoration(color: Color(0xFFF0F2F7)),
                    child: const Center(
                      child: Icon(Icons.receipt_long_rounded, size: 55, color: Color(0xFF8D96A8)),
                    ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Thông tin hóa đơn', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 12),
                    _line('Cửa hàng', data.storeName),
                    _line('Địa chỉ', data.address),
                    _line('Ngày', data.dateLabel),
                    _line('Mã số thuế', data.taxCode),
                    _line('VAT', _money(data.taxAmount)),
                    _line('Tổng thanh toán', _money(data.totalAmount), strong: true),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: ExpansionTile(
                initiallyExpanded: true,
                title: Text('Danh sách sản phẩm (${data.items.length})', style: const TextStyle(fontWeight: FontWeight.w900)),
                children: data.items
                    .map(
                      (item) => ListTile(
                        title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text('${item.quantity} × ${_money(item.unitPrice)}'),
                        trailing: Text(_money(item.totalPrice), style: const TextStyle(fontWeight: FontWeight.w900)),
                      ),
                    )
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: ExpansionTile(
                title: const Text('Văn bản OCR thô', style: TextStyle(fontWeight: FontWeight.w900)),
                children: [
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: const Color(0xFF151C2C), borderRadius: BorderRadius.circular(13)),
                    child: SelectableText(data.rawText.isEmpty ? '(Không có Raw OCR)' : data.rawText, style: const TextStyle(color: Color(0xFFE7EBF4), fontFamily: 'monospace')),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(onPressed: onAskAi, icon: const Icon(Icons.auto_awesome_rounded), label: const Text('Hỏi AI về hóa đơn')),
            const SizedBox(height: 9),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ExtractionResultScreen(data: data, onEdit: onEdit, onConfirmSave: onConfirmSave),
                  ),
                );
              },
              icon: const Icon(Icons.data_object_rounded),
              label: const Text('Xem dữ liệu Bảng / JSON'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _line(String label, String value, {bool strong = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(label, style: const TextStyle(color: Color(0xFF687386)))),
          Expanded(child: Text(value.isEmpty ? '—' : value, textAlign: TextAlign.right, style: TextStyle(fontWeight: strong ? FontWeight.w900 : FontWeight.w700))),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final action = onDelete;
    if (action == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Xóa hóa đơn?'),
        content: const Text('Bạn có chắc muốn xóa hóa đơn này? Thao tác này không thể hoàn tác.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Hủy')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: const Color(0xFFB42318)), onPressed: () => Navigator.of(context).pop(true), child: const Text('Xóa')),
        ],
      ),
    );
    if (ok == true) await action();
  }
}
