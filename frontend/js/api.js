// Shared helpers used by every page.
const API_URL = 'http://127.0.0.1:8000/api';
const NETWORK_MESSAGE =
  "Can't reach the server. Make sure the backend is running on port 8000.";

// Settings shared across pages (the currency is filled in after login).
const BB = { currency: 'INR' };

/* ---------- Tokens ---------- */
function saveTokens(access, refresh) {
  localStorage.setItem('access', access);
  localStorage.setItem('refresh', refresh);
}

function getAccessToken() {
  return localStorage.getItem('access');
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

/* ---------- Talking to the API ---------- */
// Ask the server for a new access token using the refresh token.
async function refreshAccessToken() {
  const refresh = localStorage.getItem('refresh');
  if (!refresh) return false;
  try {
    const response = await fetch(`${API_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    localStorage.setItem('access', data.access);
    return true;
  } catch (err) {
    return false;
  }
}

function extractError(data) {
  if (typeof data === 'string') return data;
  if (data && data.detail) return data.detail;
  const key = Object.keys(data || {})[0];
  if (!key) return 'Something went wrong. Please try again.';
  const value = Array.isArray(data[key]) ? data[key][0] : data[key];
  return `${key}: ${value}`;
}

// One function for every request: adds the token, refreshes it if it expired,
// and turns server errors into normal JavaScript errors.
async function apiFetch(path, options = {}) {
  if (!getAccessToken()) {
    window.location.replace('index.html');
    throw new Error('Not logged in');
  }

  const send = () =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
        ...(options.headers || {}),
      },
    });

  let response;
  try {
    response = await send();
    if (response.status === 401 && (await refreshAccessToken())) {
      response = await send();          // try once more with the new token
    }
  } catch (err) {
    throw new Error(NETWORK_MESSAGE);
  }

  if (response.status === 401) {
    logout();
    throw new Error('Your session has ended. Please log in again.');
  }
  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(extractError(data));
    error.data = data;
    throw error;
  }
  return data;
}

/* ---------- Formatting ---------- */
function formatMoney(amount) {
  const number = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: BB.currency }).format(number);
  } catch (err) {
    return `${BB.currency} ${number.toFixed(2)}`;
  }
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currentMonth() {
  return todayISO().slice(0, 7);          // "2026-10"
}

// Always escape text typed by users before putting it into innerHTML.
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

/* ---------- Small pop-up message ---------- */
function toast(message, type) {
  let box = document.getElementById('toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    box.setAttribute('role', 'status');
    document.body.appendChild(box);
  }
  box.className = 'toast show' + (type === 'error' ? ' error' : '');
  box.textContent = message;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove('show'), 3200);
}

/* ---------- Form helpers ---------- */
function setLoading(button, isLoading, loadingText) {
  const label = button.querySelector('.btn-label');
  if (isLoading) {
    button.dataset.label = label.textContent;
    label.textContent = loadingText;
  } else if (button.dataset.label) {
    label.textContent = button.dataset.label;
  }
  button.disabled = isLoading;
  button.classList.toggle('is-loading', isLoading);
}

function showFormAlert(form, message) {
  const box = form.querySelector('#formAlert');
  box.textContent = message;
  box.hidden = false;
}

function showFieldError(form, name, message) {
  const input = form.elements[name];
  const error = form.querySelector('#' + name + '-error');
  if (!input || !error) {
    showFormAlert(form, message);
    return;
  }
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', error.id);
  error.textContent = message;
}

function clearErrors(form) {
  const box = form.querySelector('#formAlert');
  if (box) {
    box.hidden = true;
    box.textContent = '';
  }
  form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((el) => {
    el.removeAttribute('aria-invalid');
  });
}

function initPasswordToggles() {
  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    const input = document.getElementById(btn.getAttribute('aria-controls'));
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', String(show));
    });
  });
}