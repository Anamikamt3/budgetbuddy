const API_URL = 'http://127.0.0.1:8000/api';

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