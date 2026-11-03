import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api.js';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { timeAgo } from '../format.js';
import usePageTitle from '../hooks/usePageTitle.js';

// Icon, colour and the page each type of message belongs to
const KINDS = {
  budget_alert: { icon: 'alert', tone: 'warn', to: '/budgets', action: 'View budgets' },
  savings_reminder: { icon: 'clock', tone: 'info', to: '/goals', action: 'View goals' },
  goal_milestone: { icon: 'star', tone: 'ok', to: '/goals', action: 'View goals' },
  monthly_report: { icon: 'reports', tone: 'violet', to: '/reports', action: 'Open reports' },
};

export default function Notifications() {
  usePageTitle('Notifications');
  const toast = useToast();
  const { items, unread, loaded, refresh } = useNotifications();
  const [filter, setFilter] = useState('all');         // all | unread

  const shown = filter === 'unread' ? items.filter((n) => !n.is_read) : items;

  async function run(request, successMessage) {
    try {
      await request();
      if (successMessage) toast(successMessage);
      await refresh();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  const markRead = (n) => run(() => api.post(`/finance/notifications/${n.id}/read/`));
  const markAllRead = () => run(() => api.post('/finance/notifications/read-all/'), 'All caught up');
  const remove = (n) => run(() => api.delete(`/finance/notifications/${n.id}/`), 'Notification removed');

  return (
    <>
      <header className="page-head with-actions">
        <div>
          <h1>Notifications</h1>
          <p>Budget alerts, savings reminders and goal milestones.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="button secondary" onClick={markAllRead} disabled={unread === 0}>
            Mark all as read
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="field">
          <label id="showLabel">Show</label>
          <div className="segmented" role="group" aria-labelledby="showLabel">
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
            <button type="button" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>
              Unread{unread > 0 ? ` (${unread})` : ''}
            </button>
          </div>
        </div>
      </div>

      <section className="panel wide">
        {loaded && shown.length === 0 && (
          <div className="empty">
            <strong>{filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}</strong>
            Alerts appear here when a budget is almost used up, a goal is close, or a report is ready.
          </div>
        )}

        {shown.map((n) => {
          const kind = KINDS[n.type] || KINDS.budget_alert;
          return (
            <div className={`notif${n.is_read ? '' : ' unread'}`} key={n.id}>
              <div className={`notif-icon ${kind.tone}`}><Icon name={kind.icon} /></div>
              <div className="notif-main">
                <div className="notif-message">{n.message}</div>
                <div className="notif-meta">
                  <span>{n.type_label}</span>
                  <span>{timeAgo(n.created_at)}</span>
                  <Link to={kind.to}>{kind.action}</Link>
                </div>
              </div>
              <div className="notif-actions">
                {!n.is_read && (
                  <button type="button" className="icon-btn" title="Mark as read" aria-label="Mark as read"
                    onClick={() => markRead(n)}>
                    <Icon name="check" />
                  </button>
                )}
                <button type="button" className="icon-btn" title="Remove" aria-label="Remove notification"
                  onClick={() => remove(n)}>
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}