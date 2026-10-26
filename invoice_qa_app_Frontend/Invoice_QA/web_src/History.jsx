import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoices, exportCSV } from '../services/api';

export default function History() {
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  
  const [timeRange, setTimeRange] = useState('Tất cả');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await getInvoices();
      setInvoices(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportCSV();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'invoices_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      alert('Đã xuất dữ liệu Excel/CSV mẫu.');
    } catch (err) {
      alert('Lỗi khi xuất dữ liệu');
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.invoice_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  return (
    <div>
      <div className="history-header">
        <h2>Lịch sử hóa đơn</h2>
        <button className="btn btn-outline btn-sm" onClick={handleExport}>
          📥 Xuất Excel / CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Tìm cửa hàng hoặc mã hóa đơn..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="filter-btn" onClick={() => setShowFilter(true)}>
          <span style={{ fontSize: '20px' }}>⚡</span>
        </button>
      </div>

      <div className="stats-row">
        <div className="mini-stat">
          <div className="mini-stat-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>🧾</div>
          <div className="mini-stat-label">Tổng hóa đơn</div>
          <div className="mini-stat-value">{filteredInvoices.length}</div>
        </div>
        <div className="mini-stat">
          <div className="mini-stat-icon" style={{ background: '#E0F2FE', color: '#0369A1' }}>💰</div>
          <div className="mini-stat-label">Tổng chi tiêu</div>
          <div className="mini-stat-value">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalAmount)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner"></div></div>
      ) : (
        <div className="invoice-list">
          {filteredInvoices.map((inv) => (
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
          {filteredInvoices.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <h3>Không tìm thấy hóa đơn</h3>
              <p>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
            </div>
          )}
        </div>
      )}

      {showFilter && (
        <div className="modal-overlay" onClick={() => setShowFilter(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Lọc hóa đơn</h3>
              <button className="modal-close" onClick={() => setShowFilter(false)}>×</button>
            </div>
            
            <div className="modal-section">
              <label>Khoảng thời gian</label>
              <div className="chip-group">
                {['Tất cả', 'Hôm nay', '7 ngày', '30 ngày', 'Tháng này', 'Tùy chọn'].map(t => (
                  <button 
                    key={t}
                    className={`chip ${timeRange === t ? 'active' : ''}`}
                    onClick={() => setTimeRange(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            
            {timeRange === 'Tùy chọn' && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="date-input-row" style={{ flex: 1 }}>
                  <label>Từ ngày</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="date-input-row" style={{ flex: 1 }}>
                  <label>Đến ngày</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
            )}
            
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => {
                setTimeRange('Tất cả');
                setStartDate('');
                setEndDate('');
              }}>
                Đặt lại
              </button>
              <button className="btn btn-primary" onClick={() => {
                setShowFilter(false);
                fetchInvoices();
              }}>
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
