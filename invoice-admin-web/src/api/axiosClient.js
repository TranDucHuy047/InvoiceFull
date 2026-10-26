import axios from 'axios';

const axiosClient = axios.create({
    baseURL: 'http://localhost:8000/api',
    headers: {
    },
});

axiosClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.error("Authentication Error: ", error.response?.data);
      localStorage.removeItem('admin_token');
      window.location.href = 'http://localhost:5173/login?logout=true';
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
