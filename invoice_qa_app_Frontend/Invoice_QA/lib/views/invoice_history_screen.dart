
import 'package:flutter/material.dart';
 // We might need to add dotted_border dependency, or use custom painter.
import '../ui_contracts/thuy_ui_contracts.dart';
import '../widgets/invoice_card.dart';

// Since we might not have dotted_border, let's use OutlinedButton with standard border for now, or just a simple Container.
// Actually we can use a custom dashed border painter, but let's stick to standard OutlinedButton for simplicity unless requested.
// Wait, I can just use a transparent border if dotted is not available. Let's assume we don't have dotted_border.

class InvoiceHistoryScreen extends StatefulWidget {
  const InvoiceHistoryScreen({
    super.key,
    required this.onLoadHistory,
    this.onOpenInvoice,
    this.onDeleteInvoice,
    this.onEditInvoice,
    this.onExportInvoices,
    this.title = 'Lịch sử hóa đơn',
  });

  final LoadHistoryAction onLoadHistory;
  final ValueChanged<InvoiceHistoryViewData>? onOpenInvoice;
  final DeleteInvoiceAction? onDeleteInvoice;
  final ValueChanged<InvoiceHistoryViewData>? onEditInvoice;
  final ExportInvoicesAction? onExportInvoices;
  final String title;

  @override
  State<InvoiceHistoryScreen> createState() => _InvoiceHistoryScreenState();
}

class _InvoiceHistoryScreenState extends State<InvoiceHistoryScreen> {
  final bool _sortNewest = true;
  DateTimeRange? _dateRange;
  bool _loading = true;
  String? _error;
  List<InvoiceHistoryViewData> _items = const [];
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _load();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await widget.onLoadHistory();
      if (!mounted) return;
      setState(() => _items = items);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
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
        title: Text(
          widget.title,
          style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Lỗi: $_error', style: const TextStyle(color: Colors.red)),
                      TextButton(onPressed: _load, child: const Text('Thử lại')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Search bar
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: TextField(
                            controller: _search,
                            decoration: InputDecoration(
                              hintText: 'Tìm cửa hàng...',
                              hintStyle: TextStyle(color: Colors.grey.shade400),
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              icon: Icon(Icons.document_scanner_outlined, color: Colors.grey.shade400),
                              suffixIcon: Container(
                                margin: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF0EDFF),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(Icons.tune, color: primary, size: 20),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Filters row
                        Row(
                          children: [
                            _buildFilterChip('Thời gian'),
                            const SizedBox(width: 8),
                            _buildFilterChip('Mới nhất', isSelected: true, primary: primary),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Export Button
                        if (widget.onExportInvoices != null)
                          OutlinedButton.icon(
                            onPressed: () => widget.onExportInvoices!(const InvoiceHistoryFilter(), InvoiceExportFormat.excel),
                            icon: Icon(Icons.upload_file, color: primary),
                            label: Text('Xuất Excel / CSV', style: TextStyle(color: primary)),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: primary.withValues(alpha: 0.5), width: 1.5, style: BorderStyle.solid),
                              backgroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        const SizedBox(height: 24),

                        // List Title
                        Text(
                          '${_items.length} HÓA ĐƠN',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black54),
                        ),
                        const SizedBox(height: 16),

                        // List Items
                        if (_items.isEmpty)
                          const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('Không có hóa đơn nào.')))
                        else
                          ..._items.map((item) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: InvoiceCard(
                                  invoice: item,
                                  onTap: () {
                                    if (widget.onOpenInvoice != null) widget.onOpenInvoice!(item);
                                  },
                                ),
                              )),
                              
                        const SizedBox(height: 100),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildFilterChip(String label, {bool isSelected = false, Color? primary}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isSelected ? const Color(0xFFF0EDFF) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isSelected ? Colors.transparent : Colors.grey.shade300),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isSelected ? primary : Colors.black87,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              fontSize: 14,
            ),
          ),
          const SizedBox(width: 4),
          Icon(Icons.keyboard_arrow_down, size: 16, color: isSelected ? primary : Colors.black54),
        ],
      ),
    );
  }
}
