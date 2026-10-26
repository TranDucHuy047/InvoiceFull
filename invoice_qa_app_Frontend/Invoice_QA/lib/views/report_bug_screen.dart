
import 'package:flutter/material.dart';
import '../ui_contracts/thuy_ui_contracts.dart';

class ReportBugScreen extends StatefulWidget {
  const ReportBugScreen({
    super.key,
    required this.initialInvoiceId,
    required this.onSelectInvoice,
    required this.onSubmitReport,
  });

  final String? initialInvoiceId;
  final Future<InvoiceHistoryViewData?> Function() onSelectInvoice;
  final Future<void> Function(String? invoiceId, String description) onSubmitReport;

  @override
  State<ReportBugScreen> createState() => _ReportBugScreenState();
}

class _ReportBugScreenState extends State<ReportBugScreen> {
  final _descriptionController = TextEditingController();
  bool _submitting = false;
  String _selectedErrorType = 'OCR nhận diện sai';
  final List<String> _errorTypes = [
    'OCR nhận diện sai',
    'Lỗi hệ thống',
    'Dữ liệu hóa đơn sai lệch',
    'Khác'
  ];

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final description = _descriptionController.text.trim();
    if (description.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập mô tả lỗi.')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final fullDesc = '[$_selectedErrorType] $description';
      await widget.onSubmitReport(widget.initialInvoiceId, fullDesc);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gửi báo cáo lỗi thành công.')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi: $e')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
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
        title: const Text('Trợ lý Invoice AI', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Text('← Quay lại', style: TextStyle(color: primary, fontWeight: FontWeight.bold, fontSize: 14)),
            ),
            const SizedBox(height: 24),
            Text('BÁO CÁO / HỖ TRỢ', style: TextStyle(color: primary.withValues(alpha: 0.8), fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
            const SizedBox(height: 8),
            const Text('Gửi yêu cầu hỗ trợ', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black87)),
            const SizedBox(height: 8),
            const Text('Admin sẽ tiếp nhận lỗi và cập nhật trạng thái xử lý.', style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 32),

            const Text('Loại lỗi', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedErrorType,
                  isExpanded: true,
                  icon: const Icon(Icons.keyboard_arrow_down),
                  items: _errorTypes.map((type) => DropdownMenuItem(value: type, child: Text(type))).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _selectedErrorType = val);
                  },
                ),
              ),
            ),
            const SizedBox(height: 24),

            const Text('Mô tả', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
            const SizedBox(height: 8),
            TextField(
              controller: _descriptionController,
              maxLines: 5,
              decoration: InputDecoration(
                hintText: 'Nhập mô tả chi tiết lỗi...',
                hintStyle: TextStyle(color: Colors.grey.shade400),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: primary),
                ),
              ),
            ),
            const SizedBox(height: 32),

            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: primary,
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: _submitting 
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Gửi báo cáo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }
}
