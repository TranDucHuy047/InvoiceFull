import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Receipt,
  LayoutDashboard,
  ScanLine,
  FileClock,
  Trash2,
  ShieldCheck,
  Sparkles,
  User,
  Settings,
  Flag,
  LogOut,
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" onClick={() => navigate('/')}>
        <div className="sidebar-logo-icon">
          <Receipt size={20} strokeWidth={1.75} />
        </div>
        <span>Invoice AI</span>
      </div>

      <nav className="sidebar-nav" style={{ paddingTop: '16px' }}>
        <div className="sidebar-nav-group-label">QUẢN LÝ CHỨNG TỪ</div>
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon"><LayoutDashboard size={19} strokeWidth={1.75} /></span>
          {t('overview')}
        </NavLink>

        <NavLink to="/scan" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon"><ScanLine size={19} strokeWidth={1.75} /></span>
          {t('scan')}
        </NavLink>

        <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon"><FileClock size={19} strokeWidth={1.75} /></span>
          {t('history')}
        </NavLink>

        <NavLink to="/trash" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon"><Trash2 size={19} strokeWidth={1.75} /></span>
          {t('trash')}
        </NavLink>

        <NavLink to="/ai-chat" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon"><Sparkles size={19} strokeWidth={1.75} /></span>
          {t('ai_chat')}
        </NavLink>

        {user?.role === 'admin' && (
          <a
            href={`http://${window.location.hostname}:5174`}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-item"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))',
              color: '#818cf8',
              fontWeight: 600,
              border: '1px solid rgba(99, 102, 241, 0.25)',
              marginTop: '6px',
              marginBottom: '6px',
            }}
          >
            <span className="nav-icon"><ShieldCheck size={19} strokeWidth={1.75} /></span>
            {t('admin_portal')}
          </a>
        )}

        <div className="sidebar-nav-divider" />
        <div className="sidebar-nav-group-label">TÀI KHOẢN & HỆ THỐNG</div>

        <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon"><User size={19} strokeWidth={1.75} /></span>
          {t('profile')}
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon"><Settings size={19} strokeWidth={1.75} /></span>
          {t('settings')}
        </NavLink>

        <NavLink to="/report" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon"><Flag size={19} strokeWidth={1.75} /></span>
          {t('report')}
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={18} strokeWidth={1.75} />
          <span>{t('logout')}</span>
        </button>
        <div className="sidebar-brand-text">{t('brand_version')}</div>
      </div>
    </aside>
  );
}
