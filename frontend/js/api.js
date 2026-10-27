// Shared helpers used by every page.
const API_URL = 'http://127.0.0.1:8000/api';
const NETWORK_MESSAGE =
  "Can't reach the server. Make sure the backend is running on port 8000.";

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
  form.querySelectorAll('input[aria-invalid]').forEach((el) => {
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