import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const values = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  const apiOrigin = new URL(values.VITE_API_URL!).origin
  const helperHeaders = {
    'Content-Security-Policy': `default-src 'none'; script-src 'self'; connect-src ${apiOrigin}; frame-ancestors https://www.nbacorner.com; base-uri 'none'; form-action 'none'`,
    'X-Frame-Options': 'SAMEORIGIN',
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  }
  return {
    plugins: [react(), {
      name: 'daily-auth-helper-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] === '/daily-stats-auth.html') {
            for (const [key, value] of Object.entries(helperHeaders))
              res.setHeader(key, key === 'Content-Security-Policy' ? value.replace('frame-ancestors https://www.nbacorner.com', "frame-ancestors 'self'") : value)
          }
          next()
        })
      },
      generateBundle() {
        // Route-scoped Pages headers; no global framing/security change.
        this.emitFile({ type: 'asset', fileName: '_headers', source: '/daily-stats-auth.html\n' + Object.entries(helperHeaders).map(([k,v]) => `  ${k}: ${v}`).join('\n') + '\n' })
      },
    }],
    build: { rollupOptions: { input: { main: resolve(process.cwd(), 'index.html'), dailyAuth: resolve(process.cwd(), 'daily-stats-auth.html') } } },
  }
})
