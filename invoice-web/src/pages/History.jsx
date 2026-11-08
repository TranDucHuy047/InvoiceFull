import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getInvoices } from '../services/api';
import { parseInvoiceDate } from './Dashboard';
import {
  Search,
  SlidersHorizontal,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List,
  Receipt,
  Wallet,
  CheckCircle2,
  Clock,
  Calendar,
  Store,
  Utensils,
  Zap,
  ShoppingBag,
  ChevronRight,
  X,
  ScanLine,
} from 'lucide-react';

const TIME_PRESETS = [
  { key: 'all', label: 'Tất cả thời gian' },
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày qua' },
  { key: '30d', label: '30 ngày qua' },
  { key: 'this_week', label: 'Tuần này' },
  { key: 'this_month', label: 'Tháng này' },
  { key: 'this_year', label: 'Năm nay' },
  { key: 'custom', label: 'Tùy chọn khoảng ngày...' },
];

const STATUS_OPTIONS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'verified', label: 'Đã xác nhận' },
  { key: 'draft', label: 'Chờ xác nhận' },
];

const TYPE_OPTIONS = [
  { key: 'all', label: 'Tất cả loại' },
  { key: 'Supermarket', label: 'Siêu thị / Bán lẻ' },
  { key: 'Cafe/Restaurant', label: 'Nhà hàng / Đồ uống' },
  { key: 'Utility', label: 'Tiện ích (Điện, Nước)' },
  { key: 'Shopping', label: 'Mua sắm' },
  { key: 'Other', label: 'Khác' },
];

const SORT_OPTIONS = [
  { key: 'date_desc', label: 'Mới nhất trước' },
  { key: 'date_asc', label: 'Cũ nhất trước' },
  { key: 'amount_desc', label: 'Tổng tiền giảm dần' },
  { key: 'amount_asc', label: 'Tổng tiền tăng dần' },
  { key: 'store_asc', label: 'Tên cửa hàng (A → Z)' },
];

// Xuất file CSV (UTF-8 BOM để mở trực tiếp bằng Microsoft Excel không lỗi tiếng Việt)
function downloadCSV(rows, filename) {
  const esc = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };
  const csvContent =
    '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Xuất file Excel (.xls chuẩn Spreadsheet HTML có định dạng bảng, tổng cộng, màu sắc)
function downloadExcelXLS(invoices, summary, filename) {
  const escHtml = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const rowsHtml = invoices
    .map((inv, idx) => {
      const itemsStr = Array.isArray(inv.items)
        ? inv.items
            .map((it) => `${it.item_name || it.name || ''} (x${it.quantity || 1})`)
            .join('; ')
        : '';
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${escHtml(inv.invoice_id)}</td>
          <td><b>${escHtml(inv.store_name || 'Chưa xác định')}</b></td>
          <td>${escHtml(inv.store_address || '')}</td>
          <td style="text-align:center;">${escHtml(inv.date || '')}</td>
          <td>${escHtml(inv.invoice_type || 'Hóa đơn')}</td>
          <td style="text-align:center;">${inv.is_submitted ? 'Đã xác nhận' : 'Chờ xác nhận'}</td>
          <td style="text-align:right;mso-number-format:'\\#\\,\\#\\#0';">${Number(inv.subtotal || 0)}</td>
          <td style="text-align:right;mso-number-format:'\\#\\,\\#\\#0';">${Number(inv.tax_amount || 0)}</td>
          <td style="text-align:right;font-weight:bold;color:#4F46E5;mso-number-format:'\\#\\,\\#\\#0';">${Number(inv.total_amount || 0)}</td>
          <td>${escHtml(itemsStr)}</td>
        </tr>`;
    })
    .join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="UTF-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
      th { background: #4F46E5; color: #FFFFFF; font-weight: bold; padding: 8px 10px; border: 1px solid #CBD5E1; }
      td { padding: 6px 10px; border: 1px solid #E2E8F0; vertical-align: top; }
      .title { font-size: 16px; font-weight: bold; color: #1E1B4B; }
      .sub { font-size: 12px; color: #64748B; }
      .sum { background: #EEF2FF; font-weight: bold; }
    </style>
  </head>
  <body>
    <table>
      <tr><td colspan="11" class="title">BÁO CÁO DANH SÁCH HÓA ĐƠN &amp; CHI TIÊU (INVOICE AI)</td></tr>
      <tr><td colspan="11" class="sub">Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')} | Tổng số hóa đơn: ${summary.count} | Tổng chi tiêu: ${Number(summary.total).toLocaleString('vi-VN')} đ</td></tr>
      <tr><td colspan="11"></td></tr>
      <thead>
        <tr>
          <th>STT</th>
          <th>Mã Hóa Đơn</th>
          <th>Cửa Hàng / Đơn Vị Bán</th>
          <th>Địa Chỉ</th>
          <th>Ngày Hóa Đơn</th>
          <th>Phân Loại</th>
          <th>Trạng Thái</th>
          <th>Tạm Tính (VNĐ)</th>
          <th>Thuế VAT (VNĐ)</th>
          <th>Tổng Thanh Toán (VNĐ)</th>
          <th>Chi Tiết Mặt Hàng</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="sum">
          <td colspan="9" style="text-align:right;">TỔNG CỘNG (${summary.count} HÓA ĐƠN):</td>
          <td style="text-align:right;color:#4F46E5;mso-number-format:'\\#\\,\\#\\#0';">${Number(summary.total)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;

  const blob = new Blob(['\uFEFF' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function History() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Bộ tham số lọc tập trung (filterParams)
  const [filterParams, setFilterParams] = useState({
    query: searchParams.get('q') || '',
    timeRange: 'all', // 'all' | 'today' | '7d' | '30d' | 'this_week' | 'this_month' | 'this_year' | 'custom'
    dateFrom: '',
    dateTo: '',
    status: 'all', // 'all' | 'verified' | 'draft'
    invoiceType: 'all',
    minAmount: '',
    maxAmount: '',
    sortBy: 'date_desc',
  });

  // Sync URL ?q= when navigated from Header quick search
  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam !== null && qParam !== filterParams.query) {
      setFilterParams((prev) => ({ ...prev, query: qParam }));
    }
  }, [searchParams]);

  const updateFilter = (patch) =>
    setFilterParams((prev) => ({ ...prev, ...patch }));

  const resetFilters = () => {
    setFilterParams({
      query: '',
      timeRange: 'all',
      dateFrom: '',
      dateTo: '',
      status: 'all',
      invoiceType: 'all',
      minAmount: '',
      maxAmount: '',
      sortBy: 'date_desc',
    });
    if (searchParams.get('q')) {
      setSearchParams({});
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await getInvoices({ limit: 500 });
      const data = res.data?.data || res.data || [];
      setInvoices(data);
    } catch (err) {
      console.error('Lỗi tải lịch sử:', err);
    } finally {
      setLoading(false);
    }
  };

  // Áp dụng toàn bộ filterParams theo NGÀY TRÊN HÓA ĐƠN
  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let rangeStart = null;
    let rangeEnd = null;

    switch (filterParams.timeRange) {
      case 'today':
        rangeStart = todayStart;
        rangeEnd = todayEnd;
        break;
      case '7d':
        rangeStart = new Date(todayStart.getTime() - 6 * 86400000);
        rangeEnd = todayEnd;
        break;
      case '30d':
        rangeStart = new Date(todayStart.getTime() - 29 * 86400000);
        rangeEnd = todayEnd;
        break;
      case 'this_week': {
        const dow = (now.getDay() + 6) % 7;
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow, 0, 0, 0, 0);
        rangeEnd = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + 6, 23, 59, 59, 999);
        break;
      }
      case 'this_month':
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'this_year':
        rangeStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        rangeEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'custom':
        if (filterParams.dateFrom) {
          rangeStart = new Date(filterParams.dateFrom + 'T00:00:00');
        }
        if (filterParams.dateTo) {
          rangeEnd = new Date(filterParams.dateTo + 'T23:59:59');
        }
        break;
      default:
        break;
    }

    const q = filterParams.query.trim().toLowerCase();
    const minAmt = filterParams.minAmount !== '' ? Number(filterParams.minAmount) : null;
    const maxAmt = filterParams.maxAmount !== '' ? Number(filterParams.maxAmount) : null;

    const list = invoices.filter((inv) => {
      if (q) {
        const inStore = (inv.store_name || '').toLowerCase().includes(q);
        const inAddr = (inv.store_address || '').toLowerCase().includes(q);
        const inId = (inv.invoice_id || '').toLowerCase().includes(q);
        const inDate = (inv.date || '').toLowerCase().includes(q);
        const inAmt = String(inv.total_amount || '').includes(q);
        const inItems =
          Array.isArray(inv.items) &&
          inv.items.some((it) => (it.item_name || it.name || '').toLowerCase().includes(q));
        if (!(inStore || inAddr || inId || inDate || inAmt || inItems)) return false;
      }

      if (filterParams.status === 'verified' && !inv.is_submitted) return false;
      if (filterParams.status === 'draft' && inv.is_submitted) return false;

      if (
        filterParams.invoiceType !== 'all' &&
        (inv.invoice_type || 'Other') !== filterParams.invoiceType
      ) {
        return false;
      }

      const amt = Number(inv.total_amount) || 0;
      if (minAmt !== null && amt < minAmt) return false;
      if (maxAmt !== null && amt > maxAmt) return false;

      if (rangeStart || rangeEnd) {
        const dt = parseInvoiceDate(inv);
        if (!dt) return false;
        if (rangeStart && dt < rangeStart) return false;
        if (rangeEnd && dt > rangeEnd) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      if (filterParams.sortBy === 'amount_desc') {
        return (Number(b.total_amount) || 0) - (Number(a.total_amount) || 0);
      }
      if (filterParams.sortBy === 'amount_asc') {
        return (Number(a.total_amount) || 0) - (Number(b.total_amount) || 0);
      }
      if (filterParams.sortBy === 'store_asc') {
        return (a.store_name || '').localeCompare(b.store_name || '', 'vi');
      }
      const da = parseInvoiceDate(a)?.getTime() || 0;
      const db = parseInvoiceDate(b)?.getTime() || 0;
      return filterParams.sortBy === 'date_asc' ? da - db : db - da;
    });

    return list;
  }, [invoices, filterParams]);

  // Xử lý xuất báo cáo theo exportType ('excel' | 'csv')
  const handleExport = (exportType) => {
    setExportMenuOpen(false);
    if (filtered.length === 0) {
      setToast({ type: 'error', text: 'Không có hóa đơn nào trong danh sách lọc để xuất!' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const totalSum = filtered.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);

    if (exportType === 'excel') {
      downloadExcelXLS(
        filtered,
        { count: filtered.length, total: totalSum },
        `Bao_cao_hoa_don_${stamp}.xls`
      );
      setToast({
        type: 'success',
        text: `Đã xuất ${filtered.length} hóa đơn ra file Excel (.xls)`,
      });
    } else {
      const header = [
        'STT',
        'Mã Hóa Đơn',
        'Cửa Hàng',
        'Địa Chỉ',
        'Ngày Hóa Đơn',
        'Phân Loại',
        'Trạng Thái',
        'Tạm Tính (VND)',
        'Thuế VAT (VND)',
        'Tổng Thanh Toán (VND)',
        'Chi Tiết Mặt Hàng',
      ];
      const rows = filtered.map((inv, idx) => [
        idx + 1,
        inv.invoice_id || '',
        inv.store_name || 'Chưa xác định',
        inv.store_address || '',
        inv.date || '',
        inv.invoice_type || 'Hóa đơn',
        inv.is_submitted ? 'Đã xác nhận' : 'Chờ xác nhận',
        Number(inv.subtotal || 0),
        Number(inv.tax_amount || 0),
        Number(inv.total_amount || 0),
        Array.isArray(inv.items)
          ? inv.items.map((it) => `${it.item_name || it.name || ''} (x${it.quantity || 1})`).join('; ')
          : '',
      ]);
      downloadCSV([header, ...rows], `Bao_cao_hoa_don_${stamp}.csv`);
      setToast({
        type: 'success',
        text: `Đã xuất ${filtered.length} hóa đơn ra file CSV (.csv)`,
      });
    }
    setTimeout(() => setToast(null), 3200);
  };

  const totalAmount = filtered.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
  const verifiedCount = filtered.filter((inv) => inv.is_submitted).length;

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '0 đ';
    return Number(amount).toLocaleString('vi-VN') + ' đ';
  };

  const renderTypeIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('cafe') || t.includes('restaurant')) return <Utensils size={19} strokeWidth={1.75} />;
    if (t.includes('super')) return <ShoppingBag size={19} strokeWidth={1.75} />;
    if (t.includes('util')) return <Zap size={19} strokeWidth={1.75} />;
    return <Store size={19} strokeWidth={1.75} />;
  };

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterParams.timeRange !== 'all') c++;
    if (filterParams.status !== 'all') c++;
    if (filterParams.invoiceType !== 'all') c++;
    if (filterParams.minAmount !== '' || filterParams.maxAmount !== '') c++;
    return c;
  }, [filterParams]);

  return (
    <div className="history-page">
      {/* Header + Nút Xuất file Excel/CSV (exportType) */}
      <div className="inv-mgr-header">
        <div>
          <h2>Quản lý danh sách hóa đơn</h2>
          <p>
            Tìm kiếm, lọc theo ngày phát hành trên hóa đơn, trạng thái xác nhận và xuất báo cáo Excel/CSV
          </p>
        </div>

        <div className="inv-export-wrap" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/scan')}
          >
            <ScanLine size={16} strokeWidth={1.75} />
            Quét thêm
          </button>

          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-primary btn-sm inv-export-btn"
              style={{ width: 'auto' }}
              onClick={() => setExportMenuOpen((v) => !v)}
            >
              <Download size={16} strokeWidth={1.75} />
              <span>Xuất file Excel / CSV ({filtered.length})</span>
            </button>

            {exportMenuOpen && (
              <>
                <div
                  className="inv-export-backdrop"
                  onClick={() => setExportMenuOpen(false)}
                />
                <div className="inv-export-menu">
                  <button onClick={() => handleExport('excel')}>
                    <span className="ico xls">
                      <FileSpreadsheet size={18} strokeWidth={1.75} />
                    </span>
                    <div>
                      <b>Xuất file Excel (.xls)</b>
                      <small>Bảng biểu định dạng chuẩn, có dòng tổng cộng</small>
                    </div>
                  </button>
                  <button onClick={() => handleExport('csv')}>
                    <span className="ico csv">
                      <FileText size={18} strokeWidth={1.75} />
                    </span>
                    <div>
                      <b>Xuất file CSV (.csv)</b>
                      <small>Định dạng UTF-8 chuẩn cho kế toán &amp; phân tích</small>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Thanh tìm kiếm + Dropdown lọc thời gian + Sắp xếp + Bộ lọc nâng cao */}
      <div className="inv-toolbar">
        <div className="inv-search">
          <Search size={17} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Tìm theo tên cửa hàng, mặt hàng, địa chỉ, ngày (VD: 23/02/2019), mã HĐ..."
            value={filterParams.query}
            onChange={(e) => updateFilter({ query: e.target.value })}
          />
          {filterParams.query && (
            <button
              className="inv-search-clear"
              onClick={() => updateFilter({ query: '' })}
              title="Xóa từ khóa"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Gộp nhóm các mốc thời gian vào 1 Dropdown gọn gàng cạnh thanh tìm kiếm */}
        <div className="inv-time-select-wrap">
          <Calendar size={15} strokeWidth={1.75} className="inv-time-select-icon" />
          <select
            className="inv-select inv-time-select"
            value={filterParams.timeRange}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'custom') {
                updateFilter({ timeRange: 'custom' });
                setShowFilterModal(true);
              } else {
                updateFilter({ timeRange: val, dateFrom: '', dateTo: '' });
              }
            }}
            title="Lọc theo ngày trên hóa đơn"
          >
            {TIME_PRESETS.map((tp) => (
              <option key={tp.key} value={tp.key}>
                {tp.label}
              </option>
            ))}
          </select>
        </div>

        <select
          className="inv-select"
          value={filterParams.sortBy}
          onChange={(e) => updateFilter({ sortBy: e.target.value })}
          title="Sắp xếp"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          className={`inv-filter-btn ${activeFilterCount > 0 ? 'has-filter' : ''}`}
          onClick={() => setShowFilterModal(true)}
        >
          <SlidersHorizontal size={16} strokeWidth={1.75} />
          <span>Bộ lọc nâng cao</span>
          {activeFilterCount > 0 && (
            <span className="inv-badge">{activeFilterCount}</span>
          )}
        </button>

        <div className="inv-view-toggle" title="Chuyển chế độ hiển thị">
          <button
            className={viewMode === 'grid' ? 'active' : ''}
            onClick={() => setViewMode('grid')}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <LayoutGrid size={16} strokeWidth={1.75} />
          </button>
          <button
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <List size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Chỉ giữ lại các nút lọc nhanh theo Trạng thái (Tất cả, Đã xác nhận, Chờ xác nhận) */}
      <div className="inv-quick-chips">
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
          Trạng thái:
        </span>
        {STATUS_OPTIONS.map((st) => (
          <button
            key={st.key}
            className={`chip ${filterParams.status === st.key ? 'active' : ''}`}
            onClick={() => updateFilter({ status: st.key })}
          >
            {st.label}
          </button>
        ))}

        {/* Hiển thị thẻ bộ lọc đang kích hoạt (nếu có) */}
        {(activeFilterCount > 0 || filterParams.query) && (
          <div className="inv-active-filters" style={{ marginTop: 0, marginLeft: 'auto' }}>
            {filterParams.timeRange !== 'all' && (
              <span className="inv-active-chip">
                Thời gian:{' '}
                {filterParams.timeRange === 'custom'
                  ? `${filterParams.dateFrom || '...'} → ${filterParams.dateTo || '...'}`
                  : TIME_PRESETS.find((t) => t.key === filterParams.timeRange)?.label}
                <button onClick={() => updateFilter({ timeRange: 'all', dateFrom: '', dateTo: '' })}>
                  ×
                </button>
              </span>
            )}
            {filterParams.invoiceType !== 'all' && (
              <span className="inv-active-chip">
                Loại: {TYPE_OPTIONS.find((t) => t.key === filterParams.invoiceType)?.label}
                <button onClick={() => updateFilter({ invoiceType: 'all' })}>×</button>
              </span>
            )}
            {(filterParams.minAmount !== '' || filterParams.maxAmount !== '') && (
              <span className="inv-active-chip">
                Số tiền: {filterParams.minAmount || 0} → {filterParams.maxAmount || '∞'} đ
                <button onClick={() => updateFilter({ minAmount: '', maxAmount: '' })}>×</button>
              </span>
            )}
            <button className="inv-clear-all" onClick={resetFilters}>
              Đặt lại bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* Thống kê nhanh kết quả lọc */}
      <div className="inv-stats">
        <div className="inv-stat">
          <div className="inv-stat-ico" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
            <Receipt size={20} strokeWidth={1.75} />
          </div>
          <div>
            <div className="inv-stat-label">Hóa đơn khớp lọc</div>
            <div className="inv-stat-value">
              {filtered.length}{' '}
              <small style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                / {invoices.length}
              </small>
            </div>
          </div>
        </div>

        <div className="inv-stat">
          <div className="inv-stat-ico" style={{ background: '#FDE8EF', color: '#E879A8' }}>
            <Wallet size={20} strokeWidth={1.75} />
          </div>
          <div>
            <div className="inv-stat-label">Tổng chi tiêu (kết quả lọc)</div>
            <div className="inv-stat-value" style={{ color: 'var(--primary)' }}>
              {formatCurrency(totalAmount)}
            </div>
          </div>
        </div>

        <div className="inv-stat">
          <div className="inv-stat-ico" style={{ background: 'rgba(16, 185, 129, 0.14)', color: '#10B981' }}>
            <CheckCircle2 size={20} strokeWidth={1.75} />
          </div>
          <div>
            <div className="inv-stat-label">Đã xác nhận / Chờ duyệt</div>
            <div className="inv-stat-value">
              {verifiedCount} / {filtered.length - verifiedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Danh sách Thẻ Hóa đơn (Đồng bộ chiều cao 100%) */}
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'inline-flex' }}>
            <Receipt size={42} strokeWidth={1.5} />
          </div>
          <h3>Không tìm thấy hóa đơn phù hợp</h3>
          <p>Hãy thử điều chỉnh bộ lọc thời gian/trạng thái hoặc từ khóa tìm kiếm.</p>
          {(activeFilterCount > 0 || filterParams.query) && (
            <button
              className="btn btn-outline btn-sm"
              style={{ marginTop: 12 }}
              onClick={resetFilters}
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'inv-grid' : 'inv-list'}>
          {filtered.map((inv) => {
            const itemCount = Array.isArray(inv.items) ? inv.items.length : 0;
            const hasAddress = Boolean(inv.store_address && inv.store_address.trim());
            return (
              <div
                key={inv.invoice_id}
                className="inv-card"
                onClick={() => navigate(`/history/${inv.invoice_id}`)}
              >
                <div className="inv-card-top">
                  <div className="inv-card-ico" style={{ color: 'var(--primary)' }}>
                    {renderTypeIcon(inv.invoice_type)}
                  </div>
                  <span className={`inv-status ${inv.is_submitted ? 'ok' : 'draft'}`}>
                    {inv.is_submitted ? 'Đã xác nhận' : 'Chờ xác nhận'}
                  </span>
                </div>

                <div className="inv-card-body">
                  <h4 title={inv.store_name || 'Cửa hàng chưa xác định'}>
                    {inv.store_name || 'Cửa hàng chưa xác định'}
                  </h4>

                  {/* Luôn cố định vùng địa chỉ để các thẻ bằng chiều cao nhau */}
                  <p
                    className={`inv-card-addr ${!hasAddress ? 'is-empty' : ''}`}
                    title={hasAddress ? inv.store_address : 'Chưa cập nhật địa chỉ'}
                  >
                    {hasAddress ? inv.store_address : 'Chưa cập nhật địa chỉ'}
                  </p>

                  <div className="inv-card-meta">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={13} strokeWidth={1.75} />
                      {inv.date || 'Chưa rõ ngày'}
                    </span>
                    <span>
                      {inv.invoice_type || 'Hóa đơn'}
                      {itemCount > 0 ? ` • ${itemCount} SP` : ''}
                    </span>
                  </div>
                </div>

                <div className="inv-card-foot">
                  <div>
                    <div className="inv-card-id">#{inv.invoice_id?.slice(-8)}</div>
                    <div className="inv-card-amount">{formatCurrency(inv.total_amount)}</div>
                  </div>
                  <span className="inv-card-arrow" style={{ display: 'inline-flex' }}>
                    <ChevronRight size={18} strokeWidth={1.75} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Bộ lọc nâng cao (filterParams) */}
      {showFilterModal && (
        <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="modal inv-filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Bộ lọc hóa đơn nâng cao</h3>
              <button className="modal-close" onClick={() => setShowFilterModal(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="modal-section">
              <label>Khoảng thời gian (theo ngày in trên hóa đơn)</label>
              <div className="chip-group">
                {TIME_PRESETS.map((tp) => (
                  <button
                    key={tp.key}
                    className={`chip ${filterParams.timeRange === tp.key ? 'active' : ''}`}
                    onClick={() => updateFilter({ timeRange: tp.key })}
                  >
                    {tp.label}
                  </button>
                ))}
              </div>

              {filterParams.timeRange === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                  <div className="date-input-row">
                    <label>Từ ngày</label>
                    <input
                      type="date"
                      value={filterParams.dateFrom}
                      onChange={(e) => updateFilter({ dateFrom: e.target.value })}
                    />
                  </div>
                  <div className="date-input-row">
                    <label>Đến ngày</label>
                    <input
                      type="date"
                      value={filterParams.dateTo}
                      onChange={(e) => updateFilter({ dateTo: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-section">
              <label>Trạng thái xác nhận</label>
              <div className="chip-group">
                {STATUS_OPTIONS.map((st) => (
                  <button
                    key={st.key}
                    className={`chip ${filterParams.status === st.key ? 'active' : ''}`}
                    onClick={() => updateFilter({ status: st.key })}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-section">
              <label>Phân loại hóa đơn</label>
              <div className="chip-group">
                {TYPE_OPTIONS.map((tp) => (
                  <button
                    key={tp.key}
                    className={`chip ${filterParams.invoiceType === tp.key ? 'active' : ''}`}
                    onClick={() => updateFilter({ invoiceType: tp.key })}
                  >
                    {tp.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-section">
              <label>Khoảng tổng tiền (VNĐ)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input
                  type="number"
                  className="inv-num-input"
                  placeholder="Từ (VD: 50000)"
                  value={filterParams.minAmount}
                  onChange={(e) => updateFilter({ minAmount: e.target.value })}
                />
                <input
                  type="number"
                  className="inv-num-input"
                  placeholder="Đến (VD: 1000000)"
                  value={filterParams.maxAmount}
                  onChange={(e) => updateFilter({ maxAmount: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={resetFilters}>
                Đặt lại mặc định
              </button>
              <button className="btn btn-primary" onClick={() => setShowFilterModal(false)}>
                Áp dụng ({filtered.length} HĐ)
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`inv-toast ${toast.type}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} strokeWidth={1.75} />
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
