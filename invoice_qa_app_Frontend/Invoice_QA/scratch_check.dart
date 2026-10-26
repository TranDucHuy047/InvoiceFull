
import 'dart:io';

void main() {
  var text = File(r'd:\Invoice\invoice_qa_app_Frontend\Invoice_QA\lib\providers\invoice_provider.dart').readAsStringSync();
  print(text.contains('fetchInvoiceDetail'));
  print(text.contains('getInvoice'));
  print(text.contains('InvoiceDetailViewData'));
}
