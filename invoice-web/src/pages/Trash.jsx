import { useState, useEffect } from 'react';
import {
  getTrashInvoices,
  restoreInvoice,
  permanentDeleteInvoice,
  batchRestoreInvoices,
  batchPermanentDeleteInvoices,
} from '../services/api';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Receipt,
  Calendar,
} from 'lucide-react';

export default function Trash() {
  const [trashedInvoices, setTrashedInvoices] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const res = await getTrashInvoices();
      const data = res.data?.data || res.data || [];
      setTrashedInvoices(data);
      setSelectedIds([]);
    } catch (err) {
      console.error('Lỗi tải lịch sử xóa:', err);
      showToast('Không thể tải danh sách lịch sử xóa', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectOne = (invoiceId) => {
    setSelectedIds((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const isAllSelected =
    trashedInvoices.length > 0 && selectedIds.length === trashedInvoices.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(trashedInvoices.map((inv) => inv.invoice_id));
    }
  };

  const handleRestore = async (invoiceId) => {
    try {
      setActionLoading(true);
      await restoreInvoice(invoiceId);
      setTrashedInvoices((prev) => prev.filter((inv) => inv.invoice_id !== invoiceId));
      setSelectedIds((prev) => prev.filter((id) => id !== invoiceId));
      showToast('Đã khôi phục hóa đơn thành công!');
    } catch (err) {
      console.error('Lỗi khôi phục:', err);
      showToast(err.response?.data?.detail || 'Không thể khôi phục hóa đơn', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async (invoiceId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn hóa đơn này? Hành động này không thể hoàn tác.')) return;
    try {
      setActionLoading(true);
      await permanentDeleteInvoice(invoiceId);
      setTrashedInvoices((prev) => prev.filter((inv) => inv.invoice_id !== invoiceId));
      setSelectedIds((prev) => prev.filter((id) => id !== invoiceId));
      showToast('Đã xóa vĩnh viễn hóa đơn!');
    } catch (err) {
      console.error('Lỗi xóa vĩnh viễn:', err);
      showToast(err.response?.data?.detail || 'Không thể xóa vĩnh viễn hóa đơn', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchRestore = async () => {
    if (selectedIds.length === 0) return;
    try {
      setActionLoading(true);
      await batchRestoreInvoices(selectedIds);
      const count = selectedIds.length;
      setTrashedInvoices((prev) =>
        prev.filter((inv) => !selectedIds.includes(inv.invoice_id))
      );
      setSelectedIds([]);
      showToast(`Đã khôi phục ${count} hóa đơn thành công!`);
    } catch (err) {
      console.error('Lỗi khôi phục hàng loạt:', err);
      showToast(err.response?.data?.detail || 'Lỗi khi khôi phục hàng loạt', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchPermanentDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.length} hóa đơn đã chọn? Hành động này không thể hoàn tác.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      await batchPermanentDeleteInvoices(selectedIds);
      const count = selectedIds.length;
      setTrashedInvoices((prev) =>
        prev.filter((inv) => !selectedIds.includes(inv.invoice_id))
      );
      setSelectedIds([]);
      showToast(`Đã xóa vĩnh viễn ${count} hóa đơn!`);
    } catch (err) {
      console.error('Lỗi xóa vĩnh viễn hàng loạt:', err);
      showToast(err.response?.data?.detail || 'Lỗi khi xóa vĩnh viễn hàng loạt', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (trashedInvoices.length === 0) return;
    const allIds = trashedInvoices.map((inv) => inv.invoice_id);
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn dọn sạch thùng rác (xóa vĩnh viễn toàn bộ ${allIds.length} hóa đơn)? Hành động này không thể hoàn tác.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      await batchPermanentDeleteInvoices(allIds);
      setTrashedInvoices([]);
      setSelectedIds([]);
      showToast('Đã dọn sạch toàn bộ lịch sử xóa!');
    } catch (err) {
      console.error('Lỗi dọn sạch thùng rác:', err);
      showToast(err.response?.data?.detail || 'Lỗi khi dọn sạch lịch sử xóa', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getDaysRemaining = (deletedAt) => {
    if (!deletedAt) return 30;
    const deleted = new Date(deletedAt);
    const now = new Date();
    const diff = 30 - Math.floor((now - deleted) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const formatAmount = (amount) => {
    const num = Number(amount);
    if (!num || isNaN(num)) return null;
    return num.toLocaleString('vi-VN') + ' đ';
  };

  return (
    <div className="trash-page">
      {toast && (
        <div className={`trash-toast ${toast.type}`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={17} strokeWidth={1.75} />
          ) : (
            <AlertTriangle size={17} strokeWidth={1.75} />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="trash-header">
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
            Lịch sử xóa
          </h2>
          <p className="trash-subtitle">
            Quản lý các hóa đơn đã tạm xóa — khôi phục lại hoặc xóa vĩnh viễn khỏi hệ thống
          </p>
        </div>
      </div>

      {/* Hộp cảnh báo đã được tối ưu độ tương phản (High Contrast) cho cả Light & Dark Mode */}
      <div className="trash-warning">
        <div className="trash-warning-icon">
          <AlertTriangle size={20} strokeWidth={1.75} />
        </div>
        <div className="trash-warning-text">
          <strong>Lưu ý lưu trữ:</strong> Các hóa đơn trong mục Lịch sử xóa sẽ tự động bị xóa vĩnh viễn sau{' '}
          <strong>30 ngày</strong> kể từ thời điểm xóa.
        </div>
      </div>

      {/* Action Toolbar */}
      {!loading && trashedInvoices.length > 0 && (
        <div className="trash-toolbar">
          <div className="trash-toolbar-left">
            <label className="trash-select-all-label">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="trash-checkbox"
              />
              <span>
                Chọn tất cả ({selectedIds.length}/{trashedInvoices.length})
              </span>
            </label>

            {selectedIds.length > 0 && (
              <span className="trash-badge-count">
                Đang chọn <strong>{selectedIds.length}</strong> hóa đơn
              </span>
            )}
          </div>

          <div className="trash-toolbar-right">
            {selectedIds.length > 0 ? (
              <>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={actionLoading}
                  onClick={handleBatchRestore}
                >
                  <RotateCcw size={15} strokeWidth={1.75} />
                  Khôi phục ({selectedIds.length})
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={actionLoading}
                  onClick={handleBatchPermanentDelete}
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                  Xóa vĩnh viễn ({selectedIds.length})
                </button>
              </>
            ) : (
              <button
                className="btn btn-outline-danger btn-sm"
                disabled={actionLoading}
                onClick={handleEmptyTrash}
              >
                <Trash2 size={15} strokeWidth={1.75} />
                Dọn sạch tất cả ({trashedInvoices.length})
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      ) : trashedInvoices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'inline-flex' }}>
            <Trash2 size={42} strokeWidth={1.5} />
          </div>
          <h3>Thùng rác trống</h3>
          <p>Không có hóa đơn nào trong danh sách xóa.</p>
        </div>
      ) : (
        <div className="trash-list">
          {trashedInvoices.map((inv) => {
            const isSelected = selectedIds.includes(inv.invoice_id);
            const formattedAmt = formatAmount(inv.total_amount);

            return (
              <div
                key={inv.invoice_id}
                className={`trash-item ${isSelected ? 'is-selected' : ''}`}
                onClick={() => toggleSelectOne(inv.invoice_id)}
              >
                <div
                  className="trash-item-select"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(inv.invoice_id)}
                    className="trash-checkbox"
                  />
                </div>

                <div className="trash-item-icon">
                  <Receipt size={20} strokeWidth={1.75} />
                </div>

                <div className="trash-item-info">
                  <h4>{inv.store_name || 'Cửa hàng chưa xác định'}</h4>
                  <div className="trash-meta-row">
                    {inv.date && (
                      <span className="trash-meta-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={13} strokeWidth={1.75} />
                        {inv.date}
                      </span>
                    )}
                    {formattedAmt && (
                      <span className="trash-meta-tag amount">
                        {formattedAmt}
                      </span>
                    )}
                    <span className="trash-reason">
                      Lý do: {inv.delete_reason || 'Không rõ lý do'}
                    </span>
                  </div>
                  <div className="trash-timer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={12} strokeWidth={1.75} />
                    Tự động xóa sau {getDaysRemaining(inv.deleted_at)} ngày
                  </div>
                </div>

                <div
                  className="trash-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={actionLoading}
                    onClick={() => handleRestore(inv.invoice_id)}
                    title="Khôi phục hóa đơn về Lịch sử"
                  >
                    <RotateCcw size={14} strokeWidth={1.75} />
                    Khôi phục
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={actionLoading}
                    onClick={() => handlePermanentDelete(inv.invoice_id)}
                    title="Xóa vĩnh viễn không thể khôi phục"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                    Xóa vĩnh viễn
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
