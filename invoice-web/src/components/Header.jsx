import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getInvoices, getTrashInvoices } from '../services/api';
import {
  Bell,
  BellOff,
  Search,
  ChevronRight,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Receipt,
  CheckCircle2,
  Trash2,
  Sparkles,
  Home,
} from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [quickQuery, setQuickQuery] = useState('');

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  // Breadcrumb mapping
  const getBreadcrumbInfo = () => {
    const path = location.pathname;
    if (path === '/') return { section: 'Bảng điều khiển', current: t('overview') };
    if (path === '/scan') return { section: 'Quản lý chứng từ', current: t('scan') };
    if (path === '/history') return { section: 'Quản lý chứng từ', current: t('history') };
    if (path.startsWith('/history/')) return { section: t('history'), parentPath: '/history', current: t('invoice_detail_title') };
    if (path === '/trash') return { section: 'Quản lý chứng từ', current: t('trash') };
    if (path === '/ai-chat') return { section: 'Trợ lý thông minh', current: t('ai_chat') };
    if (path === '/profile') return { section: 'Tài khoản', current: t('profile') };
    if (path === '/settings') return { section: 'Hệ thống', current: t('settings') };
    if (path === '/report') return { section: 'Hỗ trợ', current: t('report') };
    return { section: 'Hệ thống', current: 'Tổng quan' };
  };

  const breadcrumb = getBreadcrumbInfo();

  const handleQuickSearch = (e) => {
    e.preventDefault();
    const trimmed = quickQuery.trim();
    const targetBase = location.pathname.startsWith('/trash') ? '/trash' : '/history';
    if (trimmed) {
      navigate(`${targetBase}?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate(targetBase);
    }
  };

  // Build smart notifications from real invoice & trash data + localStorage read state
  const loadNotifications = async () => {
    const notifsEnabled = localStorage.getItem('app_notifications') !== 'false';
    if (!notifsEnabled) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const readIds = JSON.parse(localStorage.getItem('read_notif_ids') || '[]');
      const [invRes, trashRes] = await Promise.allSettled([
        getInvoices({ limit: 5 }),
        getTrashInvoices(),
      ]);

      const items = [];

      if (invRes.status === 'fulfilled') {
        const invoices = invRes.value.data?.data || invRes.value.data || [];
        invoices.slice(0, 4).forEach((inv) => {
          const id = `inv_${inv.invoice_id}`;
          items.push({
            id,
            iconType: inv.is_submitted ? 'verified' : 'invoice',
            title: inv.is_submitted ? 'Hóa đơn đã xác nhận' : 'Hóa đơn mới được quét',
            message: `${inv.store_name || 'Cửa hàng'} — ${Number(inv.total_amount || 0).toLocaleString('vi-VN')} đ`,
            time: inv.date || 'Gần đây',
            link: `/history/${inv.invoice_id}`,
            read: readIds.includes(id),
          });
        });
      }

      if (trashRes.status === 'fulfilled') {
        const trashed = trashRes.value.data?.data || trashRes.value.data || [];
        if (trashed.length > 0) {
          const id = `trash_count_${trashed.length}`;
          items.push({
            id,
            iconType: 'trash',
            title: 'Lịch sử xóa',
            message: `Đang có ${trashed.length} hóa đơn trong thùng rác chờ dọn dẹp`,
            time: 'Hệ thống',
            link: '/trash',
            read: readIds.includes(id),
          });
        }
      }

      const welcomeId = 'sys_welcome_v1';
      items.push({
        id: welcomeId,
        iconType: 'ai',
        title: 'Trợ lý AI sẵn sàng',
        message: 'Bấm vào mục Hỏi AI để tra cứu và phân tích chi tiêu thông minh.',
        time: 'Hệ thống',
        link: '/ai-chat',
        read: readIds.includes(welcomeId),
      });

      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    } catch (err) {
      console.error('Lỗi tải thông báo:', err);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleNotif = () => {
    const nextState = !notifOpen;
    setNotifOpen(nextState);
    setDropdownOpen(false);
    if (nextState) {
      loadNotifications();
    }
  };

  const markAsRead = (id) => {
    const readIds = JSON.parse(localStorage.getItem('read_notif_ids') || '[]');
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      localStorage.setItem('read_notif_ids', JSON.stringify(updated));
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const existing = JSON.parse(localStorage.getItem('read_notif_ids') || '[]');
    const merged = Array.from(new Set([...existing, ...allIds]));
    localStorage.setItem('read_notif_ids', JSON.stringify(merged));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearAllNotifications = () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tất cả thông báo?')) return;
    markAllAsRead();
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleNotifClick = (notif) => {
    markAsRead(notif.id);
    setNotifOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const renderNotifIcon = (iconType) => {
    switch (iconType) {
      case 'verified':
        return <CheckCircle2 size={18} strokeWidth={1.75} style={{ color: 'var(--success)' }} />;
      case 'trash':
        return <Trash2 size={18} strokeWidth={1.75} style={{ color: 'var(--danger)' }} />;
      case 'ai':
        return <Sparkles size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />;
      default:
        return <Receipt size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />;
    }
  };

  return (
    <header className="top-header">
      {/* Left: Dynamic Breadcrumb & Quick Search */}
      <div className="top-header-left">
        <nav className="header-breadcrumb" aria-label="Breadcrumb">
          <Link to="/" className="header-bc-home" title="Trang tổng quan">
            <Home size={16} strokeWidth={1.75} />
          </Link>
          <ChevronRight size={14} strokeWidth={1.75} className="header-bc-sep" />
          {breadcrumb.parentPath ? (
            <Link to={breadcrumb.parentPath} className="header-bc-section">
              {breadcrumb.section}
            </Link>
          ) : (
            <span className="header-bc-section">{breadcrumb.section}</span>
          )}
          <ChevronRight size={14} strokeWidth={1.75} className="header-bc-sep" />
          <span className="header-bc-current">{breadcrumb.current}</span>
        </nav>

        <form className="header-quick-search" onSubmit={handleQuickSearch}>
          <Search size={16} strokeWidth={1.75} className="header-search-icon" />
          <input
            type="text"
            placeholder={
              location.pathname.startsWith('/trash')
                ? 'Tìm nhanh trong lịch sử xóa...'
                : 'Tìm nhanh cửa hàng, mã HĐ...'
            }
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
          />
        </form>
      </div>

      {/* Right: Notification Bell + User Profile Pill */}
      <div className="top-header-right">
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            className="header-notification"
            title={t('notifications')}
            onClick={handleToggleNotif}
          >
            <span className="notif-bell-icon" style={{ display: 'flex' }}>
              <Bell size={19} strokeWidth={1.75} />
            </span>
            {unreadCount > 0 && <span className="notif-pulse-dot"></span>}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-dropdown-header">
                <div className="notif-header-title-wrap">
                  <h4>{t('notifications') || 'Thông báo'}</h4>
                  {unreadCount > 0 && (
                    <span className="notif-unread-badge">{unreadCount} mới</span>
                  )}
                </div>
                {notifications.length > 0 && unreadCount > 0 && (
                  <button className="notif-mark-read-btn" onClick={markAllAsRead}>
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>

              <div className="notif-dropdown-body">
                {notifications.length === 0 ? (
                  <div className="notif-empty-state">
                    <span style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
                      <BellOff size={28} strokeWidth={1.75} />
                    </span>
                    <p>Không có thông báo mới</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${!n.read ? 'is-unread' : ''}`}
                      onClick={() => handleNotifClick(n)}
                    >
                      <div className="notif-item-icon">{renderNotifIcon(n.iconType)}</div>
                      <div className="notif-item-content">
                        <div className="notif-item-top">
                          <span className="notif-item-title">{n.title}</span>
                          {!n.read && <span className="notif-item-unread-dot"></span>}
                        </div>
                        <p className="notif-item-msg">{n.message}</p>
                        <span className="notif-item-time">{n.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="notif-dropdown-footer">
                  <button
                    className="notif-footer-link"
                    onClick={() => {
                      setNotifOpen(false);
                      navigate('/settings');
                    }}
                     style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Settings size={14} strokeWidth={1.75} />
                    Cài đặt thông báo
                  </button>
                  <button className="notif-clear-btn" onClick={clearAllNotifications}>
                    Xóa tất cả
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            className="header-user-pill"
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setNotifOpen(false);
            }}
          >
            <div className="header-avatar">
              {getInitials(user?.full_name || user?.username)}
            </div>
            <div className="header-user-meta">
              <span className="header-user-name">{user?.full_name || user?.username}</span>
              <span className="header-user-sub">{user?.email || 'Tài khoản cá nhân'}</span>
            </div>
            <ChevronDown size={16} strokeWidth={1.75} className="header-user-chevron" />
          </button>

          {dropdownOpen && (
            <div className="avatar-dropdown">
              <div className="avatar-dropdown-header">
                <h4>{user?.full_name || user?.username}</h4>
                <p>{user?.email || ''}</p>
              </div>
              <button
                className="avatar-dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/profile');
                }}
              >
                <User size={17} strokeWidth={1.75} />
                {t('profile')}
              </button>
              <button
                className="avatar-dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/settings');
                }}
              >
                <Settings size={17} strokeWidth={1.75} />
                {t('settings')}
              </button>
              <button className="avatar-dropdown-item danger" onClick={handleLogout}>
                <LogOut size={17} strokeWidth={1.75} />
                {t('logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
