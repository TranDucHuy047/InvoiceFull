import 'package:flutter/foundation.dart';

/// Các contract ở file này chỉ dùng để nối UI của Thúy với logic/API bên ngoài.
/// Không chứa Provider, Dio, JWT, Weaviate hay business logic.
typedef LoginAction = Future<void> Function(String username, String password);
typedef SendOtpAction = Future<void> Function(String contact, {String? username});
typedef RegisterAction = Future<void> Function(
  String fullName,
  String username,
  String email,
  String password,
  String otpCode,
);
typedef ChangePasswordAction = Future<void> Function(
  String currentPassword,
  String newPassword,
);
typedef UpdateProfileAction = Future<void> Function(
  String fullName,
  String email,
);
typedef SendQuestionAction = Future<String> Function(String question);
/// Stream phát từng đoạn text AI để UI hiển thị phản hồi real-time.
/// Logic SSE/WebSocket/RAG vẫn thuộc Loan/Huy; UI chỉ lắng nghe stream.
typedef StreamQuestionAction = Stream<String> Function(String question);
typedef LoadHistoryAction = Future<List<InvoiceHistoryViewData>> Function();
typedef DeleteInvoiceAction = Future<void> Function(String invoiceId);
typedef ExportInvoicesAction = Future<void> Function(
  InvoiceHistoryFilter filter,
  InvoiceExportFormat format,
);
typedef SaveInvoiceAction = Future<void> Function(InvoiceEditDraft draft);
typedef ToggleAdminUserLockAction = Future<void> Function(
  String userId,
  bool shouldLock,
);

enum InvoiceExportFormat { excel, csv }

enum ExtractionViewMode { table, json }

@immutable
class ChatMessageViewData {
  const ChatMessageViewData({
    required this.text,
    required this.isUser,
    this.createdAt,
  });

  final String text;
  final bool isUser;
  final DateTime? createdAt;
}

@immutable
class ChatInvoiceContextViewData {
  const ChatInvoiceContextViewData({
    required this.invoiceId,
    required this.storeName,
    required this.dateLabel,
    required this.totalAmount,
    this.imagePath,
  });

  final String invoiceId;
  final String storeName;
  final String dateLabel;
  final double totalAmount;
  final String? imagePath;
}

@immutable
class InvoiceHistoryViewData {
  const InvoiceHistoryViewData({
    required this.id,
    required this.storeName,
    required this.dateLabel,
    required this.totalAmount,
    this.ocrConfidence,
    this.imagePath,
    this.categoryLabel,
    this.statusLabel,
    this.deletedAt,
  });

  final String id;
  final String storeName;
  final String dateLabel;
  final double totalAmount;
  final double? ocrConfidence;
  final String? imagePath;
  final String? categoryLabel;
  final String? statusLabel;
  final DateTime? deletedAt;
}

@immutable
class InvoiceHistorySummaryViewData {
  const InvoiceHistorySummaryViewData({
    this.totalInvoices = 0,
    this.totalSpending = 0,
    this.averageInvoice = 0,
  });

  final int totalInvoices;
  final double totalSpending;
  final double averageInvoice;
}

@immutable
class InvoiceHistoryFilter {
  const InvoiceHistoryFilter({
    this.fromDate,
    this.toDate,
    this.minAmount,
    this.maxAmount,
    this.searchQuery = '',
    this.extractionStatus,
    this.newestFirst = true,
  });

  final DateTime? fromDate;
  final DateTime? toDate;
  final double? minAmount;
  final double? maxAmount;
  final String searchQuery;
  /// Giá trị trung gian để Loan map vào query API, ví dụ success/review/error.
  final String? extractionStatus;
  final bool newestFirst;

  InvoiceHistoryFilter copyWith({
    DateTime? fromDate,
    bool clearFromDate = false,
    DateTime? toDate,
    bool clearToDate = false,
    double? minAmount,
    bool clearMinAmount = false,
    double? maxAmount,
    bool clearMaxAmount = false,
    String? searchQuery,
    String? extractionStatus,
    bool clearExtractionStatus = false,
    bool? newestFirst,
  }) {
    return InvoiceHistoryFilter(
      fromDate: clearFromDate ? null : (fromDate ?? this.fromDate),
      toDate: clearToDate ? null : (toDate ?? this.toDate),
      minAmount: clearMinAmount ? null : (minAmount ?? this.minAmount),
      maxAmount: clearMaxAmount ? null : (maxAmount ?? this.maxAmount),
      searchQuery: searchQuery ?? this.searchQuery,
      extractionStatus: clearExtractionStatus ? null : (extractionStatus ?? this.extractionStatus),
      newestFirst: newestFirst ?? this.newestFirst,
    );
  }
}

@immutable
class UserProfileViewData {
  const UserProfileViewData({
    required this.userId,
    required this.fullName,
    required this.email,
    this.createdAtLabel = '',
    this.avatarUrl,
  });

  final String userId;
  final String fullName;
  final String email;
  final String createdAtLabel;
  final String? avatarUrl;
}

@immutable
class InvoiceItemViewData {
  const InvoiceItemViewData({
    required this.name,
    required this.quantity,
    required this.unitPrice,
    required this.totalPrice,
  });

  final String name;
  final int quantity;
  final double unitPrice;
  final double totalPrice;
}

@immutable
class InvoiceDetailViewData {
  const InvoiceDetailViewData({
    required this.invoiceId,
    required this.storeName,
    required this.dateLabel,
    required this.taxAmount,
    required this.totalAmount,
    required this.items,
    required this.rawText,
    this.address = '',
    this.taxCode = '',
    this.ocrConfidence,
    this.imagePath,
    this.structuredJson = const {},
  });

  final String invoiceId;
  final String storeName;
  final String address;
  final String dateLabel;
  final String taxCode;
  final double taxAmount;
  final double totalAmount;
  final List<InvoiceItemViewData> items;
  final String rawText;
  final double? ocrConfidence;
  final String? imagePath;
  final Map<String, dynamic> structuredJson;
}

@immutable
class InvoiceEditItemDraft {
  const InvoiceEditItemDraft({
    required this.name,
    required this.quantity,
    required this.unitPrice,
  });

  final String name;
  final int quantity;
  final double unitPrice;
}

@immutable
class InvoiceEditDraft {
  const InvoiceEditDraft({
    required this.invoiceId,
    required this.storeName,
    required this.address,
    required this.dateLabel,
    required this.taxCode,
    required this.taxAmount,
    required this.totalAmount,
    required this.items,
  });

  final String invoiceId;
  final String storeName;
  final String address;
  final String dateLabel;
  final String taxCode;
  final double taxAmount;
  final double totalAmount;
  final List<InvoiceEditItemDraft> items;
}

@immutable
class AdminUserViewData {
  const AdminUserViewData({
    required this.id,
    required this.fullName,
    required this.email,
    this.roleLabel = 'User',
    this.isLocked = false,
  });

  final String id;
  final String fullName;
  final String email;
  final String roleLabel;
  final bool isLocked;
}

@immutable
class AdminStatisticsViewData {
  const AdminStatisticsViewData({
    this.totalInvoices = 0,
    this.totalUsers = 0,
    this.totalRagQueries = 0,
  });

  final int totalInvoices;
  final int totalUsers;
  final int totalRagQueries;
}

@immutable
class ChartPointViewData {
  const ChartPointViewData({required this.label, required this.value});

  final String label;
  final double value;
}
