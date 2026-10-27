if (getAccessToken()) {
  window.location.replace('dashboard.html');
}

initPasswordToggles();

const form = document.getElementById('registerForm');
const strength = document.getElementById('strength');
const strengthText = document.getElementById('strengthText');

// Simple advisory strength meter (the server only requires 8+ characters).
form.elements.password.addEventListener('input', () => {
  const value = form.elements.password.value;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  if (value.length < 8) score = Math.min(score, 1);

  const level = value ? Math.max(score, 1) : 0;
  strength.dataset.level = level;
  strengthText.textContent = ['', 'Weak', 'Okay', 'Strong'][level];
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(form);

  const username = form.elements.username.value.trim();
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;

  // Quick checks before calling the server.
  let firstInvalid = null;
  if (!username) {
    showFieldError(form, 'username', 'Choose a username.');
    firstInvalid = firstInvalid || form.elements.username;
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    showFieldError(form, 'email', 'Enter a valid email address.');
    firstInvalid = firstInvalid || form.elements.email;
  }
  if (password.length < 8) {
    showFieldError(form, 'password', 'Password must have at least 8 characters.');
    firstInvalid = firstInvalid || form.elements.password;
  }
  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  setLoading(button, true, 'Creating account');

  try {
    const response = await fetch(`${API_URL}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });

    if (response.ok) {
      window.location.href = 'index.html?registered=1';
      return;
    }

    // The API returns errors like { "username": ["..."], "email": ["..."] }.
    const data = await response.json().catch(() => ({}));
    const keys = Object.keys(data);
    let shown = false;
    keys.forEach((key) => {
      const message = Array.isArray(data[key]) ? data[key][0] : String(data[key]);
      if (form.elements[key]) {
        showFieldError(form, key, message);
        shown = true;
      }
    });
    if (!shown) {
      showFormAlert(form, 'Could not create your account. Please try again.');
    }
  } catch (err) {
    showFormAlert(form, NETWORK_MESSAGE);
  }

  setLoading(button, false);
});