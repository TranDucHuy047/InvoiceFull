import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import axiosClient from '../api/axiosClient';
import { AlertTriangle, HelpCircle, CheckCircle2 } from 'lucide-react';

export default function ErrorReports() {
  const [reports, setReports] = useState([]);
  const [loadingId, setLoadingId] = useState(null);

  const fetchReports = () => {
    axiosClient.get('/admin/reports')
      .then(res => {
        if (res.data.status === 200) {
          setReports(res.data.data || []);
        }
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleUpdateStatus = async (reportId, newStatus) => {
    setLoadingId(reportId);
    try {
      await axiosClient.put(`/admin/reports/${reportId}/status`, { status: newStatus });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái:', err);
      alert('Không thể cập nhật trạng thái. Vui lòng thử lại.');
    } finally {
      setLoadingId(null);
    }
  };

  const newCount = reports.filter(r => r.status === 'new' || !r.status).length;
  const processingCount = reports.filter(r => r.status === 'processing').length;
  const resolvedCount = reports.filter(r => r.status === 'resolved').length;

  return (
    <div className="animate-fade-in">
      <Header title="Xử lý lỗi khách hàng" subtitle="Tiếp nhận và xử lý báo cáo từ chatbot hỗ trợ." />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <ErrorStatCard icon={<AlertTriangle color="#4F46E5"/>} title="Mới" value={newCount} trend="Chưa tiếp nhận" trendColor="var(--danger)" />
        <ErrorStatCard icon={<HelpCircle color="#D97706"/>} title="Đang xử lý" value={processingCount} trend="Đang phản hồi" trendColor="#D97706" />
        <ErrorStatCard icon={<CheckCircle2 color="#059669"/>} title="Đã xử lý" value={resolvedCount} trend="Hoàn tất" trendColor="#059669" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
        {reports.length > 0 ? reports.map(r => {
          const status = r.status || 'new';
          let tag = 'Mới';
          let tagColor = 'var(--danger)';
          let tagBg = 'var(--danger-bg)';
          let buttonText = 'Tiếp nhận';
          let nextStatus = 'processing';
          let buttonStyle = { padding: '6px 14px', fontSize: '12px', fontWeight: '600' };

          if (status === 'processing') {
            tag = 'Đang xử lý';
            tagColor = '#D97706';
            tagBg = '#FEF3C7';
            buttonText = 'Hoàn tất';
            nextStatus = 'resolved';
            buttonStyle = { padding: '6px 14px', fontSize: '12px', fontWeight: '600', backgroundColor: '#10B981', color: 'white', border: 'none' };
          } else if (status === 'resolved') {
            tag = 'Đã xử lý';
            tagColor = '#059669';
            tagBg = '#D1FAE5';
            buttonText = 'Mở lại';
            nextStatus = 'processing';
            buttonStyle = { padding: '6px 14px', fontSize: '12px', opacity: 0.7 };
          }

          return (
            <ErrorCard 
              key={r.id}
              id={`ERR-${2400 + r.id}`} 
              tag={tag} 
              tagColor={tagColor} 
              tagBg={tagBg}
              title="Lỗi báo cáo từ ứng dụng" 
              desc={r.description} 
              user={r.full_name || r.username} 
              inv={r.invoice_id || "Hệ thống"} 
              buttonText={buttonText}
              buttonStyle={buttonStyle}
              isLoading={loadingId === r.id}
              onAction={() => handleUpdateStatus(r.id, nextStatus)}
            />
          );
        }) : <p style={{ color: 'var(--text-muted)' }}>Không có báo cáo lỗi nào.</p>}
      </div>
    </div>
  );
}

function ErrorStatCard({ icon, title, value, trend, trendColor }) {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>{icon}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>{value}</div>
      <div style={{ fontSize: '13px', color: trendColor, fontWeight: '600' }}>{trend}</div>
    </div>
  );
}

function ErrorCard({ id, tag, tagColor, tagBg, title, desc, user, inv, buttonText, buttonStyle, isLoading, onAction }) {
  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{id}</div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: tagColor, backgroundColor: tagBg, padding: '4px 10px', borderRadius: '20px' }}>{tag}</div>
        </div>
        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>{title}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>{desc}</div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>Người gửi: <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{user}</span> • Hóa đơn: <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{inv}</span></div>
        <button 
          className="btn" 
          style={buttonStyle}
          disabled={isLoading}
          onClick={onAction}
        >
          {isLoading ? 'Đang lưu...' : buttonText}
        </button>
      </div>
    </div>
  );
}
