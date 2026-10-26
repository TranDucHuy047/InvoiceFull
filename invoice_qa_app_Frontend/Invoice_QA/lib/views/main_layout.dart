
import 'package:flutter/material.dart';
import 'invoice_detail_screen.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/invoice_provider.dart';
import '../providers/settings_provider.dart';
import '../services/api_service.dart';

import 'home_screen.dart';
import 'invoice_history_screen.dart';
import 'user_profile_screen.dart';
import 'settings_screen.dart';
import 'scan_invoice_screen.dart';
import 'chat_screen.dart';
import 'report_bug_screen.dart';
import 'invoice_result_screen.dart';
import 'trash_screen.dart';
import 'edit_profile_screen.dart';
import 'change_password_screen.dart';
import '../ui_contracts/thuy_ui_contracts.dart';
import 'package:open_file/open_file.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _currentIndex = 0;


  void _showInvoiceDetail(BuildContext context, InvoiceHistoryViewData item) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (ctx) => InvoiceDetailScreen(
        data: InvoiceDetailViewData(
          invoiceId: item.id,
          storeName: item.storeName,
          dateLabel: item.dateLabel,
          taxAmount: 0,
          totalAmount: item.totalAmount,
          items: const [],
          rawText: '',
          imagePath: item.imagePath,
          ocrConfidence: item.ocrConfidence ?? 1.0,
        ),
        onDelete: () async {
          final success = await ctx.read<InvoiceProvider>().deleteInvoice(item.id);
          if (success && ctx.mounted) {
            Navigator.of(ctx).pop();
            ctx.read<InvoiceProvider>().loadHistory();
          }
        },
        onAskAi: () {
          // Open ChatScreen with this invoice
          Navigator.of(ctx).pushReplacement(
            MaterialPageRoute(
              builder: (chatCtx) => ChatScreen(
                invoiceId: item.id,
                invoiceContext: ChatInvoiceContextViewData(
                  invoiceId: item.id,
                  storeName: item.storeName,
                  dateLabel: item.dateLabel,
                  totalAmount: item.totalAmount,
                  imagePath: item.imagePath,
                ),
                onSendQuestion: (q) async {
                  return ApiService.instance.sendQuestion(question: q);
                },
                onSelectInvoice: () async {},
                onReportBug: (invoiceId) {
                      Navigator.of(chatCtx).push(
                        MaterialPageRoute(
                          builder: (ctx) => ReportBugScreen(
                            initialInvoiceId: invoiceId,
                            onSelectInvoice: () async { return null; },
                            onSubmitReport: (id, desc) async {
                              await Future.delayed(const Duration(seconds: 1));
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('Báo cáo lỗi thành công!')));
                              }
                            },
                          ),
                        ),
                      );
                    },
              ),
            ),
          );
        },
      )
    ));
  }

  // Lấy hàm mở chat từ auth_navigator cũ

  void _openChat(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (chatCtx) => ChatScreen(
          onSendQuestion: (question) async {
            return ApiService.instance.sendQuestion(question: question);
          },
          onReportBug: (invoiceId) {
            Navigator.of(chatCtx).push(
              MaterialPageRoute(
                builder: (bugCtx) => ReportBugScreen(
                  initialInvoiceId: invoiceId,
                  onSelectInvoice: () async {
                    return await Navigator.of(bugCtx).push<InvoiceHistoryViewData>(
                      MaterialPageRoute(
                        builder: (historyCtx) => InvoiceHistoryScreen(
                          title: 'Chọn hóa đơn gặp lỗi',
                          onLoadHistory: () async {
                            final provider = historyCtx.read<InvoiceProvider>();
                            await provider.loadHistory();
                            return provider.history;
                          },
                          onOpenInvoice: (invoice) {
                            Navigator.of(historyCtx).pop(invoice);
                          },
                        ),
                      ),
                    );
                  },
                  onSubmitReport: (id, desc) async {
                    await Future.delayed(const Duration(seconds: 1));
                  },
                ),
              ),
            );
          },
          onSelectInvoice: () async {
            final selected = await Navigator.of(chatCtx).push<InvoiceHistoryViewData>(
              MaterialPageRoute(
                builder: (ctx) => InvoiceHistoryScreen(
                  title: 'Chọn hóa đơn để hỏi',
                  onLoadHistory: () async {
                    final provider = ctx.read<InvoiceProvider>();
                    await provider.loadHistory();
                    return provider.history;
                  },
                  onOpenInvoice: (invoice) {
                    Navigator.of(ctx).pop(invoice);
                  },
                ),
              ),
            );
            if (selected != null) {
              Navigator.of(chatCtx).pushReplacement(
                MaterialPageRoute(
                  builder: (newChatCtx) => ChatScreen(
                    invoiceId: selected.id,
                    invoiceContext: ChatInvoiceContextViewData(
                      invoiceId: selected.id,
                      storeName: selected.storeName,
                      dateLabel: selected.dateLabel,
                      totalAmount: selected.totalAmount,
                      imagePath: selected.imagePath,
                    ),
                    onSendQuestion: (question) async {
                      final ctxPrefix = 'Với hóa đơn ${selected.storeName} ngày ${selected.dateLabel} (ID: ${selected.id}), ';
                      return ApiService.instance.sendQuestion(question: '$ctxPrefix$question');
                    },
                    onReportBug: (invoiceId) {
                      Navigator.of(newChatCtx).push(
                        MaterialPageRoute(
                          builder: (ctx) => ReportBugScreen(
                            initialInvoiceId: invoiceId,
                            onSelectInvoice: () async { return null; },
                            onSubmitReport: (id, desc) async {
                              await Future.delayed(const Duration(seconds: 1));
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('Báo cáo lỗi thành công!')));
                              }
                            },
                          ),
                        ),
                      );
                    },
                  ),
                ),
              );
            }
          },
        ),
      ),
    );
  }

  void _openScan(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ScanInvoiceScreen(
          onAnalyzeInvoice: (imagePath) =>
              ApiService.instance.uploadInvoice(imagePath),
          onOpenResult: (ctx, result, imagePath) {
            Navigator.of(ctx).pushReplacement(
              MaterialPageRoute(
                builder: (resultCtx) => InvoiceResultScreen(
                  result: result,
                  imagePath: imagePath,
                  onAskAboutInvoice: () {
                    Navigator.of(resultCtx).pushReplacement(
                      MaterialPageRoute(
                        builder: (newChatCtx) => ChatScreen(
                          invoiceId: result.invoiceId,
                          invoiceContext: ChatInvoiceContextViewData(
                            invoiceId: result.invoiceId,
                            storeName: result.storeName,
                            dateLabel: result.date,
                            totalAmount: result.totalAmount,
                            imagePath: imagePath,
                          ),
                          onSendQuestion: (question) async {
                            final ctxPrefix = 'Với hóa đơn ${result.storeName} ngày ${result.date} (ID: ${result.invoiceId}), ';
                            return ApiService.instance.sendQuestion(question: '$ctxPrefix$question');
                          },
                          onReportBug: (invoiceId) {
                      Navigator.of(newChatCtx).push(
                        MaterialPageRoute(
                          builder: (ctx) => ReportBugScreen(
                            initialInvoiceId: invoiceId,
                            onSelectInvoice: () async { return null; },
                            onSubmitReport: (id, desc) async {
                              await Future.delayed(const Duration(seconds: 1));
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('Báo cáo lỗi thành công!')));
                              }
                            },
                          ),
                        ),
                      );
                    },
                        ),
                      ),
                    );
                  },
                ),
              ),
            );
          },
        ),
      ),
    ).then((_) {
      if (mounted) {
        context.read<InvoiceProvider>().loadHistory();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final invoiceProvider = context.watch<InvoiceProvider>();
    final settings = context.watch<SettingsProvider>();

    final items = invoiceProvider.history;
    final totalSpending = items.fold<double>(0, (sum, item) => sum + item.totalAmount);
    final statistics = InvoiceHistorySummaryViewData(
      totalInvoices: items.length,
      totalSpending: totalSpending,
      averageInvoice: items.isEmpty ? 0 : totalSpending / items.length,
    );

    final List<Widget> pages = [
      // 0: Home
      HomeScreen(
        userName: auth.displayName,
        userEmail: auth.currentUser?.email ?? '',
        allInvoices: items,
        recentInvoices: items.take(5).toList(),
        onOpenInvoice: (item) => _showInvoiceDetail(context, item),
        onScanInvoice: () => _openScan(context),
        onOpenChat: () => _openChat(context),
        onOpenTrash: () {
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => const TrashScreen()));
        },
        onOpenHistory: () {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => InvoiceHistoryScreen(
              onLoadHistory: () async {
                await context.read<InvoiceProvider>().loadHistory();
                return context.read<InvoiceProvider>().history;
              },
              onDeleteInvoice: (invoiceId) async {
                final success = await context.read<InvoiceProvider>().deleteInvoice(invoiceId);
                if (!success) throw Exception(context.read<InvoiceProvider>().errorMessage);
              },
              onExportInvoices: (filter, format) async {
                final provider = context.read<InvoiceProvider>();
                final path = await provider.downloadExcelReport(
                  fromDate: filter.fromDate?.toIso8601String(),
                  toDate: filter.toDate?.toIso8601String(),
                );
                if (path == null) throw Exception(provider.errorMessage);
                try { await OpenFile.open(path); } catch (e) {}
              },
              onOpenInvoice: (item) {
                _showInvoiceDetail(context, item);
              },
            )
          ));
        },
        onEditProfile: () {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => UserProfileScreen(
              profile: UserProfileViewData(
                userId: context.read<AuthProvider>().currentUser?.id ?? '',
                fullName: context.read<AuthProvider>().currentUser?.fullName ?? '',
                email: context.read<AuthProvider>().currentUser?.email ?? '',
              ),
              onEditProfile: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => EditProfileScreen(
                      initialFullName: context.read<AuthProvider>().currentUser?.fullName ?? '',
                      initialEmail: context.read<AuthProvider>().currentUser?.email ?? '',
                      onUpdateProfile: (fullName, email) async {
                        await context.read<AuthProvider>().updateProfile(fullName, email);
                      },
                    ),
                  ),
                );
              },
              onChangePassword: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ChangePasswordScreen(
                      onChangePassword: (currentPassword, newPassword) async {
                        await context.read<AuthProvider>().changePassword(currentPassword, newPassword);
                      },
                    ),
                  ),
                );
              },
            )
          ));
        },
        onOpenSettings: () {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => SettingsScreen(
              initialDarkMode: context.read<SettingsProvider>().isDarkMode,
              onDarkModeChanged: (val) => context.read<SettingsProvider>().setDarkMode(val),
              initialNotifications: context.read<SettingsProvider>().isNotificationsEnabled,
              onNotificationsChanged: (val) => context.read<SettingsProvider>().setNotificationsEnabled(val),
              onLogout: () {
                context.read<AuthProvider>().logout();
                Navigator.of(context).pop();
              },
            )
          ));
        },
        onLogout: () => auth.logout(),
        onExportData: () async {
          final provider = context.read<InvoiceProvider>();
          final path = await provider.downloadExcelReport();
          if (path != null) {
            try { await OpenFile.open(path); } catch (e) {}
          } else {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(provider.errorMessage)));
            }
          }
        },
      ),
      // 1: History
      InvoiceHistoryScreen(
        onOpenInvoice: (item) => _showInvoiceDetail(context, item),

        onLoadHistory: () async {
          await invoiceProvider.loadHistory();
          return invoiceProvider.history;
        },
        onDeleteInvoice: (invoiceId) async {
          final success = await invoiceProvider.deleteInvoice(invoiceId);
          if (!success) throw Exception(invoiceProvider.errorMessage);
        },
        onExportInvoices: (filter, format) async {
          final path = await invoiceProvider.downloadExcelReport(
            fromDate: filter.fromDate?.toIso8601String(),
            toDate: filter.toDate?.toIso8601String(),
          );
          if (path == null) throw Exception(invoiceProvider.errorMessage);
          try { await OpenFile.open(path); } catch (e) {}
        },
      ),
      // 2: Profile
      UserProfileScreen(
        profile: UserProfileViewData(
          userId: auth.currentUser?.id ?? '',
          fullName: auth.currentUser?.fullName ?? '',
          email: auth.currentUser?.email ?? '',
        ),
        onEditProfile: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => EditProfileScreen(
                initialFullName: auth.currentUser?.fullName ?? '',
                initialEmail: auth.currentUser?.email ?? '',
                onUpdateProfile: (fullName, email) async {
                  await auth.updateProfile(fullName, email);
                },
              ),
            ),
          );
        },
        onChangePassword: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => ChangePasswordScreen(
                onChangePassword: (currentPassword, newPassword) async {
                  await auth.changePassword(currentPassword, newPassword);
                },
              ),
            ),
          );
        },
      ),
      // 3: Settings
      SettingsScreen(
        initialDarkMode: settings.isDarkMode,
        onDarkModeChanged: (val) => settings.setDarkMode(val),
        initialNotifications: settings.isNotificationsEnabled,
        onNotificationsChanged: (val) => settings.setNotificationsEnabled(val),
        onLogout: () {
          auth.logout();
        },
      ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: pages,
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openChat(context),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
        child: const Icon(Icons.auto_awesome), // ✨ icon
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex > 1 ? _currentIndex + 1 : _currentIndex, // offset for middle button
        onTap: (idx) {
          if (idx == 2) {
            _openScan(context);
          } else {
            setState(() {
              _currentIndex = idx > 2 ? idx - 1 : idx;
            });
          }
        },
        type: BottomNavigationBarType.fixed,
        selectedItemColor: Theme.of(context).primaryColor,
        unselectedItemColor: Colors.grey,
        showUnselectedLabels: true,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Trang chủ'),
          BottomNavigationBarItem(icon: Icon(Icons.history_outlined), activeIcon: Icon(Icons.history), label: 'Lịch sử'),
          BottomNavigationBarItem(
            icon: Icon(Icons.qr_code_scanner),
            label: 'Quét',
          ),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Hồ sơ'),
          BottomNavigationBarItem(icon: Icon(Icons.settings_outlined), activeIcon: Icon(Icons.settings), label: 'Cài đặt'),
        ],
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
    );
  }
}
