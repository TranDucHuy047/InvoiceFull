import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

import '../services/api_service.dart';
import '../ui_contracts/thuy_ui_contracts.dart';

class InvoiceProvider with ChangeNotifier {
  InvoiceProvider({ApiService? apiService})
    : _apiService = apiService ?? ApiService.instance;

  final ApiService _apiService;

  List<InvoiceHistoryViewData> _history = [];
  List<InvoiceHistoryViewData> _trashInvoices = [];
  double _totalSpending = 0;
  bool _isLoading = false;
  String _errorMessage = '';

  List<InvoiceHistoryViewData> get history => _history;
  List<InvoiceHistoryViewData> get trashInvoices => _trashInvoices;
  double get totalSpending => _totalSpending;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;

  /// Gọi API lấy dữ liệu (Hỗ trợ lọc theo ngày và số tiền tối thiểu)
  Future<void> loadHistory({
    String? fromDate,
    String? toDate,
    double? minAmount,
  }) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final data = await _apiService.fetchUserInvoiceHistory(
        fromDate: fromDate,
        toDate: toDate,
        minAmount: minAmount,
      );

      _totalSpending = (data['total_personal_spending'] ?? 0).toDouble();

      final List<dynamic> rawInvoices = data['invoices'] ?? [];
      _history = rawInvoices.map((item) {
        return InvoiceHistoryViewData(
          id: item['id'].toString(),
          storeName: item['store_name'] ?? 'Không rõ cửa hàng',
          dateLabel: item['date'] ?? 'Không rõ ngày',
          totalAmount: (item['total_amount'] ?? 0).toDouble(),
          ocrConfidence: (item['ocr_confidence'] ?? 1.0).toDouble(),
          imagePath: item['image_path'] != null ? 'http://192.168.143.2:8000/' + item['image_path'] : null,
        );
      }).toList();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Logic Xóa hóa đơn (Vuốt để xóa - Optimistic UI Update)
  Future<bool> deleteInvoice(String invoiceId) async {
    final backupHistory = List<InvoiceHistoryViewData>.from(_history);
    final invoiceToRemove = _history.firstWhere((inv) => inv.id == invoiceId);

    _history.removeWhere((inv) => inv.id == invoiceId);
    _totalSpending -= invoiceToRemove.totalAmount;
    notifyListeners();

    try {
      await _apiService.deleteInvoice(invoiceId);
      return true;
    } catch (e) {
      _history = backupHistory;
      _totalSpending += invoiceToRemove.totalAmount;
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Logic Lưu Form Sửa hóa đơn
  Future<void> updateInvoice(
    String invoiceId,
    double newAmount,
    String newStore,
  ) async {
    try {
      await _apiService.updateInvoice(invoiceId, {
        'total_amount': newAmount,
        'store_name': newStore,
      });
      await loadHistory();
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  /// Gửi câu hỏi tới AI RAG và nhận câu trả lời (dùng cho ChatScreen).
  Future<String> sendQuestion(String question) async {
    try {
      return await _apiService.sendQuestion(question: question);
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  /// Bước 3: Logic tải báo cáo Excel/CSV về máy
  Future<String?> downloadExcelReport({
    String? fromDate,
    String? toDate,
  }) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      var status = await Permission.storage.request();
      if (!status.isGranted) {
        throw Exception('Cần cấp quyền lưu trữ để tải file.');
      }

      Directory? directory;
      if (Platform.isAndroid) {
        directory = Directory('/storage/emulated/0/Download');
        if (!await directory.exists()) {
          directory = await getExternalStorageDirectory();
        }
      } else {
        directory = await getApplicationDocumentsDirectory();
      }

      if (directory == null) {
        throw Exception('Không tìm thấy thư mục lưu trữ phù hợp.');
      }

      final fileName = 'HoaDon_${DateTime.now().millisecondsSinceEpoch}.xlsx';
      final savePath = '${directory.path}/$fileName';

      await _apiService.exportExcel(
        savePath,
        fromDate: fromDate,
        toDate: toDate,
      );

      return savePath;
    } catch (e) {
      _errorMessage = e.toString();
      return null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Lấy danh sách thùng rác
  Future<void> loadTrash() async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final rawInvoices = await _apiService.fetchTrashInvoices();
      _trashInvoices = rawInvoices.map((item) {
        return InvoiceHistoryViewData(
          id: item['id'].toString(),
          storeName: item['store_name'] ?? 'Không rõ cửa hàng',
          dateLabel: item['date'] ?? 'Không rõ ngày',
          totalAmount: (item['total_amount'] ?? 0).toDouble(),
          deletedAt: item['deleted_at'] != null ? DateTime.tryParse(item['deleted_at']) : null,
          imagePath: item['image_path'] != null ? 'http://192.168.143.2:8000/' + item['image_path'] : null,
        );
      }).toList();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Khôi phục hóa đơn từ thùng rác
  Future<bool> restoreInvoice(String invoiceId) async {
    try {
      await _apiService.restoreInvoice(invoiceId);
      _trashInvoices.removeWhere((inv) => inv.id == invoiceId);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Xóa vĩnh viễn hóa đơn từ thùng rác
  Future<bool> deletePermanently(String invoiceId) async {
    try {
      await _apiService.deleteInvoicePermanently(invoiceId);
      _trashInvoices.removeWhere((inv) => inv.id == invoiceId);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}
