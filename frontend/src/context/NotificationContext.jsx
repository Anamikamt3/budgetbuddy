import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api.js';

const NotificationContext = createContext({ items: [], unread: 0, loaded: false, refresh: () => {} });

// Keeps the notification list in one place so the sidebar badge and the
// Notifications page always agree. It re-checks every minute.
export function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/finance/notifications/');
      setItems(data);
    } catch (err) {
      // a failed refresh is not important enough to bother the user
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  const value = useMemo(
    () => ({ items, unread: items.filter((n) => !n.is_read).length, loaded, refresh }),
    [items, loaded, refresh]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}