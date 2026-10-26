import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Header />
        <div className="page-content">
          <div key={location.pathname} className="page-anim-enter">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
