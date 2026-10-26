import 'package:flutter_test/flutter_test.dart';

import 'package:invoice_qa_app/utils/evaluation_metrics.dart';

void main() {
  group('Kiểm thử Thuật toán Đo lường Chất lượng OCR', () {

    test('Kiểm thử tính WER và Accuracy chính xác', () {

      String groundTruth = "Sữa tươi Vinamilk 1L";
      String ocrOutput = "Sua tuoi Vinamilk 1L";

      double wer = EvaluationMetrics.calculateWER(groundTruth, ocrOutput);
      double acc = EvaluationMetrics.calculateAccuracy(groundTruth, ocrOutput);


      expect(wer, 0.5);
      expect(acc, 50.0);
    });

    test('Kiểm thử OCR đọc đúng 100%', () {
      String groundTruth = "Bánh mì kẹp thịt 25k";
      String ocrOutput = "Bánh mì kẹp thịt 25k";

      double wer = EvaluationMetrics.calculateWER(groundTruth, ocrOutput);
      double acc = EvaluationMetrics.calculateAccuracy(groundTruth, ocrOutput);

      expect(wer, 0.0);
      expect(acc, 100.0);
    });

  });
}