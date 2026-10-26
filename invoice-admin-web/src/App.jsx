import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import InvoiceManagement from './pages/InvoiceManagement';
import ErrorReports from './pages/ErrorReports';
import BackupRestore from './pages/BackupRestore';

const ProtectedRoute = () => {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="invoices" element={<InvoiceManagement />} />
            <Route path="errors" element={<ErrorReports />} />
            <Route path="backup" element={<BackupRestore />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
