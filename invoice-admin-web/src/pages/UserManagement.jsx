import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import axiosClient from '../api/axiosClient';
import { 
  Search, Download, Shield, ShieldCheck, 
  Trash2, Lock, Unlock, AlertTriangle, X 
} from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, user: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const fetchUsers = () => {
    axiosClient.get('/admin/users')
      .then(res => {
        if (res.data.status === 200) {
          setUsers(res.data.data);
        }
      })
      .catch(err => {
        console.error(err);
        showToast('Lỗi khi tải danh sách tài khoản', 'error');
      });
  };

  useEffect(() => {
    fetchUsers();
    // Fetch info of currently logged in admin
    axiosClient.get('/auth/me')
      .then(res => {
        if (res.data.data) {
          setCurrentAdmin(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  const toggleLock = (user) => {
    if (currentAdmin && (user.id === currentAdmin.id || user.username === currentAdmin.username)) {
      showToast('Không thể tự khóa tài khoản Admin của chính mình.', 'error');
      return;
    }

    const nextLock = !user.is_locked;
    axiosClient.put(`/admin/users/${user.id}/toggle-lock?lock_status=${nextLock}`, { 
      lock_status: nextLock,
      is_locked: nextLock 
    })
      .then(res => {
        showToast(res.data.message || `Đã ${nextLock ? 'khóa' : 'mở khóa'} tài khoản thành công!`, 'success');
        fetchUsers();
      })
      .catch(err => {
        const detail = err.response?.data?.detail;
        showToast(typeof detail === 'string' ? detail : 'Lỗi khi thay đổi trạng thái tài khoản', 'error');
      });
  };

  const toggleRole = (user) => {
    if (currentAdmin && (user.id === currentAdmin.id || user.username === currentAdmin.username)) {
      showToast('Không thể tự đổi quyền tài khoản của chính mình.', 'error');
      return;
    }

    const newRole = user.role === 'admin' ? 'user' : 'admin';
    axiosClient.put(`/admin/users/${user.id}/role?new_role=${newRole}`)
      .then(res => {
        showToast(res.data.message || `Đã thay đổi quyền thành ${newRole}!`, 'success');
        fetchUsers();
      })
      .catch(err => {
        const detail = err.response?.data?.detail;
        showToast(typeof detail === 'string' ? detail : 'Lỗi khi thay đổi quyền người dùng', 'error');
      });
  };

  const openDeleteModal = (user) => {
    if (currentAdmin && (user.id === currentAdmin.id || user.username === currentAdmin.username)) {
      showToast('Không thể xóa tài khoản Admin của chính mình.', 'error');
      return;
    }
    setDeleteModal({ isOpen: true, user });
  };

  const confirmDelete = () => {
    if (!deleteModal.user) return;
    setIsSubmitting(true);

    axiosClient.delete(`/admin/users/${deleteModal.user.id}`)
      .then(res => {
        showToast(res.data.message || 'Đã xóa tài khoản thành công!', 'success');
        setDeleteModal({ isOpen: false, user: null });
        fetchUsers();
      })
      .catch(err => {
        const detail = err.response?.data?.detail;
        showToast(typeof detail === 'string' ? detail : 'Lỗi khi xóa tài khoản', 'error');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const exportCSV = () => {
    if (filtered.length === 0) {
      showToast('Không có dữ liệu để xuất', 'warning');
      return;
    }

    const headers = ['ID', 'Tên đăng nhập', 'Họ và tên', 'Email', 'Quyền', 'Trạng thái'];
    const rows = filtered.map(u => [
      u.id,
      `"${u.username.replace(/"/g, '""')}"`,
      `"${(u.full_name || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      u.role === 'admin' ? 'Quản trị viên' : 'Người dùng',
      u.is_locked ? 'Đã khóa' : 'Hoạt động'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `danh_sach_tai_khoan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Xuất danh sách tài khoản thành công!', 'success');
  };

  const filtered = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) || 
    (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
    (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-fade-in" style={{ position: 'relative' }}>
      <Header title="Quản lý tài khoản" subtitle="Tìm kiếm, phân quyền, khóa hoặc xóa tài khoản người dùng." />

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '32px',
          zIndex: 9999,
          padding: '14px 20px',
          borderRadius: '10px',
          color: toast.type === 'error' ? 'var(--danger)' : (toast.type === 'warning' ? '#B45309' : '#065F46'),
          backgroundColor: toast.type === 'error' ? 'var(--danger-bg)' : (toast.type === 'warning' ? 'var(--warning-bg)' : 'var(--success-bg)'),
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '600',
          fontSize: '14px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <span>{toast.type === 'error' ? '⚠️' : (toast.type === 'warning' ? '🔔' : '✅')}</span>
          <span>{toast.message}</span>
        </div>
      )}
      
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div className="input-group" style={{ minWidth: '320px', flex: 1 }}>
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Tìm theo tên đăng nhập, họ tên hoặc email..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-outline" onClick={exportCSV}>
            <Download size={18} />
            Xuất danh sách
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Email</th>
                <th>Quyền</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => {
                const isSelf = currentAdmin && (user.id === currentAdmin.id || user.username === currentAdmin.username);
                return (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '10px',
                          background: isSelf ? '#1E1B4B' : 'var(--primary)', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '13px'
                        }}>
                          {user.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{user.username}</span>
                            {isSelf && (
                              <span style={{
                                fontSize: '11px',
                                background: '#EEF2FF',
                                color: '#4F46E5',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: '700'
                              }}>
                                Bạn
                              </span>
                            )}
                          </div>
                          {user.full_name && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.full_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{user.email || '-'}</td>
                    <td>
                      {user.role === 'admin' ? 
                        <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={14}/> Admin</span> : 
                        <span className="badge" style={{ background: '#F1F5F9', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Shield size={14}/> User</span>
                      }
                    </td>
                    <td>
                      {user.is_locked ? 
                        <span className="badge badge-danger">Đã khóa</span> : 
                        <span className="badge badge-success">Hoạt động</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {/* Nút Đổi quyền */}
                        <button 
                          onClick={() => toggleRole(user)}
                          disabled={isSelf}
                          title={isSelf ? 'Không thể đổi quyền của chính mình' : 'Chuyển đổi quyền người dùng'}
                          style={{
                            padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                            border: 'none', cursor: isSelf ? 'not-allowed' : 'pointer',
                            opacity: isSelf ? 0.5 : 1,
                            background: user.role === 'admin' ? '#F1F5F9' : 'var(--secondary)',
                            color: user.role === 'admin' ? 'var(--text-muted)' : 'var(--primary)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {user.role === 'admin' ? 'Hạ quyền' : 'Lên Admin'}
                        </button>

                        {/* Nút Khóa / Mở khóa */}
                        <button 
                          onClick={() => toggleLock(user)}
                          disabled={isSelf}
                          title={isSelf ? 'Không thể tự khóa tài khoản của chính mình' : (user.is_locked ? 'Mở khóa tài khoản' : 'Khóa tài khoản')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                            border: 'none', cursor: isSelf ? 'not-allowed' : 'pointer',
                            opacity: isSelf ? 0.5 : 1,
                            background: user.is_locked ? '#FEF3C7' : '#F1F5F9',
                            color: user.is_locked ? '#D97706' : 'var(--text-main)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {user.is_locked ? <Unlock size={14} /> : <Lock size={14} />}
                          {user.is_locked ? 'Mở khóa' : 'Khóa'}
                        </button>

                        {/* Nút Xóa tài khoản */}
                        <button 
                          onClick={() => openDeleteModal(user)}
                          disabled={isSelf}
                          title={isSelf ? 'Không thể xóa tài khoản của chính mình' : 'Xóa vĩnh viễn tài khoản'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                            border: 'none', cursor: isSelf ? 'not-allowed' : 'pointer',
                            opacity: isSelf ? 0.5 : 1,
                            background: 'var(--danger-bg)',
                            color: 'var(--danger)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Trash2 size={14} />
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Không tìm thấy tài khoản phù hợp với từ khóa "{search}".
            </div>
          )}
        </div>
      </div>

      {/* Modal xác nhận xóa */}
      {deleteModal.isOpen && deleteModal.user && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            position: 'relative',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)'
          }}>
            <button 
              onClick={() => setDeleteModal({ isOpen: false, user: null })}
              style={{
                position: 'absolute', top: '20px', right: '20px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                backgroundColor: 'var(--danger-bg)', color: 'var(--danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>Xóa tài khoản vĩnh viễn</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Hành động này không thể khôi phục</p>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.6', marginBottom: '24px' }}>
              Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản <strong>{deleteModal.user.username}</strong> ({deleteModal.user.email || 'Không có email'})? Toàn bộ dữ liệu liên quan sẽ bị xóa khỏi hệ thống.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setDeleteModal({ isOpen: false, user: null })}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button 
                className="btn" 
                onClick={confirmDelete}
                disabled={isSubmitting}
                style={{
                  backgroundColor: 'var(--danger)',
                  color: 'white'
                }}
              >
                <Trash2 size={16} />
                {isSubmitting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
