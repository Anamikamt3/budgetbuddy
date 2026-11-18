import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port 5500 is already allowed by your Django CORS settings.
// The "test" block is only used by "npm test".
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5500, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    css: false,
  },
});