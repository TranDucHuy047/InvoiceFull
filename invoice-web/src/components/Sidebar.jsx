import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function Sidebar() {
  const { user, token, logoutUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const getInitials = (name) => {
    if (!name) return "AD";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
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
          <h4>{user?.full_name || user?.username || "User"}</h4>
          <p>{user?.email || "user@email.com"}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({isActive}) => "nav-item " + (isActive ? "active" : "")} end>
          <span className="nav-icon">🏠</span> {t('overview')}
        </NavLink>
        <NavLink to="/scan" className={({isActive}) => "nav-item " + (isActive ? "active" : "")}>
          <span className="nav-icon">📷</span> {t('scan')}
        </NavLink>
        <NavLink to="/history" className={({isActive}) => "nav-item " + (isActive ? "active" : "")}>
          <span className="nav-icon">🕒</span> {t('history')}
        </NavLink>
        <NavLink to="/trash" className={({isActive}) => "nav-item " + (isActive ? "active" : "")}>
          <span className="nav-icon">🗑️</span> {t('trash')}
        </NavLink>
        
        <div style={{ margin: "16px 0", borderTop: "1px solid var(--border-light)" }}></div>

        {user?.role === 'admin' && (
          <a 
            href={`http://localhost:5174/login?token=${token || localStorage.getItem('token') || ''}`}
            target="_blank" 
            rel="noreferrer"
            className="nav-item"
            style={{ 
              backgroundColor: 'rgba(79, 70, 229, 0.1)', 
              color: 'var(--primary)', 
              fontWeight: '700',
              border: '1px solid rgba(79, 70, 229, 0.2)',
              marginBottom: '8px'
            }}
          >
            <span className="nav-icon">🛡️</span> {t('admin_portal')}
          </a>
        )}
        
        <NavLink to="/ai-chat" className={({isActive}) => "nav-item " + (isActive ? "active" : "")}>
          <span className="nav-icon">✨</span> {t('ai_chat')}
        </NavLink>
        <NavLink to="/profile" className={({isActive}) => "nav-item " + (isActive ? "active" : "")}>
          <span className="nav-icon">👤</span> {t('profile')}
        </NavLink>
        <NavLink to="/settings" className={({isActive}) => "nav-item " + (isActive ? "active" : "")}>
          <span className="nav-icon">⚙️</span> {t('settings')}
        </NavLink>
        <NavLink to="/report" className={({isActive}) => "nav-item " + (isActive ? "active" : "")}>
          <span className="nav-icon">🚩</span> {t('report')}
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="sidebar-logout">
          <span className="nav-icon">🚪</span> {t('logout')}
        </button>
        <div className="sidebar-brand-text">{t('brand_version')}</div>
      </div>
    </aside>
  );
}
