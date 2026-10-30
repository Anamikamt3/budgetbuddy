import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port 5500 is already allowed by your Django CORS settings,
// so the backend does not need any change.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5500, strictPort: true },
});
