import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
// Lưu ý: Thay 'invoice_qa_app' bằng tên project thực tế của bạn nếu bạn đặt tên khác
import 'package:invoice_qa_app/models/invoice_result_model.dart';

void main() {
  group('Kiểm thử Model Ánh xạ JSON (Tương đương một phần TC01)', () {

    test('Parse thành công dữ liệu JSON hợp lệ từ Backend', () {
      const mockJson = '''
      {
        "invoice_id": "INV_123",
        "ocr_confidence": 0.95,
        "store_name": "Siêu thị Co.opmart",
        "date": "17/08/2026",
        "total_amount": 350000.0,
        "tax_amount": 31818.0,
        "items": [
          {
            "item_name": "Sữa tươi Vinamilk 1L",
            "quantity": 2,
            "unit_price": 35000.0,
            "total_price": 70000.0
          }
        ],
        "raw_text": "Dữ liệu OCR thô..."
      }
      ''';


      final Map<String, dynamic> parsedData = json.decode(mockJson);
      final result = InvoiceResult.fromJson(parsedData);

      expect(result.invoiceId, 'INV_123');
      expect(result.ocrConfidence, 0.95);
      expect(result.storeName, 'Siêu thị Co.opmart');
      expect(result.totalAmount, 350000.0);


      expect(result.items.length, 1);
      expect(result.items.first.itemName, 'Sữa tươi Vinamilk 1L');
      expect(result.items.first.totalPrice, 70000.0);
    });

  });
}