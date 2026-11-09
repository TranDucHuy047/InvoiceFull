import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { changePassword } from '../services/api';
import {
  Palette,
  Sun,
  Moon,
  Globe,
  Sliders,
  FileText,
  Bell,
  BellOff,
  Cpu,
  Bot,
  HardDrive,
  Shield,
  KeyRound,
  LogOut,
  Eye,
  EyeOff,
  Check,
  ChevronRight,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function Settings() {
  const { logout } = useAuth();
  const { isDark, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();

  // Preferences persisted in localStorage
  const [autoSwitchText, setAutoSwitchText] = useState(() => {
    return localStorage.getItem('app_auto_switch_text') === 'true';
  });
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('app_notifications');
    return saved !== null ? saved === 'true' : true;
  });

  // Modals & Toast
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2800);
  };

  const handleSelectTheme = (mode) => {
    setTheme(mode);
    showToast(mode === 'dark' ? t('toast_theme_dark') : t('toast_theme_light'));
  };

  const handleSelectLang = (newLang) => {
    setLang(newLang);
    const msg =
      newLang === 'en'
        ? 'Language set to English'
        : 'Đã chuyển ngôn ngữ sang Tiếng Việt';
    showToast(msg);
  };

  const handleToggleAutoSwitch = () => {
    const next = !autoSwitchText;
    setAutoSwitchText(next);
    localStorage.setItem('app_auto_switch_text', String(next));
    showToast(next ? t('toast_auto_on') : t('toast_auto_off'));
  };

  const handleToggleNotifications = () => {
    const next = !notifications;
    setNotifications(next);
    localStorage.setItem('app_notifications', String(next));
    showToast(next ? t('toast_notif_on') : t('toast_notif_off'));
  };

  const handleClearCache = () => {
    sessionStorage.clear();
    setShowClearCacheConfirm(false);
    showToast(t('toast_cache_cleared'));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 6) {
      setPwError(
        lang === 'en'
          ? 'New password must be at least 6 characters'
          : 'Mật khẩu mới phải có ít nhất 6 ký tự'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError(t('password_mismatch'));
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess(t('password_success'));
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 1500);
    } catch (err) {
      setPwError(
        err.response?.data?.detail ||
          (lang === 'en'
            ? 'Failed to change password'
            : 'Đổi mật khẩu thất bại')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="stg-page">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="stg-toast">
          <CheckCircle2 size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="stg-header">
        <div>
          <h2>{t('settings_title')}</h2>
        </div>
      </div>

      {/* SECTION 1: APPEARANCE & LANGUAGE */}
      <div className="stg-section">
        <div className="stg-section-title">
          <span className="stg-section-icon" style={{ display: 'inline-flex', color: 'var(--primary)' }}>
            <Palette size={15} strokeWidth={1.75} />
          </span>
          {t('section_appearance')}
        </div>

        {/* Theme Switcher Card */}
        <div className="stg-card">
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-indigo">
              {isDark ? <Moon size={20} strokeWidth={1.75} /> : <Sun size={20} strokeWidth={1.75} />}
            </div>
            <div>
              <h4>{t('theme_title')}</h4>
              <p>{t('theme_desc')}</p>
            </div>
          </div>

          <div className="stg-theme-switcher">
            <button
              type="button"
              className={`stg-theme-btn ${!isDark ? 'active' : ''}`}
              onClick={() => handleSelectTheme('light')}
            >
              <Sun size={15} strokeWidth={1.75} />
              <span>{t('theme_light')}</span>
            </button>
            <button
              type="button"
              className={`stg-theme-btn ${isDark ? 'active' : ''}`}
              onClick={() => handleSelectTheme('dark')}
            >
              <Moon size={15} strokeWidth={1.75} />
              <span>{t('theme_dark')}</span>
            </button>
          </div>
        </div>

        {/* Language Switcher Card */}
        <div className="stg-card">
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-indigo">
              <Globe size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h4>{t('language_title')}</h4>
              <p>{t('language_desc')}</p>
            </div>
          </div>

          <div className="stg-lang-switcher">
            <button
              type="button"
              className={`stg-lang-btn ${lang === 'vi' ? 'active' : ''}`}
              onClick={() => handleSelectLang('vi')}
            >
              <span className="stg-lang-code">VN</span>
              <span>Tiếng Việt</span>
              {lang === 'vi' && (
                <span className="stg-check">
                  <Check size={12} strokeWidth={2.5} />
                </span>
              )}
            </button>
            <button
              type="button"
              className={`stg-lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => handleSelectLang('en')}
            >
              <span className="stg-lang-code">EN</span>
              <span>English</span>
              {lang === 'en' && (
                <span className="stg-check">
                  <Check size={12} strokeWidth={2.5} />
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: PROCESSING PREFERENCES */}
      <div className="stg-section">
        <div className="stg-section-title">
          <span className="stg-section-icon" style={{ display: 'inline-flex', color: 'var(--primary)' }}>
            <Sliders size={15} strokeWidth={1.75} />
          </span>
          {t('section_preferences')}
        </div>

        {/* Auto-switch to raw text */}
        <div className="stg-card stg-card-toggle" onClick={handleToggleAutoSwitch}>
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-indigo">
              <FileText size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h4>{t('auto_switch_title')}</h4>
              <p>{t('auto_switch_desc')}</p>
            </div>
          </div>

          <label className="stg-toggle" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={autoSwitchText}
              onChange={handleToggleAutoSwitch}
            />
            <span className="stg-toggle-track">
              <span className="stg-toggle-thumb" />
            </span>
          </label>
        </div>

        {/* Notifications */}
        <div className="stg-card stg-card-toggle" onClick={handleToggleNotifications}>
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-indigo">
              {notifications ? (
                <Bell size={20} strokeWidth={1.75} />
              ) : (
                <BellOff size={20} strokeWidth={1.75} />
              )}
            </div>
            <div>
              <h4>{t('notifications_title')}</h4>
              <p>{t('notifications_desc')}</p>
            </div>
          </div>

          <label className="stg-toggle" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={notifications}
              onChange={handleToggleNotifications}
            />
            <span className="stg-toggle-track">
              <span className="stg-toggle-thumb" />
            </span>
          </label>
        </div>
      </div>

      {/* SECTION 3: SYSTEM & CACHE */}
      <div className="stg-section">
        <div className="stg-section-title">
          <span className="stg-section-icon" style={{ display: 'inline-flex', color: 'var(--primary)' }}>
            <Cpu size={15} strokeWidth={1.75} />
          </span>
          {t('section_system')}
        </div>

        <div className="stg-card stg-card-action" onClick={() => setShowClearCacheConfirm(true)}>
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-indigo">
              <HardDrive size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h4>{t('clear_cache_title')}</h4>
              <p>{t('clear_cache_desc')}</p>
            </div>
          </div>
          <button
            type="button"
            className="stg-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowClearCacheConfirm(true);
            }}
          >
            {t('clear_cache_btn')}
          </button>
        </div>
      </div>

      {/* SECTION 4: ACCOUNT & SECURITY */}
      <div className="stg-section">
        <div className="stg-section-title">
          <span className="stg-section-icon" style={{ display: 'inline-flex', color: 'var(--primary)' }}>
            <Shield size={15} strokeWidth={1.75} />
          </span>
          {t('section_account')}
        </div>

        {/* Change Password */}
        <div
          className="stg-card stg-card-action"
          onClick={() => {
            setPwError('');
            setPwSuccess('');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordModal(true);
          }}
        >
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-indigo">
              <KeyRound size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h4>{t('change_password_title')}</h4>
              <p>{t('change_password_desc')}</p>
            </div>
          </div>
          <span className="stg-card-arrow" style={{ display: 'inline-flex' }}>
            <ChevronRight size={18} strokeWidth={1.75} />
          </span>
        </div>

        {/* Logout */}
        <div
          className="stg-card stg-card-action stg-card-danger"
          onClick={() => setShowLogoutConfirm(true)}
        >
          <div className="stg-card-info">
            <div className="stg-card-icon-wrap stg-icon-danger-neutral">
              <LogOut size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h4>{t('logout_title')}</h4>
              <p>{t('logout_desc')}</p>
            </div>
          </div>
          <span className="stg-card-arrow" style={{ display: 'inline-flex' }}>
            <ChevronRight size={18} strokeWidth={1.75} />
          </span>
        </div>
      </div>

      {/* MODAL: CHANGE PASSWORD */}
      {showPasswordModal && (
        <div className="stg-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="stg-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="stg-modal-close"
              onClick={() => setShowPasswordModal(false)}
            >
              <X size={16} strokeWidth={1.75} />
            </button>

            <div className="stg-modal-icon" style={{ display: 'inline-flex', color: 'var(--primary)' }}>
              <KeyRound size={36} strokeWidth={1.5} />
            </div>
            <h3>{t('change_password_modal')}</h3>
            <p className="stg-modal-sub">{t('change_password_desc')}</p>

            {pwError && (
              <div className="stg-alert stg-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} strokeWidth={1.75} />
                <span>{pwError}</span>
              </div>
            )}
            {pwSuccess && (
              <div className="stg-alert stg-alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} strokeWidth={1.75} />
                <span>{pwSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="stg-pw-form">
              <label>{t('current_password')}</label>
              <div className="stg-pw-field">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="stg-pw-eye"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                >
                  {showCurrentPw ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              </div>

              <label>{t('new_password')}</label>
              <div className="stg-pw-field">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="stg-pw-eye"
                  onClick={() => setShowNewPw(!showNewPw)}
                >
                  {showNewPw ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              </div>

              <label>{t('confirm_password')}</label>
              <div className="stg-pw-field">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>

              <div className="stg-modal-btns">
                <button
                  type="button"
                  className="stg-btn-ghost"
                  onClick={() => setShowPasswordModal(false)}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="stg-btn-primary"
                  disabled={loading}
                >
                  {loading ? t('updating') : t('update_password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLEAR CACHE CONFIRMATION */}
      {showClearCacheConfirm && (
        <div
          className="stg-overlay"
          onClick={() => setShowClearCacheConfirm(false)}
        >
          <div
            className="stg-modal stg-modal-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stg-modal-icon stg-modal-icon-danger" style={{ color: 'var(--danger)' }}>
              <AlertTriangle size={30} strokeWidth={1.75} />
            </div>
            <h3>{t('clear_cache_title')}</h3>
            <p className="stg-modal-sub">
              {lang === 'en'
                ? 'Are you sure you want to clear temporary browser cache?'
                : 'Bạn có chắc chắn muốn xóa bộ nhớ đệm tạm thời trên trình duyệt không?'}
            </p>
            <div className="stg-modal-btns" style={{ justifyContent: 'center' }}>
              <button
                className="stg-btn-ghost"
                onClick={() => setShowClearCacheConfirm(false)}
              >
                {t('cancel')}
              </button>
              <button className="stg-btn-danger" onClick={handleClearCache}>
                {lang === 'en' ? 'Confirm Delete' : 'Chắc chắn muốn xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div
          className="stg-overlay"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="stg-modal stg-modal-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stg-modal-icon stg-modal-icon-danger" style={{ color: 'var(--danger)' }}>
              <LogOut size={30} strokeWidth={1.75} />
            </div>
            <h3>{t('logout_title')}</h3>
            <p className="stg-modal-sub">{t('confirm_logout')}</p>
            <div className="stg-modal-btns" style={{ justifyContent: 'center' }}>
              <button
                className="stg-btn-ghost"
                onClick={() => setShowLogoutConfirm(false)}
              >
                {t('cancel')}
              </button>
              <button className="stg-btn-danger" onClick={handleLogout}>
                {t('logout_title')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
