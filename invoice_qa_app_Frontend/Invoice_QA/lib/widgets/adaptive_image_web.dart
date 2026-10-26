import 'package:flutter/material.dart';

Widget buildAdaptiveImage(String source, BoxFit fit, Widget fallback) {
  final value = source.trim();
  if (value.isEmpty) return fallback;
  return Image.network(
    value,
    fit: fit,
    errorBuilder: (_, _, _) => fallback,
  );
}
