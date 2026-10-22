import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { type PluginOption, defineConfig } from 'vite'

/**
 * Muster runs beside the rigs it manages, so it must never take one of their ports. Demo's rig
 * holds 1232, 1234, 5173, 8765, 8766, 8767 and 9222 — Vite's default 5173 among them. The dev
 * server never watches `src-tauri/`: cargo's locked build outputs there crash the watcher.
 */
const WEB_PORT = 4870
const SERVER_PORT = Number(process.env.MUSTER_PORT ?? 4871)

const reactDevTools = (): PluginOption => {
  return {
    name: 'react-devtools',
    apply: 'serve',
    transformIndexHtml(html) {
      return {
        html,
        tags: [{ tag: 'script', attrs: { src: 'http://localhost:8097' }, injectTo: 'head' }]
      }
    }
  }
}

export default defineConfig({
  root: '.',
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler']
      }
    }),
    tailwindcss(),
    reactDevTools()
  ],
  server: {
    port: WEB_PORT,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
    proxy: {
      '/api': { target: `http://127.0.0.1:${SERVER_PORT}`, changeOrigin: true, ws: true }
    }
  },
  preview: { port: WEB_PORT, strictPort: true },
  build: {
    outDir: 'dist/web',
    sourcemap: false
  }
})
