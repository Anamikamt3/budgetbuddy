import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api.js';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { downloadFile } from '../download.js';
import { barClass } from '../format.js';
import usePageTitle from '../hooks/usePageTitle.js';

// What each plan includes: true = included, false = not included, text = a limit
const ROWS = [
  ['Active savings goals', '3 goals', 'Unlimited'],
  ['Custom categories', '5 categories', 'Unlimited'],
  ['Analytics trend', 'Last 3 months', 'Up to 12 months'],
  ['Budgets, alerts and notifications', true, true],
  ['PDF monthly reports', true, true],
  ['Excel monthly reports', false, true],
  ['Export all transactions (CSV)', false, true],
];

function Cell({ value }) {
  if (value === true) return <span className="yes"><Icon name="check" /></span>;
  if (value === false) return <span className="no">Not included</span>;
  return <span>{value}</span>;
}

export default function Premium() {
  usePageTitle('Premium');
  const { user, setUser, isPremium } = useAuth();
  const toast = useToast();

  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const isAdmin = user.role === 'admin';

  const loadPlan = useCallback(async () => {
    try {
      const { data } = await api.get('/finance/plan/');
      setPlan(data);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }, [toast]);

  useEffect(() => { loadPlan(); }, [loadPlan, user.role]);

  async function changePlan(action) {
    setBusy(action);
    try {
      const { data } = await api.post(`/auth/${action}/`);
      setUser(data);                        // the whole app now sees the new plan
      toast(action === 'upgrade' ? 'Welcome to Premium!' : 'You are back on the Free plan');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy('');
    }
  }

  async function exportCsv() {
    setBusy('csv');
    try {
      await downloadFile('/finance/export/transactions/', {}, 'BudgetBuddy_Transactions.csv');
      toast('Transactions exported');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy('');
    }
  }

  const usageRows = plan ? [
    { label: 'Active savings goals', used: plan.usage.goals, limit: plan.limits.goals },
    { label: 'Custom categories', used: plan.usage.custom_categories, limit: plan.limits.custom_categories },
  ] : [];

  return (
    <>
      <header className="page-head">
        <h1>Premium</h1>
        <p>Compare plans and see what your account includes.</p>
      </header>

      <section className="plan-hero" aria-label="Your plan">
        <div>
          <span className="plan-badge"><Icon name="star" />{isPremium ? 'Premium' : 'Free plan'}</span>
          <h2>{isAdmin ? 'Administrator' : isPremium ? 'You have Premium' : 'You are on the Free plan'}</h2>
          <p>
            {isPremium
              ? 'Unlimited goals and categories, Excel reports, CSV exports and longer analytics.'
              : 'Upgrade for unlimited savings goals and categories, Excel reports, CSV exports and a longer analytics trend.'}
          </p>
        </div>

        <div className="plan-actions">
          {!isPremium && plan && plan.demo_upgrade && (
            <button type="button" className="button" onClick={() => changePlan('upgrade')} disabled={busy !== ''}>
              {busy === 'upgrade' ? 'Upgrading...' : 'Upgrade to Premium'}
            </button>
          )}
          {!isPremium && plan && !plan.demo_upgrade && (
            <p>Ask an administrator to upgrade your account.</p>
          )}
          {isPremium && !isAdmin && plan && plan.demo_upgrade && (
            <button type="button" className="button secondary" onClick={() => changePlan('downgrade')} disabled={busy !== ''}>
              {busy === 'downgrade' ? 'Switching...' : 'Switch back to Free (demo)'}
            </button>
          )}
        </div>
      </section>

      {plan && plan.demo_upgrade && (
        <p className="panel-note" style={{ marginTop: 10 }}>
          Upgrading here is a demo. In a real product a payment provider confirms the upgrade.
        </p>
      )}

      <section className="table-wrap" aria-label="Plan comparison">
        <table className="compare">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Free</th>
              <th className="premium-col">Premium</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([name, free, premium]) => (
              <tr key={name}>
                <td>{name}</td>
                <td><Cell value={free} /></td>
                <td className="premium-col"><Cell value={premium} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Your usage</h2></div>
          {usageRows.map((row) => (
            <div className="cat-row" key={row.label}>
              <div className="top">
                <span>{row.label}</span>
                <span>{row.limit == null ? `${row.used} used · Unlimited` : `${row.used} of ${row.limit}`}</span>
              </div>
              {row.limit != null && (
                <div className={`bar ${barClass((row.used / row.limit) * 100)}`}>
                  <i style={{ width: `${Math.min((row.used / row.limit) * 100, 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="panel report-card">
          <div className="report-icon"><Icon name="download" /></div>
          <h2>Export all transactions</h2>
          <p className="panel-note">
            Download every income and expense you have recorded as a spreadsheet-ready CSV file.
          </p>
          {isPremium ? (
            <button type="button" className="button" onClick={exportCsv} disabled={busy !== ''}>
              <Icon name="download" />{busy === 'csv' ? 'Preparing...' : 'Download CSV'}
            </button>
          ) : (
            <span className="premium-pill"><Icon name="lock" /> Premium feature</span>
          )}
        </div>
      </section>
    </>
  );
}