import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, register, sendOtp } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [regStep, setRegStep] = useState(1); // 1: Info form, 2: OTP verification
  const [formData, setFormData] = useState({ username: '', password: '', email: '', full_name: '' });
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user, token, loginUser, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If redirected from admin logout, clear session
  useEffect(() => {
    if (searchParams.get('logout') === 'true') {
      logoutUser();
      return;
    }
    if (token && user) {
      if (user.role === 'admin') {
        window.location.href = `http://localhost:5174/login?token=${token}`;
      } else {
        navigate('/');
      }
    }
  }, [token, user, searchParams, logoutUser, navigate]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  // Step 1: Send OTP for registration
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.full_name || !formData.email || !formData.username || !formData.password) {
      setError('Vui lòng điền đầy đủ tất cả thông tin.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendOtp(formData.email.trim(), formData.username.trim());
      setOtpMessage(res.data.message || `Mã OTP đã được gửi đến email ${formData.email}.`);
      if (res.data.otp_code) {
        setOtpCode(res.data.otp_code); // Pre-fill if dev fallback is returned
      }
      setRegStep(2);
      setCountdown(60);
    } catch (err) {
      let errMsg = err.response?.data?.detail;
      if (Array.isArray(errMsg)) errMsg = errMsg[0].msg || 'Lỗi xác thực dữ liệu';
      else if (typeof errMsg === 'object') errMsg = JSON.stringify(errMsg);
      setError(errMsg || 'Lỗi khi gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm OTP & Complete Registration
  const handleVerifyOtpAndRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!otpCode || otpCode.trim().length < 4) {
      setError('Vui lòng nhập mã OTP 6 chữ số.');
      return;
    }

    setLoading(true);
    try {
      const res = await register(
        formData.username.trim(),
        formData.email.trim(),
        formData.password,
        formData.full_name.trim(),
        otpCode.trim()
      );
      setIsLogin(true);
      setRegStep(1);
      setOtpCode('');
      setSuccess(res.data.message || 'Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay.');
      setFormData({ username: formData.username, password: '', email: '', full_name: '' });
    } catch (err) {
      let errMsg = err.response?.data?.detail;
      if (Array.isArray(errMsg)) errMsg = errMsg[0].msg || 'Lỗi xác thực dữ liệu';
      else if (typeof errMsg === 'object') errMsg = JSON.stringify(errMsg);
      setError(errMsg || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 2
  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await sendOtp(formData.email.trim(), formData.username.trim());
      setOtpMessage(res.data.message || `Đã gửi lại mã OTP đến ${formData.email}.`);
      if (res.data.otp_code) {
        setOtpCode(res.data.otp_code);
      }
      setCountdown(60);
    } catch (err) {
      let errMsg = err.response?.data?.detail;
      if (Array.isArray(errMsg)) errMsg = errMsg[0].msg || 'Lỗi gửi lại OTP';
      setError(errMsg || 'Lỗi khi gửi lại mã OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Regular Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await login(formData.username, formData.password);
      const accessToken = res.data.access_token || res.data.token;
      const userData = res.data.user || res.data.data;
      const role = res.data.role || userData?.role;

      loginUser(accessToken, userData);
      
      if (role === 'admin') {
        window.location.href = `http://localhost:5174/login?token=${accessToken}`;
        return;
      }
      
      navigate('/');
    } catch (err) {
      let errMsg = err.response?.data?.detail;
      if (Array.isArray(errMsg)) errMsg = errMsg[0].msg || 'Lỗi xác thực dữ liệu';
      else if (typeof errMsg === 'object') errMsg = JSON.stringify(errMsg);
      setError(errMsg || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-orb orb-1"></div>
      <div className="login-bg-orb orb-2"></div>
      <div className="login-bg-orb orb-3"></div>
      <div className="login-container">
        <div className="login-brand-tag">✨ AI-Powered Invoice Platform</div>
        <div className="login-logo">
          <div className="login-logo-icon">🧾</div>
          <h1>Invoice AI</h1>
        </div>
        
        <p className="login-subtitle">
          {isLogin 
            ? 'Đăng nhập để quản lý hóa đơn của bạn' 
            : (regStep === 1 ? 'Tạo tài khoản mới (Bước 1/2: Thông tin)' : 'Xác thực OTP (Bước 2/2: Nhập mã)')}
        </p>

        {error && <div className="error-msg">⚠️ {error}</div>}
        {success && (
          <div style={{
            padding: '12px 16px', borderRadius: '8px',
            backgroundColor: '#D1FAE5', color: '#065F46',
            fontSize: '13px', fontWeight: '600',
            marginBottom: '16px', textAlign: 'center'
          }}>
            ✅ {success}
          </div>
        )}

        {/* LOGIN FORM */}
        {isLogin && (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label>Tên đăng nhập</label>
              <input 
                type="text" 
                name="username" 
                value={formData.username} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="Nhập tên đăng nhập" 
                required 
              />
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
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>
        )}

        {/* REGISTER STEP 1: FILL INFO */}
        {!isLogin && regStep === 1 && (
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label>Họ và tên</label>
              <input 
                type="text" 
                name="full_name" 
                value={formData.full_name} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="Nhập họ và tên đầy đủ" 
                required 
              />
            </div>

            <div className="form-group">
              <label>Email (để nhận mã OTP)</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="example@email.com" 
                required 
              />
            </div>

            <div className="form-group">
              <label>Tên đăng nhập</label>
              <input 
                type="text" 
                name="username" 
                value={formData.username} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="Chọn tên đăng nhập (VD: huy123)" 
                required 
              />
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
                  placeholder="Nhập mật khẩu an toàn" 
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
              {loading ? 'Đang gửi mã OTP...' : 'Gửi mã OTP & Tiếp tục →'}
            </button>
          </form>
        )}

        {/* REGISTER STEP 2: ENTER OTP */}
        {!isLogin && regStep === 2 && (
          <form onSubmit={handleVerifyOtpAndRegister}>
            {otpMessage && (
              <div style={{
                padding: '12px 14px', borderRadius: '8px',
                backgroundColor: '#EEF2FF', color: 'var(--primary)',
                fontSize: '13px', fontWeight: '500',
                marginBottom: '18px', textAlign: 'center', lineHeight: '1.5'
              }}>
                📩 {otpMessage}
              </div>
            )}

            <div className="form-group">
              <label style={{ textAlign: 'center', display: 'block', marginBottom: '8px' }}>
                Mã xác thực OTP (6 chữ số)
              </label>
              <input 
                type="text" 
                maxLength={6}
                value={otpCode} 
                onChange={e => {
                  setOtpCode(e.target.value.replace(/\D/g, ''));
                  setError('');
                }} 
                className="form-input" 
                placeholder="1 2 3 4 5 6" 
                style={{
                  textAlign: 'center',
                  fontSize: '26px',
                  fontWeight: '800',
                  letterSpacing: '8px',
                  color: 'var(--primary)',
                  backgroundColor: '#F8FAFC',
                  padding: '14px'
                }}
                required 
                autoFocus
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '14px' }} disabled={loading}>
              {loading ? 'Đang xác thực...' : 'Xác nhận & Hoàn tất đăng ký'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '13px' }}>
              <button 
                type="button"
                onClick={() => { setRegStep(1); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                ← Sửa lại thông tin
              </button>

              {countdown > 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>Gửi lại sau ({countdown}s)</span>
              ) : (
                <button 
                  type="button" 
                  onClick={handleResendOtp}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '600', padding: 0 }}
                >
                  Gửi lại mã OTP
                </button>
              )}
            </div>
          </form>
        )}

        <div className="login-footer">
          {isLogin ? (
            <p>Chưa có tài khoản? <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(false); setRegStep(1); setSuccess(''); setError(''); }}>Đăng ký ngay</a></p>
          ) : (
            <p>Đã có tài khoản? <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(true); setRegStep(1); setSuccess(''); setError(''); }}>Đăng nhập</a></p>
          )}
        </div>
      </div>
    </div>
  );
}
