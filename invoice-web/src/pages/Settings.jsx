import { useState } from 'react';
import { changePassword } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { logoutUser } = useAuth();
  const { theme, isDark, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();

  const [autoSwitchText, setAutoSwitchText] = useState(() => localStorage.getItem('app_auto_switch_text') === 'true');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('app_notifications_enabled') !== 'false');

  const [toast, setToast] = useState(null);
  const showToast = (msg, icon) => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 2800);
  };

  const handleSelectTheme = (mode) => {
    setTheme(mode);
    showToast(mode === 'dark' ? t('toast_theme_dark') : t('toast_theme_light'), mode === 'dark' ? '🌙' : '☀️');
  };

  const handleSelectLang = (newLang) => {
    if (newLang !== lang) {
      setLang(newLang);
      showToast(newLang === 'en' ? t('toast_lang_en') : t('toast_lang_vi'), newLang === 'en' ? '🇬🇧' : '🇻🇳');
    }
  };

  const handleToggleAutoSwitch = () => {
    const next = !autoSwitchText;
    setAutoSwitchText(next);
    localStorage.setItem('app_auto_switch_text', String(next));
    showToast(next ? t('toast_auto_on') : t('toast_auto_off'), '📄');
  };

  const handleToggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem('app_notifications_enabled', String(next));
    showToast(next ? t('toast_notif_on') : t('toast_notif_off'), next ? '🔔' : '🔕');
  };

  const handleClearCache = () => {
    // Preserve auth token & user
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const savedTheme = localStorage.getItem('app_theme');
    const savedLang = localStorage.getItem('app_lang');
    
    localStorage.clear();
    
    if (token) localStorage.setItem('token', token);
    if (user) localStorage.setItem('user', user);
    if (savedTheme) localStorage.setItem('app_theme', savedTheme);
    if (savedLang) localStorage.setItem('app_lang', savedLang);
    
    showToast(t('toast_cache_cleared'), '🧹');
  };

  // Password modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwData, setPwData] = useState({ old_password: '', new_password: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Logout modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handlePwSubmit = async (e) => {
    if (e) e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!pwData.old_password || !pwData.new_password) {
      setPwError(lang === 'vi' ? 'Vui lòng điền đầy đủ thông tin' : 'Please fill all required fields');
      return;
    }
    if (pwData.new_password.length < 6) {
      setPwError(lang === 'vi' ? 'Mật khẩu mới phải có tối thiểu 6 ký tự' : 'New password must be at least 6 characters');
      return;
    }
    if (pwData.new_password !== pwData.confirm) {
      setPwError(t('password_mismatch'));
      return;
    }

    setPwLoading(true);
    try {
      await changePassword(pwData.old_password, pwData.new_password);
      setPwSuccess(t('password_success'));
      setPwData({ old_password: '', new_password: '', confirm: '' });
      setTimeout(() => {
        setShowPwModal(false);
        logoutUser();
        navigate('/login');
      }, 1800);
    } catch (err) {
      let msg = err.response?.data?.detail;
      if (Array.isArray(msg)) msg = msg[0].msg;
      setPwError(msg || (lang === 'vi' ? 'Đổi mật khẩu thất bại. Kiểm tra lại mật khẩu cũ.' : 'Failed to change password.'));
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="stg-page">
      {/* Toast Feedback */}
      {toast && (
        <div className="stg-toast">
          <span className="stg-toast-icon">{toast.icon}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="stg-header">
        <h2>{t('settings_title')}</h2>
        <p className="stg-header-sub">{t('settings_subtitle')}</p>
      </div>

      {/* SECTION 1: GIAO DIỆN & HIỂN THỊ */}
      <div className="stg-section">
        <div className="stg-section-title">
          <span className="stg-section-icon">🎨</span>
          <span>{t('section_appearance')}</span>
        </div>

        {/* Theme Switcher */}
        <div className="stg-card stg-card-theme">
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-theme">
              {isDark ? '🌙' : '☀️'}
            </div>
            <div>
              <h4>{t('theme_title')}</h4>
              <p>{t('theme_desc')}</p>
            </div>
          </div>
          <div className="stg-theme-switcher">
            <button
              className={`stg-theme-btn ${!isDark ? 'active' : ''}`}
              onClick={() => handleSelectTheme('light')}
              type="button"
              title="Light Mode"
            >
              <span>☀️</span>
              <span>{t('theme_light')}</span>
            </button>
            <button
              className={`stg-theme-btn ${isDark ? 'active' : ''}`}
              onClick={() => handleSelectTheme('dark')}
              type="button"
              title="Dark Mode"
            >
              <span>🌙</span>
              <span>{t('theme_dark')}</span>
            </button>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="stg-card">
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-lang">🌐</div>
            <div>
              <h4>{t('language_title')}</h4>
              <p>{t('language_desc')}</p>
            </div>
          </div>
          <div className="stg-lang-switcher">
            <button
              className={`stg-lang-btn ${lang === 'vi' ? 'active' : ''}`}
              onClick={() => handleSelectLang('vi')}
              type="button"
            >
              <span className="stg-flag">🇻🇳</span>
              <span>Tiếng Việt</span>
              {lang === 'vi' && <span className="stg-check">✓</span>}
            </button>
            <button
              className={`stg-lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => handleSelectLang('en')}
              type="button"
            >
              <span className="stg-flag">🇬🇧</span>
              <span>English</span>
              {lang === 'en' && <span className="stg-check">✓</span>}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: TÙY CHỌN XỬ LÝ */}
      <div className="stg-section">
        <div className="stg-section-title">
          <span className="stg-section-icon">⚡</span>
          <span>{t('section_preferences')}</span>
        </div>

        {/* Auto Switch */}
        <div className="stg-card stg-card-toggle" onClick={handleToggleAutoSwitch}>
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-auto">📄</div>
            <div>
              <h4>{t('auto_switch_title')}</h4>
              <p>{t('auto_switch_desc')}</p>
            </div>
          </div>
          <label className="stg-toggle" onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={autoSwitchText} onChange={handleToggleAutoSwitch} />
            <span className="stg-toggle-track">
              <span className="stg-toggle-thumb"></span>
            </span>
          </label>
        </div>

        {/* Notifications */}
        <div className="stg-card stg-card-toggle" onClick={handleToggleNotifications}>
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-notif">{notificationsEnabled ? '🔔' : '🔕'}</div>
            <div>
              <h4>{t('notifications_title')}</h4>
              <p>{t('notifications_desc')}</p>
            </div>
          </div>
          <label className="stg-toggle" onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={notificationsEnabled} onChange={handleToggleNotifications} />
            <span className="stg-toggle-track">
              <span className="stg-toggle-thumb"></span>
            </span>
          </label>
        </div>
      </div>

      {/* SECTION 3: HỆ THỐNG & BỘ NHỚ */}
      <div className="stg-section">
        <div className="stg-section-title">
          <span className="stg-section-icon">💻</span>
          <span>{t('section_system')}</span>
        </div>

        {/* System info */}
        <div className="stg-card">
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-system">🤖</div>
            <div>
              <h4>{t('system_info_title')}</h4>
              <p>{t('system_info_desc')}</p>
            </div>
          </div>
          <div className="stg-status-badge">
            <span className="stg-dot-pulse"></span>
            <span>Online</span>
          </div>
        </div>

        {/* Clear cache */}
        <div className="stg-card stg-card-action" onClick={handleClearCache}>
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-cache">🧹</div>
            <div>
              <h4>{t('clear_cache_title')}</h4>
              <p>{t('clear_cache_desc')}</p>
            </div>
          </div>
          <button type="button" className="stg-btn-sm" onClick={e => { e.stopPropagation(); handleClearCache(); }}>
            {t('clear_cache_btn')}
          </button>
        </div>
      </div>

      {/* SECTION 4: TÀI KHOẢN & BẢO MẬT */}
      <div className="stg-section">
        <div className="stg-section-title">
          <span className="stg-section-icon">🔐</span>
          <span>{t('section_account')}</span>
        </div>

        {/* Change Password */}
        <div className="stg-card stg-card-action" onClick={() => { setPwError(''); setPwSuccess(''); setShowPwModal(true); }}>
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-pw">🔑</div>
            <div>
              <h4>{t('change_password_title')}</h4>
              <p>{t('change_password_desc')}</p>
            </div>
          </div>
          <span className="stg-card-arrow">→</span>
        </div>

        {/* Logout */}
        <div className="stg-card stg-card-action stg-card-danger" onClick={() => setShowLogoutModal(true)}>
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-logout">🚪</div>
            <div>
              <h4>{t('logout_title')}</h4>
              <p>{t('logout_desc')}</p>
            </div>
          </div>
          <span className="stg-card-arrow">→</span>
        </div>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {showPwModal && (
        <div className="stg-overlay" onClick={() => !pwLoading && setShowPwModal(false)}>
          <div className="stg-modal" onClick={e => e.stopPropagation()}>
            <button className="stg-modal-close" onClick={() => !pwLoading && setShowPwModal(false)}>✕</button>
            <div className="stg-modal-icon">🔒</div>
            <h3>{t('change_password_modal')}</h3>
            <p className="stg-modal-sub">{lang === 'vi' ? 'Nhập mật khẩu hiện tại và mật khẩu mới' : 'Enter your current and new password'}</p>

            {pwError && <div className="stg-alert stg-alert-error">⚠️ {pwError}</div>}
            {pwSuccess && <div className="stg-alert stg-alert-success">✅ {pwSuccess}</div>}

            <form onSubmit={handlePwSubmit} className="stg-pw-form">
              <label>{t('current_password')}</label>
              <div className="stg-pw-field">
                <input
                  type={showOld ? 'text' : 'password'}
                  placeholder={t('current_password')}
                  value={pwData.old_password}
                  onChange={e => setPwData({ ...pwData, old_password: e.target.value })}
                  required
                />
                <button type="button" className="stg-pw-eye" onClick={() => setShowOld(!showOld)}>
                  {showOld ? '🙈' : '👁️'}
                </button>
              </div>

              <label>{t('new_password')}</label>
              <div className="stg-pw-field">
                <input
                  type={showNew ? 'text' : 'password'}
                  placeholder={t('new_password')}
                  value={pwData.new_password}
                  onChange={e => setPwData({ ...pwData, new_password: e.target.value })}
                  required
                />
                <button type="button" className="stg-pw-eye" onClick={() => setShowNew(!showNew)}>
                  {showNew ? '🙈' : '👁️'}
                </button>
              </div>

              <label>{t('confirm_password')}</label>
              <input
                type="password"
                placeholder={t('confirm_password')}
                value={pwData.confirm}
                onChange={e => setPwData({ ...pwData, confirm: e.target.value })}
                required
              />

              <div className="stg-modal-btns">
                <button type="button" className="stg-btn-ghost" onClick={() => setShowPwModal(false)} disabled={pwLoading}>
                  {t('cancel')}
                </button>
                <button type="submit" className="stg-btn-primary" disabled={pwLoading}>
                  {pwLoading ? t('updating') : t('update_password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="stg-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="stg-modal stg-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="stg-modal-icon stg-modal-icon-danger">🚪</div>
            <h3>{t('logout_title')}</h3>
            <p className="stg-modal-sub">{t('confirm_logout')}</p>
            <div className="stg-modal-btns">
              <button type="button" className="stg-btn-ghost" onClick={() => setShowLogoutModal(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="stg-btn-danger" onClick={() => { logoutUser(); navigate('/login'); }}>
                {t('logout_title')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
