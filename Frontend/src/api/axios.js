import axios from 'axios';

// Use relative paths during development (proxied by setupProxy)
// In production, adjust the baseURL as needed
const API_URL = process.env.REACT_APP_API_URL || '/api';
// const API_URL = 'http://localhost:9410/api';



// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    // If request data is FormData, remove manual Content-Type so browser sets correct boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    // Don't add token to login endpoint
    if (config.url && config.url.includes('/auth/login')) {
      return config;
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Emit a global event and let the AuthContext handle logout.
      // This avoids a race where an interceptor redirects to /login
      // before AuthContext finishes restoring the session on refresh.
      try {
        window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { error } }));
      } catch (e) {
        // Fallback: clear storage and redirect if event dispatch fails
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
