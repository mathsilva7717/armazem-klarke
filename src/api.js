import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Interceptor to add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('armazem_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle expired tokens (401 response)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('armazem_auth');
      localStorage.removeItem('armazem_token');
      localStorage.removeItem('armazem_user');
      window.location.href = '/login?inactive=true';
    }
    return Promise.reject(error);
  }
);

export default api;
