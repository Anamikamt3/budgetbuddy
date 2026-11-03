import { Link, NavLink, Outlet } from 'react-router-dom';
import { NotificationProvider, useNotifications } from '../context/NotificationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { initialsFor } from '../format.js';
import Icon, { BrandMark } from './Icon.jsx';

const NAV = [
  { to: '/', label: 'Overview', icon: 'overview', end: true },
  { to: '/analytics', label: 'Analytics', icon: 'analytics' },
  { to: '/transactions', label: 'Transactions', icon: 'history' },
  { to: '/expenses', label: 'Expenses', icon: 'expenses' },
  { to: '/income', label: 'Income', icon: 'income' },
  { to: '/budgets', label: 'Budgets', icon: 'budgets' },
  { to: '/goals', label: 'Goals', icon: 'goals' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
  { to: '/notifications', label: 'Notifications', icon: 'bell', badge: true },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

const ROLE_NAMES = { student: 'Student', premium: 'Premium user', admin: 'Admin' };

function Shell() {
  const { user, displayName, logout } = useAuth();
  const { unread } = useNotifications();
  const profile = user.profile || {};

  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="BudgetBuddy overview">
          <BrandMark />
          BudgetBuddy
        </Link>

        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <Icon name={item.icon} />
              {item.label}
              {item.badge && unread > 0 && (
                <span className="nav-badge" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="side-user">
          <Link to="/profile" className="avatar" aria-label="Your profile" title="Your profile">
            {initialsFor(profile.full_name, user.username)}
          </Link>
          <div className="who">
            <div className="name">{displayName}</div>
            <div className="role">{ROLE_NAMES[user.role] || user.role}</div>
          </div>
          <button type="button" className="logout" onClick={logout}>Log out</button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

// The sidebar is written once here and wraps every logged-in page.
export default function Layout() {
  return (
    <NotificationProvider>
      <Shell />
    </NotificationProvider>
  );
}