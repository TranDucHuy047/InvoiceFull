import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/invoice_result_model.dart';
import '../widgets/adaptive_image.dart';
import '../widgets/state_panel.dart';
import 'invoice_result_screen.dart';

typedef AnalyzeInvoiceAction = Future<InvoiceResult> Function(String imagePath);

/// Callback ưu tiên cho Flutter Web: Loan có thể đọc XFile.readAsBytes() và gửi FormData.
typedef AnalyzeInvoiceXFileAction = Future<InvoiceResult> Function(XFile image);

class ScanInvoiceScreen extends StatefulWidget {
  const ScanInvoiceScreen({
    super.key,
    this.onAnalyzeInvoice,
    this.onAnalyzeXFile,
    this.onOpenResult,
  });

  /// Loan truyền Provider/API thật vào đây khi tích hợp.
  /// Để null vẫn build được UI, nhưng nút phân tích sẽ báo chưa kết nối logic.
  final AnalyzeInvoiceAction? onAnalyzeInvoice;

  /// Dùng cho Flutter Web/đa nền tảng khi không nên phụ thuộc đường dẫn file local.
  /// Nếu có callback này, UI ưu tiên gọi callback XFile thay vì onAnalyzeInvoice.
  final AnalyzeInvoiceXFileAction? onAnalyzeXFile;

  /// Tùy chọn để phần Logic tự điều hướng kết quả. Nếu null, UI tự push InvoiceResultScreen.
  final void Function(
    BuildContext context,
    InvoiceResult result,
    String imagePath,
  )?
  onOpenResult;

  @override
  State<ScanInvoiceScreen> createState() => _ScanInvoiceScreenState();
}

class _ScanInvoiceScreenState extends State<ScanInvoiceScreen> {
  final ImagePicker _picker = ImagePicker();
  XFile? _selectedImage;
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _pickImage(ImageSource source) async {
    try {
      final image = await _picker.pickImage(
        source: source,
        imageQuality: 92,
        maxWidth: 2200,
      );

      if (image == null || !mounted) return;
      setState(() {
        _selectedImage = image;
        _errorMessage = null;
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Không thể mở camera/thư viện. Hãy kiểm tra quyền truy cập.',
          ),
        ),
      );
    }
  }

  Future<void> _analyze() async {
    final image = _selectedImage;
    if (image == null || _isLoading) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = widget.onAnalyzeXFile != null
          ? await widget.onAnalyzeXFile!(image)
          : widget.onAnalyzeInvoice != null
          ? await widget.onAnalyzeInvoice!(image.path)
          : throw Exception(
              'Chức năng phân tích chưa được kết nối với Provider/API.',
            );
      if (!mounted) return;

      if (widget.onOpenResult != null) {
        widget.onOpenResult!(context, result, image.path);
      } else {
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) =>
                InvoiceResultScreen(result: result, imagePath: image.path),
          ),
        );
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _removeImage() {
    if (_isLoading) return;
    setState(() {
      _selectedImage = null;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Invoice AI',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 21),
            ),
            Text(
              'Nhận diện hóa đơn thông minh',
              style: TextStyle(
                fontWeight: FontWeight.w500,
                fontSize: 12,
                color: Color(0xFF687386),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Hướng dẫn',
            onPressed: () => _showTips(context),
            icon: const Icon(Icons.help_outline_rounded),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _HeaderCard(
                onCamera: _isLoading
                    ? null
                    : () => _pickImage(ImageSource.camera),
                onGallery: _isLoading
                    ? null
                    : () => _pickImage(ImageSource.gallery),
              ),
              const SizedBox(height: 22),
              const Text(
                'Hóa đơn của bạn',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF172033),
                ),
              ),
              const SizedBox(height: 12),
              if (_selectedImage == null) const EmptyInvoicePanel(),
              if (_selectedImage != null)
                _InvoicePreview(
                  imagePath: _selectedImage!.path,
                  isLoading: _isLoading,
                  onReplace: () => _pickImage(ImageSource.gallery),
                  onRemove: _removeImage,
                ),
              if (_selectedImage != null) ...[
                const SizedBox(height: 16),
                if (_isLoading) const LoadingInvoicePanel(),
                if (_errorMessage != null)
                  ErrorInvoicePanel(
                    message: _errorMessage!,
                    onRetry: _analyze,
                    onChooseAnother: _removeImage,
                  ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _isLoading ? null : _analyze,
                  icon: const Icon(Icons.auto_awesome_rounded),
                  label: Text(
                    _isLoading ? 'Đang phân tích...' : 'Phân tích hóa đơn',
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showTips(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => const Padding(
        padding: EdgeInsets.fromLTRB(22, 4, 22, 30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Mẹo chụp hóa đơn',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            SizedBox(height: 14),
            _Tip(
              icon: Icons.light_mode_outlined,
              text: 'Đủ sáng, tránh bóng đổ lên chữ.',
            ),
            _Tip(
              icon: Icons.crop_free_rounded,
              text: 'Đặt toàn bộ hóa đơn trong khung hình.',
            ),
            _Tip(
              icon: Icons.straighten_rounded,
              text: 'Giữ điện thoại thẳng, hạn chế nghiêng hoặc rung.',
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.onCamera, required this.onGallery});

  final VoidCallback? onCamera;
  final VoidCallback? onGallery;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF4F46E5),
            Color(0xFF7C3AED),
          ], // Indigo to Purple gradient
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4F46E5).withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.document_scanner_rounded,
              color: Colors.white,
              size: 32,
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Quét hóa đơn thông minh',
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Chụp hoặc tải ảnh lên để AI trích xuất thông tin tự động.',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.85),
              height: 1.5,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: onCamera,
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF4F46E5),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  icon: const Icon(Icons.camera_alt_rounded),
                  label: const Text(
                    'Chụp ảnh',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onGallery,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(
                      color: Colors.white.withValues(alpha: 0.3),
                      width: 1.5,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  icon: const Icon(Icons.photo_library_rounded),
                  label: const Text(
                    'Thư viện',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InvoicePreview extends StatelessWidget {
  const _InvoicePreview({
    required this.imagePath,
    required this.isLoading,
    required this.onReplace,
    required this.onRemove,
  });

  final String imagePath;
  final bool isLoading;
  final VoidCallback onReplace;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          AspectRatio(
            aspectRatio: 4 / 3,
            child: AdaptiveImage(
              source: imagePath,
              fit: BoxFit.cover,
              fallback: Container(
                color: const Color(0xFFEFF3F8),
                alignment: Alignment.center,
                child: const Text('Không thể hiển thị ảnh.'),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: isLoading ? null : onReplace,
                    icon: const Icon(Icons.swap_horiz_rounded),
                    label: const Text('Đổi ảnh'),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filledTonal(
                  tooltip: 'Xóa ảnh',
                  onPressed: isLoading ? null : onRemove,
                  icon: const Icon(Icons.delete_outline_rounded),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tip extends StatelessWidget {
  const _Tip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 21, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(height: 1.4))),
        ],
      ),
    );
  }
}
