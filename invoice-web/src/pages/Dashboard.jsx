import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getInvoices } from '../services/api';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import {
  Wallet,
  Receipt,
  Calculator,
  Award,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ScanLine,
  ArrowRight,
  Store,
  Calendar,
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

// Parse ngày trên hóa đơn (hỗ trợ DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, ISO...)
export function parseInvoiceDate(inv) {
  const raw = inv?.date || inv?.created_at || '';
  if (!raw) return null;
  const s = String(raw).trim();

  // DD/MM/YYYY hoặc DD-MM-YYYY (có thể kèm giờ)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(dt)) return dt;
  }

  // YYYY-MM-DD hoặc YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(dt)) return dt;
  }

  const fallback = new Date(s);
  return isNaN(fallback) ? null : fallback;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function getWeekBounds(anchor) {
  const d = new Date(anchor);
  const dow = (d.getDay() + 6) % 7; // Thứ 2 = 0 ... Chủ nhật = 6
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  return { start, end };
}

const fmtDM = (d) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const fmtDMY = (d) => `${fmtDM(d)}/${d.getFullYear()}`;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [period, setPeriod] = useState('month');
  const [chartMode, setChartMode] = useState('count'); // 'count' | 'amount'
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [autoAligned, setAutoAligned] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await getInvoices({ limit: 500 });
      const data = res.data?.data || res.data || [];
      setInvoices(data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  };

  // Tự nhảy về mốc ngày của hóa đơn mới nhất nếu kỳ hiện tại không có hóa đơn nào
  useEffect(() => {
    if (autoAligned || invoices.length === 0) return;
    const dated = invoices
      .map((inv) => ({ inv, dt: parseInvoiceDate(inv) }))
      .filter((x) => x.dt)
      .sort((a, b) => b.dt - a.dt);
    if (dated.length > 0) {
      const now = new Date();
      const hasInCurrentMonth = dated.some(
        (x) =>
          x.dt.getFullYear() === now.getFullYear() &&
          x.dt.getMonth() === now.getMonth()
      );
      if (!hasInCurrentMonth) {
        setAnchorDate(dated[0].dt);
      }
    }
    setAutoAligned(true);
  }, [invoices, autoAligned]);

  // Dịch chuyển kỳ: -1 (trước) / +1 (sau)
  const shiftPeriod = (dir) => {
    setAnchorDate((prev) => {
      const d = new Date(prev);
      if (period === 'day') d.setDate(d.getDate() + dir);
      else if (period === 'week') d.setDate(d.getDate() + dir * 7);
      else if (period === 'month') d.setMonth(d.getMonth() + dir);
      else if (period === 'year') d.setFullYear(d.getFullYear() + dir);
      return d;
    });
  };

  // Tính khoảng thời gian, nhãn hiển thị, hóa đơn khớp & các bucket cho biểu đồ
  const periodInfo = useMemo(() => {
    let start, end, label;
    const a = anchorDate;

    if (period === 'day') {
      start = startOfDay(a);
      end = endOfDay(a);
      label = `Ngày ${fmtDMY(a)}`;
    } else if (period === 'week') {
      const wb = getWeekBounds(a);
      start = wb.start;
      end = wb.end;
      label = `Tuần ${fmtDM(start)} – ${fmtDMY(end)}`;
    } else if (period === 'month') {
      start = new Date(a.getFullYear(), a.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(a.getFullYear(), a.getMonth() + 1, 0, 23, 59, 59, 999);
      label = `Tháng ${String(a.getMonth() + 1).padStart(2, '0')}/${a.getFullYear()}`;
    } else {
      start = new Date(a.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(a.getFullYear(), 11, 31, 23, 59, 59, 999);
      label = `Năm ${a.getFullYear()}`;
    }

    const matched = [];
    for (const inv of invoices) {
      const dt = parseInvoiceDate(inv);
      if (dt && dt >= start && dt <= end) {
        matched.push({ inv, dt });
      }
    }

    let labels = [];
    let counts = [];
    let amounts = [];

    if (period === 'day') {
      labels = ['00-04h', '04-08h', '08-12h', '12-16h', '16-20h', '20-24h'];
      counts = new Array(6).fill(0);
      amounts = new Array(6).fill(0);
      matched.forEach(({ inv }, idx) => {
        const raw = String(inv.date || inv.created_at || '');
        const tm = raw.match(/(\d{1,2}):(\d{2})/);
        const bucket = tm ? Math.min(5, Math.floor(Number(tm[1]) / 4)) : (idx % 4) + 1;
        counts[bucket] += 1;
        amounts[bucket] += Number(inv.total_amount) || 0;
      });
    } else if (period === 'week') {
      labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      counts = new Array(7).fill(0);
      amounts = new Array(7).fill(0);
      matched.forEach(({ inv, dt }) => {
        const idx = (dt.getDay() + 6) % 7;
        counts[idx] += 1;
        amounts[idx] += Number(inv.total_amount) || 0;
      });
    } else if (period === 'month') {
      const daysInMonth = end.getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
      counts = new Array(daysInMonth).fill(0);
      amounts = new Array(daysInMonth).fill(0);
      matched.forEach(({ inv, dt }) => {
        const idx = dt.getDate() - 1;
        counts[idx] += 1;
        amounts[idx] += Number(inv.total_amount) || 0;
      });
    } else {
      labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
      counts = new Array(12).fill(0);
      amounts = new Array(12).fill(0);
      matched.forEach(({ inv, dt }) => {
        const idx = dt.getMonth();
        counts[idx] += 1;
        amounts[idx] += Number(inv.total_amount) || 0;
      });
    }

    const totalCount = matched.length;
    const totalAmount = matched.reduce(
      (sum, { inv }) => sum + (Number(inv.total_amount) || 0),
      0
    );

    const avgAmount = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;

    let highestInv = null;
    for (const { inv } of matched) {
      const val = Number(inv.total_amount) || 0;
      if (!highestInv || val > (Number(highestInv.total_amount) || 0)) {
        highestInv = inv;
      }
    }

    // Fallback to overall highest if current period is empty
    if (!highestInv && invoices.length > 0) {
      for (const inv of invoices) {
        const val = Number(inv.total_amount) || 0;
        if (!highestInv || val > (Number(highestInv.total_amount) || 0)) {
          highestInv = inv;
        }
      }
    }

    return {
      start,
      end,
      label,
      matched: matched.map((m) => m.inv),
      labels,
      counts,
      amounts,
      totalCount,
      totalAmount,
      avgAmount,
      highestInv,
    };
  }, [invoices, period, anchorDate]);

  const series = chartMode === 'count' ? periodInfo.counts : periodInfo.amounts;

  const chartData = {
    labels: periodInfo.labels,
    datasets: [
      {
        data: series,
        fill: true,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 180);
          gradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
          gradient.addColorStop(1, 'rgba(99, 102, 241, 0.01)');
          return gradient;
        },
        borderColor: '#6366F1',
        borderWidth: 2.5,
        pointBackgroundColor: '#6366F1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: period === 'month' ? 3 : 4,
        pointHoverRadius: 6,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E1B4B',
        titleFont: { size: 12 },
        bodyFont: { size: 13, weight: 'bold' },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) =>
            chartMode === 'count'
              ? `${ctx.parsed.y} hóa đơn`
              : `${Number(ctx.parsed.y).toLocaleString('vi-VN')} đ`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9CA3AF', font: { size: 11 }, maxTicksLimit: 12 },
        border: { display: false },
      },
      y: {
        display: false,
        beginAtZero: true,
      },
    },
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '0 đ';
    return Number(amount).toLocaleString('vi-VN') + ' đ';
  };

  const recentInvoices = (periodInfo.matched.length > 0 ? periodInfo.matched : invoices).slice(0, 6);

  const periodTitleMap = {
    day: 'Tổng chi tiêu ngày',
    week: 'Tổng chi tiêu tuần',
    month: 'Tổng chi tiêu tháng',
    year: 'Tổng chi tiêu năm',
  };

  return (
    <div className="dashboard-page">
      {/* Header Greeting & Period Filter */}
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Xin chào, {user?.full_name || user?.username}</span>
          </h2>
          <p>Theo dõi chỉ số chi tiêu, chứng từ và lịch sử hóa đơn theo thời gian thực.</p>
        </div>

        <div className="period-tabs">
          {[
            { key: 'day', label: 'Ngày' },
            { key: 'week', label: 'Tuần' },
            { key: 'month', label: 'Tháng' },
            { key: 'year', label: 'Năm' },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`period-tab ${period === tab.key ? 'active' : ''}`}
              onClick={() => setPeriod(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Thanh điều hướng kỳ theo Ngày trên Hóa đơn */}
      <div className="period-nav">
        <button className="period-nav-btn" onClick={() => shiftPeriod(-1)} title="Kỳ trước">
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="period-nav-label">
          <Calendar size={14} strokeWidth={1.75} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
          {periodInfo.label}
        </div>
        <button className="period-nav-btn" onClick={() => shiftPeriod(1)} title="Kỳ tiếp">
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
        <button
          className="period-nav-today"
          onClick={() => setAnchorDate(new Date())}
          title="Về hôm nay"
        >
          Hôm nay
        </button>
        {invoices.length > 0 && periodInfo.totalCount === 0 && (
          <button
            className="period-nav-today"
            style={{ background: 'var(--primary-bg)', color: 'var(--primary)', borderColor: 'transparent' }}
            onClick={() => {
              const latest = invoices
                .map((i) => parseInvoiceDate(i))
                .filter(Boolean)
                .sort((a, b) => b - a)[0];
              if (latest) setAnchorDate(latest);
            }}
          >
            Tới kỳ có hóa đơn mới nhất
          </button>
        )}
        <span className="period-nav-hint">
          Thống kê theo ngày in trên hóa đơn ({periodInfo.totalCount}/{invoices.length} HĐ)
        </span>
      </div>

      {/* 4 KPI Stat Cards Row */}
      <div className="kpi-grid-4">
        <div className="kpi-stat-card">
          <div className="kpi-stat-top">
            <span className="kpi-stat-title">{periodTitleMap[period] || 'Tổng chi tiêu tháng'}</span>
            <div className="kpi-stat-icon indigo">
              <Wallet size={19} strokeWidth={1.75} />
            </div>
          </div>
          <div className="kpi-stat-value">{formatCurrency(periodInfo.totalAmount)}</div>
          <div className="kpi-stat-sub">
            Trong {periodInfo.label.toLowerCase()} ({periodInfo.totalCount} hóa đơn)
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-stat-top">
            <span className="kpi-stat-title">Tổng số hóa đơn</span>
            <div className="kpi-stat-icon blue">
              <Receipt size={19} strokeWidth={1.75} />
            </div>
          </div>
          <div className="kpi-stat-value">{periodInfo.totalCount}</div>
          <div className="kpi-stat-sub">
            Toàn hệ thống: {invoices.length} chứng từ đã lưu
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-stat-top">
            <span className="kpi-stat-title">Trung bình / hóa đơn</span>
            <div className="kpi-stat-icon emerald">
              <Calculator size={19} strokeWidth={1.75} />
            </div>
          </div>
          <div className="kpi-stat-value">{formatCurrency(periodInfo.avgAmount)}</div>
          <div className="kpi-stat-sub">
            Mức chi tiêu bình quân mỗi giao dịch
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-stat-top">
            <span className="kpi-stat-title">Hóa đơn cao nhất</span>
            <div className="kpi-stat-icon amber">
              <Award size={19} strokeWidth={1.75} />
            </div>
          </div>
          <div className="kpi-stat-value">
            {periodInfo.highestInv ? formatCurrency(periodInfo.highestInv.total_amount) : '0 đ'}
          </div>
          <div className="kpi-stat-sub" title={periodInfo.highestInv?.store_name || ''}>
            {periodInfo.highestInv
              ? `${periodInfo.highestInv.store_name || 'Chưa rõ cửa hàng'}`
              : 'Chưa có dữ liệu hóa đơn'}
          </div>
        </div>
      </div>

      {/* Biểu đồ xu hướng (Chiều cao cân đối, bỏ dòng hint dài dòng ở đáy) */}
      <div className="chart-container" style={{ minHeight: 'auto', padding: '20px 24px' }}>
        <div
          className="stats-header"
          style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}
        >
          <div>
            <div className="stats-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              Biểu đồ xu hướng — {periodInfo.label}
            </div>
            <div className="stats-value" style={{ fontSize: '24px', marginTop: '2px' }}>
              {chartMode === 'count'
                ? `${periodInfo.totalCount} hóa đơn`
                : formatCurrency(periodInfo.totalAmount)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`chip ${chartMode === 'count' ? 'active' : ''}`}
              onClick={() => setChartMode('count')}
            >
              Số lượng ({periodInfo.totalCount})
            </button>
            <button
              className={`chip ${chartMode === 'amount' ? 'active' : ''}`}
              onClick={() => setChartMode('amount')}
            >
              Chi tiêu
            </button>
          </div>
        </div>

        <div style={{ height: '185px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Hóa đơn gần đây */}
      <div className="recent-section">
        <div className="section-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Hóa đơn gần đây</span>
            {periodInfo.matched.length > 0 && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--primary)',
                  background: 'var(--primary-bg)',
                  padding: '2px 10px',
                  borderRadius: '999px',
                }}
              >
                {periodInfo.label}
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ width: 'auto', padding: '7px 14px' }}
              onClick={() => navigate('/scan')}
            >
              <ScanLine size={15} strokeWidth={1.75} />
              Quét hóa đơn mới
            </button>
            <a
              href="/history"
              onClick={(e) => {
                e.preventDefault();
                navigate('/history');
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              Xem tất cả
              <ArrowRight size={15} strokeWidth={1.75} />
            </a>
          </div>
        </div>

        {loading ? (
          <div className="loading-overlay" style={{ padding: '40px' }}>
            <div className="spinner"></div>
          </div>
        ) : recentInvoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ display: 'inline-flex' }}>
              <Receipt size={42} strokeWidth={1.5} />
            </div>
            <h3>Chưa có hóa đơn nào</h3>
            <p>Hãy quét hóa đơn đầu tiên của bạn để bắt đầu theo dõi chi tiêu.</p>
          </div>
        ) : (
          recentInvoices.map((inv) => (
            <div
              key={inv.invoice_id}
              className="invoice-item"
              onClick={() => navigate(`/history/${inv.invoice_id}`)}
            >
              <div className="invoice-item-icon">
                <Store size={20} strokeWidth={1.75} />
              </div>
              <div className="invoice-item-info">
                <h4>{inv.store_name || 'Cửa hàng chưa xác định'}</h4>
                <div className="invoice-item-meta">
                  <span>{inv.date || 'Chưa rõ ngày'}</span>
                  <span>•</span>
                  <span>{inv.invoice_type || 'Hóa đơn bán lẻ'}</span>
                  {inv.store_address && (
                    <>
                      <span>•</span>
                      <span style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.store_address}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="invoice-item-amount">{formatCurrency(inv.total_amount)}</div>
              <span className="invoice-item-arrow" style={{ display: 'inline-flex' }}>
                <ChevronRight size={18} strokeWidth={1.75} />
              </span>
            </div>
          ))
        )}
      </div>

      {/* Floating AI Button */}
      <button className="ai-fab" onClick={() => navigate('/ai-chat')} title="Trợ lý AI">
        <Sparkles size={22} strokeWidth={1.75} />
      </button>
    </div>
  );
}
