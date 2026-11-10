import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoiceDetail, deleteInvoice, updateInvoice } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import {
  ArrowLeft,
  Trash2,
  Lock,
  LayoutList,
  FileText,
  Copy,
  Check,
  Sparkles,
  ChevronRight,
  Flag,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit3,
  Plus,
  Save,
} from 'lucide-react';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('Hóa đơn bị trùng lặp');
  const [toast, setToast] = useState(null);
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [editableItems, setEditableItems] = useState([]);
  const [savingFields, setSavingFields] = useState(false);
  const [confirmRemoveFieldIdx, setConfirmRemoveFieldIdx] = useState(null);

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('app_auto_switch_text') === 'true' ? 'raw' : 'structured';
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      const res = await getInvoiceDetail(id);
      const data = res.data?.data || res.data;
      setInvoice(data);
      setEditableItems(
        Array.isArray(data?.items)
          ? data.items.map((it) => ({
              name: it.item_name || it.name || '',
              item_name: it.item_name || it.name || '',
              unit: it.unit || '',
              quantity: Number(it.quantity) || 1,
              unit_price: Math.round(Number(it.unit_price) || 0),
              total_price: Math.round(Number(it.total_price) || 0),
            }))
          : []
      );
    } catch (err) {
      console.error('Lỗi tải chi tiết hóa đơn:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditItemChange = (idx, value) => {
    setEditableItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, name: value, item_name: value } : it))
    );
  };

  const handleAddEditableField = () => {
    setEditableItems((prev) => [
      ...prev,
      { name: '', item_name: '', unit: '', quantity: 1, unit_price: 0, total_price: 0 },
    ]);
  };

  const executeRemoveEditableField = async () => {
    if (confirmRemoveFieldIdx === null) return;
    const idxToRemove = confirmRemoveFieldIdx;
    setConfirmRemoveFieldIdx(null);
    const nextItems = editableItems.filter((_, idx) => idx !== idxToRemove);
    setEditableItems(nextItems);

    // Nếu người dùng bấm xóa trực tiếp ngay cả khi chưa bật chế độ sửa, tự động lưu luôn
    if (!isEditingFields && invoice) {
      await saveUpdatedItemsToBackend(nextItems);
    }
  };

  const saveUpdatedItemsToBackend = async (itemsToSave = editableItems) => {
    if (!invoice) return;
    const cleaned = itemsToSave
      .map((it) => {
        const cleanName = String(it.name || it.item_name || '').trim();
        return {
          name: cleanName,
          item_name: cleanName,
          unit: String(it.unit || '').trim(),
          quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
          unit_price: Math.round(Number(it.unit_price) || 0),
          total_price: Math.round(Number(it.total_price) || 0),
        };
      })
      .filter((it) => it.name !== '');

    setSavingFields(true);
    try {
      const payload = {
        invoice_id: invoice.invoice_id || id,
        store_name: invoice.store_name || 'Chưa xác định',
        store_address: invoice.store_address || '',
        date: invoice.date || '',
        invoice_type: invoice.invoice_type || 'Document/Form',
        subtotal: Math.round(Number(invoice.subtotal) || 0),
        tax_amount: Math.round(Number(invoice.tax_amount) || 0),
        total_amount: Math.round(Number(invoice.total_amount) || 0),
        items: cleaned,
        raw_text: invoice.raw_text || '',
        image_path: invoice.image_path || '',
        is_submitted: true,
      };
      await updateInvoice(id, payload);
      setInvoice((prev) => ({ ...prev, items: cleaned }));
      setEditableItems(cleaned);
      setIsEditingFields(false);
      setToast({ msg: 'Đã cập nhật các trường thông tin thành công!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({
        msg: err.response?.data?.detail || 'Không thể lưu thay đổi trường thông tin.',
        type: 'error',
      });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSavingFields(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteInvoice(id, deleteReason);
      setShowDeleteModal(false);
      setToast({ msg: 'Đã chuyển hóa đơn vào Lịch sử xóa', type: 'success' });
      setTimeout(() => navigate('/history'), 1000);
    } catch (err) {
      setToast({ msg: 'Không thể xóa hóa đơn', type: 'error' });
    }
  };

  const handleCopyRawText = () => {
    if (!invoice?.raw_text) return;
    navigator.clipboard.writeText(invoice.raw_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '0 đ';
    return Number(amount).toLocaleString('vi-VN') + ' đ';
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="empty-state">
        <div className="empty-icon" style={{ display: 'inline-flex' }}>
          <Receipt size={42} strokeWidth={1.5} />
        </div>
        <h3>{t('empty_invoice')}</h3>
        <button
          className="btn btn-primary"
          style={{ maxWidth: '200px', margin: '16px auto' }}
          onClick={() => navigate('/history')}
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          {t('back_btn')}
        </button>
      </div>
    );
  }

  const items = invoice.items || [];
  const isDocForm =
    invoice.invoice_type === 'Document/Form' ||
    (Number(invoice.total_amount || 0) === 0 &&
      items.length > 0 &&
      items.every((it) => Number(it.total_price || 0) === 0));

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} strokeWidth={1.75} />
          {t('back_btn')}
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
          {isDocForm ? 'Chi tiết tài liệu' : t('invoice_detail_title')}
        </h2>
        <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(true)}>
          <Trash2 size={15} strokeWidth={1.75} />
          {isDocForm ? 'Xóa tài liệu' : t('delete_invoice_btn')}
        </button>
      </div>

      {/* Verified / Locked Banner */}
      <div className="inv-status-banner">
        <span className="inv-status-icon" style={{ display: 'inline-flex' }}>
          <Lock size={20} strokeWidth={1.75} />
        </span>
        <div className="inv-status-info">
          <span className="inv-status-title">
            {isDocForm
              ? 'Tài liệu đã xác nhận & lưu trữ cố định'
              : 'Hóa đơn đã xác nhận & lưu trữ cố định'}
          </span>
          <span className="inv-status-desc">
            {isDocForm
              ? 'Dữ liệu đã được khóa để đảm bảo tính toàn vẹn lưu trữ (Chỉ xem & chỉnh sửa trường).'
              : 'Dữ liệu đã được khóa để đảm bảo tính toàn vẹn lưu trữ (Chỉ xem).'}
          </span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="inv-tabs-bar">
        <button
          type="button"
          className={`inv-tab-btn ${activeTab === 'structured' ? 'active' : ''}`}
          onClick={() => setActiveTab('structured')}
        >
          <LayoutList size={16} strokeWidth={1.75} />
          {t('tab_structured')}
        </button>
        <button
          type="button"
          className={`inv-tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
          onClick={() => setActiveTab('raw')}
        >
          <FileText size={16} strokeWidth={1.75} />
          {t('tab_raw_text')}
          {invoice.raw_text && (
            <span className="inv-tab-badge">
              {invoice.raw_text.split('\n').filter(Boolean).length} dòng
            </span>
          )}
        </button>
      </div>

      {activeTab === 'structured' ? (
        <>
          {/* General Info */}
          <div className="result-section">
            <h3>{t('general_info')}</h3>
            <table className="result-table">
              <tbody>
                <tr>
                  <td>{isDocForm ? 'Tiêu đề tài liệu' : t('store_name')}</td>
                  <td>{invoice.store_name || 'Chưa xác định'}</td>
                </tr>
                {invoice.store_address && (
                  <tr>
                    <td>{isDocForm ? 'Đơn vị / Địa chỉ' : t('store_address')}</td>
                    <td>{invoice.store_address}</td>
                  </tr>
                )}
                <tr>
                  <td>{isDocForm ? 'Ngày tài liệu' : t('invoice_date')}</td>
                  <td>{invoice.date || 'Chưa rõ'}</td>
                </tr>
                <tr>
                  <td>Phân loại</td>
                  <td>
                    {isDocForm
                      ? 'Tài liệu / Biểu mẫu (FUNSD)'
                      : invoice.invoice_type || 'Other'}
                  </td>
                </tr>
                {!isDocForm && invoice.tax_amount > 0 && (
                  <tr>
                    <td>{t('tax_vat')}</td>
                    <td>{formatCurrency(invoice.tax_amount)}</td>
                  </tr>
                )}
                {!isDocForm && (
                  <tr className="total-row">
                    <td>{t('total_payment')}</td>
                    <td>{formatCurrency(invoice.total_amount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Products / Document Key-Value Fields */}
          {(items.length > 0 || isEditingFields) && (
            <div className="result-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>
                  {isDocForm
                    ? 'Các trường thông tin bóc tách'
                    : `${t('products_count')} (${items.length})`}
                </h3>
                {isDocForm && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isEditingFields ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ width: 'auto' }}
                          onClick={handleAddEditableField}
                          disabled={savingFields}
                        >
                          <Plus size={14} strokeWidth={1.75} />
                          Thêm trường
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ width: 'auto' }}
                          onClick={() => {
                            setIsEditingFields(false);
                            setEditableItems(
                              (invoice.items || []).map((it) => ({
                                name: it.item_name || it.name || '',
                                item_name: it.item_name || it.name || '',
                                unit: it.unit || '',
                                quantity: Number(it.quantity) || 1,
                                unit_price: Math.round(Number(it.unit_price) || 0),
                                total_price: Math.round(Number(it.total_price) || 0),
                              }))
                            );
                          }}
                          disabled={savingFields}
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ width: 'auto' }}
                          onClick={() => saveUpdatedItemsToBackend(editableItems)}
                          disabled={savingFields}
                        >
                          <Save size={14} strokeWidth={1.75} />
                          {savingFields ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ width: 'auto' }}
                        onClick={() => setIsEditingFields(true)}
                      >
                        <Edit3 size={14} strokeWidth={1.75} />
                        Chỉnh sửa / Xóa bớt trường
                      </button>
                    )}
                  </div>
                )}
              </div>
              {isDocForm ? (
                <table className="products-table">
                  <thead>
                    <tr>
                      <th style={{ width: '8%', textAlign: 'center' }}>STT</th>
                      {isEditingFields ? (
                        <th style={{ width: '82%' }}>Trường thông tin & Nội dung</th>
                      ) : (
                        <>
                          <th style={{ width: '32%' }}>Trường thông tin</th>
                          <th style={{ width: '52%' }}>Nội dung chi tiết</th>
                        </>
                      )}
                      <th style={{ width: '8%', textAlign: 'center' }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditingFields ? editableItems : items).map((item, idx) => {
                      const rawStr = String(item.item_name || item.name || '').trim();
                      const colonIdx = rawStr.indexOf(':');
                      const fieldKey =
                        colonIdx > 0 ? rawStr.slice(0, colonIdx).trim() : `Trường #${idx + 1}`;
                      const fieldVal =
                        colonIdx > 0 ? rawStr.slice(colonIdx + 1).trim() : rawStr;
                      return (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {idx + 1}
                          </td>
                          {isEditingFields ? (
                            <td>
                              <input
                                type="text"
                                className="form-input form-input-sm"
                                value={item.name}
                                onChange={(e) => handleEditItemChange(idx, e.target.value)}
                                placeholder="VD: Họ và tên: Nguyễn Văn A"
                              />
                            </td>
                          ) : (
                            <>
                              <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                {fieldKey}
                              </td>
                              <td>{fieldVal || '—'}</td>
                            </>
                          )}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn-icon-danger"
                              onClick={() => setConfirmRemoveFieldIdx(idx)}
                              title="Xóa trường thông tin này"
                            >
                              <Trash2 size={14} strokeWidth={1.75} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>{t('col_name')}</th>
                      <th style={{ textAlign: 'center' }}>{t('col_unit') || 'Đơn vị'}</th>
                      <th style={{ textAlign: 'center' }}>{t('col_quantity')}</th>
                      <th style={{ textAlign: 'right' }}>{t('col_unit_price')}</th>
                      <th style={{ textAlign: 'right' }}>{t('col_total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.item_name || item.name}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {item.unit || '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(item.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      ) : (
        /* Raw OCR Text View */
        <div className="result-section inv-raw-section">
          <div className="inv-raw-header">
            <div>
              <h3>{t('tab_raw_text')}</h3>
              <p className="inv-raw-meta">
                {invoice.store_name || 'Invoice'} • {invoice.date || ''}
              </p>
            </div>
            {invoice.raw_text && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleCopyRawText}
              >
                {copied ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
                {copied ? t('copied') : t('copy_text')}
              </button>
            )}
          </div>

          {invoice.raw_text ? (
            <div className="inv-raw-content">
              <pre>{invoice.raw_text}</pre>
            </div>
          ) : (
            <div className="inv-raw-empty">
              <span style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
                <FileText size={32} strokeWidth={1.5} />
              </span>
              <p>{t('no_raw_text')}</p>
            </div>
          )}
        </div>
      )}

      {/* AI Ask Banner */}
      <div
        className="ai-ask-banner"
        onClick={() =>
          navigate('/ai-chat', {
            state: { invoiceId: id, storeName: invoice.store_name, invoiceType: invoice.invoice_type },
          })
        }
      >
        <span className="ai-ask-icon" style={{ display: 'inline-flex' }}>
          <Sparkles size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h4>{isDocForm ? 'Hỏi AI về tài liệu này' : t('ask_ai_banner_title')}</h4>
          <p>
            {isDocForm
              ? 'Đặt câu hỏi phân tích, tra cứu điều khoản hoặc nội dung trong tài liệu'
              : t('ask_ai_banner_sub')}
          </p>
        </div>
        <span className="ai-ask-arrow" style={{ display: 'inline-flex' }}>
          <ChevronRight size={20} strokeWidth={1.75} />
        </span>
      </div>

      {/* Report Link */}
      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            navigate('/report', {
              state: { invoiceId: id, storeName: invoice.store_name },
            })
          }
        >
          <Flag size={14} strokeWidth={1.75} />
          {isDocForm ? 'Báo cáo sai sót trên tài liệu này' : 'Báo cáo sai sót trên hóa đơn này'}
        </button>
      </div>

      {/* Delete Field Confirmation Modal */}
      {confirmRemoveFieldIdx !== null && (
        <div className="modal-overlay" onClick={() => setConfirmRemoveFieldIdx(null)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Xác nhận xóa trường thông tin</h3>
              <button className="modal-close" onClick={() => setConfirmRemoveFieldIdx(null)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Bạn có chắc chắn muốn xóa trường{' '}
              <strong>
                "{editableItems[confirmRemoveFieldIdx]?.name || `Trường #${confirmRemoveFieldIdx + 1}`}"
              </strong>{' '}
              khỏi tài liệu này không?
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setConfirmRemoveFieldIdx(null)}>
                {t('cancel')}
              </button>
              <button className="btn btn-danger" onClick={executeRemoveEditableField}>
                <Trash2 size={15} strokeWidth={1.75} />
                Chắc chắn xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isDocForm ? 'Xác nhận xóa tài liệu' : t('confirm_delete_title')}</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
              {isDocForm
                ? 'Bạn có chắc chắn muốn chuyển tài liệu này vào thùng rác không?'
                : t('confirm_delete_sub')}
            </p>
            <div className="form-group">
              <label>{t('delete_reason_label')}</label>
              <select
                className="form-select"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              >
                <option>Chứng từ bị trùng lặp</option>
                <option>Thông tin OCR không chính xác</option>
                <option>Không cần lưu trữ nữa</option>
                <option>Khác</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowDeleteModal(false)}>
                {t('cancel')}
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                <Trash2 size={15} strokeWidth={1.75} />
                {isDocForm ? 'Xóa tài liệu' : t('delete_invoice_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
