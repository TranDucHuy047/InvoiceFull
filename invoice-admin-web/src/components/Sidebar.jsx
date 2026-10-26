import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, User, ReceiptText, 
  MessageCircleQuestion, Database, LogOut, Receipt
} from 'lucide-react';

const menuItems = [
  { path: '/dashboard', name: 'Tổng quan', icon: <LayoutDashboard size={20} /> },
  { path: '/users', name: 'Quản lý tài khoản', icon: <User size={20} /> },
  { path: '/invoices', name: 'Quản lý hóa đơn', icon: <ReceiptText size={20} /> },
  { path: '/errors', name: 'Xử lý lỗi khách hàng', icon: <MessageCircleQuestion size={20} /> },
  { path: '/backup', name: 'Sao lưu / Khôi phục', icon: <Database size={20} /> },
];

export default function Sidebar() {
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = 'http://localhost:5173/login?logout=true';
  };

  return (
    <div style={{
      width: '260px', 
      height: '100vh', 
      backgroundColor: '#FFFFFF',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 10
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px', marginBottom: '8px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'var(--primary)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Receipt size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>Invoice <span style={{color: 'var(--primary)'}}>AI</span></h2>
        </div>
      </div>
      <div style={{ padding: '0 8px', marginBottom: '24px' }}>
        <span style={{
          fontSize: '10px', fontWeight: '800', color: 'var(--primary)',
          background: 'var(--secondary)', padding: '4px 8px', borderRadius: '4px'
        }}>ADMIN WEB</span>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px', borderRadius: '12px',
            color: 'var(--primary)', backgroundColor: 'var(--secondary)',
            fontWeight: '700', textDecoration: 'none',
            fontSize: '13px', marginBottom: '8px'
          }}
        >
          <span>📱</span> Mở Web Khách Hàng
        </a>

        {menuItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '14px 16px', borderRadius: '12px',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              backgroundColor: isActive ? 'var(--secondary)' : 'transparent',
              fontWeight: isActive ? '700' : '500',
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            })}
          >
            {item.icon}
            <span style={{ fontSize: '14px' }}>{item.name}</span>
          </NavLink>
        ))}
      </div>

      {/* Logout */}
      <div style={{ marginTop: 'auto' }}>
        <button 
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            padding: '14px 16px', borderRadius: '12px',
            color: 'var(--danger)', backgroundColor: 'transparent',
            fontWeight: '600', border: 'none', cursor: 'pointer', width: '100%',
            fontSize: '14px', textAlign: 'left'
          }}
        >
          <LogOut size={20} />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
