import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../api.js';
import usePageTitle from '../hooks/usePageTitle.js';

export default function Login() {
  usePageTitle('Log in');
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in? Go straight to the dashboard.
  if (user) return <Navigate to="/" replace />;

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert('');

    const found = {};
    if (!values.username.trim()) found.username = 'Enter your username.';
    if (!values.password) found.password = 'Enter your password.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    try {
      await login(values.username.trim(), values.password);
      navigate('/', { replace: true });
    } catch (err) {
      setAlert(
        err.response?.status === 401
          ? 'Username or password is incorrect. Check both and try again.'
          : errorMessage(err)
      );
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see where your pocket money went."
      footer={<>New to BudgetBuddy? <Link to="/register">Create an account</Link></>}
    >
      <form onSubmit={handleSubmit} noValidate>
        {location.state?.registered && (
          <div className="notice" role="status">Account created. Log in to continue.</div>
        )}
        {alert && <div className="alert" role="alert">{alert}</div>}

        <Field id="username" label="Username" error={errors.username}>
          <input
            id="username"
            type="text"
            autoComplete="username"
            autoFocus
            value={values.username}
            onChange={set('username')}
            aria-invalid={errors.username ? 'true' : undefined}
          />
        </Field>

        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
        />

        <button type="submit" className={`btn${loading ? ' is-loading' : ''}`} disabled={loading}>
          <span className="btn-label">{loading ? 'Logging in' : 'Log in'}</span>
        </button>
      </form>
    </AuthLayout>
  );
}
