import 'package:flutter_test/flutter_test.dart';
import 'package:invoice_qa_app/main.dart';
import 'package:invoice_qa_app/providers/auth_provider.dart';
import 'package:invoice_qa_app/services/api_service.dart';
import 'package:invoice_qa_app/services/token_store.dart';

void main() {
  testWidgets('Màn hình khởi đầu là luồng đăng nhập', (WidgetTester tester) async {
    final auth = AuthProvider(
      apiService: ApiService(tokenStore: MemoryTokenStore()),
    );
    await auth.restoreSession();

    await tester.pumpWidget(InvoiceQaApp(authProvider: auth));
    await tester.pump();

    expect(find.text('Đăng nhập Invoice AI'), findsOneWidget);
    expect(find.text('Đăng nhập'), findsOneWidget);
  });
}
