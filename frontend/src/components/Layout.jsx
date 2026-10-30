import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { initialsFor } from '../format.js';
import Icon, { BrandMark } from './Icon.jsx';

const NAV = [
  { to: '/', label: 'Overview', icon: 'overview', end: true },
  { to: '/transactions', label: 'Transactions', icon: 'history' },
  { to: '/expenses', label: 'Expenses', icon: 'expenses' },
  { to: '/income', label: 'Income', icon: 'income' },
  { to: '/budgets', label: 'Budgets', icon: 'budgets' },
];

const ROLE_NAMES = { student: 'Student', premium: 'Premium user', admin: 'Admin' };

// The sidebar is written once here and wraps every logged-in page.
export default function Layout() {
  const { user, displayName, logout } = useAuth();
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
            </NavLink>
          ))}
        </nav>

        <div className="side-user">
          <div className="avatar" aria-hidden="true">
            {initialsFor(profile.full_name, user.username)}
          </div>
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
