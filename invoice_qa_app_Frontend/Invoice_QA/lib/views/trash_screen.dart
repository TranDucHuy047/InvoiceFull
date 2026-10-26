import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/invoice_provider.dart';
import '../ui_contracts/thuy_ui_contracts.dart';
import '../widgets/state_panel.dart';

class TrashScreen extends StatefulWidget {
  const TrashScreen({super.key});

  @override
  State<TrashScreen> createState() => _TrashScreenState();
}

class _TrashScreenState extends State<TrashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InvoiceProvider>().loadTrash();

      // Hiển thị tooltip 10s
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thùng rác sẽ tự dọn dẹp sau 30 ngày'),
          duration: Duration(seconds: 10),
          behavior: SnackBarBehavior.floating,
        ),
      );
    });
  }

  int _calculateDaysLeft(DateTime? deletedAt) {
    if (deletedAt == null) return 30;
    final now = DateTime.now();
    final difference = now.difference(deletedAt).inDays;
    return (30 - difference).clamp(0, 30);
  }

  void _restore(InvoiceHistoryViewData invoice) async {
    final success = await context.read<InvoiceProvider>().restoreInvoice(
      invoice.id,
    );
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã khôi phục hóa đơn thành công!')),
      );
    }
  }

  void _deletePermanent(InvoiceHistoryViewData invoice) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa vĩnh viễn?'),
        content: const Text(
          'Hóa đơn này sẽ bị xóa khỏi hệ thống và không thể khôi phục.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      final success = await context.read<InvoiceProvider>().deletePermanently(
        invoice.id,
      );
      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã xóa vĩnh viễn hóa đơn!')),
        );
      }
    }
  }

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
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text('Thùng rác'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        actions: [
          IconButton(
            tooltip: 'Thông tin thùng rác',
            icon: const Icon(Icons.info_outline_rounded),
            onPressed: () {
              ScaffoldMessenger.of(context).clearSnackBars();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'Thùng rác sẽ tự dọn dẹp sau 30 ngày kể từ ngày xóa.',
                  ),
                  duration: Duration(seconds: 10),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Consumer<InvoiceProvider>(
          builder: (context, provider, child) {
            if (provider.isLoading) {
              return const Center(child: CircularProgressIndicator());
            }

            if (provider.errorMessage.isNotEmpty &&
                provider.trashInvoices.isEmpty) {
              return AppErrorPanel(
                message: provider.errorMessage,
                onRetry: () => provider.loadTrash(),
              );
            }

            if (provider.trashInvoices.isEmpty) {
              return RefreshIndicator(
                onRefresh: () => provider.loadTrash(),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    SizedBox(
                      height: MediaQuery.of(context).size.height * 0.7,
                      child: const Center(
                        child: AppEmptyPanel(
                          icon: Icons.delete_outline_rounded,
                          title: 'Thùng rác trống',
                          message: 'Không có hóa đơn nào đã xóa gần đây.',
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }

            return RefreshIndicator(
              onRefresh: () => provider.loadTrash(),
              child: ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                itemCount: provider.trashInvoices.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final invoice = provider.trashInvoices[index];
                  final storeName = invoice.storeName.trim().isEmpty
                      ? 'Không rõ cửa hàng'
                      : invoice.storeName;
                  final daysLeft = _calculateDaysLeft(invoice.deletedAt);
                  final dateLabel = invoice.dateLabel.trim().isEmpty
                      ? 'Không rõ ngày'
                      : invoice.dateLabel;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Colors.grey.withValues(alpha: 0.2),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Flexible(
                                child: Text(
                                  storeName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.red.shade50,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'Xóa sau $daysLeft ngày',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.red.shade700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Tổng tiền: ${_money(invoice.totalAmount)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF2C3443),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Ngày: $dateLabel',
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF687386),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              TextButton.icon(
                                onPressed: () => _restore(invoice),
                                icon: const Icon(
                                  Icons.restore_rounded,
                                  size: 18,
                                ),
                                label: const Text('Khôi phục'),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.red.shade50,
                                  foregroundColor: Colors.red.shade700,
                                  elevation: 0,
                                ),
                                onPressed: () => _deletePermanent(invoice),
                                icon: const Icon(
                                  Icons.delete_forever_rounded,
                                  size: 18,
                                ),
                                label: const Text('Xóa vĩnh viễn'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }
}
