import axios from 'axios';
export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

// The address of the Django server without /api (photos are served from here)
export const API_ORIGIN = API_URL.replace(/\/api$/, '');

// Turns "/media/avatars/1_ab.jpg" into a full address the browser can load
export function mediaUrl(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_ORIGIN}${path}`;
}

export const NETWORK_MESSAGE =
  "Can't reach the server. Make sure the backend is running on port 8000.";

const api = axios.create({ baseURL: API_URL });

// 1) Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 2) If the token has expired (401), get a new one and retry once.
async function refreshAccess() {
  const refresh = localStorage.getItem('refresh');
  if (!refresh) return false;
  try {
    // plain axios here, so this call does not trigger the interceptor again
    const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh });
    localStorage.setItem('access', data.access);
    return true;
  } catch (err) {
    return false;
  }
}

let refreshing = null;
const OPEN_URLS = ['/auth/login/', '/auth/register/', '/auth/refresh/'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isOpenUrl = OPEN_URLS.some((url) => (original?.url || '').includes(url));

    if (error.response?.status === 401 && original && !original._retry && !isOpenUrl) {
      original._retry = true;
      refreshing = refreshing || refreshAccess().finally(() => { refreshing = null; });
      if (await refreshing) return api(original);

      localStorage.clear();            // refresh failed: the session is over
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Turn any error into one friendly sentence.
export function errorMessage(error) {
  if (!error.response) return NETWORK_MESSAGE;
  const data = error.response.data;
  if (!data || typeof data !== 'object') return 'Something went wrong. Please try again.';
  if (data.detail) return data.detail;
  const key = Object.keys(data)[0];
  if (!key) return 'Something went wrong. Please try again.';
  const value = Array.isArray(data[key]) ? data[key][0] : data[key];
  return `${key}: ${value}`;
}

// Server messages per field, e.g. { username: 'A user with that username already exists.' }
export function fieldErrors(error) {
  const out = {};
  const data = error.response?.data;
  if (data && typeof data === 'object') {
    Object.entries(data).forEach(([key, value]) => {
      out[key] = Array.isArray(value) ? value[0] : String(value);
    });
  }
  return out;
}

export default api;
