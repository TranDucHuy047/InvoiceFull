import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scan from './pages/Scan';
import History from './pages/History';
import Trash from './pages/Trash';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import AIChat from './pages/AIChat';
import Report from './pages/Report';
import InvoiceDetail from './pages/InvoiceDetail';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" />;
  
  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="scan" element={<Scan />} />
        <Route path="history" element={<History />} />
        <Route path="history/:id" element={<InvoiceDetail />} />
        <Route path="trash" element={<Trash />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="ai-chat" element={<AIChat />} />
        <Route path="report" element={<Report />} />
      </Route>
    </Routes>
  );
}

export default App;

