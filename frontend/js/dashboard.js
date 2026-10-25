async function loadUser() {
  const token = getAccessToken();
  if (!token) {
    window.location.href = 'index.html';   // not logged in
    return;
  }

  const response = await fetch(`${API_URL}/auth/me/`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {          // token expired or invalid
    logout();
    return;
  }

  const user = await response.json();
  document.getElementById('welcome').textContent = `Welcome, ${user.username}!`;
  document.getElementById('email').textContent = user.email;
  document.getElementById('role').textContent = user.role;
  document.getElementById('income').textContent =
    `${user.profile.currency} ${user.profile.monthly_income}`;
}

loadUser();