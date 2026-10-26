import { useState, useEffect } from 'react';
import { getTrash, restoreInvoice, permanentDeleteInvoice } from '../services/api';

export default function Trash() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(null);

  useEffect(() => {
    fetchTrash();
  }, []);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const res = await getTrash();
      setInvoices(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreInvoice(id);
      alert('Đã khôi phục hóa đơn.');
      fetchTrash();
    } catch (err) {
      alert('Lỗi khi khôi phục.');
    }
  };

  const handlePermanentDelete = async (id) => {
    try {
      await permanentDeleteInvoice(id);
      alert('Đã xóa vĩnh viễn hóa đơn.');
      setShowConfirmModal(null);
      fetchTrash();
    } catch (err) {
      alert('Lỗi khi xóa vĩnh viễn.');
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>Lịch sử xóa</h2>

      <div className="trash-warning">
        ⚠️ Hóa đơn đã xóa sẽ được tự động xóa vĩnh viễn sau 30 ngày. Thông báo này tự ẩn sau khoảng 7 ngày.
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner"></div></div>
      ) : (
        <div className="invoice-list">
          {invoices.map((inv) => (
            <div key={inv.invoice_id} className="trash-item">
              <div className="trash-item-icon">🗑️</div>
              <div className="trash-item-info">
                <h4>{inv.store_name || 'Không rõ cửa hàng'}</h4>
                <div className="trash-reason">Lý do: Ảnh/hóa đơn bị trùng</div>
                <div className="trash-timer">Còn 30 ngày trước khi tự xóa</div>
              </div>
              <div className="trash-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => handleRestore(inv.invoice_id)}>
                  🔄 Khôi phục
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setShowConfirmModal(inv.invoice_id)} style={{ padding: '6px 12px', background: '#FEE2E2', color: '#DC2626' }}>
                  🗑️ Xóa hẳn
                </button>
              </div>
            </div>
          ))}
          
          {invoices.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🗑️</div>
              <h3>Thùng rác trống</h3>
              <p>Không có hóa đơn nào đã xóa gần đây.</p>
            </div>
          )}
        </div>
      )}

      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header" style={{ justifyContent: 'center' }}>
              <h3 style={{ fontSize: '20px' }}>Xóa vĩnh viễn?</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Thao tác này không thể hoàn tác.
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirmModal(null)}>Hủy</button>
              <button className="btn btn-danger" onClick={() => handlePermanentDelete(showConfirmModal)}>Xóa hẳn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
