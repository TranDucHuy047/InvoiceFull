import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  askQuestion,
  getInvoices,
  getInvoiceDetail,
  getChatHistory,
  getChatSessions,
  deleteChatSession,
  deleteAllChatHistory,
} from '../services/api';
import {
  Sparkles,
  Bot,
  User,
  Send,
  History,
  Plus,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Receipt,
  Store,
  Calendar,
  Wallet,
  Percent,
  ExternalLink,
  Globe,
  FileText,
  Lightbulb,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';

export default function AIChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const passedInvoiceId = location.state?.invoiceId;
  const passedStoreName = location.state?.storeName;

  const [invoices, setInvoices] = useState([]);
  const [currentInvoiceId, setCurrentInvoiceId] = useState(passedInvoiceId || '');
  const [currentStoreName, setCurrentStoreName] = useState(passedStoreName || '');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [imgZoom, setImgZoom] = useState(1);
  const [imgError, setImgError] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }

  const buildWelcomeMessage = (invId, storeName) => ({
    role: 'ai',
    content: invId
      ? `Xin chào! Tôi là **Trợ lý AI Phân Tích Hóa Đơn**.\n\nBạn đang tra cứu hóa đơn của **${storeName || invId}**. Bạn muốn kiểm tra mặt hàng, thuế GTGT, mã số thuế hay tổng tiền trên chứng từ này?`
      : 'Xin chào! Tôi là **Trợ lý AI Quản Lý Chi Tiêu**.\n\nBạn có thể chọn một hóa đơn ở cột bên trái để đối chiếu ảnh chứng từ gốc, hoặc đặt câu hỏi tổng hợp về toàn bộ lịch sử chi tiêu của bạn.',
  });

  const [messages, setMessages] = useState([
    buildWelcomeMessage(passedInvoiceId, passedStoreName),
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  useEffect(() => {
    getInvoices({ limit: 100 })
      .then((res) => {
        const list = res.data?.data || res.data || [];
        setInvoices(list);
        if (passedInvoiceId && !passedStoreName) {
          const found = list.find((i) => i.invoice_id === passedInvoiceId);
          if (found) setCurrentStoreName(found.store_name || '');
        }
      })
      .catch(() => { });

    fetchSessions();
  }, []);

  useEffect(() => {
    const found = invoices.find((i) => i.invoice_id === currentInvoiceId);
    const sName = found ? found.store_name : currentStoreName;
    fetchHistoryForScope(currentInvoiceId, sName);
  }, [currentInvoiceId]);

  // Load detailed metadata (tax_amount, items, image_path) whenever currentInvoiceId changes
  useEffect(() => {
    setImgZoom(1);
    setImgError(false);
    if (!currentInvoiceId) {
      setSelectedDetail(null);
      return;
    }
    const summaryInv = invoices.find((i) => i.invoice_id === currentInvoiceId) || null;
    setSelectedDetail(summaryInv);

    getInvoiceDetail(currentInvoiceId)
      .then((res) => {
        const d = res.data?.data || res.data;
        if (d) setSelectedDetail((prev) => ({ ...prev, ...d }));
      })
      .catch(() => { });
  }, [currentInvoiceId, invoices]);

  const fetchSessions = async () => {
    setHistoryLoading(true);
    try {
      const res = await getChatSessions();
      const fetchedSessions = res.data?.data || res.data?.sessions || [];
      setSessions(fetchedSessions);
    } catch (err) {
      console.error('Lỗi tải danh sách phiên chat:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchHistoryForScope = async (invId, storeName = '') => {
    try {
      const targetSession = invId || 'GLOBAL';
      const res = await getChatHistory(targetSession);
      const historyList = res.data?.data || [];
      if (Array.isArray(historyList) && historyList.length > 0) {
        setMessages([buildWelcomeMessage(invId, storeName), ...historyList]);
      } else {
        setMessages([buildWelcomeMessage(invId, storeName)]);
      }
    } catch (err) {
      setMessages([buildWelcomeMessage(invId, storeName)]);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleInvoiceChange = (e) => {
    const selectedId = e.target.value;
    const found = invoices.find((inv) => inv.invoice_id === selectedId);
    const sName = found ? found.store_name : '';
    setCurrentStoreName(sName);
    setCurrentInvoiceId(selectedId);
  };

  const handleSelectSession = (session) => {
    const sessId = session.session_id || session.scope_key || 'GLOBAL';
    const isGlobal = sessId === 'GLOBAL' || sessId === '__global__';
    const targetInvId = isGlobal ? '' : sessId;
    const found = invoices.find((inv) => inv.invoice_id === targetInvId);
    const sName = found ? found.store_name : session.store_name || '';
    setCurrentStoreName(sName);
    setCurrentInvoiceId(targetInvId);
    if (targetInvId === currentInvoiceId) {
      fetchHistoryForScope(targetInvId, sName);
    }
    setShowHistoryDrawer(false);
  };

  const handleStartNewChat = () => {
    if (messages.length <= 1) {
      setMessages([buildWelcomeMessage(currentInvoiceId, currentStoreName)]);
      showToast('Đã làm mới cuộc trò chuyện');
      return;
    }
    setConfirmModal({
      title: 'Xác nhận làm mới hội thoại',
      message: 'Bạn có chắc chắn muốn xóa phiên trò chuyện hiện tại để bắt đầu lại không?',
      onConfirm: async () => {
        const targetSession = currentInvoiceId || 'GLOBAL';
        try {
          await deleteChatSession(targetSession);
          setSessions((prev) =>
            prev.filter((s) => (s.session_id || s.scope_key) !== targetSession)
          );
        } catch (err) {
          console.error(err);
        }
        setMessages([buildWelcomeMessage(currentInvoiceId, currentStoreName)]);
        setConfirmModal(null);
        showToast('Đã làm mới cuộc trò chuyện');
      },
    });
  };

  const handleDeleteSession = (e, sessId) => {
    e.stopPropagation();
    setConfirmModal({
      title: 'Xác nhận xóa phiên chat',
      message: 'Bạn có chắc chắn muốn xóa phiên trò chuyện này khỏi lịch sử?',
      onConfirm: async () => {
        try {
          await deleteChatSession(sessId);
          setSessions((prev) =>
            prev.filter((s) => (s.session_id || s.scope_key) !== sessId)
          );
          const activeKey = currentInvoiceId || 'GLOBAL';
          if (sessId === activeKey) {
            setMessages([buildWelcomeMessage(currentInvoiceId, currentStoreName)]);
          }
          showToast('Đã xóa phiên trò chuyện');
        } catch (err) {
          console.error('Lỗi xóa phiên chat:', err);
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  const handleClearAllHistory = () => {
    setConfirmModal({
      title: 'Xác nhận xóa toàn bộ lịch sử',
      message: 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện AI? Hành động này không thể hoàn tác.',
      onConfirm: async () => {
        try {
          await deleteAllChatHistory();
          setSessions([]);
          setMessages([buildWelcomeMessage(currentInvoiceId, currentStoreName)]);
          setShowHistoryDrawer(false);
          showToast('Đã xóa toàn bộ lịch sử trò chuyện');
        } catch (err) {
          console.error('Lỗi xóa toàn bộ lịch sử:', err);
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  const sendQuestion = async (questionText) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await askQuestion(currentInvoiceId || null, trimmed);
      const answer =
        res.data?.data?.answer ||
        res.data?.answer ||
        res.data?.message ||
        'Đã xử lý câu hỏi nhưng không có phản hồi chi tiết.';
      setMessages((prev) => [...prev, { role: 'ai', content: answer }]);
      fetchSessions();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errMsg =
        typeof detail === 'string'
          ? detail
          : 'Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra lại kết nối Backend.';
      setMessages((prev) => [...prev, { role: 'ai', content: errMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuestion(input);
  };

  const getImageUrl = (imagePath, invoiceId) => {
    const resolvedPath = imagePath || (invoiceId ? `uploads/${invoiceId}.jpg` : null);
    if (!resolvedPath) return null;
    if (
      resolvedPath.startsWith('http://') ||
      resolvedPath.startsWith('https://') ||
      resolvedPath.startsWith('data:')
    ) {
      return resolvedPath;
    }
    const cleanPath = String(resolvedPath).replace(/\\/g, '/').replace(/^\/+/, '');
    const host = window.location.hostname || 'localhost';
    return `http://${host}:8000/${cleanPath}`;
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '0 đ';
    return Number(val).toLocaleString('vi-VN') + ' đ';
  };

  const isSelectedDocForm =
    selectedDetail?.invoice_type === 'Document/Form' ||
    (currentInvoiceId &&
      Number(selectedDetail?.total_amount || 0) === 0 &&
      Array.isArray(selectedDetail?.items) &&
      selectedDetail.items.length > 0 &&
      selectedDetail.items.every((it) => Number(it.total_price || 0) === 0));

  const quickQuestions = currentInvoiceId
    ? isSelectedDocForm
      ? [
          'Tài liệu này có những thông tin chính nào?',
          'Người đăng ký / Người thực hiện trong tài liệu tên là gì?',
          'Ngày tháng được ghi trong tài liệu là ngày nào?',
          'Địa chỉ hoặc đơn vị/nguồn trong tài liệu là gì?',
          'Trong biểu mẫu có những mục nào được đánh dấu chọn (X)?',
        ]
      : [
          'Tổng thanh toán của hóa đơn này là bao nhiêu?',
          'Hóa đơn gồm những sản phẩm nào?',
          'Tiền thuế GTGT (VAT) là bao nhiêu?',
          'Mã số thuế và địa chỉ đơn vị bán hàng?',
          'Mặt hàng nào có giá trị cao nhất?',
        ]
    : [
        'Tổng chi tiêu của tôi là bao nhiêu?',
        'Tôi có bao nhiêu hóa đơn?',
        'Hóa đơn nào có giá trị cao nhất?',
        'Thống kê chi tiêu theo từng cửa hàng?',
      ];

  const receiptImgUrl = getImageUrl(selectedDetail?.image_path, selectedDetail?.invoice_id || currentInvoiceId);
  const totalSpendAll = invoices.reduce((acc, inv) => acc + (Number(inv.total_amount) || 0), 0);

  return (
    <div className="chat-layout-container ai-split-page">
      {/* Top Action Header */}
      <div className="chat-page-header">
        <div className="chat-header-left">
          <div className="ai-page-title-icon">
            <Sparkles size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Trợ lý Hỏi Đáp Hóa Đơn & Tài Liệu AI</span>
              <span className="chat-ai-live-badge">Trực tuyến</span>
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
              Đối chiếu trực tiếp chứng từ gốc (SROIE / FUNSD) và phân tích dữ liệu bằng trí tuệ nhân tạo
            </p>
          </div>
        </div>

        <div className="chat-header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleStartNewChat}
            title="Làm mới cuộc trò chuyện hiện tại"
          >
            <Plus size={16} strokeWidth={1.75} />
            Làm mới hội thoại
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm chat-history-btn"
            onClick={() => {
              fetchSessions();
              setShowHistoryDrawer(true);
            }}
          >
            <History size={16} strokeWidth={1.75} />
            Lịch sử chat
            {sessions.length > 0 && (
              <span className="chat-history-count-badge">{sessions.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Split-Screen 2-Column Container (40% Left / 60% Right) */}
      <div className="ai-split-grid">
        {/* LEFT COLUMN (40%): Visual Receipt Inspector */}
        <div className="ai-inspector-col">
          {/* 1. Scope / Invoice Selector */}
          <div className="ai-selector-box">
            <label className="ai-selector-label">
              <Receipt size={15} strokeWidth={1.75} />
              <span>Chứng từ cần tra cứu</span>
            </label>
            <select
              value={currentInvoiceId}
              onChange={handleInvoiceChange}
              className="chat-invoice-select"
              style={{ width: '100%' }}
            >
              <option value="">Tất cả hóa đơn ({invoices.length} chứng từ)</option>
              {invoices.map((inv) => (
                <option key={inv.invoice_id} value={inv.invoice_id}>
                  {inv.store_name || 'Cửa hàng'} — {inv.date || 'N/A'} (
                  {Number(inv.total_amount || 0).toLocaleString('vi-VN')} đ)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Original Receipt Image or Global Overview */}
          {currentInvoiceId && selectedDetail ? (
            <>
              <div className="ai-receipt-viewer-card">
                <div className="ai-viewer-toolbar">
                  <span className="ai-viewer-title">
                    <FileText size={15} strokeWidth={1.75} />
                    Ảnh chứng từ gốc
                  </span>
                  <div className="ai-viewer-controls">
                    <button
                      type="button"
                      className="ai-zoom-btn"
                      onClick={() => setImgZoom((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))}
                      title="Thu nhỏ"
                    >
                      <ZoomOut size={15} strokeWidth={1.75} />
                    </button>
                    <span className="ai-zoom-label">{Math.round(imgZoom * 100)}%</span>
                    <button
                      type="button"
                      className="ai-zoom-btn"
                      onClick={() => setImgZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                      title="Phóng to"
                    >
                      <ZoomIn size={15} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className="ai-zoom-btn"
                      onClick={() => setImgZoom(1)}
                      title="Đặt lại kích thước"
                    >
                      <RotateCcw size={14} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className="ai-zoom-btn"
                      onClick={() => navigate(`/history/${currentInvoiceId}`)}
                      title="Xem chi tiết hóa đơn"
                    >
                      <ExternalLink size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                <div className="ai-receipt-canvas">
                  {receiptImgUrl && !imgError ? (
                    <div
                      className="ai-receipt-img-scroll"
                      style={{
                        overflow: 'auto',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: imgZoom > 1 ? 'flex-start' : 'center',
                      }}
                    >
                      <img
                        src={receiptImgUrl}
                        alt={selectedDetail.store_name || 'Receipt'}
                        style={{
                          transform: `scale(${imgZoom})`,
                          transformOrigin: 'top center',
                          transition: 'transform 0.2s ease',
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          borderRadius: '8px',
                        }}
                        onError={() => setImgError(true)}
                      />
                    </div>
                  ) : (
                    <div className="ai-receipt-fallback">
                      <Receipt size={32} strokeWidth={1.5} style={{ color: 'var(--primary)', marginBottom: '8px' }} />
                      <p style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {selectedDetail.store_name || 'Hóa đơn điện tử'}
                      </p>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {selectedDetail.raw_text
                          ? 'Đang sử dụng dữ liệu văn bản OCR đã bóc tách'
                          : 'Không có ảnh đính kèm'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Quick Metadata Summary Card */}
              <div className="ai-summary-card">
                <div className="ai-summary-header">
                  <h4>
                    {isSelectedDocForm
                      ? 'Tóm tắt thông tin tài liệu / biểu mẫu'
                      : 'Tóm tắt thông tin hóa đơn'}
                  </h4>
                  <span className="ai-summary-id">#{currentInvoiceId.slice(-8)}</span>
                </div>
                <div className="ai-summary-grid">
                  <div className="ai-summary-item">
                    <span className="ai-sum-label">
                      <Store size={14} strokeWidth={1.75} />{' '}
                      {isSelectedDocForm ? 'Tiêu đề tài liệu' : 'Cửa hàng'}
                    </span>
                    <strong className="ai-sum-val" title={selectedDetail.store_name}>
                      {selectedDetail.store_name || 'Chưa xác định'}
                    </strong>
                  </div>
                  <div className="ai-summary-item">
                    <span className="ai-sum-label">
                      <Calendar size={14} strokeWidth={1.75} />{' '}
                      {isSelectedDocForm ? 'Ngày tài liệu' : 'Ngày xuất'}
                    </span>
                    <strong className="ai-sum-val">{selectedDetail.date || 'Chưa rõ'}</strong>
                  </div>
                  <div className="ai-summary-item">
                    <span className="ai-sum-label">
                      <Wallet size={14} strokeWidth={1.75} />{' '}
                      {isSelectedDocForm ? 'Phân loại' : 'Tổng tiền'}
                    </span>
                    <strong className="ai-sum-val highlight">
                      {isSelectedDocForm
                        ? 'Biểu mẫu (FUNSD)'
                        : formatCurrency(selectedDetail.total_amount)}
                    </strong>
                  </div>
                  <div className="ai-summary-item">
                    <span className="ai-sum-label">
                      <Percent size={14} strokeWidth={1.75} />{' '}
                      {isSelectedDocForm ? 'Số trường dữ liệu' : 'Thuế GTGT'}
                    </span>
                    <strong className="ai-sum-val">
                      {isSelectedDocForm
                        ? `${(selectedDetail.items || []).length} trường`
                        : selectedDetail.tax_amount
                        ? formatCurrency(selectedDetail.tax_amount)
                        : 'Đã gồm / 0 đ'}
                    </strong>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Global Scope Inspector Panel */
            <div className="ai-global-inspector-card">
              <div className="ai-global-badge">
                <Globe size={20} strokeWidth={1.75} />
                <div>
                  <h4>Chế độ tra cứu toàn bộ hóa đơn</h4>
                  <p>AI đang tổng hợp dữ liệu trên tất cả chứng từ của bạn</p>
                </div>
              </div>

              <div className="ai-global-stats">
                <div className="ai-g-stat">
                  <span>Tổng số chứng từ</span>
                  <strong>{invoices.length} hóa đơn</strong>
                </div>
                <div className="ai-g-stat">
                  <span>Tổng chi tiêu tích lũy</span>
                  <strong style={{ color: 'var(--primary)' }}>{formatCurrency(totalSpendAll)}</strong>
                </div>
              </div>

              <div className="ai-recent-pick-title">
                Chọn nhanh một hóa đơn để xem ảnh gốc &amp; hỏi chi tiết:
              </div>
              <div className="ai-recent-pick-list">
                {invoices.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Chưa có hóa đơn nào trong hệ thống.
                  </div>
                ) : (
                  invoices.slice(0, 6).map((inv) => (
                    <button
                      type="button"
                      key={inv.invoice_id}
                      className="ai-recent-pick-item"
                      onClick={() =>
                        handleInvoiceChange({ target: { value: inv.invoice_id } })
                      }
                    >
                      <div className="ai-pick-icon">
                        <Receipt size={16} strokeWidth={1.75} />
                      </div>
                      <div className="ai-pick-info">
                        <strong>{inv.store_name || 'Cửa hàng'}</strong>
                        <span>{inv.date || 'N/A'}</span>
                      </div>
                      <span className="ai-pick-amount">{formatCurrency(inv.total_amount)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (60%): Chat Conversation Window */}
        <div className="chat-window-card ai-chat-col">
          {/* Messages Area */}
          <div className="chat-messages-container">
            {messages.map((msg, i) => {
              const msgText = msg.content || msg.text || '';
              const isUser = msg.role === 'user';
              return (
                <div
                  key={i}
                  className={`chat-message-row ${isUser ? 'user-side' : 'ai-side'}`}
                >
                  <div className="chat-avatar-bubble">
                    {isUser ? (
                      <User size={18} strokeWidth={1.75} />
                    ) : (
                      <Bot size={18} strokeWidth={1.75} />
                    )}
                  </div>
                  <div className="chat-speech-bubble markdown-body">
                    {!isUser ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msgText}
                      </ReactMarkdown>
                    ) : (
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msgText}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="chat-message-row ai-side">
                <div className="chat-avatar-bubble ai-pulse">
                  <Bot size={18} strokeWidth={1.75} />
                </div>
                <div className="chat-speech-bubble typing-bubble">
                  <span className="chat-dot"></span>
                  <span className="chat-dot"></span>
                  <span className="chat-dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Pills (Wrapping cleanly, no ugly horizontal scrollbar) */}
          <div className="chat-quick-chips">
            <span className="chat-chips-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Lightbulb size={14} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
              Gợi ý:
            </span>
            <div className="chat-chips-wrap">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendQuestion(q)}
                  disabled={loading}
                  className="chat-chip-btn"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSubmit} className="chat-input-bar">
            <input
              type="text"
              className="chat-text-input"
              placeholder={
                currentInvoiceId
                  ? 'Nhập câu hỏi về hóa đơn này (mặt hàng, thuế, mã số thuế, số tiền...)...'
                  : 'Nhập câu hỏi của bạn (VD: Tổng chi tiêu tháng này là bao nhiêu?)...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className={`chat-send-btn ${input.trim() && !loading ? 'active' : ''}`}
              disabled={loading || !input.trim()}
              title="Gửi câu hỏi"
            >
              <Send size={17} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>

      {/* Slide-out Chat History Drawer */}
      {showHistoryDrawer && (
        <div
          className="chat-drawer-overlay"
          onClick={() => setShowHistoryDrawer(false)}
        >
          <div
            className="chat-drawer-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chat-drawer-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                  Lịch sử trò chuyện AI
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Chọn một phiên bên dưới để xem lại hoặc tiếp tục hội thoại
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowHistoryDrawer(false)}
                title="Đóng"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="chat-drawer-body">
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  Đang tải lịch sử...
                </div>
              ) : sessions.length === 0 ? (
                <div className="chat-drawer-empty">
                  <div style={{ display: 'inline-flex', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    <MessageSquare size={36} strokeWidth={1.5} />
                  </div>
                  <h4>Chưa có lịch sử trò chuyện</h4>
                  <p>Các câu hỏi và câu trả lời của bạn với AI sẽ tự động được lưu tại đây.</p>
                </div>
              ) : (
                <div className="chat-sessions-list">
                  {sessions.map((sess) => {
                    const sessKey = sess.session_id || sess.scope_key || 'GLOBAL';
                    const activeKey = currentInvoiceId ? currentInvoiceId : 'GLOBAL';
                    const isActive = sessKey === activeKey;
                    const isGlobal = sessKey === 'GLOBAL' || sessKey === '__global__';
                    const msgCount = sess.msg_count ?? (sess.messages || []).length;
                    const previewText = sess.last_message || 'Cuộc trò chuyện';

                    return (
                      <div
                        key={sessKey}
                        className={`chat-session-card ${isActive ? 'is-active' : ''}`}
                        onClick={() => handleSelectSession(sess)}
                      >
                        <div className="chat-sess-icon" style={{ color: 'var(--primary)' }}>
                          {isGlobal ? (
                            <Globe size={18} strokeWidth={1.75} />
                          ) : (
                            <Receipt size={18} strokeWidth={1.75} />
                          )}
                        </div>
                        <div className="chat-sess-info">
                          <div className="chat-sess-top">
                            <span className="chat-sess-name">
                              {sess.session_name || sess.store_name || (isGlobal ? 'Hỏi đáp Tổng quát' : sessKey)}
                            </span>
                            <span className="chat-sess-badge">{msgCount} tin</span>
                          </div>
                          <p className="chat-sess-preview">
                            {previewText}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="chat-sess-del-btn"
                          title="Xóa phiên này"
                          onClick={(e) => handleDeleteSession(e, sessKey)}
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {sessions.length > 0 && (
              <div className="chat-drawer-footer">
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  style={{ width: '100%' }}
                  onClick={handleClearAllHistory}
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                  Xóa toàn bộ lịch sử chat
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa phiên chat */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <AlertTriangle size={19} strokeWidth={1.75} />
                {confirmModal.title}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setConfirmModal(null)}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
              {confirmModal.message}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setConfirmModal(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmModal.onConfirm}
              >
                <Trash2 size={15} strokeWidth={1.75} />
                Chắc chắn muốn xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="chat-toast">
          <CheckCircle2 size={16} strokeWidth={1.75} />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
