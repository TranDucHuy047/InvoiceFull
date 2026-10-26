import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  getInvoices, 
  askQuestion, 
  getChatHistory, 
  getChatSessions, 
  deleteChatSession, 
  deleteAllChatHistory 
} from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

export default function AIChat() {
  const { lang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // If passed from invoice detail: location.state?.invoiceId, otherwise '' (Tất cả hóa đơn / Toàn bộ)
  const [currentInvoiceId, setCurrentInvoiceId] = useState(location.state?.invoiceId || '');
  const [invoices, setInvoices] = useState([]);
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // History Drawer & Session State
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { mode: 'current' | 'single' | 'all', id?: string, title?: string }
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (text) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Gợi ý câu hỏi thông minh theo phạm vi
  const globalPrompts = lang === 'vi' ? [
    'Tổng chi tiêu của tôi là bao nhiêu?',
    'Hóa đơn nào có số tiền lớn nhất?',
    'món đắt tiền nhất là món nào',
    'Tôi đã mua sắm ở những cửa hàng nào?'
  ] : [
    'What is my total spending across all invoices?',
    'Which invoice has the highest amount?',
    'Which item is the most expensive?',
    'Which stores did I shop at?'
  ];

  const singlePrompts = lang === 'vi' ? [
    'Tổng thanh toán của hóa đơn này là bao nhiêu?',
    'Hóa đơn gồm những sản phẩm nào?',
    'Tiền thuế VAT được tính ra sao?',
    'Cửa hàng này tên gì và địa chỉ ở đâu?'
  ] : [
    'What is the total payment amount?',
    'List all items in this invoice',
    'How much is the VAT tax?',
    'What is the store name and address?'
  ];

  const currentPrompts = currentInvoiceId ? singlePrompts : globalPrompts;

  useEffect(() => {
    fetchInvoices();
    fetchSessions();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [currentInvoiceId, lang]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchInvoices = async () => {
    try {
      const res = await getInvoices({ limit: 100 });
      setInvoices(res.data.data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await getChatSessions();
      setSessions(res.data?.data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  };

  const getDefaultGreeting = () => {
    return {
      role: 'ai',
      content: currentInvoiceId
        ? (lang === 'vi' 
            ? 'Hóa đơn đã sẵn sàng! Bạn có thể hỏi bất kỳ thông tin nào về mặt hàng, ngày tháng hoặc số tiền.' 
            : 'Invoice is ready! Ask me anything about items, dates, or totals.')
        : (lang === 'vi' 
            ? 'Xin chào! Bạn đang ở chế độ tra cứu TOÀN BỘ hóa đơn. Bạn có thể hỏi tổng chi tiêu, hóa đơn đắt nhất, số lượng hóa đơn, thống kê các quán,... Hãy nhập câu hỏi ở bên dưới!' 
            : 'Hello! You are querying across ALL invoices. You can ask for total spending, highest bill, recent stores, or summaries below!')
    };
  };

  const fetchHistory = async () => {
    try {
      const targetSession = currentInvoiceId || 'GLOBAL';
      const res = await getChatHistory(targetSession);
      const historyList = res.data?.data || [];
      
      if (historyList.length > 0) {
        setMessages([
          { 
            role: 'ai', 
            content: currentInvoiceId 
              ? (lang === 'vi' ? 'Đã tải dữ liệu hóa đơn này. Bạn cần tôi phân tích điều gì?' : 'Invoice loaded. What would you like to analyze?')
              : (lang === 'vi' ? 'Đã tải lịch sử hỏi đáp toàn bộ hóa đơn. Hãy đặt câu hỏi cho tôi!' : 'Global invoice query history loaded. Ask me anything!')
          },
          ...historyList
        ]);
      } else {
        setMessages([getDefaultGreeting()]);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      setMessages([getDefaultGreeting()]);
    }
  };

  const handleSendPrompt = (promptText) => {
    if (loading) return;
    executeMessage(promptText);
  };

  const executeMessage = async (msgText) => {
    if (!msgText.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: msgText }]);
    setInput('');
    setLoading(true);

    try {
      const res = await askQuestion(currentInvoiceId || '', msgText);
      const answer = res.data?.data?.answer || res.data?.answer || (lang === 'vi' ? 'Đã nhận được câu trả lời từ hệ thống.' : 'Response received.');
      setMessages(prev => [...prev, { role: 'ai', content: answer }]);
      // Refresh session list so preview and counts update
      fetchSessions();
    } catch (err) {
      console.error('QA Error:', err);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: lang === 'vi' ? 'Xin lỗi, đã xảy ra sự cố khi tra cứu câu hỏi của bạn. Vui lòng thử lại.' : 'Sorry, an error occurred while processing your query. Please try again.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    executeMessage(input.trim());
  };

  // Switch to session from drawer
  const handleSelectSession = (sessionId) => {
    const targetId = sessionId === 'GLOBAL' ? '' : sessionId;
    setCurrentInvoiceId(targetId);
    setShowHistoryDrawer(false);
  };

  // Handle single or current session delete
  const handleDeleteSession = async (targetId) => {
    try {
      await deleteChatSession(targetId);
      showToast(lang === 'vi' ? 'Đã xóa cuộc trò chuyện.' : 'Conversation deleted.');
      
      const currentTarget = currentInvoiceId || 'GLOBAL';
      if (currentTarget === targetId) {
        // If we deleted the active conversation, reset messages
        setMessages([getDefaultGreeting()]);
      }
      await fetchSessions();
    } catch (err) {
      console.error('Delete session error:', err);
      showToast(lang === 'vi' ? 'Lỗi khi xóa cuộc trò chuyện.' : 'Error deleting conversation.');
    }
  };

  // Handle delete all sessions
  const handleDeleteAllSessions = async () => {
    try {
      await deleteAllChatHistory();
      showToast(lang === 'vi' ? 'Đã xóa tất cả các cuộc trò chuyện.' : 'All chat history cleared.');
      setMessages([getDefaultGreeting()]);
      await fetchSessions();
    } catch (err) {
      console.error('Delete all error:', err);
      showToast(lang === 'vi' ? 'Lỗi khi xóa tất cả lịch sử.' : 'Error clearing chat history.');
    }
  };

  // Confirm delete modal execution
  const executeConfirmModal = async () => {
    if (!confirmModal) return;
    
    if (confirmModal.mode === 'all') {
      await handleDeleteAllSessions();
    } else if (confirmModal.mode === 'single' || confirmModal.mode === 'current') {
      await handleDeleteSession(confirmModal.id);
    }
    setConfirmModal(null);
  };

  const activeSessionKey = currentInvoiceId || 'GLOBAL';

  return (
    <div className="ai-helper-page chat-layout-container animate-fade-in">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="chat-toast animate-fade-in">
          <span>✓</span> <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="chat-page-header">
        <div className="chat-header-left">
          <button className="btn btn-icon" onClick={() => navigate(-1)} title="Quay lại">←</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="chat-ai-sparkle">✨</span>
            <h2 style={{ fontSize: '19px', margin: 0, fontWeight: '700' }}>
              {lang === 'vi' ? 'Trợ lý Invoice AI' : 'Invoice AI Assistant'}
            </h2>
            <span className="chat-ai-live-badge">{lang === 'vi' ? 'Sẵn sàng' : 'Active'}</span>
          </div>
        </div>

        <div className="chat-header-actions">
          {/* History Drawer Toggle Button */}
          <button 
            type="button" 
            className="btn btn-outline btn-sm chat-history-btn"
            onClick={() => {
              fetchSessions();
              setShowHistoryDrawer(true);
            }}
            title={lang === 'vi' ? 'Xem danh sách các cuộc trò chuyện đã lưu' : 'View chat history'}
          >
            📜 {lang === 'vi' ? 'Lịch sử trò chuyện' : 'Chat History'}
            {sessions.length > 0 && (
              <span className="chat-history-count-badge">{sessions.length}</span>
            )}
          </button>

          {/* New Chat Button */}
          <button 
            type="button" 
            className="btn btn-outline btn-sm"
            onClick={() => {
              setMessages([getDefaultGreeting()]);
              showToast(lang === 'vi' ? 'Đã bắt đầu cuộc trò chuyện mới.' : 'Started new chat.');
            }}
            title={lang === 'vi' ? 'Làm mới cuộc trò chuyện' : 'New chat'}
          >
            ➕ {lang === 'vi' ? 'Mới' : 'New'}
          </button>

          {/* Delete Current Chat Button */}
          <button 
            type="button" 
            className="btn btn-outline-danger btn-sm"
            onClick={() => {
              setConfirmModal({
                mode: 'current',
                id: activeSessionKey,
                title: currentInvoiceId 
                  ? (lang === 'vi' ? 'Xóa cuộc trò chuyện về hóa đơn này?' : 'Delete chat for this invoice?')
                  : (lang === 'vi' ? 'Xóa cuộc trò chuyện Hỏi đáp Tổng quát?' : 'Delete Global chat history?')
              });
            }}
            title={lang === 'vi' ? 'Xóa lịch sử cuộc trò chuyện hiện tại' : 'Delete this conversation'}
          >
            🗑️ {lang === 'vi' ? 'Xóa chat' : 'Clear'}
          </button>
        </div>
      </div>
      
      {/* Scope Selector Card */}
      <div className="chat-invoice-selector-card">
        <div className="chat-sel-label">
          <span>{currentInvoiceId ? '🧾' : '🌐'}</span>
          <span>{lang === 'vi' ? 'Phạm vi tra cứu:' : 'Query Scope:'}</span>
        </div>
        <select 
          value={currentInvoiceId} 
          onChange={(e) => setCurrentInvoiceId(e.target.value)}
          className="chat-invoice-select"
        >
          <option value="">
            {lang === 'vi' ? '🌐 -- Tất cả hóa đơn (Hỏi đáp tổng quan) --' : '🌐 -- All Invoices (Global Overview) --'}
          </option>
          {invoices.map(inv => (
            <option key={inv.invoice_id} value={inv.invoice_id}>
              🧾 {inv.store_name || 'Không rõ'} - {inv.date || ''} ({new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(inv.total_amount || 0)})
            </option>
          ))}
        </select>
      </div>

      {/* Main Chat Area */}
      <div className="chat-window-card">
        <div className="chat-messages-container">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`chat-message-row ${msg.role === 'user' ? 'user-side' : 'ai-side'}`}
            >
              <div className="chat-avatar-bubble">
                {msg.role === 'user' ? '👤' : '✨'}
              </div>
              <div className="chat-speech-bubble">
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-message-row ai-side">
              <div className="chat-avatar-bubble ai-pulse">✨</div>
              <div className="chat-speech-bubble typing-bubble">
                <span className="chat-dot"></span>
                <span className="chat-dot"></span>
                <span className="chat-dot"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="chat-quick-chips">
          <span className="chat-chips-label">💡 {lang === 'vi' ? 'Gợi ý:' : 'Quick ask:'}</span>
          <div className="chat-chips-scroll">
            {currentPrompts.map((prompt, pIdx) => (
              <button
                key={pIdx}
                type="button"
                className="chat-chip-btn"
                onClick={() => handleSendPrompt(prompt)}
                disabled={loading}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
        
        {/* Chat Input Bar */}
        <form onSubmit={handleSend} className="chat-input-bar">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            placeholder={currentInvoiceId 
              ? (lang === 'vi' ? 'Nhập câu hỏi về hóa đơn này (mặt hàng, ngày tháng, số tiền...)...' : 'Ask anything about this invoice (items, dates, amount...)...') 
              : (lang === 'vi' ? 'Hỏi bất kỳ điều gì trên toàn bộ hóa đơn (VD: Tổng chi tiêu, món đắt nhất...)...' : 'Ask anything across all invoices (e.g., total spending, highest bill...)...')}
            className="chat-text-input"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || loading}
            className={`chat-send-btn ${input.trim() && !loading ? 'active' : ''}`}
            title={lang === 'vi' ? 'Gửi câu hỏi' : 'Send'}
          >
            ➤
          </button>
        </form>
      </div>

      {/* History Sessions Drawer (Offcanvas Slide-over) */}
      {showHistoryDrawer && (
        <div className="chat-drawer-overlay animate-fade-in" onClick={() => setShowHistoryDrawer(false)}>
          <div className="chat-drawer-panel" onClick={e => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="chat-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📜</span>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>
                  {lang === 'vi' ? 'Lịch sử cuộc trò chuyện' : 'Chat History'}
                </h3>
              </div>
              <button 
                type="button" 
                className="btn btn-icon btn-sm"
                onClick={() => setShowHistoryDrawer(false)}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body: Sessions List */}
            <div className="chat-drawer-body">
              {sessionsLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  ⏳ {lang === 'vi' ? 'Đang tải lịch sử...' : 'Loading sessions...'}
                </div>
              ) : sessions.length > 0 ? (
                <div className="chat-sessions-list">
                  {sessions.map((sess) => {
                    const isActive = activeSessionKey === sess.session_id;
                    const isGlobal = sess.session_id === 'GLOBAL';
                    return (
                      <div 
                        key={sess.session_id} 
                        className={`chat-session-card ${isActive ? 'is-active' : ''}`}
                        onClick={() => handleSelectSession(sess.session_id)}
                      >
                        <div className="chat-sess-icon">
                          {isGlobal ? '🌐' : '🧾'}
                        </div>
                        <div className="chat-sess-info">
                          <div className="chat-sess-top">
                            <span className="chat-sess-name">
                              {sess.session_name || (isGlobal ? 'Hỏi đáp Tổng quát' : sess.session_id)}
                            </span>
                            <span className="chat-sess-badge">
                              {sess.msg_count} {lang === 'vi' ? 'tin nhắn' : 'msgs'}
                            </span>
                          </div>
                          <p className="chat-sess-preview">
                            {sess.last_message ? sess.last_message.substring(0, 75) + '...' : 'Trò chuyện...'}
                          </p>
                        </div>

                        {/* Delete Session Button */}
                        <button 
                          type="button" 
                          className="chat-sess-del-btn"
                          title={lang === 'vi' ? 'Xóa cuộc trò chuyện này' : 'Delete conversation'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmModal({
                              mode: 'single',
                              id: sess.session_id,
                              title: lang === 'vi' 
                                ? `Xóa cuộc trò chuyện '${sess.session_name}'?` 
                                : `Delete '${sess.session_name}'?`
                            });
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="chat-drawer-empty">
                  <span style={{ fontSize: '36px' }}>💬</span>
                  <h4>{lang === 'vi' ? 'Chưa có lịch sử trò chuyện' : 'No chat history'}</h4>
                  <p>{lang === 'vi' ? 'Các câu hỏi và câu trả lời của bạn sẽ được lưu tại đây.' : 'Your chat sessions will appear here.'}</p>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            {sessions.length > 0 && (
              <div className="chat-drawer-footer">
                <button 
                  type="button" 
                  className="btn btn-outline-danger btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    setConfirmModal({
                      mode: 'all',
                      title: lang === 'vi' 
                        ? 'Xóa toàn bộ lịch sử tất cả các cuộc trò chuyện?' 
                        : 'Delete all chat history?'
                    });
                  }}
                >
                  🔥 {lang === 'vi' ? 'Xóa tất cả lịch sử chat' : 'Clear All Chat History'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay animate-fade-in" onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>⚠️</div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px' }}>
              {confirmModal.title}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.5', marginBottom: '22px' }}>
              {lang === 'vi' 
                ? 'Hành động này sẽ xóa toàn bộ tin nhắn trong cuộc trò chuyện và không thể hoàn tác. Bạn có chắc chắn muốn xóa?' 
                : 'This action will delete all messages in this conversation and cannot be undone. Are you sure?'}
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setConfirmModal(null)}
              >
                {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                style={{ background: '#DC2626', color: '#FFFFFF', padding: '8px 18px' }}
                onClick={executeConfirmModal}
              >
                {lang === 'vi' ? 'Xác nhận xóa' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
