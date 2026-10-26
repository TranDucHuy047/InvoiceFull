import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'providers/invoice_provider.dart';
import 'theme/app_theme.dart';
import 'views/auth_navigator.dart';
import 'providers/admin_provider.dart';
import 'providers/settings_provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

void main() {
  runApp(const InvoiceQaApp());
}

class InvoiceQaApp extends StatelessWidget {
  const InvoiceQaApp({super.key, this.authProvider});

  final AuthProvider? authProvider;

  @override
  Widget build(BuildContext context) {
return MultiProvider(
  providers: [
    ChangeNotifierProvider(
      create: (_) => authProvider ?? (AuthProvider()..restoreSession()),
    ),
    ChangeNotifierProvider(create: (_) => InvoiceProvider()),
    // Đăng ký AdminProvider
    ChangeNotifierProvider(create: (_) => AdminProvider()), 
    ChangeNotifierProvider(create: (_) => SettingsProvider(const FlutterSecureStorage())),
  ],
      child: Consumer<SettingsProvider>(
        builder: (context, settings, _) {
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            title: 'Invoice AI',
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: settings.isDarkMode ? ThemeMode.dark : ThemeMode.light,
            home: const AuthNavigator(),
          );
        },
      ),
    );
  }
}
