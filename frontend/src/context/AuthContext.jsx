import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { errorMessage } from '../api.js';
import { useToast } from '../components/Toast.jsx';

const AuthContext = createContext(null);

const PLAN_NAMES = { student: 'Free (Student)', premium: 'Premium', admin: 'Administrator' };

export function AuthProvider({ children }) {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('access')));
  const [error, setError] = useState('');

  // Always holds the latest user, so timers can compare old and new without re-creating
  const userRef = useRef(null);
  userRef.current = user;

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

  // Quietly re-read the user (no loading screen). When an administrator changes
  // someone's role, this makes the new plan appear without logging out.
  const refreshUser = useCallback(async () => {
    const before = userRef.current;
    if (!before || !localStorage.getItem('access')) return;
    try {
      const { data } = await api.get('/auth/me/');
      if (JSON.stringify(before) === JSON.stringify(data)) return;      // nothing changed
      if (before.role !== data.role) {
        toast(`Your account type changed to ${PLAN_NAMES[data.role] || data.role}.`);
      }
      setUser(data);
    } catch (err) {
      // ignore: expired sessions are handled by the normal request code
    }
  }, [toast]);

  // Check again when you come back to this browser tab, and once a minute
  const userId = user ? user.id : null;
  useEffect(() => {
    if (!userId) return undefined;
    window.addEventListener('focus', refreshUser);
    const timer = setInterval(refreshUser, 60000);
    return () => {
      window.removeEventListener('focus', refreshUser);
      clearInterval(timer);
    };
  }, [userId, refreshUser]);

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
      refreshUser,
      setUser,
      isPremium: user ? ['premium', 'admin'].includes(user.role) : false,
      currency: profile.currency || 'INR',
      displayName: (profile.full_name || '').trim() || user?.username || '',
    };
  }, [user, loading, error, login, logout, loadUser, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}