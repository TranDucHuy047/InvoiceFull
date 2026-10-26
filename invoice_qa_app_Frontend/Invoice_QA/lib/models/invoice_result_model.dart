class InvoiceResult {
  final String invoiceId;
  final double ocrConfidence;
  final String storeName;
  final String date;
  final double totalAmount;
  final double taxAmount;
  final List<InvoiceItem> items;
  final String rawText;

  InvoiceResult({
    required this.invoiceId,
    required this.ocrConfidence,
    required this.storeName,
    required this.date,
    required this.totalAmount,
    required this.taxAmount,
    required this.items,
    required this.rawText,
  });

  factory InvoiceResult.fromJson(Map<String, dynamic> json) {
    var list = json['items'] as List;
    List<InvoiceItem> itemsList = list.map((i) => InvoiceItem.fromJson(i)).toList();

    return InvoiceResult(
      invoiceId: json['invoice_id'] ?? '',
      ocrConfidence: (json['ocr_confidence'] ?? 0.0).toDouble(),
      storeName: json['store_name'] ?? '',
      date: json['date'] ?? '',
      totalAmount: (json['total_amount'] ?? 0.0).toDouble(),
      taxAmount: (json['tax_amount'] ?? 0.0).toDouble(),
      items: itemsList,
      rawText: json['raw_text'] ?? '',
    );
  }
}

class InvoiceItem {
  final String itemName;
  final int quantity;
  final double unitPrice;
  final double totalPrice;

  InvoiceItem({
    required this.itemName,
    required this.quantity,
    required this.unitPrice,
    required this.totalPrice,
  });

  factory InvoiceItem.fromJson(Map<String, dynamic> json) {
    return InvoiceItem(
      itemName: json['item_name'] ?? '',
      quantity: json['quantity'] ?? 0,
      unitPrice: (json['unit_price'] ?? 0.0).toDouble(),
      totalPrice: (json['total_price'] ?? 0.0).toDouble(),
    );
  }
}