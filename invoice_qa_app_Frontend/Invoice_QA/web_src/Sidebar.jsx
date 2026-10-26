import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'MA';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🧾</div>
        <span>Invoice AI</span>
      </div>

      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {getInitials(user?.full_name || user?.username)}
        </div>
        <div className="sidebar-user-info">
          <h4>{user?.full_name || user?.username || 'User'}</h4>
          <p>{user?.email || 'user@email.com'}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
          <span className="nav-icon">🏠</span> Tổng quan
        </NavLink>
        <NavLink to="/scan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">📷</span> Quét hóa đơn
        </NavLink>
        <NavLink to="/history" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🕒</span> Lịch sử hóa đơn
        </NavLink>
        <NavLink to="/trash" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🗑️</span> Lịch sử xóa
        </NavLink>
        
        <div style={{ margin: '16px 0', borderTop: '1px solid var(--border-light)' }}></div>
        
        <NavLink to="/profile" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">👤</span> Hồ sơ
        </NavLink>
        <NavLink to="/settings" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">⚙️</span> Cài đặt
        </NavLink>
        <NavLink to="/report" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🚩</span> Báo cáo / Hỗ trợ
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="sidebar-logout">
          <span className="nav-icon">🚪</span> Đăng xuất
        </button>
        <div className="sidebar-brand-text">Invoice AI Version 1.0</div>
      </div>
    </aside>
  );
}
