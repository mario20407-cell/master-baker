import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['branding/logo-emblema.png', 'branding/logo-completo.png', 'branding/icon-192.png', 'branding/icon-512.png'],
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
          { src: 'branding/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'branding/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'branding/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Excluir HTML para evitar que el index.html se precachee y se sirva viejo
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        navigateFallback: null,
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
