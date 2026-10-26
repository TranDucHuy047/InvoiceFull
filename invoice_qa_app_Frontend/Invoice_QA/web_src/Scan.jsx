import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { analyzeInvoice } from '../services/api';

export default function Scan() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleScan = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await analyzeInvoice(formData);
      
      if (res.data && res.data.data && res.data.data.invoice_id) {
        navigate(`/history/${res.data.data.invoice_id}`);
      } else {
        alert('Không thể trích xuất hóa đơn. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error(err);
      alert('Đã xảy ra lỗi khi quét hóa đơn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scan-page">
      <div className="breadcrumb">
        <Link to="/">Tổng quan</Link> <span>›</span> <span className="current">Quét hóa đơn</span>
      </div>

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <h3>Đang đọc hóa đơn...</h3>
          <p>Hệ thống đang kiểm tra và lấy thông tin từ ảnh của bạn.</p>
        </div>
      ) : (
        <>
          <div className={`scan-area ${previewUrl ? 'has-image' : ''}`}>
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="scan-preview-img" />
            ) : (
              <>
                <div className="scan-placeholder-icon">🧾</div>
                <h3>Chưa có ảnh hóa đơn</h3>
                <p>Chụp ảnh hoặc chọn từ thư viện để bắt đầu.</p>
              </>
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
                <button className="btn btn-outline" onClick={() => fileInputRef.current.click()}>
                  🔄 Đổi ảnh
                </button>
                <button className="btn btn-primary" onClick={handleScan}>
                  🧾 Đọc hóa đơn
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => fileInputRef.current.click()}>
                  📷 Chụp ảnh
                </button>
                <button className="btn btn-outline" onClick={() => fileInputRef.current.click()}>
                  🖼️ Thư viện
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
