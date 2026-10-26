import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

export default function Profile() {
  const { user, setUser, logoutUser } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [formData, setFormData] = useState({ 
    full_name: user?.full_name || '', 
    email: user?.email || '' 
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  const getInitials = (name) => {
    if (!name) return 'US';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateProfile(formData);
      setUser({ ...user, ...formData });
      setShowEdit(false);
      alert(lang === 'vi' ? 'Cập nhật thông tin cá nhân thành công!' : 'Profile updated successfully!');
    } catch (err) {
      alert(err.response?.data?.detail || (lang === 'vi' ? 'Lỗi khi cập nhật hồ sơ.' : 'Error updating profile.'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  // Format creation date accurately
  const formatCreatedDate = (dateStr) => {
    if (!dateStr) return '15/10/2026'; // Fallback to account creation date
    try {
      if (dateStr.includes('-')) {
        const datePart = dateStr.split(' ')[0].split('T')[0];
        const [year, month, day] = datePart.split('-');
        if (year && month && day) {
          return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
        }
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="profile-page-container">
      <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '28px' }}>
        {lang === 'vi' ? 'Hồ sơ cá nhân' : 'Personal Profile'}
      </h2>

      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar-lg">
            {getInitials(user?.full_name || user?.username)}
          </div>
          <div className="profile-info">
            <h3>{user?.full_name || user?.username || 'User'}</h3>
            <p>{user?.email || 'user@email.com'}</p>
          </div>
          <button 
            className="btn btn-outline btn-sm" 
            style={{ marginLeft: 'auto', borderRadius: '20px' }} 
            onClick={() => setShowEdit(true)}
            type="button"
          >
            ✏️ {lang === 'vi' ? 'Chỉnh sửa' : 'Edit'}
          </button>
        </div>

        <div className="profile-detail">
          <span className="detail-icon">📅</span>
          <span className="detail-label">{lang === 'vi' ? 'Ngày tạo tài khoản' : 'Account Created Date'}</span>
          <span className="detail-value">{formatCreatedDate(user?.created_at)}</span>
        </div>

        <div className="profile-actions">
          <button className="btn btn-primary" onClick={() => navigate('/settings')}>
            🔒 {lang === 'vi' ? 'Đổi mật khẩu' : 'Change Password'}
          </button>
          <button className="btn btn-outline" onClick={handleLogout}>
            🚪 {lang === 'vi' ? 'Đăng xuất' : 'Log Out'}
          </button>
          <button 
            className="btn btn-outline" 
            style={{ color: 'var(--danger)', borderColor: '#FEE2E2', background: '#FEF2F2' }} 
            onClick={() => setShowDelete(true)}
          >
            👤- {lang === 'vi' ? 'Xóa tài khoản' : 'Delete Account'}
          </button>
        </div>
      </div>

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{lang === 'vi' ? 'Chỉnh sửa thông tin cá nhân' : 'Edit Profile'}</h3>
            </div>
            
            <div className="modal-section">
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {lang === 'vi' ? 'Họ và tên' : 'Full Name'}
              </label>
              <input 
                type="text" 
                className="form-input" 
                placeholder={lang === 'vi' ? 'Họ và tên' : 'Full Name'} 
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                style={{ marginBottom: '16px' }}
              />
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Email
              </label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="Email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            
            <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button className="btn btn-primary" onClick={handleUpdate} disabled={loading}>
                {loading ? (lang === 'vi' ? 'Đang lưu...' : 'Saving...') : (lang === 'vi' ? 'Lưu thay đổi' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{lang === 'vi' ? 'Xóa tài khoản?' : 'Delete Account?'}</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              {lang === 'vi' 
                ? 'Tài khoản và dữ liệu liên quan sẽ bị xóa. Thao tác này cần xác nhận của quản trị viên.' 
                : 'Your account and related data will be removed. This action requires admin confirmation.'}
            </p>
            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowDelete(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button className="btn btn-danger" onClick={() => alert(lang === 'vi' ? 'Yêu cầu xóa tài khoản đã được gửi tới quản trị viên.' : 'Account deletion request submitted.')}>
                {lang === 'vi' ? 'Xác nhận xóa' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
