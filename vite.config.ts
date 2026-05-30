import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'KisanMitra - Farmer Companion',
          short_name: 'KisanMitra',
          description: 'A comprehensive app for farmers providing advisory, market, and schemes.',
          theme_color: '#16a34a',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          // Aggressive caching for static assets
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,map}'],
          runtimeCaching: [
            // CacheFirst for static assets (JS, CSS, images, fonts)
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|ico)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // NetworkFirst for Mandi API (fresh data preferred)
            {
              urlPattern: /\/api\/mandi-prices$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'mandi-prices-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 5 // 5 minutes
                },
                networkTimeoutSeconds: 10,
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // StaleWhileRevalidate for other API calls
            {
              urlPattern: /\/api\/(advisory|price-predict|crop-plan|scheme-finder|crop-doctor)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 10 // 10 minutes
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Firebase/Firestore requests
            {
              urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'firebase-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 1 day
                },
                networkTimeoutSeconds: 15,
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Google Gemini API
            {
              urlPattern: /^https:\/\/generativelanguage\.googleapis\.com\/.*/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'gemini-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 30 // 30 minutes
                },
                networkTimeoutSeconds: 20,
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
});