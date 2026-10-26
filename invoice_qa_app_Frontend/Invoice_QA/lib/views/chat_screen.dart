
import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../ui_contracts/thuy_ui_contracts.dart';
import '../widgets/chat_bubble.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.onSendQuestion,
    this.onStreamQuestion,
    this.initialMessages = const [],
    this.invoiceId,
    this.invoiceContext,
    this.suggestions = const [
      'Tổng tiền hóa đơn là bao nhiêu?',
      'Tôi đã mua những sản phẩm nào?',
      'Món nào có giá cao nhất?',
      'Thuế VAT là bao nhiêu?',
    ],
    this.onSelectInvoice,
    this.onReportBug,
  });

  final SendQuestionAction onSendQuestion;
  final StreamQuestionAction? onStreamQuestion;
  final List<ChatMessageViewData> initialMessages;
  final String? invoiceId;
  final ChatInvoiceContextViewData? invoiceContext;
  final List<String> suggestions;
  final VoidCallback? onSelectInvoice;
  final ValueChanged<String?>? onReportBug;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  late final List<ChatMessageViewData> _messages;
  bool _sending = false;
  String? _error;
  bool _loadingHistory = false;
  List<Map<String, dynamic>> _sessions = [];

  @override
  void initState() {
    super.initState();
    _messages = [...widget.initialMessages];
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    if (widget.initialMessages.isNotEmpty) return;
    setState(() => _loadingHistory = true);
    try {
      final history = await ApiService.instance.fetchChatHistory(widget.invoiceId ?? 'GLOBAL');
      if (history.isNotEmpty && mounted) {
        setState(() {
          _messages.clear();
          for (var item in history) {
            _messages.add(ChatMessageViewData(
              text: item['content'] ?? '',
              isUser: item['role'] == 'user',
              createdAt: DateTime.now(),
            ));
          }
        });
        _scrollToBottom();
      }
    } catch (e) {
      debugPrint('Error loading history: $e');
    } finally {
      if (mounted) setState(() => _loadingHistory = false);
    }
  }

  Future<void> _loadSessions() async {
    try {
      final sessions = await ApiService.instance.fetchChatSessions();
      if (mounted) {
        setState(() => _sessions = sessions);
      }
    } catch (e) {
      debugPrint('Error loading sessions: $e');
    }
  }

  Widget _buildDrawer() {
    final primary = Theme.of(context).primaryColor;
    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [primary, primary.withValues(alpha: 0.7)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.chat_bubble_outline, color: Colors.white, size: 32),
                  const SizedBox(height: 12),
                  const Text('Lịch sử Chat', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('${_sessions.length} cuộc hội thoại', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13)),
                ],
              ),
            ),
            Expanded(
              child: _sessions.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('Chưa có cuộc hội thoại nào.\nHãy bắt đầu hỏi AI!', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: _sessions.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final session = _sessions[index];
                        final sessionId = session['session_id'] ?? '';
                        final sessionName = session['session_name'] ?? 'Cuộc hội thoại';
                        final lastMsg = session['last_message'] ?? '';
                        final msgCount = session['msg_count'] ?? 0;
                        final isGlobal = sessionId == 'GLOBAL';
                        final isCurrentSession = (widget.invoiceId == sessionId) ||
                            (widget.invoiceId == null && isGlobal);

                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: isGlobal
                                ? primary.withValues(alpha: 0.15)
                                : Colors.orange.withValues(alpha: 0.15),
                            child: Icon(
                              isGlobal ? Icons.public : Icons.receipt_long,
                              color: isGlobal ? primary : Colors.orange,
                              size: 20,
                            ),
                          ),
                          title: Text(
                            sessionName,
                            style: TextStyle(
                              fontWeight: isCurrentSession ? FontWeight.bold : FontWeight.w500,
                              fontSize: 14,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            lastMsg,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                          trailing: isCurrentSession
                              ? Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: primary.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text('Hiện tại', style: TextStyle(fontSize: 10, color: primary, fontWeight: FontWeight.bold)),
                                )
                              : Text('$msgCount tin', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                          onTap: () {
                            Navigator.of(context).pop(); // close drawer
                            if (!isCurrentSession) {
                              // Navigate to the selected session
                              Navigator.of(context).pushReplacement(
                                MaterialPageRoute(
                                  builder: (_) => ChatScreen(
                                    invoiceId: isGlobal ? null : sessionId,
                                    onSendQuestion: widget.onSendQuestion,
                                    onSelectInvoice: widget.onSelectInvoice,
                                    onReportBug: widget.onReportBug,
                                  ),
                                ),
                              );
                            }
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send([String? preset]) async {
    final question = (preset ?? _controller.text).trim();
    if (question.isEmpty || _sending) return;

    setState(() {
      _messages.add(ChatMessageViewData(text: question, isUser: true, createdAt: DateTime.now()));
      _controller.clear();
      _sending = true;
      _error = null;
    });
    _scrollToBottom();

    try {
      final answer = await widget.onSendQuestion(question);
      if (!mounted) return;
      setState(() {
        _messages.add(ChatMessageViewData(text: answer, isUser: false, createdAt: DateTime.now()));
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _sending = false);
        _scrollToBottom();
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Removed entry screen, show chat screen directly
    return _buildChatScreen();
  }

  Widget _buildEntryScreen() {
    final primary = Theme.of(context).primaryColor;
    return Scaffold(
      backgroundColor: const Color(0xFFF9F9FB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text('Trợ lý Invoice AI', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)], // Purple to Indigo
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('TRỢ LÝ HÓA ĐƠN', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text('Xin chào, Minh Anh', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('Bạn muốn hỏi về hóa đơn hay cần hỗ trợ xử lý lỗi?', style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 14)),
                ],
              ),
            ),
            const SizedBox(height: 24),
            _buildEntryCard(
              icon: Icons.chat_bubble_outline,
              iconColor: primary,
              title: 'Hỏi về hóa đơn',
              subtitle: 'Chọn một hóa đơn trước khi bắt đầu hỏi đáp.',
              onTap: widget.onSelectInvoice,
            ),
            const SizedBox(height: 16),
            _buildEntryCard(
              icon: Icons.help_outline,
              iconColor: Colors.deepOrange,
              title: 'Báo cáo / Hỗ trợ',
              subtitle: 'Báo lỗi OCR, dữ liệu sai hoặc lỗi ứng dụng.',
              onTap: () {
                if (widget.onReportBug != null) widget.onReportBug!(null);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEntryCard({required IconData icon, required Color iconColor, required String title, required String subtitle, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: iconColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
              child: Icon(icon, color: iconColor),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.grey),
          ],
        ),
      ),
    );
  }

  Widget _buildChatScreen() {
    final primary = Theme.of(context).primaryColor;
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFF9F9FB),
      endDrawer: _buildDrawer(),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        centerTitle: true,
        title: const Text('Trợ lý Invoice AI', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.history, color: Colors.black54),
            tooltip: 'Lịch sử chat',
            onPressed: () {
              _loadSessions();
              _scaffoldKey.currentState?.openEndDrawer();
            },
          ),
          IconButton(
            icon: const Icon(Icons.report_problem_outlined, color: Colors.red),
            onPressed: () {
              if (widget.onReportBug != null) widget.onReportBug!(widget.invoiceId);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Context Header
          if (widget.onSelectInvoice != null || widget.invoiceContext != null)
            Container(
              padding: const EdgeInsets.all(12),
              color: primary.withValues(alpha: 0.05),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long, color: Colors.grey, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.invoiceContext != null
                          ? 'Đang hỏi về: ${widget.invoiceContext!.storeName} (${widget.invoiceContext!.dateLabel})'
                          : 'Vui lòng chọn hóa đơn để hỏi',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (widget.onSelectInvoice != null)
                    GestureDetector(
                      onTap: widget.onSelectInvoice,
                      child: Text(
                        widget.invoiceContext != null ? 'Đổi' : 'Chọn ngay',
                        style: TextStyle(color: primary, fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
          
          Expanded(
            child: _loadingHistory
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      return ChatBubble(message: msg);
                    },
                  ),
          ),
          
          if (_sending)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('AI đang suy nghĩ...', style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic)),
              ),
            ),
          
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text('Lỗi: $_error', style: const TextStyle(color: Colors.red)),
            ),

          if (_messages.isEmpty && widget.suggestions.isNotEmpty && !_loadingHistory)
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: widget.suggestions.map((s) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    label: Text(s),
                    onPressed: () => _send(s),
                    backgroundColor: Colors.white,
                    side: BorderSide(color: Colors.grey.shade300),
                  ),
                )).toList(),
              ),
            ),

          // Input field
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, -5))],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: InputDecoration(
                      hintText: 'Nhập câu hỏi...',
                      hintStyle: TextStyle(color: Colors.grey.shade400),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                      filled: true,
                      fillColor: const Color(0xFFF0F2F5),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  decoration: BoxDecoration(color: primary, shape: BoxShape.circle),
                  child: IconButton(
                    icon: const Icon(Icons.send, color: Colors.white, size: 20),
                    onPressed: _send,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
