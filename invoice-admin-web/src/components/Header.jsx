import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

export default function Header({ title, subtitle }) {
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    axiosClient.get('/auth/me')
      .then(res => {
        if (res.data?.data) {
          setAdminUser(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  const getInitials = (name) => {
    if (!name) return 'AD';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const displayName = adminUser?.full_name || adminUser?.username || 'Administrator';
  const displayRole = adminUser?.role === 'admin' ? 'Quản trị hệ thống' : 'Người dùng';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '32px',
      paddingBottom: '24px',
      borderBottom: '1px solid var(--border)'
    }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%',
          backgroundColor: '#1E1B4B', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '700', fontSize: '14px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {getInitials(displayName)}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{displayName}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{displayRole}</div>
        </div>
      </div>
    </div>
  );
}
