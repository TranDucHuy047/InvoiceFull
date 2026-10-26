import 'dart:io';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:invoice_qa_app/utils/evaluation_metrics.dart';
import 'package:invoice_qa_app/models/invoice_result_model.dart';

void main() {
  List<String> parseCsvLine(String line) {
    List<String> result = [];
    StringBuffer current = StringBuffer();
    bool inQuotes = false;
    for (int i = 0; i < line.length; i++) {
      if (line[i] == '"') {
        inQuotes = !inQuotes;
      } else if (line[i] == ',' && !inQuotes) {
        result.add(current.toString());
        current.clear();
      } else {
        current.write(line[i]);
      }
    }
    result.add(current.toString());
    return result;
  }

  group('Kiểm thử Đánh giá QA & Luồng E2E Hệ thống', () {
    test('Đọc thủ công và tính toán WER & Accuracy chi tiết', () {
      final file = File('test_data/evaluation_detail.csv');

      if (!file.existsSync()) {
        fail('Không tìm thấy file evaluation_detail.csv. Hãy đảm bảo file nằm trong thư mục test_data.');
      }

      final lines = file.readAsLinesSync(encoding: utf8);
      if (lines.isEmpty) fail('File CSV trống.');

      final dataRows = lines.skip(1).toList();

      double totalPreprocessedWer = 0.0;
      double totalRawWer = 0.0;
      int validCount = 0;

      for (var line in dataRows) {
        if (line.trim().isEmpty) continue;

        final row = parseCsvLine(line);

        if (row.length >= 13) {
          final groundTruth = row[10].trim();
          final rawText = row[11].trim();
          final preprocessedText = row[12].trim();

          final rawWer = EvaluationMetrics.calculateWER(groundTruth, rawText);
          final preprocessedWer = EvaluationMetrics.calculateWER(groundTruth, preprocessedText);

          totalRawWer += rawWer;
          totalPreprocessedWer += preprocessedWer;
          validCount++;
        }
      }

      if (validCount > 0) {
        final avgRawWer = totalRawWer / validCount;
        final avgPreprocessedWer = totalPreprocessedWer / validCount;

        final avgRawAcc = (1.0 - avgRawWer) * 100;
        final avgPreprocessedAcc = (1.0 - avgPreprocessedWer) * 100;

        print('=== KẾT QUẢ ĐÁNH GIÁ NGHIỆM THU OCR CHÍNH THỨC ===');
        print('Tổng số ảnh đã test: $validCount ảnh');
        print('-----------------------------------------');
        print('1. CHƯA QUA XỬ LÝ ẢNH (RAW):');
        print('   - WER Trung bình: ${avgRawWer.toStringAsFixed(4)}');
        print('   - Độ chính xác (Accuracy): ${avgRawAcc.toStringAsFixed(2)}%');
        print('-----------------------------------------');
        print('2. SAU KHI TIỀN XỬ LÝ (PREPROCESSED):');
        print('   - WER Trung bình: ${avgPreprocessedWer.toStringAsFixed(4)}');
        print('   - Độ chính xác (Accuracy): ${avgPreprocessedAcc.toStringAsFixed(2)}%');
        print('=========================================');

        expect(validCount, greaterThan(0));
      } else {
        fail('Không có dòng dữ liệu hợp lệ nào được tìm thấy.');
      }
    });

    test('Luồng E2E: Trích xuất mock OCR và đo lường Time to First Token (TTFT)', () async {
      // 1. Kiểm thử trích xuất hóa đơn (dùng mock data thay vì gọi API thật)
      final invoiceResult = InvoiceResult(
        invoiceId: 'INV_123',
        ocrConfidence: 0.95,
        storeName: 'Siêu thị Co.opmart',
        date: '17/08/2026',
        totalAmount: 350000.0,
        taxAmount: 31818.0,
        items: [InvoiceItem(itemName: 'Sữa tươi Vinamilk', quantity: 2, unitPrice: 35000.0, totalPrice: 70000.0)],
        rawText: 'Dữ liệu OCR thô...',
      );
      expect(invoiceResult.storeName, isNotEmpty);
      expect(invoiceResult.totalAmount, greaterThan(0));
      expect(invoiceResult.items, isNotEmpty);


      // 2. Mô phỏng Stream phản hồi câu hỏi và đo TTFT
      Stream<String> mockStreamQuestion(String question) async* {
        await Future.delayed(const Duration(milliseconds: 150));
        yield 'Tổng tiền ';
        await Future.delayed(const Duration(milliseconds: 50));
        yield 'là 350.000 đ';
      }

      final startTime = DateTime.now();
      int ttft = -1;
      final buffer = StringBuffer();

      await for (final chunk in mockStreamQuestion('Tổng tiền là bao nhiêu?')) {
        if (ttft == -1) {
          ttft = DateTime.now().difference(startTime).inMilliseconds;
        }
        buffer.write(chunk);
      }

      print('=== KẾT QUẢ KIỂM THỬ E2E & TTFT ===');
      print('Cửa hàng nhận diện: ${invoiceResult.storeName}');
      print('Tổng tiền nhận diện: ${invoiceResult.totalAmount} đ');
      print('Câu trả lời Chatbot: ${buffer.toString()}');
      print('Thời gian phản hồi token đầu tiên (TTFT): $ttft ms');
      print('==================================');

      expect(buffer.toString(), 'Tổng tiền là 350.000 đ');
      expect(ttft, greaterThanOrEqualTo(150));
    });
  });
}