import api from './api.js';

// Downloads a file from the API (the login token is added automatically)
// and saves it on the user's computer.
export async function downloadFile(path, params, filename) {
  let response;
  try {
    response = await api.get(path, { params, responseType: 'blob' });
  } catch (err) {
    // A failed download answers with a small JSON message inside a blob. Read it,
    // so the user sees "Excel reports is a Premium feature" and not a vague error.
    const blob = err.response && err.response.data;
    if (blob instanceof Blob) {
      let detail = '';
      try {
        detail = JSON.parse(await blob.text()).detail || '';
      } catch (parseError) {
        detail = '';
      }
      if (detail) {
        const friendly = new Error(detail);
        friendly.response = { data: { detail } };
        throw friendly;
      }
    }
    throw err;
  }

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}