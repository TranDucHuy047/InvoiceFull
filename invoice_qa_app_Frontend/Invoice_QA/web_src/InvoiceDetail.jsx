import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getInvoiceDetail, deleteInvoice } from '../services/api';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('Ảnh/hóa đơn bị trùng');

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const res = await getInvoiceDetail(id);
      const invData = Array.isArray(res.data?.data) ? res.data.data[0] : (res.data?.data || res.data);
      if (invData) {
        setInvoice(invData);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể tải chi tiết hóa đơn.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteInvoice(id);
      alert('Đã chuyển hóa đơn vào thùng rác.');
      navigate('/history');
    } catch (err) {
      alert('Lỗi khi xóa hóa đơn.');
    }
  };

  if (loading) {
    return <div className="loading-overlay"><div className="spinner"></div></div>;
  }

  if (!invoice) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📂</div>
        <h3>Không tìm thấy hóa đơn</h3>
        <button className="btn btn-primary" onClick={() => navigate('/history')}>Quay lại</button>
      </div>
    );
  }

  const products = invoice.items || [];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="breadcrumb">
        <Link to="/history">Lịch sử hóa đơn</Link> <span>›</span> <span className="current">Chi tiết hóa đơn</span>
      </div>

      <div className="result-section">
        <h3>Thông tin chung</h3>
        <table className="result-table">
          <tbody>
            <tr>
              <td>Cửa hàng</td>
              <td>{invoice.store_name}</td>
            </tr>
            <tr>
              <td>Địa chỉ</td>
              <td>{invoice.store_address}</td>
            </tr>
            <tr>
              <td>Ngày</td>
              <td>{invoice.date}</td>
            </tr>
            <tr>
              <td>VAT</td>
              <td>{invoice.tax_amount ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoice.tax_amount) : '0đ'}</td>
            </tr>
            <tr className="total-row">
              <td>Tổng thanh toán</td>
              <td>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoice.total_amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="result-section">
        <h3>Sản phẩm ({products.length})</h3>
        <table className="products-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => (
              <tr key={idx}>
                <td>{p.item_name}</td>
                <td>{p.quantity}</td>
                <td>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.unit_price)}</td>
                <td>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ai-ask-banner" onClick={() => navigate('/ai-chat', { state: { invoiceId: id } })}>
        <div className="ai-ask-icon">✨</div>
        <div>
          <h4>Hỏi AI về hóa đơn này</h4>
          <p>Hỏi nhanh về {invoice.store_name}.</p>
        </div>
        <div className="ai-ask-arrow">›</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>
          ← Quay lại
        </button>
        <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setShowDeleteModal(true)}>
          🗑️ Xóa hóa đơn
        </button>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Xóa hóa đơn?</h3>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Hóa đơn sẽ được chuyển vào Lịch sử xóa và tự dọn sau 30 ngày.
            </p>
            <div className="modal-section">
              <label>Lý do xóa</label>
              <select className="form-select" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
                <option>Ảnh/hóa đơn bị trùng</option>
                <option>Thông tin sai lệch</option>
                <option>Không cần thiết nữa</option>
                <option>Lý do khác</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)}>Hủy</button>
              <button className="btn btn-danger" onClick={handleDelete}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
