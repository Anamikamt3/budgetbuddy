const ROLE_NAMES = { student: 'Student', premium: 'Premium user', admin: 'Admin' };

const $ = (id) => document.getElementById(id);

$('logoutBtn').addEventListener('click', logout);

function greetingFor(name) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name}`;
}

function initialsFor(profileName, username) {
  const source = (profileName || '').trim();
  if (source) {
    const parts = source.split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

function formatMoney(amount, currency) {
  const number = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(number);
  } catch (err) {
    return `${currency} ${number.toFixed(2)}`;
  }
}

function showBanner(message) {
  const banner = $('banner');
  banner.textContent = message;
  banner.hidden = false;
}

async function loadUser() {
  const token = getAccessToken();
  if (!token) {
    window.location.replace('index.html');
    return;
  }

  let response;
  try {
    response = await fetch(`${API_URL}/auth/me/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    $('incomeValue').classList.remove('is-loading-block');
    showBanner(NETWORK_MESSAGE);
    return;
  }

  // Missing, expired or invalid token: back to the login page.
  if (!response.ok) {
    logout();
    return;
  }

  const user = await response.json();
  const profile = user.profile || {};
  const displayName = (profile.full_name || '').trim() || user.username;
  const roleName = ROLE_NAMES[user.role] || user.role;
  const income = Number(profile.monthly_income) || 0;

  document.title = `Overview | BudgetBuddy`;
  $('greeting').textContent = greetingFor(displayName);

  $('avatar').textContent = initialsFor(profile.full_name, user.username);
  $('sideName').textContent = displayName;
  $('sideRole').textContent = roleName;

  $('accUsername').textContent = user.username;
  $('accEmail').textContent = user.email;
  $('accName').textContent = profile.full_name || 'Not set';
  $('accRole').textContent = roleName;
  $('accCurrency').textContent = profile.currency || 'Not set';

  $('incomeValue').classList.remove('is-loading-block');
  $('incomeValue').textContent = formatMoney(income, profile.currency || 'USD');

  $('incomeNote').innerHTML =
    income > 0
      ? 'This is the monthly income saved on your profile.'
      : 'You have not set your monthly income yet. <strong>Profile editing</strong> arrives in the next update.';
}

loadUser();