import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { Lock, Mail, Receipt } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('admin_token', token);
      navigate('/dashboard');
    } else if (localStorage.getItem('admin_token')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    axiosClient.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
      .then(res => {
        const token = res.data.access_token || res.data.token;
        const role = res.data.role || res.data.user?.role;

        if (token) {
          if (role !== 'admin') {
            setError('Truy cập bị từ chối. Bạn không có quyền Administrator.');
            setLoading(false);
            return;
          }
          localStorage.setItem('admin_token', token);
          navigate('/dashboard');
        } else {
          setError('Đăng nhập thất bại');
        }
      })
      .catch(err => {
        const detail = err.response?.data?.detail;
        if (Array.isArray(detail)) {
          setError(detail[0].msg || 'Lỗi định dạng dữ liệu');
        } else {
          setError(detail || 'Lỗi kết nối máy chủ');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F8FAFC' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={32} />
            </div>
          </div>
          <h2 style={{ textAlign: 'center', fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Admin Dashboard</h2>
          <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '32px' }}>Đăng nhập để quản trị hệ thống Invoice AI</p>

          {error && <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '13px', marginBottom: '24px', textAlign: 'center', fontWeight: '600' }}>{error}</div>}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Email hoặc Tên đăng nhập</label>
              <div className="input-group" style={{ width: '100%' }}>
                <Mail size={18} />
                <input 
                  type="text" 
                  placeholder="admin@invoice.ai hoặc tên đăng nhập" 
                  style={{ width: '100%', paddingLeft: '40px' }}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Mật khẩu</label>
              <div className="input-group" style={{ width: '100%' }}>
                <Lock size={18} />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  style={{ width: '100%', paddingLeft: '40px' }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: '12px', fontSize: '16px', marginTop: '8px' }} disabled={loading}>
              {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
