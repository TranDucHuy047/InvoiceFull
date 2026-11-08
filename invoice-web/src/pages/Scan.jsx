import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadInvoice, updateInvoice, deleteInvoice } from '../services/api';
import {
  UploadCloud,
  Image as ImageIcon,
  FileText,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
  RotateCcw,
  Eye,
  Cpu,
  Check,
  Store,
  Receipt,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';

export default function Scan() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateAlert, setDuplicateAlert] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState(null);
  const [zoomImage, setZoomImage] = useState(false);

  // Step 2: Extracted invoice state for user verification & editing
  const [extractedInvoice, setExtractedInvoice] = useState(null);
  const [formData, setFormData] = useState({
    store_name: '',
    store_address: '',
    date: '',
    invoice_type: 'Other',
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0,
    items: [],
  });

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file hình ảnh (JPG, PNG, WEBP, ...)');
      return;
    }
    setSelectedFile(file);
    setError('');
    setDuplicateAlert(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Step 1 -> Step 2: Upload & Run OCR
  const handleScan = async (forceOverwrite = false) => {
    if (!selectedFile) {
      setError('Vui lòng chọn ảnh hóa đơn trước khi đọc');
      return;
    }

    setLoading(true);
    setError('');
    if (!forceOverwrite) {
      setDuplicateAlert(null);
    }

    try {
      const res = await uploadInvoice(selectedFile, forceOverwrite);
      const data = res.data?.data || res.data;

      if (data?.invoice_id) {
        setDuplicateAlert(null);
        setExtractedInvoice(data);
        setFormData({
          store_name: data.store_name || '',
          store_address: data.store_address || '',
          date: data.date || '',
          invoice_type: data.invoice_type || 'Other',
          subtotal: Number(data.subtotal) || 0,
          tax_amount: Number(data.tax_amount) || 0,
          total_amount: Number(data.total_amount) || 0,
          items: Array.isArray(data.items)
            ? data.items.map((it) => {
                const itemName = it.item_name || it.name || '';
                return {
                  name: itemName,
                  item_name: itemName,
                  quantity: Number(it.quantity) || 1,
                  unit_price: Number(it.unit_price) || 0,
                  total_price: Number(it.total_price) || 0,
                };
              })
            : [],
        });
        showToast(
          forceOverwrite
            ? 'Đã quét đè hóa đơn thành công! Vui lòng kiểm tra thông tin.'
            : 'Đã đọc hóa đơn! Vui lòng kiểm tra và chỉnh sửa thông tin trước khi lưu.'
        );
      } else {
        setError('Đã xử lý nhưng không nhận được mã hóa đơn');
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 409 && detail && typeof detail === 'object') {
        setDuplicateAlert({
          message: detail.message || 'Hóa đơn này đã tồn tại trong hệ thống.',
          existing_invoice_id: detail.existing_invoice_id,
          store_name: detail.store_name,
          date: detail.date,
          total_amount: detail.total_amount,
        });
      } else if (typeof detail === 'string' && detail.includes('đã tồn tại')) {
        const match = detail.match(/mã(?: hóa đơn)?:?\s*([A-Za-z0-9_]+)/i);
        setDuplicateAlert({
          message: detail,
          existing_invoice_id: match ? match[1] : null,
        });
      } else {
        setError(
          typeof detail === 'string'
            ? detail
            : 'Lỗi khi xử lý hóa đơn. Vui lòng thử lại.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Handlers for editing form fields
  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedItems = [...prev.items];
      const current = { ...updatedItems[index], [field]: value };

      if (field === 'quantity' || field === 'unit_price') {
        const q = Number(field === 'quantity' ? value : current.quantity) || 0;
        const p = Number(field === 'unit_price' ? value : current.unit_price) || 0;
        if (q > 0 && p > 0) {
          current.total_price = Math.round(q * p);
        }
      }

      updatedItems[index] = current;
      return { ...prev, items: updatedItems };
    });
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { name: '', quantity: 1, unit_price: 0, total_price: 0 },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleRecalculateTotal = () => {
    const itemsSum = formData.items.reduce(
      (acc, it) => acc + (Number(it.total_price) || 0),
      0
    );
    const tax = Number(formData.tax_amount) || 0;
    setFormData((prev) => ({
      ...prev,
      subtotal: itemsSum,
      total_amount: itemsSum + tax,
    }));
    showToast('Đã tự động tính lại tổng tiền từ danh sách mặt hàng!');
  };

  // Step 2 -> Final: Submit confirmed & edited invoice
  const handleConfirmSubmit = async (e) => {
    e.preventDefault();
    if (!extractedInvoice?.invoice_id) return;

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        invoice_id: extractedInvoice.invoice_id,
        store_name: formData.store_name.trim() || 'Cửa hàng chưa xác định',
        store_address: formData.store_address.trim(),
        date: formData.date.trim(),
        invoice_type: formData.invoice_type,
        subtotal: Number(formData.subtotal) || 0,
        tax_amount: Number(formData.tax_amount) || 0,
        total_amount: Number(formData.total_amount) || 0,
        items: formData.items
          .filter((it) => (it.name || it.item_name || '').trim() !== '')
          .map((it) => {
            const cleanName = (it.name || it.item_name || '').trim();
            return {
              name: cleanName,
              item_name: cleanName,
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.unit_price) || 0,
              total_price: Number(it.total_price) || 0,
            };
          }),
        raw_text: extractedInvoice.raw_text || '',
        image_path: extractedInvoice.image_path || '',
        is_submitted: true,
      };

      await updateInvoice(extractedInvoice.invoice_id, payload);
      showToast('Đã xác nhận và lưu hóa đơn thành công!');

      setTimeout(() => {
        navigate(`/history/${extractedInvoice.invoice_id}`);
      }, 600);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Không thể lưu thông tin chỉnh sửa. Vui lòng thử lại.'
      );
      setSubmitting(false);
    }
  };

  const handleResetScan = async () => {
    if (extractedInvoice?.invoice_id) {
      try {
        await deleteInvoice(extractedInvoice.invoice_id);
      } catch (e) {
        // Ignore cleanup error
      }
    }
    setExtractedInvoice(null);
    setSelectedFile(null);
    setPreview(null);
    setError('');
    setDuplicateAlert(null);
  };

  const formatVND = (num) => {
    return (Number(num) || 0).toLocaleString('vi-VN') + ' đ';
  };

  return (
    <div className="scan-page scan-page-wide">
      {toast && (
        <div className={`toast ${toast.type}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} strokeWidth={1.75} />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="scan-header-bar">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
            {extractedInvoice
              ? 'Kiểm tra & Xác nhận hóa đơn'
              : 'Quét & Bóc tách hóa đơn AI'}
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {extractedInvoice
              ? 'Đối chiếu ảnh gốc bên trái và chỉnh sửa các trường thông tin bên phải trước khi lưu cố định'
              : 'Tải lên hình ảnh chứng từ để hệ thống OCR và AI tự động nhận diện dữ liệu cấu trúc'}
          </p>
        </div>

        <div className="scan-step-pills">
          <span className={`scan-step-pill ${!extractedInvoice ? 'active' : 'done'}`}>
            <span className="pill-num">1</span> Tải ảnh chứng từ
          </span>
          <span className="scan-step-sep" />
          <span className={`scan-step-pill ${extractedInvoice ? 'active' : ''}`}>
            <span className="pill-num">2</span> Kiểm duyệt & Lưu
          </span>
        </div>
      </div>

      {error && (
        <div className="error-msg" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={17} strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {/* Duplicate Invoice Alert Banner */}
      {duplicateAlert && !loading && !extractedInvoice && (
        <div className="scan-duplicate-alert">
          <div className="scan-dup-icon-wrap" style={{ color: '#d97706' }}>
            <AlertTriangle size={22} strokeWidth={1.75} />
          </div>
          <div className="scan-dup-content">
            <div className="scan-dup-header">
              <h4 className="scan-dup-title">Phát hiện hóa đơn trùng lặp</h4>
              <span className="scan-dup-badge">Đã tồn tại</span>
            </div>
            <p className="scan-dup-detail">{duplicateAlert.message}</p>
            <p className="scan-dup-hint">
              Bạn có thể mở xem hóa đơn đã lưu trước đó, hoặc chọn <strong>Quét đè</strong> nếu muốn cập nhật lại dữ liệu mới.
            </p>
            <div className="scan-dup-actions">
              {duplicateAlert.existing_invoice_id && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: 'auto' }}
                  onClick={() => navigate(`/history/${duplicateAlert.existing_invoice_id}`)}
                >
                  <Eye size={15} strokeWidth={1.75} />
                  Xem hóa đơn đã tồn tại
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleScan(true)}
              >
                <RotateCcw size={15} strokeWidth={1.75} />
                Vẫn tiếp tục quét đè
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetScan}
              >
                Chọn ảnh khác
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LOADING STATE ==================== */}
      {loading ? (
        <div className="scan-tech-overlay">
          <div className="scan-tech-card">
            <div className="scan-tech-visual">
              {preview && (
                <img
                  src={preview}
                  alt="Scanning"
                  className="scan-tech-img"
                />
              )}
              <div className="scan-tech-laser"></div>
              <div className="scan-tech-grid"></div>
              <div className="scan-hud-corner hud-tl"></div>
              <div className="scan-hud-corner hud-tr"></div>
              <div className="scan-hud-corner hud-bl"></div>
              <div className="scan-hud-corner hud-br"></div>
            </div>

            <div className="scan-tech-info">
              <div className="spinner" style={{ margin: '0 auto 14px', width: '40px', height: '40px' }}></div>
              <h3>AI đang phân tích & bóc tách hóa đơn...</h3>
              <p className="scan-tech-sub">
                Quá trình nhận diện ký tự quang học (OCR) và chuẩn hóa dữ liệu mất khoảng 10 - 20 giây
              </p>

              <div className="scan-steps-list">
                <div className="scan-step-item done">
                  <span className="step-dot"><Check size={13} strokeWidth={2.2} /></span>
                  <span>Tiền xử lý ảnh & cân chỉnh phối cảnh</span>
                </div>
                <div className="scan-step-item active">
                  <span className="step-dot"><Cpu size={13} strokeWidth={1.75} /></span>
                  <span>Nhận diện văn bản OCR & trích xuất thông tin AI</span>
                </div>
                <div className="scan-step-item">
                  <span className="step-dot">3</span>
                  <span>Chuẩn bị bảng dữ liệu để bạn kiểm tra</span>
                </div>
              </div>

              <div className="scan-progress-bar-wrap">
                <div
                  className="scan-progress-bar-fill"
                  style={{ width: '75%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      ) : !extractedInvoice ? (
        /* ==================== STEP 1: 2-COLUMN UPLOAD + LIVE PREVIEW ==================== */
        <div className="scan-step1-grid">
          {/* LEFT COLUMN: Dropzone (with buttons inside) + OCR Photography Tips */}
          <div className="scan-left-col">
            <div
              className={`scan-dropzone-card ${isDragging ? 'is-dragging' : ''} ${preview ? 'has-file' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="scan-hud-corner hud-tl"></div>
              <div className="scan-hud-corner hud-tr"></div>
              <div className="scan-hud-corner hud-bl"></div>
              <div className="scan-hud-corner hud-br"></div>

              <div className="scan-dropzone-icon">
                <UploadCloud size={32} strokeWidth={1.75} />
              </div>

              <h3>Kéo thả ảnh hóa đơn vào đây</h3>
              <p className="scan-dropzone-sub">
                Hỗ trợ định dạng JPG, PNG, WEBP rõ nét. Dung lượng tối đa 15MB.
              </p>

              {/* Consolidated Buttons INSIDE Dropzone */}
              <div
                className="scan-dropzone-btns"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: 'auto', padding: '10px 18px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon size={17} strokeWidth={1.75} />
                  Chọn ảnh từ máy
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ width: 'auto', padding: '10px 18px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText size={17} strokeWidth={1.75} />
                  Chọn file mẫu
                </button>
              </div>

              {selectedFile && (
                <div className="scan-selected-pill">
                  <CheckCircle2 size={14} strokeWidth={1.75} style={{ color: 'var(--success)' }} />
                  <span>Đã chọn: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />
            </div>

            {/* OCR Best Practices Checklist Card */}
            <div className="scan-tips-card">
              <div className="scan-tips-header">
                <ShieldCheck size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                <h4>Gợi ý chụp ảnh chuẩn OCR</h4>
              </div>
              <ul className="scan-tips-list">
                <li>
                  <Check size={15} strokeWidth={2} className="tip-check" />
                  <span>Đặt hóa đơn trên mặt phẳng đủ sáng, tránh bóng đổ che khuất chữ số.</span>
                </li>
                <li>
                  <Check size={15} strokeWidth={2} className="tip-check" />
                  <span>Chụp vuông góc toàn bộ mặt hóa đơn (từ tên cửa hàng đến tổng tiền ở đáy).</span>
                </li>
                <li>
                  <Check size={15} strokeWidth={2} className="tip-check" />
                  <span>Đảm bảo các dòng mặt hàng và đơn giá không bị nhòe hoặc gấp nếp.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN: Live Preview & Extraction Action Panel */}
          <div className="scan-right-col">
            <div className="scan-preview-panel">
              <div className="scan-preview-panel-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                  <h4>Xem trước & Kết quả bóc tách</h4>
                </div>
                {preview && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleResetScan}
                  >
                    <RotateCcw size={14} strokeWidth={1.75} />
                    Đổi ảnh khác
                  </button>
                )}
              </div>

              {!preview ? (
                <div className="scan-preview-empty">
                  <div className="scan-empty-illustration">
                    <Receipt size={38} strokeWidth={1.5} />
                  </div>
                  <h4>Chưa có chứng từ nào được chọn</h4>
                  <p>
                    Sau khi bạn tải ảnh hóa đơn ở khung bên trái, bản xem trước chất lượng cao và nút kích hoạt AI OCR sẽ xuất hiện tại đây.
                  </p>
                  <div className="scan-empty-features">
                    <span><Sparkles size={14} strokeWidth={1.75} /> Tự động nhận diện tên siêu thị & MST</span>
                    <span><ListChecks size={14} strokeWidth={1.75} /> Bóc tách chi tiết từng dòng sản phẩm</span>
                  </div>
                </div>
              ) : (
                <div className="scan-preview-ready">
                  <div className="scan-live-img-frame">
                    <img src={preview} alt="Receipt Preview" className="scan-live-img" />
                    <div className="scan-ambient-laser"></div>
                  </div>

                  <div className="scan-ready-footer">
                    <div className="scan-ready-meta">
                      <strong>{selectedFile?.name}</strong>
                      <span>Sẵn sàng phân tích bằng AI OCR</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-glow"
                      style={{ width: '100%', padding: '14px 24px', fontSize: '15px' }}
                      onClick={() => handleScan(false)}
                      disabled={loading}
                    >
                      <Sparkles size={18} strokeWidth={1.75} />
                      Bắt đầu đọc & bóc tách hóa đơn
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ==================== STEP 2: REVIEW & EDIT FORM ==================== */
        <form onSubmit={handleConfirmSubmit} className="scan-review-wrap">
          <div className="scan-review-notice">
            <div className="scan-review-notice-icon" style={{ color: 'var(--primary)', display: 'flex' }}>
              <FileText size={24} strokeWidth={1.75} />
            </div>
            <div className="scan-review-notice-text">
              <h4>Bước kiểm duyệt dữ liệu trước khi lưu</h4>
              <p>
                Hệ thống AI đã bóc tách các trường thông tin bên dưới. Bạn có thể sửa lại bất kỳ ký tự nào bị nhầm lẫn, sau đó nhấn{' '}
                <strong>"Xác nhận & Lưu hóa đơn"</strong> để khóa dữ liệu.
              </p>
            </div>
            <span className="scan-review-step-badge">Bước 2 / 2</span>
          </div>

          <div className="scan-review-grid">
            {/* Left Column: Original Receipt Image */}
            <div className="scan-review-left">
              <div className="scan-review-card sticky-card">
                <div className="scan-card-header">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ImageIcon size={17} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                    Ảnh hóa đơn gốc
                  </h4>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setZoomImage(!zoomImage)}
                  >
                    {zoomImage ? <ZoomOut size={15} strokeWidth={1.75} /> : <ZoomIn size={15} strokeWidth={1.75} />}
                    {zoomImage ? 'Thu nhỏ' : 'Phóng to'}
                  </button>
                </div>

                <div className={`scan-review-img-box ${zoomImage ? 'zoomed' : ''}`}>
                  {preview && (
                    <img
                      src={preview}
                      alt="Invoice Original"
                      className="scan-review-img"
                    />
                  )}
                </div>

                {selectedFile && (
                  <div className="scan-review-file-meta">
                    <span>{selectedFile.name}</span>
                    <span>•</span>
                    <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%', marginTop: '14px' }}
                  onClick={handleResetScan}
                >
                  <RotateCcw size={16} strokeWidth={1.75} />
                  Quét lại ảnh khác
                </button>
              </div>
            </div>

            {/* Right Column: Editable Fields */}
            <div className="scan-review-right">
              {/* General Info Card */}
              <div className="scan-review-card">
                <div className="scan-card-header">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Store size={17} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                    Thông tin chung
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Mã HĐ: #{extractedInvoice.invoice_id?.slice(-8)}
                  </span>
                </div>

                <div className="scan-form-grid">
                  <div className="form-group">
                    <label>Tên cửa hàng / Đơn vị bán *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.store_name}
                      onChange={(e) => handleFieldChange('store_name', e.target.value)}
                      placeholder="Nhập tên cửa hàng..."
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Ngày phát hành hóa đơn</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.date}
                      onChange={(e) => handleFieldChange('date', e.target.value)}
                      placeholder="VD: 23/02/2019 21:50"
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Địa chỉ cửa hàng</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.store_address}
                      onChange={(e) => handleFieldChange('store_address', e.target.value)}
                      placeholder="Nhập địa chỉ trên hóa đơn..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Phân loại hóa đơn</label>
                    <select
                      className="form-input"
                      value={formData.invoice_type}
                      onChange={(e) => handleFieldChange('invoice_type', e.target.value)}
                    >
                      <option value="Supermarket">Siêu thị / Bán lẻ (Supermarket)</option>
                      <option value="Cafe/Restaurant">Nhà hàng / Đồ uống (F&B)</option>
                      <option value="Utility">Hóa đơn tiện ích (Điện, Nước, Viễn thông)</option>
                      <option value="Shopping">Mua sắm (Shopping)</option>
                      <option value="Other">Khác (Other)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Tiền thuế VAT (đ)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.tax_amount}
                      onChange={(e) => handleFieldChange('tax_amount', e.target.value)}
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Card */}
              <div className="scan-review-card">
                <div className="scan-card-header">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ListChecks size={17} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                    Danh sách sản phẩm ({formData.items.length})
                  </h4>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleAddItem}
                  >
                    <Plus size={15} strokeWidth={1.75} />
                    Thêm dòng
                  </button>
                </div>

                {formData.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>
                    Chưa có mặt hàng nào được bóc tách. Nhấn <strong>"Thêm dòng"</strong> để nhập bổ sung.
                  </div>
                ) : (
                  <div className="scan-items-table-wrap">
                    <table className="scan-items-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40%' }}>Tên mặt hàng</th>
                          <th style={{ width: '14%', textAlign: 'center' }}>SL</th>
                          <th style={{ width: '20%', textAlign: 'right' }}>Đơn giá (đ)</th>
                          <th style={{ width: '20%', textAlign: 'right' }}>Thành tiền (đ)</th>
                          <th style={{ width: '6%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                className="form-input form-input-sm"
                                value={item.name}
                                onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                placeholder="Tên sản phẩm..."
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-input form-input-sm"
                                style={{ textAlign: 'center' }}
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                min="1"
                                step="any"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-input form-input-sm"
                                style={{ textAlign: 'right' }}
                                value={item.unit_price}
                                onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                                min="0"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-input form-input-sm"
                                style={{ textAlign: 'right', fontWeight: 600 }}
                                value={item.total_price}
                                onChange={(e) => handleItemChange(idx, 'total_price', e.target.value)}
                                min="0"
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn-icon-danger"
                                onClick={() => handleRemoveItem(idx)}
                                title="Xóa dòng này"
                              >
                                <Trash2 size={14} strokeWidth={1.75} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payment Summary Card */}
              <div className="scan-review-card scan-total-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div className="scan-total-label">Tổng thanh toán cuối cùng (VNĐ) *</div>
                    <div className="scan-total-display">{formatVND(formData.total_amount)}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handleRecalculateTotal}
                      title="Cộng tổng thành tiền các dòng sản phẩm + VAT"
                    >
                      Tính lại từ các mặt hàng
                    </button>
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: '180px', fontWeight: 700, fontSize: '16px', textAlign: 'right' }}
                      value={formData.total_amount}
                      onChange={(e) => handleFieldChange('total_amount', e.target.value)}
                      min="0"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="scan-review-bottom-bar">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleResetScan}
                  disabled={submitting}
                >
                  Hủy & Quét lại
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-glow"
                  style={{ width: 'auto', minWidth: '240px' }}
                  disabled={submitting}
                >
                  <CheckCircle2 size={18} strokeWidth={1.75} />
                  {submitting ? 'Đang lưu & khóa dữ liệu...' : 'Xác nhận & Lưu hóa đơn'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
