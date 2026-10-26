import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getInvoices } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('Tháng');
  const [invoices, setInvoices] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [chartMode, setChartMode] = useState('count'); // 'count' or 'amount'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getInvoices();
      const list = res.data?.data || [];
      setInvoices(list.slice(0, 5));
      setTotalCount(list.length);

      const sumAmount = list.reduce((acc, inv) => acc + (Number(inv.total_amount) || 0), 0);
      setTotalAmount(sumAmount);
    } catch (error) {
      console.error('Error fetching invoices for dashboard:', error);
      setInvoices([]);
      setTotalCount(0);
      setTotalAmount(0);
    } finally {
      setLoading(false);
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            if (chartMode === 'amount') {
              return `Chi tiêu: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(context.raw)}`;
            }
            return `Hóa đơn: ${context.raw}`;
          }
        }
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: { display: false, grid: { display: false } },
    },
    elements: {
      line: { tension: 0.4 },
    },
  };

  // Generate chart data based on real user invoice count
  const chartData = {
    labels: ['1', '5', '10', '15', '20', '25', '30'],
    datasets: [
      {
        fill: true,
        label: chartMode === 'amount' ? 'Chi tiêu' : 'Hóa đơn',
        data: totalCount === 0 
          ? [0, 0, 0, 0, 0, 0, 0] 
          : (chartMode === 'amount' 
              ? [0, 0, totalAmount * 0.2, totalAmount * 0.5, totalAmount * 0.7, totalAmount * 0.9, totalAmount]
              : [0, 0, Math.ceil(totalCount * 0.2), Math.ceil(totalCount * 0.4), Math.ceil(totalCount * 0.6), Math.ceil(totalCount * 0.8), totalCount]),
        borderColor: '#6C5CE7',
        backgroundColor: 'rgba(108, 92, 231, 0.12)',
        pointBackgroundColor: '#6C5CE7',
        pointRadius: totalCount === 0 ? 2 : 4,
      },
    ],
  };

  return (
    <>
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <h2>Xin chào, {user?.full_name || user?.username} <span className="sparkle">✨</span></h2>
          <p>Theo dõi hóa đơn và chi tiêu của bạn.</p>
        </div>
        <div className="period-tabs">
          <button className={`period-tab ${period === 'Ngày' ? 'active' : ''}`} onClick={() => setPeriod('Ngày')}>Ngày</button>
          <button className={`period-tab ${period === 'Tuần' ? 'active' : ''}`} onClick={() => setPeriod('Tuần')}>Tuần</button>
          <button className={`period-tab ${period === 'Tháng' ? 'active' : ''}`} onClick={() => setPeriod('Tháng')}>Tháng</button>
          <button className={`period-tab ${period === 'Năm' ? 'active' : ''}`} onClick={() => setPeriod('Năm')}>Năm</button>
        </div>
      </div>

      <div className="chart-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="stats-header" style={{ cursor: 'pointer' }} onClick={() => setChartMode(chartMode === 'count' ? 'amount' : 'count')}>
            <div className="stats-icon purple">🧾</div>
            <div>
              <div className="stats-label">{chartMode === 'count' ? 'Tổng hóa đơn' : 'Tổng chi tiêu'}</div>
              <div className="stats-value">
                {chartMode === 'count' 
                  ? totalCount 
                  : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalAmount)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setChartMode('count')}
              style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                border: 'none', cursor: 'pointer',
                background: chartMode === 'count' ? 'var(--primary)' : 'var(--secondary)',
                color: chartMode === 'count' ? 'white' : 'var(--primary)'
              }}
            >
              Số lượng ({totalCount})
            </button>
            <button 
              onClick={() => setChartMode('amount')}
              style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                border: 'none', cursor: 'pointer',
                background: chartMode === 'amount' ? 'var(--primary)' : 'var(--secondary)',
                color: chartMode === 'amount' ? 'white' : 'var(--primary)'
              }}
            >
              Chi tiêu
            </button>
          </div>
        </div>

        <div style={{ height: '220px', marginTop: '20px' }}>
          <Line options={chartOptions} data={chartData} />
        </div>
        <div className="chart-hint">Bấm nút trên hoặc tiêu đề để chuyển đổi giữa Tổng hóa đơn và Tổng chi tiêu</div>
      </div>

      <div className="quick-access">
        <h3>Truy cập nhanh</h3>
        <div className="quick-access-grid">
          <Link to="/scan" className="quick-btn">
            <span className="qicon">📷</span> Quét hóa đơn
          </Link>
          <Link to="/history" className="quick-btn">
            <span className="qicon">🕒</span> Lịch sử
          </Link>
          <Link to="/trash" className="quick-btn">
            <span className="qicon">🗑️</span> Lịch sử xóa
          </Link>
          <Link to="/history" className="quick-btn">
            <span className="qicon">📥</span> Xuất dữ liệu
          </Link>
        </div>
      </div>

      <div className="recent-section">
        <div className="section-header">
          <h3>Hóa đơn gần đây</h3>
          <Link to="/history">Xem tất cả</Link>
        </div>
        
        <div className="invoice-list">
          {invoices.map((inv) => (
            <div key={inv.invoice_id} className="invoice-item" onClick={() => navigate(`/history/${inv.invoice_id}`)}>
              <div className="invoice-item-icon">🧾</div>
              <div className="invoice-item-info">
                <h4>{inv.store_name || 'Không rõ cửa hàng'}</h4>
                <div className="invoice-item-meta">
                  <span>{inv.date || 'Không có ngày'}</span>
                  <span>•</span>
                  <span>Hóa đơn</span>
                </div>
              </div>
              <div className="invoice-item-amount">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(inv.total_amount || 0)}
              </div>
              <div className="invoice-item-arrow">›</div>
            </div>
          ))}
          {invoices.length === 0 && !loading && (
            <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div className="empty-icon" style={{ fontSize: '40px', marginBottom: '8px' }}>🧾</div>
              <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Chưa có hóa đơn nào</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>Tài khoản của bạn chưa quét hoặc tải lên hóa đơn nào.</p>
              <Link to="/scan" className="btn btn-primary" style={{ display: 'inline-flex', padding: '8px 18px', textDecoration: 'none' }}>
                📷 Quét hóa đơn ngay
              </Link>
            </div>
          )}
        </div>
      </div>
      
      <button className="ai-fab" onClick={() => navigate('/ai-chat')} title="Hỏi AI">
        ✨
      </button>
    </>
  );
}
