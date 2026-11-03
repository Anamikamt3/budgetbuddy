import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../api.js';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { currentMonth, formatLongDate, formatMoney, initialsFor } from '../format.js';
import useMoney from '../hooks/useMoney.js';
import usePageTitle from '../hooks/usePageTitle.js';

const CURRENCIES = [
  ['INR', 'Indian rupee'], ['USD', 'US dollar'], ['EUR', 'Euro'], ['GBP', 'British pound'],
  ['JPY', 'Japanese yen'], ['AUD', 'Australian dollar'], ['CAD', 'Canadian dollar'],
  ['SGD', 'Singapore dollar'], ['AED', 'UAE dirham'],
];
const ROLE_NAMES = { student: 'Student', premium: 'Premium user', admin: 'Admin' };

/* ---------- Personal details and financial preferences ---------- */
function DetailsForm({ user, setUser, toast }) {
  const profile = user.profile || {};
  const start = {
    full_name: profile.full_name || '',
    email: user.email || '',
    monthly_income: profile.monthly_income != null ? String(profile.monthly_income) : '0',
    currency: profile.currency || 'INR',
  };

  const [values, setValues] = useState(start);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));
  const invalid = (name) => (errors[name] ? 'true' : undefined);
  const changed = Object.keys(start).some((key) => String(values[key]) !== String(start[key]));

  // Make sure the saved currency is in the list even if it is unusual
  const currencies = CURRENCIES.some(([code]) => code === values.currency)
    ? CURRENCIES
    : [...CURRENCIES, [values.currency, values.currency]];

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert('');

    const found = {};
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) found.email = 'Enter a valid email address.';
    if (values.monthly_income !== '' && Number(values.monthly_income) < 0) {
      found.monthly_income = 'Income cannot be negative.';
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const { data } = await api.patch('/auth/profile/', {
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        monthly_income: values.monthly_income === '' ? '0' : values.monthly_income,
        currency: values.currency,
      });
      setUser(data);                      // every page now shows the new details
      toast('Profile updated');
      setErrors({});
    } catch (err) {
      const server = fieldErrors(err);
      const mapped = {};
      ['full_name', 'email', 'monthly_income', 'currency'].forEach((key) => {
        if (server[key]) mapped[key] = server[key];
      });
      setErrors(mapped);
      if (Object.keys(mapped).length === 0) setAlert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {alert && <div className="alert" role="alert">{alert}</div>}

      <Field id="fullName" label="Full name" error={errors.full_name}>
        <input id="fullName" type="text" maxLength={100} placeholder="Your name" autoComplete="name"
          value={values.full_name} onChange={set('full_name')} aria-invalid={invalid('full_name')} />
      </Field>

      <Field id="profileEmail" label="Email" error={errors.email}>
        <input id="profileEmail" type="email" autoComplete="email"
          value={values.email} onChange={set('email')} aria-invalid={invalid('email')} />
      </Field>

      <h3 className="form-section">Financial preferences</h3>

      <div className="field-row">
        <Field id="monthlyIncome" label="Monthly income" error={errors.monthly_income}
          hint="Used to compare your plan with what you really receive.">
          <input id="monthlyIncome" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
            value={values.monthly_income} onChange={set('monthly_income')} aria-invalid={invalid('monthly_income')} />
        </Field>
        <Field id="currency" label="Currency" error={errors.currency}
          hint={`Example: ${formatMoney(1234.5, values.currency)}`}>
          <select id="currency" value={values.currency} onChange={set('currency')} aria-invalid={invalid('currency')}>
            {currencies.map(([code, name]) => (
              <option key={code} value={code}>{code} - {name}</option>
            ))}
          </select>
        </Field>
      </div>

      <button type="submit" className={`btn${saving ? ' is-loading' : ''}`} disabled={saving || !changed}>
        <span className="btn-label">{saving ? 'Saving' : 'Save changes'}</span>
      </button>
    </form>
  );
}

/* ---------- Change password ---------- */
function PasswordForm({ toast }) {
  const empty = { current_password: '', new_password: '', confirm: '' };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert('');

    const found = {};
    if (!values.current_password) found.current_password = 'Enter your current password.';
    if (values.new_password.length < 8) found.new_password = 'The new password needs at least 8 characters.';
    if (values.confirm !== values.new_password) found.confirm = 'The two passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      await api.post('/auth/change-password/', {
        current_password: values.current_password,
        new_password: values.new_password,
      });
      setValues(empty);
      setErrors({});
      toast('Password updated');
    } catch (err) {
      const server = fieldErrors(err);
      const mapped = {};
      ['current_password', 'new_password'].forEach((key) => {
        if (server[key]) mapped[key] = server[key];
      });
      setErrors(mapped);
      if (Object.keys(mapped).length === 0) setAlert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {alert && <div className="alert" role="alert">{alert}</div>}

      <PasswordField id="currentPassword" label="Current password" autoComplete="current-password"
        value={values.current_password} onChange={set('current_password')} error={errors.current_password} />
      <PasswordField id="newPassword" label="New password" autoComplete="new-password" hint="Use at least 8 characters."
        value={values.new_password} onChange={set('new_password')} error={errors.new_password} />
      <PasswordField id="confirmPassword" label="Confirm new password" autoComplete="new-password"
        value={values.confirm} onChange={set('confirm')} error={errors.confirm} />

      <button type="submit" className={`btn${saving ? ' is-loading' : ''}`} disabled={saving}>
        <span className="btn-label">{saving ? 'Updating' : 'Update password'}</span>
      </button>
    </form>
  );
}

/* ---------- The page ---------- */
export default function Profile() {
  usePageTitle('Profile');
  const { user, setUser, displayName } = useAuth();
  const money = useMoney();
  const toast = useToast();
  const [summary, setSummary] = useState(null);

  // This month's real income, to compare with the planned monthly income
  useEffect(() => {
    api.get('/finance/summary/', { params: { month: currentMonth() } })
      .then((res) => setSummary(res.data))
      .catch(() => {});
  }, []);

  const profile = user.profile || {};
  const planned = Number(profile.monthly_income) || 0;
  const received = summary ? summary.income_total : 0;
  const percent = planned ? (received / planned) * 100 : 0;

  return (
    <>
      <header className="page-head">
        <h1>Profile</h1>
        <p>Manage your details, preferences and security.</p>
      </header>

      <section className="profile-hero" aria-label="Your account">
        <div className="profile-avatar" aria-hidden="true">{initialsFor(profile.full_name, user.username)}</div>
        <div className="profile-who">
          <h2>{displayName}</h2>
          <p>@{user.username} · {user.email || 'no email yet'}</p>
          <div className="profile-tags">
            <span className="tag-light">{ROLE_NAMES[user.role] || user.role}</span>
            {user.date_joined && <span className="tag-light">Member since {formatLongDate(user.date_joined)}</span>}
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Personal details</h2></div>
          <p className="panel-note" style={{ marginBottom: 16 }}>Your name, email and money preferences.</p>
          {/* key makes the form start again with the new values after a save */}
          <DetailsForm key={`${user.email}-${profile.full_name}-${profile.monthly_income}-${profile.currency}`}
            user={user} setUser={setUser} toast={toast} />
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Security</h2></div>
          <p className="panel-note" style={{ marginBottom: 16 }}>Change your password regularly to keep your account safe.</p>
          <PasswordForm toast={toast} />
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Income plan</h2></div>
          {planned > 0 ? (
            <>
              <p className="panel-note">This month you have received</p>
              <div className="plan-figure">{money(received)}</div>
              <div className="bar" style={{ '--c': percent >= 100 ? '#16866a' : '#2d5bff' }}>
                <i style={{ width: `${Math.min(percent, 100)}%` }} />
              </div>
              <p className="goal-hint">{Math.round(percent)}% of your planned {money(planned)} a month.</p>
            </>
          ) : (
            <div className="empty">
              <strong>No monthly income set</strong>
              Enter your monthly income in the form to compare it with what you receive.
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Account</h2></div>
          <dl className="info-list">
            <div><dt>Username</dt><dd>{user.username}</dd></div>
            <div><dt>Role</dt><dd>{ROLE_NAMES[user.role] || user.role}</dd></div>
            <div><dt>Currency</dt><dd>{profile.currency || 'INR'}</dd></div>
            <div><dt>Member since</dt><dd>{user.date_joined ? formatLongDate(user.date_joined) : '-'}</dd></div>
          </dl>
          <p className="panel-note">Your username and role can only be changed by an administrator.</p>
        </div>
      </section>
    </>
  );
}