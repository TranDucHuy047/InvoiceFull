
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
    // Call the export API
    axiosClient.get('/invoices/export', { responseType: 'blob' })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'invoices_export.csv');
        document.body.appendChild(link);
        link.click();
      })
      .catch(err => alert("Không có dữ liệu hóa đơn để xuất."));
  };

  const filtered = invoices.filter(i => 
    (i.store_name && i.store_name.toLowerCase().includes(search.toLowerCase())) || 
    (i.invoice_id && i.invoice_id.toLowerCase().includes(search.toLowerCase())) ||
    (i.user_name && i.user_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-fade-in">
      <Header title="Quản lý hóa đơn" subtitle="Theo dõi hóa đơn đã lưu trong hệ thống." />
      
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div className="input-group">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Tìm cửa hàng, mã hóa đơn..." 
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
                  <td style={{ fontWeight: '600' }}>{inv.total_amount || '0'}đ</td>
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
