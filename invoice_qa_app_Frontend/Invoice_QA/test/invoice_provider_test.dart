import 'package:flutter_test/flutter_test.dart';
import 'package:invoice_qa_app/providers/invoice_provider.dart';
import 'package:invoice_qa_app/services/api_service.dart';

// 1. TẠO MỘT CLASS MOCK (GIẢ LẬP) API SERVICE ĐỂ KHÔNG CẦN CHỜ BACKEND THẬT
class MockApiService extends ApiService {
  MockApiService() : super(baseUrl: 'http://mock');

  @override
  Future<Map<String, dynamic>> fetchUserInvoiceHistory({
    String? fromDate,
    String? toDate,
    double? minAmount,
  }) async {
    // Giả lập backend trả về 2 hóa đơn
    return {
      'total_personal_spending': 450000.0,
      'invoices': [
        {
          'id': 'INV_001',
          'store_name': 'Co.opmart',
          'date': '17/08/2026',
          'total_amount': 350000.0,
          'ocr_confidence': 0.95
        },
        {
          'id': 'INV_002',
          'store_name': 'Circle K',
          'date': '18/08/2026',
          'total_amount': 100000.0,
          'ocr_confidence': 0.88
        }
      ]
    };
  }

  @override
  Future<void> deleteInvoice(String invoiceId) async {
    // Giả lập xóa thành công, không ném ra lỗi
    return;
  }
}

void main() {
  group('InvoiceProvider Unit Tests', () {
    late InvoiceProvider invoiceProvider;
    late MockApiService mockApiService;

    // Thiết lập môi trường trước mỗi Test Case
    setUp(() {
      mockApiService = MockApiService();
      invoiceProvider = InvoiceProvider(apiService: mockApiService);
    });

    test('loadHistory lưu đúng danh sách và tổng chi tiêu', () async {
      // Act: Gọi hàm tải lịch sử
      await invoiceProvider.loadHistory();

      // Assert: Kiểm tra kết quả
      expect(invoiceProvider.isLoading, false);
      expect(invoiceProvider.history.length, 2);
      expect(invoiceProvider.totalSpending, 450000.0);
      expect(invoiceProvider.history.first.storeName, 'Co.opmart');
    });

    test('deleteInvoice cập nhật UI ngay lập tức (Optimistic Update) và trừ tiền', () async {
      // Arrange: Tải dữ liệu ban đầu
      await invoiceProvider.loadHistory();
      expect(invoiceProvider.totalSpending, 450000.0); // Ban đầu có 450k
      expect(invoiceProvider.history.length, 2);

      // Act: Xóa hóa đơn Co.opmart (350k)
      final result = await invoiceProvider.deleteInvoice('INV_001');

      // Assert: Kiểm tra kết quả sau khi xóa
      expect(result, true); // Hàm trả về true
      expect(invoiceProvider.history.length, 1); // Chỉ còn 1 hóa đơn
      expect(invoiceProvider.totalSpending, 100000.0); // Tổng tiền giảm xuống còn 100k
      expect(invoiceProvider.history.first.storeName, 'Circle K'); // Hóa đơn còn lại là Circle K
    });
  });
}