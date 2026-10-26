import 'dart:convert';

import 'package:flutter/material.dart';

import '../ui_contracts/thuy_ui_contracts.dart';

class ExtractionResultScreen extends StatefulWidget {
  const ExtractionResultScreen({
    super.key,
    required this.data,
    this.initialMode = ExtractionViewMode.table,
    this.onEdit,
    this.onConfirmSave,
  });

  final InvoiceDetailViewData data;
  final ExtractionViewMode initialMode;
  final VoidCallback? onEdit;
  final Future<void> Function()? onConfirmSave;

  @override
  State<ExtractionResultScreen> createState() => _ExtractionResultScreenState();
}

class _ExtractionResultScreenState extends State<ExtractionResultScreen> {
  late ExtractionViewMode _mode;
  bool _rawExpanded = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _mode = widget.initialMode;
  }

  Map<String, dynamic> get _jsonData {
    if (widget.data.structuredJson.isNotEmpty) return widget.data.structuredJson;
    return {
      'invoice_id': widget.data.invoiceId,
      'store_name': widget.data.storeName,
      'address': widget.data.address,
      'date': widget.data.dateLabel,
      'tax_code': widget.data.taxCode,
      'tax_amount': widget.data.taxAmount,
      'total_amount': widget.data.totalAmount,
      'items': widget.data.items
          .map((item) => {
                'item_name': item.name,
                'quantity': item.quantity,
                'unit_price': item.unitPrice,
                'total_price': item.totalPrice,
              })
          .toList(),
    };
  }

  Future<void> _save() async {
    final action = widget.onConfirmSave;
    if (action == null || _saving) return;
    setState(() => _saving = true);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã xác nhận và lưu hóa đơn.')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Dữ liệu trích xuất', style: TextStyle(fontWeight: FontWeight.w900))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            SegmentedButton<ExtractionViewMode>(
              segments: const [
                ButtonSegment(value: ExtractionViewMode.table, icon: Icon(Icons.table_rows_outlined), label: Text('Bảng')),
                ButtonSegment(value: ExtractionViewMode.json, icon: Icon(Icons.data_object_rounded), label: Text('JSON')),
              ],
              selected: {_mode},
              onSelectionChanged: (value) => setState(() => _mode = value.first),
            ),
            const SizedBox(height: 16),
            if (_mode == ExtractionViewMode.table)
              _TableContent(data: widget.data)
            else
              _JsonContent(jsonData: _jsonData),
            const SizedBox(height: 14),
            Card(
              child: ExpansionTile(
                initiallyExpanded: _rawExpanded,
                onExpansionChanged: (value) => setState(() => _rawExpanded = value),
                title: const Text('Văn bản OCR thô', style: TextStyle(fontWeight: FontWeight.w900)),
                subtitle: Text(_rawExpanded ? 'Đang mở rộng' : 'Nhấn để xem nội dung nhận diện trực tiếp'),
                children: [
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: const Color(0xFF151C2C), borderRadius: BorderRadius.circular(13)),
                    child: SelectableText(
                      widget.data.rawText.isEmpty ? '(Không có Raw OCR)' : widget.data.rawText,
                      style: const TextStyle(color: Color(0xFFE7EBF4), fontFamily: 'monospace', height: 1.45),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: OutlinedButton.icon(onPressed: widget.onEdit, icon: const Icon(Icons.edit_outlined), label: const Text('Chỉnh sửa'))),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: widget.onConfirmSave == null || _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox(width: 17, height: 17, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.check_circle_outline_rounded),
                    label: Text(_saving ? 'Đang lưu...' : 'Xác nhận & Lưu'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TableContent extends StatelessWidget {
  const _TableContent({required this.data});

  final InvoiceDetailViewData data;

  String _money(double value) => '${value.round()} đ';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Thông tin chung', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
        const SizedBox(height: 9),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Table(
              columnWidths: const {0: FlexColumnWidth(0.9), 1: FlexColumnWidth(1.4)},
              children: [
                _row('Cửa hàng', data.storeName),
                _row('Địa chỉ', data.address),
                _row('Ngày', data.dateLabel),
                _row('Mã số thuế', data.taxCode),
                _row('VAT', _money(data.taxAmount)),
                _row('Tổng tiền', _money(data.totalAmount)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text('Danh sách sản phẩm', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
        const SizedBox(height: 9),
        Card(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              columns: const [
                DataColumn(label: Text('Tên')),
                DataColumn(label: Text('SL')),
                DataColumn(label: Text('Đơn giá')),
                DataColumn(label: Text('Thành tiền')),
              ],
              rows: data.items
                  .map((item) => DataRow(cells: [
                        DataCell(SizedBox(width: 150, child: Text(item.name, overflow: TextOverflow.ellipsis))),
                        DataCell(Text('${item.quantity}')),
                        DataCell(Text(_money(item.unitPrice))),
                        DataCell(Text(_money(item.totalPrice))),
                      ]))
                  .toList(),
            ),
          ),
        ),
      ],
    );
  }

  TableRow _row(String label, String value) {
    return TableRow(
      children: [
        Padding(padding: const EdgeInsets.symmetric(vertical: 9), child: Text(label, style: const TextStyle(color: Color(0xFF687386)))),
        Padding(padding: const EdgeInsets.symmetric(vertical: 9), child: Text(value.isEmpty ? '—' : value, style: const TextStyle(fontWeight: FontWeight.w800))),
      ],
    );
  }
}

class _JsonContent extends StatelessWidget {
  const _JsonContent({required this.jsonData});

  final Map<String, dynamic> jsonData;

  @override
  Widget build(BuildContext context) {
    final pretty = const JsonEncoder.withIndent('  ').convert(jsonData);
    return Card(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 6, 6),
            child: Row(
              children: [
                const Expanded(child: Text('JSON có cấu trúc', style: TextStyle(fontWeight: FontWeight.w900))),
                IconButton(
                  tooltip: 'Sao chép',
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('UI đã sẵn nút Copy; Loan gắn Clipboard/logic nếu cần.')));
                  },
                  icon: const Icon(Icons.copy_rounded),
                ),
                IconButton(onPressed: () {}, icon: const Icon(Icons.open_in_full_rounded)),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: const Color(0xFF151C2C), borderRadius: BorderRadius.circular(13)),
            child: SelectableText(pretty, style: const TextStyle(color: Color(0xFFE7EBF4), fontFamily: 'monospace', height: 1.45)),
          ),
        ],
      ),
    );
  }
}
