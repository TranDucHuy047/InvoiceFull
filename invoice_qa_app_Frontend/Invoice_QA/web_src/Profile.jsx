import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, setUser, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [formData, setFormData] = useState({ 
    full_name: user?.full_name || '', 
    email: user?.email || '' 
  });
  const [loading, setLoading] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'MA';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateProfile(formData);
      setUser({ ...user, ...formData });
      setShowEdit(false);
      alert('Cập nhật thông tin cá nhân thành công!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Lỗi khi cập nhật hồ sơ.');
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
      <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '32px' }}>Hồ sơ cá nhân</h2>

      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar-lg">
            {getInitials(user?.full_name || user?.username)}
          </div>
          <div className="profile-info">
            <h3>{user?.full_name || user?.username || 'User'}</h3>
            <p>{user?.email || 'user@email.com'}</p>
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto', borderRadius: '20px' }} onClick={() => setShowEdit(true)}>
            ✏️ Chỉnh sửa
          </button>
        </div>

        <div className="profile-detail">
          <span className="detail-icon">📅</span>
          <span className="detail-label">Ngày tạo tài khoản</span>
          <span className="detail-value">12/04/2026</span>
        </div>

        <div className="profile-actions">
          <button className="btn btn-primary" onClick={() => navigate('/settings')}>
            🔒 Đổi mật khẩu
          </button>
          <button className="btn btn-outline" onClick={handleLogout}>
            🚪 Đăng xuất
          </button>
          <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: '#FEE2E2', background: '#FEF2F2' }} onClick={() => setShowDelete(true)}>
            👤- Xóa tài khoản
          </button>
        </div>
      </div>

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa thông tin cá nhân</h3>
            </div>
            
            <div className="modal-section">
              <input 
                type="text" 
                className="form-input" 
                placeholder="Họ và tên" 
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                style={{ marginBottom: '16px' }}
              />
              <input 
                type="email" 
                className="form-input" 
                placeholder="Email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            
            <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleUpdate} disabled={loading}>
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Xóa tài khoản?</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              Tài khoản và dữ liệu liên quan sẽ bị xóa. Thao tác này cần xác nhận.
            </p>
            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowDelete(false)}>Hủy</button>
              <button className="btn btn-danger" onClick={() => alert('Chức năng đang phát triển')}>Xóa tài khoản</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
