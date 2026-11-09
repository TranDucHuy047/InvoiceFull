import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('app_sidebar_collapsed') === 'true';
  });

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('app_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
      <main className="main-content">
        <Header />
        <div className="page-content">
          <div key={location.pathname} className="page-anim-enter">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Nút Hỏi AI cố định (Fixed Viewport) đặt ngoài page-anim-enter để luôn hiển thị khi cuộn trang */}
      {location.pathname !== '/ai-chat' && (
        <button
          type="button"
          className="ai-fab"
          onClick={() => navigate('/ai-chat')}
          title="Hỏi Trợ lý AI"
        >
          <Sparkles size={20} strokeWidth={1.75} />
          <span className="ai-fab-label">Hỏi AI</span>
        </button>
      )}
    </div>
  );
}
