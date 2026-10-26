import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:invoice_qa_app/utils/jwt_auth.dart';

String _jwt(Map<String, dynamic> payload) {
  String encode(Object value) =>
      base64Url.encode(utf8.encode(value is String ? value : jsonEncode(value))).replaceAll('=', '');
  return '${encode('{"alg":"none","typ":"JWT"}')}.${encode(payload)}.sig';
}

void main() {
  group('Giải mã JWT và rẽ nhánh RoleID (Đợt 6)', () {
    test('User khi role là user', () {
      final token = _jwt({
        'sub': 'user@example.com',
        'email': 'user@example.com',
        'full_name': 'Nguyen Van A',
        'user_id': 'U01',
        'role_id': 'user', // Đã chuyển thành chuỗi 'user'
        'exp': DateTime.now().add(const Duration(hours: 2)).millisecondsSinceEpoch ~/ 1000,
      });

      final user = JwtAuth.decodeUser(token);
      expect(user.isAdmin, isFalse);
      expect(user.roleId, 'user');
      expect(user.fullName, 'Nguyen Van A');
    });

    test('Admin khi role là admin', () {
      final token = _jwt({
        'sub': 'admin@example.com',
        'email': 'admin@example.com',
        'full_name': 'Admin',
        'user_id': 'A01',
        'role_id': 'admin',
        'exp': DateTime.now().add(const Duration(hours: 2)).millisecondsSinceEpoch ~/ 1000,
      });

      final user = JwtAuth.decodeUser(token);
      expect(user.isAdmin, isTrue);
      expect(user.roleId, 'admin');
    });

    test('Token hết hạn bị từ chối', () {
      final token = _jwt({
        'email': 'old@example.com',
        'role_id': 'user',
        'exp': DateTime.now().subtract(const Duration(minutes: 1)).millisecondsSinceEpoch ~/ 1000,
      });

      expect(() => JwtAuth.decodeUser(token), throwsException);
      expect(JwtAuth.isExpired(token), isTrue);
    });

    test('Lấy JWT từ nhiều dạng phản hồi backend', () {
      expect(JwtAuth.extractToken({'access_token': 'abc'}), 'abc');
      expect(JwtAuth.extractToken({'data': {'token': 'xyz'}}), 'xyz');
    });
  });
}