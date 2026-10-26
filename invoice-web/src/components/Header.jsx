import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function Header() {
  const { user, logoutUser } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  
  // User Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Notification Dropdown state
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);

  // Default system notifications
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('app_user_notifications');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'notif-1',
        type: 'invoice',
        title: lang === 'vi' ? 'Hóa đơn đã được đồng bộ' : 'Invoices synchronized',
        message: lang === 'vi' ? 'Các hóa đơn mới đã được phân tích và trích xuất dữ liệu thành công.' : 'New invoices were analyzed and extracted successfully.',
        time: lang === 'vi' ? 'Vừa xong' : 'Just now',
        read: false,
        link: '/history',
        icon: '🧾'
      },
      {
        id: 'notif-2',
        type: 'security',
        title: lang === 'vi' ? 'Bảo mật tài khoản kích hoạt' : 'Privacy shield active',
        message: lang === 'vi' ? 'Cơ chế cô lập dữ liệu người dùng đa tài khoản đang hoạt động an toàn.' : 'Multi-tenant isolation and data privacy are active.',
        time: lang === 'vi' ? '10 phút trước' : '10m ago',
        read: false,
        link: '/settings',
        icon: '🔒'
      },
      {
        id: 'notif-3',
        type: 'trash',
        title: lang === 'vi' ? 'Lưu ý thùng rác' : 'Trash notice',
        message: lang === 'vi' ? 'Các hóa đơn trong thùng rác sẽ được lưu trữ 30 ngày trước khi dọn sạch.' : 'Items in trash will be auto-purged after 30 days.',
        time: lang === 'vi' ? 'Hôm nay' : 'Today',
        read: true,
        link: '/trash',
        icon: '🗑️'
      },
      {
        id: 'notif-4',
        type: 'ai',
        title: lang === 'vi' ? 'Trợ lý AI sẵn sàng' : 'AI Assistant ready',
        message: lang === 'vi' ? 'Bạn có thể hỏi AI về tổng chi tiêu, quán ăn, hoặc so sánh giá tiền.' : 'Ask AI questions about your expenses and stores anytime.',
        time: lang === 'vi' ? 'Hôm qua' : 'Yesterday',
        read: true,
        link: '/ai-chat',
        icon: '✨'
      }
    ];
  });

  // Save notifications to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem('app_user_notifications', JSON.stringify(notifications));
    } catch (e) {
      console.error(e);
    }
  }, [notifications]);

  // Click outside listener for both dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleNotificationClick = (item) => {
    // Mark this item as read
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    setShowNotif(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'MA';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <header className="top-header">
      {/* Notification Bell with Dropdown */}
      <div className="header-notif-container" ref={notifRef} style={{ position: 'relative' }}>
        <button 
          className={`header-notification ${showNotif ? 'is-active' : ''}`}
          title={t('notifications')} 
          type="button"
          onClick={() => {
            setShowNotif(!showNotif);
            setShowDropdown(false);
          }}
          aria-expanded={showNotif}
        >
          <span className="notif-bell-icon">🔔</span>
          {unreadCount > 0 && <span className="notif-pulse-dot"></span>}
        </button>

        {showNotif && (
          <div className="notif-dropdown animate-fade-in">
            {/* Dropdown Header */}
            <div className="notif-dropdown-header">
              <div className="notif-header-title-wrap">
                <h4>{lang === 'vi' ? 'Thông báo' : 'Notifications'}</h4>
                {unreadCount > 0 && (
                  <span className="notif-unread-badge">
                    {unreadCount} {lang === 'vi' ? 'mới' : 'new'}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button 
                  type="button" 
                  className="notif-mark-read-btn"
                  onClick={handleMarkAllAsRead}
                  title={lang === 'vi' ? 'Đánh dấu tất cả đã đọc' : 'Mark all as read'}
                >
                  ✓ {lang === 'vi' ? 'Đã đọc tất cả' : 'Mark read'}
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="notif-dropdown-body">
              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <div 
                    key={item.id} 
                    className={`notif-item ${!item.read ? 'is-unread' : ''}`}
                    onClick={() => handleNotificationClick(item)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="notif-item-icon">
                      {item.icon || '🔔'}
                    </div>
                    <div className="notif-item-content">
                      <div className="notif-item-top">
                        <span className="notif-item-title">{item.title}</span>
                        {!item.read && <span className="notif-item-unread-dot"></span>}
                      </div>
                      <p className="notif-item-msg">{item.message}</p>
                      <span className="notif-item-time">{item.time}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="notif-empty-state">
                  <span style={{ fontSize: '32px' }}>🎉</span>
                  <p>{lang === 'vi' ? 'Bạn đã đọc hết tất cả thông báo!' : 'All caught up! No notifications.'}</p>
                </div>
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="notif-dropdown-footer">
              <button 
                type="button" 
                className="notif-footer-link"
                onClick={() => {
                  setShowNotif(false);
                  navigate('/settings');
                }}
              >
                ⚙️ {lang === 'vi' ? 'Cài đặt thông báo' : 'Notification Settings'}
              </button>
              {notifications.length > 0 && (
                <button 
                  type="button" 
                  className="notif-clear-btn"
                  onClick={handleClearAll}
                >
                  {lang === 'vi' ? 'Xóa tất cả' : 'Clear all'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* User Avatar with Dropdown */}
      <div className="header-avatar-container" ref={dropdownRef} style={{ position: 'relative' }}>
        <div 
          className="header-avatar"
          onClick={() => {
            setShowDropdown(!showDropdown);
            setShowNotif(false);
          }}
          role="button"
          tabIndex={0}
        >
          {getInitials(user?.full_name || user?.username)}
        </div>
        
        {showDropdown && (
          <div className="avatar-dropdown">
            <div className="avatar-dropdown-header">
              <h4>{user?.full_name || user?.username || 'User'}</h4>
              <p>{user?.email || 'user@email.com'}</p>
            </div>
            
            <button className="avatar-dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile'); }}>
              <span>👤</span> <span>{t('profile')}</span>
            </button>
            <button className="avatar-dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings'); }}>
              <span>⚙️</span> <span>{t('settings')}</span>
            </button>
            <button className="avatar-dropdown-item danger" onClick={() => { setShowDropdown(false); handleLogout(); }}>
              <span>🚪</span> <span>{t('logout')}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
