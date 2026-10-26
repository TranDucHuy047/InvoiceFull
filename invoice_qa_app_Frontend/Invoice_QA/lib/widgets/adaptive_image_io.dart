import 'dart:io';

import 'package:flutter/material.dart';

Widget buildAdaptiveImage(String source, BoxFit fit, Widget fallback) {
  final value = source.trim();
  if (value.isEmpty) return fallback;
  if (value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('data:')) {
    return Image.network(
      value,
      fit: fit,
      errorBuilder: (_, _, _) => fallback,
    );
  }
  final file = File(value);
  if (!file.existsSync()) return fallback;
  return Image.file(
    file,
    fit: fit,
    errorBuilder: (_, _, _) => fallback,
  );
}
