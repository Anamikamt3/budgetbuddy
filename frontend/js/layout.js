// Builds the sidebar on every logged-in page and loads the current user.
// Pages wait for it with:  appReady.then((user) => { ... });

const NAV_ITEMS = [
  { href: 'dashboard.html', label: 'Overview',
    icon: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>' },
  { href: 'expenses.html', label: 'Expenses',
    icon: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>' },
  { href: 'income.html', label: 'Income',
    icon: '<path d="M12 19V5M5 12l7-7 7 7"/>' },
  { href: 'budgets.html', label: 'Budgets',
    icon: '<path d="M12 3a9 9 0 1 0 9 9h-9V3z"/>' },
];

const ROLE_NAMES = { student: 'Student', premium: 'Premium user', admin: 'Admin' };

function buildSidebar() {
  const here = window.location.pathname.split('/').pop() || 'index.html';
  const links = NAV_ITEMS.map((item) =>
    `<a href="${item.href}"${item.href === here ? ' aria-current="page"' : ''}>
       <svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg>${item.label}
     </a>`
  ).join('');

  document.getElementById('sidebar').innerHTML = `
    <a class="brand" href="dashboard.html" aria-label="BudgetBuddy overview">
      <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#2d5bff"/><circle cx="16" cy="16" r="7" fill="none" stroke="#fff" stroke-width="3"/><circle cx="16" cy="16" r="2.5" fill="#f2b138"/></svg>
      BudgetBuddy
    </a>
    <nav class="nav" aria-label="Main">${links}</nav>
    <div class="side-user">
      <div class="avatar" id="avatar" aria-hidden="true">?</div>
      <div class="who">
        <div class="name" id="sideName">Loading</div>
        <div class="role" id="sideRole">&nbsp;</div>
      </div>
      <button type="button" class="logout" id="logoutBtn">Log out</button>
    </div>`;

  document.getElementById('logoutBtn').addEventListener('click', logout);
}

function initialsFor(profileName, username) {
  const source = (profileName || '').trim();
  if (source) {
    const parts = source.split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

buildSidebar();

const appReady = (async () => {
  const user = await apiFetch('/auth/me/');
  const profile = user.profile || {};
  const displayName = (profile.full_name || '').trim() || user.username;

  BB.currency = profile.currency || 'INR';
  BB.user = user;
  BB.displayName = displayName;

  document.getElementById('avatar').textContent = initialsFor(profile.full_name, user.username);
  document.getElementById('sideName').textContent = displayName;
  document.getElementById('sideRole').textContent = ROLE_NAMES[user.role] || user.role;
  return user;
})();

// If something goes wrong (for example the server is off), tell the user.
appReady.catch((err) => toast(err.message, 'error'));