// Already logged in? Go straight to the dashboard.
if (getAccessToken()) {
  window.location.replace('dashboard.html');
}

initPasswordToggles();

const form = document.getElementById('loginForm');

// Show a friendly message after registering.
if (new URLSearchParams(window.location.search).get('registered') === '1') {
  const notice = document.getElementById('notice');
  notice.textContent = 'Account created. Log in to continue.';
  notice.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(form);

  const username = form.elements.username.value.trim();
  const password = form.elements.password.value;

  if (!username) {
    showFieldError(form, 'username', 'Enter your username.');
    form.elements.username.focus();
    return;
  }
  if (!password) {
    showFieldError(form, 'password', 'Enter your password.');
    form.elements.password.focus();
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  setLoading(button, true, 'Logging in');

  try {
    const response = await fetch(`${API_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      saveTokens(data.access, data.refresh);
      window.location.href = 'dashboard.html';
      return;
    }

    showFormAlert(
      form,
      response.status === 401
        ? 'Username or password is incorrect. Check both and try again.'
        : 'Could not log you in. Please try again.'
    );
  } catch (err) {
    showFormAlert(form, NETWORK_MESSAGE);
  }

  setLoading(button, false);
});