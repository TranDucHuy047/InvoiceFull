import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/invoice_provider.dart';
import '../services/api_service.dart';
import 'admin_web_redirect_screen.dart';
import 'login_screen.dart';
import 'register_screen.dart';
import 'main_layout.dart';

class AuthNavigator extends StatelessWidget {
  const AuthNavigator({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.isRestoring) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!auth.isAuthenticated) {
      return const _GuestAuthFlow();
    }

    if (auth.isAdmin) {
      return const AdminWebRedirectScreen();
    }

    return const _UserHomeFlow();
  }
}

class _GuestAuthFlow extends StatefulWidget {
  const _GuestAuthFlow();

  @override
  State<_GuestAuthFlow> createState() => _GuestAuthFlowState();
}

class _GuestAuthFlowState extends State<_GuestAuthFlow> {
  bool _showRegister = false;

  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthProvider>();

    if (_showRegister) {
      return RegisterScreen(
        // Bước 1: Gửi OTP qua email
        onSendOtp: (contact, {username}) async {
          await ApiService.instance.sendOtp(
            contact: contact,
            username: username,
          );
        },
        // Bước 2: Đăng ký với mã OTP đã xác thực
        onRegister: (fullName, username, email, password, otpCode) async {
          await auth.register(fullName, username, email, password, otpCode);
        },
        onBackToLogin: () => setState(() => _showRegister = false),
      );
    }

    return LoginScreen(
      onLogin: (username, password) async {
        await auth.login(username, password);
      },
      onOpenRegister: () => setState(() => _showRegister = true),
      onForgotPassword: () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Vui lòng liên hệ quản trị viên để đặt lại mật khẩu.',
            ),
          ),
        );
      },
    );
  }
}

class _UserHomeFlow extends StatefulWidget {
  const _UserHomeFlow();

  @override
  State<_UserHomeFlow> createState() => _UserHomeFlowState();
}

class _UserHomeFlowState extends State<_UserHomeFlow> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<InvoiceProvider>().loadHistory();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return const MainLayout();
  }
}

