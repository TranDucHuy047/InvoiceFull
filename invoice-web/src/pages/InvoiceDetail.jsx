import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getInvoiceDetail, deleteInvoice } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('Ảnh/hóa đơn bị trùng');
  const [copied, setCopied] = useState(false);

  // Tab: 'structured' | 'raw_text' - default according to Settings preference!
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('app_auto_switch_text') === 'true' ? 'raw_text' : 'structured';
  });

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
      alert(lang === 'vi' ? 'Không thể tải chi tiết hóa đơn.' : 'Unable to load invoice details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteInvoice(id);
      alert(lang === 'vi' ? 'Đã chuyển hóa đơn vào thùng rác.' : 'Moved invoice to trash.');
      navigate('/history');
    } catch (err) {
      alert(lang === 'vi' ? 'Lỗi khi xóa hóa đơn.' : 'Error deleting invoice.');
    }
  };

  const handleCopyRawText = () => {
    if (!invoice?.raw_text) return;
    navigator.clipboard.writeText(invoice.raw_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  if (loading) {
    return <div className="loading-overlay"><div className="spinner"></div></div>;
  }

  if (!invoice) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📂</div>
        <h3>{t('empty_invoice')}</h3>
        <button className="btn btn-primary" onClick={() => navigate('/history')}>{t('back_btn')}</button>
      </div>
    );
  }

  const products = invoice.items || [];
  const rawTextLines = invoice.raw_text ? invoice.raw_text.split('\n') : [];

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <div className="breadcrumb">
        <Link to="/history">{t('history')}</Link> <span>›</span> <span className="current">{t('invoice_detail_title')}</span>
      </div>

      {/* Verified Status Banner */}
      <div className="inv-status-banner">
        <span className="inv-status-icon">🔒</span>
        <div className="inv-status-info">
          <span className="inv-status-title">
            {lang === 'vi' ? 'Hóa đơn đã được xác nhận (Submit)' : 'Verified & Locked Invoice'}
          </span>
          <span className="inv-status-desc">
            {lang === 'vi' 
              ? 'Dữ liệu đã được kiểm tra và lưu cố định vào hệ thống. Không thể chỉnh sửa lại.' 
              : 'Invoice data has been verified and permanently locked. Editing is no longer permitted.'}
          </span>
        </div>
      </div>

      {/* Segmented Tab Controls */}
      <div className="inv-tabs-bar">
        <button
          className={`inv-tab-btn ${activeTab === 'structured' ? 'active' : ''}`}
          onClick={() => setActiveTab('structured')}
          type="button"
        >
          {t('tab_structured')}
        </button>
        <button
          className={`inv-tab-btn ${activeTab === 'raw_text' ? 'active' : ''}`}
          onClick={() => setActiveTab('raw_text')}
          type="button"
        >
          {t('tab_raw_text')} {rawTextLines.length > 0 && <span className="inv-tab-badge">{rawTextLines.length}</span>}
        </button>
      </div>

      {/* TAB 1: STRUCTURED VIEW */}
      {activeTab === 'structured' && (
        <>
          <div className="result-section">
            <h3>{t('general_info')}</h3>
            <table className="result-table">
              <tbody>
                <tr>
                  <td>{t('store_name')}</td>
                  <td style={{ fontWeight: 600 }}>{invoice.store_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td>{t('store_address')}</td>
                  <td>{invoice.store_address || 'N/A'}</td>
                </tr>
                <tr>
                  <td>{t('invoice_date')}</td>
                  <td>{invoice.date || 'N/A'}</td>
                </tr>
                <tr>
                  <td>{t('tax_vat')}</td>
                  <td>{invoice.tax_amount ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoice.tax_amount) : '0đ'}</td>
                </tr>
                <tr className="total-row">
                  <td>{t('total_payment')}</td>
                  <td>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoice.total_amount || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="result-section">
            <h3>{t('products_count')} ({products.length})</h3>
            <table className="products-table">
              <thead>
                <tr>
                  <th>{t('col_name')}</th>
                  <th>{t('col_quantity')}</th>
                  <th>{t('col_unit_price')}</th>
                  <th>{t('col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {products.length > 0 ? (
                  products.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{p.item_name}</td>
                      <td>{p.quantity}</td>
                      <td>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.unit_price)}</td>
                      <td style={{ fontWeight: 600 }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.total_price)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      {lang === 'vi' ? 'Không có danh sách sản phẩm chi tiết' : 'No product items listed'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: RAW TEXT / OCR VIEW */}
      {activeTab === 'raw_text' && (
        <div className="result-section inv-raw-section">
          <div className="inv-raw-header">
            <div>
              <h3>{t('tab_raw_text')}</h3>
              <p className="inv-raw-meta">
                {rawTextLines.length} {lang === 'vi' ? 'dòng văn bản' : 'lines'} • {invoice.raw_text ? invoice.raw_text.length : 0} {lang === 'vi' ? 'ký tự' : 'characters'}
              </p>
            </div>
            <button
              className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline'}`}
              onClick={handleCopyRawText}
              disabled={!invoice.raw_text}
            >
              {copied ? t('copied') : `📋 ${t('copy_text')}`}
            </button>
          </div>

          {invoice.raw_text ? (
            <div className="inv-raw-content">
              <pre>{invoice.raw_text}</pre>
            </div>
          ) : (
            <div className="inv-raw-empty">
              <span>📄</span>
              <p>{t('no_raw_text')}</p>
            </div>
          )}
        </div>
      )}

      {/* AI Ask Banner */}
      <div className="ai-ask-banner" onClick={() => navigate('/ai-chat', { state: { invoiceId: id } })}>
        <div className="ai-ask-icon">✨</div>
        <div>
          <h4>{t('ask_ai_banner_title')}</h4>
          <p>{t('ask_ai_banner_sub')} ({invoice.store_name || 'Hóa đơn'}).</p>
        </div>
        <div className="ai-ask-arrow">›</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>
          {t('back_btn')}
        </button>
        <button
          className="btn btn-outline"
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={() => setShowDeleteModal(true)}
        >
          {t('delete_invoice_btn')}
        </button>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>{t('confirm_delete_title')}</h3>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {t('confirm_delete_sub')}
            </p>
            <div className="modal-section">
              <label>{t('delete_reason_label')}</label>
              <select className="form-select" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
                <option>{lang === 'vi' ? 'Ảnh/hóa đơn bị trùng' : 'Duplicate photo/invoice'}</option>
                <option>{lang === 'vi' ? 'Thông tin sai lệch' : 'Inaccurate information'}</option>
                <option>{lang === 'vi' ? 'Không cần thiết nữa' : 'No longer needed'}</option>
                <option>{lang === 'vi' ? 'Lý do khác' : 'Other reason'}</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)}>{t('cancel')}</button>
              <button className="btn btn-danger" onClick={handleDelete}>{t('delete_invoice_btn')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
