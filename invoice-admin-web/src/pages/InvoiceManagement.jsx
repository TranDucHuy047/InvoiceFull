
import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import axiosClient from '../api/axiosClient';
import { Search, Upload } from 'lucide-react';

export default function InvoiceManagement() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');

  const fetchInvoices = () => {
    axiosClient.get('/admin/invoices')
      .then(res => {
        if(res.data.status === 200) {
          setInvoices(res.data.data);
        }
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleExport = () => {
    if (!filtered || filtered.length === 0) {
      return;
    }

    const headers = ['Mã HĐ', 'Cửa hàng', 'Người dùng', 'Ngày', 'Tổng tiền', 'Trạng thái'];
    const rows = filtered.map((inv) => [
      `"${String(inv.invoice_id || 'N/A').replace(/"/g, '""')}"`,
      `"${String(inv.store_name || 'Không xác định').replace(/"/g, '""')}"`,
      `"${String(inv.user_name || 'Không xác định').replace(/"/g, '""')}"`,
      `"${String(inv.date || '-').replace(/"/g, '""')}"`,
      `"${Number(inv.total_amount || 0).toLocaleString('vi-VN')} đ"`,
      inv.total_amount && Number(inv.total_amount) !== 0 ? 'Thành công' : 'Cần kiểm tra',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `danh_sach_hoa_don_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const filtered = invoices.filter(i => 
    (i.store_name && i.store_name.toLowerCase().includes(search.toLowerCase())) || 
    (i.invoice_id && i.invoice_id.toLowerCase().includes(search.toLowerCase())) ||
    (i.user_name && i.user_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-fade-in">
      <Header title="Quản lý hóa đơn & tài liệu" subtitle="Theo dõi hóa đơn (SROIE) và tài liệu / biểu mẫu (FUNSD) đã lưu trong hệ thống." />
      
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div className="input-group">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Tìm cửa hàng, tiêu đề tài liệu, mã chứng từ..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-outline" onClick={handleExport}>
            <Upload size={18} style={{ transform: 'rotate(180deg)' }} />
            Xuất dữ liệu
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mã HĐ</th>
                <th>Cửa hàng</th>
                <th>Người dùng</th>
                <th>Ngày</th>
                <th>Tổng tiền</th>
                <th>Trạng thái OCR</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, idx) => (
                <tr key={inv.invoice_id || idx}>
                  <td style={{ color: 'var(--text-muted)' }}>{inv.invoice_id || 'N/A'}</td>
                  <td style={{ fontWeight: '500' }}>{inv.store_name || 'Không xác định'}</td>
                  <td>{inv.user_name || 'Không xác định'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{inv.date || '-'}</td>
                  <td style={{ fontWeight: '600' }}>{Number(inv.total_amount || 0).toLocaleString('vi-VN')} đ</td>
                  <td>
                    {inv.total_amount && inv.total_amount != '0' ? 
                      <span className="badge badge-success">Thành công</span> : 
                      <span className="badge badge-warning">Cần kiểm tra</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Không có dữ liệu.</div>}
        </div>
      </div>
    </div>
  );
}
