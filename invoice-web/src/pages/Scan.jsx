import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { analyzeInvoice, updateInvoice, deleteInvoice } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

export default function Scan() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState(1); // 1: upload, 2: ocr, 3: ai extract
  const [isDragging, setIsDragging] = useState(false);
  
  // Duplicate error state
  const [duplicateError, setDuplicateError] = useState(null);

  // Review Step state
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [editData, setEditData] = useState({
    invoice_id: '',
    store_name: '',
    store_address: '',
    date: '',
    tax_amount: 0,
    total_amount: 0,
    items: [],
    raw_text: '',
    image_path: ''
  });

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { lang, t } = useLanguage();

  const handleFile = (selectedFile) => {
    if (!selectedFile) return;
    setDuplicateError(null);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleScan = async () => {
    if (!file) return;
    setDuplicateError(null);
    setLoading(true);
    setScanStep(1);

    const stepTimer1 = setTimeout(() => setScanStep(2), 1200);
    const stepTimer2 = setTimeout(() => setScanStep(3), 2600);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await analyzeInvoice(formData);
      
      if (res.data && res.data.data && res.data.data.invoice_id) {
        const inv = res.data.data;
        setEditData({
          invoice_id: inv.invoice_id,
          store_name: inv.store_name || '',
          store_address: inv.store_address || '',
          date: inv.date || '',
          tax_amount: inv.tax_amount || 0,
          total_amount: inv.total_amount || 0,
          items: Array.isArray(inv.items) && inv.items.length > 0
            ? inv.items.map(it => ({
                item_name: it.item_name || '',
                quantity: it.quantity || 1,
                unit_price: it.unit_price || 0,
                total_price: it.total_price || (it.quantity || 1) * (it.unit_price || 0)
              }))
            : [],
          raw_text: inv.raw_text || '',
          image_path: inv.image_path || ''
        });
        setIsReviewing(true);
      } else {
        alert(lang === 'vi' ? 'Không thể trích xuất hóa đơn. Vui lòng thử lại.' : 'Failed to extract invoice. Please try again.');
      }
    } catch (err) {
      console.error(err);
      const errDetail = err.response?.data?.detail || err.message || '';
      if (errDetail.includes('đã tồn tại')) {
        const match = errDetail.match(/mã(?: hóa đơn)?:?\s*([A-Za-z0-9_]+)/i);
        const dupId = match ? match[1] : null;
        setDuplicateError({
          title: lang === 'vi' ? 'Hóa đơn này đã tồn tại rồi!' : 'This invoice already exists!',
          detail: errDetail,
          invoiceId: dupId
        });
      } else {
        alert(lang === 'vi' ? 'Đã xảy ra lỗi khi quét hóa đơn: ' + errDetail : 'An error occurred while scanning the invoice: ' + errDetail);
      }
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setLoading(false);
    }
  };

  // Review Edit Handlers
  const handleFieldChange = (field, val) => {
    setEditData(prev => ({ ...prev, [field]: val }));
  };

  const handleItemChange = (index, field, val) => {
    setEditData(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index] };
      item[field] = val;
      
      if (field === 'quantity' || field === 'unit_price') {
        const q = field === 'quantity' ? Number(val) || 0 : Number(item.quantity) || 0;
        const u = field === 'unit_price' ? Number(val) || 0 : Number(item.unit_price) || 0;
        item.total_price = q * u;
      }
      
      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  };

  const handleAddItem = () => {
    setEditData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { item_name: '', quantity: 1, unit_price: 0, total_price: 0 }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    setEditData(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const handleRecalculateTotal = () => {
    const sumItems = editData.items.reduce((acc, it) => acc + (Number(it.total_price) || 0), 0);
    const tax = Number(editData.tax_amount) || 0;
    setEditData(prev => ({
      ...prev,
      total_amount: sumItems + tax
    }));
  };

  const handleCancelReview = async () => {
    const confirmMsg = lang === 'vi' 
      ? 'Bạn có chắc chắn muốn hủy phiên quét này? Thông tin chưa lưu sẽ bị xóa.' 
      : 'Are you sure you want to cancel? Unsaved info will be discarded.';
      
    if (window.confirm(confirmMsg)) {
      if (editData.invoice_id) {
        try {
          await deleteInvoice(editData.invoice_id);
        } catch (e) {
          console.error(e);
        }
      }
      setIsReviewing(false);
      setFile(null);
      setPreviewUrl(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!editData.store_name.trim()) {
      alert(lang === 'vi' ? 'Vui lòng nhập tên cửa hàng.' : 'Please enter store name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        invoice_id: editData.invoice_id,
        ocr_confidence: 0.98,
        store_name: editData.store_name.trim(),
        store_address: editData.store_address.trim(),
        date: editData.date.trim(),
        total_amount: Number(editData.total_amount) || 0,
        tax_amount: Number(editData.tax_amount) || 0,
        items: editData.items.map(it => ({
          item_name: it.item_name.trim() || 'Sản phẩm',
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          total_price: Number(it.total_price) || 0
        })),
        raw_text: editData.raw_text,
        image_path: editData.image_path,
        is_submitted: true
      };

      await updateInvoice(editData.invoice_id, payload);
      navigate(`/history/${editData.invoice_id}`);
    } catch (err) {
      console.error(err);
      const errDetail = err.response?.data?.detail || err.message || '';
      if (errDetail.includes('đã tồn tại')) {
        const match = errDetail.match(/mã(?: hóa đơn)?:?\s*([A-Za-z0-9_]+)/i);
        const dupId = match ? match[1] : null;
        setDuplicateError({
          title: lang === 'vi' ? 'Hóa đơn này đã tồn tại rồi!' : 'This invoice already exists!',
          detail: errDetail,
          invoiceId: dupId
        });
      } else {
        alert(lang === 'vi' ? 'Lỗi khi lưu hóa đơn: ' + errDetail : 'Error saving invoice: ' + errDetail);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="scan-page">
      <div className="breadcrumb">
        <Link to="/">{lang === 'vi' ? 'Tổng quan' : 'Dashboard'}</Link> 
        <span>›</span> 
        <Link to="/scan" onClick={(e) => { if (isReviewing) { e.preventDefault(); handleCancelReview(); } }}>
          {lang === 'vi' ? 'Quét hóa đơn' : 'Scan Invoice'}
        </Link>
        {isReviewing && (
          <>
            <span>›</span>
            <span className="current">{lang === 'vi' ? 'Kiểm tra & Xác nhận' : 'Review & Submit'}</span>
          </>
        )}
      </div>

      {/* Thông báo hóa đơn đã tồn tại / trùng lặp */}
      {duplicateError && (
        <div className="scan-duplicate-alert animate-fade-in">
          <div className="scan-dup-icon-wrap">
            <span className="scan-dup-icon">⚠️</span>
          </div>
          <div className="scan-dup-content">
            <div className="scan-dup-header">
              <h3 className="scan-dup-title">{duplicateError.title}</h3>
              <span className="scan-dup-badge">{lang === 'vi' ? 'Trùng lặp' : 'Duplicate'}</span>
            </div>
            <p className="scan-dup-detail">{duplicateError.detail}</p>
            <p className="scan-dup-hint">
              {lang === 'vi' 
                ? 'Hệ thống phát hiện hóa đơn này đã có trong tài khoản của bạn để tránh ghi nhận trùng lặp chi tiêu.' 
                : 'This invoice already exists in your account to prevent duplicate expense records.'}
            </p>
            <div className="scan-dup-actions">
              {duplicateError.invoiceId && (
                <Link to={`/history/${duplicateError.invoiceId}`} className="btn btn-primary btn-sm">
                  🔍 {lang === 'vi' ? 'Xem hóa đơn này trong Lịch sử' : 'View in History'}
                </Link>
              )}
              <button 
                type="button" 
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setDuplicateError(null);
                  setFile(null);
                  setPreviewUrl(null);
                  setIsReviewing(false);
                }}
              >
                🔄 {lang === 'vi' ? 'Quét hóa đơn khác' : 'Scan Another Invoice'}
              </button>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm"
                onClick={() => setDuplicateError(null)}
              >
                ✕ {lang === 'vi' ? 'Đóng thông báo' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="scan-tech-overlay">
          <div className="scan-tech-card">
            {/* Holographic scanner preview */}
            <div className="scan-tech-visual">
              {previewUrl && <img src={previewUrl} alt="Scanning" className="scan-tech-img" />}
              <div className="scan-tech-laser"></div>
              <div className="scan-tech-grid"></div>
            </div>

            <div className="scan-tech-info">
              <h3>{lang === 'vi' ? 'AI Đang Phân Tích Hóa Đơn...' : 'AI Analyzing Invoice...'}</h3>
              <p className="scan-tech-sub">
                {lang === 'vi' ? 'Hệ thống đang chạy mạng nơ-ron nhận diện ký tự & trích xuất bảng biểu' : 'Neural network processing OCR recognition & field extraction'}
              </p>

              {/* Progress step indicators */}
              <div className="scan-steps-list">
                <div className={`scan-step-item ${scanStep >= 1 ? 'active' : ''} ${scanStep > 1 ? 'done' : ''}`}>
                  <span className="step-dot">{scanStep > 1 ? '✓' : '1'}</span>
                  <span>{lang === 'vi' ? 'Tải ảnh & tiền xử lý OpenCV' : 'Image Upload & OpenCV Preprocessing'}</span>
                </div>
                <div className={`scan-step-item ${scanStep >= 2 ? 'active' : ''} ${scanStep > 2 ? 'done' : ''}`}>
                  <span className="step-dot">{scanStep > 2 ? '✓' : (scanStep === 2 ? '⚡' : '2')}</span>
                  <span>{lang === 'vi' ? 'Nhận diện quang học PaddleOCR' : 'PaddleOCR Optical Character Recognition'}</span>
                </div>
                <div className={`scan-step-item ${scanStep >= 3 ? 'active' : ''}`}>
                  <span className="step-dot">{scanStep === 3 ? '✨' : '3'}</span>
                  <span>{lang === 'vi' ? 'Trích xuất thực thể AI (LLM / Parser)' : 'AI Entity Extraction (Store, Items, VAT)'}</span>
                </div>
              </div>

              <div className="scan-progress-bar-wrap">
                <div className="scan-progress-bar-fill" style={{ width: scanStep === 1 ? '35%' : scanStep === 2 ? '70%' : '95%' }}></div>
              </div>
            </div>
          </div>
        </div>
      ) : isReviewing ? (
        /* ======================================================== */
        /* --- BƯỚC 2: KIỂM TRA & CHỈNH SỬA THÔNG TIN TRƯỚC SUBMIT --- */
        /* ======================================================== */
        <div className="scan-review-wrap animate-fade-in">
          {/* Header Notice */}
          <div className="scan-review-notice">
            <div className="scan-review-notice-icon">📝</div>
            <div className="scan-review-notice-text">
              <h4>{lang === 'vi' ? 'Bước kiểm tra & chỉnh sửa thông tin' : 'Verification & Edit Step'}</h4>
              <p>
                {lang === 'vi' 
                  ? 'AI đã nhận diện các trường bên dưới. Bạn có thể kiểm tra và chỉnh sửa lại dữ liệu cho chính xác. Sau khi bấm "Xác nhận & Lưu hóa đơn", hóa đơn sẽ được khóa cố định và không thể chỉnh sửa nữa.' 
                  : 'AI has extracted the fields below. You can verify and edit them. Once submitted, the invoice will be locked and cannot be edited again.'}
              </p>
            </div>
            <div className="scan-review-step-badge">
              <span>{lang === 'vi' ? 'Bước 2 / 2' : 'Step 2 / 2'}</span>
            </div>
          </div>

          {/* Two-Column Grid: Image Preview (Left) vs Form (Right) */}
          <div className="scan-review-grid">
            {/* Left: Original Receipt Preview */}
            <div className="scan-review-col-left">
              <div className="scan-review-card sticky-card">
                <div className="scan-card-header">
                  <h4>📷 {lang === 'vi' ? 'Ảnh hóa đơn gốc' : 'Original Invoice Photo'}</h4>
                  {previewUrl && (
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline"
                      onClick={() => setIsZoomed(!isZoomed)}
                    >
                      {isZoomed ? (lang === 'vi' ? '🔍 Thu nhỏ' : 'Zoom Out') : (lang === 'vi' ? '🔍 Phóng to' : 'Zoom In')}
                    </button>
                  )}
                </div>
                <div className={`scan-review-img-box ${isZoomed ? 'zoomed' : ''}`}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Receipt preview" className="scan-review-img" />
                  ) : (
                    <div className="scan-review-noimg">
                      <span>📄</span>
                      <p>{lang === 'vi' ? 'Không có ảnh xem trước' : 'No image preview'}</p>
                    </div>
                  )}
                </div>
                <div className="scan-review-file-meta">
                  <span>Mã tạm: <strong>{editData.invoice_id}</strong></span>
                  {file && <span>• {(file.size / 1024).toFixed(1)} KB</span>}
                </div>
              </div>
            </div>

            {/* Right: Editable Fields Form */}
            <div className="scan-review-col-right">
              {/* Card 1: Thông tin chung */}
              <div className="scan-review-card">
                <div className="scan-card-header">
                  <h4>🏪 {lang === 'vi' ? 'Thông tin cửa hàng & thời gian' : 'Store & Time Information'}</h4>
                </div>
                <div className="scan-form-grid">
                  <div className="form-group">
                    <label>{lang === 'vi' ? 'Tên cửa hàng / Thương hiệu' : 'Store Name / Brand'} <span className="req">*</span></label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editData.store_name} 
                      onChange={(e) => handleFieldChange('store_name', e.target.value)}
                      placeholder={lang === 'vi' ? 'Ví dụ: Phúc Long, Highlands Coffee...' : 'e.g., Starbucks...'}
                    />
                  </div>

                  <div className="form-group">
                    <label>{lang === 'vi' ? 'Địa chỉ cửa hàng' : 'Store Address'}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editData.store_address} 
                      onChange={(e) => handleFieldChange('store_address', e.target.value)}
                      placeholder={lang === 'vi' ? 'Ví dụ: 514A Lê Trọng Tấn, TP. Hồ Chí Minh' : 'Store address'}
                    />
                  </div>

                  <div className="form-group">
                    <label>{lang === 'vi' ? 'Ngày mua (DD/MM/YYYY)' : 'Date (DD/MM/YYYY)'}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editData.date} 
                      onChange={(e) => handleFieldChange('date', e.target.value)}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>

                  <div className="form-group">
                    <label>{lang === 'vi' ? 'Thuế VAT (VNĐ)' : 'VAT Tax (VND)'}</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={editData.tax_amount} 
                      onChange={(e) => handleFieldChange('tax_amount', e.target.value)}
                      min="0"
                      step="1000"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Danh sách món hàng */}
              <div className="scan-review-card">
                <div className="scan-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4>🛍️ {lang === 'vi' ? 'Danh sách sản phẩm / dịch vụ' : 'Items / Products'} ({editData.items.length})</h4>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline"
                    onClick={handleAddItem}
                  >
                    + {lang === 'vi' ? 'Thêm món' : 'Add Item'}
                  </button>
                </div>

                <div className="scan-items-table-wrap">
                  <table className="scan-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>{lang === 'vi' ? 'Tên món' : 'Item Name'}</th>
                        <th style={{ width: '15%' }}>{lang === 'vi' ? 'SL' : 'Qty'}</th>
                        <th style={{ width: '20%' }}>{lang === 'vi' ? 'Đơn giá (đ)' : 'Price (VND)'}</th>
                        <th style={{ width: '20%' }}>{lang === 'vi' ? 'Thành tiền (đ)' : 'Total (VND)'}</th>
                        <th style={{ width: '5%', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editData.items.length > 0 ? (
                        editData.items.map((it, idx) => (
                          <tr key={idx}>
                            <td>
                              <input 
                                type="text" 
                                className="form-input form-input-sm"
                                value={it.item_name}
                                onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                                placeholder={lang === 'vi' ? 'Tên sản phẩm' : 'Product name'}
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input form-input-sm"
                                value={it.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                min="1"
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input form-input-sm"
                                value={it.unit_price}
                                onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                                min="0"
                                step="1000"
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input form-input-sm font-semibold"
                                value={it.total_price}
                                onChange={(e) => handleItemChange(idx, 'total_price', e.target.value)}
                                min="0"
                                step="1000"
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                type="button" 
                                className="btn-icon-danger"
                                onClick={() => handleRemoveItem(idx)}
                                title={lang === 'vi' ? 'Xóa món này' : 'Delete item'}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                            {lang === 'vi' ? 'Chưa có sản phẩm nào. Bấm "+ Thêm món" để thêm.' : 'No items. Click "+ Add Item" to add.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card 3: Tổng thanh toán */}
              <div className="scan-review-card scan-total-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="scan-total-label">{lang === 'vi' ? 'Tổng thanh toán thực tế:' : 'Total Amount:'}</span>
                    <div className="scan-total-display">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(editData.total_amount || 0)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline"
                      onClick={handleRecalculateTotal}
                      title={lang === 'vi' ? 'Tự động cộng tiền các món hàng + VAT' : 'Recalculate sum of items + VAT'}
                    >
                      ⚡ {lang === 'vi' ? 'Tự tính lại' : 'Auto Recalc'}
                    </button>
                    <div style={{ width: '150px' }}>
                      <input 
                        type="number" 
                        className="form-input font-bold"
                        value={editData.total_amount}
                        onChange={(e) => handleFieldChange('total_amount', e.target.value)}
                        min="0"
                        step="1000"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div className="scan-review-bottom-bar">
                <button 
                  type="button" 
                  className="btn btn-outline"
                  onClick={handleCancelReview}
                  disabled={isSubmitting}
                >
                  ✕ {lang === 'vi' ? 'Hủy & Quét lại' : 'Discard & Re-scan'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-glow"
                  onClick={handleSubmitReview}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    lang === 'vi' ? '⏳ Đang lưu & khóa hóa đơn...' : 'Saving...'
                  ) : (
                    lang === 'vi' ? '✓ Xác nhận & Lưu hóa đơn (Submit)' : '✓ Confirm & Submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* --- BƯỚC 1: TẢI ẢNH HÓA ĐƠN --- */
        /* ======================================================== */
        <>
          <div 
            className={`scan-area ${previewUrl ? 'has-image' : ''} ${isDragging ? 'is-dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !previewUrl && fileInputRef.current.click()}
          >
            {/* Viewfinder HUD Corners */}
            <span className="scan-hud-corner hud-tl"></span>
            <span className="scan-hud-corner hud-tr"></span>
            <span className="scan-hud-corner hud-bl"></span>
            <span className="scan-hud-corner hud-br"></span>

            {previewUrl ? (
              <div className="scan-preview-box">
                <img src={previewUrl} alt="Invoice Preview" className="scan-preview-img" />
                <div className="scan-ambient-laser"></div>
                <div className="scan-file-badge">
                  <span>📄 {file?.name || 'invoice_image.jpg'}</span>
                  <span>•</span>
                  <span>{file ? `${(file.size / 1024).toFixed(1)} KB` : ''}</span>
                </div>
              </div>
            ) : (
              <div className="scan-empty-prompt">
                <div className="scan-animated-icon-wrap">
                  <span className="scan-floating-icon">🧾</span>
                  <span className="scan-pulse-ring"></span>
                </div>
                <h3>{lang === 'vi' ? 'Kéo thả hoặc tải ảnh hóa đơn vào đây' : 'Drag & drop or upload invoice photo here'}</h3>
                <p>{lang === 'vi' ? 'Hỗ trợ định dạng JPG, PNG, WEBP, PDF (Tối đa 10MB)' : 'Supports JPG, PNG, WEBP, PDF (Up to 10MB)'}</p>
                <div className="scan-drag-tip">
                  <span>💡 {lang === 'vi' ? 'Chụp thẳng đứng, đủ ánh sáng để AI nhận diện chính xác 100%' : 'Take a straight, well-lit photo for best accuracy'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="scan-actions">
            <input 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              ref={fileInputRef} 
              onChange={handleFileChange} 
            />
            
            {previewUrl ? (
              <>
                <button className="btn btn-outline" type="button" onClick={() => fileInputRef.current.click()}>
                  🔄 {lang === 'vi' ? 'Đổi ảnh khác' : 'Change Image'}
                </button>
                <button className="btn btn-primary btn-glow" type="button" onClick={handleScan}>
                  ⚡ {lang === 'vi' ? 'Bắt đầu đọc hóa đơn' : 'Scan & Extract'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-glow" type="button" onClick={() => fileInputRef.current.click()}>
                  📷 {lang === 'vi' ? 'Chọn ảnh từ máy' : 'Upload from device'}
                </button>
                <button className="btn btn-outline" type="button" onClick={() => fileInputRef.current.click()}>
                  📁 {lang === 'vi' ? 'Chọn file mẫu' : 'Browse Files'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
