import 'package:flutter/material.dart';

import '../ui_contracts/thuy_ui_contracts.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({
    super.key,
    required this.onUpdateProfile,
    this.initialFullName = '',
    this.initialEmail = '',
    this.onChangeAvatar,
  });

  final UpdateProfileAction onUpdateProfile;
  final String initialFullName;
  final String initialEmail;
  final VoidCallback? onChangeAvatar;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.initialFullName);
    _email = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.onUpdateProfile(_name.text.trim(), _email.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cập nhật thông tin thành công.')),
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
      appBar: AppBar(title: const Text('Cập nhật thông tin')),
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
                    Center(
                      child: Stack(
                        alignment: Alignment.bottomRight,
                        children: [
                          CircleAvatar(
                            radius: 44,
                            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                            child: Icon(Icons.person_rounded, size: 42, color: Theme.of(context).colorScheme.primary),
                          ),
                          IconButton.filled(
                            tooltip: 'Đổi ảnh đại diện',
                            onPressed: widget.onChangeAvatar,
                            icon: const Icon(Icons.camera_alt_rounded, size: 18),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 22),
                    TextFormField(
                      controller: _name,
                      decoration: const InputDecoration(
                        labelText: 'Họ và tên',
                        prefixIcon: Icon(Icons.person_outline_rounded),
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) => (value ?? '').trim().isEmpty
                          ? 'Vui lòng nhập họ tên.'
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email',
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
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      Text(_error!, style: const TextStyle(color: Color(0xFFB42318))),
                    ],
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: _loading ? null : _submit,
                      icon: const Icon(Icons.save_rounded),
                      label: Text(_loading ? 'Đang lưu...' : 'Lưu thông tin'),
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
