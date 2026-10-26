import { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  vi: {
    // Sidebar
    overview: 'Tổng quan',
    scan: 'Quét hóa đơn',
    history: 'Lịch sử hóa đơn',
    trash: 'Lịch sử xóa',
    admin_portal: 'Trang Quản Trị',
    ai_chat: 'Hỏi AI',
    profile: 'Hồ sơ',
    settings: 'Cài đặt',
    report: 'Báo cáo / Hỗ trợ',
    logout: 'Đăng xuất',
    brand_version: 'Invoice AI Phiên bản 1.0',

    // Header
    notifications: 'Thông báo',

    // Settings
    settings_title: 'Cài đặt',
    settings_subtitle: 'Tùy chỉnh hệ thống, giao diện và bảo mật tài khoản',
    section_appearance: 'Giao diện & Hiển thị',
    theme_title: 'Giao diện',
    theme_light: 'Sáng',
    theme_dark: 'Tối',
    theme_desc: 'Chuyển đổi giao diện Sáng hoặc Tối',
    language_title: 'Ngôn ngữ',
    language_name: 'Tiếng Việt',
    language_desc: 'Chọn ngôn ngữ giao diện của hệ thống',
    section_preferences: 'Tùy chọn xử lý',
    auto_switch_title: 'Tự động chuyển sang văn bản',
    auto_switch_desc: 'Sau khi đọc hóa đơn xong, tự mở phần Văn bản hóa đơn (OCR).',
    notifications_title: 'Thông báo hệ thống',
    notifications_desc: 'Nhận thông báo khi quét xong hoặc có cập nhật hệ thống',
    section_account: 'Tài khoản & Bảo mật',
    change_password_title: 'Đổi mật khẩu',
    change_password_desc: 'Cập nhật mật khẩu bảo mật định kỳ',
    logout_title: 'Đăng xuất',
    logout_desc: 'Thoát phiên đăng nhập trên thiết bị này',
    section_system: 'Hệ thống & Bộ nhớ',
    system_info_title: 'Thông tin hệ thống',
    system_info_desc: 'Phiên bản v1.0.0 • AI OCR Engine: Sẵn sàng',
    clear_cache_title: 'Xóa bộ nhớ đệm tạm',
    clear_cache_desc: 'Giải phóng dung lượng bộ nhớ đệm trên trình duyệt',
    clear_cache_btn: 'Xóa bộ nhớ đệm',

    // Change Password Modal
    change_password_modal: 'Đổi mật khẩu',
    current_password: 'Mật khẩu hiện tại',
    new_password: 'Mật khẩu mới',
    confirm_password: 'Xác nhận mật khẩu mới',
    cancel: 'Hủy',
    update_password: 'Cập nhật mật khẩu',
    updating: 'Đang lưu...',
    password_mismatch: 'Mật khẩu xác nhận không khớp',
    password_success: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
    confirm_logout: 'Bạn có chắc chắn muốn đăng xuất?',
    
    // Toasts
    toast_theme_light: '☀️ Đã chuyển sang giao diện Sáng',
    toast_theme_dark: '🌙 Đã chuyển sang giao diện Tối',
    toast_lang_vi: '🇻🇳 Đã chuyển ngôn ngữ sang Tiếng Việt',
    toast_lang_en: '🇬🇧 Đã chuyển ngôn ngữ sang English',
    toast_notif_on: '🔔 Đã bật thông báo',
    toast_notif_off: '🔕 Đã tắt thông báo',
    toast_auto_on: '📄 Đã bật tự động mở văn bản hóa đơn',
    toast_auto_off: '📄 Đã tắt tự động mở văn bản hóa đơn',
    toast_cache_cleared: '🧹 Đã xóa bộ nhớ đệm tạm thành công',

    // Invoice Detail
    invoice_detail_title: 'Chi tiết hóa đơn',
    tab_structured: '📊 Chi tiết cấu trúc',
    tab_raw_text: '📄 Văn bản gốc OCR',
    general_info: 'Thông tin chung',
    store_name: 'Cửa hàng',
    store_address: 'Địa chỉ',
    invoice_date: 'Ngày',
    tax_vat: 'Thuế VAT',
    total_payment: 'Tổng thanh toán',
    products_count: 'Danh sách sản phẩm',
    col_name: 'Tên sản phẩm',
    col_quantity: 'SL',
    col_unit_price: 'Đơn giá',
    col_total: 'Thành tiền',
    copy_text: 'Sao chép văn bản',
    copied: 'Đã sao chép! ✓',
    no_raw_text: 'Chưa có văn bản OCR thô cho hóa đơn này.',
    ask_ai_banner_title: 'Hỏi AI về hóa đơn này',
    ask_ai_banner_sub: 'Tra cứu thông tin, phân tích hoặc tóm tắt nội dung hóa đơn',
    back_btn: '← Quay lại',
    delete_invoice_btn: '🗑️ Xóa hóa đơn',
    confirm_delete_title: 'Xóa hóa đơn?',
    confirm_delete_sub: 'Hóa đơn sẽ được chuyển vào Lịch sử xóa và tự dọn sau 30 ngày.',
    delete_reason_label: 'Lý do xóa',
    empty_invoice: 'Không tìm thấy hóa đơn'
  },
  en: {
    // Sidebar
    overview: 'Dashboard',
    scan: 'Scan Invoice',
    history: 'Invoice History',
    trash: 'Trash / Deleted',
    admin_portal: 'Admin Portal',
    ai_chat: 'Ask AI',
    profile: 'Profile',
    settings: 'Settings',
    report: 'Report & Support',
    logout: 'Log Out',
    brand_version: 'Invoice AI Version 1.0',

    // Header
    notifications: 'Notifications',

    // Settings
    settings_title: 'Settings',
    settings_subtitle: 'System preferences, appearance and account security',
    section_appearance: 'Appearance & Display',
    theme_title: 'Appearance',
    theme_light: 'Light',
    theme_dark: 'Dark',
    theme_desc: 'Toggle between Light and Dark mode',
    language_title: 'Language',
    language_name: 'English',
    language_desc: 'Choose system display language',
    section_preferences: 'Processing Preferences',
    auto_switch_title: 'Auto-switch to Raw Text',
    auto_switch_desc: 'Automatically open Raw Text (OCR) tab after scanning invoice.',
    notifications_title: 'System Notifications',
    notifications_desc: 'Receive alerts when scanning completes or system updates',
    section_account: 'Account & Security',
    change_password_title: 'Change Password',
    change_password_desc: 'Update your security password periodically',
    logout_title: 'Log Out',
    logout_desc: 'Sign out from this device',
    section_system: 'System & Storage',
    system_info_title: 'System Information',
    system_info_desc: 'Version v1.0.0 • AI OCR Engine: Ready',
    clear_cache_title: 'Clear Temporary Cache',
    clear_cache_desc: 'Free up local browser cache and temporary data',
    clear_cache_btn: 'Clear Cache',

    // Change Password Modal
    change_password_modal: 'Change Password',
    current_password: 'Current Password',
    new_password: 'New Password',
    confirm_password: 'Confirm New Password',
    cancel: 'Cancel',
    update_password: 'Save New Password',
    updating: 'Saving...',
    password_mismatch: 'Password confirmation does not match',
    password_success: 'Password changed successfully. Please log in again.',
    confirm_logout: 'Are you sure you want to log out?',

    // Toasts
    toast_theme_light: '☀️ Switched to Light theme',
    toast_theme_dark: '🌙 Switched to Dark theme',
    toast_lang_vi: '🇻🇳 Language set to Vietnamese',
    toast_lang_en: '🇬🇧 Language set to English',
    toast_notif_on: '🔔 Notifications turned on',
    toast_notif_off: '🔕 Notifications turned off',
    toast_auto_on: '📄 Auto-switch to raw text enabled',
    toast_auto_off: '📄 Auto-switch to raw text disabled',
    toast_cache_cleared: '🧹 Temporary cache cleared successfully',

    // Invoice Detail
    invoice_detail_title: 'Invoice Details',
    tab_structured: '📊 Structured Details',
    tab_raw_text: '📄 Raw OCR Text',
    general_info: 'General Information',
    store_name: 'Store Name',
    store_address: 'Address',
    invoice_date: 'Date',
    tax_vat: 'VAT',
    total_payment: 'Total Payment',
    products_count: 'Items List',
    col_name: 'Item Name',
    col_quantity: 'Qty',
    col_unit_price: 'Unit Price',
    col_total: 'Total',
    copy_text: 'Copy Text',
    copied: 'Copied! ✓',
    no_raw_text: 'No raw OCR text available for this invoice.',
    ask_ai_banner_title: 'Ask AI about this invoice',
    ask_ai_banner_sub: 'Inquire details, summary, or calculations from this invoice',
    back_btn: '← Back',
    delete_invoice_btn: '🗑️ Delete Invoice',
    confirm_delete_title: 'Delete Invoice?',
    confirm_delete_sub: 'Invoice will be moved to Trash and auto-cleaned after 30 days.',
    delete_reason_label: 'Reason for deletion',
    empty_invoice: 'Invoice not found'
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('app_lang') || 'vi';
  });

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setLang = (newLang) => {
    if (newLang === 'vi' || newLang === 'en') {
      setLangState(newLang);
    }
  };

  const toggleLang = () => {
    setLangState(prev => (prev === 'vi' ? 'en' : 'vi'));
  };

  const t = (key) => {
    return translations[lang]?.[key] || translations['vi']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
