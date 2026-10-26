import 'dart:math';

class EvaluationMetrics {
  static int _levenshteinDistance(List<String> s1, List<String> s2) {
    int m = s1.length;
    int n = s2.length;
    List<List<int>> dp = List.generate(m + 1, (_) => List.filled(n + 1, 0));

    for (int i = 0; i <= m; i++) {
      dp[i][0] = i;
    }
    for (int j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    for (int i = 1; i <= m; i++) {
      for (int j = 1; j <= n; j++) {
        if (s1[i - 1].toLowerCase() == s2[j - 1].toLowerCase()) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + min(dp[i - 1][j - 1], min(dp[i - 1][j], dp[i][j - 1]));
        }
      }
    }
    return dp[m][n];
  }

  static double calculateWER(String groundTruth, String ocrOutput) {
    List<String> refWords = groundTruth.trim().split(RegExp(r'\s+'));
    List<String> hypWords = ocrOutput.trim().split(RegExp(r'\s+'));

    if (refWords.isEmpty || (refWords.length == 1 && refWords.first.isEmpty)) {
      return hypWords.isEmpty ? 0.0 : 1.0;
    }

    int distance = _levenshteinDistance(refWords, hypWords);
    return distance / refWords.length;
  }

  static double calculateAccuracy(String groundTruth, String ocrOutput) {
    double wer = calculateWER(groundTruth, ocrOutput);
    return max(0.0, (1.0 - wer) * 100);
  }
}