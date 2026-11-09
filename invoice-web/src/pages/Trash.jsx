import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Search,
  X,
} from 'lucide-react';

export default function Trash() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trashedInvoices, setTrashedInvoices] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [confirmAction, setConfirmAction] = useState(null); // { title, message, onConfirm }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    setSearchQuery(qParam);
  }, [searchParams]);

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

  const filteredTrash = useMemo(() => {
    const kw = searchQuery.trim().toLowerCase();
    if (!kw) return trashedInvoices;
    return trashedInvoices.filter((inv) => {
      const store = (inv.store_name || '').toLowerCase();
      const id = (inv.invoice_id || '').toLowerCase();
      const date = (inv.date || '').toLowerCase();
      const reason = (inv.delete_reason || '').toLowerCase();
      const amt = String(inv.total_amount || '');
      return (
        store.includes(kw) ||
        id.includes(kw) ||
        date.includes(kw) ||
        reason.includes(kw) ||
        amt.includes(kw)
      );
    });
  }, [trashedInvoices, searchQuery]);

  const toggleSelectOne = (invoiceId) => {
    setSelectedIds((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const isAllSelected =
    filteredTrash.length > 0 &&
    filteredTrash.every((inv) => selectedIds.includes(inv.invoice_id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const visibleIds = new Set(filteredTrash.map((inv) => inv.invoice_id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const visibleIds = filteredTrash.map((inv) => inv.invoice_id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
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

  const handlePermanentDelete = (invoiceId) => {
    setConfirmAction({
      title: 'Xác nhận xóa vĩnh viễn',
      message: 'Bạn có chắc chắn muốn xóa vĩnh viễn hóa đơn này? Hành động này không thể hoàn tác.',
      onConfirm: async () => {
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
          setConfirmAction(null);
        }
      },
    });
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

  const handleBatchPermanentDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmAction({
      title: 'Xác nhận xóa vĩnh viễn hàng loạt',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.length} hóa đơn đã chọn? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
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
          setConfirmAction(null);
        }
      },
    });
  };

  const handleEmptyTrash = () => {
    if (trashedInvoices.length === 0) return;
    const allIds = trashedInvoices.map((inv) => inv.invoice_id);
    setConfirmAction({
      title: 'Xác nhận dọn sạch thùng rác',
      message: `Bạn có chắc chắn muốn dọn sạch thùng rác (xóa vĩnh viễn toàn bộ ${allIds.length} hóa đơn)? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
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
          setConfirmAction(null);
        }
      },
    });
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

      <div className="trash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: 0 }}>
            Lịch sử xóa
          </h2>
        </div>

        {/* Thanh tìm kiếm trực tiếp trong Lịch sử xóa */}
        <div className="inv-search-wrap" style={{ maxWidth: '340px', width: '100%' }}>
          <span className="inv-search-icon">
            <Search size={16} strokeWidth={1.75} />
          </span>
          <input
            type="text"
            className="inv-search-input"
            placeholder="Tìm hóa đơn đã xóa (cửa hàng, mã HĐ, lý do...)"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim()) {
                setSearchParams({ q: val }, { replace: true });
              } else {
                setSearchParams({}, { replace: true });
              }
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="inv-search-clear"
              onClick={() => {
                setSearchQuery('');
                setSearchParams({}, { replace: true });
              }}
              title="Xóa tìm kiếm"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          )}
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
      {!loading && filteredTrash.length > 0 && (
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
                Chọn tất cả ({selectedIds.length}/{filteredTrash.length})
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
      ) : filteredTrash.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'inline-flex' }}>
            <Trash2 size={42} strokeWidth={1.5} />
          </div>
          <h3>{searchQuery ? 'Không tìm thấy hóa đơn phù hợp' : 'Thùng rác trống'}</h3>
          <p>
            {searchQuery
              ? `Không có hóa đơn đã xóa nào khớp với từ khóa "${searchQuery}".`
              : 'Không có hóa đơn nào trong danh sách xóa.'}
          </p>
        </div>
      ) : (
        <div className="trash-list">
          {filteredTrash.map((inv) => {
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

      {/* Modal Xác nhận xóa vĩnh viễn */}
      {confirmAction && (
        <div className="modal-overlay" onClick={() => !actionLoading && setConfirmAction(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '430px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <AlertTriangle size={19} strokeWidth={1.75} />
                {confirmAction.title}
              </h3>
              <button
                type="button"
                className="modal-close"
                disabled={actionLoading}
                onClick={() => setConfirmAction(null)}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
              {confirmAction.message}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={actionLoading}
                onClick={() => setConfirmAction(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={actionLoading}
                onClick={confirmAction.onConfirm}
              >
                <Trash2 size={15} strokeWidth={1.75} />
                {actionLoading ? 'Đang xóa...' : 'Chắc chắn muốn xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
