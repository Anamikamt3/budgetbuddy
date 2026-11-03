import api from './api.js';

// Downloads a file from the API (the login token is added automatically)
// and saves it on the user's computer.
export async function downloadFile(path, params, filename) {
  const response = await api.get(path, { params, responseType: 'blob' });
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}