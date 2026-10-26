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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await getInvoices({ limit: 5 });
      setInvoices(res.data.data);
      setTotalCount(res.data.data.length * 12); 
    } catch (error) {
      console.error(error);
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

  const chartData = {
    labels: ['1', '5', '10', '15', '20', '25', '30'],
    datasets: [
      {
        fill: true,
        label: 'Hóa đơn',
        data: [12, 19, 15, 25, 22, 30, 28],
        borderColor: '#6C5CE7',
        backgroundColor: 'rgba(108, 92, 231, 0.1)',
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
        <div className="stats-header">
          <div className="stats-icon purple">🧾</div>
          <div>
            <div className="stats-label">Tổng hóa đơn</div>
            <div className="stats-value">{totalCount > 0 ? totalCount : 148}</div>
          </div>
        </div>
        <div style={{ height: '220px', marginTop: '20px' }}>
          <Line options={chartOptions} data={chartData} />
        </div>
        <div className="chart-hint">Vuốt ngang để chuyển Tổng hóa đơn / Tổng chi tiêu</div>
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
          {invoices.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🧾</div>
              <p>Chưa có hóa đơn nào gần đây.</p>
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
