import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && token !== 'undefined') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (username, password) =>
  api.post('/api/auth/login', new URLSearchParams({ username, password }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

export const sendOtp = (contact, username) =>
  api.post('/api/auth/send-otp', { contact, username });

export const register = (username, email, password, full_name, otp_code) =>
  api.post('/api/auth/register', { username, email, password, full_name, otp_code });

export const getProfile = () => api.get('/api/auth/me');

export const updateProfile = (data) => api.put('/api/auth/profile', data);

export const changePassword = (old_password, new_password) =>
  api.post('/api/auth/change-password', { old_password, new_password });

export const logout = () => api.post('/api/auth/logout');

// Invoices
export const getInvoices = (params) => api.get('/api/invoices', { params });

export const getInvoiceDetail = (invoiceId) => api.get(`/api/invoices/${invoiceId}`);

export const deleteInvoice = (invoiceId) =>
  api.delete(`/api/invoices/${invoiceId}`);

export const permanentDeleteInvoice = (invoiceId) =>
  api.delete(`/api/invoices/${invoiceId}/permanent`);

export const restoreInvoice = (invoiceId) =>
  api.post(`/api/invoices/${invoiceId}/restore`);

export const updateInvoice = (invoiceId, data) =>
  api.put(`/api/invoices/${invoiceId}`, data);

export const getTrash = () => api.get('/api/invoices/trash');

export const emptyTrash = () =>
  api.delete('/api/invoices/trash/empty');

export const batchDeleteTrash = (invoiceIds) =>
  api.post('/api/invoices/trash/batch-delete', { invoice_ids: invoiceIds });

export const batchRestoreTrash = (invoiceIds) =>
  api.post('/api/invoices/trash/batch-restore', { invoice_ids: invoiceIds });

export const exportCSV = (params) =>
  api.get('/api/invoices/export', { params, responseType: 'blob' });

// Upload/Analyze
export const analyzeInvoice = (formData) =>
  api.post('/api/analyze-invoice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });

// QA/Chat
export const askQuestion = (invoice_id, question) => {
  if (!invoice_id || invoice_id === 'all' || invoice_id === 'GLOBAL') {
    return api.post('/api/qa/global', { question });
  }
  return api.post('/api/qa', { invoice_id, question });
};

export const askGlobalQuestion = (question) =>
  api.post('/api/qa/global', { question });

export const getChatHistory = (invoiceId) => {
  const target = (!invoiceId || invoiceId === 'all') ? 'GLOBAL' : invoiceId;
  return api.get(`/api/history/${target}`);
};

export const getChatSessions = () => api.get('/api/history/sessions');

export const deleteChatSession = (invoiceId) => {
  const target = (!invoiceId || invoiceId === 'all') ? 'GLOBAL' : invoiceId;
  return api.delete(`/api/history/${target}`);
};

export const deleteAllChatHistory = () => api.delete('/api/history');

// Reports
export const submitReport = (data) => api.post('/api/reports', data);

export const getReports = () => api.get('/api/reports');

export { API_BASE };
export default api;
