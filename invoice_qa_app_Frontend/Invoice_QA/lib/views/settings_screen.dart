
import 'package:flutter/material.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    this.initialDarkMode = false,
    this.initialNotifications = true,
    this.initialLanguage = 'Tiếng Việt',
    this.onDarkModeChanged,
    this.onNotificationsChanged,
    this.onLanguageChanged,
    this.onLogout,
  });

  final bool initialDarkMode;
  final bool initialNotifications;
  final String initialLanguage;
  final ValueChanged<bool>? onDarkModeChanged;
  final ValueChanged<bool>? onNotificationsChanged;
  final ValueChanged<String>? onLanguageChanged;
  final VoidCallback? onLogout;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late bool _darkMode;
  late bool _notifications;
  late bool _autoText;
  String _language = "Tiếng Việt"; // "Tự động chuyển sang văn bản" in the design

  @override
  void initState() {
    super.initState();
    _darkMode = widget.initialDarkMode;
    _notifications = widget.initialNotifications;
    _autoText = false;
    _language = widget.initialLanguage; // Add state if needed
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).primaryColor;

    return Scaffold(
      backgroundColor: const Color(0xFFF9F9FB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Cài đặt',
          style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionTitle('GIAO DIỆN', primary),
            _buildCard([
              _buildListTile(
                title: 'Giao diện',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(_darkMode ? Icons.dark_mode : Icons.light_mode, size: 16, color: Colors.grey.shade600),
                    const SizedBox(width: 4),
                    Text(_darkMode ? 'Tối' : 'Sáng', style: TextStyle(color: Colors.grey.shade700, fontWeight: FontWeight.w500)),
                    const SizedBox(width: 4),
                    Icon(Icons.sync, size: 16, color: Colors.grey.shade600),
                  ],
                ),
                onTap: () {
                  setState(() => _darkMode = !_darkMode);
                  if (widget.onDarkModeChanged != null) widget.onDarkModeChanged!(_darkMode);
                },
              ),
              const Divider(height: 1, color: Color(0xFFEEEEEE)),
              _buildListTile(
                title: 'Ngôn ngữ',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_language == 'Tiếng Việt' ? 'VN ' : 'EN ', style: TextStyle(color: Colors.grey.shade700, fontWeight: FontWeight.w900, fontSize: 10)),
                    Text(_language, style: TextStyle(color: Colors.grey.shade700, fontWeight: FontWeight.w500)),
                    const SizedBox(width: 4),
                    Icon(Icons.keyboard_arrow_down, size: 16, color: Colors.grey.shade600),
                  ],
                ),
                onTap: () {
                  showModalBottomSheet(
                    context: context,
                    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
                    builder: (ctx) => SafeArea(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Padding(
                            padding: EdgeInsets.all(16.0),
                            child: Text('Chọn ngôn ngữ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                          ),
                          ListTile(
                            title: const Text('Tiếng Việt'),
                            trailing: _language == 'Tiếng Việt' ? Icon(Icons.check, color: primary) : null,
                            onTap: () {
                              setState(() => _language = 'Tiếng Việt');
                              if (widget.onLanguageChanged != null) widget.onLanguageChanged!('Tiếng Việt');
                              Navigator.pop(ctx);
                            },
                          ),
                          ListTile(
                            title: const Text('English'),
                            trailing: _language == 'English' ? Icon(Icons.check, color: primary) : null,
                            onTap: () {
                              setState(() => _language = 'English');
                              if (widget.onLanguageChanged != null) widget.onLanguageChanged!('English');
                              Navigator.pop(ctx);
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ]),
            const SizedBox(height: 24),

            _buildSectionTitle('TÙY CHỌN', primary),
            _buildCard([
              _buildSwitchTile(
                title: 'Tự động chuyển sang văn bản',
                value: _autoText,
                onChanged: (val) => setState(() => _autoText = val),
                activeColor: primary,
              ),
              const Divider(height: 1, color: Color(0xFFEEEEEE)),
              _buildSwitchTile(
                title: 'Thông báo',
                value: _notifications,
                onChanged: (val) {
                  setState(() => _notifications = val);
                  if (widget.onNotificationsChanged != null) widget.onNotificationsChanged!(val);
                },
                activeColor: primary,
              ),
            ]),
            const SizedBox(height: 24),

            _buildSectionTitle('TÀI KHOẢN', primary),
            _buildCard([
              _buildListTile(
                title: 'Hồ sơ',
                trailing: const Icon(Icons.chevron_right, color: Colors.black87),
                onTap: () {},
              ),
              const Divider(height: 1, color: Color(0xFFEEEEEE)),
              _buildListTile(
                title: 'Đổi mật khẩu',
                trailing: const Icon(Icons.chevron_right, color: Colors.black87),
                onTap: () {},
              ),
              const Divider(height: 1, color: Color(0xFFEEEEEE)),
              _buildListTile(
                title: 'Xóa tài khoản',
                titleColor: Colors.red.shade400,
                trailing: Icon(Icons.delete_outline, color: Colors.red.shade400),
                onTap: () {},
              ),
              const Divider(height: 1, color: Color(0xFFEEEEEE)),
              _buildListTile(
                title: 'Đăng xuất',
                titleColor: Colors.red.shade400,
                trailing: Icon(Icons.logout, color: Colors.red.shade400),
                onTap: widget.onLogout,
              ),
            ]),
            
            const SizedBox(height: 100),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, Color primary) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          color: primary.withValues(alpha: 0.8),
          fontSize: 12,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildCard(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: children,
      ),
    );
  }

  Widget _buildListTile({required String title, Color? titleColor, Widget? trailing, VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: TextStyle(color: titleColor ?? Colors.grey.shade600, fontSize: 14)),
            ?trailing,
          ],
        ),
      ),
    );
  }

  Widget _buildSwitchTile({required String title, required bool value, required ValueChanged<bool> onChanged, required Color activeColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: Colors.white,
            activeTrackColor: activeColor,
            inactiveThumbColor: Colors.white,
            inactiveTrackColor: Colors.grey.shade300,
          ),
        ],
      ),
    );
  }
}
