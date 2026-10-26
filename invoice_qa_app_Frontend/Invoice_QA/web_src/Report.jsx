import { useState } from 'react';
import { submitReport } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Report() {
  const [reportData, setReportData] = useState({
    issue_type: 'Thông tin nhận diện sai',
    description: '',
    invoice_id: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportData.description.trim()) {
      alert('Vui lòng nhập mô tả lỗi.');
      return;
    }

    setLoading(true);
    try {
      await submitReport({
        invoice_id: reportData.invoice_id ? parseInt(reportData.invoice_id) : null,
        issue_type: reportData.issue_type,
        description: reportData.description
      });
      alert('Đã gửi báo cáo thành công! Cảm ơn bạn đã phản hồi.');
      setReportData({ ...reportData, description: '' });
      navigate(-1);
    } catch (err) {
      alert('Lỗi khi gửi báo cáo. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="breadcrumb" style={{ marginBottom: '24px' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Tổng quan</a> <span>›</span> <span className="current">Trợ lý Invoice AI</span>
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '32px' }}>Báo cáo / Hỗ trợ</h2>

      <div className="report-form">
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>Loại lỗi</label>
            <select 
              className="form-select" 
              value={reportData.issue_type}
              onChange={(e) => setReportData({...reportData, issue_type: e.target.value})}
            >
              <option value="Thông tin nhận diện sai">Thông tin nhận diện sai</option>
              <option value="Lỗi tính toán">Lỗi tính toán tổng tiền</option>
              <option value="Lỗi tải ảnh">Không thể tải ảnh hóa đơn lên</option>
              <option value="Khác">Lý do khác</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '32px' }}>
            <label>Mô tả lỗi</label>
            <textarea 
              className="form-textarea"
              placeholder="Nhập chi tiết về lỗi bạn gặp phải..."
              value={reportData.description}
              onChange={(e) => setReportData({...reportData, description: e.target.value})}
              required
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              type="button" 
              className="btn btn-ghost" 
              style={{ padding: '8px 16px', color: 'var(--primary)', fontWeight: '500' }}
              onClick={() => navigate(-1)}
            >
              ← Quay lại
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }} disabled={loading}>
              ➤ {loading ? 'Đang gửi...' : 'Gửi báo cáo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
