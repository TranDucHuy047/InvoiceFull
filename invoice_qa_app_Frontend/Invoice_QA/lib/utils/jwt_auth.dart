import 'package:jwt_decoder/jwt_decoder.dart';

import '../models/user_model.dart';

class JwtAuth {
  JwtAuth._();

  static bool isExpired(String token) {
    try {
      return JwtDecoder.isExpired(token);
    } catch (_) {
      return true;
    }
  }

  static AppUser decodeUser(String token) {
    if (token.trim().isEmpty || isExpired(token)) {
      throw Exception('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    final claims = JwtDecoder.decode(token);
    // Backend JWT: {"sub": "username", "role": "user/admin", "exp": ...}
    // Map claims sang AppUser-friendly format
    final normalizedClaims = <String, dynamic>{
      'id': claims['user_id']?.toString() ?? '',
      'username': claims['sub'] ?? '',       // sub = username
      'email': claims['email'] ?? '',
      'role': claims['role'] ?? 'user',
      // Fallback cho các claims bổ sung nếu có
      ...claims,
    };
    final user = AppUser.fromJson(normalizedClaims);
    if (user.fullName.isEmpty && user.id.isEmpty) {
      throw Exception('JWT không chứa thông tin người dùng hợp lệ.');
    }
    return user;
  }


  static String extractToken(dynamic payload) {
    if (payload is String && payload.trim().isNotEmpty) {
      return payload.trim();
    }
    if (payload is Map) {
      const keys = ['access_token', 'token', 'jwt', 'accessToken'];
      for (final key in keys) {
        final value = payload[key];
        if (value is String && value.trim().isNotEmpty) {
          return value.trim();
        }
      }
      if (payload['data'] != null) {
        return extractToken(payload['data']);
      }
    }
    throw Exception('Phản hồi đăng nhập không chứa JWT.');
  }
}
