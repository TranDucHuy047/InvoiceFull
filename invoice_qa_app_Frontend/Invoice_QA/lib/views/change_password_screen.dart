import 'package:flutter/material.dart';

import '../ui_contracts/thuy_ui_contracts.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({
    super.key,
    required this.onChangePassword,
  });

  final ChangePasswordAction onChangePassword;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.onChangePassword(_current.text, _next.text);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đổi mật khẩu thành công.')),
      );
      Navigator.of(context).maybePop();
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
      appBar: AppBar(title: const Text('Đổi mật khẩu')),
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
                    _PasswordField(
                      controller: _current,
                      label: 'Mật khẩu hiện tại',
                    ),
                    const SizedBox(height: 14),
                    _PasswordField(
                      controller: _next,
                      label: 'Mật khẩu mới',
                      validator: (value) => (value ?? '').length < 6
                          ? 'Mật khẩu mới tối thiểu 6 ký tự.'
                          : null,
                    ),
                    const SizedBox(height: 14),
                    _PasswordField(
                      controller: _confirm,
                      label: 'Nhập lại mật khẩu mới',
                      validator: (value) => value != _next.text
                          ? 'Mật khẩu nhập lại chưa khớp.'
                          : null,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      Text(_error!, style: const TextStyle(color: Color(0xFFB42318))),
                    ],
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: _loading ? null : _submit,
                      icon: const Icon(Icons.password_rounded),
                      label: Text(_loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'),
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

class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.controller,
    required this.label,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: true,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: const Icon(Icons.lock_outline_rounded),
        border: const OutlineInputBorder(),
      ),
      validator: validator ??
          (value) => (value ?? '').isEmpty ? 'Không được để trống.' : null,
    );
  }
}
