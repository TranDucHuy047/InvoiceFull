import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class AdminWebRedirectScreen extends StatefulWidget {
  const AdminWebRedirectScreen({super.key});

  @override
  State<AdminWebRedirectScreen> createState() => _AdminWebRedirectScreenState();
}

class _AdminWebRedirectScreenState extends State<AdminWebRedirectScreen> {
  bool _isLaunching = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _launchWebAdmin();
    });
  }

  Future<void> _launchWebAdmin() async {
    if (_isLaunching) return;
    _isLaunching = true;

    final token = await ApiService.instance.tokenStore.read() ?? '';
    // ignore: avoid_print
    print('OPEN_HOST_BROWSER_ADMIN:$token');

    final host = Uri.tryParse(ApiService.instance.baseUrl)?.host ?? 'localhost';
    final targetHost = (host == 'localhost' || host == '127.0.0.1' || host.isEmpty) ? 'localhost' : host;
    final webUrl = 'http://$targetHost:5174/login?token=$token';

    try {
      final uri = Uri.parse(webUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      debugPrint('Launch admin web error: $e');
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đang mở trang quản trị trên trình duyệt của bạn...'),
          duration: Duration(seconds: 3),
        ),
      );
    }

    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          _isLaunching = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Admin Access'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              context.read<AuthProvider>().logout();
            },
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.web, size: 80, color: Colors.blue),
            const SizedBox(height: 24),
            const Text(
              'Tài khoản Admin đã được chuyển\nsang nền tảng Web.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            const Text(
              'Trình duyệt sẽ tự động mở trang quản trị.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _launchWebAdmin,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 12,
                ),
              ),
              child: const Text(
                'Mở lại Web Admin',
                style: TextStyle(fontSize: 16),
              ),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () {
                context.read<AuthProvider>().logout();
              },
              child: const Text(
                'Đăng xuất khỏi App',
                style: TextStyle(color: Colors.red),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
