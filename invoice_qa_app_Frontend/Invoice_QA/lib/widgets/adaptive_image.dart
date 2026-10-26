import 'package:flutter/material.dart';

import 'adaptive_image_stub.dart'
    if (dart.library.io) 'adaptive_image_io.dart'
    if (dart.library.html) 'adaptive_image_web.dart' as platform;

/// Hiển thị ảnh từ path/URL mà không buộc các screen của Thúy import `dart:io`.
/// Nhờ đó layout có thể build trên mobile/desktop và Flutter Web theo đề cương.
class AdaptiveImage extends StatelessWidget {
  const AdaptiveImage({
    super.key,
    required this.source,
    this.fit = BoxFit.cover,
    this.fallback,
  });

  final String source;
  final BoxFit fit;
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    final placeholder = fallback ??
        Container(
          color: const Color(0xFFF0F2F7),
          alignment: Alignment.center,
          child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF8D96A8)),
        );
    return platform.buildAdaptiveImage(source, fit, placeholder);
  }
}
