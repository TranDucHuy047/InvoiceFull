import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoiceDetail, deleteInvoice } from '../services/api';
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
    } catch (err) {
      console.error('Lỗi tải chi tiết hóa đơn:', err);
    } finally {
      setLoading(false);
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
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{t('invoice_detail_title')}</h2>
        <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(true)}>
          <Trash2 size={15} strokeWidth={1.75} />
          {t('delete_invoice_btn')}
        </button>
      </div>

      {/* Verified / Locked Banner */}
      <div className="inv-status-banner">
        <span className="inv-status-icon" style={{ display: 'inline-flex' }}>
          <Lock size={20} strokeWidth={1.75} />
        </span>
        <div className="inv-status-info">
          <span className="inv-status-title">Hóa đơn đã xác nhận &amp; lưu trữ cố định</span>
          <span className="inv-status-desc">
            Dữ liệu đã được khóa để đảm bảo tính toàn vẹn kế toán (Chỉ xem).
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
                  <td>{t('store_name')}</td>
                  <td>{invoice.store_name || 'Chưa xác định'}</td>
                </tr>
                {invoice.store_address && (
                  <tr>
                    <td>{t('store_address')}</td>
                    <td>{invoice.store_address}</td>
                  </tr>
                )}
                <tr>
                  <td>{t('invoice_date')}</td>
                  <td>{invoice.date || 'Chưa rõ'}</td>
                </tr>
                <tr>
                  <td>Phân loại</td>
                  <td>{invoice.invoice_type || 'Other'}</td>
                </tr>
                {invoice.tax_amount > 0 && (
                  <tr>
                    <td>{t('tax_vat')}</td>
                    <td>{formatCurrency(invoice.tax_amount)}</td>
                  </tr>
                )}
                <tr className="total-row">
                  <td>{t('total_payment')}</td>
                  <td>{formatCurrency(invoice.total_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Products */}
          {items.length > 0 && (
            <div className="result-section">
              <h3>
                {t('products_count')} ({items.length})
              </h3>
              <table className="products-table">
                <thead>
                  <tr>
                    <th>{t('col_name')}</th>
                    <th style={{ textAlign: 'center' }}>{t('col_quantity')}</th>
                    <th style={{ textAlign: 'right' }}>{t('col_unit_price')}</th>
                    <th style={{ textAlign: 'right' }}>{t('col_total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.item_name || item.name}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(item.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            state: { invoiceId: id, storeName: invoice.store_name },
          })
        }
      >
        <span className="ai-ask-icon" style={{ display: 'inline-flex' }}>
          <Sparkles size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h4>{t('ask_ai_banner_title')}</h4>
          <p>{t('ask_ai_banner_sub')}</p>
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
          Báo cáo sai sót trên hóa đơn này
        </button>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('confirm_delete_title')}</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
              {t('confirm_delete_sub')}
            </p>
            <div className="form-group">
              <label>{t('delete_reason_label')}</label>
              <select
                className="form-select"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              >
                <option>Hóa đơn bị trùng lặp</option>
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
                {t('delete_invoice_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
