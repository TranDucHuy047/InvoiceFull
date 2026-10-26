import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SettingsProvider extends ChangeNotifier {
  SettingsProvider(this._storage) {
    _loadSettings();
  }

  final FlutterSecureStorage _storage;

  bool _isDarkMode = false;
  bool get isDarkMode => _isDarkMode;

  bool _isNotificationsEnabled = true;
  bool get isNotificationsEnabled => _isNotificationsEnabled;

  Future<void> _loadSettings() async {
    final darkStr = await _storage.read(key: 'settings_dark_mode');
    _isDarkMode = darkStr == 'true';
    
    final notiStr = await _storage.read(key: 'settings_notifications');
    _isNotificationsEnabled = notiStr != 'false'; // default true
    
    notifyListeners();
  }

  Future<void> setDarkMode(bool value) async {
    _isDarkMode = value;
    await _storage.write(key: 'settings_dark_mode', value: value.toString());
    notifyListeners();
  }

  Future<void> setNotificationsEnabled(bool value) async {
    _isNotificationsEnabled = value;
    await _storage.write(key: 'settings_notifications', value: value.toString());
    notifyListeners();
  }
}
