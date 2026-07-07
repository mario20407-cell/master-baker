import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['branding/logo-emblema.png', 'branding/logo-completo.png'],
      manifest: {
        name: 'Master Baker — Gestión Inteligente de Panadería',
        short_name: 'Master Baker',
        description: 'Gestión inteligente de panadería — costeo, recetas, inventario y ventas',
        theme_color: '#263D4F',
        background_color: '#FBF6EC',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'branding/logo-emblema.png', sizes: '192x192', type: 'image/png' },
          { src: 'branding/logo-emblema.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } }
          }
        ]
      }
    })
  ],
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } } }
})
