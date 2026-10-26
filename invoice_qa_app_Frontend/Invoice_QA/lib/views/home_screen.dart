
import 'package:flutter/material.dart';
import '../ui_contracts/thuy_ui_contracts.dart';
import '../widgets/invoice_card.dart';
import '../widgets/app_sidebar.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    this.userName = 'Người dùng',
    this.userEmail = '',
    this.allInvoices = const [],
    this.recentInvoices = const [],
    this.onScanInvoice,
    this.onOpenInvoice,
    this.onOpenChat,
    this.onOpenHistory,
    this.onOpenTrash,
    this.onChangePassword,
    this.onEditProfile,
    this.onOpenSettings,
    this.onExportData,
    this.onNotifications,
    this.onLogout,
  });

  final String userName;
  final String userEmail;
  final List<InvoiceHistoryViewData> allInvoices;
  final List<InvoiceHistoryViewData> recentInvoices;
  final VoidCallback? onScanInvoice;
  final ValueChanged<InvoiceHistoryViewData>? onOpenInvoice;
  final VoidCallback? onOpenChat;
  final VoidCallback? onOpenHistory;
  final VoidCallback? onOpenTrash;
  final VoidCallback? onChangePassword;
  final VoidCallback? onEditProfile;
  final VoidCallback? onOpenSettings;
  final VoidCallback? onExportData;
  final VoidCallback? onNotifications;
  final VoidCallback? onLogout;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _selectedFilter = 'Tháng';


  List<InvoiceHistoryViewData> _getFilteredInvoices() {
    final now = DateTime.now();
    return widget.allInvoices.where((inv) {
      if (inv.dateLabel.isEmpty) return false;
      
      // Parse dateLabel: dd/MM/yyyy
      DateTime? invoiceDate;
      try {
        final parts = inv.dateLabel.split('/');
        if (parts.length == 3) {
          invoiceDate = DateTime(int.parse(parts[2]), int.parse(parts[1]), int.parse(parts[0]));
        }
      } catch (e) {
        return true; // if parsing fails, include it just in case
      }
      
      if (invoiceDate == null) return true;

      if (_selectedFilter == 'Ngày') {
        return invoiceDate.year == now.year && invoiceDate.month == now.month && invoiceDate.day == now.day;
      } else if (_selectedFilter == 'Tuần') {
        final difference = now.difference(invoiceDate).inDays;
        return difference >= 0 && difference <= 7;
      } else if (_selectedFilter == 'Tháng') {
        return invoiceDate.year == now.year && invoiceDate.month == now.month;
      } else if (_selectedFilter == 'Năm') {
        return invoiceDate.year == now.year;
      }
      return true;
    }).toList();
  }

  String _formatMoney(double amount) {

    return '${amount.round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')}đ';
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).primaryColor;

    return Scaffold(
      backgroundColor: const Color(0xFFF9F9FB),
      drawer: AppSidebar(
        userName: widget.userName,
        email: widget.userEmail,
        activeKey: 'home',
        onHome: () => Navigator.of(context).maybePop(),
        onHistory: widget.onOpenHistory,
        onTrash: widget.onOpenTrash,
        onProfile: widget.onEditProfile,
        onSettings: widget.onOpenSettings,
        onLogout: widget.onLogout,
      ),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu, color: Colors.black87),
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: primary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.receipt_long, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 8),
            const Text(
              'Invoice AI',
              style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none, color: Colors.black87),
            onPressed: widget.onNotifications,
          ),
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: CircleAvatar(
              radius: 16,
              backgroundColor: Colors.orange.shade300,
              child: Text(
                widget.userName.isNotEmpty ? widget.userName.substring(0, 2).toUpperCase() : 'U',
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Greeting
            Row(
              children: [
                Text(
                  'Xin chào, ${widget.userName.split(' ').last}',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black87),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.auto_awesome, color: Colors.orangeAccent),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Hôm nay bạn muốn làm gì?',
              style: TextStyle(fontSize: 14, color: Colors.black54),
            ),
            const SizedBox(height: 24),

            // Filters
            Row(
              children: ['Ngày', 'Tuần', 'Tháng', 'Năm'].map((filter) {
                final isSelected = _selectedFilter == filter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(filter),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) setState(() => _selectedFilter = filter);
                    },
                    selectedColor: primary,
                    backgroundColor: Colors.white,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : Colors.black54,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                      side: BorderSide(color: isSelected ? primary : Colors.grey.shade300),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // Big Stat Card
            GestureDetector(
              onTap: widget.onOpenHistory,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: primary,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(color: primary.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 10)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TỔNG HÓA ĐƠN - ${_selectedFilter.toUpperCase()}',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${_getFilteredInvoices().length}',
                      style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Chạm để xem lịch sử',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12),
                    ),
                    // Fake chart line could go here, but omitted for simplicity
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),

            // Quick Access
            const Text(
              'Truy cập nhanh',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildQuickAction(Icons.history, 'Lịch sử', const Color(0xFFF0EDFF), primary, widget.onOpenHistory),
                _buildQuickAction(Icons.delete_outline, 'Lịch sử xóa', const Color(0xFFFFF2EC), Colors.deepOrange, widget.onOpenTrash),
                _buildQuickAction(Icons.upload_file, 'Xuất dữ liệu', const Color(0xFFE8F8F0), Colors.green, widget.onExportData),
              ],
            ),
            const SizedBox(height: 32),

            // Recent Invoices
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Hóa đơn gần đây',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                ),
                TextButton(
                  onPressed: widget.onOpenHistory,
                  child: Text('Xem tất cả', style: TextStyle(color: primary)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (widget.recentInvoices.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Chưa có hóa đơn nào', style: TextStyle(color: Colors.black54))),
              )
            else
              ...widget.recentInvoices.map((inv) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: InvoiceCard(
                  invoice: inv,
                  onTap: () {
                    if (widget.onOpenInvoice != null) widget.onOpenInvoice!(inv);
                  },
                ),
              )),
              
            const SizedBox(height: 100), // spacing for bottom nav & fab
          ],
        ),
      ),
    );
  }

  Widget _buildQuickAction(IconData icon, String label, Color bgColor, Color iconColor, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(icon, color: iconColor, size: 28),
          ),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.black87, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
