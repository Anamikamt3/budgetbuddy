import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { errorMessage } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('access')));
  const [error, setError] = useState('');

  // Ask the server who is logged in (uses the saved token)
  const loadUser = useCallback(async () => {
    if (!localStorage.getItem('access')) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/auth/me/');
      setUser(data);
      setError('');
    } catch (err) {
      setUser(null);
      if (err.response && err.response.status === 401) {
        localStorage.clear();          // token no longer valid
        setError('');
      } else {
        setError(errorMessage(err));   // for example: server is not running
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login/', { username, password });
    localStorage.setItem('access', data.access);
    localStorage.setItem('refresh', data.refresh);
    const me = await api.get('/auth/me/');
    setUser(me.data);
  }, []);

  const logout = useCallback(() => {
    localStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => {
    const profile = user?.profile || {};
    return {
      user,
      loading,
      error,
      login,
      logout,
      reload: loadUser,
      setUser,
      currency: profile.currency || 'INR',
      displayName: (profile.full_name || '').trim() || user?.username || '',
    };
  }, [user, loading, error, login, logout, loadUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
