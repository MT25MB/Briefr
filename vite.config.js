import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import rssHandler from './api/rss.js'
import icsHandler from './api/ics.js'

// Dev equivalent of /api/rss. Production uses functions/api/rss.js on
// Cloudflare Pages; this adapter is only imported by Vite's Node config.
function rssDevEndpoint() {
  return {
    name: 'briefr-rss-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/rss', rssHandler)
      server.middlewares.use('/api/ics', icsHandler)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), rssDevEndpoint()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
