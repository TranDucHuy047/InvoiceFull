import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      <button className="header-notification">
        🔔
      </button>
      
      <div className="header-avatar-container" ref={dropdownRef} style={{ position: 'relative' }}>
        <div 
          className="header-avatar"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          {getInitials(user?.full_name || user?.username)}
        </div>
        
        {showDropdown && (
          <div className="avatar-dropdown">
            <div className="avatar-dropdown-header">
              <h4>{user?.full_name || user?.username || 'User'}</h4>
              <p>{user?.email || 'user@email.com'}</p>
            </div>
            
            <button className="avatar-dropdown-item" onClick={() => navigate('/profile')}>
              👤 Hồ sơ
            </button>
            <button className="avatar-dropdown-item" onClick={() => navigate('/settings')}>
              ⚙️ Cài đặt
            </button>
            <button className="avatar-dropdown-item danger" onClick={handleLogout}>
              🚪 Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
