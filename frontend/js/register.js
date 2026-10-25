document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('error');
  errorBox.textContent = '';

  const response = await fetch(`${API_URL}/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.getElementById('username').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
    }),
  });

  if (response.ok) {
    alert('Account created! Please log in.');
    window.location.href = 'index.html';
  } else {
    const data = await response.json();
    // Show the first error message the API returned
    const firstKey = Object.keys(data)[0];
    errorBox.textContent = `${firstKey}: ${data[firstKey]}`;
  }
});