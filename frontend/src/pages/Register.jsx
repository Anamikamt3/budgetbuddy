import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import api, { errorMessage, fieldErrors } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

// 0 = empty, 1 = weak, 2 = okay, 3 = strong (advice only; the server needs 8+ characters)
function strengthLevel(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  if (value.length < 8) score = Math.min(score, 1);
  return Math.max(score, 1);
}

export default function Register() {
  usePageTitle('Create account');
  const { user } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));
  const level = strengthLevel(values.password);

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert('');

    const found = {};
    if (!values.username.trim()) found.username = 'Choose a username.';
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) found.email = 'Enter a valid email address.';
    if (values.password.length < 8) found.password = 'Password must have at least 8 characters.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    try {
      await api.post('/auth/register/', {
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      // The API answers like { username: ['...'], email: ['...'] }
      const server = fieldErrors(err);
      const mapped = {};
      ['username', 'email', 'password'].forEach((name) => {
        if (server[name]) mapped[name] = server[name];
      });
      setErrors(mapped);
      if (Object.keys(mapped).length === 0) setAlert(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up takes under a minute."
      footer={<>Already have an account? <Link to="/login">Log in</Link></>}
    >
      <form onSubmit={handleSubmit} noValidate>
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

        <Field id="email" label="Email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={set('email')}
            aria-invalid={errors.email ? 'true' : undefined}
          />
        </Field>

        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          hint="Use at least 8 characters."
        >
          <div className="strength" data-level={level} aria-hidden="true">
            <div className="strength-bars"><i /><i /><i /></div>
            <span className="strength-text">{['', 'Weak', 'Okay', 'Strong'][level]}</span>
          </div>
        </PasswordField>

        <button type="submit" className={`btn${loading ? ' is-loading' : ''}`} disabled={loading}>
          <span className="btn-label">{loading ? 'Creating account' : 'Create account'}</span>
        </button>
      </form>
    </AuthLayout>
  );
}
