
import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import axiosClient from '../api/axiosClient';
import { User, Lock, ReceiptText, MessageCircleQuestion } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const mockChartData = [
  { name: 'Tháng 4', users: 800 },
  { name: 'Tháng 5', users: 950 },
  { name: 'Tháng 6', users: 1100 },
  { name: 'Tháng 7', users: 1150 },
  { name: 'Tháng 8', users: 1250 },
  { name: 'Tháng 9', users: 1176 },
];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalInvoices: 0,
    totalRagQueries: 0,
    totalReports: 0
  });
  
  const [lockedCount, setLockedCount] = useState(0);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    // Fetch users for recent activity
    axiosClient.get('/admin/users')
      .then(res => {
        if(res.data.status === 200) {
          const users = res.data.data;
          setRecentUsers(users.slice(-4).reverse()); // Get 4 most recent
        }
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    // Fetch stats
    axiosClient.get('/admin/statistics')
      .then(res => {
        if(res.data.status === 200) {
          setStats({
            totalUsers: res.data.data.total_users || 0,
            totalInvoices: res.data.data.total_invoices || 0,
            totalRagQueries: res.data.data.total_chats || 0,
            totalReports: res.data.data.total_reports || 0
          });
        }
      })
      .catch(err => console.error(err));
      
    // Fetch users to count locked
    axiosClient.get('/admin/users')
      .then(res => {
        if(res.data.status === 200) {
          const users = res.data.data;
          const locked = users.filter(u => u.is_locked).length;
          setLockedCount(locked);
        }
      })
      .catch(err => console.error(err));
  }, []);

  
  // Generate mock chart data using real user total for the current month
  const dynamicChartData = [
    { name: 'Tháng 5', users: Math.floor(stats.totalUsers * 0.4) },
    { name: 'Tháng 6', users: Math.floor(stats.totalUsers * 0.6) },
    { name: 'Tháng 7', users: Math.floor(stats.totalUsers * 0.7) },
    { name: 'Tháng 8', users: Math.floor(stats.totalUsers * 0.9) },
    { name: 'Tháng 9', users: stats.totalUsers },
  ];

  return (
    <div className="animate-fade-in">
      <Header title="Tổng quan hệ thống" subtitle="Quản lý tài khoản, hóa đơn, lỗi hỗ trợ và dữ liệu." />
      
      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <StatCard 
          icon={<User color="#4F46E5" />} 
          title="Tài khoản đang hoạt động" 
          value={stats.totalUsers} 
          trend="Số liệu thực tế" 
          trendColor="var(--text-muted)" 
        />
        <StatCard 
          icon={<Lock color="#4F46E5" />} 
          title="Tài khoản đã khóa" 
          value={lockedCount} 
          trend="Số liệu thực tế" 
          trendColor="var(--text-muted)" 
        />
        <StatCard 
          icon={<ReceiptText color="#4F46E5" />} 
          title="Tổng hóa đơn" 
          value={stats.totalInvoices} 
          trend="Số liệu thực tế" 
          trendColor="var(--text-muted)" 
        />
        <StatCard 
          icon={<MessageCircleQuestion color="#4F46E5" />} 
          title="Lỗi chưa xử lý" 
          value={stats.totalReports} 
          trend="Số liệu thực tế" 
          trendColor="var(--warning)" 
        />
      </div>

      {/* Charts and Lists */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Chart */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Quản lý số lượng tài khoản</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Biến động số tài khoản theo thời gian</p>
            </div>
            <a href="/users" style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>Quản lý tài khoản →</a>
          </div>
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicChartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip />
                <Area type="monotone" dataKey="users" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Hoạt động tài khoản gần đây</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>Danh sách tài khoản mới nhất</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {recentUsers.length > 0 ? recentUsers.map(u => (
              <ActivityItem 
                key={u.id}
                color={u.is_locked ? "var(--warning)" : "var(--primary)"} 
                title={u.full_name || u.username} 
                sub={u.is_locked ? "Tài khoản bị khóa" : "Tài khoản hoạt động"} 
                time="Gần đây" 
              />
            )) : <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Chưa có hoạt động</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, trend, trendColor }) {
  
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ 
        width: '40px', height: '40px', borderRadius: '10px', 
        backgroundColor: 'var(--secondary)', display: 'flex', 
        alignItems: 'center', justifyContent: 'center', marginBottom: '16px' 
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: trendColor, fontWeight: '600' }}>{trend}</div>
    </div>
  );
}

function ActivityItem({ color, title, sub, time }) {
  
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ marginTop: '4px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{title}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{time}</div>
    </div>
  );
}
