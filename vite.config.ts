import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Same-origin path for the OTLP write proxy (avoids browser CORS) — rewritten
      // from /otlp/v1/logs to the proxy's /v1/logs; the Authorization header set by
      // observe-js's init() headers option passes through untouched.
      '/otlp': {
        target: 'http://localhost:4318',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/otlp/, ''),
      },
    },
  },
})
