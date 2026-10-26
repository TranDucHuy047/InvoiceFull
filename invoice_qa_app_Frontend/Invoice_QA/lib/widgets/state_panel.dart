import 'package:flutter/material.dart';

class EmptyInvoicePanel extends StatelessWidget {
  const EmptyInvoicePanel({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE4E9F1)),
      ),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.receipt_long_rounded,
              size: 34,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'Chưa có hóa đơn',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: Color(0xFF172033),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Chụp ảnh hoặc chọn hóa đơn từ thư viện để bắt đầu nhận diện.',
            textAlign: TextAlign.center,
            style: TextStyle(height: 1.45, color: Color(0xFF687386)),
          ),
        ],
      ),
    );
  }
}

class LoadingInvoicePanel extends StatefulWidget {
  const LoadingInvoicePanel({super.key});

  @override
  State<LoadingInvoicePanel> createState() => _LoadingInvoicePanelState();
}

class _LoadingInvoicePanelState extends State<LoadingInvoicePanel> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _percentAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 7),
    );
    // Fake progress up to 99% using an easeOut curve so it slows down near the end
    _percentAnimation = Tween<double>(begin: 0, end: 99).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCirc),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AnimatedBuilder(
                  animation: _percentAnimation,
                  builder: (context, child) {
                    final percent = _percentAnimation.value.toInt();
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 50,
                          height: 50,
                          child: CircularProgressIndicator(
                            value: _percentAnimation.value / 100.0,
                            strokeWidth: 4.5,
                            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                        Text(
                          '$percent%',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(width: 18),
                const Expanded(
                  child: Text(
                    'Đang đọc hóa đơn...',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'Hệ thống đang tiền xử lý ảnh và nhận diện nội dung bằng công nghệ OCR. Vui lòng chờ...',
              style: TextStyle(color: Color(0xFF687386), height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}

class ErrorInvoicePanel extends StatelessWidget {
  const ErrorInvoicePanel({
    super.key,
    required this.message,
    required this.onRetry,
    this.onChooseAnother,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback? onChooseAnother;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.error_outline_rounded, color: Color(0xFFCC3D3D)),
                SizedBox(width: 10),
                Text(
                  'Xử lý thất bại',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              message.isEmpty
                  ? 'Không thể xử lý hóa đơn. Vui lòng thử lại.'
                  : message,
              style: const TextStyle(color: Color(0xFF687386), height: 1.4),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Thử lại'),
                  ),
                ),
                if (onChooseAnother != null) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onChooseAnother,
                      icon: const Icon(Icons.image_outlined),
                      label: const Text('Chọn ảnh khác'),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class AppLoadingPanel extends StatelessWidget {
  const AppLoadingPanel({
    super.key,
    this.title = 'Đang tải...',
    this.message = 'Vui lòng chờ trong giây lát.',
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 16),
              Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF687386))),
            ],
          ),
        ),
      ),
    );
  }
}

class AppErrorPanel extends StatelessWidget {
  const AppErrorPanel({
    super.key,
    required this.message,
    this.onRetry,
  });

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, size: 44, color: Color(0xFFB42318)),
              const SizedBox(height: 12),
              const Text('Có lỗi xảy ra', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF687386))),
              if (onRetry != null) ...[
                const SizedBox(height: 16),
                FilledButton.tonalIcon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Thử lại'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class AppEmptyPanel extends StatelessWidget {
  const AppEmptyPanel({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 46, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 12),
              Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
              const SizedBox(height: 7),
              Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF687386))),
            ],
          ),
        ),
      ),
    );
  }
}
