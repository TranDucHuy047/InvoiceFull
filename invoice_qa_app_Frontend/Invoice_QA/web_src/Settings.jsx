import { useState } from 'react';
import { changePassword } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { logoutUser } = useAuth();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwData, setPwData] = useState({ old_password: '', new_password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async () => {
    if (pwData.new_password !== pwData.confirm) {
      alert('Mật khẩu xác nhận không khớp');
      return;
    }
    
    setLoading(true);
    try {
      await changePassword(pwData.old_password, pwData.new_password);
      setShowPasswordModal(false);
      setPwData({ old_password: '', new_password: '', confirm: '' });
      alert('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
      logoutUser();
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.detail || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '32px' }}>Cài đặt</h2>

      <div className="settings-list">
        <div className="settings-item">
          <div className="settings-item-left">
            <h4>Giao diện</h4>
            <p>Sáng</p>
          </div>
          <div className="settings-item-right">☀️</div>
        </div>

        <div className="settings-item">
          <div className="settings-item-left">
            <h4>Ngôn ngữ</h4>
            <p>Tiếng Việt</p>
          </div>
          <div className="settings-item-right">A文</div>
        </div>

        <div className="settings-item">
          <div className="settings-item-left">
            <h4>Tự động chuyển sang văn bản</h4>
            <p>Sau khi đọc hóa đơn xong, tự mở phần Văn bản hóa đơn.</p>
          </div>
          <div className="settings-item-right">
            <label className="toggle">
              <input type="checkbox" />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-left">
            <h4>Thông báo</h4>
          </div>
          <div className="settings-item-right">
            <label className="toggle">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-item" style={{ cursor: 'pointer' }} onClick={() => setShowPasswordModal(true)}>
          <div className="settings-item-left">
            <h4>Đổi mật khẩu</h4>
          </div>
          <div className="settings-item-right">›</div>
        </div>

        <div className="settings-item" style={{ cursor: 'pointer' }} onClick={handleLogout}>
          <div className="settings-item-left">
            <h4 style={{ color: 'var(--danger)' }}>Đăng xuất</h4>
          </div>
          <div className="settings-item-right">›</div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Đổi mật khẩu</h3>
            </div>
            
            <div className="modal-section">
              <input 
                type="password" 
                className="form-input" 
                placeholder="Mật khẩu hiện tại" 
                value={pwData.old_password}
                onChange={e => setPwData({...pwData, old_password: e.target.value})}
                style={{ marginBottom: '16px' }}
              />
              <input 
                type="password" 
                className="form-input" 
                placeholder="Mật khẩu mới" 
                value={pwData.new_password}
                onChange={e => setPwData({...pwData, new_password: e.target.value})}
                style={{ marginBottom: '16px' }}
              />
              <input 
                type="password" 
                className="form-input" 
                placeholder="Xác nhận mật khẩu mới" 
                value={pwData.confirm}
                onChange={e => setPwData({...pwData, confirm: e.target.value})}
              />
            </div>
            
            <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-ghost" onClick={() => setShowPasswordModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handlePasswordChange} disabled={loading}>
                {loading ? 'Đang lưu...' : 'Cập nhật mật khẩu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
