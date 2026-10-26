
import 'package:flutter/material.dart';
import '../models/invoice_result_model.dart';

class InvoiceResultScreen extends StatefulWidget {
  const InvoiceResultScreen({
    super.key,
    required this.result,
    required this.imagePath,
    this.onAskAboutInvoice,
  });

  final InvoiceResult result;
  final String imagePath;
  final VoidCallback? onAskAboutInvoice;

  @override
  State<InvoiceResultScreen> createState() => _InvoiceResultScreenState();
}

class _InvoiceResultScreenState extends State<InvoiceResultScreen> {
  String _formatMoney(double amount) {
    return '${amount.round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')}đ';
  }

  void _showRawTextDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Văn bản hóa đơn', style: TextStyle(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Text(widget.result.rawText.isNotEmpty ? widget.result.rawText : 'Không có dữ liệu văn bản.'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).primaryColor;

    return Scaffold(
      backgroundColor: const Color(0xFFF9F9FB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text('Kết quả nhận diện', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Thong tin chung
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0EDFF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(Icons.storage, color: primary, size: 20),
                      ),
                      const SizedBox(width: 12),
                      const Text('Thông tin chung', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildInfoRow('Cửa hàng', widget.result.storeName),
                  const Divider(height: 1, color: Color(0xFFEEEEEE)),
                  _buildInfoRow('Ngày', widget.result.date),
                  const Divider(height: 1, color: Color(0xFFEEEEEE)),
                  _buildInfoRow('VAT', _formatMoney(widget.result.taxAmount)),
                  const Divider(height: 1, color: Color(0xFFEEEEEE)),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Tổng thanh toán', style: TextStyle(color: Colors.grey.shade500)),
                        Text(
                          _formatMoney(widget.result.totalAmount),
                          style: TextStyle(fontWeight: FontWeight.bold, color: primary, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            // San pham
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0EDFF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(Icons.receipt_long, color: primary, size: 20),
                      ),
                      const SizedBox(width: 12),
                      const Text('Sản phẩm', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0EDFF),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${widget.result.items.length}',
                          style: TextStyle(color: primary, fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  ...widget.result.items.map((item) => Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.itemName, style: const TextStyle(fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 4),
                                  Text(
                                    'SL ${item.quantity} x ${_formatMoney(item.unitPrice)}',
                                    style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            Text(_formatMoney(item.totalPrice), style: const TextStyle(fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                      if (item != widget.result.items.last)
                        const Divider(height: 1, color: Color(0xFFEEEEEE)),
                    ],
                  )),
                ],
              ),
            ),
            const SizedBox(height: 16),
            // Raw OCR Button
            GestureDetector(
              onTap: _showRawTextDialog,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.text_snippet_outlined, color: primary),
                    const SizedBox(width: 12),
                    Expanded(child: Text('Xem văn bản hóa đơn', style: TextStyle(color: primary, fontWeight: FontWeight.bold))),
                    Icon(Icons.chevron_right, color: primary),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: () {
                // Action: Save and back to home
                Navigator.of(context).pop();
              },
              icon: const Icon(Icons.check),
              label: const Text('Xác nhận & Lưu', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              style: FilledButton.styleFrom(
                backgroundColor: primary,
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
            const SizedBox(height: 16),
            if (widget.onAskAboutInvoice != null)
              OutlinedButton.icon(
                onPressed: widget.onAskAboutInvoice,
                icon: const Icon(Icons.auto_awesome),
                label: const Text('Hỏi AI về hóa đơn này', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: primary,
                  side: BorderSide(color: primary, width: 2),
                  minimumSize: const Size.fromHeight(54),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade500)),
          Text(
            value.isEmpty ? '-' : value,
            style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.black87),
            textAlign: TextAlign.right,
          ),
        ],
      ),
    );
  }
}
