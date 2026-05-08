import axios from 'axios';

const api = axios.create({
  baseURL: `http://${window.location.hostname}:3002/api`,
});

// Interceptor to add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('armazem_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
