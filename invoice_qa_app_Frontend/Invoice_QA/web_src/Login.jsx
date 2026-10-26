import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', email: '', full_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const res = await login(formData.username, formData.password);
        loginUser(res.data.token, res.data.user);
        navigate('/');
      } else {
        const res = await register(formData.username, formData.email, formData.password, formData.full_name);
        setIsLogin(true);
        setFormData({ ...formData, password: '' });
        alert(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <div className="login-logo-icon">🧾</div>
          <h1>Invoice AI</h1>
        </div>
        <p className="login-subtitle">
          {isLogin ? 'Đăng nhập để quản lý hóa đơn của bạn' : 'Tạo tài khoản mới'}
        </p>

        {error && <div className="error-msg">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="form-group">
                <label>Họ và tên</label>
                <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} className="form-input" placeholder="Nhập họ và tên" required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-input" placeholder="Nhập email" required />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Tên đăng nhập</label>
            <input type="text" name="username" value={formData.username} onChange={handleChange} className="form-input" placeholder="Nhập tên đăng nhập" required />
          </div>

          <div className="form-group">
            <label>Mật khẩu</label>
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? 'text' : 'password'} 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="Nhập mật khẩu" 
                required 
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }} disabled={loading}>
            {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng nhập' : 'Đăng ký')}
          </button>
        </form>

        <div className="login-footer">
          {isLogin ? (
            <p>Chưa có tài khoản? <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(false); }}>Đăng ký ngay</a></p>
          ) : (
            <p>Đã có tài khoản? <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(true); }}>Đăng nhập</a></p>
          )}
        </div>
      </div>
    </div>
  );
}
