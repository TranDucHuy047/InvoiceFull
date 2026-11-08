import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile, deleteAccount, changePassword } from '../services/api';
import {
  User,
  Mail,
  Calendar,
  AtSign,
  Edit3,
  Lock,
  KeyRound,
  ShieldAlert,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Inline Change Password State
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState(null); // { type: 'error' | 'success', text: '' }

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(fullName, email);
      await refreshUser();
      setShowEditModal(false);
      showToast('Cập nhật hồ sơ thành công!');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Lỗi cập nhật hồ sơ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMessage(null);
    if (newPw.length < 6) {
      setPwMessage({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(currentPw, newPw);
      setPwMessage({
        type: 'success',
        text: 'Đổi mật khẩu thành công! Đang chuyển về trang đăng nhập...',
      });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 1500);
    } catch (err) {
      setPwMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Mật khẩu hiện tại không chính xác.',
      });
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      setShowDeleteModal(false);
      showToast('Yêu cầu xóa tài khoản đã được gửi tới quản trị viên.');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Không thể gửi yêu cầu xóa tài khoản', 'error');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Chưa rõ';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('vi-VN');
  };

  return (
    <div className="profile-page">
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

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Hồ sơ tài khoản</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Quản lý thông tin định danh cá nhân, bảo mật mật khẩu và quyền riêng tư tài khoản
        </p>
      </div>

      {/* Balanced 2-Column Layout */}
      <div className="profile-grid-2col">
        {/* LEFT COLUMN: Personal Info Card (No redundant Logout button) */}
        <div className="profile-card" style={{ maxWidth: 'none' }}>
          <div className="profile-card-section-head">
            <User size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
            <h4>Thông tin cá nhân</h4>
          </div>

          <div className="profile-header">
            <div className="profile-avatar-lg">
              {getInitials(user?.full_name || user?.username)}
            </div>
            <div className="profile-info">
              <h3>{user?.full_name || user?.username}</h3>
              <p>@{user?.username}</p>
              <span className="profile-role-badge">
                {user?.role === 'admin' ? 'Quản trị viên' : 'Tài khoản tiêu chuẩn'}
              </span>
            </div>
          </div>

          <div className="profile-detail">
            <span className="detail-icon"><User size={17} strokeWidth={1.75} /></span>
            <span className="detail-label">Họ và tên</span>
            <span className="detail-value">{user?.full_name || 'Chưa cập nhật'}</span>
          </div>

          <div className="profile-detail">
            <span className="detail-icon"><AtSign size={17} strokeWidth={1.75} /></span>
            <span className="detail-label">Tên đăng nhập</span>
            <span className="detail-value">{user?.username}</span>
          </div>

          <div className="profile-detail">
            <span className="detail-icon"><Mail size={17} strokeWidth={1.75} /></span>
            <span className="detail-label">Địa chỉ Email</span>
            <span className="detail-value">{user?.email || 'Chưa cập nhật'}</span>
          </div>

          <div className="profile-detail">
            <span className="detail-icon"><Calendar size={17} strokeWidth={1.75} /></span>
            <span className="detail-label">Ngày tham gia</span>
            <span className="detail-value">{formatDate(user?.created_at)}</span>
          </div>

          <div className="profile-actions" style={{ marginTop: '24px' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => {
                setFullName(user?.full_name || '');
                setEmail(user?.email || '');
                setShowEditModal(true);
              }}
            >
              <Edit3 size={17} strokeWidth={1.75} />
              Chỉnh sửa thông tin cá nhân
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Security & Password + Danger Zone */}
        <div className="profile-right-stack">
          {/* Security & Change Password Card */}
          <div className="profile-card" style={{ maxWidth: 'none' }}>
            <div className="profile-card-section-head">
              <Lock size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
              <h4>Bảo mật &amp; Đổi mật khẩu</h4>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Sử dụng mật khẩu mạnh tối thiểu 6 ký tự để bảo vệ dữ liệu hóa đơn của bạn.
            </p>

            {pwMessage && (
              <div
                className={`stg-alert ${
                  pwMessage.type === 'error' ? 'stg-alert-error' : 'stg-alert-success'
                }`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {pwMessage.type === 'error' ? (
                  <AlertTriangle size={16} strokeWidth={1.75} />
                ) : (
                  <CheckCircle2 size={16} strokeWidth={1.75} />
                )}
                <span>{pwMessage.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="stg-pw-form">
              <label>Mật khẩu hiện tại</label>
              <div className="stg-pw-field">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu hiện tại..."
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="stg-pw-eye"
                  onClick={() => setShowPw(!showPw)}
                  title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPw ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              </div>

              <div className="profile-pw-grid">
                <div>
                  <label style={{ marginTop: '14px' }}>Mật khẩu mới</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ marginTop: '14px' }}>Xác nhận mật khẩu mới</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '10px 22px' }}
                  disabled={pwLoading}
                >
                  <KeyRound size={16} strokeWidth={1.75} />
                  {pwLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone Card */}
          <div className="profile-card profile-danger-card" style={{ maxWidth: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
                  <ShieldAlert size={18} strokeWidth={1.75} />
                  Khu vực nguy hiểm
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Xóa vĩnh viễn tài khoản và toàn bộ hóa đơn, lịch sử trò chuyện AI của bạn khỏi hệ thống.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => setShowDeleteModal(true)}
                style={{ alignSelf: 'center' }}
              >
                <Trash2 size={15} strokeWidth={1.75} />
                Xóa tài khoản
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa hồ sơ</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label>Họ và tên</label>
                <input
                  type="text"
                  className="form-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <AlertTriangle size={20} strokeWidth={1.75} />
                Xác nhận xóa tài khoản
              </h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
              Hành động này không thể hoàn tác. Tất cả dữ liệu hóa đơn và thông tin cá nhân của bạn sẽ bị xóa vĩnh viễn.
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowDeleteModal(false)}>
                Hủy
              </button>
              <button className="btn btn-danger" onClick={handleDeleteAccount}>
                <Trash2 size={16} strokeWidth={1.75} />
                Xóa tài khoản vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
