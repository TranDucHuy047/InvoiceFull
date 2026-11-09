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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export default function Sidebar({ collapsed = false, onToggle }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div
          className="sidebar-logo-brand"
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0 }}
        >
          <div className="sidebar-logo-icon">
            <Receipt size={20} strokeWidth={1.75} />
          </div>
          {!collapsed && <span>Invoice AI</span>}
        </div>

        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggle}
          title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} strokeWidth={1.75} />
          ) : (
            <PanelLeftClose size={18} strokeWidth={1.75} />
          )}
        </button>
      </div>

      <nav className="sidebar-nav" style={{ paddingTop: '16px' }}>
        {!collapsed && <div className="sidebar-nav-group-label">QUẢN LÝ CHỨNG TỪ</div>}
        <NavLink
          to="/"
          end
          title={t('overview')}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><LayoutDashboard size={19} strokeWidth={1.75} /></span>
          {!collapsed && <span className="nav-text">{t('overview')}</span>}
        </NavLink>

        <NavLink
          to="/scan"
          title={t('scan')}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><ScanLine size={19} strokeWidth={1.75} /></span>
          {!collapsed && <span className="nav-text">{t('scan')}</span>}
        </NavLink>

        <NavLink
          to="/history"
          title={t('history')}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><FileClock size={19} strokeWidth={1.75} /></span>
          {!collapsed && <span className="nav-text">{t('history')}</span>}
        </NavLink>

        <NavLink
          to="/trash"
          title={t('trash')}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><Trash2 size={19} strokeWidth={1.75} /></span>
          {!collapsed && <span className="nav-text">{t('trash')}</span>}
        </NavLink>

        <NavLink
          to="/ai-chat"
          title={t('ai_chat')}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><Sparkles size={19} strokeWidth={1.75} /></span>
          {!collapsed && <span className="nav-text">{t('ai_chat')}</span>}
        </NavLink>

        {user?.role === 'admin' && (
          <a
            href={`http://${window.location.hostname || 'localhost'}:5174`}
            target="_blank"
            rel="noopener noreferrer"
            title={t('admin_portal')}
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
            {!collapsed && <span className="nav-text">{t('admin_portal')}</span>}
          </a>
        )}

        <div className="sidebar-nav-divider" />
        {!collapsed && <div className="sidebar-nav-group-label">TÀI KHOẢN & HỆ THỐNG</div>}

        <NavLink
          to="/profile"
          title={t('profile')}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><User size={19} strokeWidth={1.75} /></span>
          {!collapsed && <span className="nav-text">{t('profile')}</span>}
        </NavLink>

        <NavLink
          to="/settings"
          title={t('settings')}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><Settings size={19} strokeWidth={1.75} /></span>
          {!collapsed && <span className="nav-text">{t('settings')}</span>}
        </NavLink>

        <NavLink
          to="/report"
          title={t('report')}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><Flag size={19} strokeWidth={1.75} /></span>
          {!collapsed && <span className="nav-text">{t('report')}</span>}
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={handleLogout} title={t('logout')}>
          <LogOut size={18} strokeWidth={1.75} />
          {!collapsed && <span>{t('logout')}</span>}
        </button>
        {!collapsed && <div className="sidebar-brand-text">{t('brand_version')}</div>}
      </div>
    </aside>
  );
}
