import '../models/admin_models.dart';

List<AdminUser> filterAdminUsers(List<AdminUser> users, String query) {
  final needle = query.trim().toLowerCase();
  if (needle.isEmpty) return List<AdminUser>.from(users);
  return users.where((user) {
    return user.fullName.toLowerCase().contains(needle) ||
        user.email.toLowerCase().contains(needle) ||
        user.id.toLowerCase().contains(needle);
  }).toList();
}
