import { useState, useEffect } from 'react';
import { 
  getTrash, 
  restoreInvoice, 
  permanentDeleteInvoice, 
  emptyTrash, 
  batchDeleteTrash, 
  batchRestoreTrash 
} from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

export default function Trash() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { mode: 'single' | 'selected' | 'all', id?: string, name?: string, count?: number }
  const [toastMessage, setToastMessage] = useState(null);

  const { lang } = useLanguage();

  useEffect(() => {
    fetchTrash();
  }, []);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const res = await getTrash();
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setInvoices(list);
      // Clean up selectedIds to only include existing invoices
      setSelectedIds(prev => prev.filter(id => list.some(inv => inv.invoice_id === id)));
    } catch (err) {
      console.error(err);
      showToast(lang === 'vi' ? 'Không thể tải danh sách thùng rác' : 'Failed to load trash list', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedIds.length === invoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(invoices.map(inv => inv.invoice_id));
    }
  };

  const handleToggleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Restore single
  const handleRestore = async (id) => {
    setActionLoading(true);
    try {
      await restoreInvoice(id);
      showToast(lang === 'vi' ? 'Đã khôi phục hóa đơn thành công.' : 'Invoice restored successfully.');
      setSelectedIds(prev => prev.filter(item => item !== id));
      await fetchTrash();
    } catch (err) {
      console.error(err);
      showToast(lang === 'vi' ? 'Lỗi khi khôi phục hóa đơn.' : 'Failed to restore invoice.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Batch restore
  const handleBatchRestore = async () => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      await batchRestoreTrash(selectedIds);
      showToast(
        lang === 'vi' 
          ? `Đã khôi phục thành công ${selectedIds.length} hóa đơn.` 
          : `Restored ${selectedIds.length} invoices successfully.`
      );
      setSelectedIds([]);
      await fetchTrash();
    } catch (err) {
      console.error(err);
      showToast(lang === 'vi' ? 'Lỗi khi khôi phục các hóa đơn đã chọn.' : 'Failed to restore selected invoices.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute delete (single, selected, or all)
  const handleExecuteDelete = async () => {
    if (!confirmModal) return;
    setActionLoading(true);

    try {
      if (confirmModal.mode === 'single') {
        await permanentDeleteInvoice(confirmModal.id);
        showToast(lang === 'vi' ? 'Đã xóa vĩnh viễn hóa đơn.' : 'Invoice permanently deleted.');
        setSelectedIds(prev => prev.filter(item => item !== confirmModal.id));
      } else if (confirmModal.mode === 'selected') {
        await batchDeleteTrash(selectedIds);
        showToast(
          lang === 'vi' 
            ? `Đã xóa vĩnh viễn ${selectedIds.length} hóa đơn đã chọn.` 
            : `Permanently deleted ${selectedIds.length} invoices.`
        );
        setSelectedIds([]);
      } else if (confirmModal.mode === 'all') {
        await emptyTrash();
        showToast(lang === 'vi' ? 'Đã xóa vĩnh viễn toàn bộ thùng rác.' : 'Emptied all trash successfully.');
        setSelectedIds([]);
      }
      setConfirmModal(null);
      await fetchTrash();
    } catch (err) {
      console.error(err);
      showToast(lang === 'vi' ? 'Lỗi khi xóa vĩnh viễn hóa đơn.' : 'Failed to delete permanently.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const isAllSelected = invoices.length > 0 && selectedIds.length === invoices.length;

  return (
    <div className="trash-page animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`trash-toast ${toastMessage.type}`}>
          <span>{toastMessage.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="trash-header">
        <div>
          <h2>{lang === 'vi' ? 'Lịch sử xóa (Thùng rác)' : 'Trash History'}</h2>
          <p className="trash-subtitle">
            {lang === 'vi' 
              ? 'Quản lý các hóa đơn đã xóa tạm thời. Bạn có thể chọn để khôi phục hoặc xóa hẳn vĩnh viễn.' 
              : 'Manage temporarily deleted invoices. Select to restore or permanently delete.'}
          </p>
        </div>
      </div>

      {/* Warning Notice Banner */}
      <div className="trash-warning">
        <span style={{ fontSize: '18px' }}>⚠️</span>
        <div>
          <strong>{lang === 'vi' ? 'Lưu ý lưu trữ:' : 'Storage Notice:'}</strong>{' '}
          {lang === 'vi' 
            ? 'Hóa đơn đã xóa tạm thời sẽ tự động được hệ thống xóa vĩnh viễn sau 30 ngày.' 
            : 'Temporarily deleted invoices will be permanently wiped by the system after 30 days.'}
        </div>
      </div>

      {/* Toolbar: Select All & Bulk Actions */}
      {invoices.length > 0 && (
        <div className="trash-toolbar">
          <div className="trash-toolbar-left">
            <label className="trash-select-all-label">
              <input 
                type="checkbox" 
                className="trash-checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                disabled={actionLoading}
              />
              <span className="trash-select-all-text">
                {isAllSelected 
                  ? (lang === 'vi' ? 'Bỏ chọn tất cả' : 'Deselect All') 
                  : (lang === 'vi' ? 'Chọn tất cả' : 'Select All')} ({invoices.length})
              </span>
            </label>

            {selectedIds.length > 0 && (
              <span className="trash-badge-count">
                {lang === 'vi' ? 'Đã chọn:' : 'Selected:'} <strong>{selectedIds.length}</strong> / {invoices.length}
              </span>
            )}
          </div>

          <div className="trash-toolbar-right">
            {selectedIds.length > 0 ? (
              <>
                <button 
                  type="button" 
                  className="btn btn-outline btn-sm"
                  onClick={handleBatchRestore}
                  disabled={actionLoading}
                >
                  🔄 {lang === 'vi' ? `Khôi phục (${selectedIds.length})` : `Restore (${selectedIds.length})`}
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfirmModal({ mode: 'selected', count: selectedIds.length })}
                  disabled={actionLoading}
                  style={{ background: '#DC2626', color: '#FFFFFF', border: 'none' }}
                >
                  🗑️ {lang === 'vi' ? `Xóa đã chọn (${selectedIds.length})` : `Delete Selected (${selectedIds.length})`}
                </button>
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedIds([])}
                  disabled={actionLoading}
                >
                  ✕ {lang === 'vi' ? 'Bỏ chọn' : 'Deselect'}
                </button>
              </>
            ) : (
              <button 
                type="button" 
                className="btn btn-danger btn-sm btn-outline-danger"
                onClick={() => setConfirmModal({ mode: 'all', count: invoices.length })}
                disabled={actionLoading}
              >
                🔥 {lang === 'vi' ? `Xóa tất cả (${invoices.length})` : `Empty All Trash (${invoices.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main List */}
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="invoice-list">
          {invoices.map((inv) => {
            const isSelected = selectedIds.includes(inv.invoice_id);
            return (
              <div 
                key={inv.invoice_id} 
                className={`trash-item ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleToggleSelectOne(inv.invoice_id)}
              >
                {/* Checkbox */}
                <div className="trash-item-select" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    className="trash-checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelectOne(inv.invoice_id)}
                    disabled={actionLoading}
                  />
                </div>

                <div className="trash-item-icon">🗑️</div>

                <div className="trash-item-info">
                  <h4>{inv.store_name || (lang === 'vi' ? 'Không rõ cửa hàng' : 'Unknown Store')}</h4>
                  
                  <div className="trash-meta-row">
                    {inv.date && (
                      <span className="trash-meta-tag">
                        📅 {inv.date}
                      </span>
                    )}
                    {inv.total_amount && inv.total_amount > 0 && (
                      <span className="trash-meta-tag amount">
                        💰 {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(inv.total_amount)}
                      </span>
                    )}
                    <span className="trash-reason">
                      {lang === 'vi' ? 'Lý do: Ảnh/hóa đơn bị trùng hoặc đã xóa' : 'Reason: Duplicate or deleted'}
                    </span>
                  </div>

                  <div className="trash-timer">
                    ⏳ {lang === 'vi' ? 'Còn 30 ngày trước khi tự xóa vĩnh viễn' : 'Auto-purge in 30 days'}
                  </div>
                </div>

                {/* Individual Action buttons */}
                <div className="trash-actions" onClick={(e) => e.stopPropagation()}>
                  <button 
                    type="button"
                    className="btn btn-ghost btn-sm" 
                    onClick={() => handleRestore(inv.invoice_id)}
                    disabled={actionLoading}
                  >
                    🔄 {lang === 'vi' ? 'Khôi phục' : 'Restore'}
                  </button>
                  <button 
                    type="button"
                    className="btn btn-danger btn-sm" 
                    onClick={() => setConfirmModal({ mode: 'single', id: inv.invoice_id, name: inv.store_name })} 
                    disabled={actionLoading}
                    style={{ padding: '6px 12px', background: '#FEE2E2', color: '#DC2626' }}
                  >
                    🗑️ {lang === 'vi' ? 'Xóa hẳn' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
          
          {invoices.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🗑️</div>
              <h3>{lang === 'vi' ? 'Thùng rác trống' : 'Trash is empty'}</h3>
              <p>{lang === 'vi' ? 'Không có hóa đơn nào đã xóa gần đây.' : 'No deleted invoices found.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay animate-fade-in" onClick={() => !actionLoading && setConfirmModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            
            <div className="modal-header" style={{ justifyContent: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700' }}>
                {confirmModal.mode === 'all' 
                  ? (lang === 'vi' ? `Xóa tất cả ${confirmModal.count} hóa đơn?` : `Empty all ${confirmModal.count} invoices?`)
                  : confirmModal.mode === 'selected'
                    ? (lang === 'vi' ? `Xóa vĩnh viễn ${confirmModal.count} hóa đơn đã chọn?` : `Delete ${confirmModal.count} selected invoices?`)
                    : (lang === 'vi' ? 'Xóa vĩnh viễn hóa đơn này?' : 'Delete this invoice permanently?')}
              </h3>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
              {lang === 'vi' 
                ? 'Hành động này sẽ xóa triệt để dữ liệu hóa đơn khỏi hệ thống và KHÔNG THỂ HOÀN TÁC. Bạn có chắc chắn muốn tiếp tục?' 
                : 'This action will permanently remove the invoice data from the system and CANNOT BE UNDONE. Are you sure you want to proceed?'}
            </p>

            <div className="modal-actions" style={{ justifyContent: 'center', gap: '12px' }}>
              <button 
                type="button"
                className="btn btn-ghost" 
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading}
              >
                {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button 
                type="button"
                className="btn btn-danger" 
                onClick={handleExecuteDelete}
                disabled={actionLoading}
                style={{ background: '#DC2626', color: '#FFFFFF', minWidth: '130px' }}
              >
                {actionLoading 
                  ? (lang === 'vi' ? '⏳ Đang xóa...' : 'Deleting...') 
                  : (lang === 'vi' ? 'Xác nhận xóa hẳn' : 'Confirm Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
