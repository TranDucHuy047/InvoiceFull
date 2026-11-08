import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createReport } from '../services/api';
import {
  Flag,
  Receipt,
  Send,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';

const REPORT_REASONS = [
  'Sai thông tin cửa hàng',
  'Sai ngày giờ hóa đơn',
  'Sai tổng tiền thanh toán',
  'Thiếu hoặc sai tên sản phẩm',
  'Lỗi giao diện ứng dụng',
  'Khác',
];

const FAQ_ITEMS = [
  {
    q: 'Vì sao hóa đơn quét xong bị sai tên mặt hàng hoặc số tiền?',
    a: 'Hoá đơn nhiệt bị mờ, nhăn hoặc chụp thiếu sáng có thể khiến OCR đọc nhầm ký tự. Bạn có thể chỉnh sửa trực tiếp ở Bước 2 sau khi quét hoặc gửi báo cáo kèm Mã hóa đơn để đội ngũ huấn luyện lại mô hình AI.',
  },
  {
    q: 'Làm thế nào để lấy Mã hóa đơn (Invoice ID)?',
    a: 'Bạn mở trang Lịch sử hóa đơn, bấm vào hóa đơn cần kiểm tra hoặc nhìn góc dưới bên trái thẻ hóa đơn (ví dụ: #INV_EF767548).',
  },
  {
    q: 'Thời gian phản hồi yêu cầu hỗ trợ là bao lâu?',
    a: 'Mọi báo cáo lỗi được chuyển trực tiếp tới Bảng điều khiển Quản trị viên (Admin Portal) và xử lý trong vòng 24 giờ làm việc.',
  },
];

export default function Report() {
  const location = useLocation();
  const passedInvoice = location.state || {};

  const [invoiceId, setInvoiceId] = useState(passedInvoice.invoiceId || '');
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!details.trim()) {
      showToast('Vui lòng nhập mô tả chi tiết về lỗi gặp phải', 'error');
      return;
    }

    setLoading(true);
    try {
      await createReport(invoiceId || 'N/A', reason, details);
      showToast('Đã gửi báo cáo thành công! Cảm ơn phản hồi của bạn.');
      setDetails('');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Không thể gửi báo cáo', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-page">
      {toast && (
        <div className={`toast ${toast.type}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} strokeWidth={1.75} />
          ) : (
            <AlertTriangle size={16} strokeWidth={1.75} />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
          Báo cáo lỗi &amp; Hỗ trợ kỹ thuật
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Gửi phản hồi về kết quả nhận diện OCR/AI hoặc sự cố hệ thống để chúng tôi khắc phục nhanh nhất
        </p>
      </div>

      {/* 2-Column Layout: Left = Report Form, Right = FAQ & Support Guide */}
      <div className="report-grid-2col">
        {/* LEFT COLUMN: Report Submission Form */}
        <div className="report-card-box">
          <div className="profile-card-section-head">
            <Flag size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
            <h4>Gửi phiếu báo cáo sự cố</h4>
          </div>

          {passedInvoice.storeName && (
            <div className="report-invoice-info">
              <span className="report-inv-icon" style={{ display: 'inline-flex' }}>
                <Receipt size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h4>Hóa đơn đính kèm: {passedInvoice.storeName}</h4>
                <p>Mã chứng từ: {passedInvoice.invoiceId}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!passedInvoice.invoiceId && (
              <div className="form-group">
                <label>Mã hóa đơn liên quan (Tùy chọn)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nhập mã hóa đơn nếu có (VD: INV_EF767548)"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Phân loại sự cố *</label>
              <select
                className="form-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Mô tả chi tiết lỗi gặp phải *</label>
              <textarea
                className="form-textarea"
                placeholder="Vui lòng mô tả chi tiết điểm chưa chính xác (ví dụ: Tổng tiền trên ảnh là 236.700đ nhưng hệ thống nhận diện thiếu dòng sản phẩm...)"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={5}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ padding: '13px' }}
            >
              <Send size={16} strokeWidth={1.75} />
              {loading ? 'Đang gửi báo cáo...' : 'Gửi báo cáo hỗ trợ'}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: FAQ & Support SLA Card */}
        <div className="report-right-stack">
          <div className="report-card-box">
            <div className="profile-card-section-head">
              <HelpCircle size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
              <h4>Hướng dẫn &amp; Câu hỏi thường gặp (FAQ)</h4>
            </div>

            <div className="report-faq-list">
              {FAQ_ITEMS.map((item, idx) => (
                <div key={idx} className="report-faq-item">
                  <h5>{item.q}</h5>
                  <p>{item.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="report-card-box report-sla-card">
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div className="report-sla-icon">
                <ShieldCheck size={20} strokeWidth={1.75} />
              </div>
              <div>
                <h4 style={{ fontSize: '14.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Cam kết bảo mật &amp; cải thiện chất lượng AI
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Phản hồi của bạn giúp bộ chuẩn hóa dữ liệu Invoice AI ngày càng chính xác hơn với mọi định dạng hóa đơn bán lẻ và siêu thị tại Việt Nam.
                </p>
                <div className="report-sla-badges">
                  <span><Clock size={13} strokeWidth={1.75} /> Phản hồi trong 24h</span>
                  <span><MessageSquare size={13} strokeWidth={1.75} /> Hỗ trợ trực tiếp Admin</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
