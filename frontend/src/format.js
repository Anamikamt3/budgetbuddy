export function formatMoney(amount, currency = 'INR') {
  const number = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(number);
  } catch (err) {
    return `${currency} ${number.toFixed(2)}`;
  }
}

export function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function dayLabel(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonth() {
  return todayISO().slice(0, 7);          // "2026-10"
}

export function monthLabel(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// 2026-10 -> "Oct 26"
export function shortMonth(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function greetingFor(name) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name}`;
}

export function initialsFor(fullName, username) {
  const source = (fullName || '').trim();
  if (source) {
    const parts = source.split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

// Colour of a progress bar: normal, yellow from 80 percent, red from 100 percent
export function barClass(percent) {
  return percent >= 100 ? 'over' : percent >= 80 ? 'warn' : '';
}

// "2026-10-30T08:15:00Z" -> "5 minutes ago", "3 hours ago", "2 days ago"
export function timeAgo(isoDateTime) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoDateTime).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(isoDateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// "2026-10-30T08:15:00Z" -> "30 October 2026"
export function formatLongDate(isoDateTime) {
  return new Date(isoDateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}