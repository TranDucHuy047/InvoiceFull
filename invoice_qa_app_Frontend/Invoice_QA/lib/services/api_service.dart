import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/admin_models.dart';
import '../models/invoice_result_model.dart';
import '../models/user_model.dart';
import '../utils/jwt_auth.dart';
import 'token_store.dart';

class ApiService {
  ApiService({
    String? baseUrl,
    TokenStore? tokenStore,
    FlutterSecureStorage? storage,
  }) : _tokenStore = tokenStore ??
      SecureTokenStore(storage: storage ?? const FlutterSecureStorage()) {
    _dio = Dio(
      BaseOptions(
        // Địa chỉ IP LAN của máy chủ Backend – bao gồm tiền tố /api
        baseUrl: baseUrl ?? 'http://192.168.143.2:8000/api',
        connectTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 120),
        sendTimeout: const Duration(seconds: 120),
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (_isPublicAuthPath(options.path)) {
            return handler.next(options);
          }
          final token = await _tokenStore.read();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          if (_shouldInvalidateSession(e)) {
            await _tokenStore.delete();
            onUnauthorized?.call();
          }
          return handler.next(e);
        },
      ),
    );
  }

  static final ApiService instance = ApiService();
  String get baseUrl => _dio.options.baseUrl;


  late final Dio _dio;
  final TokenStore _tokenStore;

  /// AuthProvider đăng ký để rẽ nhánh về Login khi token hết hạn / tài khoản bị khóa.
  void Function()? onUnauthorized;

  TokenStore get tokenStore => _tokenStore;
  Future<String?> getJwtToken() => _tokenStore.read();

  bool _isPublicAuthPath(String path) {
    // path ở đây là path tương đối (không bao gồm baseUrl)
    return path.contains('/auth/login') ||
        path.contains('/auth/register') ||
        path.contains('/auth/send-otp');
  }

  bool _shouldInvalidateSession(DioException e) {
    final code = e.response?.statusCode;
    if (code != 401 && code != 403) return false;
    return !_isPublicAuthPath(e.requestOptions.path);
  }

  // ==========================================
  // --- XÁC THỰC (AUTH) ---
  // ==========================================

  /// Đăng nhập bằng username và password.
  /// Backend dùng OAuth2PasswordRequestForm → gửi dạng form-data (urlencoded).
  Future<String> login({required String username, required String password}) async {
    try {
      final response = await _dio.post(
        '/auth/login',
        data: {
          'username': username,
          'password': password,
        },
        options: Options(
          contentType: Headers.formUrlEncodedContentType,
        ),
      );
      return JwtAuth.extractToken(response.data);
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Bước 1 của luồng đăng ký: Gửi OTP tới email hoặc số điện thoại.
  Future<void> sendOtp({required String contact, String? username}) async {
    try {
      final data = <String, dynamic>{'contact': contact};
      if (username != null && username.trim().isNotEmpty) {
        data['username'] = username.trim();
      }
      await _dio.post(
        '/auth/send-otp',
        data: data,
      );
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Bước 2 của luồng đăng ký: Tạo tài khoản sau khi xác thực OTP.
  Future<void> register({
    required String fullName,
    required String username,
    required String email,
    required String password,
    required String otpCode,
  }) async {
    try {
      await _dio.post(
        '/auth/register',
        data: {
          'full_name': fullName,
          'username': username,
          'email': email,
          'password': password,
          'otp_code': otpCode,
        },
      );
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Cập nhật email (hồ sơ cá nhân).
  Future<AppUser> updateProfile({
    required String fullName,
    required String email,
  }) async {
    try {
      final response = await _dio.put(
        '/auth/profile',
        data: {
          'email': email,
        },
      );
      // Backend trả về {status, message} – tạo AppUser từ email mới
      if (response.statusCode == 200) {
        final existing = await fetchMe();
        return existing;
      }
      throw Exception('Cập nhật hồ sơ thất bại.');
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Lấy thông tin tài khoản đang đăng nhập.
  Future<AppUser> fetchMe() async {
    try {
      final response = await _dio.get('/auth/me');
      final data = _unwrapData(response.data);
      if (data is Map) {
        return AppUser.fromJson(Map<String, dynamic>.from(data));
      }
      throw Exception('Phản hồi thông tin tài khoản không hợp lệ.');
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Đổi mật khẩu.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      await _dio.post(
        '/auth/change-password',
        data: {
          'old_password': currentPassword,
          'new_password': newPassword,
        },
      );
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  // ==========================================
  // --- ADMIN ---
  // ==========================================

  Future<List<AdminUser>> fetchAdminUsers({String? query}) async {
    try {
      final response = await _dio.get(
        '/admin/users',
        queryParameters: {
          // Backend dùng query param 'search' (không phải 'q')
          if (query != null && query.trim().isNotEmpty) 'search': query.trim(),
        },
      );
      return _parseAdminUsers(_unwrapData(response.data));
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Khóa/mở khóa tài khoản user. Backend cần query param lock_status=bool.
  Future<AdminUser> toggleUserLock(String userId, {required bool lockStatus}) async {
    try {
      final response = await _dio.put(
        '/admin/users/$userId/toggle-lock',
        queryParameters: {'lock_status': lockStatus},
      );
      // Backend trả về message, không trả về user object → lấy lại từ list
      if (response.statusCode == 200) {
        // Trả về object tạm với isLocked đã đảo (UI sẽ refresh)
        return AdminUser(
          id: userId,
          username: '',
          email: '',
          role: 'user',
          isLocked: lockStatus,
        );
      }
      throw Exception('Cập nhật trạng thái khóa thất bại.');
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  Future<AdminStatistics> fetchAdminStatistics() async {
    try {
      final response = await _dio.get('/admin/statistics');
      final data = _unwrapData(response.data);
      if (data is Map) {
        return AdminStatistics.fromJson(Map<String, dynamic>.from(data));
      }
      throw Exception('Phản hồi thống kê không hợp lệ.');
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  List<AdminUser> _parseAdminUsers(dynamic payload) {
    List<dynamic>? raw;
    if (payload is List) {
      raw = payload;
    } else if (payload is Map) {
      final nested = payload['users'] ??
          payload['items'] ??
          payload['results'] ??
          payload['data'];
      if (nested is List) raw = nested;
    }
    if (raw == null) {
      throw Exception('Phản hồi danh sách người dùng không hợp lệ.');
    }
    return raw
        .whereType<Map>()
        .map((item) => AdminUser.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  // ==========================================
  // --- HÓA ĐƠN (INVOICE) ---
  // ==========================================

  /// Upload ảnh hóa đơn để OCR và trích xuất dữ liệu.
  /// Endpoint: POST /api/analyze-invoice
  Future<InvoiceResult> uploadInvoice(String filePath) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath, filename: 'invoice.jpg'),
      });

      final response = await _dio.post('/analyze-invoice', data: formData);

      if (response.statusCode == 200 && response.data != null) {
        return InvoiceResult.fromJson(response.data['data']);
      } else {
        throw Exception('Phản hồi không hợp lệ từ máy chủ (${response.statusCode})');
      }
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    } catch (e) {
      throw Exception('Lỗi không xác định: $e');
    }
  }

  /// Lấy danh sách lịch sử hóa đơn (có bộ lọc tùy chọn).
  /// Endpoint: GET /api/invoices
  Future<Map<String, dynamic>> fetchUserInvoiceHistory({
    String? fromDate,
    String? toDate,
    double? minAmount,
  }) async {
    try {
      final params = <String, dynamic>{};
      if (fromDate != null) params['from_date'] = fromDate;
      if (toDate != null) params['to_date'] = toDate;
      if (minAmount != null) params['min_amount'] = minAmount;

      final response = await _dio.get(
        '/invoices',
        queryParameters: params.isNotEmpty ? params : null,
      );
      final raw = response.data;
      // Backend trả về: {status, message, data: [...]}
      // Normalize thành {invoices: [...], total_personal_spending: X}
      if (raw is Map) {
        final dataList = raw['data'] as List? ?? [];
        final total = dataList.fold<double>(
          0,
          (sum, item) => sum + ((item['total_amount'] ?? 0) as num).toDouble(),
        );
        return {
          'invoices': dataList,
          'total_personal_spending': total,
        };
      }
      throw Exception('Định dạng dữ liệu lịch sử hóa đơn không hợp lệ.');
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Tải file Excel/CSV báo cáo hóa đơn.
  /// Endpoint: GET /api/invoices/export
  Future<void> exportExcel(String savePath, {String? fromDate, String? toDate}) async {
    try {
      final params = <String, dynamic>{};
      if (fromDate != null) params['from_date'] = fromDate;
      if (toDate != null) params['to_date'] = toDate;

      await _dio.download(
        '/invoices/export',
        savePath,
        queryParameters: params.isNotEmpty ? params : null,
        options: Options(
          responseType: ResponseType.bytes,
          followRedirects: false,
        ),
      );
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Xóa hóa đơn theo ID.
  /// Endpoint: DELETE /api/invoices/{invoiceId}
  Future<void> deleteInvoice(String invoiceId) async {
    try {
      await _dio.delete('/invoices/$invoiceId');
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Lấy danh sách thùng rác
  /// Endpoint: GET /api/invoices/trash
  Future<List<dynamic>> fetchTrashInvoices() async {
    try {
      final response = await _dio.get('/invoices/trash');
      final raw = response.data;
      if (raw is Map) {
        return raw['data'] as List? ?? [];
      }
      return [];
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Khôi phục hóa đơn
  /// Endpoint: POST /api/invoices/{invoiceId}/restore
  Future<void> restoreInvoice(String invoiceId) async {
    try {
      await _dio.post('/invoices/$invoiceId/restore');
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Xóa vĩnh viễn hóa đơn
  /// Endpoint: DELETE /api/invoices/{invoiceId}/permanent
  Future<void> deleteInvoicePermanently(String invoiceId) async {
    try {
      await _dio.delete('/invoices/$invoiceId/permanent');
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Cập nhật dữ liệu hóa đơn (sửa lỗi OCR/AI).
  /// Endpoint: PUT /api/invoices/{invoiceId}
  Future<void> updateInvoice(String invoiceId, Map<String, dynamic> updateData) async {
    try {
      await _dio.put(
        '/invoices/$invoiceId',
        data: updateData,
      );
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  // ==========================================
  // --- HỎI ĐÁP RAG ---
  // ==========================================

  /// Lấy danh sách các phiên chat của user hiện tại.
  /// Endpoint: GET /api/history/sessions
  Future<List<Map<String, dynamic>>> fetchChatSessions() async {
    try {
      final response = await _dio.get('/api/history/sessions');
      final List<dynamic> dataList = response.data['data'] ?? [];
      return dataList.cast<Map<String, dynamic>>();
    } catch (e) {
      print('Error fetching chat sessions: $e');
      return [];
    }
  }

  /// Lấy lịch sử chat cho một phiên cụ thể (invoiceId hoặc 'GLOBAL').
  /// Endpoint: GET /api/history/{invoiceId}
  Future<List<Map<String, dynamic>>> fetchChatHistory(String invoiceId) async {
    final response = await _dio.get('/api/history/$invoiceId');
    final List<dynamic> dataList = response.data['data'] ?? [];
    return dataList.cast<Map<String, dynamic>>();
  }

  Future<String> sendQuestion({required String question}) async {
    try {
      final response = await _dio.post(
        '/qa/global',
        data: {'question': question},
      );
      final data = response.data;
      if (data is Map) {
        // Lấy câu trả lời từ data.answer
        final answer = data['data']?['answer'] ?? data['answer'] ?? '';
        return answer.toString();
      }
      throw Exception('Phản hồi RAG không hợp lệ.');
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  /// Gửi báo cáo lỗi của người dùng tới Admin.
  Future<void> submitBugReport({
    String? invoiceId,
    required String description,
  }) async {
    try {
      await _dio.post(
        '/reports',
        data: {
          'description': description,
          if (invoiceId != null && invoiceId.trim().isNotEmpty) 'invoice_id': invoiceId.trim(),
        },
      );
    } on DioException catch (e) {
      throw Exception(_mapDioError(e));
    }
  }

  // ==========================================
  // --- UTILITY ---
  // ==========================================

  dynamic _unwrapData(dynamic payload) {
    if (payload is Map && payload['data'] != null) {
      return payload['data'];
    }
    return payload;
  }

  String _mapDioError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return 'Không thể kết nối đến máy chủ do quá thời gian chờ (Timeout).';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Mất kết nối mạng hoặc máy chủ chưa khởi động. Kiểm tra IP: 192.168.143.2:8000';
    }
    if (e.response?.statusCode == 401) {
      if (_isPublicAuthPath(e.requestOptions.path)) {
        return 'Tên đăng nhập hoặc mật khẩu không đúng.';
      }
      return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
    }
    if (e.response?.statusCode == 400) {
      final data = e.response?.data;
      if (data is Map && data['detail'] != null) {
        return data['detail'].toString();
      }
    }
    if (e.response?.statusCode == 403) {
      if (e.requestOptions.path.contains('/admin/')) {
        return 'Không đủ quyền quản trị để thực hiện thao tác này.';
      }
      return 'Tài khoản của bạn đã bị khóa bởi Quản trị viên.';
    }
    final data = e.response?.data;
    if (data is Map && data['detail'] != null) {
      return 'Lỗi: ${data['detail']}';
    }
    if (data is Map && data['message'] != null) {
      return 'Lỗi hệ thống: ${data['message']}';
    }
    return 'Lỗi hệ thống: ${e.message}';
  }
}
