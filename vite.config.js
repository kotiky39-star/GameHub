import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // SPA fallback: /hub, /enter/:id, etc. all serve index.html
    historyApiFallback: true,
  },
})
