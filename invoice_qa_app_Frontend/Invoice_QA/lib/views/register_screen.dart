import 'package:flutter/material.dart';

import '../ui_contracts/thuy_ui_contracts.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({
    super.key,
    required this.onRegister,
    required this.onSendOtp,
    this.onBackToLogin,
  });

  /// Callback đăng ký (Bước 2): nhận username, email, password, otpCode.
  final RegisterAction onRegister;

  /// Callback gửi OTP (Bước 1): nhận email/SĐT.
  final SendOtpAction onSendOtp;

  final VoidCallback? onBackToLogin;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  // --- Step 1 form controllers ---
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  // --- Step 2: OTP ---
  final _otpController = TextEditingController();

  bool _loading = false;
  bool _obscure = true;
  String? _error;

  /// true = đã gửi OTP thành công, hiển thị bước nhập mã
  bool _otpSent = false;

  @override
  void dispose() {
    _fullName.dispose();
    _username.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    _otpController.dispose();
    super.dispose();
  }

  /// Bước 1: Validate form → Gọi API gửi OTP
  Future<void> _sendOtp() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.onSendOtp(
        _email.text.trim(),
        username: _username.text.trim(),
      );
      if (mounted) {
        setState(() => _otpSent = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Mã OTP đã gửi tới ${_email.text.trim()}. Kiểm tra hộp thư của bạn.'),
            backgroundColor: Colors.green.shade700,
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Bước 2: Xác thực OTP + Tạo tài khoản
  Future<void> _register() async {
    if (_otpController.text.trim().isEmpty) {
      setState(() => _error = 'Vui lòng nhập mã OTP.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.onRegister(
        _fullName.text.trim(),
        _username.text.trim(),
        _email.text.trim(),
        _password.text,
        _otpController.text.trim(),
      );
    } catch (error) {
      if (mounted) {
        setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đăng ký')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 500),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Tạo tài khoản',
                      style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Tạo tài khoản để lưu lịch sử hóa đơn và sử dụng tính năng hỏi đáp.',
                      style: TextStyle(color: Color(0xFF687386), height: 1.4),
                    ),
                    const SizedBox(height: 24),

                    // ── Bước 1: Thông tin tài khoản ──
                    _SectionLabel(
                      step: 1,
                      label: 'Thông tin tài khoản',
                      isCompleted: _otpSent,
                    ),
                    const SizedBox(height: 12),

                    // Họ và tên
                    TextFormField(
                      controller: _fullName,
                      enabled: !_otpSent,
                      keyboardType: TextInputType.name,
                      autofillHints: const [AutofillHints.name],
                      decoration: const InputDecoration(
                        labelText: 'Họ và tên',
                        prefixIcon: Icon(Icons.badge_outlined),
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) {
                        final text = (value ?? '').trim();
                        if (text.isEmpty) return 'Vui lòng nhập họ và tên.';
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Username
                    TextFormField(
                      controller: _username,
                      enabled: !_otpSent,
                      keyboardType: TextInputType.text,
                      autofillHints: const [AutofillHints.username],
                      decoration: const InputDecoration(
                        labelText: 'Tên đăng nhập (Username)',
                        prefixIcon: Icon(Icons.person_outline_rounded),
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) {
                        final text = (value ?? '').trim();
                        if (text.isEmpty) return 'Vui lòng nhập tên đăng nhập.';
                        if (text.length < 3) return 'Username tối thiểu 3 ký tự.';
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Email (dùng để nhận OTP)
                    TextFormField(
                      controller: _email,
                      enabled: !_otpSent,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(
                        labelText: 'Email (dùng để nhận mã OTP)',
                        prefixIcon: Icon(Icons.mail_outline_rounded),
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) {
                        final text = (value ?? '').trim();
                        if (text.isEmpty) return 'Vui lòng nhập email.';
                        if (!text.contains('@')) return 'Email chưa đúng định dạng.';
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Password
                    TextFormField(
                      controller: _password,
                      enabled: !_otpSent,
                      obscureText: _obscure,
                      decoration: InputDecoration(
                        labelText: 'Mật khẩu',
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                        border: const OutlineInputBorder(),
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (value) => (value ?? '').length < 6
                          ? 'Mật khẩu tối thiểu 6 ký tự.'
                          : null,
                    ),
                    const SizedBox(height: 14),

                    // Confirm password
                    TextFormField(
                      controller: _confirm,
                      enabled: !_otpSent,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Nhập lại mật khẩu',
                        prefixIcon: Icon(Icons.verified_user_outlined),
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) => value != _password.text
                          ? 'Mật khẩu nhập lại chưa khớp.'
                          : null,
                    ),
                    const SizedBox(height: 16),

                    // Nút Lấy mã OTP (chỉ hiện khi chưa gửi OTP)
                    if (!_otpSent)
                      FilledButton.icon(
                        onPressed: _loading ? null : _sendOtp,
                        icon: _loading
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.send_rounded),
                        label: Text(_loading ? 'Đang gửi OTP...' : 'Lấy mã OTP'),
                      ),

                    // ── Bước 2: Nhập mã OTP ──
                    if (_otpSent) ...[
                      const SizedBox(height: 24),
                      _SectionLabel(step: 2, label: 'Xác thực OTP', isCompleted: false),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _otpController,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        decoration: const InputDecoration(
                          labelText: 'Mã OTP 6 chữ số',
                          prefixIcon: Icon(Icons.lock_clock_outlined),
                          border: OutlineInputBorder(),
                          helperText: 'Mã có hiệu lực trong 5 phút.',
                          counterText: '',
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Gửi lại OTP
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          onPressed: _loading ? null : () {
                            setState(() {
                              _otpSent = false;
                              _otpController.clear();
                              _error = null;
                            });
                          },
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          label: const Text('Gửi lại mã'),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Nút Đăng ký
                      FilledButton.icon(
                        onPressed: _loading ? null : _register,
                        icon: _loading
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.person_add_alt_1_rounded),
                        label: Text(_loading ? 'Đang tạo tài khoản...' : 'Đăng ký'),
                      ),
                    ],

                    // Thông báo lỗi
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFEEEE),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: Color(0xFFB42318)),
                            const SizedBox(width: 10),
                            Expanded(child: Text(_error!, style: const TextStyle(color: Color(0xFFB42318)))),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: _loading ? null : widget.onBackToLogin,
                      child: const Text('Đã có tài khoản? Đăng nhập'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Widget hiển thị nhãn bước (Step indicator nhỏ gọn)
class _SectionLabel extends StatelessWidget {
  const _SectionLabel({
    required this.step,
    required this.label,
    required this.isCompleted,
  });

  final int step;
  final String label;
  final bool isCompleted;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Row(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: isCompleted ? Colors.green : primary,
            shape: BoxShape.circle,
          ),
          child: Icon(
            isCompleted ? Icons.check_rounded : Icons.circle_outlined,
            color: Colors.white,
            size: 16,
          ),
        ),
        const SizedBox(width: 10),
        Text(
          'Bước $step – $label',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: isCompleted ? Colors.green.shade700 : primary,
          ),
        ),
      ],
    );
  }
}
