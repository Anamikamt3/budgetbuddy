document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('error');
  errorBox.textContent = '';

  const response = await fetch(`${API_URL}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.getElementById('username').value,
      password: document.getElementById('password').value,
    }),
  });

  const data = await response.json();

  if (response.ok) {
    saveTokens(data.access, data.refresh);
    window.location.href = 'dashboard.html';
  } else {
    errorBox.textContent = 'Invalid username or password.';
  }
});