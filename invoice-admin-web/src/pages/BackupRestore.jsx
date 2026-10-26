import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import axiosClient from '../api/axiosClient';
import { Database, RefreshCw } from 'lucide-react';

export default function BackupRestore() {
  const [backups, setBackups] = useState([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchBackups = () => {
    axiosClient.get('/admin/backups')
      .then(res => {
        if(res.data.status === 200) {
          setBackups(res.data.data || []);
        }
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleBackup = () => {
    setIsBackingUp(true);
    axiosClient.post('/admin/backups')
      .then(res => {
        alert(res.data.message);
        fetchBackups();
      })
      .catch(err => {
        alert("Lỗi sao lưu: " + err.message);
      })
      .finally(() => setIsBackingUp(false));
  };

  const handleRestore = (filename) => {
    if(!window.confirm(`Bạn có chắc muốn khôi phục từ bản sao lưu ${filename}? Quá trình này sẽ ghi đè dữ liệu hiện tại.`)) return;
    
    setIsRestoring(true);
    axiosClient.post(`/admin/backups/restore?filename=${filename}`)
      .then(res => {
        alert(res.data.message);
      })
      .catch(err => {
        alert("Lỗi khôi phục: " + err.message);
      })
      .finally(() => setIsRestoring(false));
  };

  return (
    <div className="animate-fade-in">
      <Header title="Sao lưu / Khôi phục dữ liệu" subtitle="Quản lý các bản sao lưu hệ thống." />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database color="var(--primary)" />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Sao lưu dữ liệu</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tạo bản sao lưu tài khoản, hóa đơn và lịch sử.</div>
            </div>
          </div>
          <button className="btn" onClick={handleBackup} disabled={isBackingUp}>
            {isBackingUp ? "Đang sao lưu..." : "Sao lưu ngay"}
          </button>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw color="var(--text-main)" />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Khôi phục dữ liệu</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Chọn bản sao lưu ở danh sách dưới để khôi phục.</div>
            </div>
          </div>
          <button className="btn btn-outline" disabled={true}>Chọn từ danh sách</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '24px' }}>Lịch sử sao lưu / Khôi phục</h3>
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Tệp sao lưu</th>
                <th>Kích thước</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {backups.length > 0 ? backups.map(b => (
                <tr key={b.name}>
                  <td>{b.created_at}</td>
                  <td style={{ fontWeight: '600' }}>{b.name}</td>
                  <td>{b.size}</td>
                  <td>
                    <button 
                      className="btn btn-outline" 
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => handleRestore(b.name)}
                      disabled={isRestoring}
                    >
                      {isRestoring ? "Đang xử lý" : "Khôi phục"}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    Chưa có bản sao lưu nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
