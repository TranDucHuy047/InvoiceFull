
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <Sidebar />
      <div style={{ 
        flex: 1, 
        marginLeft: '260px', 
        padding: '32px 40px',
        maxWidth: '100%',
        overflowX: 'hidden'
      }}>
        <Outlet />
      </div>
    </div>
  );
}
